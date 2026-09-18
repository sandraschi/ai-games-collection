import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the ai-games-collection-mcp directory (convention: ai-games-collection-mcp/.env), falling
# back to the repo root — NOT just CWD, which depends on where the server starts.
_load_env_candidates = [
    Path(__file__).resolve().parents[2] / ".env",  # ai-games-collection-mcp/.env
    Path(__file__).resolve().parents[3] / ".env",  # repo-root/.env
]
for _candidate in _load_env_candidates:
    if _candidate.is_file():
        load_dotenv(_candidate)
        break

# Engine URLs (external) — registry ports 11211-11213 (native start.ps1 == Docker mode)
STOCKFISH_URL = os.environ.get("STOCKFISH_URL", "http://localhost:11211")
SHOGI_URL = os.environ.get("SHOGI_URL", "http://localhost:11212")
GO_URL = os.environ.get("GO_URL", "http://localhost:11213")

# New game engines (added 2026-07-02)
EDAX_URL = os.environ.get("EDAX_URL", "http://localhost:11214")
GNUBG_URL = os.environ.get("GNUBG_URL", "http://localhost:11215")
OPENSPIEL_URL = os.environ.get("OPENSPIEL_URL", "http://localhost:11216")
MOHEX_URL = os.environ.get("MOHEX_URL", "http://localhost:11210")

# Firebase Config
FIREBASE_SERVICE_ACCOUNT_JSON = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
FIREBASE_DATABASE_URL = os.environ.get("FIREBASE_DATABASE_URL")

# Logging
LOG_LEVEL = os.environ.get("AI_GAMES_COLLECTION_MCP_LOG_LEVEL", "INFO").upper()

