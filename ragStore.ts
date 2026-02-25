import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { VECTOR_LENGTH } from './embed';

export type StoredChunk = {
  dataset: string;
  text: string;
  sourceUrl?: string;
  embedding: number[];
  // เพิ่มสำหรับ full-text index
  tokens?: string[];
  tokenFreq?: Map<string, number>;
};

export type RetrievedChunk = {
  text: string;
  sourceUrl?: string;
  dataset: string;
  score: number;
  // แยก score สำหรับ debug
  vectorScore?: number;
  textScore?: number;
};

type PersistedDataset = {
  dataset: string;
  updatedAt?: string;
  chunks: StoredChunk[];
  // เพิ่ม inverted index สำหรับ full-text
  invertedIndex?: Record<string, number[]>;
};

const DATA_DIR = resolve(Bun.env.RAG_DATA_DIR ?? 'rag-data');

// Weights สำหรับ hybrid search
const VECTOR_WEIGHT = 0.7;
const TEXT_WEIGHT = 0.3;

const datasetFiles = new Map<string, string>();
const datasetMtime = new Map<string, number>();
const store = new Map<string, StoredChunk[]>();
const invertedIndices = new Map<string, Map<string, Set<number>>>();

initFromDisk();

export function upsertChunks(dataset: string, chunks: StoredChunk[]): StoredChunk[] {
  if (!dataset.trim() || !chunks.length) {
    return [];
  }
  const normalizedDataset = dataset.trim();
  const existing = store.get(normalizedDataset) ?? [];
  const cleaned = chunks.map((chunk, index) => normalizeChunk(chunk, normalizedDataset, existing.length + index));
  existing.push(...cleaned);
  store.set(normalizedDataset, existing);
  
  // สร้าง inverted index
  buildInvertedIndex(normalizedDataset, cleaned, existing.length - cleaned.length);
  
  persistDataset(normalizedDataset, existing);
  return cleaned;
}

export function searchTopK(
  dataset: string, 
  queryEmbedding: number[], 
  queryText: string,
  k = 5,
  useHybrid = true
): RetrievedChunk[] {
  ensureDatasetLoaded(dataset);
  const entries = store.get(dataset) ?? [];
  if (!entries.length) {
    return [];
  }

  // Vector search
  const vectorResults = entries.map((chunk, index) => ({
    index,
    text: chunk.text,
    sourceUrl: chunk.sourceUrl,
    dataset,
    vectorScore: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  if (!useHybrid) {
    return vectorResults
      .sort((a, b) => b.vectorScore - a.vectorScore)
      .slice(0, Math.max(1, k))
      .map(r => ({
        text: r.text,
        sourceUrl: r.sourceUrl,
        dataset: r.dataset,
        score: r.vectorScore,
      }));
  }

  // Full-text search
  const queryTokens = tokenizeThai(queryText);
  const textScores = computeTextScores(dataset, queryTokens, entries.length);

  // Combine scores
  const combined = vectorResults.map((item, idx) => {
    const textScore = textScores[idx] ?? 0;
    // Normalize vector score (cosine similarity is already -1 to 1, usually 0-1 for positive vectors)
    const normalizedVectorScore = Math.max(0, item.vectorScore); // 0 to 1
    // Text score is 0 to 1
    const normalizedTextScore = Math.min(1, textScore);
    
    const finalScore = (VECTOR_WEIGHT * normalizedVectorScore) + (TEXT_WEIGHT * normalizedTextScore);
    
    return {
      text: item.text,
      sourceUrl: item.sourceUrl,
      dataset: item.dataset,
      score: finalScore,
      vectorScore: normalizedVectorScore,
      textScore: normalizedTextScore,
    };
  });

  return combined
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, k));
}

// ค้นหาหลาย datasets พร้อมกัน
export function searchMultipleDatasets(
  datasets: string[],
  queryEmbedding: number[],
  queryText: string,
  k = 5,
  useHybrid = true
): RetrievedChunk[] {
  const allResults: RetrievedChunk[] = [];
  
  for (const dataset of datasets) {
    const results = searchTopK(dataset, queryEmbedding, queryText, k * 2, useHybrid);
    allResults.push(...results);
  }

  // Re-rank รวมกัน
  return allResults
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, k));
}

function buildInvertedIndex(dataset: string, chunks: StoredChunk[], startIndex: number): void {
  let index = invertedIndices.get(dataset);
  if (!index) {
    index = new Map<string, Set<number>>();
    invertedIndices.set(dataset, index);
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    const docIndex = startIndex + i;
    const tokens = tokenizeThai(chunk.text);
    
    // Store tokens ใน chunk สำหรับ reuse
    chunk.tokens = tokens;
    
    for (const token of tokens) {
      let docs = index.get(token);
      if (!docs) {
        docs = new Set<number>();
        index.set(token, docs);
      }
      docs.add(docIndex);
    }
  }
}

