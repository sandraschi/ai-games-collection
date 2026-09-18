import React, { useState } from 'react';
import './App.css';
import ChessBoard from './components/ChessBoard';
import ToolsExplorer from './components/ToolsExplorer';
import FloatingChat from './components/FloatingChat';
import { apiClient, type SystemStatus } from './utils/mcp_client';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [helpTab, setHelpTab] = useState('ai-games-collection');
  const [kibitzerLoading, setKibitzerLoading] = useState(false);
  const [kibitzerResult, setKibitzerResult] = useState<any>(null);
  const [kibitzerError, setKibitzerError] = useState<string | null>(null);
  const [chessStatus, setChessStatus] = useState<string | null>(null);
  const [sharedSessions, setSharedSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<any>(null);
  const [lobbyMessage, setLobbyMessage] = useState<string | null>(null);
  const [newGameType, setNewGameType] = useState('chess');
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);

  React.useEffect(() => {
    const updateStatus = async () => {
      try {
        const status = await apiClient.getStatus();
        setSystemStatus(status);
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadChessHealth = async () => {
    try {
      const res = await apiClient.callTool('check_engine_health', { game_type: 'chess' });
      const sc = res?.structuredContent ?? res?.result?.structuredContent;
      setChessStatus(sc?.engines?.chess?.status ?? 'unknown');
    } catch {
      setChessStatus(null);
    }
  };

  const evalToWinPct = (evalData: any): number | null => {
    let cp: number | null = null;
    if (typeof evalData === 'number') cp = evalData;
    else if (evalData && typeof evalData === 'object') {
      if (typeof evalData.value === 'number') cp = evalData.value;
      else if (typeof evalData.cp === 'number') cp = evalData.cp;
    }
    if (cp === null) return null;
    if (cp >= 1000) return 99.5;
    if (cp <= -1000) return 0.5;
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  };

  const analyzePosition = async () => {
    setKibitzerLoading(true);
    setKibitzerResult(null);
    setKibitzerError(null);
    try {
      const res = await apiClient.callTool('get_ai_move', { game_type: 'chess', position: fen, depth: 18 });
      const sc = res?.structuredContent ?? res?.result?.structuredContent;
      if (res?.isError || sc?.success === false) {
        setKibitzerError(sc?.error ?? 'Analysis failed');
        await loadChessHealth();
      } else if (sc) {
        setKibitzerResult(sc);
      } else {
        setKibitzerError('No analysis result returned');
      }
    } catch (e: any) {
      setKibitzerError(e.message ?? String(e));
      setChessStatus(null);
    } finally {
      setKibitzerLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeTab !== 'kibitzer') return;
    loadChessHealth();
    const interval = setInterval(loadChessHealth, 15000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadSharedSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await apiClient.callTool('list_shared_sessions', { limit: 20, status_filter: 'active' });
      const sc = res?.structuredContent ?? res?.result?.structuredContent;
      setSharedSessions(sc?.sessions ?? []);
      setFirebaseStatus(sc?.firebase ?? null);
    } catch (e: any) {
      setSharedSessions([]);
      setFirebaseStatus({ configured: false, mock: true, error: e.message ?? String(e) });
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleCreateGame = async () => {
    setLobbyMessage(null);
    try {
      const res = await apiClient.callTool('new_game', { game_type: newGameType, host_name: 'Dashboard' });
      const sc = res?.structuredContent ?? res?.result?.structuredContent;
      if (sc?.success) {
        setLobbyMessage(`Game created: ${sc.game_id} (${newGameType})`);
      } else {
        setLobbyMessage(`Failed: ${sc?.error ?? 'unknown error'}`);
      }
      await loadSharedSessions();
    } catch (e: any) {
      setLobbyMessage(`Failed: ${e.message ?? String(e)}`);
    }
  };

  React.useEffect(() => {
    if (activeTab !== 'multiplayer') return;
    loadSharedSessions();
    const interval = setInterval(loadSharedSessions, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'multiplayer', label: 'Multiplayer', icon: '🌐' },
    { id: 'kibitzer', label: 'Chess Kibitzer', icon: '♟' },
    { id: 'tools', label: 'MCP Tools', icon: '🛠' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'help', label: 'Help', icon: '❓' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
  ];

  return (
    <div className="kibitzer-layout">
      <div className="premium-bg"></div>

      <header className="topbar glass-panel animate-fade-in">
        <div className="logo">
          <span className="logo-icon">🎮</span>
          <h1 className="logo-text">AI Games Collection MCP <span className="sota-badge">v{systemStatus?.version ?? '2.5.0'}</span></h1>
        </div>
        <div className="system-status">
          <span className={`status-indicator ${backendOnline ? 'online' : 'offline'}`}></span>
          <span className="status-text">System: {backendOnline ? 'Online' : 'Offline'}</span>
        </div>
      </header>

      <aside className="sidebar glass-panel animate-fade-in delay-1">
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content glass-panel animate-fade-in delay-2">
        {activeTab === 'dashboard' && (
          <div className="dashboard-view">
            <section className="dashboard-hero glass-panel" data-testid="dashboard-hero">
              <span className="dashboard-hero__eyebrow">AI Games Collection</span>
              <h2 className="dashboard-hero__title">150+ games. Real AI opponents.</h2>
              <p className="dashboard-hero__subtitle">
                Chess, Go, Shogi, Othello, Backgammon, arcade classics and Japanese learning — powered by
                Stockfish, KataGo and YaneuraOu. All free, all local.
              </p>
              <div className="dashboard-hero__actions">
                <a
                  href="http://localhost:10987"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="premium-button premium-button--large dashboard-hero__cta"
                  data-testid="hero-play-games"
                >
                  Play Games
                </a>
                <button
                  className="premium-button premium-button--ghost"
                  onClick={() => setActiveTab('kibitzer')}
                  data-testid="hero-kibitzer"
                >
                  Analyze a chess position
                </button>
              </div>
            </section>

            <section className="backend-status glass-panel" data-testid="backend-status">
              <span className={`status-indicator ${backendOnline ? 'online' : 'offline'}`}></span>
              <span>
                {backendOnline
                  ? `${systemStatus?.server ?? 'Games Collection'} v${systemStatus?.version ?? ''} is online`
                  : 'Backend offline — start the stack to play'}
              </span>
            </section>

            <section className="dashboard-section" data-testid="games-categories">
              <h3 className="dashboard-section__title">Browse games</h3>
              <div className="dashboard-grid">
                <a className="category-card glass-panel" href="http://localhost:10987/#board-games" target="_blank" rel="noopener noreferrer" data-testid="cat-board-games">
                  <span className="category-card__icon">♟</span>
                  <span className="category-card__name">Board Games</span>
                  <span className="category-card__desc">Chess, Go, Shogi, Backgammon, Othello</span>
                </a>
                <a className="category-card glass-panel" href="http://localhost:10987/#arcade" target="_blank" rel="noopener noreferrer" data-testid="cat-arcade">
                  <span className="category-card__icon">🕹</span>
                  <span className="category-card__name">Arcade Classics</span>
                  <span className="category-card__desc">Snake, Tetris, Pac-Man, Breakout</span>
                </a>
                <a className="category-card glass-panel" href="http://localhost:10987/#puzzle" target="_blank" rel="noopener noreferrer" data-testid="cat-puzzle">
                  <span className="category-card__icon">🧩</span>
                  <span className="category-card__name">Puzzles & Cards</span>
                  <span className="category-card__desc">Sudoku, Mahjong, Solitaire, Rummy</span>
                </a>
                <a className="category-card glass-panel" href="http://localhost:10987/#japanese" target="_blank" rel="noopener noreferrer" data-testid="cat-japanese">
                  <span className="category-card__icon">🇯🇵</span>
                  <span className="category-card__name">Japanese Learning</span>
                  <span className="category-card__desc">Kanji, JLPT, kana & vocab games</span>
                </a>
              </div>
            </section>

            <section className="dashboard-section" data-testid="engines-section">
              <h3 className="dashboard-section__title">AI engines</h3>
              {backendOnline ? (
                <div className="engines-list glass-panel">
                  <div className="engine-row">
                    <span>Stockfish</span>
                    <span className="color-secondary">Chess · port 11211</span>
                  </div>
                  <div className="engine-row">
                    <span>YaneuraOu</span>
                    <span className="color-secondary">Shogi · port 11212</span>
                  </div>
                  <div className="engine-row">
                    <span>KataGo</span>
                    <span className="color-secondary">Go · port 11213</span>
                  </div>
                </div>
              ) : (
                <p className="color-secondary">Engine details appear here when the backend is online.</p>
              )}
            </section>
          </div>
        )}

        {activeTab === 'kibitzer' && (
          <div className="kibitzer-view">
            <div className="view-header">
              <h2>Chess Kibitzer</h2>
              <div className="actions">
                <input
                  type="text"
                  value={fen}
                  onChange={(e) => setFen(e.target.value)}
                  className="fen-input glass-input"
                  placeholder="FEN String"
                  data-testid="kibitzer-fen"
                />
                <button
                  className="premium-button"
                  onClick={analyzePosition}
                  disabled={kibitzerLoading}
                  data-testid="kibitzer-analyze"
                >
                  {kibitzerLoading ? 'Analyzing...' : 'Analyze Position'}
                </button>
              </div>
            </div>
            <div className="board-container">
              <ChessBoard fen={fen} />
              <div className="game-sidebar glass-panel">
                <div className="info-section">
                  <h4>Engine Status</h4>
                  <div className={`engine-status engine-status--${chessStatus === 'online' ? 'ok' : 'off'}`}>
                    <span className="status-indicator"></span>
                    <span>
                      Stockfish (port 11211): {chessStatus === 'online' ? 'online' : chessStatus ?? 'unknown'}
                    </span>
                  </div>
                  {chessStatus !== 'online' && (
                    <p className="color-secondary" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                      Analysis needs the Stockfish engine running in the Docker stack. Start it with{' '}
                      <code>docker compose up -d</code>, then re-analyze.
                    </p>
                  )}
                </div>

                <div className="info-section">
                  <h4>Analysis</h4>
                  {kibitzerLoading && (
                    <p className="engine-msg">Calculating... (depth 18)</p>
                  )}
                  {kibitzerError && !kibitzerLoading && (
                    <div className="analysis-error">
                      <p className="engine-msg">{kibitzerError}</p>
                      <button
                        className="premium-button"
                        style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }}
                        onClick={analyzePosition}
                        data-testid="kibitzer-retry"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {kibitzerResult && !kibitzerLoading && (
                    <>
                      <div className="analysis-summary">
                        <div className="eval-bar-container">
                          <div className="eval-bar">
                            <div
                              className="eval-fill eval-fill-dynamic"
                              style={{ '--eval-height': `${evalToWinPct(kibitzerResult.evaluation) ?? 50}%` } as React.CSSProperties}
                            ></div>
                            <span className="eval-value">
                              {typeof kibitzerResult.evaluation === 'object' && kibitzerResult.evaluation?.value != null
                                ? kibitzerResult.evaluation.value
                                : kibitzerResult.evaluation ?? '--'}
                            </span>
                          </div>
                        </div>
                        <div className="analysis-text">
                          <p className="best-move">
                            Best move: <span className="move-highlight">{kibitzerResult.move ?? '--'}</span>
                          </p>
                          <p className="engine-msg">
                            Engine: {kibitzerResult.engine ?? 'Integrated Engine'} · depth 18
                          </p>
                        </div>
                      </div>
                      <p className="color-secondary" style={{ fontSize: 13, marginTop: 8 }}>
                        FEN analyzed: {fen.slice(0, 60)}{fen.length > 60 ? '...' : ''}
                      </p>
                    </>
                  )}
                  {!kibitzerLoading && !kibitzerResult && !kibitzerError && (
                    <p className="engine-msg">Enter a FEN and press Analyze Position to get a real engine evaluation.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'multiplayer' && (
          <div className="multiplayer-lobby fade-in">
            <div className="view-header">
              <h3>Game Lobby</h3>
              <div className="actions">
                <select
                  className="glass-input"
                  value={newGameType}
                  onChange={(e) => setNewGameType(e.target.value)}
                  title="Game type"
                  data-testid="lobby-game-type"
                  style={{ maxWidth: 160 }}
                >
                  <option value="chess">Chess</option>
                  <option value="shogi">Shogi</option>
                  <option value="go">Go</option>
                  <option value="othello">Othello</option>
                  <option value="backgammon">Backgammon</option>
                  <option value="hex">Hex</option>
                  <option value="open_spiel">OpenSpiel</option>
                </select>
                <button
                  className="premium-button"
                  onClick={handleCreateGame}
                  data-testid="lobby-create"
                >
                  Create New Game
                </button>
              </div>
            </div>
            {lobbyMessage && (
              <p className="mt-12" style={{ color: lobbyMessage.startsWith('Failed') ? '#ef4444' : '#22c55e' }} data-testid="lobby-message">
                {lobbyMessage}
              </p>
            )}
            <div className="dashboard-grid mt-24">
              <div className="glass-card stats-card">
                <span className="stat-label">Backend</span>
                <span className="stat-value">{backendOnline ? 'Online' : 'Offline'}</span>
                <span className="stat-trend positive">FastAPI + FastMCP</span>
              </div>
              <div className="glass-card stats-card">
                <span className="stat-label">Version</span>
                <span className="stat-value">{systemStatus?.version ?? '--'}</span>
                <span className="stat-trend">MCP {systemStatus?.server ?? ''}</span>
              </div>
              <div className="glass-card stats-card">
                <span className="stat-label">Firebase Sync</span>
                <span className="stat-value">
                  {firebaseStatus === null
                    ? 'Detecting...'
                    : firebaseStatus.configured
                      ? 'Configured'
                      : 'Not configured'}
                </span>
                <span className={`stat-trend ${firebaseStatus?.configured ? 'positive' : ''}`}>
                  {firebaseStatus?.configured
                    ? 'Realtime Database'
                    : firebaseStatus?.auth_error
                      ? 'Invalid credentials'
                      : 'Set FIREBASE_SERVICE_ACCOUNT_JSON + FIREBASE_DATABASE_URL'}
                </span>
              </div>
            </div>
            <div className="glass-card mt-24 p-24">
              <h4>Active Shared Sessions ({sharedSessions.length})</h4>
              <p className="color-secondary mb-12">
                Sessions are stored in the Firebase Realtime Database under <code>games/</code> — the same
                nodes the browser multiplayer UI (multiplayer.js, chess-multiplayer.js) reads and writes.
              </p>
              {sessionsLoading && sharedSessions.length === 0 && (
                <p className="color-secondary">Loading sessions...</p>
              )}
              {!sessionsLoading && sharedSessions.length === 0 && (
                <p className="color-secondary" data-testid="lobby-empty">
                  {firebaseStatus?.configured
                    ? 'No active sessions right now. Create one to get started.'
                    : 'Firebase sync is not configured, so no sessions can be listed. Configure the service account to enable multiplayer.'}
                </p>
              )}
              <div className="tools-list">
                {sharedSessions.map((s: any) => (
                  <div className="tool-item" key={s.game_id} data-testid="lobby-session">
                    <strong>{s.game_id}</strong> - {s.type} ({s.status}, {s.player_count ?? 0} player
                    {s.player_count === 1 ? '' : 's'})
                    {s.host_name ? `, host: ${s.host_name}` : ''}
                    {s.last_move ? `, last: ${s.last_move}` : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <ToolsExplorer />
        )}

        {activeTab === 'settings' && (
          <div className="settings-view fade-in">
            <h3>System Settings</h3>
            <div className="glass-card mt-24 p-32 settings-group">
              <div className="setting-group">
                <label>AI Games Collection Connection (Docker)</label>
                <p className="color-secondary">
                  This dashboard must connect to the main ai games collection running in Docker on port 10987.
                  Status: {backendOnline ? 'connected' : 'offline — run docker compose up -d first'}.
                </p>
                <a
                  href="http://localhost:10987"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="premium-button mt-12"
                  style={{ textDecoration: 'none', textAlign: 'center', display: 'inline-block' }}
                >
                  Open AI Games Collection
                </a>
              </div>
            </div>
            <div className="glass-card mt-24 p-32 settings-group">
              <div className="setting-group">
                <label>MCP Bridge URL</label>
                <input type="text" id="bridge-url" className="glass-input w-full mt-8" value="http://127.0.0.1:10987" readOnly title="MCP Bridge URL" />
              </div>
              <div className="setting-group">
                <label>Polling Interval (ms)</label>
                <input type="number" id="polling-interval" className="glass-input w-full mt-8" value="5000" readOnly title="Polling Interval (ms)" />
              </div>
              <div className="setting-group">
                <label>Engine Depth</label>
                <select id="engine-depth" className="glass-input w-full mt-8" title="Engine Depth">
                  <option>Standard (12)</option>
                  <option>Deep (18)</option>
                  <option>Extreme (24)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <div className="help-view fade-in">
            <div className="view-header">
              <h2>Help & Documentation</h2>
            </div>
            <div className="help-tabs" role="tablist" aria-label="Help sections">
              {[
                { id: 'ai-games-collection', label: 'AI Games Collection' },
                { id: 'engines', label: 'Engines & Ports' },
                { id: 'mcp', label: 'MCP & Tools' },
                { id: 'kibitzer', label: 'Kibitzer' },
                { id: 'troubleshooting', label: 'Troubleshooting' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={helpTab === tab.id}
                  className={`help-tab ${helpTab === tab.id ? 'help-tab--active' : ''}`}
                  onClick={() => setHelpTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {helpTab === 'ai-games-collection' && (
              <div className="help-panel">
                <h4>Connecting to the AI Games Collection (Docker)</h4>
                <p className="color-secondary lh-1-6">
                  The AI Games Collection MCP dashboard is a control panel for the <strong>Games Collection app</strong> — the
                  main games frontend that runs inside the Docker stack on port <code>10987</code>. The dashboard
                  and all MCP tools are <strong>unusable until that app is running</strong>.
                </p>
                <div className="doc-card glass-panel">
                  <h4>Step 1 — Start the Docker stack</h4>
                  <p className="color-secondary">From the ai-games-collection repo root:</p>
                  <pre className="code-block">docker compose up -d</pre>
                  <p className="color-secondary lh-1-6">
                    This launches the gateway (port <code>10987</code>) plus all seven AI engines
                    (Stockfish 11211, YaneuraOu 11212, KataGo 11213, Edax 11214, GNU Backgammon 11215,
                    OpenSpiel 11216, MoHex 10775). First start builds the engine images, so allow a few minutes.
                  </p>
                </div>
                <div className="doc-card glass-panel">
                  <h4>Step 2 — Verify the connection</h4>
                  <p className="color-secondary lh-1-6">
                    This dashboard polls the gateway health endpoint every 5 seconds. When the ai games collection is up,
                    the top-right status shows <strong>Online</strong> and the dashboard banner turns green.
                    The games collection itself opens at{' '}
                    <a href="http://localhost:10987" target="_blank" rel="noopener noreferrer">http://localhost:10987</a>.
                  </p>
                  <div className="docker-banner__status mt-12">
                    <span className={`status-indicator ${backendOnline ? 'online' : 'offline'}`}></span>
                    <span>{backendOnline ? 'Connected to AI Games Collection on port 10987' : 'Not connected — run docker compose up -d'}</span>
                  </div>
                </div>
                <div className="doc-card glass-panel">
                  <h4>Step 3 - Stop the stack</h4>
                  <pre className="code-block">docker compose down</pre>
                </div>
                <p className="color-secondary mt-12">
                  Naked-PC fallback: instead of Docker you can start each engine directly with{' '}
                  <code>uv run python engines/&lt;engine&gt;-server.py</code> — but the Docker stack is the
                  supported path.
                </p>
              </div>
            )}

            {helpTab === 'engines' && (
              <div className="help-panel">
                <h4>Engine Ports</h4>
                <p className="color-secondary mb-12">Standardized fleet ports for all AI engines (Docker services on the games-net network).</p>
                <div className="help-table">
                  <div className="help-table__row help-table__row--head">
                    <span>Engine</span><span>Game</span><span>Port</span>
                  </div>
                  <div className="help-table__row"><span>Stockfish</span><span>Chess</span><span>11211</span></div>
                  <div className="help-table__row"><span>YaneuraOu</span><span>Shogi</span><span>11212</span></div>
                  <div className="help-table__row"><span>KataGo</span><span>Go</span><span>11213</span></div>
                  <div className="help-table__row"><span>Edax</span><span>Othello</span><span>11214</span></div>
                  <div className="help-table__row"><span>GNU Backgammon</span><span>Backgammon</span><span>11215</span></div>
                  <div className="help-table__row"><span>OpenSpiel</span><span>119 games</span><span>11216</span></div>
                  <div className="help-table__row"><span>MoHex</span><span>Hex</span><span>10775</span></div>
                  <div className="help-table__row"><span>Gateway (FastAPI + FastMCP)</span><span>REST / MCP / webapp</span><span>10987</span></div>
                  <div className="help-table__row"><span>Dashboard (Vite dev)</span><span>React control panel</span><span>10986</span></div>
                </div>
                <p className="color-secondary mt-12">
                  Engine REST APIs: <code>/api/status</code> health check per engine. See{' '}
                  <code>docs/ENGINES.md</code> for the full API surface.
                </p>
              </div>
            )}

            {helpTab === 'mcp' && (
              <div className="help-panel">
                <h4>MCP Integration</h4>
                <p className="color-secondary lh-1-6">
                  The gateway exposes the AI Games Collection MCP server at <code>http://localhost:10987/mcp</code> (streamable
                  HTTP). Connect it from Claude Desktop, Cursor, or opencode so agents can analyze positions,
                  manage games, and orchestrate engines. The MCP Tools tab lists the live tool surface.
                </p>
                <div className="doc-card glass-panel">
                  <h4>Claude Desktop config snippet</h4>
                  <pre className="code-block">{`"mcpServers": {
  "ai-games-collection-mcp": {
    "url": "http://127.0.0.1:10987/mcp"
  }
}`}</pre>
                </div>
                <div className="doc-card glass-panel">
                  <h4>Tool families</h4>
                  <p className="color-secondary lh-1-6">
                    Analysis (per-move engine comparison, FEN generator), Gameplay (play/move/undo), Management
                    (engine lifecycle, status), Orchestration (multi-engine workflows). Use the{' '}
                    <a href="https://github.com/sandraschi/ai-games-collection/blob/master/ai-games-collection-mcp/README.md" target="_blank" rel="noopener noreferrer">
                      ai-games-collection-mcp README
                    </a>{' '}
                    for full tool reference.
                  </p>
                </div>
              </div>
            )}

            {helpTab === 'kibitzer' && (
              <div className="help-panel">
                <h4>Chess Kibitzer</h4>
                <p className="color-secondary lh-1-6">
                  Paste a FEN string into the input to analyze any board position. The engine evaluation bar and
                  best-move hint come from the Stockfish service (port 11211) inside the Docker stack — analysis
                  requires the ai games collection to be running.
                </p>
                <div className="doc-card glass-panel">
                  <h4>Starting FEN</h4>
                  <pre className="code-block">rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR</pre>
                  <p className="color-secondary mt-12">
                    Multiplayer (Game Lobby) mirrors remote sessions via Firebase; sessions appear once a game is
                    created.
                  </p>
                </div>
              </div>
            )}

            {helpTab === 'troubleshooting' && (
              <div className="help-panel">
                <h4>Troubleshooting</h4>
                <div className="doc-card glass-panel">
                  <h4>Dashboard shows Offline</h4>
                  <p className="color-secondary lh-1-6">
                    The ai games collection is not reachable on port <code>10987</code>. Run{' '}
                    <code>docker compose up -d</code> in the ai-games-collection repo, then wait for the gateway health
                    check (<code>curl http://localhost:10987/health</code> → <code>{'{'}"status":"ok"{'}'}</code>).
                  </p>
                </div>
                <div className="doc-card glass-panel">
                  <h4>Engine port conflict</h4>
                  <p className="color-secondary lh-1-6">
                    If an engine fails to start, something else occupies its port. Check with{' '}
                    <code>Get-NetTCPConnection -LocalPort 11211</code> and kill the zombie, then restart the
                    stack.
                  </p>
                </div>
                <div className="doc-card glass-panel">
                  <h4>Docker Up hangs</h4>
                  <p className="color-secondary lh-1-6">
                    First build compiles engines from source and can take several minutes. The endpoint times out
                    after 120s; re-run or use <code>docker compose up -d --build</code> from a terminal to watch
                    progress.
                  </p>
                </div>
                <div className="doc-card glass-panel">
                  <h4>MCP tool fails</h4>
                  <p className="color-secondary lh-1-6">
                    Confirm the gateway is running (<code>/health</code>) and the engine the tool needs is up
                    (check its <code>/api/status</code>). See the logs modal for the last JSON-RPC traffic.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="about-view fade-in">
            <h3>About AI Games Collection MCP</h3>
            <div className="glass-card mt-24 p-32">
              <p><strong>Version:</strong> {systemStatus?.version ?? '2.5.0'}-SOTA</p>
              <p className="mt-24 color-secondary lh-1-6">
                The AI Games Collection MCP server is a state-of-the-art platform for algorithmic game analysis,
                coaching, and decentralized multiplayer coordination. Built on the Model Context Protocol,
                it enables seamless integration between AI models and complex game engines like Stockfish.
              </p>
              <div className="about-meta mt-24 gap-12">
                <span className="sota-badge">MATERIALIST</span>
                <span className="sota-badge">REDUCTIONIST</span>
                <span className="sota-badge">VIENNA-ALSERGRUND</span>
              </div>
            </div>
          </div>
        )}
      </main>
      <FloatingChat />
    </div>
  );
};

export default App;
