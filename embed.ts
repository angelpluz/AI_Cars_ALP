const VECTOR_LENGTH = 8;

function normalize(text: string): string {
  return text.normalize('NFKD').toLowerCase();
}

export async function embedText(text: string): Promise<number[]> {
  const normalized = normalize(text);
  const buckets: number[] = new Array<number>(VECTOR_LENGTH).fill(0);
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    const bucketIndex = i % VECTOR_LENGTH;
    const current = buckets[bucketIndex] ?? 0;
    buckets[bucketIndex] = current + code;
  }

  const magnitude = Math.sqrt(buckets.reduce((sum, value) => sum + value * value, 0)) || 1;
  return buckets.map((value) => value / magnitude);
}
