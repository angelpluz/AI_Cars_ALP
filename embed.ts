export const VECTOR_LENGTH = 1536;

const OPENAI_API_KEY = Bun.env.OPENAI_API_KEY?.trim() ?? '';
const OPENAI_BASE_URL = Bun.env.OPENAI_BASE_URL?.trim() ?? 'https://api.openai.com/v1';

// ใช้ text-embedding-3-small เพราะเร็วและถูก แต่ได้ผลดี
const EMBEDDING_MODEL = Bun.env.EMBEDDING_MODEL?.trim() ?? 'text-embedding-3-small';

// Cache สำหรับลดการเรียก API ซ้ำ
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 10000;

function getCacheKey(text: string): string {
  // ใช้ hash ง่ายๆ สำหรับ cache key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${hash}-${text.slice(0, 50)}`;
}

export async function embedText(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    return new Array(VECTOR_LENGTH).fill(0);
  }

  const normalized = text.trim();
  const cacheKey = getCacheKey(normalized);
  
  // Check cache
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: normalized,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embeddings API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    };

    const embedding = data.data[0]?.embedding;
    
    if (!embedding || embedding.length !== VECTOR_LENGTH) {
      throw new Error(`Invalid embedding received. Expected ${VECTOR_LENGTH} dimensions, got ${embedding?.length}`);
    }

    // Store in cache (LRU-style: delete oldest if full)
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey) {
        embeddingCache.delete(firstKey);
      }
    }
    embeddingCache.set(cacheKey, embedding);

    return embedding;
  } catch (error) {
    console.error('[embed] Failed to get embedding:', error);
    throw error;
  }
}

// Batch embedding สำหรับประสิทธิภาพสูงขึ้น
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) {
    return [];
  }

  // Filter out empty texts
  const validTexts = texts.map(t => t?.trim() || '');
  
  // Check cache first
  const results: (number[] | null)[] = new Array(validTexts.length).fill(null);
  const toFetch: { index: number; text: string }[] = [];

  for (let i = 0; i < validTexts.length; i++) {
    const text = validTexts[i];
    if (!text) {
      results[i] = new Array(VECTOR_LENGTH).fill(0);
      continue;
    }
    const cacheKey = getCacheKey(text);
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      results[i] = cached;
    } else {
      toFetch.push({ index: i, text });
    }
  }

  if (!toFetch.length) {
    return results as number[][];
  }

  // Fetch แบบ batch (OpenAI รองรับสูงสุด 2048 items ต่อ request)
  const BATCH_SIZE = 100;
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    
    try {
      const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: batch.map(b => b.text),
          encoding_format: 'float',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI Embeddings batch API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        data: Array<{ index: number; embedding: number[] }>;
        model: string;
        usage: { prompt_tokens: number; total_tokens: number };
      };

      // Map results back
      for (const item of data.data) {
        const batchItem = batch[item.index];
        if (!batchItem) continue;
        const originalIndex = batchItem.index;
        const embedding = item.embedding;
        results[originalIndex] = embedding;
        
        // Cache it
        const validText = validTexts[originalIndex];
        if (validText) {
          const cacheKey = getCacheKey(validText);
          if (embeddingCache.size >= MAX_CACHE_SIZE) {
            const firstKey = embeddingCache.keys().next().value;
            if (firstKey) {
              embeddingCache.delete(firstKey);
            }
          }
          embeddingCache.set(cacheKey, embedding);
        }
      }
    } catch (error) {
      console.error('[embed] Batch embedding failed:', error);
      throw error;
    }
  }

  return results as number[][];
}

// ฟังก์ชันเดิม computeEmbedding เก็บไว้สำหรับ backward compatibility
export function computeEmbedding(input: string): number[] {
  console.warn('[embed] computeEmbedding is deprecated. Use embedText() for OpenAI embeddings.');
  return new Array(VECTOR_LENGTH).fill(0);
}
