"""
Auth-Agent client for manual token validation
"""

import httpx
from typing import Optional, Dict, Any


class AuthAgentClient:
    """
    Client for interacting with Auth-Agent MCP

    Example:
        client = AuthAgentClient(
            auth_server="https://mcp.auth-agent.com",
            api_key="sk_xyz789"
        )

        result = await client.introspect_token("eyJhbG...")
        if result["active"]:
            print(f"Token valid for user: {result['sub']}")
    """

    def __init__(
        self,
        auth_server: str = "https://mcp.auth-agent.com",
        api_key: Optional[str] = None,
    ):
        self.auth_server = auth_server.rstrip('/')
        self.api_key = api_key
        self.introspect_url = f"{self.auth_server}/introspect"
        self.revoke_url = f"{self.auth_server}/revoke"

    async def introspect_token(self, token: str) -> Dict[str, Any]:
        """
        Introspect an access token

        Args:
            token: The access token to validate

        Returns:
            Dict containing token info:
            {
                "active": bool,
                "sub": str,  # user email
                "client_id": str,
                "scope": str,
                "aud": str,  # audience/resource
                "exp": int,
                "iat": int
            }
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.introspect_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"token": token},
                timeout=5.0,
            )

            if response.status_code != 200:
                return {"active": False}

            return response.json()

    async def revoke_token(
        self,
        token: str,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ) -> bool:
        """
        Revoke an access or refresh token

        Args:
            token: The token to revoke
            client_id: OAuth client ID (optional)
            client_secret: OAuth client secret (optional)

        Returns:
            True if successful
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.revoke_url,
                json={
                    "token": token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                timeout=5.0,
            )

            return response.status_code == 200

    async def get_server_metadata(self, server_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get protected resource metadata

        Args:
            server_id: MCP server ID (optional, for server-specific metadata)

        Returns:
            Dict containing resource metadata
        """
        url = f"{self.auth_server}/.well-known/oauth-protected-resource"
        if server_id:
            url += f"/{server_id}"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            response.raise_for_status()
            return response.json()
