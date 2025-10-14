const HOME_TEMPLATE = String.raw`

    <!DOCTYPE html>

    <html lang="en">

    <head>

      <meta charset="UTF-8" />

      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      <title>AI Cars Terminal</title>

      <script src="https://cdn.tailwindcss.com"></script>

      <style>

        :root {

          --bg: #f5f6f8;

          --card-border: #d7dae2;

          --accent: #c8102e;

          --accent-dark: #9f0d24;

          --text: #12151a;

          --text-soft: #717784;

          --panel: rgba(255, 255, 255, 0.9);

          --panel-highlight: rgba(255, 255, 255, 0.65);

          --mono: 'IBM Plex Mono', 'Menlo', 'Consolas', monospace;

        }



        * {

          box-sizing: border-box;

        }



        body.hero {

          min-height: 100vh;

          margin: 0;

          padding: 56px 32px;

          display: flex;

          align-items: stretch;

          justify-content: center;

          background: radial-gradient(circle at top, rgba(207, 10, 45, 0.12) 0%, transparent 45%),

            radial-gradient(circle at bottom, rgba(27, 30, 36, 0.1) 0%, transparent 40%),

            var(--bg);

          color: var(--text);

          font-family: 'Inter', 'Segoe UI', sans-serif;

        }



        .app-shell {

          width: 100%;

          max-width: 1200px;

          display: flex;

          gap: 28px;

        }



        .sidebar {

          width: 280px;

          background: rgba(255, 255, 255, 0.85);

          border: 1px solid rgba(17, 24, 39, 0.08);

          border-radius: 26px;

          padding: 22px;

          box-shadow: 0 24px 50px rgba(17, 23, 33, 0.12);

          display: flex;

          flex-direction: column;

          gap: 24px;

        }



        .sidebar-section {

          display: flex;

          flex-direction: column;

          gap: 14px;

        }



        .sidebar-header {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 12px;

        }



        .sidebar-header h2,

        .sidebar-header h3 {

          margin: 0;

          font-size: 18px;

          letter-spacing: 0.04em;

          text-transform: uppercase;

          color: var(--accent);

        }



        .sidebar-header.small h3 {

          font-size: 14px;

          color: var(--text-soft);

        }



        .icon-btn {

          width: 32px;

          height: 32px;

          border-radius: 12px;

          border: 1px solid rgba(200, 16, 46, 0.25);

          background: rgba(200, 16, 46, 0.08);

          color: var(--accent);

          font-weight: 600;

          cursor: pointer;

          transition: background 0.2s ease, transform 0.2s ease;

        }



        .icon-btn:hover {

          background: rgba(200, 16, 46, 0.18);

          transform: translateY(-1px);

        }



        .session-list,

        .history-list {

          max-height: 220px;

          overflow-y: auto;

          display: flex;

          flex-direction: column;

          gap: 10px;

        }



        .session-item {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 12px;

          padding: 12px 14px;

          border-radius: 16px;

          border: 1px solid rgba(17, 24, 39, 0.08);

          background: rgba(255, 255, 255, 0.9);

          cursor: pointer;

          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;

          font-size: 14px;

        }



        .session-item.active {

          border-color: rgba(200, 16, 46, 0.45);

          box-shadow: 0 10px 24px rgba(17, 24, 39, 0.18);

        }



        .session-item.pinned::after {

          content: 'PIN';

          color: var(--accent);

          font-size: 11px;

          margin-left: 8px;

        }



        .history-entry {

          padding: 10px 12px;

          border-radius: 12px;

          border: 1px solid rgba(17, 24, 39, 0.06);

          background: rgba(255, 255, 255, 0.8);

          font-size: 13px;

          color: var(--text);

          cursor: pointer;

        }



        .history-actions {

          display: flex;

          gap: 10px;

        }



        .ghost-btn {

          flex: 1;

          padding: 10px 0;

          border-radius: 12px;

          border: 1px solid rgba(200, 16, 46, 0.25);

          background: rgba(200, 16, 46, 0.05);

          color: var(--accent);

          font-weight: 500;

          cursor: pointer;

        }



        .ghost-btn:hover {

          background: rgba(200, 16, 46, 0.12);

        }



        .main-panel {

          flex: 1;

          display: flex;

          flex-direction: column;

          gap: 26px;

        }



        .title-block {

          display: flex;

          flex-direction: column;

          gap: 12px;

        }



        .title-block h1 {

          margin: 0;

          font-size: 48px;

          letter-spacing: -0.02em;

          color: var(--accent);

        }



        .title-block p {

          margin: 0;

          font-size: 18px;

          color: var(--text-soft);

          max-width: 780px;

        }



        .stats {

          display: flex;

          flex-wrap: wrap;

          gap: 12px;

          font-size: 12px;

          text-transform: uppercase;

          letter-spacing: 0.16em;

          color: var(--text-soft);

        }



        .stats span {

          background: white;

          border-radius: 999px;

          padding: 8px 14px;

          border: 1px solid rgba(17, 24, 39, 0.08);

        }



        .model-strip {

          display: flex;

          flex-direction: column;

          gap: 12px;

          background: rgba(255, 255, 255, 0.85);

          border-radius: 22px;

          border: 1px solid rgba(17, 24, 39, 0.08);

          padding: 18px 20px;

          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);

        }



        .model-buttons {

          display: flex;

          flex-wrap: wrap;

          gap: 12px;

        }



        .model-btn {

          padding: 10px 16px;

          border-radius: 999px;

          border: 1px solid rgba(200, 16, 46, 0.2);

          background: rgba(200, 16, 46, 0.08);

          color: var(--accent);

          font-weight: 600;

          letter-spacing: 0.02em;

          cursor: pointer;

          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

        }



        .model-btn.active {

          background: linear-gradient(120deg, var(--accent), #ff3b51);

          color: #ffffff;

          border-color: transparent;

          box-shadow: 0 14px 28px rgba(200, 16, 46, 0.35);

        }



        .model-btn:hover {

          transform: translateY(-2px);

        }



        .endpoint-control {

          display: flex;

          flex-wrap: wrap;

          gap: 10px;

          align-items: center;

        }



        .endpoint-control input {

          flex: 1;

          min-width: 220px;

          padding: 12px 14px;

          border-radius: 14px;

          border: 1px solid rgba(17, 24, 39, 0.12);

          background: rgba(255, 255, 255, 0.92);

          font-size: 14px;

        }



        .endpoint-control button {

          padding: 11px 18px;

          border-radius: 14px;

          border: none;

          background: var(--accent);

          color: white;

          font-weight: 600;

          cursor: pointer;

        }



        .model-status {

          font-size: 12px;

          color: var(--text-soft);

          letter-spacing: 0.12em;

          text-transform: uppercase;

        }



        .rag-session-card {

          background: rgba(255, 255, 255, 0.9);

          border-radius: 22px;

          border: 1px solid rgba(17, 24, 39, 0.08);

          padding: 20px 24px;

          display: flex;

          flex-direction: column;

          gap: 18px;

          box-shadow: 0 18px 40px rgba(17, 24, 39, 0.12);

        }



        .rag-session-header {

          display: flex;

          align-items: center;

          justify-content: space-between;

        }



        .rag-session-header h2 {

          margin: 0;

          font-size: 18px;

          letter-spacing: 0.1em;

          text-transform: uppercase;

          color: var(--text-soft);

        }



        .rag-session-badge {

          padding: 6px 12px;

          border-radius: 999px;

          background: rgba(200, 16, 46, 0.12);

          color: var(--accent);

          font-size: 12px;

          font-weight: 600;

        }



        .rag-session-body {

          display: flex;

          flex-direction: column;

          gap: 14px;

        }



        .rag-session-toggle {

          display: flex;

          align-items: center;

          gap: 10px;

          font-size: 13px;

          color: var(--text);

        }



        .rag-session-toggle input {

          width: 18px;

          height: 18px;

        }



        .rag-session-field {

          display: flex;

          flex-direction: column;

          gap: 6px;

          font-size: 13px;

          color: var(--text-soft);

        }



        .rag-session-field input[type='text'] {

          width: 100%;

          padding: 12px 14px;

          border-radius: 14px;

          border: 1px solid rgba(17, 24, 39, 0.12);

          background: rgba(255, 255, 255, 0.92);

          font-size: 14px;

          color: var(--text);

        }



        .rag-status {

          font-size: 12px;

          color: var(--text-soft);

          letter-spacing: 0.08em;

          text-transform: uppercase;

        }



        .rag-status.flash {

          color: var(--accent);

        }



        .rag-session-hint {

          font-size: 12px;

          color: var(--text-soft);

        }



        .conversation-card {

          position: relative;

          border-radius: 26px;

          padding: 28px;

          background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(241, 244, 250, 0.78));

          border: 1px solid rgba(255, 255, 255, 0.9);

          box-shadow: 0 28px 65px rgba(17, 23, 33, 0.15);

          overflow: hidden;

          display: flex;

          flex-direction: column;

          gap: 22px;

        }



        .conversation-card::before {

          content: '';

          position: absolute;

          inset: 0;

          border-radius: 26px;

          padding: 1.2px;

          background: linear-gradient(120deg, rgba(200, 16, 46, 0.35), rgba(17, 24, 39, 0.35));

          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);

          -webkit-mask-composite: xor;

          mask-composite: exclude;

          pointer-events: none;

        }



        .conversation-top {

          display: flex;

          align-items: center;

          justify-content: space-between;

        }



        .conversation-top h2 {

          margin: 0;

          font-size: 16px;

          font-weight: 600;

          letter-spacing: 0.12em;

          text-transform: uppercase;

          color: var(--text-soft);

        }



        .comms-prompt {

          position: relative;

          border-radius: 22px;

          background: rgba(255, 255, 255, 0.82);

          border: 1px solid rgba(200, 16, 46, 0.12);

          padding: 22px;

          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);

          display: flex;

          flex-direction: column;

          gap: 14px;

          max-height: 360px;

          overflow-y: auto;

        }



        .chat-row {

          border-radius: 18px;

          border: 1px solid rgba(17, 24, 39, 0.08);

          padding: 16px 18px;

          background: rgba(255, 255, 255, 0.92);

          display: flex;

          flex-direction: column;

          gap: 8px;

          position: relative;

        }



        .chat-row.chat-user {

          background: rgba(200, 16, 46, 0.08);

          border-color: rgba(200, 16, 46, 0.2);

        }



        .chat-row.chat-assistant {

          background: rgba(17, 24, 39, 0.04);

        }



        .chat-header {

          display: flex;

          justify-content: space-between;

          align-items: center;

        }



        .chat-role-label {

          font-size: 11px;

          text-transform: uppercase;

          letter-spacing: 0.2em;

          color: var(--text-soft);

        }



        .chat-role-label.user {

          color: var(--accent);

        }



        .chat-role-label.assistant {

          color: #0f172a;

        }



        .chat-role-label.system {

          color: rgba(17, 24, 39, 0.55);

        }



        .chat-actions {

          display: flex;

          gap: 8px;

        }



        .copy-btn {

          border: 1px solid rgba(17, 24, 39, 0.12);

          border-radius: 10px;

          padding: 6px 10px;

          font-size: 12px;

          background: rgba(255, 255, 255, 0.85);

          cursor: pointer;

        }



        .copy-btn:hover {

          border-color: rgba(200, 16, 46, 0.4);

          color: var(--accent);

        }



        .chat-body p {

          margin: 0 0 8px 0;

          font-family: var(--mono);

          font-size: 14px;

          line-height: 1.65;

          color: var(--text);

        }



        .chat-body p:last-child {

          margin-bottom: 0;

        }



        .loading-dots {

          display: inline-flex;

          gap: 6px;

        }



        .loading-dots span {

          width: 6px;

          height: 6px;

          border-radius: 999px;

          background: var(--accent);

          animation: blink 1s infinite ease-in-out;

        }



        .loading-dots span:nth-child(2) {

          animation-delay: 0.2s;

        }



        .loading-dots span:nth-child(3) {

          animation-delay: 0.4s;

        }



        @keyframes blink {

          0%,

          80%,

          100% {

            opacity: 0.3;

            transform: translateY(0);

          }

          40% {

            opacity: 1;

            transform: translateY(-2px);

          }

        }



        .chips-row {

          display: flex;

          flex-wrap: wrap;

          gap: 12px;

        }



        .chip {

          display: inline-flex;

          align-items: center;

          justify-content: center;

          padding: 12px 18px;

          border-radius: 999px;

          border: 1px solid rgba(200, 16, 46, 0.18);

          background: rgba(255, 255, 255, 0.7);

          color: var(--text);

          font-weight: 500;

          letter-spacing: 0.01em;

          cursor: pointer;

          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

        }



        .chip:hover {

          border-color: rgba(200, 16, 46, 0.45);

          box-shadow: 0 12px 26px rgba(17, 24, 39, 0.16);

          transform: translateY(-2px);

        }



        .supporting {

          font-size: 12px;

          color: var(--text-soft);

          letter-spacing: 0.1em;

          text-transform: uppercase;

        }



        .prompt-bar {

          border-radius: 22px;

          background: rgba(17, 23, 33, 0.95);

          padding: 18px 20px;

          display: flex;

          align-items: center;

          gap: 14px;

          box-shadow: 0 24px 55px rgba(17, 24, 39, 0.25);

        }



        .prompt-bar .symbol {

          color: rgba(255, 255, 255, 0.72);

          font-family: var(--mono);

          font-weight: 600;

        }



        .prompt-form {

          flex: 1;

          display: flex;

          align-items: center;

          gap: 12px;

        }



        .prompt-form input {

          flex: 1;

          background: rgba(255, 255, 255, 0.08);

          border-radius: 16px;

          border: 1px solid transparent;

          padding: 14px 16px;

          font-size: 16px;

          color: rgba(255, 255, 255, 0.92);

        }



        .prompt-form input:focus {

          outline: none;

          border-color: rgba(255, 255, 255, 0.3);

        }



        .prompt-form button {

          background: linear-gradient(120deg, var(--accent), #ff3b51);

          border: none;

          color: white;

          padding: 12px 22px;

          border-radius: 16px;

          font-weight: 600;

          letter-spacing: 0.04em;

          cursor: pointer;

          transition: transform 0.2s ease, box-shadow 0.2s ease;

        }



        .prompt-form button[disabled] {

          opacity: 0.6;

          cursor: not-allowed;

          box-shadow: none;

        }



        .prompt-form button:hover:not([disabled]) {

          transform: translateY(-2px);

          box-shadow: 0 16px 30px rgba(200, 16, 46, 0.35);

        }



        @media (max-width: 1024px) {

          body.hero {

            padding: 36px 20px;

          }

          .app-shell {

            flex-direction: column;

          }

          .sidebar {

            width: 100%;

            flex-direction: row;

            flex-wrap: wrap;

            gap: 18px;

          }

          .sidebar-section {

            flex: 1 1 260px;

          }

        }



        @media (max-width: 720px) {

          body.hero {

            padding: 24px 16px;

          }

          .model-strip,

          .conversation-card {

            padding: 20px;

          }

          .prompt-bar {

            flex-direction: column;

            align-items: stretch;

          }

          .prompt-form {

            flex-direction: column;

          }

          .prompt-form button {

            width: 100%;

          }

        }

      </style>

    </head>

    <body class="hero">

      <div class="app-shell">

        <aside class="sidebar">

          <div class="sidebar-section">

            <div class="sidebar-header">

              <h2>Sessions</h2>

              <button id="newSessionBtn" class="icon-btn" title="New session">+</button>

            </div>

            <div id="sessionList" class="session-list"></div>

          </div>

          <div class="sidebar-section">

            <div class="sidebar-header small">

              <h3>History</h3>

            </div>

            <div id="historyList" class="history-list"></div>

            <div class="history-actions">

              <button id="clearSessionBtn" class="ghost-btn">Clear</button>

              <button id="exportSessionBtn" class="ghost-btn">Export</button>

              <button id="pinSessionBtn" class="ghost-btn">Pin</button>

            </div>

          </div>

        </aside>



        <main class="main-panel">

          <div class="title-block">

            <h1>AI Cars Concierge</h1>

            <p>Ask about pricing, trims, after-sales care, or anything across the Toyota Thonburi network. Your in-house AI agent will respond instantly.</p>

            <div class="stats">

              <span>Default Model - {{DEFAULT_MODEL}}</span>

              <span>Large Model - {{LARGE_MODEL}}</span>

              <span>Upstream - {{REMOTE_BASE}}</span>

            </div>

          </div>



          <div class="model-strip">

            <div class="model-buttons" id="modelButtons">

              <button

                class="model-btn active"

                data-model-key="llama"

                data-model-value="{{DEFAULT_MODEL}}"

                data-proxy="{{REMOTE_BASE}}"

              >

                LLaMA 8B

              </button>

              <button

                class="model-btn"

                data-model-key="gemma"

                data-model-value="{{LARGE_MODEL}}"

                data-proxy="{{REMOTE_BASE}}"

              >

                Gemma 27B

              </button>

            </div>

            <div class="endpoint-control">

              <input id="endpointInput" type="text" value="{{REMOTE_BASE}}" placeholder="Override backend URL (optional)" />

              <button id="applyEndpointBtn">Set</button>

            </div>

            <div class="model-status" id="modelStatus"></div>

          </div>



          <div class="rag-session-card">
            <div class="rag-session-header">
              <h2>Knowledge Context</h2>
              <span class="rag-session-badge">RAG</span>
            </div>
            <div class="rag-session-body">
              <label class="rag-session-toggle" for="ragEnabledToggle">
                <input type="checkbox" id="ragEnabledToggle" checked />
                <span>Use retrieval-augmented responses</span>
              </label>
              <label class="rag-session-field">
                <span>Dataset ID (provided by admin)</span>
                <input type="text" id="ragDatasetInput" placeholder="e.g. toyota-service-faq" />
              </label>
              <div class="rag-status" id="ragStatus">RAG enabled - no dataset selected.</div>
              <div class="rag-session-hint">Need to ingest new knowledge? Visit the admin console.</div>
            </div>
          </div>

          <div class="conversation-card">

            <div class="conversation-top">

              <h2>Conversation Preview</h2>

            </div>



            <div id="messageList" class="comms-prompt"></div>



            <div class="chips-row" id="quickPromptRow">

              <button class="chip" data-query="Tell me about electric cars">Explore Electric Lineup</button>

              <button class="chip" data-query="What are the best sports cars?">Performance & Sports Picks</button>

              <button class="chip" data-query="Show me family cars">Family Favorites & SUVs</button>

              <button class="chip" data-query="Car maintenance tips">Maintenance & Care Guide</button>

            </div>



            <div class="supporting" id="debugInfo">Powered by your in-house LLM via secure proxy</div>



            <div class="prompt-bar">

              <span class="symbol">$</span>

              <form id="chatForm" class="prompt-form">

                <input type="text" id="userInput" placeholder="Type your query here..." autocomplete="off" />

                <button type="submit" id="sendButton">Send</button>

              </form>

            </div>

          </div>

        </main>

      </div>



      <script id="app-config" type="application/json">{{UI_CONFIG_JSON}}</script>

      <script>

        const APP_CONFIG = JSON.parse(document.getElementById('app-config').textContent || '{}');

        const defaultProxyBase = APP_CONFIG.upstream || '';

        const defaultDataset = typeof APP_CONFIG.defaultDataset === 'string' ? APP_CONFIG.defaultDataset : '';

        const AUTH_STATUS = Boolean(APP_CONFIG.authEnabled);

        const messageList = document.getElementById('messageList');

        const chatForm = document.getElementById('chatForm');

        const userInput = document.getElementById('userInput');

        const sendButton = document.getElementById('sendButton');

        const quickPromptButtons = document.querySelectorAll('.chip[data-query]');

        const modelButtons = Array.from(document.querySelectorAll('.model-btn[data-model-key]'));

        const modelStatus = document.getElementById('modelStatus');

        const endpointInput = document.getElementById('endpointInput');

        const applyEndpointBtn = document.getElementById('applyEndpointBtn');

        const sessionListEl = document.getElementById('sessionList');

        const historyListEl = document.getElementById('historyList');

        const newSessionBtn = document.getElementById('newSessionBtn');

        const clearSessionBtn = document.getElementById('clearSessionBtn');

        const exportSessionBtn = document.getElementById('exportSessionBtn');

        const pinSessionBtn = document.getElementById('pinSessionBtn');

        const debugInfo = document.getElementById('debugInfo');
        const ragEnabledToggle = document.getElementById('ragEnabledToggle');
        const ragDatasetInput = document.getElementById('ragDatasetInput');
        const ragStatus = document.getElementById('ragStatus');



        const modelRegistry = new Map();

        modelButtons.forEach((btn) => {

          modelRegistry.set(btn.dataset.modelKey, {

            key: btn.dataset.modelKey,

            label: btn.textContent ? btn.textContent.trim() : '',

            modelValue: btn.dataset.modelValue || '{{DEFAULT_MODEL}}',

            proxyBase: btn.dataset.proxy || defaultProxyBase,

            button: btn,

          });

        });



        const state = {
          sessions: [],
          activeSessionId: '',
          modelKey: modelButtons[0] ? modelButtons[0].dataset.modelKey || 'llama' : 'llama',
          customEndpoint: '',
          lastUsedEndpoint: defaultProxyBase,
          isSending: false,
          lastLatency: null,
          rag: {
            enabled: true,
            datasetName: defaultDataset,
          },
        };
        let ragStatusTimer = null;



        function refreshRagStatus() {



          if (!ragStatus) {



            return;



          }



          if (!state.rag.enabled) {



            ragStatus.textContent = 'RAG disabled for this session.';



            return;



          }



          const dataset = state.rag.datasetName.trim();



          ragStatus.textContent =



            dataset ? 'RAG enabled - dataset: ' + dataset : 'RAG enabled - no dataset selected.';



        }



        function flashRagStatus(message) {



          if (!ragStatus) {



            return;



          }



          if (ragStatusTimer) {



            clearTimeout(ragStatusTimer);



          }



          ragStatus.textContent = message;



          ragStatus.classList.add('flash');



          ragStatusTimer = setTimeout(() => {



            ragStatus.classList.remove('flash');



            ragStatusTimer = null;



            refreshRagStatus();



          }, 1800);



        }



        const CR = String.fromCharCode(13);

        const LF = String.fromCharCode(10);
        const DOUBLE_LF = String.fromCharCode(10, 10);

        function splitParagraphs(text) {

          const rows = [];

          const normalized = text.split(CR).join('');

          const lines = normalized.split(LF);

          let current = [];

          for (const line of lines) {

            if (line.trim() === '') {

              if (current.length) {

                rows.push(current.join(LF));

                current = [];

              }

              continue;

            }

            current.push(line);

          }

          if (current.length) {

            rows.push(current.join(LF));

          }

          return rows.length ? rows : [''];

        }



        function splitLines(paragraph) {

          return paragraph.split(LF);

        }


        function createMessagePayload(role, content) {

          return { id: 'm-' + crypto.randomUUID(), role, content };

        }



        function createSession(title) {

          return {

            id: 's-' + crypto.randomUUID(),

            title,

            pinned: false,

            messages: [

              createMessagePayload('system', 'Welcome to AI Cars Terminal'),

              createMessagePayload('system', 'How can I assist you today?'),

            ],

          };

        }



        function getActiveSession() {

          return state.sessions.find((session) => session.id === state.activeSessionId) || null;

        }



        function ensureInitialSession() {

          if (!state.sessions.length) {

            const session = createSession('General Session');

            state.sessions.push(session);

            state.activeSessionId = session.id;

          }

        }



        function setActiveSession(sessionId) {

          if (state.activeSessionId === sessionId) {

            return;

          }

          state.activeSessionId = sessionId;

          renderSessions();

          renderHistory();

          const session = getActiveSession();

          if (session) {

            renderMessages(session);

          }

          updatePinButtonLabel();

        }



        function renderSessions() {

          sessionListEl.innerHTML = '';

          const sorted = Array.from(state.sessions).sort((a, b) => Number(b.pinned) - Number(a.pinned));

          sorted.forEach((session) => {

            const item = document.createElement('button');

            item.type = 'button';

            let classes = 'session-item';

            if (session.id === state.activeSessionId) {

              classes += ' active';

            }

            if (session.pinned) {

              classes += ' pinned';

            }

            item.className = classes;

            item.textContent = session.title;

            item.addEventListener('click', () => setActiveSession(session.id));

            sessionListEl.appendChild(item);

          });

        }



        function renderHistory() {

          const session = getActiveSession();

          historyListEl.innerHTML = '';

          if (!session) {

            return;

          }

          session.messages

            .filter((msg) => msg.role === 'user')

            .slice(-15)

            .forEach((msg) => {

              const entry = document.createElement('div');

              entry.className = 'history-entry';

              entry.textContent = msg.content.length > 64 ? msg.content.slice(0, 61) + '...' : msg.content;

              historyListEl.appendChild(entry);

            });

        }



        function renderMessages(session) {

          messageList.innerHTML = '';

          session.messages.forEach((msg) => appendMessageToDom(msg));

          scrollMessages(false);

        }



        function appendMessageToDom(message, options) {

          const wrapper = document.createElement('div');

          wrapper.className = 'chat-row chat-' + message.role;

          wrapper.dataset.messageId = message.id;



          const header = document.createElement('div');

          header.className = 'chat-header';



          const label = document.createElement('span');

          label.className = 'chat-role-label ' + message.role;

          label.textContent = message.role;

          header.appendChild(label);



          const actions = document.createElement('div');

          actions.className = 'chat-actions';

          if (message.role === 'assistant') {

            const copyBtn = document.createElement('button');

            copyBtn.type = 'button';

            copyBtn.className = 'copy-btn';

            copyBtn.textContent = 'Copy';

            copyBtn.addEventListener('click', async () => {

              try {

                await navigator.clipboard.writeText(message.content || '');

                const original = copyBtn.textContent;

                copyBtn.textContent = 'Copied';

                setTimeout(() => {

                  copyBtn.textContent = original;

                }, 1200);

              } catch (error) {

                console.error('Copy failed', error);

              }

            });

            actions.appendChild(copyBtn);

          }

          header.appendChild(actions);



          const body = document.createElement('div');

          body.className = 'chat-body';

          if (options && options.loading) {

            body.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';

          } else if (message.content) {

            renderPlainText(body, message.content);

          }



          wrapper.appendChild(header);

          wrapper.appendChild(body);

          messageList.appendChild(wrapper);



          return { wrapper, body };

        }



        function renderPlainText(container, text) {
          container.innerHTML = '';
          const paragraphs = splitParagraphs(text);
          paragraphs.forEach((paragraph, index) => {
            const p = document.createElement('p');
            splitLines(paragraph).forEach((line, lineIdx) => {
              if (lineIdx > 0) {
                p.appendChild(document.createElement('br'));
              }
              p.appendChild(document.createTextNode(line));
            });
            container.appendChild(p);
            if (index < paragraphs.length - 1) {
              container.appendChild(document.createElement('div')).style.height = '8px';
            }
          });
        }



        function scrollMessages(smooth) {

          messageList.scrollTo({

            top: messageList.scrollHeight,

            behavior: smooth === false ? 'auto' : 'smooth',

          });

        }



        function delay(ms) {

          return new Promise((resolve) => setTimeout(resolve, ms));

        }



        async function typewriter(container, text, targetMessage) {
          container.innerHTML = '';
          const paragraphs = splitParagraphs(text);
          let buffer = '';
          for (let pIdx = 0; pIdx < paragraphs.length; pIdx += 1) {
            const paragraph = paragraphs[pIdx];
            const p = document.createElement('p');
            container.appendChild(p);
            const lines = splitLines(paragraph);
            for (let lIdx = 0; lIdx < lines.length; lIdx += 1) {
              const line = lines[lIdx];
              if (lIdx > 0) {
                p.appendChild(document.createElement('br'));
              }
              for (const char of line) {
                p.appendChild(document.createTextNode(char));
                buffer += char;
                targetMessage.content = buffer;
                scrollMessages(false);
                await delay(12);
              }
            }
            if (pIdx < paragraphs.length - 1) {
              container.appendChild(document.createElement('div')).style.height = '8px';
              buffer += DOUBLE_LF;
            }
          }
          targetMessage.content = buffer;
        }



        function getSelectedModel() {

          return modelRegistry.get(state.modelKey) || modelRegistry.values().next().value;

        }



        function getActiveEndpoint() {

          const override = state.customEndpoint.trim();

          if (override) {

            return override;

          }

          const preset = getSelectedModel();

          return (preset && preset.proxyBase) || defaultProxyBase;

        }



        function setSendingUi(isSending) {

          state.isSending = isSending;

          sendButton.disabled = isSending;

          userInput.disabled = isSending;

          sendButton.textContent = isSending ? 'Sending...' : 'Send';

        }



        function updateModelStatus() {

          const preset = getSelectedModel();

          const displayEndpoint = state.lastUsedEndpoint || getActiveEndpoint();

          const latencyText = state.lastLatency != null ? ' | Latency: ' + state.lastLatency + 'ms' : '';

          modelStatus.textContent = 'Model: ' + preset.modelValue + ' | Endpoint: ' + displayEndpoint + latencyText;

          debugInfo.textContent = 'Upstream: ' + displayEndpoint + ' | Auth: ' + (AUTH_STATUS ? 'enabled' : 'disabled');

        }



        function updatePinButtonLabel() {

          const session = getActiveSession();

          pinSessionBtn.textContent = session && session.pinned ? 'Unpin' : 'Pin';

        }



        async function handleSend(query) {

          if (!query || state.isSending) {

            return;

          }

          const session = getActiveSession();

          if (!session) {

            return;

          }



          const userMessage = createMessagePayload('user', query);

          session.messages.push(userMessage);

          appendMessageToDom(userMessage);

          scrollMessages(true);

          updateSessionTitle(session, userMessage.content);

          renderSessions();

          renderHistory();



          const assistantMessage = createMessagePayload('assistant', '');

          session.messages.push(assistantMessage);

          const domRefs = appendMessageToDom(assistantMessage, { loading: true });

          scrollMessages(true);



          const preset = getSelectedModel();

          const targetEndpoint = getActiveEndpoint();

          const ragContext = state.rag.datasetName.trim()

            ? { datasetName: state.rag.datasetName.trim() }

            : undefined;

          const payload = {

            query,

            model: preset.modelValue,

            wantHumanTone: true,

            proxyBase: targetEndpoint,

            useRAG: state.rag.enabled,

            ragContext,

          };



          setSendingUi(true);



          try {

            const response = await fetch('/api/query', {

              method: 'POST',

              headers: { 'Content-Type': 'application/json' },

              body: JSON.stringify(payload),

            });

            const data = await response.json();

            if (!response.ok || !data.ok) {

              throw new Error(data.error || data.response || ('HTTP ' + response.status));

            }



            const answer = data.response || '';

            domRefs.body.innerHTML = '';

            await typewriter(domRefs.body, answer, assistantMessage);

            assistantMessage.content = answer;

            state.lastLatency = typeof data.latencyMs === 'number' ? data.latencyMs : null;

            state.lastUsedEndpoint = typeof data.proxyBase === 'string' && data.proxyBase ? data.proxyBase : targetEndpoint;

            if (typeof data.model === 'string' && preset) {

              preset.modelValue = data.model;

            }

          } catch (error) {

            const msg = error instanceof Error ? error.message : String(error);

            domRefs.body.innerHTML = '';

            assistantMessage.content = 'Error: ' + msg;

            renderPlainText(domRefs.body, assistantMessage.content);

            state.lastUsedEndpoint = targetEndpoint;

          } finally {

            setSendingUi(false);

            renderHistory();

            renderSessions();

            updateModelStatus();

          }

        }



        function updateSessionTitle(session, latestQuery) {

          if (!session) {

            return;

          }

          if (!session.title || session.title === 'General Session' || session.title.indexOf('Session ') === 0) {

            session.title = latestQuery.length > 28 ? latestQuery.slice(0, 25) + '...' : latestQuery;

          }

        }



        function applyModelSelection(modelKey) {

          state.modelKey = modelKey;

          modelButtons.forEach((btn) => {

            btn.classList.toggle('active', btn.dataset.modelKey === modelKey);

          });

          updateModelStatus();

        }



        modelButtons.forEach((btn) => {

          btn.addEventListener('click', () => {

            applyModelSelection(btn.dataset.modelKey || state.modelKey);

          });

        });



        applyEndpointBtn.addEventListener('click', () => {

          state.customEndpoint = endpointInput.value.trim();

          state.lastUsedEndpoint = getActiveEndpoint();

          updateModelStatus();

        });



        chatForm.addEventListener('submit', (event) => {

          event.preventDefault();

          const query = userInput.value.trim();

          if (!query) {

            return;

          }

          userInput.value = '';

          handleSend(query);

        });



        quickPromptButtons.forEach((btn) => {

          btn.addEventListener('click', () => {

            if (state.isSending) {

              return;

            }

            const query = btn.dataset.query || '';

            if (!query) {

              return;

            }

            handleSend(query);

          });

        });

        if (ragDatasetInput instanceof HTMLInputElement) {

          const applyDataset = () => {

            state.rag.datasetName = ragDatasetInput.value.trim();

            refreshRagStatus();

          };

          ragDatasetInput.addEventListener('change', applyDataset);

          ragDatasetInput.addEventListener('blur', applyDataset);

          ragDatasetInput.addEventListener('keyup', (event) => {

            if (event.key === 'Enter') {

              applyDataset();

            }

          });

        }



        if (ragEnabledToggle instanceof HTMLInputElement) {

          ragEnabledToggle.addEventListener('change', () => {

            state.rag.enabled = ragEnabledToggle.checked;

            flashRagStatus(ragEnabledToggle.checked ? 'RAG enabled' : 'RAG disabled');

          });

        }



        newSessionBtn.addEventListener('click', () => {

          const session = createSession('Session ' + (state.sessions.length + 1));

          state.sessions.unshift(session);

          state.activeSessionId = session.id;

          renderSessions();

          renderHistory();

          renderMessages(session);

          updatePinButtonLabel();

        });



        clearSessionBtn.addEventListener('click', () => {

          const session = getActiveSession();

          if (!session) {

            return;

          }

          session.messages = [

            createMessagePayload('system', 'Welcome to AI Cars Terminal'),

            createMessagePayload('system', 'How can I assist you today?'),

          ];

          renderMessages(session);

          renderHistory();

          state.lastLatency = null;

          updateModelStatus();

        });



        exportSessionBtn.addEventListener('click', async () => {

          const session = getActiveSession();

          if (!session) {

            return;

          }

          const transcript = session.messages

            .map((msg) => msg.role.toUpperCase() + ': ' + msg.content)

            .join(DOUBLE_LF);

          try {

            await navigator.clipboard.writeText(transcript);

            const original = exportSessionBtn.textContent;

            exportSessionBtn.textContent = 'Copied';

            setTimeout(() => {

              exportSessionBtn.textContent = original;

            }, 1200);

          } catch (error) {

            console.error('Export failed', error);

          }

        });



        pinSessionBtn.addEventListener('click', () => {

          const session = getActiveSession();

          if (!session) {

            return;

          }

          session.pinned = !session.pinned;

          updatePinButtonLabel();

          renderSessions();

        });



        function bootstrap() {

          ensureInitialSession();

          renderSessions();

          renderHistory();

          const session = getActiveSession();

          if (session) {

            renderMessages(session);

          }

          if (ragEnabledToggle instanceof HTMLInputElement) {

            ragEnabledToggle.checked = state.rag.enabled;

          }

          if (ragDatasetInput instanceof HTMLInputElement) {

            ragDatasetInput.value = state.rag.datasetName;

          }

          refreshRagStatus();

          applyModelSelection(state.modelKey);

          updateModelStatus();

          updatePinButtonLabel();

          userInput.focus();

        }



        bootstrap();

      </script>

    </body>

    </html>
`;

function applyReplacements(html: string, entries: Array<[string, string]>): string {
  let output = html;
  for (const [token, value] of entries) {
    output = output.split(token).join(value);
  }
  return output;
}

export function renderHomePage({ uiConfig, defaultModel, largeModel, remoteInfo }: {
  uiConfig: Record<string, unknown>;
  defaultModel: string;
  largeModel: string;
  remoteInfo: { baseUrl: string; authEnabled: boolean };
}): string {
  return applyReplacements(HOME_TEMPLATE, [
    ['{{DEFAULT_MODEL}}', defaultModel],
    ['{{LARGE_MODEL}}', largeModel],
    ['{{REMOTE_BASE}}', remoteInfo.baseUrl],
    ['{{UI_CONFIG_JSON}}', JSON.stringify(uiConfig)],
  ]);
}
