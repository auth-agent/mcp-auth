# Getting Started with Auth-Agent MCP

Complete guide to deploying and using Auth-Agent MCP for your MCP servers.

## Overview

Auth-Agent MCP provides OAuth 2.1 authorization for MCP (Model Context Protocol) servers. Instead of implementing OAuth yourself, you can add 3 lines of code and have production-grade authentication.

## For MCP Server Owners

### Step 1: Register Your MCP Server

**Option A: Via Web Console (Coming Soon)**
Visit https://console.auth-agent.com

**Option B: Via API**
```bash
curl -X POST https://mcp.auth-agent.com/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "server_url": "https://your-mcp-server.com",
    "server_name": "My MCP Server",
    "description": "Provides awesome functionality",
    "scopes": ["files:read", "files:write", "search"],
    "user_id": "your_user_id_here"
  }'
```

Response:
```json
{
  "server_id": "srv_abc123",
  "server_url": "https://your-mcp-server.com",
  "server_name": "My MCP Server",
  "created_at": "2025-01-26T..."
}
```

### Step 2: Generate API Key

```bash
curl -X POST https://mcp.auth-agent.com/api/servers/srv_abc123/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "expires_in": 31536000
  }'
```

Response (save the `key_secret` - shown only once!):
```json
{
  "key_id": "sk_xyz789",
  "key_secret": "sk_very_long_secret_string_here",
  "name": "Production Key",
  "expires_at": "2026-01-26T..."
}
```

### Step 3: Install SDK

**Python:**
```bash
pip install auth-agent-mcp
```

**TypeScript (Coming Soon):**
```bash
npm install @auth-agent/mcp-server
```

### Step 4: Add Middleware

**Python (FastAPI):**
```python
from fastapi import FastAPI
from auth_agent_mcp import AuthAgentMiddleware
import os

app = FastAPI()

app.add_middleware(
    AuthAgentMiddleware,
    auth_server="https://mcp.auth-agent.com",
    server_id=os.getenv("SERVER_ID"),
    api_key=os.getenv("API_KEY"),
    required_scopes=["files:read"]
)

@app.get("/files")
async def list_files(request):
    user_email = request.state.user_email
    scopes = request.state.scopes
    return {"files": [...]}
```

**Environment Variables:**
```bash
export SERVER_ID=srv_abc123
export API_KEY=sk_xyz789
```

### Step 5: Deploy!

That's it! Your MCP server now has OAuth 2.1 authentication.

## For MCP Client Users

### Using install-mcp

```bash
npx install-mcp https://your-mcp-server.com --client claude
```

The CLI will:
1. Detect Auth-Agent via RFC 9728 discovery
2. Open your browser for OAuth consent
3. Request the scopes needed
4. Store tokens securely

### Using Claude Code

```bash
claude-code connect https://your-mcp-server.com
```

Claude Code will automatically discover Auth-Agent and handle the OAuth flow.

## Architecture

```
┌─────────────────┐
│   MCP Client    │
│  (Claude Code)  │
└────────┬────────┘
         │ 1. GET /files (no token)
         ▼
┌─────────────────┐
│   MCP Server    │
│  (Your Server)  │
└────────┬────────┘
         │ 2. 401 + WWW-Authenticate header
         │    (points to Auth-Agent)
         ▼
┌─────────────────┐
│  Auth-Agent MCP │
│  Authorization  │
│     Server      │
└────────┬────────┘
         │ 3. OAuth flow (user consent)
         │ 4. Returns access token
         ▼
┌─────────────────┐
│   MCP Client    │
│  (has token)    │
└────────┬────────┘
         │ 5. GET /files + Authorization header
         ▼
┌─────────────────┐
│   MCP Server    │
│  (validates     │
│   with Auth-    │
│   Agent)        │
└────────┬────────┘
         │ 6. /introspect (token validation)
         ▼
┌─────────────────┐
│  Auth-Agent MCP │
└────────┬────────┘
         │ 7. {active: true, scope: "..."}
         ▼
┌─────────────────┐
│   MCP Server    │
│  Returns data   │
└─────────────────┘
```

## OAuth Flow Details

### 1. Discovery (RFC 9728)

MCP Client requests a protected resource:
```
GET /files HTTP/1.1
Host: your-mcp-server.com
```

MCP Server responds with 401:
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="srv_abc123",
                         resource_metadata="https://mcp.auth-agent.com/.well-known/oauth-protected-resource/srv_abc123"
