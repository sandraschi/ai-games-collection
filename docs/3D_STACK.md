# AGC 3D Stack — Three.js + cannon-es + VRM (2026-11-04)

Source of truth for 3D in `ai-games-collection` and `gamesapp` (mirror 1:1).
Applies to: Jenga fix, Kaffeehaus, Where-is-Benny, Detective-Vienna, Avatar/Nekomimi.

## 1. Engines

### Render — Three.js
- Legacy games (Jenga, Mahjong, Chess-3D): `three.js r128` global via cdnjs + `OrbitControls` via jsdelivr `three@0.128.0/examples/js/controls/OrbitControls.js`.
  Do NOT upgrade these in place — OrbitControls non-module import breaks on newer.
- New avatar games: `three@0.160.0` module via importmap + `@pixiv/three-vrm@2.0.0`. Separate page (`avatar-viewer.html`), no shared global with r128 pages.

### Physics — cannon-es (replaces cannon.js 0.6.2)
- Old: `cdnjs cannon.js 0.6.2` global `CANNON` (2015, no sleep, restitution 0.3 bouncy, `SAPBroadphase` only).
- New: `cannon-es@0.20.0` ESM via importmap `https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js`.
- Shared helper: `games/shared/physics-world.js` — copy verbatim to `gamesapp/games/shared/physics-world.js`.
  - `createWorld({gravityY, friction, restitution})`: `allowSleep=true`, `solver.iterations=12`, `restitution=0.05`
  - `addBox({x,y,z,w,h,d,mass,kinematic})`
  - `wakeNeighbours(world, body)` — call after pull so tower settles
  - `stepWorld(world, dt=1/60)`

### Godot vs Cannon (mental model)
- Cannon/cannon-es = library: you step, you copy transforms. ~10k lines. SAP -> GSSolver sequential impulse.
- GodotPhysics/Jolt = server + scene tree: RigidBody3D, StaticBody3D, CharacterBody3D, Area3D, VehicleBody, joints, 32 layers, move_and_slide, CCD, BVH, multithreaded (Jolt).
- Same math, Jolt/Rapier have 10y fixes: sleep, warm-starting, no tunneling.

### Rust
- Web: keep `cannon-es`. Optional `rapier3d-compat` (WASM) for better stacking.
- Native/Tauri-Rust: `rapier3d` + `parry3d`. Bevy: `bevy_rapier3d` or `avian3d` (ex-bevy_xpbd, XPBD, best Jenga stacking).
- Avatar Rust: `bevy_vrm` / `bevy_vrm1` (not-elm): `VrmPlugin`, `.vrm` loader as glTF, `spring_bones`, first-person layers, animation. Pulls `gltf` crate with VRM 0.0/1.0 extension handler.

## 2. Jenga — what was broken, what changed 2026-11-04

File: `games/jenga.html` + `games/strategy-games/jenga.js` (1841 lines).
Backups: `jenga.html.20261104_102900.bak`, `jenga.js.20261104_102900.bak`.

Bugs:
1. All bodies `mass:0 KINEMATIC` -> tower can never fall. `checkTowerStability()` faked (`y<-1` or `dist>5`).
2. `pullBlock()` deletes instead of restacking on top. Tower gets lighter, never taller.
3. `createDachshundGeometry()` called `mergedGeometry.merge(geom)` — does not exist in r128 BufferGeometry -> throw on theme select. Fixed to Box fallback + warn.
4. `animate()` called `controls.update()` 2x, `world.step(1/60)` no substeps.
5. `CANNON.Cylinder` for sausage/battery is ConvexPolyhedron-based, wobbly — keep Box physics for gameplay, Cylinder visual only (TODO).

