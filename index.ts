import { Hono } from 'hono';
import type { Context } from 'hono';
import { serveStatic } from 'hono/bun';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createMessage, ensureHistory, pushTrim } from './chatHistory';
import { fallbackResponse } from './fallbackResponses';
import { renderHomePage } from './uiTemplate';
import { renderLoginPage } from './loginTemplate';
import { renderRagAdminPage } from './ragAdminTemplate';
import { ingestFromUrl, ingestRaw, retrieve, buildAugmentedPrompt, fetchUrlContent } from './rag';
import type { RetrievedChunk } from './ragStore';
import { cleanJsonPayload, type RawRecord } from './datasetCleaner';
import {
  remoteProxyInfo,
  sendRemoteChat,
  type RemoteChatPayload,
  normalizeProxyBase,
} from './proxyClient';

type QueryRequest = {
  query?: string;
  model?: string;
  wantHumanTone?: boolean;
  temperature?: number;
  maxTokens?: number;
  useRAG?: boolean;
  proxyBase?: string;
  ragContext?: {
    datasetName?: string;
    datasetNames?: string[];
    sourceUrl?: string;
    notes?: string;
  };
};

const DEFAULT_MODEL = Bun.env.DEFAULT_MODEL ?? 'llama3.1:8b';
const LARGE_MODEL = Bun.env.LARGE_MODEL ?? 'gemma3:27b';
const SESSION_COOKIE = Bun.env.SESSION_COOKIE ?? 'alp_session';

const parsedHistoryLimit = Number.parseInt(Bun.env.HISTORY_LIMIT ?? '', 10);
const HISTORY_LIMIT = Number.isFinite(parsedHistoryLimit) && parsedHistoryLimit > 0 ? parsedHistoryLimit : 40;

const parsedTemperature = Number(Bun.env.MODEL_TEMPERATURE);
const DEFAULT_TEMPERATURE = Number.isFinite(parsedTemperature) ? parsedTemperature : 0.6;

const parsedMaxTokens = Number(Bun.env.MAX_TOKENS);
const DEFAULT_MAX_TOKENS = Number.isFinite(parsedMaxTokens) ? parsedMaxTokens : 768;

const DEFAULT_RAG_DATASET =
  Bun.env.DEFAULT_RAG_DATASET ?? 'cars-lineup,finance-rules,service-centers,car-troubleshooting,spare-parts,promotions,buying-guide,car-comparison';
const DEFAULT_RAG_DATASETS = DEFAULT_RAG_DATASET
  .split(',')
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);
const RAG_ADMIN_TOKEN = Bun.env.RAG_ADMIN_TOKEN?.trim() || '';

// Users ที่อนุญาตให้ใช้งาน
const ALLOWED_USERS: Record<string, string> = {
  'test001': 'L4vqpxLa_XZF',
  'angelpluz04': 'Rc720699@'
};

// Store auth sessions
const authSessions = new Map<string, { username: string; loginAt: string }>();

// Log chat to file
const LOGS_DIR = join(process.cwd(), 'logs');
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

