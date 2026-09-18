# CHANGELOG_LATEST.md — ai-games-collection

## [Unreleased]

### Added
- **UNO** — color-matching card game vs AI (2-4 players, full action cards, UNO call penalty, match scoring to 500). `games/card-games/uno.html` + `uno.js`; registered in `games/shared/dashboard.js` and `index.html` Card Games section.
- **UNO education page** — History, Rules, Strategy, and Variants tabs at `games/card-games/uno-education.html`; linked via Learn & Rules button on the game page.

### Changed
- **Tarock rebuilt** — was a generic trick game wearing a Tarock skin (wrong 54-card deck, fake talon, string-compared Roman numerals, `tricks*10` scoring); now faithful 2-player **Zwanzigerrufen**: 40-card deck (20 tarocks I/IV-XXI + Sküs, suits K-Q-R-B-Glatze), all 40 dealt (20 each), Farbzwang + Trumpfzwang without Stichzwang, correct 88-point card values with 45 to win, real bidding (Rufer/Farbensolo/Solo with overbid rules), premiums (Trull, 4 Könige, Mondfang, Pagat Ultimo silent/declared, Absolut, Valat), Solo doubles premiums, Vorhand rotation, match to ±10. `games/card-games/tarock.js` + `tarock.html` (back button, legal-move highlighting, bid/declare panels).
- **Tarock education page** — rewritten to match the real game (was documenting the invented talon/54-card rules).

### Fixed
- **3D Jenga instant-crash on start** — `createBlock` pushed each mesh into `blocks` twice while pushing the physics body once, so the per-frame mesh↔body sync snapped every block to the *wrong* body's position (scrambled tower, double tower overlap, z-fighting); and `startGame` built the tower twice (`buildTower()` + `newGame()`). Removed the duplicate push and the redundant build — tower now builds once with 54/54 correctly aligned blocks.
- **OpenSpiel never worked** — the engine (a declared `open-spiel` dependency) was never started natively; the Docker-only path was dead. `start.ps1` now auto-starts `engines/open_spiel_server.py` on 11216 like the other engines; also repaired a corrupted `aiohttp` install (missing `_websocket/helpers.py`) that crashed the engine at import.
- **OpenSpiel UI crashed on every game** — `Object.keys(gameParams)` threw on `null` for the 100+ games without parameters; guarded in all three call sites. OpenSpiel now plays end-to-end (107 games, MCTS vs human).
- **Broken games-page links/functions** (audit pass): hiragana-katakana Knowledge Tree link 404; multiplayer page never loaded `unified-multiplayer.js`/`multiplayer.js` (ReferenceError on `new UnifiedMultiplayer()`); shogi-education loaded the wrong root JS (dead tab/viewer buttons, 404 data paths now `/data/shogi/...`); Risk attack/fortify buttons called undefined `attack()`/`fortify()`; td-chess "Revert Timeline" button had no implementation (removed); chess debug buttons called undefined `testAIConnection()`/`testAPIConnection()` (wired to `initializeAI()`); Japanese grammar free-text check buttons had no implementation (implemented `checkConstruction()`/`checkCorrection()`).
- **Dead-code sweep** (games audit, part 2): kanji-table page now loads the full implementation (`japanese-language/kanji-table.js`, offline fallback built in) instead of the sample-data stub; removed dead `multiplayerUrl`/`multiplayerWsUrl` getters and the 11876 legacy branch from `api-config.js`; index links Jenga directly (no redirect hop); deleted 14 unreachable "Coming Soon" shells, 16 orphaned JS files (incl. `js/jenga.js`, `js/core/*` dead chain, `games/shared/sw.js` duplicate), the `strategy-games/jenga.html` redirect shell, 2 empty `test_*.html` shells, an orphan BMP, and 16 timestamped `.bak` files. All 121 index catalog links verified resolving; no dangling references remain.
- **Legacy port strip** (part 3): removed all dead endpoints — kanji-table (9876), crossword Guardian proxy (9879), unified-multiplayer WS (9881), debug/test pages (9543-45, 9877, 9876 → registry ports), help docs, dead `multiplayerUrl`/`multiplayerWsUrl` getters, api-config 11876 branch; deleted the dead 5003 dictionary/vocabulary pages, the obsolete Windows-service/tunnel/email ecosystem (26 scripts), and the leaked Gmail app-password config file.
- **Board-game multiplayer rebuilt**: `multiplayer-simple.js` (used by 10 board games) now runs on Firebase Realtime Database instead of the dead WebSocket server — dynamic SDK loading, anonymous sign-in, presence, real-time move/chat listeners on `games/{game_id}` nodes (fleet convention). Works once Anonymous auth is enabled in the Firebase console (currently disabled → honest offline status).

## [2.6.0] - 2026-07-03

### Added
- **Edax 4.6** — Othello/Reversi engine. Port 11214.
- **GNU Backgammon 1.08** — Backgammon engine. Port 11215.
- **OpenSpiel 1.6.15** — 119-game framework. Port 11216.
- **MoHex** — Hex engine (Fuego+Benzene). Port 11210.
- Python aiohttp server wrappers for all four new engines.
- `docker-compose.yml` engine services for all new engines.
- Gateway env vars for all engine URLs.

### Changed
- `README.md`: Game AI Engines section with full port table.
- `AGENTS.md`: updated ports table for all 7 engines.
- `start.ps1`: launches new engine servers outside Docker.
- Root `pyproject.toml`: `package-dir` now points to `ai-games-collection-mcp/src` (canonical source).
- `justfile`: migrated from `npm`/`npx` to `bun`/`bunx`.
- `.gitignore`: anchored `/src/` rule; added `*.bak`, `*.backup`, credential paths.
- CI: fixed tag-trigger conditions; migrated from `pip` to `uv`; replaced `zip` with `Compress-Archive`.
- `mcpb-pack`: version read from `ai-games-collection-mcp/pyproject.toml`; `mcpb/src/` generated at pack time.
- Version unified at 2.6.0 across `ai-games-collection-mcp/pyproject.toml`, root `pyproject.toml`, `mcpb/manifest.json`.

### Removed
- Legacy `src/` directory (duplicate source tree, superseded by `ai-games-collection-mcp/src/`).
- Hand-maintained `mcpb/src/` copy (generated at pack time now).
- CI `mypy`, `pre-commit` steps (not fleet standard).
- `npm`/`npx` references in justfile (now `bun`/`bunx`).

