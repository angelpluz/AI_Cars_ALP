export type RemoteProxyInfo = {
  baseUrl: string;
  loginPath: string;
  chatPath: string;
  username: string;
  password: string;
  sessionCookieName: string;
  sessionRefreshMs: number;
  authEnabled: boolean;
};

export type RemoteChatPayload = {
  model: string;
  message: string;
  temperature: number;
  messages?: Array<{ role: string; content: string }>;
};

export type RemoteChatResult = {
  answer: string;
  model?: string;
  proxyBase: string;
};

type RemoteMessage = {
  role?: string;
  content?: string;
};

type RemoteChatResponse = {
  ok?: boolean;
  model?: string;
  answer?: string;
  response?: string;
  error?: string;
  message?: RemoteMessage;
  messages?: RemoteMessage[];
};

type RemoteSessionState = {
  cookie: string | null;
  lastLoginMs: number;
};

type OpenAIResponsesContent = {
  type?: string;
  text?: string;
};

type OpenAIResponsesOutputItem = {
  type?: string;
  content?: OpenAIResponsesContent[];
};

type OpenAIResponsesResponse = {
  id?: string;
  model?: string;
  output_text?: string;
  output?: OpenAIResponsesOutputItem[];
  error?: {
    message?: string;
  };
};

type HeadersInitCompat = Headers | Array<[string, string]> | Record<string, string>;
type RequestInitCompat = RequestInit & { headers?: HeadersInitCompat };

const OPENAI_API_KEY = Bun.env.OPENAI_API_KEY?.trim() ?? '';
const OPENAI_BASE_URL = normalizeBaseUrl(Bun.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1');
const useOpenAIDirect = OPENAI_API_KEY.length > 0;

const REMOTE_BASE_URL = normalizeBaseUrl(Bun.env.REMOTE_BASE_URL ?? 'http://angelpluzalp.ddns.net:3001');
const REMOTE_LOGIN_PATH = Bun.env.REMOTE_LOGIN_PATH ?? '/login';
const REMOTE_CHAT_PATH = Bun.env.REMOTE_CHAT_PATH ?? '/api/chat';
const REMOTE_USERNAME = Bun.env.REMOTE_USERNAME ?? 'toon';
const REMOTE_PASSWORD = Bun.env.REMOTE_PASSWORD ?? '1234';
const REMOTE_SESSION_COOKIE_NAME = Bun.env.REMOTE_SESSION_COOKIE_NAME ?? 'connect.sid';
const parsedRefresh = Number.parseInt(Bun.env.REMOTE_SESSION_REFRESH_MS ?? '', 10);
const REMOTE_SESSION_REFRESH_MS =
  Number.isFinite(parsedRefresh) && parsedRefresh > 0 ? parsedRefresh : 20 * 60 * 1000;
const shouldAuthenticateRemote = !useOpenAIDirect && REMOTE_USERNAME.length > 0 && REMOTE_PASSWORD.length > 0;

const sessionStore = new Map<string, RemoteSessionState>();

function normalizeBaseUrl(base: string): string {
  const trimmed = base.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/$/, '').replace(/\/$/, '');
}

function getSessionState(base: string): RemoteSessionState {
  const normalized = normalizeBaseUrl(base);
  let state = sessionStore.get(normalized);
  if (!state) {
    state = { cookie: null, lastLoginMs: 0 };
    sessionStore.set(normalized, state);
  }
  return state;
}

function getSetCookieValues(headers: Headers): string[] {
  const collected: string[] = [];
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[]; raw?: () => Record<string, string[]> };
  if (typeof anyHeaders.getSetCookie === 'function') {
    collected.push(...anyHeaders.getSetCookie());
  } else if (typeof anyHeaders.raw === 'function') {
    const raw = anyHeaders.raw();
    if (raw['set-cookie']) {
      collected.push(...raw['set-cookie']);
    }
  } else {
    const value = headers.get('set-cookie');
    if (value) {
      collected.push(...value.split(/,(?=[^;]+=[^;]+)/));
    }
  }
  return collected.map((cookie) => cookie.trim()).filter(Boolean);
}