function logChat(username: string, query: string, response: string, model: string) {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const logFile = join(LOGS_DIR, `chat-${dateStr}.json`);
  
  const logEntry = {
    timestamp: date.toISOString(),
    username,
    query,
    response: response.slice(0, 500), // เก็บแค่ 500 ตัวอักษรแรก
    model,
    ip: 'unknown' // จะอัปเดตเพิ่มถ้าจำเป็น
  };
  
  let logs: any[] = [];
  if (existsSync(logFile)) {
    try {
      const content = readFileSync(logFile, 'utf-8');
      logs = JSON.parse(content);
    } catch {
      logs = [];
    }
  }
  
  logs.push(logEntry);
  
  try {
    writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (error) {
    console.error('[log] Failed to write log:', error);
  }
}

const app = new Hono();

app.use('/public/*', serveStatic({ root: './' }));

function ensureSessionId(c: Context): string {
  let sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    const isSecure = c.req.url.startsWith('https://');
    setCookie(c, SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: isSecure,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return sessionId;
}

// Auth Middleware
async function requireAuth(c: Context, next: () => Promise<void>): Promise<Response | void> {
  const authToken = getCookie(c, 'auth_token');
  
  if (!authToken || !authSessions.has(authToken)) {
    return c.redirect('/login');
  }
  
  // Attach username to context for later use
  c.set('username', authSessions.get(authToken)?.username);
  await next();
}

function getUsername(c: Context): string {
  return c.get('username') || 'unknown';
}

function chooseModel(params: { explicitModel?: string; message?: string; wantHumanTone?: boolean }): string {
  const { explicitModel, message = '', wantHumanTone = true } = params;
  if (explicitModel) {
    return explicitModel;
  }
  const isLong = message.length > 300;
  if (wantHumanTone && isLong) {
    return LARGE_MODEL;
  }
  return DEFAULT_MODEL;
}

// Login page (public)
app.get('/login', (c) => {
  const error = c.req.query('error');
  return c.html(renderLoginPage({ error: error || '' }));
});

app.post('/login', async (c) => {
  const body = await c.req.formData();
  const username = body.get('username')?.toString() || '';
  const password = body.get('password')?.toString() || '';
  
  if (ALLOWED_USERS[username] === password) {
    const authToken = crypto.randomUUID();
    authSessions.set(authToken, {
      username,
      loginAt: new Date().toISOString()
    });
    
    const isSecure = c.req.url.startsWith('https://');
    setCookie(c, 'auth_token', authToken, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: isSecure,
      path: '/',
      maxAge: 60 * 60 * 12, // 12 ชั่วโมง
    });
    
    return c.redirect('/');
  }
  
  return c.redirect('/login?error=1');
});

app.get('/logout', (c) => {
  const authToken = getCookie(c, 'auth_token');
  if (authToken) {
    authSessions.delete(authToken);
    deleteCookie(c, 'auth_token');
  }
  return c.redirect('/login');
});

// Protected routes
app.use('/', requireAuth);
app.use('/api/*', requireAuth);

app.get('/', (c) => {
  const uiConfig = {
    defaultModel: DEFAULT_MODEL,
    largeModel: LARGE_MODEL,
    upstream: remoteProxyInfo.baseUrl,
    authEnabled: remoteProxyInfo.authEnabled,
    defaultDataset: DEFAULT_RAG_DATASET,
  };

  return c.html(
    renderHomePage({
      uiConfig,
      defaultModel: DEFAULT_MODEL,
      largeModel: LARGE_MODEL,
      remoteInfo: {
        baseUrl: remoteProxyInfo.baseUrl,
        authEnabled: remoteProxyInfo.authEnabled,
      },
    }),
  );
});

app.get('/admin/rag', (c) => {
  if (RAG_ADMIN_TOKEN) {
    const queryToken = c.req.query('token') ?? '';
    const headerToken = c.req.header('x-admin-token') ?? '';
    if (queryToken !== RAG_ADMIN_TOKEN && headerToken !== RAG_ADMIN_TOKEN) {
      return c.text('Unauthorized', 401);
    }
  }

  return c.html(
    renderRagAdminPage({
      defaultDataset: DEFAULT_RAG_DATASET,
      remoteInfo: { baseUrl: remoteProxyInfo.baseUrl },
      largeModel: LARGE_MODEL,
    }),
  );
});

app.post('/api/rag/fetch-url', async (c) => {
  let payload: { url?: string; dataset?: string; review?: boolean; model?: string } = {};
  try {
    payload = (await c.req.json()) as typeof payload;
  } catch (error) {
    console.error('RAG fetch-url parse error:', error);
    return c.json({ ok: false, error: 'Invalid JSON payload.' }, 400);
  }

  const sourceUrlRaw = typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!sourceUrlRaw) {
    return c.json({ ok: false, error: 'Source URL is required.' }, 400);
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = new URL(sourceUrlRaw).toString();
  } catch {
    return c.json({ ok: false, error: 'Invalid source URL.' }, 400);
  }

  const datasetName = typeof payload.dataset === 'string' ? payload.dataset.trim() : '';
  const reviewFlag = payload.review === false ? false : true;
  const modelOverride = typeof payload.model === 'string' ? payload.model.trim() : '';

  try {
    const { text, raw, contentType } = await fetchUrlContent(normalizedUrl);

    const titleFromHtml = extractTitleFromHtml(raw);
    const fallbackTitle = titleFromHtml || deriveFallbackTitle(normalizedUrl);
    const description = deriveDescriptionFromText(text);

    const rawRecord: RawRecord = {
      url: normalizedUrl,
      title: fallbackTitle || undefined,
      description: description || undefined,
      content_text: text,
      content_markdown: text,
    };
    if (datasetName) {
      rawRecord.dataset = datasetName;
    }

    const result = await cleanJsonPayload(rawRecord, {
      review: reviewFlag,
      model: modelOverride || undefined,
    });

    const cleanedString = JSON.stringify(result.cleaned, null, 2);
    const reviewedString = result.reviewed ? JSON.stringify(result.reviewed, null, 2) : undefined;

    let filenameCandidate = datasetName || fallbackTitle || '';
    if (!filenameCandidate) {
      try {
        filenameCandidate = new URL(normalizedUrl).hostname;
      } catch {
        filenameCandidate = normalizedUrl;
      }
    }
    const baseName = buildFilenameBase(filenameCandidate);

    return c.json({
      ok: true,
      sourceUrl: normalizedUrl,
      dataset: datasetName || undefined,
      summary: result.summary,
      recordCount: result.recordCount,
      modelUsed: result.modelUsed,
      cleaned: cleanedString,
      cleanedFilename: `${baseName}.clean-only.json`,
      reviewed: reviewedString,
      reviewedFilename: reviewedString ? `${baseName}.reviewed.json` : undefined,
      meta: {
        contentType,
      },
    });
  } catch (error) {
    console.error('RAG fetch-url error:', error);
    return c.json({ ok: false, error: String(error) }, 500);
  }
});

