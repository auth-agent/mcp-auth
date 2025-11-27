# Auth-Agent MCP - Python SDK

OAuth 2.1 authentication middleware for MCP servers using FastAPI.

## Installation

```bash
pip install auth-agent-mcp
```

## Quick Start

```python
from fastapi import FastAPI, Request
from auth_agent_mcp import AuthAgentMiddleware
import os

app = FastAPI()

# Add Auth-Agent authentication
app.add_middleware(
    AuthAgentMiddleware,
    auth_server=os.getenv("AUTH_SERVER", "https://mcp.auth-agent.com"),
    server_id=os.getenv("SERVER_ID"),
    api_key=os.getenv("API_KEY"),
    required_scopes=["files:read"],
)

@app.get("/files")
async def list_files(request: Request):
    # User context injected by middleware
    user_email = request.state.user_email
    scopes = request.state.scopes

    return {
        "user": user_email,
        "files": ["document.txt", "image.png"]
    }
```

## Configuration

### Environment Variables

```bash
AUTH_SERVER=https://mcp.auth-agent.com
SERVER_ID=srv_abc123
API_KEY=sk_xyz789
```

### Middleware Parameters

- `auth_server` (str): Auth-Agent server URL (default: https://mcp.auth-agent.com)
- `server_id` (str): Your MCP server ID from registration
- `api_key` (str): API key for token validation
- `required_scopes` (List[str]): Scopes required for all endpoints
- `public_paths` (List[str]): Paths that don't require authentication

## Manual Token Validation

```python
from auth_agent_mcp import AuthAgentClient

client = AuthAgentClient(
    auth_server="https://mcp.auth-agent.com",
    api_key="sk_xyz789"
)

# Introspect token
result = await client.introspect_token("eyJhbG...")
if result["active"]:
    print(f"Valid token for user: {result['sub']}")
    print(f"Scopes: {result['scope']}")
    print(f"Audience: {result['aud']}")

# Revoke token
await client.revoke_token("eyJhbG...")
```

## License

MIT
