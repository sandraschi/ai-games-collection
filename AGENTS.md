# ai-games-collection Agent Context

FastMCP 3.2 fleet server: 150+ browser games + AI engines + Japanese learning suite + Tauri 2.0 desktop app.

## Public funnel surface

The dashboard is exposed publicly at `/games/` on the fleet funnel
(https://goliath.tailfab45.ts.net/games/) via a path-strip proxy
(11158 -> backend 10987). The frontend therefore uses SAME-ORIGIN relative
API bases outside Tauri (`__TAURI_INTERNALS__` check in FloatingChat.tsx and
mcp_client.ts) - keep it that way; absolute 127.0.0.1 URLs break on the
funnel. Canonical funnel policy:
`mcp-central-docs/operations/TailscaleFunnel.md`.

## Environment

- Shell: pwsh (Windows). Always use native PowerShell, not cmd.
- Tools: `uv` for Python, `npm` for Node, `just` for recipes.
- Paths: Use absolute paths from ~/.claude/CLAUDE.md.

## Build & Test

```powershell
uv sync                        # Install Python deps
npx --prefix web_sota install  # Install JS deps
just serve                     # Start backend on 10987
just dev-web                   # Start frontend on 10986
just lint                      # Ruff check
just typecheck                 # TypeScript typecheck
uv run pytest tests/ -q        # Run tests
```

## FastMCP Standards

- **Version**: FastMCP 3.2+ (`fastmcp>=3.2.0`)
- **Server**: `ai-games-collection-mcp/src/ai_games_collection_mcp/server.py` — FastMCP instance registered at import time via `@mcp.tool()`
- **Gateway**: `web_sota/server.py` — FastAPI wraps FastMCP at `/mcp`, REST at `/api/v1/`
- **Portmanteau**: Use operation-based portmanteaus (one tool per domain, `operation` param)
- **Sampling**: Use `ctx.sample()` for agentic workflows (SEP-1577)
- **No stubs**: No mock/placeholder tool implementations
- **Multiplayer**: Shared sessions live in Firebase RTDB under `games/{game_id}` — browser
  games AND MCP tools (`list_shared_sessions`, `new_game`, `join_shared_session`) use the
  same nodes. Credentials in `ai-games-collection-mcp/.env`; status via `sync_manager.status()`.
  See `docs/MULTIPLAYER_STATUS.md`.

## Ports

| Service | Port |
|---------|------|
| Frontend (Vite) | 10986 |
| Backend (FastAPI + FastMCP) | 10987 |
| Stockfish (chess) | 11211 |
| YaneuraOu (shogi) | 11212 |
| KataGo (Go) | 11213 |
| Edax (Othello) | 11214 |
| GNU Backgammon | 11215 |
| OpenSpiel (119 games) | 11216 |
| MoHex (Hex) | 11210 |

## Webapp Stack

- React 19 + Vite 7 + TypeScript 5.9
- Vite proxy: /api, /mcp, /health -> 127.0.0.1:10987
- PWA with service worker, manifest, icons

## Key Files

| File | Purpose |
|------|---------|
| `web_sota/server.py` | FastAPI gateway |
| `ai-games-collection-mcp/src/ai_games_collection_mcp/server.py` | FastMCP server + tool registration |
| `ai-games-collection-mcp/src/ai_games_collection_mcp/services/sync_service.py` | Firebase sync (games/{id} nodes, status) |
| `games/shared/unified-multiplayer.js` | Browser unified multiplayer (WS + Firebase) |
| `docs/MULTIPLAYER_STATUS.md` | Multiplayer status + next steps |
| `web_sota/src/App.tsx` | React dashboard |
| `run_server.py` | PyInstaller entry point |
| `native/` | Tauri 2.0 desktop wrapper |
| `Dockerfile` | Gateway container |
| `docker-compose.yml` | Full stack compose |

## Critical Don'ts

- Never commit `native/resources/*.exe` or `native/binaries/*.exe`
- Never hardcode ports — use the port registry or env vars
- Never add emoji to files unless explicitly requested
- Never use `&&` in pwsh — use `;` or `if ($?) {}`

