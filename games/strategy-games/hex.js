const AI_URL = 'http://localhost:11210';

let board = [];
let size = 11;
let currentPlayer = 'black';
let gameOver = false;
let aiEnabled = false;
let aiThinking = false;
let aivsai = false;
let aivsaiTimer = null;
let moveCount = 0;
let moveHistory = [];     // Array of {r, c, player}
let replayIndex = -1;     // -1 = live mode, 0+ = viewing history
let savedGames = JSON.parse(localStorage.getItem('hex-saved-games') || '[]');

const canvas = document.getElementById('hexCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function initBoard() {
    board = [];
    for (let r = 0; r < size; r++) {
        board[r] = [];
        for (let c = 0; c < size; c++) board[r][c] = null;
    }
    currentPlayer = 'black';
    gameOver = false;
    moveCount = 0;
    aiThinking = false;
}

function boardToMohex() {
    const moves = [];
    for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
            if (board[r][c])
                moves.push(board[r][c] + ' ' + String.fromCharCode(97 + c) + (r + 1));
    return moves.join(', ');
}

function getAiLevel() {
    return parseInt(document.getElementById('aiLevel').value);
}

function checkWin(player) {
    const visited = Array.from({ length: size }, () => Array(size).fill(false));
    function dfs(r, c) {
        if (r < 0 || r >= size || c < 0 || c >= size) return false;
        if (visited[r][c] || board[r][c] !== player) return false;
        visited[r][c] = true;
        if (player === 'black' && r === size - 1) return true;
        if (player === 'white' && c === size - 1) return true;
        const dirs = [[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0]];
        for (const [dr, dc] of dirs)
            if (dfs(r + dr, c + dc)) return true;
        return false;
    }
    if (player === 'black')
        for (let c = 0; c < size; c++) if (board[0][c] === 'black' && dfs(0, c)) return true;
    if (player === 'white')
        for (let r = 0; r < size; r++) if (board[r][0] === 'white' && dfs(r, 0)) return true;
    return false;
}

function placeStone(r, c) {
    if (gameOver || board[r][c] || aiThinking || replayIndex >= 0) return false;
    if (aiEnabled && !aivsai && currentPlayer !== 'black') return false;
    board[r][c] = currentPlayer;
    moveCount++;
    moveHistory.push({r, c, player: currentPlayer});
    _saveToLocal();
    if (checkWin(currentPlayer)) {
        gameOver = true;
        statusEl.innerHTML = '<span class="turn-indicator turn-' + currentPlayer + '"></span>' + currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + ' wins!';
        drawBoard(); return true;
    }
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    drawBoard(); updateStatus();
    if (aiEnabled && !gameOver) {
        if (aivsai) {
            if (document.getElementById('aivsaiBtn').textContent === 'Stop') {
                aivsaiTimer = setTimeout(() => aiMoveFor(currentPlayer), 500);
            }
        } else if (currentPlayer === 'white') {
            setTimeout(aiMove, 300);
        }
    }
    return true;
}

function _saveToLocal() {
    try {
        const data = { size, moves: moveHistory, ts: Date.now() };
        localStorage.setItem('hex-last-game', JSON.stringify(data));
    } catch (_) {}
}

function _loadFromLocal() {
    try {
        const raw = localStorage.getItem('hex-last-game');
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data.moves || !data.moves.length) return false;
        size = data.size || 11;
        document.getElementById('sizeSelect').value = String(size);
        initBoard();
        for (const m of data.moves) {
            board[m.r][m.c] = m.player;
            moveCount++;
        }
        currentPlayer = data.moves.length % 2 === 0 ? 'black' : 'white';
        moveHistory = data.moves.slice();
        drawBoard();
        document.getElementById('resumeBtn').style.display = 'inline-block';
        statusEl.textContent = 'Last game restored (' + moveCount + ' moves). Click Resume to keep playing.';
        return true;
    } catch (_) { return false; }
}

