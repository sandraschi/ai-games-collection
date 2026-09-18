# Games Collection — Status

**Last updated:** 2026-07-03
**Version:** 2.6.0

---

## Project Health

| Category | Status |
|----------|--------|
| Game collection | 150+ browser games across 12 categories |
| AI Engines | 7 engines — all operational (Docker + naked-PC) |
| MCP Server | 14 tools, FastMCP 3.2, streamable HTTP |
| Webapp (Vite) | React dashboard, PWA |
| Desktop | Tauri 2.0, PyInstaller backend, NSIS installer |
| Docker Compose | Full stack — gateway + 7 engine containers |
| Tests | Playwright e2e + Python pytest |

---

## Game AI Engines

All 7 engines are operational and containerized:

| Engine | Game | Port | Working |
|--------|------|------|---------|
| Stockfish 16 | Chess | 11211 | Yes (Docker + native) |
| YaneuraOu 9.40 | Shogi | 11212 | Yes (Docker + native) |
| KataGo 1.16.5 | Go | 11213 | Yes (Docker + native) |
| Edax 4.6 | Othello/Reversi | 11214 | Yes (Docker) |
| GNU Backgammon 1.08 | Backgammon | 11215 | Yes (Docker) |
| OpenSpiel 1.6.15 | 119 games | 11216 | Yes (Docker) |
| MoHex (Fuego+Benzene) | Hex | 11210 | Yes (Docker) |

---

## Ports

| Service | Port |
|---------|------|
| Frontend (Vite) | 10986 |
| Gateway (FastAPI + FastMCP) | 10987 |
| Stockfish | 11211 |
| YaneuraOu (Shogi) | 11212 |
| KataGo (Go) | 11213 |
| Edax (Othello) | 11214 |
| GNU Backgammon | 11215 |
| OpenSpiel | 11216 |
| MoHex (Hex) | 11210 |

---

## Known Issues

- MoHex container build time is ~15 minutes (Fuego + Benzene compiled from source).
- KataGo Docker uses OpenCL CPU-only — GPU passthrough is WIP.
- YaneuraOu Docker uses ORT-CPU (weaker than native Windows GPU build).

