# Game Replay & Analysis — Integration Plan

## Goal

Every nontrivial game (Chess, Checkers, Go, Othello, Backgammon, Hex, etc.) should support:

1. **Move history** — recorded during play
2. **Auto-save** — survive page reload via localStorage
3. **Replay** — prev/next step through game, board state restored
4. **Metadata** — date, opponent name, comments
5. **AI analysis** — per-move: what would the engine play? flag blunders
6. **Game library** — list of saved games, rename, delete, export

## Architecture

### Common Save Format

Every game writes to `localStorage` under key `{game}-games`:

```json
{
  "games": [
    {
      "id": "hex-1723489023",
      "game": "hex",
      "date": "2026-07-06T18:30:00",
      "opponent": "Uncle Albert",
      "notes": "I blundered on move 12",
      "boardSize": 11,
      "moves": [
        {"r": 5, "c": 5, "player": "black"},
        {"r": 3, "c": 6, "player": "white"}
      ],
      "result": "black",
      "analysis": {
        "0": {"best": "e4", "blunder": false},
        "1": {"best": "d5", "blunder": false}
      }
    }
  ]
}
```

### Replay Widget (extractable JS class)

A `<game-replay>` component or `ReplayController` class that any game can instantiate:

```javascript
class GameReplay {
    constructor(opts) {
        // opts.board — DOM element for the board
        // opts.initBoard() — reset to empty
        // opts.applyMove(move) — place one stone
        // opts.getState() — current position
        // opts.moves — moveHistory array
        // opts.onJump(index) — called when user navigates
    }
    // Renders prev/next buttons, move counter, slider
    // Handles keyboard shortcuts (← →)
}
```

### Phased Rollout

| Phase | Games | Scope | Effort |
|-------|-------|-------|--------|
| **1 — Canary** | Hex (done), Chess | Verify pattern with 2 games, refine save format | 1 session |
| **2 — Core** | Checkers, Othello, Go | Add replay + save to the 3 next-most-played | 1 session |
| **3 — Fleet** | All 2-player games (BNG, Backgammon, TTT, Connect4, etc.) | Mechanical: add moveHistory + GameReplay to every game | 1-2 sessions |
| **4 — AI analysis** | Chess (via Stockfish), Hex (via MoHex), Checkers, Go (via KataGo) | Per-move engine query, blunder flag, worst-move highlight | 1 session |
| **5 — UI polish** | Game library page (`/saved-games.html`), export, delete, comments | Full management UI | 1 session |

### Implementation Steps per Game

For each game, the changes are:

1. Add `let moveHistory = []`
2. In the move function: `moveHistory.push({r, c, player})` then `_saveToLocal()`
3. Add `_saveToLocal()` / `_loadFromLocal()` using the common schema
4. Add `undoMove()`, `goToMove(idx)`, `prevMove()`, `nextMove()`
5. Add replay buttons to the game's HTML controls
6. Add AI analysis call (if engine available)

### AI Analysis Strategy

| Game | Engine | API | Analysis method |
|------|--------|-----|-----------------|
| Chess | Stockfish (:11211) | `POST /api/move {fen}` | Get best move at position before player's move, compare |
| Hex | MoHex (:11210) | `POST /api/move {board}` | Get best move, compare with actual |
| Checkers | (no engine) | — | Manual analysis or skip |
| Go | KataGo (:11213) | `POST /api/move {moves}` | Get KataGo's recommended move |
| Othello | Edax (:11214) | `POST /api/move {fen}` | Get Edax's best move |

### Fleet Pattern Extraction

Once 2-3 games implement the same pattern, extract to a shared JS module:

```
js/game-replay.js        — GameReplay class
js/game-save.js          — save/load/delete/export functions
js/game-analyze.js       — engine proxy calls
```

Each game imports these rather than duplicating code.

---

**Recommendation:** Start with Phase 1 (Chess gets the treatement) since chess already has `moveHistory` and undo. Then Phase 2 (Checkers — the game you care about right now). Then decide whether to continue to fleet rollout or stop.