function undoMove() {
    if (replayIndex >= 0 || moveHistory.length === 0 || gameOver || aiThinking) return;
    const last = moveHistory.pop();
    board[last.r][last.c] = null;
    moveCount--;
    currentPlayer = last.player;
    _saveToLocal();
    drawBoard(); updateStatus();
}

// Replay — step to a specific move index (-1 = initial, 0 = after move 1, etc.)
function goToMove(idx) {
    if (idx < -1 || idx >= moveHistory.length) return;
    replayIndex = idx;
    initBoard();
    for (let i = 0; i <= idx; i++) {
        const m = moveHistory[i];
        board[m.r][m.c] = m.player;
    }
    currentPlayer = idx < 0 ? 'black' : (moveHistory[idx].player === 'black' ? 'white' : 'black');
    drawBoard();
    if (replayIndex < moveHistory.length - 1) {
        statusEl.textContent = 'Replay: move ' + (idx + 2) + ' of ' + moveHistory.length + ' (click Resume to play)';
    } else {
        statusEl.textContent = 'Final position. Click Resume to play from here.';
        replayIndex = -1;
    }
}

function prevMove() { goToMove(replayIndex >= 0 ? replayIndex - 1 : moveHistory.length - 2); }
function nextMove() { goToMove(replayIndex >= 0 ? replayIndex + 1 : -1); }
function resumeGame() { replayIndex = -1; document.getElementById('resumeBtn').style.display = 'none'; _loadFromLocal(); }

function analyzeMove() {
    if (moveHistory.length === 0) return;
    const targetIdx = replayIndex >= 0 ? replayIndex : moveHistory.length - 1;
    const analyzedMove = moveHistory[targetIdx];
    const sideToMove = analyzedMove.player;

    // Ask MoHex for best move from this position
    // First, replay up to the move BEFORE the analyzed one
    initBoard();
    for (let i = 0; i < targetIdx; i++) {
        const m = moveHistory[i];
        board[m.r][m.c] = m.player;
    }
    currentPlayer = sideToMove;
    drawBoard();

    statusEl.textContent = 'Analyzing move ' + (targetIdx + 1) + '...';
    const level = getAiLevel();
    fetch(AI_URL + '/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: boardToMohex() || ' ', boardsize: size, player: sideToMove, level: level }),
        signal: AbortSignal.timeout(30000),
    }).then(r => r.json()).then(data => {
        if (data.success && data.move) {
            statusEl.innerHTML = 'Move ' + (targetIdx + 1) + ': ' + analyzedMove.player + ' played ' +
                String.fromCharCode(97 + analyzedMove.c) + (analyzedMove.r + 1) +
                '. MoHex suggests: <strong>' + data.move + '</strong>' +
                (data.move !== String.fromCharCode(97 + analyzedMove.c) + (analyzedMove.r + 1)
                    ? ' (different!)' : ' (matches!)');
        } else {
            statusEl.textContent = 'Could not analyze (MoHex unavailable).';
        }
    }).catch(() => {
        statusEl.textContent = 'Could not analyze (MoHex unavailable).';
    });
    // Restore to analyzed position
    goToMove(targetIdx);
}

async function aiMoveFor(player) {
    if (gameOver || aiThinking) return;
    aiThinking = true;
    statusEl.textContent = (player === 'black' ? 'Black' : 'White') + ' AI thinking...';
    try {
        const level = getAiLevel();
        const resp = await fetch(AI_URL + '/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board: boardToMohex() || ' ', boardsize: size, player: player, level: level }),
            signal: AbortSignal.timeout(30000),
        });
        const data = await resp.json();
        if (data.success && data.move) {
            const col = data.move.charCodeAt(0) - 97;
            const row = parseInt(data.move.slice(1)) - 1;
            if (row >= 0 && row < size && col >= 0 && col < size && !board[row][col]) {
                board[row][col] = player;
                moveCount++;
                if (checkWin(player)) {
                    gameOver = true;
                    statusEl.innerHTML = '<span class="turn-indicator turn-' + player + '"></span>' + (player.charAt(0).toUpperCase() + player.slice(1)) + ' (AI) wins!';
                    drawBoard(); aiThinking = false; return;
                }
                currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
                drawBoard(); updateStatus();
                aiThinking = false;
                if (!gameOver && aivsai && document.getElementById('aivsaiBtn').textContent === 'Stop') {
                    aivsaiTimer = setTimeout(() => aiMoveFor(currentPlayer), 500);
                }
                return;
            }
        }
    } catch (e) {
        if (e.name === 'TimeoutError') {
            if (!aivsai) {
                statusEl.textContent = 'AI timeout.';
                aiEnabled = false; document.getElementById('aiBtn').textContent = 'Play vs AI';
            }
        }
    }
    aiThinking = false;
}

