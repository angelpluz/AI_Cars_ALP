import { Hono } from 'hono';
import type { Context } from 'hono';
import { serveStatic } from 'hono/bun';
import { getCookie, setCookie } from 'hono/cookie';

type ChatRole = 'user' | 'assistant' | 'system';
type ChatMessage = { role: ChatRole; content: string };
type QueryRequest = {
  query?: string;
  model?: string;
  wantHumanTone?: boolean;
  temperature?: number;
  maxTokens?: number;
  useRAG?: boolean;
};

type OllamaChatResponse = {
  message?: { content?: string };
  response?: string;
};

const OLLAMA_URL = Bun.env.OLLAMA_URL ?? 'http://192.168.50.15:11434';
const DEFAULT_MODEL = Bun.env.DEFAULT_MODEL ?? 'llama3.1:8b';
const LARGE_MODEL = Bun.env.LARGE_MODEL ?? 'gemma3:27b';
const SESSION_COOKIE = Bun.env.SESSION_COOKIE ?? 'alp_session';

const parsedHistoryLimit = Number.parseInt(Bun.env.HISTORY_LIMIT ?? '', 10);
const HISTORY_LIMIT = Number.isFinite(parsedHistoryLimit) && parsedHistoryLimit > 0 ? parsedHistoryLimit : 40;

const parsedTemperature = Number(Bun.env.MODEL_TEMPERATURE);
const DEFAULT_TEMPERATURE = Number.isFinite(parsedTemperature) ? parsedTemperature : 0.6;

const parsedMaxTokens = Number(Bun.env.MAX_TOKENS);
const DEFAULT_MAX_TOKENS = Number.isFinite(parsedMaxTokens) ? parsedMaxTokens : 768;

const keywordResponses: Record<string, string> = {
  car: 'I found information about cars. Would you like to know about electric, sports, or family cars?',
  electric: 'Electric cars are environmentally friendly vehicles powered by batteries. Popular models include Tesla, Rivian, and Nissan Leaf.',
  sports: 'Sports cars are high-performance vehicles designed for speed and handling. Examples include Ferrari, Porsche, and Corvette.',
  family: 'Family cars prioritize space, safety, and comfort. Popular choices include Honda Odyssey, Toyota Highlander, and Subaru Outback.',
  price: 'Car prices vary widely based on make, model, and features. What type of car are you interested in?',
  safety: 'Modern cars come with advanced safety features like ABS, airbags, lane assist, and collision detection.',
  fuel: 'Fuel efficiency depends on the car type. Electric cars have zero emissions, hybrids offer great MPG, and traditional cars vary.',
  maintenance: 'Regular maintenance includes oil changes, tire rotations, brake checks, and fluid levels. Electric cars require less maintenance.',
};

const orderedKeywords = ['maintenance', 'safety', 'fuel', 'price', 'electric', 'sports', 'family', 'car'];
const fallbackDefault =
  "I understand you're asking about cars. Try asking about electric, sports, family cars, price, safety, fuel, or maintenance!";

const historyStore = new Map<string, ChatMessage[]>();

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

function ensureHistory(sessionId: string): ChatMessage[] {
  const existing = historyStore.get(sessionId);
  if (existing) {
    return existing;
  }
  const history: ChatMessage[] = [];
  historyStore.set(sessionId, history);
  return history;
}

