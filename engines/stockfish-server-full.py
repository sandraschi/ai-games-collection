#!/usr/bin/env python3
"""
Real Stockfish Backend Server
Runs actual Stockfish C++ engine (not JavaScript version!)
**Timestamp**: 2025-12-03
"""

import asyncio
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

from aiohttp import web

# Optional CORS support
try:
    import aiohttp_cors  # type: ignore

    CORS_AVAILABLE = True
except ImportError:
    aiohttp_cors = None  # type: ignore
    CORS_AVAILABLE = False
import concurrent.futures
from collections import defaultdict


# Simple CORS middleware as fallback
async def cors_middleware(request, handler):
    """Simple CORS middleware for when aiohttp_cors fails"""
    response = await handler(request)

    # Add loopback-scoped CORS headers
    origin = request.headers.get("Origin", "")
    headers = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "true",
    }
    if origin.startswith(
        (
            "http://localhost:",
            "http://127.0.0.1:",
            "https://localhost:",
            "https://127.0.0.1:",
            "tauri://localhost",
            "https://tauri.localhost",
        )
    ):
        headers["Access-Control-Allow-Origin"] = origin
    response.headers.update(headers)

    # Handle preflight requests
    if request.method == "OPTIONS":
        return web.Response(headers=response.headers)

    return response


def create_app():
    """Create and configure the aiohttp application"""
    # CORS configuration (with fallback)
    if CORS_AVAILABLE:
        try:
            app = web.Application()
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
            cors_enabled = True
        except Exception as e:
            print(
                f"[WARN] aiohttp_cors setup failed: {e}. Using simple CORS middleware."
            )
            app = web.Application(middlewares=[cors_middleware])
            cors_enabled = False
    else:
        print("[WARN] aiohttp_cors not available. Using simple CORS middleware.")
        app = web.Application(middlewares=[cors_middleware])
        cors_enabled = False

    # Routes
    app.router.add_post("/api/move", handle_get_move)
    app.router.add_get("/api/status", handle_status)

    # Add CORS to all routes if available
    if cors_enabled:
        for route in list(app.router.routes()):
            cors.add(route)

    return app


class RateLimiter:
    """Token bucket rate limiter for concurrent user management"""

    def __init__(self, max_concurrent=3, refill_rate=1.0, bucket_size=5):
        self.max_concurrent = max_concurrent  # Max simultaneous users
        self.refill_rate = refill_rate  # Tokens per second
        self.bucket_size = bucket_size  # Max tokens
        self.buckets = defaultdict(
            lambda: {"tokens": bucket_size, "last_update": time.time()}
        )
        self.active_requests = 0
        self.request_queue = asyncio.Queue()

    async def acquire(self, client_ip):
        """Acquire permission to make a request"""
        bucket = self.buckets[client_ip]

        # Refill tokens based on time passed
        now = time.time()
        time_passed = now - bucket["last_update"]
        tokens_to_add = time_passed * self.refill_rate
        bucket["tokens"] = min(bucket["tokens"] + tokens_to_add, self.bucket_size)
        bucket["last_update"] = now

        # Check concurrent limit and token availability
        if self.active_requests >= self.max_concurrent:
            return (
                False,
                f"Server busy ({self.active_requests}/{self.max_concurrent} active users). Please wait.",
            )

        if bucket["tokens"] < 1:
            return (
                False,
                f"Rate limit exceeded. Please wait {int(1 / self.refill_rate)} seconds.",
            )

        # Grant access
        bucket["tokens"] -= 1
        self.active_requests += 1
        return True, None

    def release(self, client_ip):
        """Release a request slot"""
        self.active_requests = max(0, self.active_requests - 1)