app.post('/api/rag/upsert', async (c) => {
  try {
    const body = await c.req.json<{ datasetName: string; sourceUrl?: string; rawText?: string }>();
    const dataset = (body.datasetName || '').trim();
    if (!dataset) {
      return c.json({ ok: false, error: 'datasetName required' }, 400);
    }

    if (body.rawText && body.rawText.trim()) {
      const raw = body.rawText.trim();
      console.log('[rag] ingest raw', dataset, 'payload length', raw.length);
      const rows = await ingestRaw(dataset, body.sourceUrl, raw);
      console.log('[rag] ingest raw completed', rows.length, 'chunk(s) for', dataset);
      return c.json({ ok: true, ingested: rows.length });
    }

    if (body.sourceUrl && body.sourceUrl.trim()) {
      const trimmedUrl = body.sourceUrl.trim();
      console.log('[rag] ingest url', trimmedUrl, 'dataset', dataset);
      const rows = await ingestFromUrl(dataset, trimmedUrl);
      console.log('[rag] ingest url completed', rows.length, 'chunk(s) for', dataset);
      return c.json({ ok: true, ingested: rows.length });
    }

    return c.json({ ok: false, error: 'Provide rawText or sourceUrl' }, 400);
  } catch (error) {
    console.error('RAG upsert error:', error);
    return c.json({ ok: false, error: String(error) }, 500);
  }
});

