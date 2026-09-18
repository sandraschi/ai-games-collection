const API = 'http://localhost:11216';

let games = [];
let selectedGame = null;
let gameState = '';
let legalActions = [];
let lastAction = null;
let isTerminal = false;
let returns = null;
let moveHistory = [];
let currentPlayer = 0;
let mode = 'human';
let aiSims = 200;
let gameParams = {};
let currentCategory = 'all';

const CATEGORIES = {
    'Board': ['chess','go','othello','checkers','breakthrough','amazons','quoridor','hex','clobber','dots_and_boxes',
              'kerr','hackenbush','y','shove','nine_mens_morris','muehle','backgammon','poker','gin_rummy','hearts',
              'spades','bridge','crazy_eights','old_maid','war','blackjack','solitaire','mancala','awari','oware',
              'kalah','morpion_solitaire','gomoku','connect_four','tic_tac_toe','phantom_ttt','ultimate_ttt',
              '2048','rubiks','lights_out','minesweeper','pente','nim','sheriff','bargaining','negotiation'],
    'Card': ['kuhn_poker','leduc_poker','oh_hell','hearts','spades','bridge','crazy_eights','old_maid','war',
             'blackjack','gin_rummy','euchre','skat','tarock','schnapsen','dummy','whist'],
    'Dice': ['pig','backgammon','craps','yahtzee','shut_the_box','can_not_stop','race'],
    'Grid': ['tic_tac_toe','connect_four','othello','go','hex','breakthrough','amazons','clobber','dots_and_boxes',
             'gomoku','pente','phantom_go','nine_mens_morris','kerr','quoridor','muehle','hackenbush','y','shove',
             'solitaire','morpion_solitaire','ultimate_ttt','lights_out','minesweeper','2048','rubiks'],
    'Poker': ['kuhn_poker','leduc_poker','texas_holdem','universal_poker'],
    'Toy': ['tiny_hanabi','first_sealed_auction','pig','liars_dice','prisoners_dilemma','traveling_salesman',
            'battleship','cursor_go','stones_and_gems','markov_soccer','cooperative_box','reward_game',
            'blotto','block_domino','colored_trails','dark_hex','dark_schelling','decco','farkle','garnet',
            'git','havannah','hive','laser_tag','lewthwaite','ludilo','mastermind','matching_pennies',
            'matrix_game','minority_game','misere','mosh','okey','oware','pathfinder','pentago','phantom',
            'push_fight','race','santorini','sheriff','shut_the_box','skat','splendor','sushi','taboo',
            'take_away','tarok','ticket_to_ride','toot_and_otto','turn_based','turnout','vier_gewinnt',
            'word_game','x2','zendo'],
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameList = document.getElementById('gameList');
const gameCount = document.getElementById('gameCount');
const gameArea = document.getElementById('gameArea');
const gameStatus = document.getElementById('gameStatus');
const actionList = document.getElementById('actionList');
const stateDisplay = document.getElementById('stateDisplay');
const gameParamsEl = document.getElementById('gameParams');

async function fetchGames() {
    try {
        const resp = await fetch(API + '/api/games');
        const data = await resp.json();
        if (data.success) games = data.games;
    } catch (e) {
        gameStatus.textContent = 'Cannot reach OpenSpiel server at ' + API;
    }
    renderCategoryTabs();
    renderGameList();
}

function getCategory(gameName) {
    for (const [cat, names] of Object.entries(CATEGORIES))
        if (names.includes(gameName)) return cat;
    return 'Other';
}

function renderCategoryTabs() {
    const cats = new Set();
    games.forEach(g => cats.add(getCategory(g.name)));
    const sorted = ['Board', 'Grid', 'Card', 'Dice', 'Poker', 'Toy', 'Other'].filter(c => cats.has(c));
    const html = '<div class="cat-tab active" data-cat="all" onclick="filterCategory(\'all\')">All (' + games.length + ')</div>' +
        sorted.map(c => '<div class="cat-tab" data-cat="' + c + '" onclick="filterCategory(\'' + c + '\')">' + c + '</div>').join('');
    document.getElementById('catTabs').innerHTML = html;
}

function filterCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    filterGames();
}

function renderGameList() {
    const q = document.getElementById('searchBox').value.toLowerCase();
    const filtered = games.filter(g => {
        if (currentCategory !== 'all' && getCategory(g.name) !== currentCategory) return false;
        return g.name.includes(q) || g.long_name.toLowerCase().includes(q);
    });
    gameCount.textContent = filtered.length + ' of ' + games.length + ' games';
    gameList.innerHTML = filtered.map(g => {
        const cats = getCategory(g.name);
        const params = g.parameters ? Object.keys(g.parameters).join(', ') : 'no params';
        const tooltip = (g.long_name !== g.name ? g.long_name + ' (' + g.name + ')' : g.name) + ' · ' + g.players + ' players · ' + cats + ' · ' + params;
        return '<div class="game-card' + (selectedGame === g.name ? ' selected' : '') + '" ' +
        'onclick="selectGame(\'' + g.name + '\')">' +
        '<div class="name">' + g.long_name + '</div>' +
        '<div class="meta">' + g.name + ' · ' + g.players + 'p · ' + cats + '</div>' +
        '<div class="tooltip">' + tooltip + '</div>' +
        '</div>';
    }).join('');
}

