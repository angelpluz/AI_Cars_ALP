const HOME_TEMPLATE = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Toyota Thonburi AI Concierge</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #e11d48;
      --primary-dark: #be123c;
      --primary-light: #fb7185;
      --dark: #0f0f0f;
      --gray-900: #18181b;
      --gray-800: #27272a;
      --gray-700: #3f3f46;
      --gray-400: #a1a1aa;
      --gray-200: #e4e4e7;
      --gray-100: #f4f4f5;
      --light: #ffffff;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Noto Sans Thai', 'Inter', sans-serif;
      background: linear-gradient(135deg, #fafafa 0%, #f4f4f5 50%, #fafafa 100%);
      min-height: 100vh;
      color: var(--dark);
      overflow-x: hidden;
    }

    /* Animated Background Gradient */
    .bg-gradient {
      position: fixed;
      inset: 0;
      background: 
        radial-gradient(ellipse at 20% 20%, rgba(225, 29, 72, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(225, 29, 72, 0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.02) 0%, transparent 70%);
      animation: gradientMove 20s ease infinite;
      pointer-events: none;
    }

    @keyframes gradientMove {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, -30px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.95); }
    }

    /* Floating Elements */
    .float-element {
      position: fixed;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(225, 29, 72, 0.1), rgba(225, 29, 72, 0.05));
      filter: blur(40px);
      pointer-events: none;
    }

    .float-1 {
      width: 300px;
      height: 300px;
      top: -100px;
      right: -100px;
      animation: float 8s ease-in-out infinite;
    }

    .float-2 {
      width: 200px;
      height: 200px;
      bottom: 10%;
      left: -50px;
      animation: float 10s ease-in-out infinite reverse;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-30px) rotate(5deg); }
    }

    /* App Container */
    .app-container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 1;
    }

    /* Glassmorphism Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 20px;
      box-shadow: 
        0 4px 24px rgba(0, 0, 0, 0.06),
        0 1px 2px rgba(0, 0, 0, 0.04);
      margin-bottom: 24px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 20px;
      box-shadow: 0 8px 20px rgba(225, 29, 72, 0.3);
      position: relative;
      overflow: hidden;
    }

    .logo-icon::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(
        45deg,
        transparent 30%,
        rgba(255, 255, 255, 0.3) 50%,
        transparent 70%
      );
      animation: shimmer 3s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%) rotate(45deg); }
      100% { transform: translateX(100%) rotate(45deg); }
    }

    .logo-text {
      font-weight: 700;
      font-size: 19px;
      color: var(--dark);
      letter-spacing: 0.3px;
    }

    .logo-sub {
      font-size: 11px;
      color: var(--primary);
      letter-spacing: 2.5px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 999px;
      font-size: 12px;
      color: #16a34a;
      font-weight: 500;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(0.95); }
    }

    /* Hero Section */
    .hero {
      text-align: center;
      padding: 40px 0 32px;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(225, 29, 72, 0.08);
      border: 1px solid rgba(225, 29, 72, 0.15);
      border-radius: 999px;
      font-size: 12px;
      color: var(--primary);
      font-weight: 500;
      margin-bottom: 20px;
    }

    .hero-badge svg {
      width: 14px;
      height: 14px;
    }

    .hero-title {
      font-size: 42px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--dark);
      letter-spacing: -0.5px;
      line-height: 1.2;
    }

    .hero-title span {
      background: linear-gradient(135deg, var(--primary), var(--primary-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-subtitle {
      font-size: 16px;
      color: var(--gray-400);
      max-width: 480px;
      margin: 0 auto;
      line-height: 1.7;
    }

    /* Main Chat Card */
    .chat-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.08),
        0 8px 24px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--gray-200);
    }

    .chat-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      color: var(--dark);
    }

    .chat-title-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .chat-actions {
      display: flex;
      gap: 8px;
    }

    .chat-action-btn {
      padding: 8px 12px;
      background: transparent;
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      font-size: 13px;
      color: var(--gray-700);
      cursor: pointer;
      transition: all 0.2s;
    }

    .chat-action-btn:hover {
      background: var(--gray-100);
      border-color: var(--gray-300);
    }

    /* Messages Area */
    .messages {
      min-height: 320px;
      max-height: 480px;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .messages::-webkit-scrollbar {
      width: 6px;
    }

    .messages::-webkit-scrollbar-track {
      background: transparent;
    }

    .messages::-webkit-scrollbar-thumb {
      background: var(--gray-200);
      border-radius: 3px;
    }

    .message {
      display: flex;
      gap: 14px;
      animation: messageSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes messageSlide {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .message-avatar {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }

    .message.user .message-avatar {
      background: var(--gray-100);
      color: var(--gray-700);
      border: 1px solid var(--gray-200);
    }

    .message.assistant .message-avatar {
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: white;
      box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3);
    }

    .message-content {
      flex: 1;
      max-width: calc(100% - 60px);
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .message-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--dark);
    }

    .message-time {
      font-size: 11px;
      color: var(--gray-400);
    }

    .message-bubble {
      padding: 16px 20px;
      border-radius: 18px;
      line-height: 1.7;
      font-size: 15px;
      color: var(--gray-900);
    }

    .message.user .message-bubble {
      background: var(--gray-100);
      border: 1px solid var(--gray-200);
      border-bottom-right-radius: 6px;
    }

    .message.assistant .message-bubble {
      background: rgba(225, 29, 72, 0.04);
      border: 1px solid rgba(225, 29, 72, 0.12);
      border-bottom-left-radius: 6px;
    }

    /* Quick Actions */
    .quick-section {
      padding: 20px 24px;
      background: linear-gradient(180deg, var(--gray-100) 0%, rgba(255, 255, 255, 0) 100%);
      border-top: 1px solid var(--gray-200);
    }

    .quick-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-400);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }

    .quick-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
    }

    .quick-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: 14px;
      color: var(--dark);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .quick-btn:hover {
      border-color: var(--primary);
      background: rgba(225, 29, 72, 0.02);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
    }

    .quick-btn-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--gray-100), white);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: 1px solid var(--gray-200);
    }

    .quick-btn:hover .quick-btn-icon {
      background: linear-gradient(135deg, rgba(225, 29, 72, 0.1), rgba(225, 29, 72, 0.05));
      border-color: rgba(225, 29, 72, 0.2);
    }

    /* Input Area */
    .input-section {
      padding: 20px 24px 24px;
      background: white;
      border-top: 1px solid var(--gray-200);
    }

    .input-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--gray-100);
      border: 2px solid transparent;
      border-radius: 16px;
      padding: 6px 6px 6px 20px;
      transition: all 0.2s;
    }

    .input-wrapper:focus-within {
      background: white;
      border-color: var(--primary);
      box-shadow: 0 0 0 4px rgba(225, 29, 72, 0.1);
    }

    .input-field {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--dark);
      font-size: 15px;
      padding: 12px 0;
      outline: none;
      font-family: inherit;
    }

    .input-field::placeholder {
      color: var(--gray-400);
    }

    .send-btn {
      padding: 12px 24px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      border: none;
      border-radius: 12px;
      color: white;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35);
    }

    .send-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(225, 29, 72, 0.45);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    /* Loading */
    .loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      color: var(--gray-400);
    }

    .loading-dots {
      display: flex;
      gap: 4px;
    }

    .loading-dots span {
      width: 8px;
      height: 8px;
      background: var(--primary);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
    .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 32px 0 16px;
    }

    .footer-brand {
      font-size: 13px;
      color: var(--gray-400);
      font-weight: 500;
    }

    .footer-brand span {
      color: var(--primary);
      font-weight: 600;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .app-container {
        padding: 16px;
      }
      
      .hero-title {
        font-size: 32px;
      }
      
      .quick-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .header {
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  <div class="float-element float-1"></div>
  <div class="float-element float-2"></div>

  <div class="app-container">
    <header class="header">
      <div class="logo">
        <div class="logo-icon">T</div>
        <div>
          <div class="logo-text">TOYOTA THONBURI</div>
          <div class="logo-sub">AI Concierge</div>
        </div>
      </div>
      <div class="status-badge">
        <span class="status-dot"></span>
        <span>พร้อมให้บริการ</span>
      </div>
    </header>

    <main class="main-content">
      <section class="hero">
        <div class="hero-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          AI-Powered Assistant
        </div>
        <h1 class="hero-title"><span>AI</span> Concierge</h1>
        <p class="hero-subtitle">ผู้ช่วยอัจฉริยะของโตโยต้า ธนบุรี พร้อมให้ข้อมูลรถยนต์ อะไหล่ และบริการครบวงจร</p>
      </section>

      <div class="chat-card">
        <div class="chat-header">
          <div class="chat-title">
            <div class="chat-title-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span>การสนทนา</span>
          </div>
          <div class="chat-actions">
            <button class="chat-action-btn" onclick="clearChat()">ล้างการสนทนา</button>
          </div>
        </div>

        <div class="messages" id="messageList"></div>

        <div class="quick-section">
          <div class="quick-label">คำถามยอดนิยม</div>
          <div class="quick-grid" id="quickActions">
            <button class="quick-btn" data-query="รุ่นรถทั้งหมดที่มี">
              <div class="quick-btn-icon">🚗</div>
              <span>รุ่นรถทั้งหมด</span>
            </button>
            <button class="quick-btn" data-query="คำนวณค่างวดผ่อนรถ">
              <div class="quick-btn-icon">💰</div>
              <span>คำนวณค่างวด</span>
            </button>
            <button class="quick-btn" data-query="สาขาใกล้ฉัน">
              <div class="quick-btn-icon">📍</div>
              <span>สาขาใกล้คุณ</span>
            </button>
            <button class="quick-btn" data-query="โปรโมชั่นล่าสุด">
              <div class="quick-btn-icon">🎁</div>
              <span>โปรโมชั่น</span>
            </button>
          </div>
        </div>

        <div class="input-section">
          <form id="chatForm" class="input-wrapper">
            <input 
              type="text" 
              id="userInput" 
              class="input-field" 
              placeholder="พิมพ์คำถามของคุณที่นี่..."
              autocomplete="off"
            />
            <button type="submit" id="sendButton" class="send-btn">
              <span>ส่ง</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </form>
        </div>
      </div>
    </main>

    <footer class="footer">
      <div class="footer-brand"><span>TOYOTA THONBURI</span> — AI-Powered Automotive Assistant</div>
    </footer>
  </div>

  <script>
    const chatForm = document.getElementById('chatForm');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const messageList = document.getElementById('messageList');
    const quickActions = document.getElementById('quickActions');

    let isLoading = false;

    function addMessage(role, content) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ' + role;
      
      const name = role === 'user' ? 'คุณ' : 'ผู้ช่วย AI';
      const avatar = role === 'user' ? 'U' : 'AI';
      const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      
      messageDiv.innerHTML = '<div class="message-avatar">' + avatar + '</div><div class="message-content"><div class="message-header"><span class="message-name">' + name + '</span><span class="message-time">' + time + '</span></div><div class="message-bubble">' + content.replace(/\\n/g, '<br>') + '</div></div>';
      
      messageList.appendChild(messageDiv);
      messageList.scrollTop = messageList.scrollHeight;
    }

    function showLoading() {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading';
      loadingDiv.id = 'loadingIndicator';
      loadingDiv.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div><span>AI กำลังคิด...</span>';
      messageList.appendChild(loadingDiv);
      messageList.scrollTop = messageList.scrollHeight;
    }

    function hideLoading() {
      const loading = document.getElementById('loadingIndicator');
      if (loading) loading.remove();
    }

    function clearChat() {
      messageList.innerHTML = '';
    }

    async function sendMessage(message) {
      if (isLoading) return;
      
      isLoading = true;
      sendButton.disabled = true;
      
      addMessage('user', message);
      showLoading();
      
      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: message,
            useRAG: true,
            wantHumanTone: true
          })
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.ok) {
          addMessage('assistant', data.response);
        } else {
          addMessage('assistant', 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        }
      } catch (error) {
        hideLoading();
        addMessage('assistant', 'ขออภัย ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        isLoading = false;
        sendButton.disabled = false;
        userInput.focus();
      }
    }

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = userInput.value.trim();
      if (message) {
        sendMessage(message);
        userInput.value = '';
      }
    });

    quickActions.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-btn');
      if (btn) {
        const query = btn.dataset.query;
        sendMessage(query);
      }
    });

    userInput.focus();
  </script>
</body>
</html>`;

export function renderHomePage(params: {
  uiConfig: Record<string, unknown>;
  defaultModel: string;
  largeModel: string;
  remoteInfo: { baseUrl: string; authEnabled: boolean };
}): string {
  return HOME_TEMPLATE;
}
