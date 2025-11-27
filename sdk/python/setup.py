"""
Auth-Agent MCP - Python SDK for MCP Servers
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="auth-agent-mcp",
    version="1.0.0",
    author="Auth-Agent Team",
    author_email="support@auth-agent.com",
    description="OAuth 2.1 authentication middleware for MCP servers",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/auth-agent/auth-agent-mcp",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: Security",
    ],
    python_requires=">=3.8",
    install_requires=[
        "httpx>=0.25.0",
        "fastapi>=0.104.0",
        "starlette>=0.27.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ],
    },
    keywords="oauth mcp authentication authorization middleware fastapi",
    project_urls={
        "Bug Reports": "https://github.com/auth-agent/auth-agent-mcp/issues",
        "Documentation": "https://docs.mcp.auth-agent.com",
        "Source": "https://github.com/auth-agent/auth-agent-mcp",
    },
)
