#!/usr/bin/env python3
"""
Real Edax 4.6 Server - Uses actual Edax Othello AI engine
"""

import argparse
import asyncio
import os
import subprocess
import sys
import threading

import aiohttp_cors
from aiohttp import web

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("edax_server")

try:
    from security_middleware import get_security_stats, security_middleware
    SECURITY_ENABLED = True
except ImportError:
    logger.warning("security_middleware not found, running without security")
    SECURITY_ENABLED = False

_script_dir = os.path.dirname(os.path.abspath(__file__))
EDAX_PATH = os.environ.get(
    "EDAX_PATH",
    os.path.join(_script_dir, "..", "engines", "data", "wEdax-x86-64-v2.exe")
)


class EdaxEngine:
    """Manages Edax engine instance via subprocess per move"""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self._check_binary()

    def _check_binary(self):
        if not os.path.isfile(self.path):
            logger.warning(f"Edax binary not found at: {self.path}")
        else:
            logger.info(f"Edax binary found at: {self.path}")

    def get_best_move(self, board_64, depth=21):
        """Run Edax to get best move for a board position"""
        with self.lock:
            if not os.path.isfile(self.path):
                raise Exception("Edax engine binary not available")

            try:
                cmd = f"setboard {board_64}\nlevel {depth}\ngo\nquit\n"
                result = subprocess.run(
                    [self.path],
                    input=cmd,
                    capture_output=True,
                    text=True,
                    timeout=120,
                )

                stdout = result.stdout
                stderr = result.stderr
                if stderr:
                    logger.debug(f"Edax stderr: {stderr.strip()}")

                move = self._parse_best_move(stdout)
                if not move:
                    raise Exception(
                        f"No best move found in Edax output.\n"
                        f"stdout (last 30 lines):\n"
                        + "\n".join(stdout.strip().splitlines()[-30:])
                    )
                return move

            except subprocess.TimeoutExpired:
                raise Exception("Edax engine timed out (120s)")
            except FileNotFoundError:
                raise Exception(f"Edax binary not found at: {self.path}")
            except Exception as e:
                logger.error(f"Error running Edax: {e}")
                raise

    def _parse_best_move(self, output):
        """Parse bestmove from Edax output"""
        bestmove = None
        for line in output.splitlines():
            line = line.strip()
            if line.startswith("bestmove"):
                parts = line.split()
                if len(parts) >= 2 and parts[1] != "(none)":
                    bestmove = parts[1]
            elif line.startswith("=") and len(line) > 2 and bestmove is None:
                candidate = line[1:].strip()
                if len(candidate) == 2 and candidate.isalpha():
                    bestmove = candidate
        return bestmove


edax_engine = EdaxEngine(EDAX_PATH)


async def handle_move(request):
    """Handle Othello move requests with real Edax engine"""
    try:
        data = await request.json()
        board = data.get("board", "")
        depth = data.get("depth", 21)

        if not board or len(board) != 64:
            return web.json_response(
                {"success": False, "error": "Invalid board: must be 64-char string"},
                status=400,
            )

        move = edax_engine.get_best_move(board, depth)
        logger.info(f"Edax move for board {board[:16]}...: {move}")

        return web.json_response({
            "success": True,
            "move": move,
            "engine": "Edax 4.6",
            "strength": f"Depth {depth}",
        })

    except Exception as e:
        logger.error(f"Error in handle_move: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


async def handle_status(request):
    """Status endpoint"""
    try:
        test_board = (
            "---------------------------OX------XO---------------------------"
        )
        test_move = edax_engine.get_best_move(test_board, 5)
        ready = bool(test_move and len(test_move) >= 2)

        return web.json_response({
            "status": "online",
            "ready": ready,
            "engine": "Edax 4.6",
            "game": "othello",
            "strength": "Full Othello analysis",
        })
    except Exception as e:
        logger.error(f"Edax status check failed: {e}")
        return web.json_response({
            "status": "error",
            "ready": False,
            "engine": "Edax 4.6",
            "game": "othello",
            "error": str(e),
        })


async def handle_security_stats(request):
    if SECURITY_ENABLED:
        stats = get_security_stats()
        return web.json_response(stats)
    return web.json_response({"error": "Security not enabled"}, status=503)


async def create_app():
    app = web.Application()

    if SECURITY_ENABLED:
        app.middlewares.append(security_middleware)
        logger.info("Security middleware enabled: Rate limiting and authentication active")

    cors = aiohttp_cors.setup(
        app,
        defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*",
            )
        },
    )

    app.router.add_post("/api/move", handle_move)
    app.router.add_get("/api/status", handle_status)
    app.router.add_get("/api/security/stats", handle_security_stats)

    for route in list(app.router.routes()):
        cors.add(route)

    return app


async def startup_tasks(app):
    logger.info("Initializing Edax engine...")
    try:
        test_board = (
            "---------------------------OX------XO---------------------------"
        )
        test_move = edax_engine.get_best_move(test_board, 5)
        if test_move:
            logger.info(f"Edax engine initialized successfully (test move: {test_move})")
        else:
            logger.error("Edax engine test failed - no moves returned")
    except Exception as e:
        logger.error(f"Edax engine initialization failed: {e}")


async def shutdown_tasks(app):
    logger.info("Shutting down Edax engine...")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Edax Othello Server")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("EDAX_PORT", 11214)),
        help="Port to run the server on",
    )
    args = parser.parse_args()

    port = args.port
    logger.info("Real Edax 4.6 Othello Server")
    logger.info(f"Starting on port {port}")
    logger.info("Using actual Edax 4.6 engine")

    app = asyncio.run(create_app())
    app.on_startup.append(startup_tasks)
    app.on_shutdown.append(shutdown_tasks)

    web.run_app(app, host=os.environ.get("EDAX_HOST", "127.0.0.1"), port=port)
