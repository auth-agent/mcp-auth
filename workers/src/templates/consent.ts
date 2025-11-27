/**
 * Consent page HTML template
 */

interface ConsentPageParams {
  requestId: string;
  clientName: string;
  clientLogo?: string;
  scopes: string[];
  serverName?: string;
  serverUrl?: string;
}

export function consentPageHtml(params: ConsentPageParams): string {
  const scopeDescriptions: Record<string, string> = {
    'openid': 'Basic identity information',
    'profile': 'Your profile information',
    'email': 'Your email address',
    'files:read': 'Read your files',
    'files:write': 'Create and modify your files',
    'db:read': 'Read database records',
    'db:write': 'Create and modify database records',
    'premiere:edit': 'Edit video projects',
    'premiere:read': 'View video projects',
  };

  const scopeItems = params.scopes
    .map(scope => {
      const description = scopeDescriptions[scope] || scope;
      return `<li><strong>${scope}</strong> - ${description}</li>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize ${params.clientName} - Auth-Agent</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    html {
      background: #000000;
      min-height: 100vh;
      overflow-x: hidden;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #FF6B35 100%);
      background-size: 400% 400%;
      background-attachment: fixed;
      animation: gradientShift 8s ease infinite;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      width: 100vw;
      color: #fff;
      overflow-x: hidden;
      position: relative;
      padding: 20px;
    }

    body::before {
      content: '';
      position: fixed;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #FF6B35 100%);
      background-size: 400% 400%;
      animation: gradientShift 8s ease infinite;
      z-index: -1;
    }

    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    .container {
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #FF6B35;
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(255, 107, 53, 0.4);
      max-width: 520px;
      width: 100%;
      padding: 40px;
    }

    .logo {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo img {
      height: 70px;
      width: auto;
      object-fit: contain;
      display: block;
      margin: 0 auto 16px;
    }

    .brand {
      font-size: 32px;
      font-weight: 700;
      color: #FF6B35;
      margin-bottom: 20px;
      letter-spacing: -0.5px;
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
      text-align: center;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      margin-bottom: 30px;
      text-align: center;
      line-height: 1.6;
    }

    .subtitle strong {
      color: #FF6B35;
      font-weight: 600;
    }

    .auth-section {
      background: rgba(255, 107, 53, 0.1);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      border: 1px solid rgba(255, 107, 53, 0.3);
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;
    }

    input[type="email"],
    input[type="text"] {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid rgba(255, 107, 53, 0.4);
      border-radius: 8px;
      font-size: 15px;
      transition: all 0.2s;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
    }

    input[type="email"]:focus,
    input[type="text"]:focus {
      outline: none;
      border-color: #FF6B35;
      box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.2);
    }

    input[type="email"]::placeholder,
    input[type="text"]::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    .info-box {
      background: rgba(255, 107, 53, 0.15);
      border-left: 4px solid #FF6B35;
      padding: 16px;
      margin-bottom: 24px;
      border-radius: 10px;
      border: 1px solid rgba(255, 107, 53, 0.3);
    }

    .info-box p {
      font-size: 14px;
      color: #fff;
      line-height: 1.6;
    }

    .info-box strong {
      color: #FF6B35;
      font-weight: 600;
    }

    .info-box code {
      background: rgba(0, 0, 0, 0.4);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
    }

    .scopes-section {
      margin-bottom: 30px;
    }

    h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
    }

    .scopes-list {
      background: rgba(255, 107, 53, 0.1);
      border-radius: 10px;
      padding: 16px;
      border: 1px solid rgba(255, 107, 53, 0.3);
    }

    ul {
      list-style: none;
    }

    li {
      padding: 10px 0;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid rgba(255, 107, 53, 0.2);
      display: flex;
      align-items: flex-start;
    }

    li:last-child {
      border-bottom: none;
    }

    li::before {
      content: "✓";
      color: #FF6B35;
      font-weight: bold;
      margin-right: 12px;
      font-size: 16px;
    }

    li strong {
      color: #FF6B35;
      font-weight: 600;
    }

    .buttons {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    button {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-send-code {
      background: #FF6B35;
      color: white;
      box-shadow: 0 4px 6px -1px rgba(255, 107, 53, 0.4);
      width: 100%;
      margin-bottom: 16px;
    }

    .btn-send-code:hover:not(:disabled) {
      background: #ff8c5a;
      transform: translateY(-1px);
      box-shadow: 0 8px 12px -2px rgba(255, 107, 53, 0.5);
    }

    .btn-approve {
      background: #FF6B35;
      color: white;
      box-shadow: 0 4px 6px -1px rgba(255, 107, 53, 0.4);
    }

    .btn-approve:hover:not(:disabled) {
      background: #ff8c5a;
      transform: translateY(-1px);
      box-shadow: 0 8px 12px -2px rgba(255, 107, 53, 0.5);
    }

    .btn-approve:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-deny {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(255, 107, 53, 0.3);
    }

    .btn-deny:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 107, 53, 0.5);
    }

    .footer {
      text-align: center;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      padding-top: 20px;
      border-top: 1px solid rgba(255, 107, 53, 0.3);
    }

    .footer a {
      color: #FF6B35;
      text-decoration: none;
      font-weight: 500;
    }

    .footer a:hover {
      color: #ff8c5a;
      text-decoration: underline;
    }

    .loading {
      display: none;
      text-align: center;
      padding: 20px;
    }

    .spinner {
      width: 80px;
      height: 80px;
      border: 8px solid rgba(255, 107, 53, 0.2);
      border-top-color: #FF6B35;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      background: rgba(255, 107, 53, 0.2);
      border: 1px solid #FF6B35;
      color: #FF6B35;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-bottom: 16px;
      display: none;
      font-weight: 500;
    }

    .success {
      background: rgba(76, 175, 80, 0.2);
      border: 1px solid #4CAF50;
      color: #4CAF50;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-bottom: 16px;
      display: none;
      font-weight: 500;
    }

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="https://auth-agent.com/logo/AA.png" alt="Auth Agent" onerror="this.style.display='none'; if(document.querySelector('.brand')) document.querySelector('.brand').style.display='block';">
      <div class="brand" style="display:none;">Auth-Agent</div>
    </div>

    <h1>Authorize Access</h1>
    <p class="subtitle">
      <strong>${params.clientName}</strong> requests access to<br>
      ${params.serverName || 'your account'}
    </p>

    <div id="error" class="error"></div>
    <div id="success" class="success"></div>

    <div class="auth-section" id="emailSection">
      <div class="form-group">
        <label for="email">Email Address</label>
        <input type="email" id="email" placeholder="you@example.com" required autocomplete="email">
      </div>
      <button class="btn-send-code" onclick="sendVerificationCode()" id="sendCodeBtn">
        Send Verification Code
      </button>
    </div>

    <div class="auth-section hidden" id="codeSection">
      <div class="form-group">
        <label for="code">Verification Code</label>
        <input type="text" id="code" placeholder="Enter 6-digit code" required autocomplete="one-time-code" maxlength="6">
      </div>
      <p style="color: rgba(255, 255, 255, 0.7); font-size: 13px; margin-top: 8px;">
        Check your email for the verification code
      </p>
    </div>

    ${params.serverName ? `
    <div class="info-box">
      <p>
        <strong>MCP Server:</strong> ${params.serverName}<br>
        <strong>URL:</strong> <code style="font-size: 12px;">${params.serverUrl}</code>
      </p>
    </div>
    ` : ''}

    <div class="scopes-section">
      <h2>This application will be able to:</h2>
      <div class="scopes-list">
        <ul>
          ${scopeItems}
        </ul>
      </div>
    </div>

    <div class="buttons hidden" id="actionButtons">
      <button class="btn-deny" onclick="handleDeny()" id="denyBtn">Deny</button>
      <button class="btn-approve" onclick="handleApprove()" id="approveBtn">Approve Access</button>
    </div>

    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p style="color: rgba(255, 255, 255, 0.8); font-size: 14px;">Processing authorization...</p>
    </div>

    <div class="footer">
      <a href="https://auth-agent.com" target="_blank" rel="noopener noreferrer">
        Learn more about Auth-Agent →
      </a>
      <div style="margin-top: 8px; font-size: 13px;">
        Get credentials for your AI agents or integrate Auth-Agent into your website
      </div>
    </div>
  </div>

  <script>
    let userEmail = '';

    function showError(message) {
      const errorEl = document.getElementById('error');
      const successEl = document.getElementById('success');
      successEl.style.display = 'none';
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }

    function showSuccess(message) {
      const errorEl = document.getElementById('error');
      const successEl = document.getElementById('success');
      errorEl.style.display = 'none';
      successEl.textContent = message;
      successEl.style.display = 'block';
    }

    function hideMessages() {
      document.getElementById('error').style.display = 'none';
      document.getElementById('success').style.display = 'none';
    }

    function setLoading(loading) {
      const loadingEl = document.getElementById('loading');
      const allSections = document.querySelectorAll('.auth-section, .buttons');

      if (loading) {
        allSections.forEach(el => {
          el.style.opacity = '0.5';
          el.style.pointerEvents = 'none';
        });
        loadingEl.style.display = 'block';
      } else {
        allSections.forEach(el => {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
        });
        loadingEl.style.display = 'none';
      }
    }

    async function sendVerificationCode() {
      const email = document.getElementById('email').value.trim();
      hideMessages();

      if (!email) {
        showError('Please enter your email address');
        return;
      }

      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (!emailRegex.test(email)) {
        showError('Please enter a valid email address');
        return;
      }

      setLoading(true);
      userEmail = email;

      try {
        const response = await fetch('/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            request_id: '${params.requestId}',
          }),
        });

        const data = await response.json();
        console.log('OTP send response:', response.status, data);

        if (!response.ok) {
          const errorMsg = data.error_description || data.error || 'Failed to send verification code';
          console.error('OTP send failed:', data);
          showError(errorMsg);
          setLoading(false);
          return;
        }

        showSuccess('Verification code sent to ' + email);
        document.getElementById('emailSection').classList.add('hidden');
        document.getElementById('codeSection').classList.remove('hidden');
        document.getElementById('actionButtons').classList.remove('hidden');
        document.getElementById('code').focus();
      } catch (error) {
        showError('Failed to send verification code: ' + error.message);
      } finally {
        setLoading(false);
      }
    }

    async function handleDeny() {
      if (!confirm('Are you sure you want to deny access?')) {
        return;
      }

      setLoading(true);
      hideMessages();

      try {
        const response = await fetch('/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request_id: '${params.requestId}',
            user_email: 'denied@user.com',
            approved: false,
          }),
        });

        const data = await response.json();

        if (data.redirect_uri) {
          window.location.href = data.redirect_uri;
        } else {
          showError(data.error || 'Failed to process denial');
          setLoading(false);
        }
      } catch (error) {
        showError('Network error: ' + error.message);
        setLoading(false);
      }
    }

    async function handleApprove() {
      const code = document.getElementById('code').value.trim();
      hideMessages();

      if (!code) {
        showError('Please enter the verification code');
        return;
      }

      if (code.length !== 6 || !/^\\d+$/.test(code)) {
        showError('Verification code must be 6 digits');
        return;
      }

      setLoading(true);

      try {
        // First verify the OTP code
        const verifyResponse = await fetch('/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            token: code,
            request_id: '${params.requestId}',
          }),
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok) {
          showError(verifyData.error_description || 'Invalid verification code');
          setLoading(false);
          return;
        }

        // OTP verified, now approve consent
        console.log('Sending consent request:', {
          request_id: '${params.requestId}',
          user_email: userEmail,
          approved: true
        });
        
        const response = await fetch('/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request_id: '${params.requestId}',
            user_email: userEmail,
            approved: true,
          }),
        });

        const data = await response.json();
        console.log('Consent response:', response.status, data);

        if (!response.ok) {
          const errorMsg = data.error_description || data.error || 'Authorization failed';
          console.error('Consent failed:', {
            status: response.status,
            error: data.error,
            error_description: data.error_description,
            fullResponse: data
          });
          showError(errorMsg);
          setLoading(false);
          return;
        }

        if (data.redirect_uri) {
          console.log('Redirecting to:', data.redirect_uri);
          window.location.href = data.redirect_uri;
        } else {
          console.error('No redirect_uri in response:', data);
          showError(data.error || 'Authorization failed - no redirect URL');
          setLoading(false);
        }
      } catch (error) {
        console.error('Network error:', error);
        showError('Network error: ' + error.message);
        setLoading(false);
      }
    }

    // Enter key handlers
    document.getElementById('email').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendVerificationCode();
      }
    });

    document.getElementById('code').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        handleApprove();
      }
    });
  </script>
</body>
</html>`;
}
