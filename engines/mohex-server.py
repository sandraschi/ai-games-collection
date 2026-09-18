#!/usr/bin/env python3
"""
Real MoHex Server - Uses actual MoHex Hex AI engine
SECURITY: Includes rate limiting and authentication for public internet access
"""

import argparse
import asyncio
import os
import shutil
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
logger = logging.getLogger("mohex_server")

try:
    from security_middleware import get_security_stats, security_middleware
    SECURITY_ENABLED = True
except ImportError:
    logger.warning("security_middleware not found, running without security")
    SECURITY_ENABLED = False

MOHEX_PATH = os.environ.get("MOHEX_PATH", "")
if not MOHEX_PATH:
    # Check common locations
    candidates = [
        shutil.which("mohex"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mohex", "mohex"),
        "/usr/local/bin/mohex",
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            MOHEX_PATH = c
            break
    if not MOHEX_PATH:
        MOHEX_PATH = candidates[1]  # fall back to repo-relative path


class MoHexEngine:
    """Manages MoHex engine instance via HTP (Hex Text Protocol)"""

    def __init__(self, path):
        self.path = path
        self.process = None
        self.lock = threading.Lock()

    def start(self):
        """Start the MoHex process"""
        if self.process is None:
            try:
                self.process = subprocess.Popen(
                    [self.path],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                )
                logger.info("MoHex engine started successfully")
            except Exception as e:
                logger.error(f"Failed to start MoHex: {e}")
                self.process = None

    def stop(self):
        """Stop the MoHex process"""
        if self.process:
            try:
                self._send_command("quit")
                self.process.terminate()
                self.process.wait(timeout=5)
            except Exception:
                self.process.kill()
            self.process = None

    def _send_command(self, command):
        """Send command to MoHex via HTP"""
        if self.process:
            try:
                self.process.stdin.write(command + "\n")
                self.process.stdin.flush()
            except Exception as e:
                logger.error(f"Error sending command '{command}': {e}")

    def _read_response(self, sentinel="\n\n"):
        """Read response from MoHex via HTP"""
        if not self.process:
            return ""

        import time
        response = ""
        start_time = time.time()

        try:
            while time.time() - start_time < 30:
                char = self.process.stdout.read(1)
                if not char:
                    break
                response += char
                if response.endswith(sentinel):
                    break
        except Exception as e:
            logger.error(f"Error reading response: {e}")

        return response

    def _read_line(self, timeout=10):
        """Read a single line from MoHex stdout"""
        if not self.process:
            return ""
        import time
        start_time = time.time()
        line = ""
        try:
            while time.time() - start_time < timeout:
                char = self.process.stdout.read(1)
                if not char:
                    break
                if char == "\n":
                    return line
                line += char
        except Exception as e:
            logger.error(f"Error reading line: {e}")
        return line

    def get_best_move(self, board, boardsize, player, level=3):
        """Get best move using HTP"""
        with self.lock:
            if not self.process:
                self.start()
                if not self.process:
                    raise Exception("MoHex engine not available")

            try:
                # Set strength via MCTS playouts
                playouts = {1: 500, 2: 2000, 3: 10000, 4: 50000, 5: 200000}
                n = playouts.get(level, 10000)
                self._send_command(f"set mcts_playouts {n}")
                self._read_line()

                self._send_command(f"boardsize {boardsize}")

                self._read_line()

                for entry in board.split(","):
                    entry = entry.strip()
                    if not entry:
                        continue
                    parts = entry.split()
                    if len(parts) == 2:
                        color, move = parts
                        self._send_command(f"play {color} {move}")
                        self._read_line()

                self._send_command(f"genmove {player}")

                response = ""
                while True:
                    line = self._read_line()
                    if line is None:
                        break
                    response += line + "\n"
                    if line == "":
                        break

                for line in response.split("\n"):
                    line = line.strip()
                    if line.startswith("="):
                        move = line[1:].strip()
                        if move:
                            logger.info(
                                f"MoHex move: {move} for player {player} on {boardsize}x{boardsize}"
                            )
                            return move

                raise Exception("No best move found in MoHex response")

            except Exception as e:
                logger.error(f"Error getting best move: {e}")
                raise


mohex_engine = MoHexEngine(MOHEX_PATH)


async def handle_move(request):
    """Handle Hex move requests with real MoHex engine"""
    try:
        data = await request.json()
        board = data.get("board", "")
        boardsize = data.get("boardsize", 11)
        player = data.get("player", "black")
        level = min(5, max(1, data.get("level", 3)))

        if boardsize < 1 or boardsize > 19:
            return web.json_response(
                {"success": False, "error": "boardsize must be between 1 and 19"},
                status=400,
            )

        if player not in ("black", "white"):
            return web.json_response(
                {"success": False, "error": "player must be 'black' or 'white'"},
                status=400,
            )

        move = mohex_engine.get_best_move(board, boardsize, player, level)

        return web.json_response(
            {
                "success": True,
                "move": move,
                "engine": "MoHex",
                "game": "hex",
                "boardsize": boardsize,
                "player": player,
            }
        )

    except Exception as e:
        logger.error(f"Error in handle_move: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


async def handle_status(request):
    """Status endpoint"""
    return web.json_response(
        {
            "status": "online",
            "ready": True,
            "engine": "MoHex",
            "game": "hex",
        }
    )


async def handle_security_stats(request):
    """Security statistics endpoint (admin only)"""
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
    """Initialize services on startup"""
    logger.info("Initializing MoHex engine...")
    mohex_engine.start()
    logger.info("MoHex engine initialized")


async def shutdown_tasks(app):
    """Clean shutdown"""
    logger.info("Shutting down MoHex engine...")
    mohex_engine.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MoHex Server")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("MOHEX_PORT", 11210)),
        help="Port to run the server on",
    )
    args = parser.parse_args()

    port = args.port
    logger.info("Real MoHex Server")
    logger.info(f"Starting on port {port}")
    logger.info("Remote access enabled: 0.0.0.0")

    app = asyncio.run(create_app())
    app.on_startup.append(startup_tasks)
    app.on_shutdown.append(shutdown_tasks)

    web.run_app(app, host=os.environ.get("MOHEX_HOST", "127.0.0.1"), port=port)