Migration:
- `jenga.html`: removed 0.6.2 script, added importmap for `cannon-es`, `jenga.js` -> `<script type=module>`.
- `jenga.js`: `import * as CANNON from 'cannon-es'`, world `allowSleep`, `iterations 12`, `restitution 0.05`, bodies `sleepSpeedLimit 0.15 / sleepTimeLimit 0.6`, library check updated, `window.pullBlock = ...` etc re-exported for `onclick=""` (modules don't leak globals).
- Syntax verified: `node --check physics-world.js`, `node --check jenga-check.mjs`.

Next (not yet): real stacking — wake neighbours, move pulled block to top as DYNAMIC, let settle. Say go and I do it.

## 3. New games pattern (copy to gamesapp verbatim)

- `games/kaffeehaus.html` + `games/puzzle-games/kaffeehaus.js`: Three r128, orbit only, no physics. Tables, orders, day-night. Hooks: `achievements.js unlock('kaffee-regular')`, `game-stats.js`, `game-sound-client.js`.
- `games/where-is-benny.html` + `where-is-benny.js`: reuses Kaffeehaus room, Raycaster find, timer/moves, optional `unified-multiplayer.js` hider/finder via Firebase `games/{id}`.
- `games/detective/cases/wien-naschmarkt-01.json`: uncracked.city lift — search places / interrogate LLM liars / present clue vs statement / 3-try report. See §5.
- Registration (3 touches): `games/*.html` + `index.html .game-card` + `js/game-loader.js _getGameAssets['kaffeehaus'/'where-is-benny']`.
- Never hardcode `10987`. Use relative `/api/` — breaks on funnel/Tauri otherwise.

## 4. Avatar / Nekomimi

Found:
- `D:/Dev/repos/avatar-mcp/models/Nekomimi-chan.vrm` (17.5 MB)
- `D:/Dev/repos/avatar-mcp/models/AnimeGirl2.vrm` (18.0 MB)
- 20+ Python viewers in `avatar-mcp/` (`view_vrm.py`, `skinned_vrm_viewer.py`...). Offline analysis only, not runtime. Do NOT ship pyvista to browser.

Web (gamesapp + AGC):
- `games/avatar-viewer.html` (TODO scaffold): three 0.160 module + `@pixiv/three-vrm@2.0.0`, `GLTFLoader` plugin, `VRMUtils`, spring-bones, blink/breath, load `../assets/Nekomimi-chan.vrm` (copy, don't move — 17 MB, git-lfs if needed).
- Barista NPC in Kaffeehaus = same Nekomimi VRM, idle animation only. Benny owner = same.

Rust (desktop):
- New crate `avatar-native/` (TODO): `bevy` + `bevy_vrm1` + `bevy_rapier3d`. `VrmPlugin`, spawn `.vrm`, drive spring-bones, collide avatar capsule with Jenga tower via Rapier.
- `cargo add bevy bevy_vrm1 bevy_rapier3d` — pin Bevy version to what `bevy_vrm1` supports (check docs.rs at time of `cargo add`).

No `vroid.js` / `avatar.js` exists in fleet — searched `*.vrm`, `vroid*.js`, `avatar*.js`, `nekomimi` grep. If you meant something else, point me at the path.

## 5. Detective lift (uncracked.city, for Apple)

Loop to copy (mechanics OK, assets NOT): search places -> free-text interrogate LLM liars -> hold clue vs statement -> 3-try report. Meta: passport stamps, `solved by 0` counter, 5 tutorials then hard cases, no account + Erase everything, Flag-line for review (Apple guideline 1.2).
QA gate to copy: second LLM detective with only player-visible data must solve before case ships, else discard.
iOS notes: server LLM = ongoing cost. Ship 5 free local cases, hard cases as $1.99 packs or $4.99/mo. Typed v1, Apple Speech later. No account, iCloud optional.

Case schema lives at `games/detective/cases/wien-naschmarkt-01.json` (4 suspects, 8 clues, `contradicts`, `leak_condition`, `required_contradictions`, `pass_stamps`). Validator prompt in same folder.

## 6. Bringing bevy_vrm in — checklist

- [ ] `cargo new avatar-native --bin` in `ai-games-collection/` (mirror to gamesapp or git-submodule, don't diverge)
- [ ] `cargo add bevy bevy_vrm1 bevy_rapier3d`
- [ ] Copy `Nekomimi-chan.vrm` to `avatar-native/assets/` (or symlink, keep 17 MB out of git — use `git lfs` or `cargo ignore`)
- [ ] Minimal `main.rs`: `VrmPlugin`, spawn VRM, orbit camera, Rapier ground plane
- [ ] `just avatar-native` recipe
- [ ] Doc update here when Bevy version pinned

## 7. File map

- `games/jenga.html`, `games/strategy-games/jenga.js` — migrated to cannon-es
- `games/shared/physics-world.js` — shared, copy to gamesapp
- `avatar-mcp/models/Nekomimi-chan.vrm` — source VRM, do not move
- This doc — update on every 3D change, keep AGC + gamesapp in sync
