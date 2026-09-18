"""FastAPI gateway for ai-games-collection: REST API + FastMCP mount.

Serves:
  - /health          — liveness check
  - /api/v1/status   — system status
  - /mcp             — AI Games Collection MCP (streamable HTTP)
  - Static files     — React webapp dist (production)

Embedded by Tauri via run_server.py on port 10987.
"""

import asyncio
import logging
import os
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("games-webapp")

AI_GAMES_COLLECTION_TAURI = os.environ.get("AI_GAMES_COLLECTION_TAURI", "0") == "1"

_TAURI_ORIGINS = [
    "http://localhost:10986",
    "http://127.0.0.1:10986",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
]
_ALLOWED_ORIGINS = [*_TAURI_ORIGINS]
_ALLOW_ORIGIN_REGEX = (
    r"https?://(?:[a-zA-Z0-9-]+\.ts\.net|.*?\.tail-[a-f0-9]+\.ts\.net|tauri\.localhost|"
    r"localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"100\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?$|^tauri://localhost$"
)

# Build the FastMCP app UP FRONT so its lifespan can be chained into the FastAPI
# gateway below. A MOUNTED Starlette app never receives a "lifespan" scope, so
# without this the FastMCP session manager never starts ("Task group is not
# initialized") and every /mcp request 500s. A failed build is logged loudly.
try:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ai-games-collection-mcp" / "src"))
    from ai_games_collection_mcp.server import http_app as mcp_http_app

    _MCP_APP = mcp_http_app()
except Exception as e:
    logger.error("Failed to build FastMCP app (tools page will show zero tools): %s", e, exc_info=True)
    _MCP_APP = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    if _MCP_APP is not None:
        async with _MCP_APP.router.lifespan_context(app):
            logger.info("Games webapp gateway starting...")
            yield
            logger.info("Games webapp gateway shutting down...")
        return
    logger.info("Games webapp gateway starting (no FastMCP)...")
    yield
    logger.info("Games webapp gateway shutting down...")


app = FastAPI(
    title="AI Games Collection MCP Operator",
    version="2.5.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=_ALLOW_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount FastMCP at /mcp SYNCHRONOUSLY, BEFORE the catch-all StaticFiles mount at "/"
# (a mount registered later would shadow /mcp). Note: Starlette Mounts only match
# "/mcp/" (trailing slash) — clients must call /mcp/.
if _MCP_APP is not None:
    app.mount("/mcp", _MCP_APP)
    logger.info("FastMCP mounted at /mcp")

# Japanese reference data API (kanji, JMdict, JLPT vocab, Tatoeba, JLPT quiz).
# Backs the japanese-language games from data/kanji.db + data/jlpt_questions.db.
# Must be registered before the catch-all StaticFiles mount at "/".
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from japanese_api import router as japanese_router

    app.include_router(japanese_router)
    logger.info("Japanese data API mounted at /api")
except Exception as e:
    logger.error(f"Failed to mount Japanese data API: {e}")


@app.get("/health")
async def health():
    return JSONResponse(
        {
            "status": "ok",
            "server": "ai-games-collection-mcp-operator",
            "version": "2.5.0",
            "service": "games-webapp",
            "tauri": AI_GAMES_COLLECTION_TAURI,
        }
    )


@app.get("/api/config")
async def api_config():
    return JSONResponse(
        {
            "ai_server_host": os.environ.get("AI_SERVER_HOST", "localhost"),
            "is_remote": False,
            "ports": {
                "stockfish": int(os.environ.get("AI_STOCKFISH_PORT", "11211")),
                "go": int(os.environ.get("KATAGO_PORT", "11213")),
                "shogi": int(os.environ.get("YANEURAOU_PORT", "11212")),
                "openspiel": int(os.environ.get("OPENSPIEL_PORT", "11216")),
                "web": int(os.environ.get("WEB_PORT", "10986")),
            },
        }
    )


@app.get("/api/v1/status")
async def api_status():
    return JSONResponse(
        {
            "success": True,
            "server": "ai-games-collection-mcp-operator",
            "version": "2.5.0",
            "engines": {
                "stockfish": {"url": os.environ.get("STOCKFISH_URL", "http://localhost:11211")},
                "shogi": {"url": os.environ.get("SHOGI_URL", "http://localhost:11212")},
                "go": {"url": os.environ.get("GO_URL", "http://localhost:11213")},
                "openspiel": {"url": os.environ.get("OPENSPIEL_URL", "http://localhost:11216")},
            },
        }
    )


async def _probe_llm_providers():
    """Probe local LLM providers (Ollama :11434, LM Studio :1234)."""
    import httpx

    providers = []
    for provider_id, label, base, models_url in (
        ("ollama", "Ollama", "http://127.0.0.1:11434/v1", "http://127.0.0.1:11434/api/tags"),
        ("lmstudio", "LM Studio", "http://127.0.0.1:1234/v1", "http://127.0.0.1:1234/v1/models"),
    ):
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(models_url)
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m["name"] for m in data.get("models", [])] if provider_id == "ollama" else [m["id"] for m in data.get("data", [])]
                    providers.append({"id": provider_id, "label": label, "base_url": base, "models": models, "needs_key": False})
        except Exception:
            providers.append({"id": provider_id, "label": label, "base_url": base, "models": [], "needs_key": False})
    return providers


@app.get("/api/llm/providers")
async def llm_providers():
    providers = await _probe_llm_providers()
    return JSONResponse({"providers": providers})


