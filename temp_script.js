
        const APP_CONFIG = JSON.parse(document.getElementById('app-config').textContent || '{}');

        const defaultProxyBase = APP_CONFIG.upstream || '';

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



        const modelRegistry = new Map();

        modelButtons.forEach((btn) => {

          modelRegistry.set(btn.dataset.modelKey, {

            key: btn.dataset.modelKey,

            label: btn.textContent ? btn.textContent.trim() : '',

            modelValue: btn.dataset.modelValue || '${DEFAULT_MODEL}',

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
        };
        const CR = String.fromCharCode(13);

        const LF = String.fromCharCode(10);



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
              buffer += '\n\n';
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

          const payload = {

            query,

            model: preset.modelValue,

            wantHumanTone: true,

            proxyBase: targetEndpoint,

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

            .join('\n\n');

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

          applyModelSelection(state.modelKey);

          updateModelStatus();

          updatePinButtonLabel();

          userInput.focus();

        }



        bootstrap();

      