```

Client fetches metadata:
```
GET /.well-known/oauth-protected-resource/srv_abc123
Host: mcp.auth-agent.com
```

Response:
```json
{
  "resource": "https://your-mcp-server.com",
  "authorization_servers": ["https://mcp.auth-agent.com"],
  "scopes_supported": ["files:read", "files:write"],
  "bearer_methods_supported": ["header"]
}
```

### 2. Authorization (OAuth 2.1 + PKCE)

Client redirects user to:
```
https://mcp.auth-agent.com/authorize?
  client_id=client_claude_code&
  redirect_uri=http://localhost:3000/callback&
  response_type=code&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  state=random_state&
  scope=files:read&
  resource=https://your-mcp-server.com
```

User approves scopes, Auth-Agent redirects back:
```
http://localhost:3000/callback?
  code=ac_authorization_code&
  state=random_state
```

### 3. Token Exchange

Client exchanges code for tokens:
```
POST /token
Host: mcp.auth-agent.com

{
  "grant_type": "authorization_code",
  "code": "ac_authorization_code",
  "code_verifier": "original_verifier",
  "client_id": "client_claude_code",
  "redirect_uri": "http://localhost:3000/callback",
  "resource": "https://your-mcp-server.com"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_...",
  "scope": "files:read"
}
```

JWT payload (decoded):
```json
{
  "sub": "user@example.com",
  "client_id": "client_claude_code",
  "scope": "files:read",
  "aud": "https://your-mcp-server.com",
  "iss": "https://mcp.auth-agent.com",
  "exp": 1234567890,
  "iat": 1234564290
}
```

### 4. Resource Request

Client makes authenticated request:
```
GET /files HTTP/1.1
Host: your-mcp-server.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

MCP Server validates token:
```
POST /introspect
Host: mcp.auth-agent.com
Authorization: Bearer sk_xyz789

{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response:
```json
{
  "active": true,
  "sub": "user@example.com",
  "client_id": "client_claude_code",
  "scope": "files:read",
  "aud": "https://your-mcp-server.com",
  "exp": 1234567890
}
```

MCP Server returns data:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "files": [...]
}
```

## Scope Management

### Defining Scopes

When registering your MCP server, define granular scopes:

```json
{
  "scopes": [
    "files:read",      // Read files
    "files:write",     // Create/modify files
    "files:delete",    // Delete files
    "db:read",         // Read database
    "db:write",        // Write database
    "admin:all"        // Admin access
  ]
}
```

### Enforcing Scopes

**Global (via middleware):**
```python
app.add_middleware(
    AuthAgentMiddleware,
    required_scopes=["files:read"]  // All endpoints require this
)
```

**Per-endpoint:**
```python
@app.post("/files")
async def create_file(request: Request):
    if "files:write" not in request.state.scopes:
        raise HTTPException(
            status_code=403,
            detail="Insufficient scope",
            headers={
                "WWW-Authenticate": 'Bearer error="insufficient_scope", scope="files:write"'
            }
        )
```

### Step-Up Authorization

When client lacks required scope, server returns 403:

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
                         scope="files:write",
                         resource_metadata="https://mcp.auth-agent.com/.well-known/oauth-protected-resource/srv_abc123"
```

Client requests additional scopes via new OAuth flow.

## Security Best Practices

1. **Use HTTPS** - Always deploy over TLS
2. **Validate Audience** - Middleware automatically validates `aud` claim
3. **Rotate Keys** - Regenerate API keys periodically
4. **Monitor Usage** - Track failed auth attempts
5. **Least Privilege** - Only request scopes you need

## Troubleshooting

### 401 Unauthorized

**Problem:** Token not accepted

**Solutions:**
- Check API key is correct
- Verify token hasn't expired
- Ensure token `aud` matches your server URL

### 403 Forbidden (insufficient_scope)

**Problem:** User lacks required scope

**Solutions:**
- Request additional scopes in authorization
- Update scope requirements in middleware
- Implement step-up authorization

### 503 Service Unavailable

**Problem:** Can't reach Auth-Agent

**Solutions:**
- Check Auth-Agent is up: https://mcp.auth-agent.com/health
- Verify network connectivity
- Check firewall rules

## Next Steps

- See [examples/](./examples/) for complete server implementations
- Read [MCP Authorization Spec](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- Join Discord: https://discord.gg/auth-agent
- Report issues: https://github.com/auth-agent/auth-agent-mcp/issues