async function performRemoteLogin(base: string): Promise<void> {
  if (!shouldAuthenticateRemote) {
    const state = getSessionState(base);
    state.cookie = null;
    state.lastLoginMs = Date.now();
    return;
  }

  const normalized = normalizeBaseUrl(base);
  const credentials = new URLSearchParams({ username: REMOTE_USERNAME, password: REMOTE_PASSWORD });
  const response = await fetch(`${normalized}${REMOTE_LOGIN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: credentials.toString(),
    redirect: 'manual',
  });

  if (![200, 302].includes(response.status)) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Remote login failed (${response.status}): ${errorText}`);
  }

  const cookies = getSetCookieValues(response.headers);
  if (!cookies.length) {
    throw new Error('Remote login did not return any Set-Cookie headers.');
  }

  const cookiePairs = cookies
    .map((cookie) => cookie.split(';', 1)[0]?.trim())
    .filter(Boolean) as string[];

  const priorityCookie = cookiePairs.find((cookie) => cookie.startsWith(`${REMOTE_SESSION_COOKIE_NAME}=`));
  const ordered = priorityCookie
    ? [priorityCookie, ...cookiePairs.filter((cookie) => cookie !== priorityCookie)]
    : cookiePairs;

  const state = getSessionState(base);
  state.cookie = ordered.join('; ');
  state.lastLoginMs = Date.now();
}

async function ensureRemoteSession(base: string, force = false): Promise<void> {
  if (!shouldAuthenticateRemote) {
    return;
  }
  const state = getSessionState(base);
  const needsRefresh =
    !state.cookie ||
    (REMOTE_SESSION_REFRESH_MS > 0 && Date.now() - state.lastLoginMs > REMOTE_SESSION_REFRESH_MS);
  if (!needsRefresh && !force) {
    return;
  }
  await performRemoteLogin(base);
}

async function fetchRemote(base: string, path: string, init: RequestInitCompat = {}, attempt = 0): Promise<Response> {
  if (shouldAuthenticateRemote) {
    await ensureRemoteSession(base, attempt > 0);
  }

  const headers = new Headers(init.headers as HeadersInitCompat | undefined);
  const state = getSessionState(base);
  if (shouldAuthenticateRemote && state.cookie) {
    headers.set('Cookie', state.cookie);
  }

  const normalized = normalizeBaseUrl(base);
  const response = await fetch(`${normalized}${path}`, {
    ...init,
    headers,
    redirect: 'manual',
  });

  const unauthorized =
    response.status === 401 ||
    response.status === 440 ||
    response.status === 419 ||
    (response.status === 302 && response.headers.get('location')?.includes(REMOTE_LOGIN_PATH));

  const looksLikeLoginPage =
    response.status === 200 && response.headers.get('content-type')?.includes('text/html');

  if (shouldAuthenticateRemote && (unauthorized || looksLikeLoginPage) && attempt < 2) {
    const session = getSessionState(base);
    session.cookie = null;
    session.lastLoginMs = 0;
    return fetchRemote(base, path, init, attempt + 1);
  }

  return response;
}

function normalizeRequestedModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('openai/')) {
    return trimmed.slice('openai/'.length);
  }
  return trimmed;
}

function extractOpenAIResponseText(data: OpenAIResponsesResponse): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) {
    return '';
  }

  const parts: string[] = [];
  for (const item of data.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }
    for (const entry of item.content) {
      if (typeof entry?.text === 'string' && entry.text.trim()) {
        parts.push(entry.text.trim());
      }
    }
  }

  return parts.join('\n').trim();
}