function computeTextScores(dataset: string, queryTokens: string[], docCount: number): number[] {
  const scores = new Array(docCount).fill(0);
  const index = invertedIndices.get(dataset);
  
  if (!index || !queryTokens.length) {
    return scores;
  }

  // TF-IDF style scoring
  const docFreq = new Map<string, number>();
  
  for (const token of queryTokens) {
    const docs = index.get(token);
    if (docs) {
      docFreq.set(token, docs.size);
      for (const docIdx of docs) {
        // Simple TF (term frequency in document)
        const chunks = store.get(dataset);
        if (!chunks) continue;
        const targetChunk = chunks[docIdx];
        if (targetChunk) {
          const chunkTokens = targetChunk.tokens || tokenizeThai(targetChunk.text);
          const tf = chunkTokens.filter(t => t === token).length / (chunkTokens.length || 1);
          // IDF
          const idf = Math.log(docCount / (docs.size + 1)) + 1;
          scores[docIdx] += tf * idf;
        }
      }
    }
  }

  return scores;
}

// Tokenizer สำหรับภาษาไทย (ง่ายๆ แต่ได้ผลดี)
function tokenizeThai(text: string): string[] {
  if (!text) return [];
  
  return text
    .toLowerCase()
    .replace(/[^\u0e00-\u0e7fa-z0-9\s]/g, ' ') // เก็บ Thai + Eng + ตัวเลข
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2)
    .filter(t => !isStopWord(t));
}

// ลบ stop words ภาษาไทยพื้นฐาน
function isStopWord(token: string): boolean {
  const thaiStopWords = new Set([
    'และ', 'ของ', 'ใน', 'ที่', 'มี', 'เป็น', 'ได้', 'จะ', 'ให้', 'ว่า',
    'แต่', 'โดย', 'ก็', 'หรือ', 'คือ', 'จาก', 'นี้', 'ถูก', 'กับ', 'นํา',
    'การ', 'ซึ่ง', 'อยู่', 'ไม่', 'แล้ว', 'ต้อง', 'เมื่อ', 'เพื่อ', 'ทาง',
    'เช่น', 'ตาม', 'ยัง', 'เรื่อง', 'ผู้', 'อีก', 'เพราะ', 'ขึ้น', 'ค่ะ', 'ครับ',
    'รถ', 'รถยนต์', 'ตัว', 'หนึ่ง', 'สอง', 'อะไร', 'อย่าง', 'อื่น', 'ทุก',
    'ทั้ง', 'ทำ', 'มา', 'ไป', 'ด้วย', 'สามารถ', 'ใช้', 'ดี', 'มาก', 'น้อย'
  ]);
  return thaiStopWords.has(token);
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
    loadDatasetFile(filePath);
  }
}

function normalizeChunk(chunk: StoredChunk, dataset: string, index: number): StoredChunk {
  const text = typeof chunk.text === 'string' ? chunk.text : '';
  const sourceUrl = chunk.sourceUrl?.trim() || undefined;

  let embedding: number[] = [];
  if (Array.isArray(chunk.embedding)) {
    const sanitized = chunk.embedding.map((value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    });
    if (sanitized.length === VECTOR_LENGTH) {
      embedding = sanitized;
    }
  }

  return {
    dataset,
    text,
    sourceUrl,
    embedding,
    tokens: chunk.tokens || tokenizeThai(text),
  };
}

