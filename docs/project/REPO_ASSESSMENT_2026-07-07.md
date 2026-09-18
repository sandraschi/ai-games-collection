# Repo Assessment — ai-games-collection ("AI Game Chest")

**Date:** 2026-07-07
**Assessed version:** 2.6.0 (STATUS.md, 2026-07-03 — stale, see findings)
**Prior assessments:** REPO_ASSESSMENT_2026-02-28.md (v2.4.2), verbal assessment 2026-07-06 (report file lost to the fileops write-hang; findings reconstructed below)
**Scope:** Reassessment after the 2026-07-06 afternoon fix sweep (~11:20Z–17:00Z) and evaluation of the new Universal Game Replay & Analysis feature.
**Method:** Filesystem inspection via fileops (reads, greps, mtime analysis, git index/config inspection). No git CLI available this session — git-history claims are marked unverified where applicable.

---

## Executive Summary

The July 6 morning assessment triggered a same-day fix sweep that resolved most of the critical findings: the `.gitignore` `/src/` rule is anchored, credential paths are ignored, CI tag-triggers are fixed (per changelog), the port schism is resolved in code, and the three converging root causes of the "chess AI stops after ~6 moves" bug all received fixes. In parallel, a genuinely substantial new feature landed: **Universal Game Replay & Analysis** (move recording, localStorage auto-save, resume-after-reload), with a shared JS module and seven games wired.

**One critical item remains half-fixed: both credential files are still tracked in git.** Adding them to `.gitignore` does not untrack already-committed files. `ai-games-collection-mcp/.env` and `ai-games-collection-mcp/firebase-service-account.json` are present in `.git/index` (verified directly), the repo has a GitHub remote (`sandraschi/ai-games-collection`), and the files exist on disk. This needs `git rm --cached` plus credential rotation, and a history purge if they were ever pushed. **Do this before anything else.**

The replay feature is real but its documentation overstates it: the README claims Othello is done (it has zero replay code and no Edax integration), the phase table undercounts actual coverage elsewhere, and the implementation diverged from its own plan (simple single-slot saves instead of the planned rich game-library schema). Classic velocity artifact — the code moved faster than the docs, in both directions.

---

## 1. Status of 2026-07-06 Findings

### Critical findings from yesterday

| # | Finding (2026-07-06) | Status today | Evidence |
|---|---------------------|--------------|----------|
| C1 | Committed credentials, no gitignore coverage | **HALF-FIXED — still critical** | `.gitignore` now lists both paths, but both files remain in `.git/index` (grep of index, latin-1). Files exist on disk. Remote: `github.com/sandraschi/ai-games-collection.git` |
| C2 | Unanchored `src/` gitignore rule silently excluding source trees | **FIXED** | `.gitignore` now has anchored `/src/` with explanatory comment; legacy `src/` tree removed per CHANGELOG 2.6.0 |
| C3 | Broken release CI (unreachable job conditions) | **FIXED (claimed, unverified)** | CHANGELOG 2.6.0: "CI: fixed tag-trigger conditions; migrated from pip to uv; replaced zip with Compress-Archive". Workflow file not re-inspected this session |
| C4 | Port schism (legacy 10001–10003 vs gateway 11211+) | **FIXED in code** | `js/api-config.js` (modified Jul 6 ~11:33Z) now reads ports from `/api/config` with 11211/11212/11213 fallbacks. Legacy ports survive only in one stale comment |

### High-severity bugs from yesterday

| # | Bug | Status today | Evidence |
|---|-----|--------------|----------|
| H1 | Chess AI stops after ~6 moves (three converging causes) | **LIKELY FIXED — needs play-through** | (a) Client fetch timeout raised to 15s, now exceeding the server's 10s engine read loop; (b) request-deduplication now `clone()`s responses, fixing the body-reuse failure on concurrent identical requests; (c) all engine servers touched in the sweep (~11:34Z). TODO.md still lists the bug as open. No verification game has been played. Residual risk: `stockfish-server.py` has no engine-process restart logic — if the Stockfish process dies mid-game, the connection drops permanently |