function filterGames() { renderGameList(); }

function selectGame(name) {
    selectedGame = name;
    gameArea.classList.add('active');
    renderGameList();
    const g = games.find(x => x.name === name);
    gameParamsEl.innerHTML = '';
    if (g && g.parameters) {
        const keys = Object.keys(g.parameters);
        if (keys.length > 0) {
            let html = '<strong style="color:#aaa;font-size:13px;">Parameters:</strong> ';
            for (const k of keys) {
                const p = g.parameters[k];
                html += '<label>' + k.replace(/_/g, ' ') + ' <input type="text" id="param_' + k + '" value="' + (p.default_value || '') + '" size="4"></label> ';
            }
            gameParamsEl.innerHTML = html;
        }
    }
    startGame();
}

function buildParams() {
    const g = games.find(x => x.name === selectedGame);
    if (!g || !g.parameters) return null;
    const keys = Object.keys(g.parameters);
    if (keys.length === 0) return null;
    const p = {};
    for (const k of keys) {
        const el = document.getElementById('param_' + k);
        if (el) p[k] = el.value;
    }
    return p;
}

async function startGame() {
    if (!selectedGame) return;
    moveHistory = [];
    isTerminal = false;
    returns = null;
    gameState = '';
    legalActions = [];
    lastAction = null;
    gameParams = buildParams();

    gameStatus.textContent = 'Starting ' + selectedGame + '...';
    const ai = mode === 'human' ? 'mcts' : mode;
    try {
        const resp = await fetch(API + '/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game: selectedGame,
                state: '',
                player: 0,
                ai: 'mcts',
                simulations: 100,
                params: gameParams && Object.keys(gameParams).length > 0 ? gameParams : null,
            }),
        });
        const data = await resp.json();
        if (data.success) {
            gameState = data.next_state || '';
            legalActions = data.legal_actions || [];
            isTerminal = data.is_terminal || false;
            returns = data.returns || null;
            updateUI(null);
            if (!isTerminal && mode !== 'human') {
                setTimeout(() => aiMove(0), 500);
            }
        } else {
            gameStatus.textContent = 'Error: ' + (data.error || 'Unknown');
        }
    } catch (e) {
        gameStatus.textContent = 'Error: ' + e.message;
    }
}

async function humanMove(action) {
    if (isTerminal) return;
    // Send user's action — we move first, then AI responds
    const result = await sendMove(action, 0);
    if (!result || isTerminal) return;

    // AI move (player 1)
    await aiMove(1);
}

async function sendMove(action, player) {
    try {
        const resp = await fetch(API + '/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game: selectedGame,
                state: gameState,
                player: player,
                action: action,
                ai: 'mcts',
                simulations: aiSims,
                params: gameParams && Object.keys(gameParams).length > 0 ? gameParams : null,
            }),
        });
        const data = await resp.json();
        if (data.success) {
            gameState = data.next_state || '';
            legalActions = data.legal_actions || [];
            isTerminal = data.is_terminal || false;
            returns = data.returns || null;
            updateUI(action);
            return data;
        } else {
            gameStatus.textContent = 'Error: ' + (data.error || 'Unknown');
            return null;
        }
    } catch (e) {
        gameStatus.textContent = 'Error: ' + e.message;
        return null;
    }
}

async function aiMove(player) {
    if (isTerminal || legalActions.length === 0) return;
    gameStatus.textContent = 'AI thinking (player ' + player + ')...';
    try {
        const resp = await fetch(API + '/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game: selectedGame,
                state: gameState,
                player: player,
                ai: 'mcts',
                simulations: aiSims,
                params: gameParams && Object.keys(gameParams).length > 0 ? gameParams : null,
            }),
        });
        const data = await resp.json();
        if (data.success) {
            gameState = data.next_state || '';
            legalActions = data.legal_actions || [];
            isTerminal = data.is_terminal || false;
            returns = data.returns || null;
            updateUI(data.action);

            if (!isTerminal && mode !== 'human' && legalActions.length > 0) {
                // AI vs AI — next player's AI move
                const nextPlayer = player === 0 ? 1 : 0;
                setTimeout(() => aiMove(nextPlayer), 300);
            } else if (!isTerminal && mode === 'human' && legalActions.length > 0) {
                gameStatus.textContent = 'Your move. Click an action.';
            }
        } else {
            gameStatus.textContent = 'AI error: ' + (data.error || 'Unknown');
        }
    } catch (e) {
        gameStatus.textContent = 'AI error: ' + e.message;
    }
}