async function aiMove() {
    return aiMoveFor('white');
}

function drawBoard() {
    const W = canvas.width, H = canvas.height;
    const N = size;
    const hexR = Math.min(W / (N * 1.85), H / (N * 1.65));
    const s3 = Math.sqrt(3);
    const spacingX = s3 * hexR;
    const spacingY = 1.5 * hexR;
    const cx0 = W / 2, cy0 = H / 2;
    const mid = (N - 1) / 2;

    ctx.clearRect(0, 0, W, H);

    function hexPath(cx, cy, r) {
        const radius = r || hexR;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = Math.PI / 2 + (Math.PI / 3) * i;
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    const cells = [];
    for (let r = 0; r < N; r++) {
        cells[r] = [];
        for (let c = 0; c < N; c++) {
            cells[r][c] = {
                cx: cx0 + (c - mid) * spacingX + (r - mid) * spacingX / 2,
                cy: cy0 + (r - mid) * spacingY
            };
        }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const {cx, cy} = cells[r][c];
            if (c + 1 < N) { const nx = cells[r][c+1].cx, ny = cells[r][c+1].cy; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke(); }
            if (r + 1 < N) { const nx = cells[r+1][c].cx, ny = cells[r+1][c].cy; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke(); }
            if (r + 1 < N && c - 1 >= 0) { const nx = cells[r+1][c-1].cx, ny = cells[r+1][c-1].cy; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke(); }
        }
    }

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const {cx, cy} = cells[r][c];
            const stone = board[r][c];
            hexPath(cx, cy);
            if (stone === 'black') {
                ctx.fillStyle = '#1a1a1a'; ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();
                hexPath(cx - 2, cy - 2, hexR * 0.65);
                ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
            } else if (stone === 'white') {
                ctx.fillStyle = '#e0e0e0'; ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
                hexPath(cx - 2, cy - 2, hexR * 0.65);
                ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
            } else {
                ctx.fillStyle = '#1a1a20'; ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();
                hexPath(cx, cy, hexR * 0.88);
                ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1; ctx.stroke();
            }
        }
    }

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 4;
    const topL = cells[0][0], topR = cells[0][N-1];
    const botL = cells[N-1][0], botR = cells[N-1][N-1];
    const hh = hexR * Math.sqrt(3) * 0.5;
    ctx.beginPath(); ctx.moveTo(topL.cx - hh, topL.cy - hexR * 1.1); ctx.lineTo(topR.cx + hh, topR.cy - hexR * 1.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(botL.cx - hh, botL.cy + hexR * 1.1); ctx.lineTo(botR.cx + hh, botR.cy + hexR * 1.1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(topL.cx - hh * 1.3, topL.cy - hexR / 2); ctx.lineTo(botL.cx - hh * 1.3, botL.cy + hexR / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(topR.cx + hh * 1.3, topR.cy - hexR / 2); ctx.lineTo(botR.cx + hh * 1.3, botR.cy + hexR / 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = Math.round(hexR * 0.55) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Black', (topL.cx + topR.cx) / 2, topL.cy - hexR * 1.5);
    ctx.fillText('Black', (botL.cx + botR.cx) / 2, botL.cy + hexR * 2);
    ctx.textAlign = 'right';
    ctx.fillText('White', topL.cx - hh * 1.8, (topL.cy + botL.cy) / 2 + hexR * 0.25);
    ctx.textAlign = 'left';
    ctx.fillText('White', topR.cx + hh * 1.8, (topR.cy + botR.cy) / 2 + hexR * 0.25);
}

function updateStatus() {
    if (gameOver) return;
    if (aivsai) {
        statusEl.innerHTML = '<span class="turn-indicator turn-' + currentPlayer + '"></span> AI ' + currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + '\'s turn';
    } else if (aiEnabled && currentPlayer === 'white') {
        statusEl.innerHTML = '<span class="turn-indicator turn-white"></span>AI thinking...';
    } else {
        statusEl.innerHTML = '<span class="turn-indicator turn-' + currentPlayer + '"></span>' + currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + '\'s turn';
    }
}

canvas.addEventListener('click', function (e) {
    if (gameOver || aiThinking || aivsai) return;
    if (aiEnabled && currentPlayer !== 'black') return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const N = size;
    const hexR = Math.min(canvas.width, canvas.height) / (N * 1.85);
    const s3 = Math.sqrt(3);
    const spacingX = s3 * hexR;
    const spacingY = 1.5 * hexR;
    const cx0 = canvas.width / 2, cy0 = canvas.height / 2;
    const mid = (N - 1) / 2;
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const cx = cx0 + (c - mid) * spacingX + (r - mid) * spacingX / 2;
            const cy = cy0 + (r - mid) * spacingY;
            if ((mx - cx) * (mx - cx) + (my - cy) * (my - cy) < hexR * hexR * 0.85) {
                placeStone(r, c); return;
            }
        }
    }
});

function resetGame() {
    if (aivsaiTimer) { clearTimeout(aivsaiTimer); aivsaiTimer = null; }
    aivsai = false;
    document.getElementById('aivsaiBtn').textContent = 'AI vs AI';
    size = parseInt(document.getElementById('sizeSelect').value);
    moveHistory = [];
    replayIndex = -1;
    document.getElementById('resumeBtn').style.display = 'none';
    initBoard(); drawBoard(); updateStatus();
}

async function toggleAI() {
    if (aivsai) return;
    if (!aiEnabled) {
        statusEl.textContent = 'Connecting to AI engine...';
        try {
            const resp = await fetch(AI_URL + '/api/status', { signal: AbortSignal.timeout(5000) });
            const data = await resp.json();
            if (data.ready || data.status === 'online') {
                aiEnabled = true;
                document.getElementById('aiBtn').textContent = 'Play vs Human';
                document.getElementById('aiBtn').className = 'btn';
                if (!gameOver && currentPlayer === 'white') setTimeout(aiMove, 500);
                updateStatus();
                return;
            }
        } catch (_) {}
        statusEl.textContent = 'AI engine unavailable (port 11210). Try Docker or build MoHex.';
        document.getElementById('aiBtn').textContent = 'Play vs AI';
        return;
    }
    aiEnabled = false;
    document.getElementById('aiBtn').textContent = 'Play vs AI';
    document.getElementById('aiBtn').className = 'btn secondary';
    updateStatus();
}

function toggleAIVsAI() {
    if (aiEnabled) { alert('Disable Play vs AI first.'); return; }
    aivsai = !aivsai;
    document.getElementById('aivsaiBtn').textContent = aivsai ? 'Stop' : 'AI vs AI';
    if (aivsai) {
        initBoard();
        drawBoard();
        statusEl.textContent = 'AI Black vs AI White starting...';
        aivsaiTimer = setTimeout(() => aiMoveFor('black'), 1000);
    } else {
        if (aivsaiTimer) { clearTimeout(aivsaiTimer); aivsaiTimer = null; }
    }
}

initBoard(); drawBoard();
if (!_loadFromLocal() || moveHistory.length === 0) { updateStatus(); }

