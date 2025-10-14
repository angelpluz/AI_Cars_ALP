import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export type StoredChunk = {
  dataset: string;
  text: string;
  sourceUrl?: string;
  embedding: number[];
};

export type RetrievedChunk = {
  text: string;
  sourceUrl?: string;
  score: number;
};

type PersistedDataset = {
  dataset: string;
  updatedAt?: string;
  chunks: StoredChunk[];
};

const DATA_DIR = resolve(Bun.env.RAG_DATA_DIR ?? 'rag-data');

const datasetFiles = new Map<string, string>();
const store = new Map<string, StoredChunk[]>();

initFromDisk();

export function upsertChunks(dataset: string, chunks: StoredChunk[]): StoredChunk[] {
  if (!dataset.trim() || !chunks.length) {
    return [];
  }
  const normalizedDataset = dataset.trim();
  const existing = store.get(normalizedDataset) ?? [];
  const cleaned = chunks.map((chunk) => normalizeChunk(chunk, normalizedDataset));
  existing.push(...cleaned);
  store.set(normalizedDataset, existing);
  persistDataset(normalizedDataset, existing);
  return cleaned;
}

export function searchTopK(dataset: string, queryEmbedding: number[], k = 5): RetrievedChunk[] {
  const entries = store.get(dataset) ?? [];
  if (!entries.length) {
    return [];
  }
  return entries
    .map((chunk) => ({
      text: chunk.text,
      sourceUrl: chunk.sourceUrl,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, k));
}

function initFromDisk(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('[ragStore] Failed to ensure data directory', error);
    return;
  }

  let entries: string[] = [];
  try {
    entries = readdirSync(DATA_DIR);
  } catch (error) {
    console.warn('[ragStore] Unable to read data directory', error);
    return;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const filePath = join(DATA_DIR, entry);
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedDataset;
      if (!parsed || typeof parsed.dataset !== 'string' || !Array.isArray(parsed.chunks)) {
        console.warn('[ragStore] Ignoring malformed dataset file', filePath);
        continue;
      }
      const dataset = parsed.dataset.trim();
      const chunks = parsed.chunks.map((chunk) => normalizeChunk(chunk, dataset));
      store.set(dataset, chunks);
      datasetFiles.set(dataset, filePath);
    } catch (error) {
      console.warn('[ragStore] Failed to load dataset file', filePath, error);
    }
  }
}

function normalizeChunk(chunk: StoredChunk, dataset: string): StoredChunk {
  return {
    dataset,
    text: chunk.text ?? '',
    sourceUrl: chunk.sourceUrl?.trim() || undefined,
    embedding: Array.isArray(chunk.embedding) ? chunk.embedding.map((value) => Number(value) || 0) : [],
  };
}

function persistDataset(dataset: string, chunks: StoredChunk[]): void {
  const filePath = ensureDatasetFilePath(dataset);
  const payload: PersistedDataset = {
    dataset,
    updatedAt: new Date().toISOString(),
    chunks,
  };
  try {
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[ragStore] Failed to persist dataset "${dataset}"`, error);
  }
}

function ensureDatasetFilePath(dataset: string): string {
  const existing = datasetFiles.get(dataset);
  if (existing) {
    return existing;
  }
  const slug = slugifyDataset(dataset);
  const filePath = join(DATA_DIR, `${slug}.json`);
  datasetFiles.set(dataset, filePath);
  return filePath;
}

function slugifyDataset(dataset: string): string {
  const normalized = dataset
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const hash = createHash('sha1').update(dataset).digest('hex').slice(0, 8);
  const prefix = normalized || 'dataset';
  return `${prefix}-${hash}`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  if (length === 0) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i += 1) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB) || 1;
  return dot / denom;
}
