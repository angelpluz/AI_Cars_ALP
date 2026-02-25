import { sendRemoteChat } from './proxyClient';

export type RawRecord = {
  url?: string;
  title?: string;
  description?: string;
  keywords?: unknown;
  content_text?: unknown;
  content_markdown?: unknown;
  word_count?: unknown;
  char_count?: unknown;
  token_count?: unknown;
  images?: unknown;
  [key: string]: unknown;
};

export type CleanSummary = {
  removedCookieParagraphs: number;
  removedEmptyDataRows: number;
  dedupedParagraphs: number;
  droppedKeywords: number;
};

export type LlmReview = {
  model: string;
  reviewed_at: string;
  raw_response: string;
  issues?: string[];
  proposed_content_text?: string;
  proposed_content_markdown?: string;
  notes?: string[];
  summary?: string;
};

export type CleanedRecord = RawRecord & {
  title?: string;
  description?: string;
  keywords?: string[];
  content_text?: string;
  content_markdown?: string;
  clean_text?: string;
  clean_markdown?: string;
  word_count?: number;
  char_count?: number;
  token_count?: number;
  cleaned_at: string;
  cleaning_summary: CleanSummary;
  llm_review?: LlmReview;
  llm_summary?: string;
};

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\r\n?/g, '\n'],
  [/\u00A0/g, ' '],
  [/\u200B/g, ''],
  [/\u200C/g, ''],
  [/\u200D/g, ''],
  [/\u2060/g, ''],
  [/\uFEFF/g, ''],
  [/\uFFFD/g, ''],
];

export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  let output = input;
  for (const [pattern, replacement] of REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }
  output = output.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  output = output.replace(/[ \t]+\n/g, '\n');
  output = output.replace(/\n{3,}/g, '\n\n');
  return output.trim();
}

function normalizeWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function flattenText(text: string): string {
  if (!text.trim()) {
    return '';
  }
  return text.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function cleanContentText(raw: unknown): {
  cleaned: string;
  removedCookieParagraphs: number;
  dedupedParagraphs: number;
} {
  const sanitized = sanitizeString(raw);
  if (!sanitized) {
    return { cleaned: '', removedCookieParagraphs: 0, dedupedParagraphs: 0 };
  }

  const paragraphs = sanitized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const kept: string[] = [];
  const seen = new Set<string>();
  let removedCookieParagraphs = 0;
  let dedupedParagraphs = 0;

  for (const paragraph of paragraphs) {
    if (COOKIE_PATTERNS.length && COOKIE_PATTERNS.some((pattern) => pattern.test(paragraph))) {
      removedCookieParagraphs += 1;
      continue;
    }
    if (/empty data/i.test(paragraph)) {
      removedCookieParagraphs += 1;
      continue;
    }
    const key = paragraph.toLowerCase();
    if (seen.has(key)) {
      dedupedParagraphs += 1;
      continue;
    }
    seen.add(key);
    kept.push(paragraph);
  }

  if (!kept.length) {
    return {
      cleaned: normalizeWhitespace(sanitized),
      removedCookieParagraphs,
      dedupedParagraphs,
    };
  }

  return {
    cleaned: normalizeWhitespace(kept.join('\n\n')),
    removedCookieParagraphs,
    dedupedParagraphs,
  };
}

function cleanMarkdown(raw: unknown): { cleaned: string; removedEmptyDataRows: number } {
  const sanitized = sanitizeString(raw);
  if (!sanitized) {
    return { cleaned: '', removedEmptyDataRows: 0 };
  }
  const lines = sanitized.split('\n');
  let removedEmptyDataRows = 0;
  const filtered = lines.filter((line) => {
    if (!line.trim()) {
      return true;
    }
    if (COOKIE_PATTERNS.length && COOKIE_PATTERNS.some((pattern) => pattern.test(line))) {
      removedEmptyDataRows += 1;
      return false;
    }
    if (/\|[^|]*empty data[^|]*\|/i.test(line)) {
      removedEmptyDataRows += 1;
      return false;
    }
    return true;
  });

  const compacted = filtered.join('\n');
  if (!compacted.trim()) {
    return {
      cleaned: normalizeWhitespace(sanitized),
      removedEmptyDataRows,
    };
  }

  return {
    cleaned: normalizeWhitespace(compacted),
    removedEmptyDataRows,
  };
}

function cleanKeywords(raw: unknown): { cleaned?: string[]; dropped: number } {
  if (!Array.isArray(raw)) {
    return { dropped: 0 };
  }
  const cleaned: string[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const entry of raw) {
    const sanitized = sanitizeString(entry);
    if (!sanitized) {
      dropped += 1;
      continue;
    }
    const key = sanitized.toLowerCase();
    if (seen.has(key)) {
      dropped += 1;
      continue;
    }
    seen.add(key);
    cleaned.push(sanitized);
  }
  return { cleaned: cleaned.length ? cleaned : undefined, dropped };
}

function countWords(text: string): number {
  if (!text.trim()) {
    return 0;
  }
  return text.trim().split(/\s+/u).length;
}

function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  const charEstimate = Math.round(text.length / 4);
  const wordEstimate = countWords(text);
  return Math.max(charEstimate, Math.round(wordEstimate * 1.3));
}

