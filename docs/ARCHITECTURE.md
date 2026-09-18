---
title: "ai-games-collection Architecture"
category: architecture
status: active
audience: mcp-dev
last_updated: 2026-09-18
---

# Architecture

This repo is **the fleet's odd one out**, and deliberately so. Almost every other MCP
server here is one Python backend plus one Vite frontend on two adjacent ports. This one
runs a gateway plus **seven containerised game engines**, each on its own host port.

If you are used to the rest of the fleet, read this before touching the ports or the
compose file.

## Why containers at all

Because several of the strongest engines **have no Windows build**.

| Engine | Game | Why containerised |
|---|---|---|
| OpenSpiel | many (DeepMind research framework) | Linux/WSL only -- C++/Python build with no Windows target |
| Stockfish | chess | Windows binary exists, but containerised for version pinning alongside the rest |
| YaneuraOu / shogi | shogi | Linux build is the maintained one |
| KataGo / go | go | GPU and build variance; container fixes the toolchain |
| Edax | othello/reversi | Linux-first |
| GNU Backgammon | backgammon | Linux-first |
| MoHex | hex | research code, Linux only |

This is not containerisation for its own sake or for deployment convenience. For at
least OpenSpiel and MoHex, **a container is the only way to run them on this machine.**
Trying to "simplify" this repo by dropping to native processes will simply lose those
engines.

The gateway is the only thing the MCP server and webapp talk to; it fans out to the
engines over the internal `games-net` compose network.

```
MCP server / web_sota  ->  games-gateway (10987)  ->  engine containers (11210-11216)
```

## Ports

| Service | Host port |
|---|---|
| Frontend (Vite) | 10986 |
| games-gateway / backend | 10987 |
| mohex-engine | 11210 |
| stockfish-engine | 11211 |
| shogi-engine | 11212 |
| go-engine | 11213 |
| edax-engine | 11214 |
| gnubg-engine | 11215 |
| openspiel-engine | 11216 |

**Only 10986/10987 appear in `fleet-start.config.ps1`.** The config schema models exactly
two ports -- backend and frontend -- so the seven engine ports are invisible to
`fleet.lock.json` and to the port allocator that reads it.

That is why the engines were moved to a contiguous block at 11210-11216 on 2026-09-18.
They previously sat at 10711 and 10780-10787, where 10780/10781 collided with
`browser-mcp` and 10785/10786 were handed to `nuki-mcp` by the allocator, which could not
see them. A contiguous, deliberately-chosen block is easier to keep clear than seven
scattered ports nobody can see.

Before changing any of these, read
[`mcp-central-docs/operations/PORT_OCCUPANCY.md`](../../mcp-central-docs/operations/PORT_OCCUPANCY.md)
and use `fleet-gate/claim_ports.py`. Do not pick by hand -- the compose ports are exactly
the class of port that looks free and is not.

## The ghost-container trap this repo already hit

This repo was migrated from a previous repo named **`games-app`**, which was then deleted.
Its compose stack was never brought down first.

The result: five containers (`games-gateway`, `games-stockfish`, `games-go`,
`games-shogi`, `games-collection-web`) kept running for an unknown period from compose
project `games-app`, whose working directory no longer existed. They held seven fleet
ports and **blocked this repo from starting its own stack**, while nothing in any
surviving repo explained where they came from. They were removed on 2026-09-18.

**A deleted or renamed repo does not stop its containers.** Before retiring anything
containerised:

```bash
docker compose down            # in the old repo, BEFORE deleting it
docker ps -a --filter label=com.docker.compose.project=<old-name>   # verify
```

`fleet-gate/compose_ports.py --running` now detects this automatically: any running
container whose compose working directory is gone is reported as a ghost.

## Engine images

Engine images are built locally from `docker-compose.yml`; several pull source from
external upstreams at build time (see `scripts/download-engines.ps1`). They are large
(~0.5-1.3 GB each), so a full rebuild is not cheap. Prefer `docker compose up -d` over
`--build` unless a Dockerfile actually changed.
