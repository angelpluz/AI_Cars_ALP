import { embedText, VECTOR_LENGTH } from './embed';
import {
  upsertChunks,
  searchTopK,
  searchMultipleDatasets,
  type StoredChunk,
  type RetrievedChunk,
} from './ragStore';

// Chunking ที่ดีขึ้นสำหรับภาษาไทย
export function chunkText(input: string, size = 800, overlap = 200): string[] {
  const normalized = input
    .replace(/\r\n/g, '\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
    
  const segments: string[] = [];
  if (!normalized.length || size <= 0) {
    return segments;
  }

  // พยายามแบ่งตาม paragraph ก่อน
  const paragraphs = normalized.split(/\n{2,}/);
  let currentChunk = '';
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    
    // ถ้า paragraph ยาวเกิน size ให้แบ่งอีก
    if (trimmed.length > size) {
      // ถ้ามี currentChunk อยู่ ให้ push ก่อน
      if (currentChunk.length > overlap) {
        segments.push(currentChunk.trim());
        // เก็บ overlap ไว้
        currentChunk = currentChunk.slice(-overlap);
      }
      
      // แบ่ง paragraph ยาวๆ
      let idx = 0;
      while (idx < trimmed.length) {
        const remaining = size - currentChunk.length;
        const take = Math.min(remaining, trimmed.length - idx);
        currentChunk += trimmed.slice(idx, idx + take);
        idx += take;
        
        if (currentChunk.length >= size) {
          segments.push(currentChunk.trim());
          currentChunk = currentChunk.slice(-overlap);
        }
      }
    } else {
      // paragraph ปกติ
      if (currentChunk.length + trimmed.length + 1 > size) {
        segments.push(currentChunk.trim());
        currentChunk = currentChunk.slice(-overlap) + '\n' + trimmed;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      }
    }
  }
  
  // Push ส่วนที่เหลือ
  if (currentChunk.trim().length > 50) {
    segments.push(currentChunk.trim());
  }

  return segments.filter(s => s.length > 30);
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
  
  // ใช้ batch embedding
  const { embedTexts } = await import('./embed');
  const embeddings = await embedTexts(parts);
  
  const embedded: StoredChunk[] = parts.map((segment, i) => ({
    dataset,
    sourceUrl: sourceUrl?.trim() || undefined,
    text: segment,
    embedding: embeddings[i] || new Array(VECTOR_LENGTH).fill(0),
  })).filter(chunk => chunk.embedding.length === VECTOR_LENGTH);
  
  if (!embedded.length) {
    console.warn('[rag] No valid embeddings generated');
    return [];
  }
  
  return upsertChunks(dataset, embedded);
}

export async function fetchUrlContent(
  sourceUrl: string,
): Promise<{ text: string; raw: string; contentType: string }> {
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
  const raw = await readResponseText(response, maxBytes);
  console.log(`[rag] fetched ${raw.length} characters from ${sourceUrl}`);

  let text: string;
  if (contentType.includes('json')) {
    try {
      const parsed = JSON.parse(raw);
      text = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    } catch (error) {
      console.warn('[rag] Failed to parse JSON payload, falling back to raw text', error);
      text = raw;
    }
  } else if (contentType.includes('html')) {
    text = htmlToText(raw);
  } else {
    text = raw;
  }

  return { text, raw, contentType };
}

