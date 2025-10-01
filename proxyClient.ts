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
};

export type RemoteChatResult = {
  answer: string;
  model?: string;
  proxyBase: string;
};

type RemoteChatResponse = {
  ok?: boolean;
  model?: string;
  answer?: string;
  response?: string;
  error?: string;
};

type RemoteSessionState = {
  cookie: string | null;
  lastLoginMs: number;
};

type HeadersInitCompat = Headers | Array<[string, string]> | Record<string, string>;
type RequestInitCompat = RequestInit & { headers?: HeadersInitCompat };

const REMOTE_BASE_URL = normalizeBaseUrl(Bun.env.REMOTE_BASE_URL ?? 'http://angelpluz.ddns.net:3001');
const REMOTE_LOGIN_PATH = Bun.env.REMOTE_LOGIN_PATH ?? '/login';
const REMOTE_CHAT_PATH = Bun.env.REMOTE_CHAT_PATH ?? '/chat';
const REMOTE_USERNAME = Bun.env.REMOTE_USERNAME ?? 'toon';
const REMOTE_PASSWORD = Bun.env.REMOTE_PASSWORD ?? '1234';
const REMOTE_SESSION_COOKIE_NAME = Bun.env.REMOTE_SESSION_COOKIE_NAME ?? 'connect.sid';
const parsedRefresh = Number.parseInt(Bun.env.REMOTE_SESSION_REFRESH_MS ?? '', 10);
const REMOTE_SESSION_REFRESH_MS =
  Number.isFinite(parsedRefresh) && parsedRefresh > 0 ? parsedRefresh : 20 * 60 * 1000;
const shouldAuthenticateRemote = REMOTE_USERNAME.length > 0 && REMOTE_PASSWORD.length > 0;

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

export async function sendRemoteChat(
  payload: RemoteChatPayload,
  baseOverride?: string
): Promise<RemoteChatResult> {
  const targetBase = normalizeBaseUrl(baseOverride && baseOverride.length ? baseOverride : REMOTE_BASE_URL);

  const response = await fetchRemote(targetBase, REMOTE_CHAT_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Remote proxy responded ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as RemoteChatResponse;
  if (!data?.ok) {
    throw new Error(data?.error || 'Remote proxy returned an unsuccessful response.');
  }

  const answer = data.answer ?? data.response ?? '';
  if (!answer) {
    throw new Error('Remote proxy returned an empty payload.');
  }

  return {
    answer,
    model: data.model,
    proxyBase: targetBase,
  };
}

export const remoteProxyInfo: RemoteProxyInfo = {
  baseUrl: REMOTE_BASE_URL,
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
