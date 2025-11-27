#!/bin/bash

set -e

echo "🔐 Interactive OAuth Client Test"
echo "================================="
echo ""

# Generate PKCE
CODE_VERIFIER=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr '+/' '-_' | tr -d '=')
STATE=$(openssl rand -hex 16)

# Save variables for later
echo "$CODE_VERIFIER" > /tmp/oauth_code_verifier.txt
echo "$STATE" > /tmp/oauth_state.txt

echo "✅ Generated PKCE challenge"
echo "   Verifier: ${CODE_VERIFIER:0:30}..."
echo "   Challenge: ${CODE_CHALLENGE:0:30}..."
echo ""

# Build authorization URL
AUTH_URL="https://mcp.auth-agent.com/authorize"
AUTH_URL="${AUTH_URL}?client_id=client_claude_code"
AUTH_URL="${AUTH_URL}&redirect_uri=http://localhost:3000/callback"
AUTH_URL="${AUTH_URL}&code_challenge=${CODE_CHALLENGE}"
AUTH_URL="${AUTH_URL}&code_challenge_method=S256"
AUTH_URL="${AUTH_URL}&response_type=code"
AUTH_URL="${AUTH_URL}&scope=premiere:edit+premiere:read"
AUTH_URL="${AUTH_URL}&resource=https://test-adobe-premiere.example.com"
AUTH_URL="${AUTH_URL}&state=${STATE}"

echo "📋 Authorization URL:"
echo "$AUTH_URL"
echo ""

# Start local callback server
echo "🚀 Starting local callback server on http://localhost:3000..."
echo ""

# Create a simple HTTP server to catch the redirect
cat > /tmp/oauth_callback_server.js <<'EOF'
const http = require('http');
const url = require('url');
const fs = require('fs');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/callback') {
    const code = parsedUrl.query.code;
    const state = parsedUrl.query.state;
    const error = parsedUrl.query.error;

    if (error) {
      console.log('\n❌ Authorization failed:', error);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>❌ Authorization Failed</h1>
            <p>Error: ${error}</p>
            <p>${parsedUrl.query.error_description || ''}</p>
          </body>
        </html>
      `);
      setTimeout(() => process.exit(1), 1000);
      return;
    }

    if (code && state) {
      console.log('\n✅ Authorization successful!');
      console.log('📝 Authorization code:', code);
      console.log('📝 State:', state);

      // Save the code
      fs.writeFileSync('/tmp/oauth_auth_code.txt', code);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✅ Authorization Successful!</h1>
            <p>You can close this window and return to the terminal.</p>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              Authorization code: ${code.substring(0, 20)}...
            </p>
          </body>
        </html>
      `);

      setTimeout(() => process.exit(0), 1000);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('✅ Callback server ready on http://localhost:3000/callback');
  console.log('');
});
EOF

# Start the server in background
node /tmp/oauth_callback_server.js &
SERVER_PID=$!

sleep 1

echo "👉 Opening authorization page in your browser..."
echo "   Please enter your email, verify with the code sent to your email,"
echo "   and authorize the application"
echo ""

# Open browser
if command -v open &> /dev/null; then
  open "$AUTH_URL"
elif command -v xdg-open &> /dev/null; then
  xdg-open "$AUTH_URL"
else
  echo "Please open this URL manually:"
  echo "$AUTH_URL"
fi

echo "⏳ Waiting for authorization..."
echo ""

# Wait for the server to exit (with timeout)
wait $SERVER_PID 2>/dev/null || true

# Check if we got a code
if [ -f /tmp/oauth_auth_code.txt ]; then
  AUTH_CODE=$(cat /tmp/oauth_auth_code.txt)
  CODE_VERIFIER=$(cat /tmp/oauth_code_verifier.txt)

  echo ""
  echo "🎉 Authorization complete!"
  echo ""
  echo "📝 Step 2: Exchanging authorization code for access token..."

  TOKEN_RESPONSE=$(curl -s -X POST https://mcp.auth-agent.com/token \
    -H "Content-Type: application/json" \
    -d "{
      \"grant_type\": \"authorization_code\",
      \"code\": \"$AUTH_CODE\",
      \"code_verifier\": \"$CODE_VERIFIER\",
      \"redirect_uri\": \"http://localhost:3000/callback\",
      \"client_id\": \"client_claude_code\"
    }")

  echo ""
  echo "✅ Token response:"
  echo "$TOKEN_RESPONSE" | jq .

  # Extract access token
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')

  if [ -n "$ACCESS_TOKEN" ]; then
    echo ""
    echo "🎉 Successfully obtained access token!"
    echo "   Token: ${ACCESS_TOKEN:0:50}..."
    echo ""
    echo "📝 Step 3: You can now use this token to call the MCP server!"
    echo ""
    echo "Example MCP request:"
    cat <<EXAMPLE
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_project",
    "arguments": {
      "name": "My Video"
    },
    "_meta": {
      "authorization": "Bearer $ACCESS_TOKEN"
    }
  },
  "id": 1
}
EXAMPLE
  else
    echo ""
    echo "❌ Failed to get access token"
  fi

  # Cleanup
  rm -f /tmp/oauth_auth_code.txt /tmp/oauth_code_verifier.txt /tmp/oauth_state.txt /tmp/oauth_callback_server.js
else
  echo ""
  echo "❌ Authorization was cancelled or failed"

  # Cleanup
  kill $SERVER_PID 2>/dev/null || true
  rm -f /tmp/oauth_code_verifier.txt /tmp/oauth_state.txt /tmp/oauth_callback_server.js
fi

echo ""