app.post('/api/rag/upload-json', async (c) => {
  try {
    const contentType = c.req.header('content-type') ?? '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return c.json({ ok: false, error: 'Expected multipart/form-data.' }, 400);
    }

    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return c.json({ ok: false, error: 'JSON file is required.' }, 400);
    }

    const datasetName = typeof form.get('dataset') === 'string' ? String(form.get('dataset')).trim() : '';
    const reviewFlag = typeof form.get('review') === 'string' ? String(form.get('review')).toLowerCase() === 'true' : true;
    const modelOverride = typeof form.get('model') === 'string' ? String(form.get('model')).trim() : '';

    const rawJson = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson) as unknown;
    } catch (error) {
      return c.json({ ok: false, error: `Invalid JSON: ${String(error)}` }, 400);
    }

    const ensurePayload = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        if (value.every((entry) => entry && typeof entry === 'object')) {
          return value;
        }
        throw new Error('When uploading an array, every entry must be an object.');
      }
      if (value && typeof value === 'object') {
        return value;
      }
      throw new Error('Uploaded JSON must be an object or an array of objects.');
    };

    let cleanedPayload: unknown;
    try {
      cleanedPayload = ensurePayload(parsed);
    } catch (validationError) {
      return c.json({ ok: false, error: String(validationError) }, 400);
    }

    const result = await cleanJsonPayload(cleanedPayload as RawRecord | RawRecord[], {
      review: reviewFlag,
      model: modelOverride || undefined,
    });

    const cleanedString = JSON.stringify(result.cleaned, null, 2);
    const reviewedString = result.reviewed ? JSON.stringify(result.reviewed, null, 2) : undefined;
    const baseName = file.name.replace(/\.json$/i, '') || 'dataset';
    const cleanFilename = datasetName
      ? `${datasetName}.clean-only.json`
      : `${baseName}.clean-only.json`;
    const reviewedFilename = datasetName
      ? `${datasetName}.reviewed.json`
      : `${baseName}.reviewed.json`;

    return c.json({
      ok: true,
      dataset: datasetName || undefined,
      summary: result.summary,
      recordCount: result.recordCount,
      modelUsed: result.modelUsed,
      cleaned: cleanedString,
      cleanedFilename: cleanFilename,
      reviewed: reviewedString,
      reviewedFilename: reviewedString ? reviewedFilename : undefined,
    });
  } catch (error) {
    console.error('RAG JSON upload error:', error);
    return c.json({ ok: false, error: String(error) }, 500);
  }
});


app.post('/api/query', async (c) => {
  let body: QueryRequest = {};
  try {
    body = await c.req.json<QueryRequest>();
  } catch (error) {
    console.error('Invalid JSON payload:', error);
  }

  const query = body.query?.trim();
  if (!query) {
    return c.json({ ok: false, response: 'Please enter a query.' }, 400);
  }

  const sessionId = ensureSessionId(c);
  const history = ensureHistory(sessionId);

  const wantHumanTone = body.wantHumanTone ?? true;
  const temperature =
    typeof body.temperature === 'number' && Number.isFinite(body.temperature) ? body.temperature : DEFAULT_TEMPERATURE;
  const maxTokensRaw =
    typeof body.maxTokens === 'number' && Number.isFinite(body.maxTokens) ? Math.floor(body.maxTokens) : DEFAULT_MAX_TOKENS;
  const maxTokens = Math.min(Math.max(maxTokensRaw, 64), 4096);

  const model = chooseModel({ explicitModel: body.model, message: query, wantHumanTone });
  const proxyBase = normalizeProxyBase(body.proxyBase) ?? remoteProxyInfo.baseUrl;

  const started = Date.now();

  try {
    let toSend = query;
    let citations: Array<{ idx: number; source?: string }> = [];

    // ใช้ทุก datasets ที่มี ถ้าไม่ได้ระบุเฉพาะ
    let datasetNames = normalizeDatasetNames(body.ragContext);
    if (!datasetNames.length || datasetNames.length === 0) {
      datasetNames = [...DEFAULT_RAG_DATASETS];
    }
    console.log('[RAG] Using datasets:', datasetNames);
    if (body.useRAG && datasetNames.length) {
      const retrievalK = chooseRetrievalK(datasetNames);
      const retrieved = await retrieve(datasetNames, query, retrievalK, { useHybrid: true, rerank: true });
      console.log('[RAG] Retrieved', retrieved.length, 'chunks');
      if (retrieved.length) {
        const sourceIndexMap = new Map<string, number>();
        let nextSourceIndex = 1;
        const contexts = retrieved.map((item) => {
          const source = item.sourceUrl?.trim();
          if (source) {
            let idx = sourceIndexMap.get(source);
            if (!idx) {
              idx = nextSourceIndex;
              sourceIndexMap.set(source, idx);
              nextSourceIndex += 1;
            }
            return { text: item.text, sourceUrl: source, dataset: item.dataset, citationIndex: idx };
          }
          return { text: item.text, sourceUrl: undefined, dataset: item.dataset };
        });

        toSend = buildAugmentedPrompt(
          query,
          contexts,
        );
        citations = [...sourceIndexMap.entries()]
          .map(([source, idx]) => ({ idx, source }))
          .sort((a, b) => a.idx - b.idx);
      }
    }

    // เตรียม messages สำหรับ conversation history
    const conversationMessages = history.map(h => ({
      role: h.role,
      content: h.content,
    }));

    const remotePayload: RemoteChatPayload = {
      model,
      message: toSend,
      temperature,
      messages: conversationMessages,
    };

    const result = await sendRemoteChat(remotePayload, proxyBase);

    const answerSegments = [result.answer ?? ''];
    if (citations.some((citation) => citation.source)) {
      const seenSources = new Set<string>();
      const refs = citations
        .filter((citation) => citation.source)
        .filter((citation) => {
          const source = citation.source!.trim();
          if (!source || seenSources.has(source)) {
            return false;
          }
          seenSources.add(source);
          return true;
        })
        .map((citation) => `[${citation.idx}] ${citation.source}`)
        .join('  |  ');
      answerSegments.push(`\n\n-- Sources: ${refs}`);
    }

    const answer = answerSegments.join('');

    pushTrim(history, createMessage('user', query), HISTORY_LIMIT);
    pushTrim(history, createMessage('assistant', answer), HISTORY_LIMIT);

    // Log chat to file
    const username = getUsername(c);
    logChat(username, query, answer, result.model ?? model);

    return c.json({
      ok: true,
      response: answer,
      model: result.model ?? model,
      latencyMs: Date.now() - started,
      wantHumanTone,
      useRAG: body.useRAG ?? true,
      maxTokens,
      proxyBase: result.proxyBase,
    });
  } catch (error) {
    console.error('Remote LLM relay failed:', error);
    
    // Log error case too
    const username = getUsername(c);
    const fallbackMsg = fallbackResponse(query);
    logChat(username, query, fallbackMsg, 'fallback');
    
    return c.json({
      ok: false,
      response: fallbackMsg,
      fallback: true,
      proxyBase,
    });
  }
});

