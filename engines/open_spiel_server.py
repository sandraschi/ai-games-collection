#!/usr/bin/env python3
"""
OpenSpiel Engine Server - Wraps OpenSpiel's 119+ games as an AI engine service.

Provides MCTS and random-rollout AI for any OpenSpiel-registered game.
"""

import argparse
import asyncio
import logging
import os
import random
import sys
import time

import aiohttp_cors
from aiohttp import web

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("open_spiel_server")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from security_middleware import get_security_stats, security_middleware
    SECURITY_ENABLED = True
except ImportError:
    SECURITY_ENABLED = False

import pyspiel


class OpenSpielEngine:
    """Manages OpenSpiel game instances and AI bots."""

    def __init__(self):
        self.games: dict[str, pyspiel.Game] = {}
        self.game_infos: dict[str, dict] = {}

    def load_all_games(self):
        """Register all default-loadable OpenSpiel games."""
        count = 0
        for reg in pyspiel.registered_games():
            name = reg.short_name
            if not reg.default_loadable:
                continue
            try:
                game = pyspiel.load_game(name)
                self.games[name] = game
                info = self._build_game_info(game, reg)
                self.game_infos[name] = info
                count += 1
            except Exception as e:
                logger.debug("Skipping game %s: %s", name, e)
        logger.info("Loaded %d/%d OpenSpiel games", count, len(pyspiel.registered_games()))

    def _build_game_info(self, game, reg):
        gt = game.get_type()
        return {
            "short_name": gt.short_name,
            "long_name": gt.long_name,
            "dynamics": str(gt.dynamics).split(".")[-1],
            "chance_mode": str(gt.chance_mode).split(".")[-1],
            "information": str(gt.information).split(".")[-1],
            "utility": str(gt.utility).split(".")[-1],
            "reward_model": str(gt.reward_model).split(".")[-1],
            "num_players": (game.num_players()),
            "min_players": gt.min_num_players,
            "max_players": gt.max_num_players,
            "max_game_length": game.max_game_length(),
            "parameters": reg.parameter_specification or {},
            "provides_observation_tensor": gt.provides_observation_tensor,
            "provides_observation_string": gt.provides_observation_string,
            "default_loadable": reg.default_loadable,
        }

    def get_game(self, name: str):
        """Get a loaded game by short name."""
        if name not in self.games:
            raise ValueError(f"Game '{name}' not found. Available: {sorted(self.games.keys())}")
        return self.games[name]

    def compute_move(self, game_name: str, state_str: str, player: int,
                     ai_type: str = "mcts", simulations: int = 200,
                     params: dict | None = None) -> dict:
        """Compute the best move for a given state."""
        game_params = params or {}
        if game_params:
            # Convert param values to correct types based on game parameter spec
            if game_name in self.game_infos:
                spec = self.game_infos[game_name].get("parameters", {})
                converted = {}
                for k, v in game_params.items():
                    if k in spec:
                        default = spec[k]
                        if isinstance(default, bool) and isinstance(v, str):
                            converted[k] = v.lower() in ("true", "1", "yes")
                        elif isinstance(default, int) and isinstance(v, str):
                            try:
                                converted[k] = int(v)
                            except ValueError:
                                converted[k] = v
                        elif isinstance(default, float) and isinstance(v, str):
                            try:
                                converted[k] = float(v)
                            except ValueError:
                                converted[k] = v
                        else:
                            converted[k] = v
                    else:
                        converted[k] = v
                game_params = converted
            param_str = ",".join(f"{k}={v}" for k, v in game_params.items())
            game = pyspiel.load_game(f"{game_name}({param_str})")
        else:
            game = self.get_game(game_name)

        if state_str:
            state = game.deserialize_state(state_str)
        else:
            state = game.new_initial_state()

        if state.is_terminal():
            return {
                "success": False,
                "error": "Game is already terminal",
                "returns": state.returns(),
            }

        legal_actions = state.legal_actions()
        if not legal_actions:
            return {
                "success": False,
                "error": "No legal actions available",
                "is_terminal": state.is_terminal(),
            }

        if state.is_chance_node():
            outcomes = state.chance_outcomes()
            action = random.choices(
                [o[0] for o in outcomes],
                weights=[o[1] for o in outcomes],
            )[0]
        elif ai_type == "mcts":
            bot = pyspiel.MCTSBot(
                game,
                evaluator=pyspiel.RandomRolloutEvaluator(1, random.randint(0, 2**31)),
                uct_c=0.5,
                max_simulations=simulations,
                max_memory_mb=0,
                solve=True,
                seed=random.randint(0, 2**31),
                verbose=False,
                child_selection_policy=pyspiel.ChildSelectionPolicy.UCT,
            )
            action = bot.step(state)
        else:
            action = random.choice(legal_actions)

        action_str = state.action_to_string(action)
        legal_strs = [state.action_to_string(a) for a in legal_actions[:20]]

        # Apply the action to see the result state
        next_state = state.clone()
        next_state.apply_action(action)
        next_serialized = next_state.serialize()
        game_over = next_state.is_terminal()
        returns = next_state.returns() if game_over else None

        return {
            "success": True,
            "move": int(action),
            "action": action_str,
            "player": player,
            "ai_type": ai_type,
            "legal_actions": legal_strs,
            "legal_action_count": len(legal_actions),
            "next_state": next_serialized,
            "is_terminal": game_over,
            "returns": returns,
        }