function persistDataset(dataset: string, chunks: StoredChunk[]): void {
  const normalized = dataset.trim();
  if (!normalized) {
    return;
  }
  const filePath = ensureDatasetFilePath(normalized);
  
  // แปลง inverted index เป็น JSON serializable
  const invIndex = invertedIndices.get(normalized);
  const serializedIndex: Record<string, number[]> = {};
  if (invIndex) {
    for (const [token, docs] of invIndex) {
      serializedIndex[token] = Array.from(docs);
    }
  }
  
  const payload: PersistedDataset = {
    dataset: normalized,
    updatedAt: new Date().toISOString(),
    chunks,
    invertedIndex: serializedIndex,
  };
  
  try {
    writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    store.set(normalized, chunks);
    datasetFiles.set(normalized, filePath);
    const mtime = getFileMtimeMs(filePath);
    if (mtime !== undefined) {
      datasetMtime.set(normalized, mtime);
    }
  } catch (error) {
    console.error(`[ragStore] Failed to persist dataset "${normalized}"`, error);
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

function loadDatasetFile(filePath: string): void {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedDataset;
    if (!parsed || typeof parsed.dataset !== 'string' || !Array.isArray(parsed.chunks)) {
      console.warn('[ragStore] Ignoring malformed dataset file', filePath);
      return;
    }
    const dataset = parsed.dataset.trim();
    if (!dataset) {
      console.warn('[ragStore] Dataset name missing in file', filePath);
      return;
    }
    hydrateDatasetFromPayload(dataset, parsed.chunks, parsed.invertedIndex, filePath);
  } catch (error) {
    console.warn('[ragStore] Failed to load dataset file', filePath, error);
  }
}

function hydrateDatasetFromPayload(
  dataset: string, 
  chunks: StoredChunk[], 
  invertedIndex: Record<string, number[]> | undefined,
  filePath: string
): void {
  const normalized = dataset.trim();
  const normalizedChunks = chunks.map((chunk) => normalizeChunk(chunk, normalized, 0));
  store.set(normalized, normalizedChunks);
  datasetFiles.set(normalized, filePath);
  
  // Rebuild inverted index
  const index = new Map<string, Set<number>>();
  if (invertedIndex) {
    for (const [token, docs] of Object.entries(invertedIndex)) {
      index.set(token, new Set(docs));
    }
  } else {
    // สร้างใหม่ถ้าไม่มี
    for (let i = 0; i < normalizedChunks.length; i++) {
      const chunk = normalizedChunks[i];
      if (!chunk) continue;
      const tokens = tokenizeThai(chunk.text);
      chunk.tokens = tokens;
      for (const token of tokens) {
        let docs = index.get(token);
        if (!docs) {
          docs = new Set<number>();
          index.set(token, docs);
        }
        docs.add(i);
      }
    }
  }
  invertedIndices.set(normalized, index);
  
  const mtime = getFileMtimeMs(filePath);
  if (mtime !== undefined) {
    datasetMtime.set(normalized, mtime);
  } else {
    datasetMtime.delete(normalized);
  }
}

function ensureDatasetLoaded(dataset: string): void {
  const normalized = dataset.trim();
  if (!normalized) {
    return;
  }

  const existingPath = datasetFiles.get(normalized);
  if (existingPath) {
    const lastKnownMtime = datasetMtime.get(normalized);
    const currentMtime = getFileMtimeMs(existingPath);
    if (store.has(normalized) && lastKnownMtime !== undefined && currentMtime !== undefined && lastKnownMtime >= currentMtime) {
      return;
    }
    loadDatasetFile(existingPath);
    return;
  }

  let entries: string[] = [];
  try {
    entries = readdirSync(DATA_DIR);
  } catch (error) {
    console.warn('[ragStore] Unable to scan datasets directory', error);
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
      if (!parsed || typeof parsed.dataset !== 'string') {
        continue;
      }
      const parsedName = parsed.dataset.trim();
      if (parsedName !== normalized) {
        continue;
      }
      hydrateDatasetFromPayload(parsedName, Array.isArray(parsed.chunks) ? parsed.chunks : [], parsed.invertedIndex, filePath);
      return;
    } catch (error) {
      console.warn('[ragStore] Failed to inspect dataset file', filePath, error);
    }
  }
}

function getFileMtimeMs(filePath: string): number | undefined {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return undefined;
  }
}

// Utility: ลบ dataset
export function deleteDataset(dataset: string): boolean {
  const normalized = dataset.trim();
  if (!normalized) return false;
  
  store.delete(normalized);
  invertedIndices.delete(normalized);
  
  const filePath = datasetFiles.get(normalized);
  if (filePath) {
    try {
      unlinkSync(filePath);
      datasetFiles.delete(normalized);
      datasetMtime.delete(normalized);
      return true;
    } catch (error) {
      console.error(`[ragStore] Failed to delete dataset "${normalized}"`, error);
      return false;
    }
  }
  return false;
}

// Utility: ลิสต์ทุก datasets
export function listDatasets(): string[] {
  return Array.from(store.keys());
}

// Utility: ดู stats ของ dataset
export function getDatasetStats(dataset: string): { chunks: number; tokens: number; size: number } | null {
  const chunks = store.get(dataset);
  if (!chunks) return null;
  
  const tokenCount = chunks.reduce((sum, c) => sum + (c.tokens?.length || 0), 0);
  const index = invertedIndices.get(dataset);
  
  return {
    chunks: chunks.length,
    tokens: tokenCount,
    size: index?.size || 0,
  };
}
