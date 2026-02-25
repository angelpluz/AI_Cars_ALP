export function renderLoginPage(params: { error: string }): string {
  const errorMessage = params.error === '1' 
    ? '<div class="error-message">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</div>' 
    : '';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>เข้าสู่ระบบ - Toyota Thonburi AI</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='15' fill='%23e11d48'/><text x='50' y='68' font-size='50' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'>T</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #e11d48;
      --primary-dark: #be123c;
      --dark: #0f0f0f;
      --gray-100: #f4f4f5;
      --gray-200: #e4e4e7;
      --gray-400: #a1a1aa;
      --gray-700: #3f3f46;
      --light: #ffffff;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Noto Sans Thai', sans-serif;
      background: linear-gradient(135deg, #fafafa 0%, #f4f4f5 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--dark);
    }

    .bg-pattern {
      position: fixed;
      inset: 0;
      background: 
        radial-gradient(ellipse at 20% 20%, rgba(225, 29, 72, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(225, 29, 72, 0.06) 0%, transparent 50%);
      pointer-events: none;
    }

    .login-container {
      width: 100%;
      max-width: 420px;
      padding: 20px;
      position: relative;
      z-index: 1;
    }

    .login-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.08),
        0 8px 24px rgba(0, 0, 0, 0.04);
      padding: 40px;
      overflow: hidden;
    }

    .login-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      border-radius: 16px;
      color: white;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 20px;
      box-shadow: 0 8px 24px rgba(225, 29, 72, 0.3);
    }

    .login-title {
      font-size: 26px;
      font-weight: 700;
      color: var(--dark);
      margin-bottom: 8px;
    }

    .login-subtitle {
      font-size: 15px;
      color: var(--gray-400);
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--dark);
    }

    .form-input {
      padding: 14px 16px;
      border: 2px solid var(--gray-200);
      border-radius: 12px;
      font-size: 15px;
      font-family: inherit;
      transition: all 0.2s;
      background: white;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 4px rgba(225, 29, 72, 0.1);
    }

    .form-input::placeholder {
      color: var(--gray-400);
    }

    .error-message {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      text-align: center;
    }

    .login-button {
      padding: 16px 24px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 16px rgba(225, 29, 72, 0.35);
      margin-top: 8px;
    }

    .login-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(225, 29, 72, 0.45);
    }

    .login-footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--gray-200);
    }

    .login-footer-text {
      font-size: 13px;
      color: var(--gray-400);
    }

    .login-footer-brand {
      font-weight: 600;
      color: var(--primary);
    }

    .security-notice {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      font-size: 12px;
      color: var(--gray-400);
    }

    .security-notice svg {
      width: 16px;
      height: 16px;
    }

    @media (max-width: 480px) {
      .login-card {
        padding: 32px 24px;
      }
      
      .login-title {
        font-size: 22px;
      }
    }
  </style>
</head>
<body>
  <div class="bg-pattern"></div>
  
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">T</div>
        <h1 class="login-title">เข้าสู่ระบบ</h1>
        <p class="login-subtitle">Toyota Thonburi AI Concierge</p>
      </div>
      
      <form class="login-form" action="/login" method="POST">
        ${errorMessage}
        
        <div class="form-group">
          <label class="form-label" for="username">ชื่อผู้ใช้</label>
          <input 
            type="text" 
            id="username" 
            name="username" 
            class="form-input" 
            placeholder="กรอกชื่อผู้ใช้"
            required
            autocomplete="username"
          />
        </div>
        
        <div class="form-group">
          <label class="form-label" for="password">รหัสผ่าน</label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            class="form-input" 
            placeholder="กรอกรหัสผ่าน"
            required
            autocomplete="current-password"
          />
        </div>
        
        <button type="submit" class="login-button">เข้าสู่ระบบ</button>
      </form>
      
      <div class="login-footer">
        <p class="login-footer-text">
          <span class="login-footer-brand">TOYOTA THONBURI</span> — AI-Powered Automotive Assistant
        </p>
        <div class="security-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          ระบบรักษาความปลอดภัยมาตรฐานสูง
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