export async function ingestFromUrl(dataset: string, sourceUrl: string): Promise<StoredChunk[]> {
  const { text } = await fetchUrlContent(sourceUrl);
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

// Retrieval ที่ดีขึ้นด้วย Hybrid Search
export async function retrieve(
  datasets: string | string[], 
  query: string, 
  k = 5,
  options?: {
    useHybrid?: boolean;
    rerank?: boolean;
  }
): Promise<RetrievedChunk[]> {
  const limit = Math.max(5, k);
  const list = (Array.isArray(datasets) ? datasets : [datasets])
    .map((name) => name.trim())
    .filter(Boolean);
  const unique = [...new Set(list)];
  
  if (!unique.length) {
    return [];
  }

  const queryVector = await embedText(query);
  
  // ใช้ searchMultipleDatasets ที่มี hybrid search
  const results = searchMultipleDatasets(
    unique, 
    queryVector, 
    query, 
    limit * 2, // ดึงมากกว่าที่ต้องการเพื่อ re-rank
    options?.useHybrid ?? true
  );

  // Re-ranking ง่ายๆ ถ้าเปิด
  if (options?.rerank) {
    return rerankResults(results, query).slice(0, limit);
  }

  return results.slice(0, limit);
}

// Simple re-ranking โดยให้ความสำคัญกับ query terms ที่อยู่ใกล้กัน
function rerankResults(results: RetrievedChunk[], query: string): RetrievedChunk[] {
  const queryTerms = tokenizeThai(query);
  
  return results.map(item => {
    const textTerms = tokenizeThai(item.text);
    let bonus = 0;
    
    // Check for bigram matches
    for (let i = 0; i < queryTerms.length - 1; i++) {
      const bigram = `${queryTerms[i]} ${queryTerms[i + 1]}`;
      const textBigrams: string[] = [];
      for (let j = 0; j < textTerms.length - 1; j++) {
        textBigrams.push(`${textTerms[j]} ${textTerms[j + 1]}`);
      }
      if (textBigrams.some(tb => tb.includes(bigram) || bigram.includes(tb))) {
        bonus += 0.05;
      }
    }
    
    return {
      ...item,
      score: item.score + bonus,
    };
  }).sort((a, b) => b.score - a.score);
}

export function buildAugmentedPrompt(
  query: string,
  contexts: Array<{ text: string; sourceUrl?: string; dataset?: string; citationIndex?: number }>,
): string {
  const ctxBlock = contexts
    .map(
      (context, index) => {
        const label = Number.isFinite(context.citationIndex) ? Number(context.citationIndex) : index + 1;
        return `[${label}] ${context.text}${context.sourceUrl ? `\n(Source: ${context.sourceUrl})` : ''}`;
      },
    )
    .join('\n\n');

  const datasetHints = new Map<string, number>();
  contexts.forEach((context) => {
    if (context.dataset) {
      datasetHints.set(context.dataset, (datasetHints.get(context.dataset) ?? 0) + 1);
    }
  });

  const guidance: string[] = [];
  const serviceCount = datasetHints.get('service-centers');
  if (serviceCount && serviceCount > 0) {
    // ตรวจสอบว่าคำถามถามเฉพาะสาขาหรือทุกสาขา
    const isSpecificBranch = /สำนักงานใหญ่|สาขา[\w\s]+|ใกล้|แถว|ย่าน/.test(query);
    if (isSpecificBranch) {
      guidance.push(
        `ตอบเฉพาะสาขาที่ผู้ใช้ถาม หรือสาขาที่เกี่ยวข้องกับพื้นที่ที่ระบุ ไม่ต้องแสดงรายชื่อทุกสาขา ให้สรุปเฉพาะข้อมูลที่ตรงกับคำถาม`,
      );
    } else {
      guidance.push(
        `บริบทมีข้อมูลสาขาทั้งหมด หากผู้ใช้ถามทั่วไปให้สรุปคร่าวๆ หากถามเฉพาะให้ตอบเฉพาะที่ถาม`,
      );
    }
  }

  // เพิ่ม guidance สำหรับ datasets อื่นๆ
  const carCount = datasetHints.get('cars-lineup');
  if (carCount && carCount > 0) {
    guidance.push(
      `ให้ตอบตรงคำถาม หากถามเรื่องรุ่นย่อยให้แจงแจงรุ่นย่อยและราคา หากถามเรื่องเดียวไม่ต้องไปยุ่งเรื่องอื่น`,
    );
  }

  const promoCount = datasetHints.get('monthly-promos');
  if (promoCount && promoCount > 0) {
    guidance.push(
      `ข้อมูลโปรโมชั่นมี ${promoCount} รายการ ให้แจ้งรายละเอียดโปรโมชั่นครบถ้วน รวมถึงเงื่อนไขและระยะเวลา`,
    );
  }

  // เพิ่ม guidance ให้ใส่ disclaimer สำหรับข้อมูลการเงิน
  const isFinanceRelated = datasetHints.has('finance-rules') || 
    /ดาวน์|ผ่อน|ดอกเบี้ย|ไฟแนนซ์|จัด|ยอด|งวด|ลีสซิ่ง|trade/i.test(query);
  
  if (isFinanceRelated) {
    guidance.push(
      'หากตอบเรื่องการคำนวณเงินผ่อน ดอกเบี้ย หรือเงินดาวน์ ให้เติมข้อความต่อท้ายเสมอว่า: หมายเหตุ: ข้อมูลดังกล่าวเป็นเพียงข้อมูลพื้นฐานขั้นต้นเพื่อประกอบการตัดสินใจ กรุณาติดต่อตัวแทนจำหน่ายสาขาใกล้ท่านสำหรับเงื่อนไขและอัตราดอกเบี้ยที่ถูกต้อง'
    );
  }

  const guidanceBlock = guidance.length ? `${guidance.join(' ')}
` : '';

  const promptParts = [
    'คุณเป็นผู้ช่วยลูกค้าของโตโยต้า ธนบุรี ตอบคำถามตรงประเด็น',
    'หากคำถามถามเฉพาะเรื่อง ให้ตอบเฉพาะเรื่องนั้น',
    'ใช้ข้อมูลในบริบทที่ให้มาตอบก่อน หากมีข้อมูลตอบได้เลย อย่าตอบว่าไม่มีข้อมูล',
    'ถ้าพบข้อมูลที่ใกล้เคียงกับคำถาม ให้ตอบสิ่งที่พบก่อน และระบุชัดว่าจุดไหนไม่มีในข้อมูล',
    'หากคำตอบไม่มีในบริบทจริงๆ ค่อยตอบว่า "ขออภัย ไม่พบข้อมูลในฐานข้อมูล"',
    'ตอบกระชัด เป็นธรรมชาติ เหมือนคุยกับลูกค้า',
    guidanceBlock,
    '=== บริบทข้อมูล ===',
    ctxBlock || '(ไม่มีบริบท)',
    '=== จบบริบท ===',
    '',
    `คำถาม: ${query}`,
    '',
    'ตอบตรงคำถาม อย่าเล่าเรื่องอื่นนอกจากที่ถาม',
  ];

  return promptParts.filter((part) => part !== '').join('\n');
}

function tokenizeThai(text: string): string[] {
  if (!text) return [];
  
  return text
    .toLowerCase()
    .replace(/[^\u0e00-\u0e7fa-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);
}

// Backward compatibility
export { upsertChunks };