function pushTrim(history: ChatMessage[], message: ChatMessage): void {
  history.push(message);
  if (history.length > HISTORY_LIMIT) {
    history.splice(0, history.length - HISTORY_LIMIT);
  }
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

function fallbackResponse(query: string): string {
  const lower = query.toLowerCase();
  for (const keyword of orderedKeywords) {
    if (lower.includes(keyword) && keywordResponses[keyword]) {
      return keywordResponses[keyword];
    }
  }
  return fallbackDefault;
}

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Cars Terminal</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .cursor-blink {
          animation: blink 1s infinite;
        }
        .terminal-input:focus {
          outline: none;
        }
        .suggestion-btn {
          transition: all 0.2s ease;
        }
        .suggestion-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        }
      </style>
    </head>
    <body class="bg-black min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-4xl">
        <div class="mb-8 text-center">
          <h1 class="text-4xl font-bold text-green-500 mb-2">AI Cars Terminal</h1>
          <p class="text-green-400 text-sm">Type your query or select a suggestion below</p>
          <p class="text-green-700 text-xs mt-1">
            Default model: ${DEFAULT_MODEL} | Large model: ${LARGE_MODEL} | Upstream: ${OLLAMA_URL}
          </p>
        </div>

        <div class="bg-gray-900 rounded-lg border-2 border-green-500 shadow-2xl overflow-hidden">
          <div class="bg-gray-800 px-4 py-2 flex items-center border-b-2 border-green-500">
            <div class="flex space-x-2">
              <div class="w-3 h-3 rounded-full bg-red-500"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div class="flex-1 text-center text-green-400 text-sm font-mono">AI_Cars_Terminal_v1.0</div>
          </div>

          <div id="output" class="p-4 min-h-[300px] max-h-[400px] overflow-y-auto font-mono text-sm">
            <div class="text-green-400 mb-2">
              <span class="text-green-500">system@ai-cars:~$</span> Welcome to AI Cars Terminal
            </div>
            <div class="text-green-400 mb-4">
              <span class="text-green-500">system@ai-cars:~$</span> How can I assist you today?
            </div>
          </div>

          <div class="border-t-2 border-green-500 p-4 bg-gray-800">
            <form id="chatForm" class="flex items-center space-x-2">
              <span class="text-green-500 font-mono">$</span>
              <input
                type="text"
                id="userInput"
                class="terminal-input flex-1 bg-transparent text-green-400 font-mono border-none placeholder-green-600"
                placeholder="Type your query here..."
                autocomplete="off"
              />
              <button type="submit" class="bg-green-600 hover:bg-green-700 text-black font-bold px-4 py-2 rounded transition duration-200">
                Send
              </button>
            </form>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <button class="suggestion-btn bg-gray-900 hover:bg-gray-800 border-2 border-green-500 text-green-400 font-mono py-3 px-4 rounded-lg" data-query="Tell me about electric cars">
            >> Electric Cars
          </button>
          <button class="suggestion-btn bg-gray-900 hover:bg-gray-800 border-2 border-green-500 text-green-400 font-mono py-3 px-4 rounded-lg" data-query="What are the best sports cars?">
            >> Sports Cars
          </button>
          <button class="suggestion-btn bg-gray-900 hover:bg-gray-800 border-2 border-green-500 text-green-400 font-mono py-3 px-4 rounded-lg" data-query="Show me family cars">
            >> Family Cars
          </button>
          <button class="suggestion-btn bg-gray-900 hover:bg-gray-800 border-2 border-green-500 text-green-400 font-mono py-3 px-4 rounded-lg" data-query="Car maintenance tips">
            >> Maintenance
          </button>
        </div>
      </div>

      <script>
        const output = document.getElementById('output');
        const chatForm = document.getElementById('chatForm');
        const userInput = document.getElementById('userInput');
        const suggestionBtns = document.querySelectorAll('.suggestion-btn');

        function addMessage(message, isUser = false) {
          const messageDiv = document.createElement('div');
          messageDiv.className = isUser ? 'text-blue-400 mb-2' : 'text-green-400 mb-4';
          const prefixClass = isUser ? 'text-blue-500' : 'text-green-500';
          const prefixUser = isUser ? 'user' : 'ai-assistant';
          messageDiv.innerHTML = '<span class="' + prefixClass + '">' + prefixUser + '@ai-cars:~$</span> ' + message;
          output.appendChild(messageDiv);
          output.scrollTop = output.scrollHeight;
          return messageDiv;
        }

        async function askHomeLLM(query) {
          const placeholder = addMessage('... contacting home LLM ...', false);
          try {
            const response = await fetch('/api/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
            });
            if (!response.ok) {
              throw new Error('HTTP ' + response.status);
            }
            const data = await response.json();
            const metaParts = [];
            if (data.model) metaParts.push('model: ' + data.model);
            if (typeof data.latencyMs === 'number') metaParts.push(data.latencyMs + 'ms');
            if (data.fallback) metaParts.push('fallback');
            const meta = metaParts.length ? '<div class="text-xs text-green-600 mt-1">' + metaParts.join(' | ') + '</div>' : '';
            placeholder.innerHTML = '<span class="text-green-500">ai-assistant@ai-cars:~$</span> ' + (data.response || 'No response received.') + meta;
          } catch (error) {
            placeholder.innerHTML = '<span class="text-green-500">ai-assistant@ai-cars:~$</span> Error: Unable to reach home LLM.';
          }
        }

        chatForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const query = userInput.value.trim();
          if (!query) return;

          addMessage(query, true);
          userInput.value = '';
          await askHomeLLM(query);
        });

        suggestionBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const query = btn.getAttribute('data-query');
            if (!query) return;
            userInput.value = query;
            chatForm.dispatchEvent(new Event('submit'));
          });
        });

        userInput.focus();
      </script>
    </body>
    </html>
  `);
});

app.post('/api/query', async (c) => {
  let body: QueryRequest = {};
  try {
    body = await c.req.json<QueryRequest>();
  } catch {
    // Ignore malformed JSON and fall back to validation below.
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

  const payload = {
    model,
    stream: false,
    messages: [...history, { role: 'user' as const, content: query }],
    options: {
      temperature,
      num_predict: maxTokens,
      keep_alive: '30m',
    },
  };

  const started = Date.now();

  try {
    const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => '');
      throw new Error(`Upstream responded ${upstream.status}: ${errorText}`);
    }

    const data = (await upstream.json()) as OllamaChatResponse;
    const answer: string = data?.message?.content ?? data?.response ?? '';
    if (!answer) {
      throw new Error('Upstream returned an empty response payload.');
    }

    pushTrim(history, { role: 'user', content: query });
    pushTrim(history, { role: 'assistant', content: answer });

    return c.json({
      ok: true,
      response: answer,
      model,
      latencyMs: Date.now() - started,
      wantHumanTone,
      useRAG: body.useRAG ?? true,
    });
  } catch (error) {
    console.error('Home LLM relay failed:', error);
    return c.json({
      ok: false,
      response: fallbackResponse(query),
      fallback: true,
    });
  }
});

const port = Number.parseInt(Bun.env.PORT ?? '3045', 10);
console.log(`Server is running on http://localhost:${port}`);
console.log(`[config] OLLAMA_URL    = ${OLLAMA_URL}`);
console.log(`[config] DEFAULT_MODEL = ${DEFAULT_MODEL}`);
console.log(`[config] LARGE_MODEL   = ${LARGE_MODEL}`);

export default {
  port,
  fetch: app.fetch,
};