const port = Number.parseInt(Bun.env.PORT ?? '3045', 10);

console.log(`Server is running on http://localhost:${port}`);
console.log(`[config] Remote base  = ${remoteProxyInfo.baseUrl}`);
console.log(`[config] Remote auth  = ${remoteProxyInfo.authEnabled ? 'enabled' : 'disabled'}`);
console.log(`[config] DEFAULT_MODEL= ${DEFAULT_MODEL}`);
console.log(`[config] LARGE_MODEL  = ${LARGE_MODEL}`);

export default {
  port,
  fetch: app.fetch,
};

function normalizeDatasetNames(context: QueryRequest['ragContext']): string[] {
  const names: string[] = [];
  const arrayInput = Array.isArray(context?.datasetNames) ? context?.datasetNames : [];
  names.push(...arrayInput);
  if (context?.datasetName) {
    names.push(context.datasetName);
  }
  const splitComma = names
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (splitComma.length) {
    return [...new Set(splitComma)];
  }
  return [...DEFAULT_RAG_DATASETS];
}

function chooseRetrievalK(datasets: string[]): number {
  const lower = datasets.map((name) => name.toLowerCase());
  if (lower.includes('service-centers')) {
    return 25;
  }
  if (lower.includes('cars-lineup')) {
    return 15;
  }
  return 5;
}

function extractTitleFromHtml(raw: string): string | undefined {
  const match = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return undefined;
  }
  const title = collapseWhitespace(match[1] ?? '');
  return title || undefined;
}

function deriveFallbackTitle(url: string): string | undefined {
  try {
    const { hostname, pathname } = new URL(url);
    const parts = [hostname, pathname.replace(/\//g, ' ').trim()].filter(Boolean);
    const combined = parts.join(' - ');
    return combined ? collapseWhitespace(combined) : undefined;
  } catch {
    return undefined;
  }
}

function deriveDescriptionFromText(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return undefined;
  }
  const summary = collapseWhitespace(lines.slice(0, 3).join(' '));
  return summary.length ? summary.slice(0, 280) : undefined;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildFilenameBase(candidate: string): string {
  const slug = slugifyForFilename(candidate);
  if (slug) {
    return slug;
  }
  return `dataset-${Date.now()}`;
}

function slugifyForFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}