@app.post("/api/llm/chat")
async def llm_chat(body: dict):
    import httpx

    provider = body.get("provider", "ollama")
    model = body.get("model", "llama3.2:3b")
    prompt = body.get("prompt") or body.get("message", "")
    base = "http://127.0.0.1:1234/v1" if provider == "lmstudio" else "http://127.0.0.1:11434/v1"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base}/chat/completions",
                json={"model": model, "messages": [{"role": "user", "content": prompt}]},
            )
            if resp.status_code == 200:
                data = resp.json()
                return JSONResponse({"response": data["choices"][0]["message"]["content"]})
            return JSONResponse({"response": f"HTTP {resp.status_code}"})
    except Exception as e:
        return JSONResponse({"response": f"Error: {e}"})


@app.get("/api/skills")
async def api_skills():
    skills_dir = Path(__file__).resolve().parent.parent / "ai-games-collection-mcp" / "src" / "ai_games_collection_mcp" / "skills"
    skills = []
    if skills_dir.is_dir():
        for skill_dir in sorted(skills_dir.iterdir()):
            if skill_dir.is_dir() and (skill_dir / "SKILL.md").is_file():
                skills.append({"name": skill_dir.name, "uri": f"skill://{skill_dir.name}/SKILL.md"})
    return JSONResponse({"skills": skills})


@app.get("/")
async def root():
    from starlette.responses import FileResponse
    index = Path(__file__).resolve().parent.parent / "index.html"
    if index.is_file():
        return FileResponse(str(index))
    return JSONResponse({"error": "games collection not found"}, status_code=404)


@app.post("/api/v1/start-engines")
async def start_engines():
    engines_dir = Path(__file__).resolve().parent.parent / "engines"
    engine_scripts = [
        ("stockfish", "stockfish-server.py"),
        ("shogi", "shogi-server.py"),
        ("go", "go-server.py"),
        ("edax", "edax-server.py"),
        ("gnubg", "gnubg-server.py"),
        ("openspiel", "open_spiel_server.py"),
        ("mohex", "mohex-server.py"),
    ]
    results = []
    for name, script in engine_scripts:
        script_path = engines_dir / script
        if not script_path.is_file():
            results.append({"engine": name, "status": "skipped", "detail": f"{script} not found"})
            continue
        try:
            proc = await asyncio.create_subprocess_exec(
                sys.executable, str(script_path),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                cwd=str(engines_dir),
            )
            results.append({"engine": name, "status": "started", "pid": proc.pid})
        except Exception as e:
            results.append({"engine": name, "status": "failed", "detail": str(e)})
    return JSONResponse({"success": True, "engines": results})


@app.post("/api/v1/docker-up")
async def docker_up():
    compose = Path(__file__).resolve().parent.parent / "docker-compose.yml"
    if not compose.is_file():
        raise HTTPException(404, f"docker-compose.yml not found at {compose}")
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "compose", "-f", str(compose), "up", "-d",
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        return JSONResponse({
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": stdout.decode(errors="replace"),
            "stderr": stderr.decode(errors="replace"),
        })
    except TimeoutError:
        proc.kill()
        raise HTTPException(504, "Docker stack startup timed out after 120s") from None
    except Exception as e:
        raise HTTPException(500, f"Failed to start Docker stack: {e}") from e


@app.post("/api/v1/docker-down")
async def docker_down():
    compose = Path(__file__).resolve().parent.parent / "docker-compose.yml"
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "compose", "-f", str(compose), "down",
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        return JSONResponse({
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": stdout.decode(errors="replace"),
            "stderr": stderr.decode(errors="replace"),
        })
    except TimeoutError:
        proc.kill()
        raise HTTPException(504, "Docker stack shutdown timed out") from None
    except Exception as e:
        raise HTTPException(500, f"Failed to stop Docker stack: {e}") from e


class NoCacheStaticFiles(StaticFiles):
    """StaticFiles that prevents caching for JS/CSS files (dev convenience)."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["path"].endswith((".js", ".css", ".html")):
            original_send = send

            async def no_cache_send(message):
                if message["type"] == "http.response.start":
                    headers = dict(message.get("headers", []))
                    headers[b"cache-control"] = b"no-cache, no-store, must-revalidate"
                    message["headers"] = list(headers.items())
                await original_send(message)

            return await super().__call__(scope, receive, no_cache_send)
        await super().__call__(scope, receive, send)


# Serve React build at /mcp-dashboard (production PyInstaller or Tauri).
# MUST be mounted BEFORE the catch-all games mount at "/", which would otherwise
# shadow every /mcp-dashboard/* path with a 404.
_FRONTEND_DIST = os.environ.get(
    "AI_GAMES_COLLECTION_FRONTEND_DIST",
    str(Path(__file__).resolve().parent / "dist"),
)
if Path(_FRONTEND_DIST).is_dir():
    app.mount("/mcp-dashboard", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
    logger.info(f"Serving MCP dashboard from {_FRONTEND_DIST}")

_AI_GAMES_COLLECTION_ROOT = str(Path(__file__).resolve().parent.parent)
if Path(_AI_GAMES_COLLECTION_ROOT).is_dir():
    app.mount("/", NoCacheStaticFiles(directory=_AI_GAMES_COLLECTION_ROOT, html=True), name="games")
    logger.info(f"Serving game collection from {_AI_GAMES_COLLECTION_ROOT}")
