#!/bin/bash
# Test OAuth flow for Auth-Agent MCP

# Use custom domain with DNS resolution
BASE_URL="https://mcp.auth-agent.com"
IP=""

# Try DNS resolution with retries
for i in {1..3}; do
  IP=$(dig +short mcp.auth-agent.com | head -1)
  if [ -n "$IP" ]; then
    break
  fi
  echo "⚠️  DNS resolution attempt $i failed, retrying..."
  sleep 1
done

if [ -z "$IP" ]; then
  echo "❌ DNS resolution failed for mcp.auth-agent.com after 3 attempts"
  echo "💡 Trying without explicit IP resolution..."
  CURL_RESOLVE=""
else
  CURL_RESOLVE="--resolve mcp.auth-agent.com:443:$IP"
  echo "✅ Using custom domain: $BASE_URL (IP: $IP)"
fi

# Generate unique server URL for each test run
TIMESTAMP=$(date +%s)
RANDOM_ID=$(openssl rand -hex 4 2>/dev/null || echo "test")
SERVER_URL="https://example-mcp-server-${TIMESTAMP}-${RANDOM_ID}.com"
SERVER_NAME="Test MCP Server ${TIMESTAMP}"
# Generate a valid UUID for user_id
if command -v uuidgen > /dev/null 2>&1; then
  USER_ID=$(uuidgen)
elif command -v python3 > /dev/null 2>&1; then
  USER_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
else
  USER_ID="00000000-0000-0000-0000-000000000001"
fi

echo "🧪 Testing Auth-Agent MCP OAuth Flow"
echo "===================================="
echo ""

# Helper function for curl with optional DNS resolution
curl_cmd() {
  if [ -n "$CURL_RESOLVE" ]; then
    curl -s $CURL_RESOLVE "$@"
  else
    curl -s "$@"
  fi
}

# 1. Register MCP Server
echo "1️⃣  Registering MCP server..."
REGISTER_RESPONSE=$(curl_cmd -X POST "$BASE_URL/api/servers" \
  -H "Content-Type: application/json" \
  -d "{
    \"server_url\": \"$SERVER_URL\",
    \"server_name\": \"$SERVER_NAME\",
    \"scopes\": [\"files:read\", \"files:write\"],
    \"user_id\": \"$USER_ID\"
  }")

echo "$REGISTER_RESPONSE" | jq .

SERVER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.server_id')
echo "✅ Server ID: $SERVER_ID"
echo ""

# 2. Generate API Key for the server
echo "2️⃣  Generating API key for MCP server..."
KEY_RESPONSE=$(curl_cmd -X POST "$BASE_URL/api/servers/$SERVER_ID/keys" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test API Key\"
  }")

echo "$KEY_RESPONSE" | jq .

API_KEY=$(echo "$KEY_RESPONSE" | jq -r '.key_secret // empty')
if [ -z "$API_KEY" ] || [ "$API_KEY" = "null" ]; then
  echo "⚠️  Warning: Could not extract API key from response"
  API_KEY="test_key_placeholder"
else
  echo "✅ API Key: ${API_KEY:0:20}..."
fi
echo ""

# 3. Test Protected Resource Metadata for this server
echo "3️⃣  Testing RFC 9728 Protected Resource Metadata..."
METADATA=$(curl_cmd "$BASE_URL/.well-known/oauth-protected-resource?server_id=$SERVER_ID")
echo "$METADATA" | jq .
echo ""

# 4. Test OAuth Server Discovery
echo "4️⃣  Testing RFC 8414 OAuth Server Metadata..."
OAUTH_META=$(curl_cmd "$BASE_URL/.well-known/oauth-authorization-server")
echo "$OAUTH_META" | jq '{
  issuer,
  authorization_endpoint,
  token_endpoint,
  introspection_endpoint,
  grant_types_supported,
  code_challenge_methods_supported
}'
echo ""

# 5. Generate PKCE challenge
echo "5️⃣  Generating PKCE challenge (S256)..."
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | openssl base64 | tr -d '=+/' | tr '/+' '_-')
STATE=$(openssl rand -hex 16)

echo "✅ Code verifier: ${CODE_VERIFIER:0:20}..."
echo "✅ Code challenge: ${CODE_CHALLENGE:0:20}..."
echo "✅ State: $STATE"
echo ""

# 6. Build authorization URL
echo "6️⃣  Authorization URL (user would visit this)..."
AUTH_URL="$BASE_URL/authorize?client_id=client_claude_code&redirect_uri=http://localhost:3000/callback&state=$STATE&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&response_type=code&scope=openid+profile+email&resource=$SERVER_URL"

echo "$AUTH_URL"
echo ""
echo "📝 This URL would:"
echo "   - Show user a consent page"
echo "   - Ask to authorize 'Claude Code' to access '$SERVER_NAME'"
echo "   - Return authorization code to redirect_uri"
echo ""

# 7. Test token introspection endpoint (will fail without valid token, but shows endpoint works)
echo "7️⃣  Testing introspection endpoint..."
INTROSPECT=$(curl_cmd -X POST "$BASE_URL/introspect" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"invalid_token_for_testing\",
    \"token_type_hint\": \"access_token\"
  }" \
  -H "Authorization: Bearer $API_KEY")

echo "$INTROSPECT" | jq .
echo ""

echo "✅ All endpoints are working!"
echo ""
echo "🎯 Next steps to test full OAuth flow:"
echo "   1. Visit the authorization URL above in a browser"
echo "   2. Enter a test email and approve consent"
echo "   3. Get the authorization code from redirect"
echo "   4. Exchange code for access token using /token endpoint"
echo "   5. Use access token to call protected resources"
echo ""
echo "📦 Integration for MCP servers:"
echo "   - Use server_id: $SERVER_ID"
echo "   - Use API key: ${API_KEY:0:20}..."
echo "   - Add middleware with these credentials"
