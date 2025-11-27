#!/bin/bash

# Test OAuth Flow from Client Perspective
# This simulates what Claude Code or other MCP clients would do

set -e

echo "🔐 Testing OAuth 2.1 Client Flow for MCP"
echo "========================================="
echo ""

# Step 1: Generate PKCE challenge
echo "📝 Step 1: Generating PKCE challenge..."
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr -d "=+/" | cut -c1-43)
echo "✅ Code verifier: ${CODE_VERIFIER:0:20}..."
echo "✅ Code challenge: ${CODE_CHALLENGE:0:20}..."
echo ""

# Step 2: Build authorization URL
echo "📝 Step 2: Building authorization URL..."
AUTH_URL="https://mcp.auth-agent.com/authorize"
CLIENT_ID="client_claude_code"
REDIRECT_URI="http://localhost:3000/callback"
SCOPE="premiere:edit premiere:read"
RESOURCE="https://test-adobe-premiere.example.com"
STATE=$(openssl rand -hex 16)

FULL_AUTH_URL="${AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&response_type=code&scope=${SCOPE// /+}&resource=${RESOURCE}&state=${STATE}"

echo "✅ Authorization URL generated:"
echo ""
echo "$FULL_AUTH_URL"
echo ""
echo "👉 In a real flow, the user would:"
echo "   1. Visit this URL in their browser"
echo "   2. Log in to Auth-Agent"
echo "   3. Grant access to the Adobe Premiere Pro MCP"
echo "   4. Get redirected back with an authorization code"
echo ""

# Step 3: Simulate getting auth code (in real flow, this comes from redirect)
echo "📝 Step 3: Simulating authorization code exchange..."
echo "⚠️  Note: This would normally require user login and consent"
echo ""

# For testing, let's show what the token exchange would look like
echo "📝 Step 4: Token exchange request (example):"
echo ""
cat <<EOF
POST https://mcp.auth-agent.com/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "code_abc123xyz...",
  "code_verifier": "$CODE_VERIFIER",
  "redirect_uri": "$REDIRECT_URI",
  "client_id": "$CLIENT_ID"
}
EOF
echo ""
echo ""

# Step 5: Show what successful response looks like
echo "📝 Step 5: Expected token response:"
echo ""
cat <<EOF
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_abc123...",
  "scope": "premiere:edit premiere:read",
  "aud": "https://test-adobe-premiere.example.com"
}
EOF
echo ""
echo ""

# Step 6: Show how client would use the token
echo "📝 Step 6: Using access token with MCP server:"
echo ""
cat <<'EOF'
# MCP client sends requests with token in metadata:
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_project",
    "arguments": {
      "name": "My Video Project"
    },
    "_meta": {
      "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  },
  "id": 1
}
EOF
echo ""
echo ""

# Step 7: Test OAuth discovery
echo "📝 Step 7: Testing OAuth discovery endpoint..."
DISCOVERY=$(curl -s https://mcp.auth-agent.com/.well-known/oauth-authorization-server)
echo "✅ OAuth server discovered:"
echo "$DISCOVERY" | jq '{issuer, authorization_endpoint, token_endpoint, introspection_endpoint}'
echo ""

echo "🎉 OAuth Client Flow Overview Complete!"
echo ""
echo "📋 Summary:"
echo "   • PKCE challenge generated (S256)"
echo "   • Authorization URL built with resource indicator"
echo "   • Token exchange flow documented"
echo "   • MCP request format shown"
echo ""
echo "🔗 To complete the flow manually:"
echo "   1. Copy the authorization URL above"
echo "   2. Open it in your browser"
echo "   3. Log in and grant consent"
echo "   4. Use the returned code to exchange for tokens"
echo ""
echo "💡 For automated testing, you would need:"
echo "   • A test user account in Auth-Agent"
echo "   • Automated browser interaction (Playwright/Puppeteer)"
echo "   • Or use the test mode if available"
echo ""
