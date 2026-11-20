#!/usr/bin/env python3
import logging
import os
import sys

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

# Import the mcp instance from the server module
try:
    from ai_games_collection_mcp.mcp_server import mcp
except ImportError:
    # Fallback if package structure is different
    sys.path.append(os.path.join(os.path.dirname(__file__), "src", "ai_games_collection_mcp"))
    from mcp_server import mcp

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("games-bridge")

if __name__ == "__main__":
    logger.info("🚀 Starting AI Games Collection MCP SOTA Bridge on port 10741")
    logger.info("Transport: streamable-http")

    # We use streamable-http for stateless, resilient communication
    # Port 10741 as per SOTA standards (10740 is frontend)
    mcp.run(transport="streamable-http", host="127.0.0.1", port=10741)
