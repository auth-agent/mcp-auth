#!/bin/bash

# Generate PKCE (proper base64url encoding)
CODE_VERIFIER=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr '+/' '-_' | tr -d '=')
STATE=$(openssl rand -hex 16)

echo "Testing authorization page..."
echo ""

# Test the authorization endpoint
AUTH_URL="https://mcp.auth-agent.com/authorize?client_id=client_claude_code&redirect_uri=http://localhost:3000/callback&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256&response_type=code&scope=premiere:edit+premiere:read&resource=https://test-adobe-premiere.example.com&state=${STATE}"

echo "Authorization URL:"
echo "$AUTH_URL"
echo ""
echo "Testing response..."
curl -s "$AUTH_URL" | head -c 1000