function updateComputedCounts(record: CleanedRecord): void {
  const text = record.clean_text ?? record.content_text ?? '';
  record.char_count = text.length;
  record.word_count = countWords(text);
  record.token_count = estimateTokens(text);
}

export function cleanRecord(record: RawRecord): CleanedRecord {
  const { cleaned: cleanedText, removedCookieParagraphs, dedupedParagraphs } = cleanContentText(record.content_text);
  const { cleaned: cleanedMarkdown, removedEmptyDataRows } = cleanMarkdown(record.content_markdown);
  const keywordResult = cleanKeywords(record.keywords);

  const normalizedText = cleanedText ? flattenText(cleanedText) : '';
  const normalizedMarkdown = cleanedMarkdown ? flattenText(cleanedMarkdown) : '';
  const cleanedRecord: CleanedRecord = {
    ...record,
    title: sanitizeString(record.title),
    description: sanitizeString(record.description),
    keywords: keywordResult.cleaned,
    content_text: normalizedText || undefined,
    content_markdown: normalizedMarkdown || undefined,
    clean_text: normalizedText || undefined,
    clean_markdown: normalizedMarkdown || undefined,
    word_count: 0,
    char_count: 0,
    token_count: 0,
    cleaned_at: new Date().toISOString(),
    cleaning_summary: {
      removedCookieParagraphs,
      removedEmptyDataRows,
      dedupedParagraphs,
      droppedKeywords: keywordResult.dropped,
    },
  };
  updateComputedCounts(cleanedRecord);
  return cleanedRecord;
}

export function aggregateSummaries(records: CleanedRecord | CleanedRecord[]): CleanSummary {
  const list = Array.isArray(records) ? records : [records];
  return list.reduce(
    (acc, record) => {
      acc.removedCookieParagraphs += record.cleaning_summary.removedCookieParagraphs;
      acc.removedEmptyDataRows += record.cleaning_summary.removedEmptyDataRows;
      acc.dedupedParagraphs += record.cleaning_summary.dedupedParagraphs;
      acc.droppedKeywords += record.cleaning_summary.droppedKeywords;
      return acc;
    },
    { removedCookieParagraphs: 0, removedEmptyDataRows: 0, dedupedParagraphs: 0, droppedKeywords: 0 },
  );
}

function deepClone(records: CleanedRecord | CleanedRecord[]): CleanedRecord | CleanedRecord[] {
  return JSON.parse(JSON.stringify(records)) as CleanedRecord | CleanedRecord[];
}

export type CleanJsonOptions = {
  review?: boolean;
  model?: string;
};

export type CleanJsonResult = {
  cleaned: CleanedRecord | CleanedRecord[];
  reviewed?: CleanedRecord | CleanedRecord[];
  summary: CleanSummary;
  recordCount: number;
  modelUsed?: string;
};

export async function cleanJsonPayload(
  payload: RawRecord | RawRecord[],
  options: CleanJsonOptions = {},
): Promise<CleanJsonResult> {
  const cleaned = Array.isArray(payload) ? payload.map((entry) => cleanRecord(entry)) : cleanRecord(payload);

  let reviewed: CleanedRecord | CleanedRecord[] | undefined;
  let modelUsed: string | undefined;
  if (options.review) {
    const model = options.model?.trim() || Bun.env.REVIEW_MODEL?.trim() || Bun.env.LARGE_MODEL?.trim() || 'gemma3:27b';
    modelUsed = model;

    const clone = deepClone(cleaned);
    if (Array.isArray(clone)) {
      for (const record of clone) {
        await attachReview(record, model);
      }
    } else {
      await attachReview(clone, model);
    }
    reviewed = clone;
  }

  return {
    cleaned,
    reviewed,
    summary: aggregateSummaries(cleaned),
    recordCount: Array.isArray(cleaned) ? cleaned.length : 1,
    modelUsed,
  };
}

