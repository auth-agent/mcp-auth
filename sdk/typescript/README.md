# @auth-agent/mcp-sdk

OAuth 2.1 middleware for MCP servers using Auth-Agent.

## Installation

```bash
npm install @auth-agent/mcp-sdk
```

## Quick Start (Hono)

```typescript
import { Hono } from 'hono';
import { authAgentMiddleware } from '@auth-agent/mcp-sdk';

const app = new Hono();

// Add Auth-Agent middleware
app.use('*', authAgentMiddleware({
  serverId: 'srv_abc123',        // Your MCP server ID
  apiKey: 'sk_xyz789',           // Your API key
  requiredScopes: ['files:read'] // Required OAuth scopes
}));

// Protected routes - user is automatically validated
app.get('/files', (c) => {
  const user = c.get('user');
  return c.json({
    message: `Hello ${user.email}`,
    scopes: user.scopes
  });
});

export default app;
```

## Configuration

### `AuthAgentConfig`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `serverId` | `string` | ✅ | - | Your MCP server ID from Auth-Agent |
| `apiKey` | `string` | ✅ | - | Your API key for token introspection |
| `requiredScopes` | `string[]` | ❌ | `[]` | Required OAuth scopes for protected routes |
| `authServerUrl` | `string` | ❌ | `'https://mcp.auth-agent.com'` | Auth-Agent server URL |
| `cacheTtl` | `number` | ❌ | `300` | Cache introspection results (seconds) |

## Advanced Usage

### Manual Token Validation

```typescript
import { AuthAgentClient } from '@auth-agent/mcp-sdk';

const client = new AuthAgentClient({
  serverId: 'srv_abc123',
  apiKey: 'sk_xyz789'
});

try {
  const user = await client.validateToken(accessToken);
  console.log(`User: ${user.email}, Scopes: ${user.scopes.join(', ')}`);
} catch (error) {
  console.error('Invalid token:', error);
}
```

### Scope-Based Authorization

```typescript
app.get('/files', authAgentMiddleware({
  serverId: 'srv_abc123',
  apiKey: 'sk_xyz789',
  requiredScopes: ['files:read']
}), (c) => {
  // Only users with 'files:read' scope can access this
  return c.json({ files: [...] });
});

app.post('/files', authAgentMiddleware({
  serverId: 'srv_abc123',
  apiKey: 'sk_xyz789',
  requiredScopes: ['files:write']
}), (c) => {
  // Only users with 'files:write' scope can access this
  return c.json({ success: true });
});
```

### Error Handling

The middleware automatically handles authentication errors:

- **401 Unauthorized** - Missing or invalid token
- **403 Forbidden** - Insufficient scopes
- **500 Internal Server Error** - Token validation failed

```typescript
import { AuthenticationError, AuthorizationError } from '@auth-agent/mcp-sdk';

try {
  const user = await client.validateToken(token);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof AuthorizationError) {
    console.error('Insufficient scopes:', error.requiredScopes);
  }
}
```

## Getting Server Credentials

1. Register your MCP server at Auth-Agent:
```bash
curl -X POST https://mcp.auth-agent.com/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "server_url": "https://your-mcp-server.com",
    "server_name": "My MCP Server",
    "scopes": ["files:read", "files:write"],
    "user_id": "your-user-id"
  }'
```

2. Generate an API key:
```bash
curl -X POST https://mcp.auth-agent.com/api/servers/srv_abc123/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key"
  }'
```

3. Use the returned `server_id` and `api_key` in your middleware config.

## How It Works

1. **Client Authorization**: MCP clients (Claude Code, install-mcp) redirect users to Auth-Agent for OAuth consent
2. **Token Issuance**: Auth-Agent issues access tokens with user identity and scopes
3. **Token Validation**: Your MCP server validates tokens via introspection endpoint
4. **Scope Enforcement**: Middleware checks if user has required scopes before granting access

## TypeScript Support

Full TypeScript support with type definitions included:

```typescript
import type { AuthUser, AuthAgentConfig } from '@auth-agent/mcp-sdk';

const config: AuthAgentConfig = {
  serverId: 'srv_abc123',
  apiKey: 'sk_xyz789',
  requiredScopes: ['files:read']
};

app.get('/user-info', (c) => {
  const user: AuthUser = c.get('user');
  return c.json(user);
});
```

## License

MIT
