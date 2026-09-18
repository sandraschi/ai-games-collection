# ai-games-collection — Agent Context

FastMCP fleet server: 150+ browser games + AI engines (Stockfish, KataGo, YaneuraOu, Edax,
GNU Backgammon, OpenSpiel, MoHex) + Japanese learning suite + Tauri 2.0 desktop app.

## Architecture

```
Docker stack (port 10987 gateway + 7 engine containers on games-net)
  ├── games collection (index.html + games/)      ← main "ai games collection", served by gateway
  ├── /mcp            FastMCP streamable HTTP (ai-games-collection-mcp/src/ai_games_collection_mcp)
  ├── /api/v1/*       REST (status, docker-up/down, start-engines, llm, skills)
  └── /mcp-dashboard  React control panel (web_sota, dev port 10986)
```

## Key entry points

- `web_sota/server.py` — FastAPI gateway (mounts FastMCP at /mcp, REST at /api/v1)
- `ai-games-collection-mcp/src/ai_games_collection_mcp/server.py` — FastMCP server, tool registration
- `web_sota/src/App.tsx` — React dashboard (help page tabs, docker banner)
- `run_server.py` — PyInstaller entry point (dual transport: MCP_PORT → HTTP, else stdio)
- `native/` — Tauri 2.0 wrapper (build.ps1 pipeline, NSIS)

## Ports (fleet registry)

| Port | Service |
|------|---------|
| 10986 | Dashboard frontend (Vite dev) |
| 10987 | Gateway (FastAPI + FastMCP + games collection) |
| 11211/11212/11213 | Stockfish / YaneuraOu / KataGo |
| 11214/11215/11216/11210 | Edax / GNU Backgammon / OpenSpiel / MoHex |

## Critical rules

- The dashboard/webapp MUST connect to the ai games collection in Docker on **10987** — `docker compose up -d`.
- Never commit `.env`, `native/resources/*.exe`, `native/binaries/*.exe`, `*.bak*`.
- Never hardcode ports — use fleet registry values or env vars.
- Never use `&&` in pwsh; no em dashes in .ps1/.bat/justfile.
- `src/` is gitignored legacy — active Python lives in `ai-games-collection-mcp/src/`.

