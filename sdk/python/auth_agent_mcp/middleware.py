"""
FastAPI middleware for Auth-Agent MCP authentication
"""

import httpx
from typing import List, Optional
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class AuthAgentMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate Auth-Agent access tokens for MCP servers.

    Example:
        from fastapi import FastAPI
        from auth_agent_mcp import AuthAgentMiddleware

        app = FastAPI()
        app.add_middleware(
            AuthAgentMiddleware,
            auth_server="https://mcp.auth-agent.com",
            server_id="srv_abc123",
            api_key="sk_xyz789",
            required_scopes=["files:read"]
        )
    """

    def __init__(
        self,
        app,
        auth_server: str = "https://mcp.auth-agent.com",
        server_id: Optional[str] = None,
        api_key: Optional[str] = None,
        required_scopes: Optional[List[str]] = None,
        public_paths: Optional[List[str]] = None,
    ):
        super().__init__(app)
        self.auth_server = auth_server.rstrip('/')
        self.server_id = server_id
        self.api_key = api_key
        self.required_scopes = required_scopes or []
        self.public_paths = public_paths or ['/health', '/']
        self.introspect_url = f"{self.auth_server}/introspect"

    async def dispatch(self, request: Request, call_next):
        # Skip auth for public endpoints
        if request.url.path in self.public_paths:
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return self._unauthorized_response(request)

        token = auth_header[7:]  # Remove "Bearer "

        # Validate token with Auth-Agent
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.introspect_url,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"token": token},
                    timeout=5.0,
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Auth server unavailable: {str(e)}"
            )

        if response.status_code != 200:
            return self._unauthorized_response(request)

        token_data = response.json()

        if not token_data.get("active"):
            return self._unauthorized_response(request)

        # Check scopes
        granted_scopes = token_data.get("scope", "").split()
        missing_scopes = [s for s in self.required_scopes if s not in granted_scopes]

        if missing_scopes:
            return self._forbidden_response(request, self.required_scopes)

        # Inject user context into request state
        request.state.user_email = token_data.get("sub")
        request.state.scopes = granted_scopes
        request.state.client_id = token_data.get("client_id")
        request.state.audience = token_data.get("aud")

        response = await call_next(request)
        return response

    def _unauthorized_response(self, request: Request) -> JSONResponse:
        """Return 401 Unauthorized with WWW-Authenticate header."""
        www_authenticate = (
            f'Bearer realm="{self.server_id or "mcp-server"}"'
        )

        if self.server_id:
            www_authenticate += (
                f', resource_metadata="{self.auth_server}/.well-known/'
                f'oauth-protected-resource/{self.server_id}"'
            )

        return JSONResponse(
            status_code=401,
            content={"error": "unauthorized"},
            headers={"WWW-Authenticate": www_authenticate}
        )

    def _forbidden_response(
        self,
        request: Request,
        required_scopes: List[str]
    ) -> JSONResponse:
        """Return 403 Forbidden with insufficient_scope error."""
        www_authenticate = (
            f'Bearer error="insufficient_scope", '
            f'scope="{" ".join(required_scopes)}"'
        )

        if self.server_id:
            www_authenticate += (
                f', resource_metadata="{self.auth_server}/.well-known/'
                f'oauth-protected-resource/{self.server_id}"'
            )

        return JSONResponse(
            status_code=403,
            content={
                "error": "insufficient_scope",
                "required_scopes": required_scopes
            },
            headers={"WWW-Authenticate": www_authenticate}
        )