engine = OpenSpielEngine()


async def handle_games(request):
    """GET /api/games — list all supported games."""
    games = []
    for name, info in engine.game_infos.items():
        games.append({
            "name": name,
            "long_name": info["long_name"],
            "players": info["num_players"],
            "min_players": info["min_players"],
            "max_players": info["max_players"],
            "parameters": info["parameters"],
        })
    return web.json_response({
        "success": True,
        "count": len(games),
        "games": games,
    })


async def handle_game_info(request):
    """GET /api/game/{name}/info — detailed info for one game."""
    name = request.match_info.get("name", "")
    if name not in engine.game_infos:
        return web.json_response(
            {"success": False, "error": f"Game '{name}' not found"},
            status=404,
        )
    return web.json_response({
        "success": True,
        "game": name,
        "info": engine.game_infos[name],
    })


async def handle_move(request):
    """POST /api/move — compute AI move for a game state."""
    try:
        data = await request.json()
    except Exception:
        return web.json_response(
            {"success": False, "error": "Invalid JSON body"}, status=400
        )

    game_name = data.get("game", "")
    state_str = data.get("state", "")
    player = data.get("player", 0)
    ai_type = data.get("ai", "mcts")
    simulations = data.get("simulations", 200)
    params = data.get("params")

    if not game_name:
        return web.json_response(
            {"success": False, "error": "No game specified"}, status=400
        )

    try:
        result = engine.compute_move(
            game_name=game_name,
            state_str=state_str,
            player=player,
            ai_type=ai_type,
            simulations=simulations,
            params=params,
        )
        status = 200 if result.get("success") else 400
        return web.json_response(result, status=status)
    except (ValueError, KeyError) as e:
        return web.json_response({"success": False, "error": str(e)}, status=400)
    except Exception as e:
        logger.error("Error computing move for %s: %s", game_name, e)
        return web.json_response({"success": False, "error": str(e)}, status=500)


async def handle_status(request):
    """GET /api/status — engine health."""
    try:
        test_game = engine.games.get("tic_tac_toe") or engine.games.get("othello")
        ready = test_game is not None
        return web.json_response({
            "engine": "OpenSpiel 1.6.15",
            "games": len(engine.games),
            "status": "ok" if ready else "degraded",
            "ready": ready,
            "total_registered": len(pyspiel.registered_games()),
        })
    except Exception as e:
        return web.json_response({
            "engine": "OpenSpiel 1.6.15",
            "status": "error",
            "ready": False,
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

    app.router.add_get("/api/games", handle_games)
    app.router.add_get("/api/game/{name}/info", handle_game_info)
    app.router.add_post("/api/move", handle_move)
    app.router.add_get("/api/status", handle_status)
    app.router.add_get("/api/security/stats", handle_security_stats)

    for route in list(app.router.routes()):
        cors.add(route)

    return app


async def startup_tasks(app):
    logger.info("Loading OpenSpiel games...")
    engine.load_all_games()
    logger.info("OpenSpiel engine initialized with %d games", len(engine.games))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenSpiel Engine Server")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("OPENSPIEL_PORT", 11216)),
        help="Port to run the server on",
    )
    args = parser.parse_args()

    port = args.port
    logger.info("OpenSpiel Engine Server")
    logger.info("Starting on port %d", port)
    logger.info("OpenSpiel 1.6.15 - %d registered games", len(pyspiel.registered_games()))

    app = asyncio.run(create_app())
    app.on_startup.append(startup_tasks)

    web.run_app(app, host=os.environ.get("OPENSPIEL_HOST", "127.0.0.1"), port=port)
