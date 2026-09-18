# AI Games Collection MCP Server - Complete Documentation

**Correspondence Chess and Game Analysis via Claude/Cursor**

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Available Tools](#-available-tools)
- [Game Formats & Move Notation](#-game-formats--move-notation)
- [ADN Integration & Knowledge Management](#-adn-integration--knowledge-management)
- [Examples & Use Cases](#-examples--use-cases)
- [Troubleshooting](#-troubleshooting)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)

---

## 🎯 Overview

### Why Streamable HTTP Transport Matters

The **Streamable HTTP Transport** revolutionizes MCP server deployment:

#### **🎯 Serverless Deployment**
```python
# Traditional MCP servers require persistent connections
# Streamable HTTP enables stateless, serverless operation

# Deploy to Vercel, Netlify, or any HTTP platform
# No persistent connections needed!
# Automatic scaling and global distribution
```

#### **🔄 Resilience & Reconnection**
- **Network interruptions**? Automatically reconnects
- **Server restarts**? Clients seamlessly reconnect
- **Load balancing**? Stateless operation enables horizontal scaling
- **CDN deployment**? Global edge distribution possible

#### **🌐 Web Integration**
- **CORS support** for browser-based MCP clients
- **REST-like endpoints** for web applications
- **API gateway integration** with existing web infrastructure
- **Mobile app support** via HTTP APIs

#### **⚡ Performance Benefits**
- **Stateless operation** reduces server resource usage
- **Connection pooling** improves scalability
- **Bidirectional streaming** enables real-time features
- **Compression support** reduces bandwidth usage

---

The AI Games Collection MCP Server enables correspondence play and AI-powered analysis for multiple games through Claude/Cursor. Perfect for playing chess, shogi, or go with physical boards while traveling, or for deep tactical analysis and training.

### Key Features

- 🎯 **Correspondence Play**: Turn-based games with move recording and persistence
- 🤖 **AI Analysis**: Real-time analysis from Stockfish, KataGo, and YaneuraOu engines
- 📚 **Knowledge Management**: ADN integration for game analysis notes and strategy research
- 🏆 **Tournaments**: Multi-player competitive events with automated pairings
- 🧩 **Training**: Tactical puzzles and position analysis for skill development
- 📊 **Statistics**: Player ratings, game history, and performance tracking
- 🔍 **Search**: Game knowledge search and strategic insights

### Supported Games

#### Full AI Engine Support:
- **Chess** - Stockfish engine (port 11211)
- **Shogi** - YaneuraOu engine (port 11212)
- **Go** - KataGo engine (port 11213)

#### Correspondence Play:
- **Gomoku**, **Checkers**, **Connect Four**, **Mühle**, **Battleship**, **Scrabble**

### 🚀 Transport Options

The server supports multiple transport protocols for different deployment scenarios:

#### **STDIO (Default)**
- **Use Case**: MCP clients (Claude Desktop, Cursor)
- **Command**: `ai-games-collection-mcp` or `python -m ai_games_collection_mcp.mcp_server`
- **Features**: Direct process communication, maximum performance

#### **🎯 Streamable HTTP (New!)**
- **Use Case**: Remote MCP servers, serverless deployment, web APIs
- **Command**: `ai-games-collection-mcp --transport streamable-http --port 8000`
- **Benefits**:
  - Stateless operation (perfect for serverless)
  - Automatic reconnection after network issues
  - Bidirectional communication
  - CORS support for web clients
  - Global distribution via CDNs

#### **SSE (Legacy)**
- **Use Case**: Real-time streaming (being phased out)
- **Command**: `ai-games-collection-mcp --transport sse --port 8000`
- **Note**: Consider upgrading to streamable-http for better resilience

---

## 🚀 Quick Start

### Local Development (STDIO)
```bash
# Install dependencies
pip install -e "."

# Run with MCP client (Claude Desktop, Cursor)
ai-games-collection-mcp
```

### Serverless Deployment (Streamable HTTP)
```bash
# Install HTTP dependencies
pip install -e ".[http]"

# Run as HTTP server (serverless-compatible)
ai-games-collection-mcp --transport streamable-http --port 8000 --host 0.0.0.0

# Configure Claude Desktop for remote MCP:
{
  "mcpServers": {
    "games-server": {
      "url": "https://your-ai-games-collection-mcp.vercel.app/"
    }
  }
}
```

### Docker Deployment
```bash
# Build container
docker build -t ai-games-collection-mcp .

# Run locally
docker run -p 8000:8000 ai-games-collection-mcp --transport streamable-http --port 8000

# Deploy to cloud (Vercel, Railway, etc.)
# The containerized server is stateless and serverless-ready!
```

## ⚙️ Configuration
Add to your MCP settings:
```json
{
  "mcpServers": {
    "ai-games-collection-mcp": {
      "command": "python",
      "args": ["-m", "ai_games_collection_mcp.mcp_server"],
      "cwd": "D:\\Dev\\repos\\ai-games-collection\\ai-games-collection-mcp"
    }
  }
}
```

### 4. Test Connection
```powershell
python test_mcp_server.py
```

---

## 📦 Installation

### Requirements
- Python 3.10+
- FastMCP 2.14.3+
- SQLite (built-in)
- Running game engine servers

### Package Installation
```powershell
# Clone and install
cd ai-games-collection/ai-games-collection-mcp
pip install -e .

# Verify installation
python -c "import ai_games_collection_mcp.mcp_server; print('✅ Installation successful')"
```

### Engine Setup

#### Stockfish (Chess)
```powershell
python backend/simple-stockfish-server.py
# Binds to 0.0.0.0:11211
```

#### KataGo (Go)
```powershell
python backend/simple-go-server.py
# Binds to 0.0.0.0:11213
```

#### YaneuraOu (Shogi)
```powershell
python backend/simple-shogi-server.py
# Binds to 0.0.0.0:11212
```

---

## ⚙️ Configuration

### MCP Client Configuration

#### Claude Desktop (Windows)
Location: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ai-games-collection-mcp": {
      "command": "python",
      "args": ["-m", "ai_games_collection_mcp.mcp_server"],
      "cwd": "D:\\Dev\\repos\\ai-games-collection\\ai-games-collection-mcp"
    }
  }
}
```

#### Cursor IDE
Add to Cursor's MCP settings panel.

### Environment Variables (.env)

The server supports `.env` for configuration. Example:

```bash
# AI Engine Service URLs
STOCKFISH_URL=http://localhost:11211
SHOGI_URL=http://localhost:11212
GO_URL=http://localhost:11213

# Firebase P2P Synchronization Config
FIREBASE_SERVICE_ACCOUNT_JSON=firebase-service-account.json
FIREBASE_DATABASE_URL=https://games-collection-c2e25-default-rtdb.europe-west1.firebasedatabase.app

# Logger Config
AI_GAMES_COLLECTION_MCP_LOG_LEVEL=INFO
```

### Database Configuration

The server automatically creates `data/ai_games_collection_mcp.db` with these tables:

- `games` - Game state and moves
- `tournaments` - Tournament information
- `tournament_participants` - Player registrations
- `player_ratings` - ELO ratings
- `player_statistics` - Performance metrics
- `game_history` - Move history
- `ai_analysis_cache` - Cached engine analysis

---

## 🛠️ Available Tools

### 🎯 Core Correspondence Tools

#### `make_move(game_id, move, game_type="chess", fen=None)`
Record a move in a correspondence game.

**Parameters:**
- `game_id`: Unique game identifier (auto-generated if using `new_game`)
- `move`: Move in standard notation (see Game Formats below)
- `game_type`: Game type (chess, shogi, go)
- `fen`: Optional current position in FEN notation

**Returns:** Move confirmation with updated position

#### `get_ai_move(game_type="chess", position=None, game_id=None, depth=15, skill_level=20)`
Get AI move suggestion from game engines.

**Parameters:**
- `game_type`: Game type
- `position`: Position in FEN/SGF notation
- `game_id`: Use stored position from game
- `depth`: Analysis depth (higher = stronger, slower)
- `skill_level`: AI strength (1-20, 20 = maximum)
- `movetime`: Max thinking time in milliseconds

**Returns:** Suggested move, evaluation, engine info

#### `get_game_state(game_id)`
Get current state of a correspondence game.

**Parameters:**
- `game_id`: Game identifier

**Returns:** Move count, move history, current position, status

#### `new_game(game_type="chess", game_id=None)`
Start a new correspondence game.

**Parameters:**
- `game_type`: Game type
- `game_id`: Optional custom ID (auto-generated if not provided)

**Returns:** Game ID and confirmation

### 🤖 Analysis Tools

#### `analyze_position(game_type="chess", position=None, game_id=None, depth=20)`
Analyze a position and get evaluation.

**Parameters:**
- `game_type`: Game type
- `position`: Position in FEN/SGF notation
- `game_id`: Use stored position from game
- `depth`: Analysis depth

**Returns:** Best move, evaluation, position assessment

#### `analyze_position_detailed(game_type="chess", position=None, game_id=None, depth=20, analysis_type="full")`
Perform detailed position analysis with multiple lines.

**Parameters:**
- `game_type`: Game type
- `position`: Position notation
- `game_id`: Use stored position
- `depth`: Analysis depth
- `analysis_type`: "full", "tactical", "endgame", "evaluation"

**Returns:** Comprehensive analysis with multiple candidate moves

### 🏆 Tournament Tools

#### `create_tournament(tournament_id, game_type="chess", max_players=8, time_control="blitz")`
Create a new tournament for competitive play.

**Parameters:**
- `tournament_id`: Unique tournament identifier
- `game_type`: Game type for tournament
- `max_players`: Maximum participants
- `time_control`: "bullet", "blitz", "rapid", "classical"

**Returns:** Tournament information and registration details

#### `register_for_tournament(tournament_id, player_id)`
Register a player for a tournament.

**Parameters:**
- `tournament_id`: Tournament identifier
- `player_id`: Player identifier

**Returns:** Registration status

### 🧩 Training Tools

#### `generate_puzzle(game_type="chess", difficulty="intermediate", theme=None)`
Generate tactical puzzles for training.

**Parameters:**
- `game_type`: Game type
- `difficulty`: "beginner", "intermediate", "advanced", "expert"
- `theme`: Puzzle theme (tactics, endgame, opening)

**Returns:** Puzzle position, solution, explanation

### 📊 Statistics & Ratings

#### `get_player_statistics(player_id, game_type=None, timeframe="all")`
Get comprehensive player statistics.

**Parameters:**
- `player_id`: Player identifier
- `game_type`: Filter by game type
- `timeframe`: "day", "week", "month", "year", "all"

**Returns:** Win/loss record, rating, performance metrics

#### `update_player_rating(player_id, game_type, opponent_rating, result, game_id=None)`
Update player rating using ELO system.

**Parameters:**
- `player_id`: Player identifier
- `game_type`: Game type
- `opponent_rating`: Opponent's rating
- `result`: "win", "loss", "draw"

**Returns:** New rating and rating change

### 🔧 System Management

#### `check_engine_status(game_type="chess")`
Check if game engine is running.

**Parameters:**
- `game_type`: Game type to check

**Returns:** Engine status, connection info

#### `get_system_status(include_engines=True, include_database=True, include_adn=True)`
Get comprehensive system status.

**Parameters:**
- `include_engines`: Check AI engine status
- `include_database`: Check database connectivity
- `include_adn`: Check ADN integration

**Returns:** Full system health report

#### `cleanup_cache(older_than_hours=24)`
Clean up expired AI analysis cache.

**Parameters:**
- `older_than_hours`: Remove cache entries older than this

**Returns:** Cleanup statistics

### 📚 Knowledge Management

#### `search_game_knowledge(query, game_type=None, max_results=5)`
Search game knowledge and strategy.

**Parameters:**
- `query`: Search terms (e.g., "Sicilian defense")
- `game_type`: Filter by game type
- `max_results`: Maximum results

**Returns:** Relevant knowledge entries and strategies

#### `create_analysis_note(game_id, game_type="chess", position=None, analysis_depth=15)`
Create detailed analysis note in ADN knowledge base.

**Parameters:**
- `game_id`: Game identifier
- `game_type`: Game type
- `position`: Position to analyze
- `analysis_depth`: Depth of AI analysis

**Returns:** Analysis note creation status

---

## 🎲 Game Formats & Move Notation

### Chess (Stockfish)

#### FEN Position Format
FEN (Forsyth-Edwards Notation) represents complete chess positions:

```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

**Structure:** `[board] [active_color] [castling] [en_passant] [halfmove] [fullmove]`

#### Move Notation
- **Standard Algebraic**: `e2e4`, `Nf3`, `O-O`, `e7e8q`
- **Long Algebraic**: `e2-e4`, `g1-f3`
- **Coordinate**: `e2e4`, `g1f3`

#### Examples
```python
# Starting position
position = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

# Italian Game
position = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"

# Sicilian Defense
position = "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2"
```

### Shogi (YaneuraOu)

#### CSA Position Format
Complex shogi position notation with piece placement and game state.

#### Move Notation
- **Coordinate**: `7g7f`, `B*5e` (drop), `7g7f+` (promotion)
- **Piece symbols**: `P` (pawn), `L` (lance), `N` (knight), `S` (silver), `G` (gold), `B` (bishop), `R` (rook), `K` (king)

### Go (KataGo)

#### SGF Position Format
Smart Game Format for go positions with move sequences.

#### Move Notation
- **Coordinate**: `A1`, `K10`, `T19`
- **Pass**: `pass`

### Other Games

#### Gomoku
- **Format**: `row,col`
- **Example**: `"7,7"`

#### Checkers
- **Format**: `from_row,col to to_row,col`
- **Example**: `"5,2 to 4,3"`

#### Connect Four
- **Format**: Column number (0-6)
- **Example**: `"3"`

#### Battleship
- **Format**: `"A5"` or `"row,col"`
- **Example**: `"A5"` or `"0,4"`

#### Scrabble
- **Format**: `"WORD at POSITION direction"`
- **Example**: `"HELLO at H8 horizontal"`

---

## 🧠 ADN Integration & Knowledge Management

The AI Games Collection MCP Server integrates with **Advanced Memory (ADN)** for intelligent knowledge management and game analysis.

### ADN Features

#### Automatic Analysis Notes
When using `create_analysis_note()`, the server creates structured notes in ADN containing:

```markdown
# Game Analysis: Chess - game_123

**Game ID:** game_123  
**Game Type:** Chess  
**Analysis Date:** 2025-01-10 12:00:00  

## Position Evaluation
- **Best Move:** Nf6
- **Evaluation:** +0.3
- **Engine:** Stockfish 15
- **Analysis Depth:** 15

## Tactical Insights
- Position is equal, White has slight initiative
- Key tactical motif: Knight on f6 attacks center

## Learning Points
- Focus on piece development before aggressive moves
- Control of the center is crucial in opening

## Recommended Study
1. Review opening principles for this pawn structure
2. Study similar positions with knights on f3/f6
3. Practice calculating tactical sequences
```

#### Knowledge Search
Use `search_game_knowledge()` to find relevant strategies and analysis:

```python
# Search for specific openings
results = await search_game_knowledge(
    query="Sicilian defense",
    game_type="chess"
)

# Search for tactical themes
results = await search_game_knowledge(
    query="discovered attack",
    game_type="chess"
)
```

### ADN Integration Benefits

1. **Persistent Analysis**: All game analysis is stored and searchable
2. **Learning Progression**: Track improvement over time
3. **Strategy Research**: Access to vast game knowledge base
4. **Pattern Recognition**: Find similar positions and tactics
5. **Automated Insights**: AI-generated learning recommendations

### ADN Configuration

The server automatically detects ADN availability. If ADN MCP is running, analysis notes are created automatically with game analysis.

---

## 💡 Examples & Use Cases

### Correspondence Chess

```python
# Start a new game
result = await new_game(game_type="chess", game_id="correspondence_1")
print(f"Game started: {result['game_id']}")

# Record your move
result = await make_move(
    game_id="correspondence_1",
    move="e2e4",
    game_type="chess"
)

# Get AI response
result = await get_ai_move(
    game_type="chess",
    game_id="correspondence_1",
    depth=15
)
print(f"Stockfish suggests: {result['move']}")

# Deep analysis of current position
result = await analyze_position_detailed(
    game_type="chess",
    game_id="correspondence_1",
    analysis_type="tactical"
)
```

### Position Analysis

```python
# Analyze a famous position
position = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5"

result = await analyze_position_detailed(
    game_type="chess",
    position=position,
    depth=20,
    analysis_type="full"
)

print(f"Best move: {result['best_moves'][0]['move']}")
print(f"Evaluation: {result['evaluation']['score']}")
```

### Tournament Play

```python
# Create tournament
result = await create_tournament(
    tournament_id="weekend_blitz",
    game_type="chess",
    max_players=8,
    time_control="blitz"
)

# Register players
await register_for_tournament("weekend_blitz", "player_alice")
await register_for_tournament("weekend_blitz", "player_bob")
```

### Training & Puzzles

```python
# Generate puzzle
result = await generate_puzzle(
    game_type="chess",
    difficulty="intermediate",
    theme="tactics"
)

print(f"Puzzle position: {result['position']}")
print(f"Solution: {result['solution']}")
print(f"Theme: {result['theme']}")
```

### Knowledge Research

```python
# Search for strategies
results = await search_game_knowledge(
    query="endgame technique",
    game_type="chess",
    max_results=5
)

for result in results:
    print(f"Found: {result['title']}")
    print(f"Content: {result['content'][:100]}...")
```

### ADN Analysis Notes

```python
# Create detailed analysis note
result = await create_analysis_note(
    game_id="analysis_game_1",
    game_type="chess",
    position="r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    analysis_depth=20
)

print(f"Analysis note created: {result['note_created']}")
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Engine not running" Error
**Problem:** AI engines are not started
**Solution:**
```powershell
# Start required engines
python backend/simple-stockfish-server.py  # Chess
python backend/simple-shogi-server.py      # Shogi
python backend/simple-go-server.py         # Go
```

#### 2. "Game not found" Error
**Problem:** Game doesn't exist in memory or database
**Solution:**
```python
# Start new game first
result = await new_game(game_type="chess")
game_id = result['game_id']

# Or check existing games
status = await get_system_status()
print(f"Active games: {status['statistics']['active_games']}")
```

#### 3. Database Errors
**Problem:** SQLite database issues
**Solution:**
- Check write permissions in `data/` directory
- Database auto-creates on first run
- Manual database reset: Delete `data/ai_games_collection_mcp.db`

#### 4. Import Errors
**Problem:** Missing dependencies
**Solution:**
```powershell
cd ai-games-collection-mcp
pip install -e .
```

#### 5. MCP Connection Issues
**Problem:** Claude/Cursor can't connect to MCP server
**Solution:**
- Verify Python path in MCP config
- Check working directory path
- Restart Claude Desktop/Cursor
- Check server logs for errors

### Testing

Run comprehensive tests:
```powershell
python test_mcp_server.py
```

This tests:
- ✅ Basic functionality (new_game, make_move, get_ai_move)
- ✅ Engine connectivity
- ✅ Database operations
- ✅ ADN integration
- ✅ Cache management

### Logs and Debugging

Enable verbose logging:
```powershell
$env:AI_GAMES_COLLECTION_MCP_LOG_LEVEL = "DEBUG"
```

View logs in stderr output when running MCP server.

### Performance Issues

- **Slow analysis**: Reduce `depth` parameter (default: 15, max: 25)
- **Memory usage**: Analysis cache auto-cleans every 24 hours
- **Concurrent games**: Unlimited simultaneous games supported

---

## 🏗️ Architecture

### Components

#### 1. MCP Server (`mcp_server.py`)
- FastMCP 2.14.3+ implementation
- Tool registration and routing
- Windows stdio compatibility
- SEP-1577 Sampling integration

#### 2. Database Layer (`database.py`)
- SQLite persistence
- Game state management
- Analysis caching
- Player statistics

#### 3. ADN Integration (`adn_integration.py`)
- Knowledge management
- Analysis note creation
- Strategy search

#### 4. Enhanced AI Manager (`enhanced_ai_manager.py`)
- Engine configuration
- Health monitoring
- Performance optimization

### Data Flow

```
User Request → MCP Server → Tool Execution → Database/Engine → ADN → Response
```

### Ports and Endpoints

- **Stockfish**: `http://localhost:11211/api/*`
- **YaneuraOu**: `http://localhost:11212/api/*`
- **KataGo**: `http://localhost:11213/api/*`
- **P2P Sync**: Firebase Realtime DB (europe-west1)
- **KataGo**: `http://localhost:10002/api/*`
- **YaneuraOu**: `http://localhost:10003/api/*`

### Security

- Input validation on all parameters
- Command injection protection
- Safe file path handling
- Database query parameterization

---

## 📚 API Reference

### Tool Signatures

All tools return dictionaries with `success` boolean and relevant data fields.

#### Core Tools
```python
async def make_move(game_id: str, move: str, game_type: str = "chess", fen: Optional[str] = None) -> Dict[str, Any]
async def get_ai_move(game_type: str = "chess", position: Optional[str] = None, game_id: Optional[str] = None, depth: int = 15, skill_level: int = 20, movetime: int = 2000) -> Dict[str, Any]
async def get_game_state(game_id: str) -> Dict[str, Any]
async def new_game(game_type: str = "chess", game_id: Optional[str] = None) -> Dict[str, Any]
```

#### Analysis Tools
```python
async def analyze_position(game_type: str = "chess", position: Optional[str] = None, game_id: Optional[str] = None, depth: int = 20) -> Dict[str, Any]
async def analyze_position_detailed(game_type: str = "chess", position: Optional[str] = None, game_id: Optional[str] = None, depth: int = 20, analysis_type: str = "full") -> Dict[str, Any]
```

#### Tournament Tools
```python
async def create_tournament(tournament_id: str, game_type: str = "chess", max_players: int = 8, time_control: str = "blitz") -> Dict[str, Any]
async def register_for_tournament(tournament_id: str, player_id: str) -> Dict[str, Any]
```

#### Training Tools
```python
async def generate_puzzle(game_type: str = "chess", difficulty: str = "intermediate", theme: Optional[str] = None) -> Dict[str, Any]
```

#### Statistics Tools
```python
async def get_player_statistics(player_id: str, game_type: Optional[str] = None, timeframe: str = "all") -> Dict[str, Any]
async def update_player_rating(player_id: str, game_type: str, opponent_rating: float, result: str, game_id: Optional[str] = None) -> Dict[str, Any]
```

#### System Tools
```python
async def check_engine_status(game_type: str = "chess") -> Dict[str, Any]
async def get_system_status(include_engines: bool = True, include_database: bool = True, include_adn: bool = True) -> Dict[str, Any]
async def cleanup_cache(older_than_hours: int = 24) -> Dict[str, Any]
```

#### Knowledge Tools
```python
async def search_game_knowledge(query: str, game_type: Optional[str] = None, max_results: int = 5) -> Dict[str, Any]
async def create_analysis_note(game_id: str, game_type: str = "chess", position: Optional[str] = None, analysis_depth: int = 15) -> Dict[str, Any]
```

### Response Format

All tools return consistent response format:

```python
{
    "success": bool,           # Operation success
    "message": str,           # Human-readable message
    "error": str,             # Error message (if success=False)
    # ... tool-specific data fields
}
```

---

## 📄 License

Same as ai-games-collection project.

---

## 🤝 Contributing

1. Test changes with `python test_mcp_server.py`
2. Follow existing code patterns
3. Add documentation for new tools
4. Update tests for new functionality

---

## 📞 Support

For issues:
1. Check engine status: `check_engine_status("chess")`
2. Run system diagnostics: `get_system_status()`
3. Check logs for detailed error information
4. Verify MCP configuration in client settings
