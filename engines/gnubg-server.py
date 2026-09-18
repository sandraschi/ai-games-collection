#!/usr/bin/env python3
"""
GNU Backgammon Server - Wraps GNU Backgammon v1.08 engine for move analysis.

Accepts a position ID (GNU Backgammon format) and dice roll, returns
the best move and equity computed by gnubg's neural net evaluation.
"""

import os
import re
import subprocess
import sys

import asyncio

import aiohttp_cors
from aiohttp import web

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("gnubg_server")

try:
    from security_middleware import get_security_stats, security_middleware
    SECURITY_ENABLED = True
except ImportError:
    SECURITY_ENABLED = False

GNUBG_PATH = os.environ.get("GNUBG_PATH", "gnubg")

HINT_RE = re.compile(
    r"^\s*\d+\.\s+Roll:\s+(\S+)\s+Move:\s+(.+?)\s+Equity:\s+([-+]?\d+\.\d+)",
    re.MULTILINE,
)


def parse_hint_output(output: str) -> dict:
    """Parse gnubg hint output into structured move list."""
    moves = []
    for m in HINT_RE.finditer(output):
        moves.append({
            "roll": m.group(1),
            "move": m.group(2).strip(),
            "equity": float(m.group(3)),
        })
    return {
        "best_move": moves[0]["move"] if moves else None,
        "equity": moves[0]["equity"] if moves else None,
        "moves": moves,
    }


def get_best_move(position_id: str, dice: list[int]) -> dict:
    """Run gnubg in batch mode and parse the hint output."""
    d1, d2 = sorted(dice, reverse=True)
    commands = (
        f"set board {position_id}\n"
        f"set dice {d1} {d2}\n"
        "hint\nquit\n"
    )

    try:
        result = subprocess.run(
            [GNUBG_PATH, "-t", "--no-rc"],
            input=commands,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        logger.error(f"gnubg not found at '{GNUBG_PATH}'")
        raise
    except subprocess.TimeoutExpired:
        logger.error("gnubg timed out")
        raise

    if result.returncode != 0:
        logger.warning(f"gnubg exited with code {result.returncode}: {result.stderr}")

    parsed = parse_hint_output(result.stdout)
    if not parsed["best_move"]:
        logger.error(f"No moves in gnubg output:\n{result.stdout}")
        raise RuntimeError("gnubg produced no valid moves")

    return parsed


async def handle_move(request):
    try:
        data = await request.json()
        position_id = data.get("position_id", "")
        dice = data.get("dice", [])

        if not position_id:
            return web.json_response(
                {"success": False, "error": "No position_id provided"},
                status=400,
            )

        if not isinstance(dice, list) or len(dice) != 2:
            return web.json_response(
                {"success": False, "error": "dice must be an array of 2 integers"},
                status=400,
            )

        result = get_best_move(position_id, dice)

        logger.info(
            "gnubg %s %s -> %s (equity %.4f)",
            position_id[:12], dice, result["best_move"], result["equity"],
        )

        return web.json_response({
            "success": True,
            "move": result["best_move"],
            "equity": result["equity"],
            "moves": result["moves"],
            "engine": "GNU Backgammon 1.08",
        })

    except Exception as e:
        logger.error("handle_move failed: %s", e)
        return web.json_response({"success": False, "error": str(e)}, status=500)


async def handle_status(request):
    return web.json_response({
        "engine": "GNU Backgammon 1.08",
        "game": "backgammon",
        "status": "ok",
    })


async def create_app():
    app = web.Application()

    if SECURITY_ENABLED:
        app.middlewares.append(security_middleware)
        logger.info("Security middleware enabled")

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

    for route in list(app.router.routes()):
        cors.add(route)

    return app


if __name__ == "__main__":
    port = int(os.environ.get("GNUBG_PORT", 11215))
    logger.info("GNU Backgammon Server (v1.08)")
    logger.info("Starting on port %d", port)

    app = asyncio.run(create_app())
    web.run_app(app, host=os.environ.get("GNUBG_HOST", "127.0.0.1"), port=port)