Remaining high/structural items from the Feb and Jul 6 assessments (error-modal inconsistency, stale docs sprawl, OpenSpiel param-type failures, Mahjong texture waste, etc.) were **not re-verified** this session; TODO.md still lists them, and nothing in the sweep's changelog claims them.

---

## 2. CRITICAL: Credential Remediation (do first)

Verified state: `ai-games-collection-mcp/.env` and `ai-games-collection-mcp/firebase-service-account.json` are **tracked in the git index** despite the new `.gitignore` entries. gitignore only affects untracked files.

Required steps, in order:

```powershell
cd D:\Dev\repos\ai-games-collection
# 1. Check whether the secrets ever reached the remote
git log --oneline --all -- ai-games-collection-mcp/firebase-service-account.json ai-games-collection-mcp/.env
git log --oneline origin/master -- ai-games-collection-mcp/firebase-service-account.json

# 2. Untrack (keeps local files)
git rm --cached ai-games-collection-mcp/firebase-service-account.json ai-games-collection-mcp/.env
git commit -m "chore: untrack credential files (gitignore alone does not untrack)"

# 3. If step 1 shows the files in any pushed commit:
#    a. ROTATE the Firebase service account key in the Firebase console (assume compromised)
#    b. Rotate anything in .env
#    c. Purge history (git filter-repo or BFG) and force-push, per
#       mcp-central-docs/standards/GITIGNORE_STANDARDS.md recovery section
```

Rotation is the part that actually matters. History purging without rotation is theater — if the key was ever public, treat it as burned.

---

## 3. New Feature: Universal Game Replay & Analysis

Landed 2026-07-06 afternoon (games/ ~14:12Z, js/game-replay.js 16:52Z, README 16:54Z). Plan doc: `docs/plan/game-replay-analysis-plan.md`.

### What is actually implemented (verified by grep)

| Component | State |
|-----------|-------|
| Shared module `js/game-replay.js` | **Exists.** IIFE `GameReplay` — patches `moveHistory.push` for auto-save, localStorage load/resume, `resumeBtn` wiring. Compact (2.8 KB), reasonable design |
| Wired via shared module | **4 games:** connect4, go, gomoku, shogi (`GameReplay.init` grep) |
| Inline (pre-extraction) implementations | **3 games:** chess (`chess.js`), checkers (`checkers.html`), hex (`hex.js`) — each carries its own duplicated `{game}-last-game` save/load/resume code |
| Total games with working save/resume | **7** |
| Othello/Reversi | **ZERO replay code, ZERO Edax integration** (`reversi.html` greps empty for moveHistory/GameReplay/localStorage/edax) |
| `js/game-save.js`, `js/game-analyze.js` | **Do not exist** (plan calls for three shared modules; one was extracted) |
| Phases 4 (AI analysis) & 5 (game library UI) | Not started — consistent with README |

### Documentation vs reality

The README phase table is wrong in both directions:

- **Overstates:** "Phase 2 — Checkers, Othello, Go ✅ Done" — Othello has nothing. This is an Implementation Honesty violation (mcd IMPLEMENTATION_HONESTY_STANDARD): a feature claimed complete that was never started for that game. TODO.md's open item "Upgrade Othello — replace local greedy AI with Edax" corroborates that reversi never got engine wiring either.
- **Understates:** "Phase 3 — 2/17 wired (connect4, shogi)" — go and gomoku are also on the shared module (4 wired), and gomoku isn't even in the phase plan.

### Plan vs implementation divergence

The plan specifies a rich `{game}-games` library schema (multiple saved games, metadata, opponent name, notes, per-move analysis dict). The implementation is a **single-slot `{game}-last-game` auto-save** — one game per title, no metadata, no library. This is a fine MVP choice, but the plan doc doesn't say so, and Phase 5 (game library) will require a schema migration from single-slot to library format. Either update the plan to bless the single-slot format as Phase 1–3 scope, or note the migration cost now.

### Technical notes on the shared module

- The `moveHistory.push` monkey-patch is clever but fragile: any game that reassigns `moveHistory = []` on new-game (a very common pattern) silently detaches the auto-save. Games must mutate (`moveHistory.length = 0`) or re-init. Nothing enforces or documents this — worth a comment in the module and a check in each integration.
- Replay in the plan's sense (prev/next stepping, slider, keyboard nav) is **not implemented** — the module does save/load/resume only. The three inline implementations (hex has `replayIndex`) are closer to actual replay. Naming the module "game-replay" oversells it; it is currently "game-save".
- Silent `catch (_) {}` on save/load is acceptable for localStorage quota issues but will also eat schema bugs during Phase 5 migration.