async function sendOpenAIChat(payload: RemoteChatPayload): Promise<RemoteChatResult> {
  const model = normalizeRequestedModel(payload.model);
  if (!model) {
    throw new Error('Model is required for OpenAI direct mode.');
  }

  // สร้าง messages array สำหรับ conversation history
  const messages: Array<{ role: string; content: string }> = [];
  
  // System prompt
  messages.push({
    role: 'system',
    content: 'คุณเป็นผู้ช่วยลูกค้าของโตโยต้า ธนบุรี ให้ตอบคำถามอย่างสุภาพ กระชับ และเป็นประโยชน์ ใช้ภาษาไทยที่เข้าใจง่าย',
  });
  
  // เพิ่ม history ถ้ามี
  if (payload.messages && payload.messages.length > 0) {
    // เอาเฉพาะ 10 ข้อความล่าสุดเพื่อไม่ให้ยาวเกิน
    const recentMessages = payload.messages.slice(-10);
    messages.push(...recentMessages);
  }
  
  // เพิ่มข้อความปัจจุบัน
  messages.push({ role: 'user', content: payload.message });

  const bodyPayload: Record<string, unknown> = {
    model,
    messages,
  };

  if (Number.isFinite(payload.temperature)) {
    bodyPayload.temperature = payload.temperature;
  }

  const doRequest = async (requestPayload: Record<string, unknown>): Promise<Response> =>
    fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestPayload),
    });

  let response = await doRequest(bodyPayload);
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const canRetryWithoutTemperature =
      response.status === 400 &&
      Object.prototype.hasOwnProperty.call(bodyPayload, 'temperature') &&
      /temperature/i.test(errorText) &&
      /unsupported|not supported/i.test(errorText);

    if (canRetryWithoutTemperature) {
      const retryPayload = { ...bodyPayload };
      delete retryPayload.temperature;
      response = await doRequest(retryPayload);
      if (!response.ok) {
        const retryErrorText = await response.text().catch(() => '');
        throw new Error(`OpenAI responded ${response.status}: ${retryErrorText}`);
      }
    } else {
      throw new Error(`OpenAI responded ${response.status}: ${errorText}`);
    }
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
    model?: string;
  };
  
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    const message = data.error?.message ?? 'OpenAI returned empty output.';
    throw new Error(message);
  }

  return {
    answer,
    model: data.model ?? model,
    proxyBase: OPENAI_BASE_URL,
  };
}

export async function sendRemoteChat(
  payload: RemoteChatPayload,
  baseOverride?: string
): Promise<RemoteChatResult> {
  if (useOpenAIDirect) {
    return sendOpenAIChat(payload);
  }

  const targetBase = normalizeBaseUrl(baseOverride && baseOverride.length ? baseOverride : REMOTE_BASE_URL);

  const bodyPayload: Record<string, unknown> = {
    model: payload.model,
    temperature: payload.temperature,
    message: payload.message,
    messages: [{ role: 'user', content: payload.message }],
    stream: false,
  };

  const response = await fetchRemote(targetBase, REMOTE_CHAT_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Remote proxy responded ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as RemoteChatResponse;

  const answerCandidates: Array<string | undefined> = [
    data?.answer,
    data?.response,
    data?.message?.content,
  ];

  if (Array.isArray(data?.messages)) {
    const merged = data.messages
      .map((item) => (typeof item?.content === 'string' ? item.content.trim() : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    answerCandidates.push(merged || undefined);
  }

  const answer = answerCandidates.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
  if (!answer) {
    throw new Error(data?.error || 'Remote proxy returned an empty payload.');
  }

  if (data && typeof data.ok === 'boolean' && !data.ok) {
    throw new Error(data.error || 'Remote proxy marked the response as unsuccessful.');
  }

  return {
    answer,
    model: data.model,
    proxyBase: targetBase,
  };
}

export const remoteProxyInfo: RemoteProxyInfo = {
  baseUrl: useOpenAIDirect ? OPENAI_BASE_URL : REMOTE_BASE_URL,
  loginPath: REMOTE_LOGIN_PATH,
  chatPath: REMOTE_CHAT_PATH,
  username: REMOTE_USERNAME,
  password: REMOTE_PASSWORD,
  sessionCookieName: REMOTE_SESSION_COOKIE_NAME,
  sessionRefreshMs: REMOTE_SESSION_REFRESH_MS,
  authEnabled: shouldAuthenticateRemote,
};

export function normalizeProxyBase(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return normalizeBaseUrl(trimmed);
}
