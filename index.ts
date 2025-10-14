import { Hono } from 'hono';
import type { Context } from 'hono';
import { serveStatic } from 'hono/bun';
import { getCookie, setCookie } from 'hono/cookie';

import { createMessage, ensureHistory, pushTrim } from './chatHistory';
import { fallbackResponse } from './fallbackResponses';
import { renderHomePage } from './uiTemplate';
import { renderRagAdminPage } from './ragAdminTemplate';
import { ingestFromUrl, ingestRaw, retrieve, buildAugmentedPrompt } from './rag';
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

const DEFAULT_RAG_DATASET = Bun.env.DEFAULT_RAG_DATASET ?? '';
const RAG_ADMIN_TOKEN = Bun.env.RAG_ADMIN_TOKEN?.trim() || '';

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

    const datasetName = body.ragContext?.datasetName?.trim();
    if (body.useRAG && datasetName) {
      const retrieved = await retrieve(datasetName, query, 5);
      if (retrieved.length) {
        toSend = buildAugmentedPrompt(
          query,
          retrieved.map((item) => ({ text: item.text, sourceUrl: item.sourceUrl }))
        );
        citations = retrieved.map((item, index) => ({ idx: index + 1, source: item.sourceUrl }));
      }
    }

    const remotePayload: RemoteChatPayload = {
      model,
      message: toSend,
      temperature,
    };

    const result = await sendRemoteChat(remotePayload, proxyBase);

    const answerSegments = [result.answer ?? ''];
    if (citations.some((citation) => citation.source)) {
      const refs = citations
        .filter((citation) => citation.source)
        .map((citation) => `[${citation.idx}] ${citation.source}`)
        .join('  |  ');
      answerSegments.push(`\n\n-- Sources: ${refs}`);
    }

    const answer = answerSegments.join('');

    pushTrim(history, createMessage('user', query), HISTORY_LIMIT);
    pushTrim(history, createMessage('assistant', answer), HISTORY_LIMIT);

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
    return c.json({
      ok: false,
      response: fallbackResponse(query),
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



