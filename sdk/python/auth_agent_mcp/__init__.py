"""
Auth-Agent MCP - Python SDK for MCP Servers

This package provides middleware and utilities for authenticating MCP servers
using Auth-Agent OAuth 2.1 authorization.
"""

from .middleware import AuthAgentMiddleware
from .client import AuthAgentClient

__version__ = "1.0.0"
__all__ = ["AuthAgentMiddleware", "AuthAgentClient"]