function updateUI(action) {
    if (action) moveHistory.push(action);
    stateDisplay.textContent = 'State: ' + (gameState ? gameState.substring(0, 80) + '...' : '(new game)');

    if (isTerminal) {
        if (returns) {
            const scores = returns.map((r, i) => 'Player ' + i + ': ' + r).join(' &middot; ');
            gameStatus.innerHTML = '&#127942; Game over! ' + scores;
        } else {
            gameStatus.innerHTML = '&#127942; Game over';
        }
        actionList.innerHTML = '';
        drawBoard();
        return;
    }

    // Show legal actions as buttons
    let html = '';
    const maxShow = Math.min(legalActions.length, 60);
    for (let i = 0; i < maxShow; i++) {
        const a = legalActions[i];
        html += '<button onclick="humanMove(\'' + a + '\')">' + a + '</button>';
    }
    if (legalActions.length > 60) {
        html += '<span style="color:#666;font-size:12px;padding:6px;">... and ' + (legalActions.length - 60) + ' more</span>';
    }
    actionList.innerHTML = html;
    drawBoard();
}

function drawBoard() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Try to detect grid-based games and draw a board
    const gridGames = ['tic_tac_toe', 'connect_four', 'breakthrough', 'othello', 'go', 'hex', 'phantom_ttt',
        'amazons', 'quorom', 'clobber', 'dots_and_boxes', 'pig', 'kerr'];
    const isGrid = gridGames.some(g => selectedGame && selectedGame.includes(g));

    if (isGrid || legalActions.some(a => /^[a-z]\d+$/.test(a) || /^\d+$/.test(a))) {
        // Determine grid size from game
        let gridSize = 3;
        if (selectedGame && selectedGame.includes('connect_four')) gridSize = 7;
        else if (selectedGame && selectedGame.includes('othello')) gridSize = 8;
        else if (selectedGame && selectedGame.includes('breakthrough')) gridSize = 8;
        else if (selectedGame && selectedGame.includes('go')) gridSize = 9;
        else if (selectedGame && selectedGame.includes('hex')) gridSize = 11;
        else {
            const actionNums = legalActions.map(a => parseInt(a)).filter(n => !isNaN(n));
            if (actionNums.length > 0) {
                const maxAct = Math.max(...actionNums);
                gridSize = Math.ceil(Math.sqrt(maxAct + 1));
            }
        }
        const cellW = W / (gridSize + 1), cellH = H / (gridSize + 1);
        const ox = cellW / 2, oy = cellH / 2;

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const x = ox + c * cellW;
                const y = oy + r * cellH;
                ctx.strokeRect(x - cellW / 2 + 2, y - cellH / 2 + 2, cellW - 4, cellH - 4);
            }
        }

        // Label coordinates
        ctx.fillStyle = '#666';
        ctx.font = '11px monospace';
        for (let r = 0; r < gridSize; r++) {
            ctx.fillText((r + 1).toString(), 4, oy + r * cellH + 4);
        }
        for (let c = 0; c < gridSize; c++) {
            ctx.fillText(String.fromCharCode(97 + c), ox + c * cellW - 4, 14);
        }

        // If we have state info, try to render pieces
        // (basic rendering — shows action history on the board)
        for (let i = 0; i < moveHistory.length; i++) {
            const a = moveHistory[i];
            const isNum = /^\d+$/.test(a);
            let col, row;
            if (isNum) {
                const n = parseInt(a);
                col = n % gridSize;
                row = Math.floor(n / gridSize);
            } else if (/^[a-z]\d+$/.test(a)) {
                col = a.charCodeAt(0) - 97;
                row = parseInt(a.slice(1)) - 1;
            } else continue;
            if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) continue;

            const x = ox + col * cellW;
            const y = oy + row * cellH;
            ctx.beginPath();
            ctx.arc(x, y, Math.min(cellW, cellH) * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 === 0 ? '#e94560' : '#4a9eff';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    } else {
        // No board — show info text
        ctx.fillStyle = '#666';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No board preview for this game.', W / 2, H / 2 - 10);
        ctx.font = '13px sans-serif';
        ctx.fillText('Play using the action buttons below.', W / 2, H / 2 + 20);
    }
}

function undoMove() {
    if (moveHistory.length < 2) { startGame(); return; }
    moveHistory.pop(); // remove last AI move
    moveHistory.pop(); // remove last human move
    // Restart and replay up to moveHistory
    startGame();
}

function switchMode(newMode) {
    mode = newMode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab' + newMode.charAt(0).toUpperCase() + newMode.slice(1)).classList.add('active');
    if (selectedGame) startGame();
}

function showHelp() {
    document.getElementById('helpOverlay').classList.add('show');
}

fetchGames();