class StockfishEngine:
    def __init__(self, exe_path):
        self.exe_path = exe_path
        self.process = None
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self._cache = {}
        self._max_cache_size = 1000
        self.rate_limiter = RateLimiter(
            max_concurrent=3, refill_rate=0.5, bucket_size=3
        )

    async def start(self):
        """Start Stockfish process with optimized settings"""
        self.process = await asyncio.create_subprocess_exec(
            self.exe_path,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            # Optimize process priority and I/O
            preexec_fn=None if sys.platform == "win32" else lambda: None,
        )

        # Initialize UCI with optimized settings
        await self.send_command("uci")
        await self.wait_for("uciok")

        # Set full-strength defaults for maximum ELO (~3500)
        # Use reasonable number of threads (leave cores for system)
        import os

        cpu_count = os.cpu_count() or 4
        # Use half the cores, minimum 2, maximum 8 threads
        threads = max(2, min(8, cpu_count // 2))
        await self.send_command(f"setoption name Threads value {threads}")

        # Use 256MB hash table (reasonable for 2-8 threads)
        hash_size_mb = 256
        await self.send_command(f"setoption name Hash value {hash_size_mb}")

        await self.send_command(
            "setoption name Ponder value false"
        )  # Disable pondering
        await self.send_command("isready")
        await self.wait_for("readyok")

        print(
            f"[OK] Real Stockfish engine initialized with full strength: {threads} threads, {hash_size_mb}MB hash!"
        )

    async def send_command(self, command):
        """Send command to Stockfish"""
        if self.process and self.process.stdin:
            self.process.stdin.write(f"{command}\n".encode())
            await self.process.stdin.drain()

    async def wait_for(self, expected):
        """Wait for specific response with timeout"""
        timeout = 10.0  # 10 second timeout
        start_time = asyncio.get_event_loop().time()

        while True:
            line = await self.process.stdout.readline()
            if not line:
                break
            decoded = line.decode().strip()
            if expected in decoded:
                return decoded

            # Check for timeout
            if asyncio.get_event_loop().time() - start_time > timeout:
                raise TimeoutError(f"Timeout waiting for '{expected}'")

    async def get_best_move(self, fen, skill_level=20, depth=18, movetime=2000):
        """Get best move from position"""
        # Create cache key
        cache_key = f"{fen}_{skill_level}_{depth}_{movetime}"

        # Check cache first
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Set skill level (only if changed from default)
        if skill_level != 20:
            await self.send_command(f"setoption name Skill Level value {skill_level}")

        # Set position
        await self.send_command(f"position fen {fen}")

        # Request move with optimized parameters
        await self.send_command(f"go depth {depth} movetime {movetime}")

        # Wait for bestmove
        bestmove_line = await self.wait_for("bestmove")
        move = bestmove_line.split()[1] if bestmove_line else None

        # Simple cache (no LRU for async compatibility)
        if len(self._cache) < 100:  # Limit cache size
            self._cache[cache_key] = move

        return move


# Global engine instance and status
engine = None
stockfish_available = False


async def handle_get_move(request):
    """Handle move requests from frontend with resilience and rate limiting"""
    try:
        # Get client IP for rate limiting
        client_ip = (
            request.headers.get("X-Forwarded-For", request.remote or "unknown")
            .split(",")[0]
            .strip()
        )

        # Check rate limits
        allowed, limit_message = await engine.rate_limiter.acquire(client_ip)
        if not allowed:
            print(f"[RATE_LIMIT] Request denied from {client_ip}: {limit_message}")
            return web.json_response(
                {
                    "success": False,
                    "error": limit_message,
                    "retry_after": 5,
                    "rate_limited": True,
                },
                status=429,  # Too Many Requests
            )

        try:
            data = await request.json()
            fen = data.get("fen")
            skill = data.get("skill", 20)
            depth = data.get("depth", 15)
            movetime = data.get("movetime", 1000)

            print(
                f"[MOVE] Move request from {client_ip}: Skill={skill}, Depth={depth}, Time={movetime}ms"
            )
            print(f"Position: {fen}")
            print(
                f"Active requests: {engine.rate_limiter.active_requests}/{engine.rate_limiter.max_concurrent}"
            )

            # Check if Stockfish engine is available
            if not stockfish_available or engine is None:
                print(
                    "[WARN]  Stockfish engine not available, returning fallback response"
                )
                return web.json_response(
                    {
                        "success": False,
                        "error": "Stockfish engine not available. Server running in fallback mode.",
                        "fallback": True,
                        "move": None,
                    },
                    status=503,  # Service Unavailable
                )

            move = await asyncio.wait_for(
                engine.get_best_move(fen, skill, depth, movetime),
                timeout=30.0,  # 30 second timeout for move calculation
            )
            print(f"[OK] Best move: {move}")

            return web.json_response(
                {
                    "success": True,
                    "move": move,
                    "engine": "Stockfish 16 (Full C++ Version)",
                    "elo": "~3500",
                }
            )
        finally:
            # Always release the rate limiter slot
            engine.rate_limiter.release(client_ip)

    except TimeoutError:
        print("[ERROR] Move calculation timed out")
        return web.json_response(
            {"success": False, "error": "Move calculation timed out", "timeout": True},
            status=504,  # Gateway Timeout
        )
    except Exception as e:
        print(f"[ERROR] Error in handle_get_move: {e}")
        import traceback

        traceback.print_exc()
        return web.json_response({"success": False, "error": str(e)}, status=500)


async def handle_status(request):
    """Status endpoint with resilience"""
    return web.json_response(
        {
            "status": "online",
            "engine": "Stockfish 16",
            "version": "Full C++ Version (not JavaScript!)",
            "elo": "~3500",
            "ready": stockfish_available and engine is not None,
            "fallback_mode": not stockfish_available,
        }
    )


def is_port_in_use(port):
    """Check if port is already in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return False
        except OSError:
            return True


def kill_process_on_port(port):
    """Kill process using the specified port (Windows)"""
    try:
        # Find process using the port
        result = subprocess.run(
            ["netstat", "-ano"], capture_output=True, text=True, check=True
        )

        for line in result.stdout.split("\n"):
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    # Kill the process
                    subprocess.run(
                        ["taskkill", "/F", "/PID", pid],
                        capture_output=True,
                        check=False,
                    )
                    print(f"[WARN]  Killed process {pid} using port {port}")
                    return True
        return False
    except Exception as e:
        print(f"[WARN]  Could not kill process on port {port}: {e}")
        return False


async def start_background_tasks(app):
    """Start Stockfish engine on startup with resilience"""
    global engine, stockfish_available

    try:
        # Check environment variable first (for Docker)
        stockfish_exe = os.environ.get("STOCKFISH_PATH")

        if not stockfish_exe:
            # Find Stockfish executable (Windows paths)
            stockfish_paths = [
                Path("../stockfish/stockfish-windows-x86-64-avx2.exe"),  # New location
                Path("stockfish/stockfish/stockfish-windows-x86-64-avx2.exe"),
                Path("stockfish/stockfish-windows-x86-64-avx2.exe"),
                Path("stockfish/stockfish.exe"),
                # Linux paths (for Docker)
                Path("/app/stockfish/src/stockfish"),
                Path("stockfish/src/stockfish"),
                Path("../stockfish/src/stockfish"),
            ]

            for path in stockfish_paths:
                if path.exists():
                    stockfish_exe = str(path.absolute())
                    break

        if not stockfish_exe or not Path(stockfish_exe).exists():
            print("[ERROR] ERROR: Stockfish executable not found!", file=sys.stderr)
            if stockfish_exe:
                print(
                    f"  - STOCKFISH_PATH={stockfish_exe} (not found)", file=sys.stderr
                )
            print("Expected paths:", file=sys.stderr)
            print("  - Check STOCKFISH_PATH environment variable", file=sys.stderr)
            print(
                "[WARN]  Server will start but Stockfish features will not work!",
                file=sys.stderr,
            )
            print("[INFO]  Server running in fallback mode (no Stockfish engine)")
            stockfish_available = False
            return

        print(f"[OK] Found Stockfish: {stockfish_exe}")

        # Initialize engine with timeout protection
        engine = StockfishEngine(stockfish_exe)
        await asyncio.wait_for(engine.start(), timeout=30.0)  # 30 second timeout
        stockfish_available = True
        print("[START] Stockfish backend ready!")
        print("[OK] Real Stockfish engine initialized with optimizations!")

    except TimeoutError:
        print("[ERROR] Stockfish engine initialization timed out", file=sys.stderr)
        print(
            "[WARN]  Server will start but Stockfish features will not work!",
            file=sys.stderr,
        )
        stockfish_available = False
    except Exception as e:
        print(f"[ERROR] CRITICAL ERROR starting Stockfish engine: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        print(
            "[WARN]  Server will start but Stockfish features will not work!",
            file=sys.stderr,
        )
        print("[INFO]  Server running in fallback mode (Stockfish engine failed)")
        stockfish_available = False


def main():
    # Allow port to be configured via environment variable or default
    port = int(os.environ.get("STOCKFISH_PORT", "10001"))

    # Check if port is in use
    if is_port_in_use(port):
        print(f"[WARN]  Port {port} is already in use!")
        print(f"Attempting to free port {port}...")
        if kill_process_on_port(port):
            import time

            time.sleep(1)  # Wait a moment for port to be freed
            if is_port_in_use(port):
                print(
                    f"[ERROR] Port {port} is still in use. Please close the process manually."
                )
                print(f"   Run: netstat -ano | findstr :{port}")
                sys.exit(1)
        else:
            print(
                f"[ERROR] Could not free port {port}. Please close the process manually."
            )
            print(f"   Run: netstat -ano | findstr :{port}")
            sys.exit(1)

    app = create_app()

    # Startup
    app.on_startup.append(start_background_tasks)

    print()
    print("===================================================")
    print("  REAL STOCKFISH BACKEND SERVER")
    print("===================================================")
    print()
    print("Port: 9543 (backend)")
    print("Frontend: http://localhost:9876")
    print()
    print("Press Ctrl+C to stop")
    print()

    try:
        print(f"[INFO] Starting web server on port {port}...")
        web.run_app(app, host=os.environ.get("STOCKFISH_HOST", "127.0.0.1"), port=port)
    except OSError as e:
        if e.errno == 10048:
            print(f"[ERROR] ERROR: Port {port} conflict: {e}", file=sys.stderr)
            print(f"   Another process is using port {port}", file=sys.stderr)
            print(f"   Run: netstat -ano | findstr :{port}", file=sys.stderr)
            print("[INFO]  Attempting to find available port...", file=sys.stderr)

            # Try alternative ports - need to create new app instance to avoid event loop conflicts
            for alt_port in [9546, 9547, 9548, 9549]:
                if not is_port_in_use(alt_port):
                    print(
                        f"[INFO]  Trying alternative port {alt_port}...",
                        file=sys.stderr,
                    )
                    try:
                        # Create a fresh app instance for the alternative port
                        alt_app = create_app()
                        web.run_app(alt_app, host=os.environ.get("STOCKFISH_HOST", "127.0.0.1"), port=alt_port)
                        print(
                            f"[OK] Server started on alternative port {alt_port}",
                            file=sys.stderr,
                        )
                        return  # Success, exit the function
                    except OSError as alt_e:
                        print(
                            f"[WARN] Port {alt_port} also failed: {alt_e}",
                            file=sys.stderr,
                        )
                        continue  # Try next port

            print(
                "[ERROR] No available ports found in range 9543-9549", file=sys.stderr
            )
        else:
            print(f"[ERROR] ERROR: Server failed to start: {e}", file=sys.stderr)
            import traceback

            traceback.print_exc(file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n[WARN]  Server stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"[ERROR] CRITICAL ERROR: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