export async function attachReview(record: CleanedRecord, model: string): Promise<void> {
  const prompt = buildReviewPrompt(record);
  try {
    const response = await sendRemoteChat({
      model,
      message: prompt,
      temperature: 0,
    });

    const raw = response.answer.trim();
    const normalized = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      parsed = null;
    }

    const review: LlmReview = {
      model: response.model ?? model,
      reviewed_at: new Date().toISOString(),
      raw_response: raw,
    };

    if (parsed && typeof parsed === 'object') {
      const maybeObj = parsed as Record<string, unknown>;
      const issuesRaw = maybeObj.issues;
      if (Array.isArray(issuesRaw) && issuesRaw.every((entry) => typeof entry === 'string')) {
        review.issues = issuesRaw as string[];
      }
      const summaryRaw = maybeObj.summary;
      if (typeof summaryRaw === 'string' && summaryRaw.trim()) {
        const sanitizedSummary = sanitizeString(summaryRaw);
        if (sanitizedSummary) {
          review.summary = sanitizedSummary;
          record.llm_summary = sanitizedSummary;
        }
      }
      const proposedText = maybeObj.proposedContentText;
      if (typeof proposedText === 'string' && proposedText.trim()) {
        const sanitizedText = sanitizeString(proposedText);
        if (sanitizedText) {
          const flattenedText = flattenText(sanitizedText);
          review.proposed_content_text = sanitizedText;
          record.content_text = sanitizedText;
          record.clean_text = flattenedText;
        }
      }
      const proposedMarkdown = maybeObj.proposedContentMarkdown;
      if (typeof proposedMarkdown === 'string' && proposedMarkdown.trim()) {
        const sanitizedMarkdown = sanitizeString(proposedMarkdown);
        if (sanitizedMarkdown) {
          const flattenedMarkdown = flattenText(sanitizedMarkdown);
          review.proposed_content_markdown = sanitizedMarkdown;
          record.content_markdown = sanitizedMarkdown;
          record.clean_markdown = flattenedMarkdown || undefined;
        }
      }
      const notesRaw = maybeObj.notes;
      if (Array.isArray(notesRaw) && notesRaw.every((entry) => typeof entry === 'string')) {
        review.notes = notesRaw as string[];
      }
    }

    record.llm_review = review;
    if (review.proposed_content_text || review.proposed_content_markdown) {
      updateComputedCounts(record);
    }
  } catch (error) {
    record.llm_review = {
      model,
      reviewed_at: new Date().toISOString(),
      raw_response: `LLM review failed: ${String(error)}`,
    };
  }
}
export function buildReviewPrompt(record: CleanedRecord): string {

  const header = [
    'You are a meticulous editor preparing content for a RAG knowledge base.',
    'Follow these steps:',
    '1. Ensure no web artefacts remain (cookie notices, duplicate headers, stray markup, etc.).',
    '2. Verify the title/description align with the body content.',
    '3. Suggest concise edits only where needed while preserving meaning.',
    '4. Produce a short Thai summary of the essential facts.',
    '5. Do not invent or add information that is not present.',
  ].join('\n');

  const meta = [
    `URL: ${record.url ?? '(none)'}`,
    `Title: ${record.title ?? '(none)'}`,
    `Description: ${record.description ?? '(none)'}`,
    `Keywords: ${(record.keywords && record.keywords.length) ? record.keywords.join(', ') : '(none)'}`,
  ].join('\n');

  const contentText = 'CONTENT_TEXT:\n' + (record.content_text ?? '(none)');
  const contentMarkdown = 'CONTENT_MARKDOWN:\n' + (record.content_markdown ?? '(none)');

  const instructions = [
    'Return JSON using exactly these keys:',
    '{',
    '  "issues": ["<describe_issue_or_empty_string>"]',
    '  "summary": "<thai_summary_or_empty_string>"',
    '  "proposedContentText": "<revised_plain_text_or_empty_string>"',
    '  "proposedContentMarkdown": "<revised_markdown_or_empty_string>"',
    '  "notes": ["<additional_notes_or_empty_string>"]',
    '}',
  ].join('\n');

  return [header, meta, contentText, contentMarkdown, instructions, 'Do not add explanations outside the JSON payload.'].join('\n\n');
}
const STRIP_COOKIE_NOTICES =
  (Bun.env.STRIP_COOKIE_NOTICES ?? 'false').toLowerCase() === 'true';

const COOKIE_PATTERNS = STRIP_COOKIE_NOTICES
  ? [/คุกกี้ประเภทนี้/iu, /cookie/iu, /เปิดใช้งานตลอดเวลา/iu]
  : [];
