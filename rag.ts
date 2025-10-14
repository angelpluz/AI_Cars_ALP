import { embedText } from './embed';
import {
  upsertChunks,
  searchTopK,
  type StoredChunk,
  type RetrievedChunk,
} from './ragStore';

export function chunkText(input: string, size = 800, overlap = 200): string[] {
  const normalized = input.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  const segments: string[] = [];
  if (!normalized.length || size <= 0) {
    return segments;
  }

  let index = 0;
  while (index < normalized.length) {
    const end = Math.min(index + size, normalized.length);
    const slice = normalized.slice(index, end).trim();
    if (slice.length) {
      segments.push(slice);
    }
    if (end >= normalized.length) {
      break;
    }
    index = overlap >= size ? end : Math.max(0, end - overlap);
    if (index === end) {
      break;
    }
  }

  return segments;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function ingestRaw(
  dataset: string,
  sourceUrl: string | undefined,
  raw: string,
): Promise<StoredChunk[]> {
  const parts = chunkText(raw);
  if (!parts.length) {
    console.warn('[rag] No chunks produced for dataset', dataset);
    return [];
  }
  console.log(`[rag] chunkText produced ${parts.length} chunk(s) for dataset ${dataset}`);
  const embedded = await Promise.all(
    parts.map(
      async (segment): Promise<StoredChunk> => ({
        dataset,
        sourceUrl: sourceUrl?.trim() || undefined,
        text: segment,
        embedding: await embedText(segment),
      }),
    ),
  );
  return upsertChunks(dataset, embedded);
}

export async function ingestFromUrl(dataset: string, sourceUrl: string): Promise<StoredChunk[]> {
  const timeoutMs = Number(Bun.env.RAG_FETCH_TIMEOUT_MS ?? '20000');
  const signal = Number.isFinite(timeoutMs) && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

  const label = `[rag] fetch ${sourceUrl}`;
  console.time(label);
  const response = await fetch(sourceUrl, signal ? { signal } : {});
  console.timeEnd(label);

  if (!response.ok) {
    throw new Error(`Fetch ${sourceUrl} - HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const maxBytes = Number(Bun.env.RAG_FETCH_MAX_BYTES ?? 5 * 1024 * 1024);
  const bodyText = await readResponseText(response, maxBytes);
  console.log(`[rag] fetched ${bodyText.length} characters from ${sourceUrl}`);

  let text: string;
  if (contentType.includes('json')) {
    try {
      const parsed = JSON.parse(bodyText);
      text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    } catch (error) {
      console.warn('[rag] Failed to parse JSON payload, falling back to raw text', error);
      text = bodyText;
    }
  } else if (contentType.includes('html')) {
    text = htmlToText(bodyText);
  } else {
    text = bodyText;
  }

  return ingestRaw(dataset, sourceUrl, text);
}

function assertPositiveLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 5 * 1024 * 1024;
  }
  return limit;
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const limit = assertPositiveLimit(maxBytes);
  const reader = response.body?.getReader();
  if (!reader) {
    const raw = await response.text();
    if (raw.length > limit) {
      throw new Error('[rag] Remote payload exceeded byte limit');
    }
    return raw;
  }

  const decoder = new TextDecoder();
  let received = 0;
  let text = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    const chunk = value ?? new Uint8Array();
    received += chunk.byteLength;
    if (received > limit) {
      reader.cancel().catch(() => {});
      throw new Error(`[rag] Remote payload exceeded limit of ${limit} bytes`);
    }
    text += decoder.decode(chunk, { stream: true });
  }

  text += decoder.decode();
  return text;
}

export async function retrieve(dataset: string, query: string, k = 5): Promise<RetrievedChunk[]> {
  const queryVector = await embedText(query);
  return searchTopK(dataset, queryVector, k);
}

export function buildAugmentedPrompt(
  query: string,
  contexts: Array<{ text: string; sourceUrl?: string }>,
): string {
  const ctxBlock = contexts
    .map((context, index) =>
      `?${index + 1}?${context.text}${context.sourceUrl ? `\n(Source: ${context.sourceUrl})` : ''}`,
    )
    .join('\n\n');

  return [
    'You are a helpful, precise assistant. Use ONLY the context when possible.',
    'If the answer is not in the context, say you are not sure.',
    '',
    '=== Context ===',
    ctxBlock || '(no context)',
    '=== End Context ===',
    '',
    `User question: ${query}`,
    '',
    'Answer in clear Thai and cite sources as [1], [2], ... where relevant.',
  ].join('\n');
}