---

## 4. New Findings (2026-07-07)

| # | Severity | Finding |
|---|----------|---------|
| N1 | High | **Credentials still git-tracked** (see §2) — carried as the sole open critical |
| N2 | Medium | **README/remote identity mismatch:** README quick-install clones `github.com/sandraschi/ai-game-chest`; actual remote is `github.com/sandraschi/ai-games-collection.git`. Rebrand to "AI Game Chest" happened in README only. Either rename the GitHub repo or fix the clone URL — as shipped, the install instructions 404 |
| N3 | Medium | **STATUS.md stale** (2026-07-03): no mention of the replay feature, the fix sweep, or the rebrand. For a repo whose README pitches itself as an agentic-engineering showcase, the status file lagging four days undercuts the pitch |
| N4 | Medium | **`engines/stockfish-server-full.py` (19.7 KB) alongside `stockfish-server.py` (9.8 KB)**, both modified in the sweep. Which is canonical? Nothing in README/INSTALL/justfile disambiguates. Duplicate-variant drift is exactly what caused the legacy `src/` mess — pick one, archive the other |
| N5 | Low | **TODO.md stale in both directions:** chess 6-move bug listed open though its fixes landed; no entry for finishing the replay fleet rollout (15 games), Othello honesty gap, or shared-module migration of chess/checkers/hex |
| N6 | Low | **9-byte stub files** `test_katago.html`, `test_yaneuraou.html` at repo root — junk, delete |
| N7 | Low | **`Wbridge5_setup.exe` (1.5 MB) at repo root.** Gitignored, but if it was committed before the ignore rule it is still tracked (same mechanism as N1). Check with `git ls-files | Select-String Wbridge5` during the N1 remediation |
| N8 | Info | README comment in api-config still references "legacy 10001-10003 as fallback" though code fallbacks are 11211+ — stale comment, one-line fix |

---

## 5. Recommended Next Actions

Priority order, realistic effort at AI-assisted pace:

1. **Credential remediation (§2)** — 30 minutes including rotation; longer only if history purge is needed. Non-negotiable first.
2. **README/remote reconciliation (N2)** + phase table correction (Othello honesty, actual wired count) — 15 minutes.
3. **Chess verification play-through** — one full game against Stockfish past move 20; if clean, close the TODO item. Add engine-process restart/respawn to `stockfish-server.py` while in there (~half a day for all seven engine servers, same pattern).
4. **Othello: implement what was claimed** — wire Edax (`edax-server.py` exists and was touched in the sweep) and GameReplay into reversi.html. This closes both the honesty gap and an existing TODO item in one pass. ~1 session.
5. **Migrate chess/checkers/hex to the shared module** — removes three duplicated save implementations before Phase 3 multiplies the pattern further. ~1 session.
6. **Resolve stockfish-server duplication (N4)**, delete stubs (N6), refresh STATUS.md and TODO.md — 30 minutes of hygiene.
7. **Phase 3 fleet rollout** (remaining ~13 games) — mechanical, 1–2 sessions as the plan estimates, but do steps 4–5 first so the fleet lands on one pattern.

---

## 6. Verification Limitations

- No git CLI or gitops available this session: index membership verified by direct `.git/index` inspection; push-state of credentials, CI workflow content, and commit history are **unverified**.
- CI fixes (C3), justfile bun migration, and mcpb pack-time generation are accepted from CHANGELOG_LATEST.md claims, not independently exercised.
- Chess fix (H1) is code-verified but not play-verified.
- Prior structural gaps from the 2026-02-28 assessment were not re-audited; treat that report plus yesterday's H2–H5/gap list as still-open backlog unless the sweep changelog says otherwise.

---

*Assessment by Claude (Fable 5) via fileops inspection, 2026-07-07. Follows the dated-assessment convention of `docs/project/REPO_ASSESSMENT_*.md`.*
