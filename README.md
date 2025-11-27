<div align="center">

![Auth Agent Logo](logo/AA.png)

# MCP-Auth - OAuth 2.1 for MCP Servers

**OAuth 2.1 authorization server for Model Context Protocol (MCP) servers**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/auth-agent-mcp-sdk)](https://www.npmjs.com/package/auth-agent-mcp-sdk)
[![PyPI](https://img.shields.io/pypi/v/auth-agent-mcp)](https://pypi.org/project/auth-agent-mcp/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Auth-Agent MCP enables MCP servers to authenticate users via OAuth 2.1 without building their own authorization infrastructure. MCP clients (Claude Code, install-mcp) get user consent, and servers validate tokens through token introspection.

</div>

---

## ✨ Features

- **🔐 OAuth 2.1 Compliant** - Full implementation with PKCE (S256) required
- **🎫 RFC 8707 Support** - Resource Indicators for audience-bound tokens
- **🔍 Token Introspection** - RFC 7662 compliant validation
- **🗑️ Token Revocation** - RFC 7009 compliant revocation
- **📋 Server Discovery** - RFC 9728 Protected Resource Metadata
- **🌐 Edge Deployment** - Cloudflare Workers + Supabase PostgreSQL
- **📦 3-Line Integration** - TypeScript & Python SDKs
- **🔄 Shared Database** - Integrates with existing Auth-Agent infrastructure

## 🚀 Quick Start

### For MCP Server Owners

Add OAuth 2.1 authentication to your MCP server in 3 steps:

#### 1. Register Your MCP Server

```bash
curl -X POST https://mcp.auth-agent.com/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "server_url": "https://your-mcp-server.com",
    "server_name": "My File Server",
    "scopes": ["files:read", "files:write"],
    "user_id": "your-user-uuid"
  }'
```

**Response:**
```json
{
  "server_id": "srv_abc123",
  "server_url": "https://your-mcp-server.com",
  "scopes": ["files:read", "files:write"],
  "created_at": "2025-01-27T12:00:00Z"
}
```

#### 2. Generate API Key

```bash
curl -X POST https://mcp.auth-agent.com/api/servers/srv_abc123/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Key"}'
```

**Response:**
```json
{
  "key_id": "sk_xyz789",
  "key_secret": "sk_YyVw88ohaxO1yR3IC3eBxUNOA71lDjOL",
  "name": "Production Key"
}
```

#### 3. Add Middleware (3 Lines of Code!)

**Python (FastAPI):**
```bash
pip install auth-agent-mcp
```

```python
from fastapi import FastAPI
from auth_agent_mcp import AuthAgentMiddleware

app = FastAPI()

# Add Auth-Agent OAuth middleware
app.add_middleware(
    AuthAgentMiddleware,
    server_id="srv_abc123",
    api_key="sk_xyz789",
    required_scopes=["files:read"]
)

@app.get("/api/files")
async def list_files(request: Request):
    # User is automatically validated!
    user = request.state.user
    return {"files": [...], "user_email": user.email}
```

**TypeScript (Hono):**
```bash
npm install auth-agent-mcp-sdk
```

```typescript
import { Hono } from 'hono';
import { authAgentMiddleware } from 'auth-agent-mcp-sdk';

const app = new Hono();

// Add Auth-Agent OAuth middleware
app.use('*', authAgentMiddleware({
  serverId: 'srv_abc123',
  apiKey: 'sk_xyz789',
  requiredScopes: ['files:read']
}));

app.get('/api/files', (c) => {
  // User is automatically validated!
  const user = c.get('user');
  return c.json({ files: [...], user_email: user.email });
});
```

**That's it!** Your MCP server now validates OAuth 2.1 tokens automatically.

---

### For MCP Clients (Claude Code, install-mcp)

MCP clients can discover and authenticate with MCP servers using standard OAuth 2.1:

#### 1. Discover OAuth Endpoints

```bash
curl https://mcp.auth-agent.com/.well-known/oauth-authorization-server
```

**Response:**
```json
{
  "issuer": "https://mcp.auth-agent.com",
  "authorization_endpoint": "https://mcp.auth-agent.com/authorize",
  "token_endpoint": "https://mcp.auth-agent.com/token",
  "introspection_endpoint": "https://mcp.auth-agent.com/introspect",
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"]
}
```

#### 2. Start OAuth Flow with PKCE

```
https://mcp.auth-agent.com/authorize?
  client_id=client_claude_code
  &redirect_uri=http://localhost:3000/callback
  &code_challenge=PKCE_CHALLENGE_S256
  &code_challenge_method=S256
  &response_type=code
  &scope=files:read+files:write
  &resource=https://target-mcp-server.com
```

#### 3. Exchange Code for Token

```bash
curl -X POST https://mcp.auth-agent.com/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "code_abc123",
    "code_verifier": "PKCE_VERIFIER",
    "redirect_uri": "http://localhost:3000/callback",
    "client_id": "client_claude_code"
  }'
```

#### 4. Use Access Token

```bash
curl https://your-mcp-server.com/api/files \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🔄 How It Works

```mermaid
sequenceDiagram
    participant Client as MCP Client<br/>(Claude Code)
    participant AuthServer as Auth-Agent MCP<br/>(mcp.auth-agent.com)
    participant User as User
    participant Server as MCP Server<br/>(Your Server)

    Client->>AuthServer: 1. Start OAuth flow<br/>(PKCE challenge)
    AuthServer->>User: 2. Show consent page
    User->>AuthServer: 3. Approve access
    AuthServer->>Client: 4. Return auth code
    Client->>AuthServer: 5. Exchange code for token<br/>(PKCE verification)
    AuthServer->>Client: 6. Return access token
    Client->>Server: 7. Call API with token
    Server->>AuthServer: 8. Validate token (introspection)
    AuthServer->>Server: 9. Token valid + user info
    Server->>Client: 10. Return protected data
```

**Key Benefits:**
- ✅ Users control which MCP servers get access
- ✅ Servers validate without managing OAuth themselves
- ✅ Tokens are audience-bound (RFC 8707) - can't be reused across servers
- ✅ Standard OAuth 2.1 - works with any compliant client

---

## 🛠️ Tech Stack

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Edge serverless OAuth server
- **[Supabase](https://supabase.com/)** - PostgreSQL database (shared with Auth-Agent)
- **[Hono](https://hono.dev/)** - Fast web framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[JWT (jose)](https://github.com/panva/jose)** - JSON Web Tokens
- **[FastAPI](https://fastapi.tiangolo.com/)** - Python middleware
- **PBKDF2** - Secret hashing
- **SHA-256** - PKCE challenge hashing

---

## 📦 SDK Installation

### TypeScript/JavaScript

```bash
npm install auth-agent-mcp-sdk
```

**Usage with Hono:**
```typescript
import { authAgentMiddleware } from 'auth-agent-mcp-sdk';

app.use('*', authAgentMiddleware({
  serverId: 'srv_abc123',
  apiKey: 'sk_xyz789',
  requiredScopes: ['files:read']
}));
```

### Python

```bash
pip install auth-agent-mcp
```

**Usage with FastAPI:**
```python
from auth_agent_mcp import AuthAgentMiddleware

app.add_middleware(
    AuthAgentMiddleware,
    server_id="srv_abc123",
    api_key="sk_xyz789",
    required_scopes=["files:read"]
)
```

---

## 🔌 API Endpoints

### OAuth Endpoints

- `GET /.well-known/oauth-authorization-server` - OAuth server metadata (RFC 8414)
- `GET /.well-known/oauth-protected-resource` - MCP server metadata (RFC 9728)
- `GET /authorize` - Authorization endpoint (user consent)
- `POST /token` - Token endpoint (exchange code, refresh tokens)
- `POST /introspect` - Token validation (RFC 7662)
- `POST /revoke` - Token revocation (RFC 7009)
- `GET /userinfo` - User information endpoint

### MCP Server Management

- `POST /api/servers` - Register MCP server
- `GET /api/servers/:id` - Get server details
- `POST /api/servers/:id/keys` - Generate API key
- `DELETE /api/servers/:id/keys/:keyId` - Revoke API key

---

## 📚 Examples

### Python FastAPI Example

See [examples/filesystem-server](./examples/filesystem-server) for a complete working example with scope-based access control.

### TypeScript Hono Example

See [examples/typescript-server](./examples/typescript-server) for a complete working example with TypeScript.

---

## 🔒 Security Features

- **PKCE Required** - All authorization flows use PKCE (S256)
- **Audience Binding** - RFC 8707 prevents token reuse across servers
- **Secret Hashing** - PBKDF2 with 100k iterations
- **Token Expiration** - Access tokens expire in 1 hour
- **Refresh Tokens** - Long-lived sessions with rotation
- **HTTPS Required** - All redirect URIs must use HTTPS (except localhost)

---

## 🌟 What Makes This Different?

**Traditional OAuth for web apps** requires MCP servers to:
- Build authorization UI
- Manage user accounts
- Store passwords
- Handle consent flows
- Implement token storage

**Auth-Agent MCP** lets servers:
- ✅ Add 3 lines of middleware
- ✅ Validate tokens via introspection
- ✅ Focus on business logic
- ✅ Users control access centrally

---

## 🤝 Integration with Auth-Agent

Auth-Agent MCP shares the same Supabase database with [Auth-Agent](https://auth-agent.com) (OAuth for web agents). This means:

- **Unified authentication** - One system for web agents AND MCP servers
- **Shared user accounts** - Same user credentials across both systems
- **Consistent experience** - Same OAuth flow patterns
- **Reduced infrastructure** - One database, one deployment

**Auth-Agent:** OAuth for web automation agents (browser-use, Comet)
**Auth-Agent MCP:** OAuth for MCP servers (Claude Code, install-mcp)

---

## 📁 Project Structure

```
Auth-Agent-MCP/
├── workers/                # Cloudflare Workers OAuth server
│   ├── src/
│   │   ├── routes/        # OAuth endpoints
│   │   ├── lib/           # Crypto, JWT, DB utilities
│   │   └── types/         # TypeScript definitions
│   └── wrangler.toml      # Cloudflare config
├── sdk/
│   ├── python/            # Python SDK (FastAPI)
│   └── typescript/        # TypeScript SDK (Hono)
├── examples/
│   ├── filesystem-server/ # Python FastAPI example
│   └── typescript-server/ # TypeScript Hono example
├── supabase/
│   └── migration-add-mcp.sql  # Database schema
└── test-oauth-flow.sh     # End-to-end test script
```

---

## 🧪 Testing

Run the complete OAuth flow test:

```bash
cd Auth-Agent-MCP
./test-oauth-flow.sh
```

This will:
1. Register a test MCP server
2. Generate an API key
3. Test OAuth discovery endpoints
4. Generate PKCE challenge
5. Create authorization URL
6. Test introspection endpoint

---

## 🔗 Links

- **OAuth Server:** https://mcp.auth-agent.com
- **npm Package:** https://www.npmjs.com/package/auth-agent-mcp-sdk
- **PyPI Package:** https://pypi.org/project/auth-agent-mcp/
- **Auth-Agent Website:** https://auth-agent.com
- **Main Repository:** https://github.com/auth-agent/auth-agent

---

## 📄 License

MIT

---

<div align="center">

**Built with ❤️ by Het Patel**

Part of the Auth-Agent ecosystem - standardizing authentication for AI agents and MCP servers.

[Auth-Agent](https://auth-agent.com) | [Documentation](https://docs.auth-agent.com) | [GitHub](https://github.com/auth-agent/auth-agent)

</div>
