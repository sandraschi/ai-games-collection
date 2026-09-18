// Chess Education System
// **Timestamp**: 2025-12-03

let famousGames = [];
let currentGame = null;
let currentMoveIndex = 0;
let gameBoardState = null;
let gameMoves = [];
let stockfishAnalysis = [];
const STOCKFISH_URL = 'http://127.0.0.1:11211';
let blunders = [];
let currentBlunder = null;
let blunderBoardState = null;
let blunderMoves = [];
let currentBlunderMoveIndex = 0;
let encyclopediaContent = {};
let lessons = [];
let currentPuzzle = null;
let puzzleBoard = null;
let puzzleBoardState = null;
let puzzleSelectedSquare = null;
let puzzleMoves = [];
let puzzleCurrentMoveIndex = 0;
let openings = [];
let currentOpening = null;
let openingMoveIndex = 0;
let openingBoardState = null;
let openingMoves = [];
let allOpenings = [];
let endgames = [];
let allEndgames = [];
let currentEndgame = null;
let endgameMoveIndex = 0;
let endgameBoardState = null;
let endgameMoves = [];

// Load famous games
async function loadFamousGames() {
    try {
        console.log('Fetching famous games...');
        const response = await fetch('../../data/chess/famous-games.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Famous games loaded:', data.games.length);
        famousGames = data.games;
        renderGamesList();
    } catch (error) {
        console.error('Failed to load famous games:', error);
        const list = document.getElementById('gamesList');
        if (list) {
            list.innerHTML = `<p style="color: #FF6B6B;">Error: ${error.message}<br>Check browser console for details.</p>`;
        }
    }
}

// Load encyclopedia content
async function loadEncyclopedia() {
    console.log('Loading encyclopedia...');
    const files = [
        'rules-basics',
        'ai-history', 
        'tournament-history',
        'hollywood-mistakes',
        'literature-media',
        'chess-variants',
        'strategy-tactics',
        'endgame-studies'
    ];
    
    for (const file of files) {
        try {
            const response = await fetch(`../../data/chess/encyclopedia/${file}.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            encyclopediaContent[file] = data;
            console.log(`Loaded ${file}:`, data.title);
        } catch (error) {
            console.error(`Failed to load ${file}:`, error);
        }
    }
    
    console.log('Encyclopedia articles loaded:', Object.keys(encyclopediaContent).length);
    renderEncyclopedia();
}

function renderEncyclopedia() {
    const content = document.getElementById('encyclopediaList');
    
    if (Object.keys(encyclopediaContent).length === 0) {
        content.innerHTML = '<p style="color: #FF6B6B;">Encyclopedia content not found. Check data/chess/encyclopedia/ folder.</p>';
        return;
    }
    
    content.innerHTML = '';
    
    Object.entries(encyclopediaContent).forEach(([key, data]) => {
        const card = document.createElement('div');
        card.className = 'game-card-item';
        card.innerHTML = `
            <h3>${data.title}</h3>
            <p>Click to read full article</p>
            <span class="badge">${data.sections ? data.sections.length : 0} sections</span>
        `;
        card.onclick = () => showEncyclopediaArticle(key);
        content.appendChild(card);
    });
}

function showEncyclopediaArticle(key) {
    const data = encyclopediaContent[key];
    if (!data) return;
    
    const tab = document.getElementById('encyclopedia-tab');
    tab.innerHTML = `
        <button onclick="loadEncyclopedia(); renderEncyclopedia();" style="margin-bottom: 20px; padding: 10px 20px; background: rgba(76, 175, 80, 0.3); border: none; color: white; border-radius: 5px; cursor: pointer;">← Back to Encyclopedia</button>
        <h2>${data.title}</h2>
        ${data.sections.map(section => `
            <div style="margin: 30px 0; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 10px;">
                <h3 style="color: #4CAF50; margin-bottom: 15px;">${section.title}</h3>
                <div style="white-space: pre-line; line-height: 1.8; color: #FFF;">${section.content}</div>
            </div>
        `).join('')}
    `;
}

function renderGamesList() {
    const list = document.getElementById('gamesList');
    list.innerHTML = '';
    
    famousGames.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card-item';
        card.innerHTML = `
            <h3>${game.name}</h3>
            <p><strong>${game.white}</strong> vs <strong>${game.black}</strong></p>
            <p>${game.date} | ${game.event}</p>
            <p>${game.description}</p>
            <div class="status">
                <span class="badge">${game.difficulty}</span>
                ${game.themes.map(t => `<span class="badge">#${t}</span>`).join(' ')}
            </div>
        `;
        card.onclick = () => viewGame(game);
        list.appendChild(card);
    });
}

function viewGame(game) {
    currentGame = game;
    currentMoveIndex = 0;
    gameMoves = []; // Reset moves array
    
    document.getElementById('gamesList').style.display = 'none';
    document.getElementById('gameViewer').style.display = 'block';
    document.getElementById('gameTitle').textContent = game.name;
    
    // Initialize board first
    initializeGameBoard();
    // Parse PGN and set up moves
    parsePGNAndRender();
    // Run Stockfish analysis (async, best-effort)
    analyzeGameWithStockfish();
    // Apply initial position (no moves)
    applyMovesToBoard();
    // Render the board
    renderGameBoard();
    // Highlight current move
    highlightCurrentMove();
    // Update comment box with initial content
    updateCommentBox();
    // Update navigation button states
    updateNavigationButtons();

    // Run Stockfish analysis (async, best-effort)
    analyzeGameWithStockfish();
}

// === Stockfish Analysis for Classic Games ===
let _analysisInProgress = false;

async function analyzeGameWithStockfish() {
    if (!gameMoves || gameMoves.length === 0) return;
    _analysisInProgress = true;
    stockfishAnalysis = [];
    const statusEl = document.getElementById('analysisStatus');
    if (statusEl) statusEl.textContent = 'Analyzing with Stockfish...';

    for (let i = 0; i < gameMoves.length; i++) {
        initializeGameBoard();
        for (let j = 0; j < i; j++) {
            applyPGNMove(gameMoves[j], j % 2 === 0 ? 'white' : 'black');
        }
        const side = i % 2 === 0 ? 'white' : 'black';
        const fen = boardToFEN(side);

        try {
            const resp = await fetch(STOCKFISH_URL + '/api/move', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({fen, depth: 10, movetime: 1000}),
                signal: AbortSignal.timeout(3000),
            });
            const data = await resp.json();
            stockfishAnalysis[i] = data.success && data.move
                ? {stockfishMove: data.move, played: gameMoves[i], match: data.move === gameMoves[i]}
                : {stockfishMove: null, played: gameMoves[i], match: false};
        } catch (e) {
            stockfishAnalysis[i] = {stockfishMove: null, played: gameMoves[i], match: false};
        }

        if (i % 5 === 0 && statusEl) statusEl.textContent = 'Stockfish: move ' + (i + 1) + '/' + gameMoves.length;
    }

    _analysisInProgress = false;
    const matches = stockfishAnalysis.filter(a => a && a.match).length;
    const total = stockfishAnalysis.filter(a => a && a.stockfishMove).length;
    if (statusEl) {
        statusEl.innerHTML = 'Stockfish: ' + matches + '/' + total + ' matched ' +
            '(<span style="color:' + (matches < total * 0.5 ? '#ef4444' : '#22c55e') + '">' +
            Math.round(matches / total * 100) + '%</span>)';
    }
    highlightStockfishDifferences();
}

function boardToFEN(sideToMove) {
    if (!gameBoardState) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    let fen = '';
    for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
            const p = gameBoardState[r][c];
            if (!p) { empty++; continue; }
            if (empty > 0) { fen += empty; empty = 0; }
            const sym = {pawn:'p',rook:'r',knight:'n',bishop:'b',queen:'q',king:'k'}[p.type] || '?';
            fen += p.color === 'white' ? sym.toUpperCase() : sym;
        }
        if (empty > 0) fen += empty;
        if (r < 7) fen += '/';
    }
    fen += ' ' + (sideToMove === 'white' ? 'w' : 'b') + ' KQkq - 0 ' + Math.floor((gameMoves ? gameMoves.length : 0) / 2 + 1);
    return fen;
}

function highlightStockfishDifferences() {
    const items = document.querySelectorAll('#moveList .move-item');
    items.forEach((item, idx) => {
        const a = stockfishAnalysis[idx * 2];
        const b = stockfishAnalysis[idx * 2 + 1];
        const text = item.textContent;
        const parts = text.split(/\s+/);
        if (parts.length < 3) return;
        let result = parts[0];
        if (a && a.stockfishMove && !a.match) {
            result += ' <span style="color:#ef4444">' + parts[1] + '</span> <span style="color:#f59e0b;font-size:0.8em">→' + a.stockfishMove + '</span>';
        } else {
            result += ' ' + (parts[1] || '');
        }
        if (b && b.stockfishMove && !b.match && parts[2]) {
            result += ' <span style="color:#ef4444">' + parts[2] + '</span> <span style="color:#f59e0b;font-size:0.8em">→' + b.stockfishMove + '</span>';
        } else if (parts[2]) {
            result += ' ' + parts[2];
        }
        item.innerHTML = result;
    });
}

function initializeGameBoard() {
    // Initialize board to starting position
    gameBoardState = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Set up starting position
    const startingPosition = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = startingPosition[row][col];
            if (piece) {
                const isWhite = piece === piece.toUpperCase();
                gameBoardState[row][col] = {
                    type: getPieceTypeFromChar(piece),
                    color: isWhite ? 'white' : 'black'
                };
            }
        }
    }
    
    // Don't clear gameMoves here - they're set in parsePGNAndRender
    // gameMoves = [];
}

function getPieceTypeFromChar(char) {
    const lower = char.toLowerCase();
    const types = {
        'p': 'pawn', 'r': 'rook', 'n': 'knight',
        'b': 'bishop', 'q': 'queen', 'k': 'king'
    };
    return types[lower] || 'pawn';
}

function parsePGNAndRender() {
    // Parse PGN into individual moves
    if (!currentGame || !currentGame.pgn) {
        console.error('No game or PGN found!');
        gameMoves = [];
        return;
    }
    
    const pgn = currentGame.pgn;
    console.log('=== PARSING PGN ===');
    console.log('Full PGN:', pgn);
    
    // Better PGN parsing - handle move numbers properly
    gameMoves = [];
    
    // Remove comments and annotations first
    let cleanPgn = pgn.replace(/\{[^}]*\}/g, ''); // Remove {comments}
    cleanPgn = cleanPgn.replace(/\([^)]*\)/g, ''); // Remove (variations)
    cleanPgn = cleanPgn.replace(/\$[0-9]+/g, ''); // Remove NAG codes like $1, $2
    console.log('Cleaned PGN:', cleanPgn);
    
    // More robust PGN parsing - split by move numbers
    // Pattern matches: "1. e4 e5 2. Nf3" etc.
    const moveNumberPattern = /(\d+)\.\s*([^\d]+?)(?=\s*\d+\.|$)/g;
    let match;
    let matches = [];
    
    // First, collect all matches
    while ((match = moveNumberPattern.exec(cleanPgn)) !== null) {
        matches.push(match);
    }
    
    console.log('Found', matches.length, 'move number matches');
    
    // Process each match
    matches.forEach((match, index) => {
        const movePair = match[2].trim();
        console.log(`Processing move pair ${index + 1}: "${movePair}"`);

        // Split by whitespace and filter
        const moves = movePair.split(/\s+/).filter(m => {
            const trimmed = m.trim();
            // Filter out results, empty strings, and invalid moves
            if (!trimmed) return false;
            if (trimmed === '1-0' || trimmed === '0-1' || trimmed === '1/2-1/2') return false;
            if (/^\d+$/.test(trimmed)) return false; // Pure numbers
            if (trimmed.includes('{') || trimmed.includes('}')) return false;
            // Accept moves: castling, standard notation, or any alphanumeric that looks like a move
            return /^[O0]-[O0](-[O0])?$/.test(trimmed) || 
                   /^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8][+#]?$/.test(trimmed) ||
                   /^[a-h][1-8]$/.test(trimmed) || // Simple square notation
                   /^[KQRBN][a-h][1-8]$/.test(trimmed); // Piece to square
        });
        
        moves.forEach(move => {
            // Clean up check/checkmate symbols but keep the move
            const cleanMove = move.replace(/[+#]/, '').trim();
            if (cleanMove) {
                gameMoves.push(cleanMove);
            }
        });
    });
    
    // Fallback: if no moves found, try simpler parsing
    if (gameMoves.length === 0) {
        console.log('No moves found with regex, trying simpler parsing...');
        // Split by spaces and filter for moves
        const allWords = cleanPgn.split(/\s+/);
        allWords.forEach(word => {
            const trimmed = word.trim();
            // Remove move numbers (e.g., "1.", "2.")
            if (/^\d+\.$/.test(trimmed)) return;
            // Remove results
            if (trimmed === '1-0' || trimmed === '0-1' || trimmed === '1/2-1/2') return;
            // Accept anything that looks like a chess move
            if (trimmed && trimmed.length >= 2 && /^[a-hO0KQRBN]/.test(trimmed)) {
                const cleanMove = trimmed.replace(/[+#]/, '').trim();
                if (cleanMove) {
                    gameMoves.push(cleanMove);
                }
            }
        });
    }
    
    console.log('=== PARSING COMPLETE ===');
    console.log('Parsed gameMoves:', gameMoves.length, 'moves:', gameMoves);
    
    // Render move list
    const moveList = document.getElementById('moveList');
    if (!moveList) {
        console.error('moveList element not found!');
        return;
    }
    
    moveList.innerHTML = '';
    
    for (let i = 0; i < gameMoves.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whiteMove = gameMoves[i] || '';
        const blackMove = gameMoves[i + 1] || '';
        
        const item = document.createElement('div');
        item.className = 'move-item';
        item.textContent = `${moveNum}. ${whiteMove} ${blackMove ? blackMove : ''}`.trim();
        item.onclick = () => jumpToMove(moveNum);
        moveList.appendChild(item);
    }
    
    updateCommentBox();
}

function nextMove() {
    console.log('=== nextMove() CALLED ===');
    console.log('currentMoveIndex:', currentMoveIndex);
    console.log('currentGame:', currentGame);
    console.log('gameMoves:', gameMoves);
    console.log('gameMoves.length:', gameMoves ? gameMoves.length : 0);

    // If gameMoves is empty but we have a currentGame, try to re-parse
    if ((!gameMoves || gameMoves.length === 0) && currentGame) {
        console.warn('gameMoves is empty, attempting to re-parse PGN...');
        parsePGNAndRender();
        // Check again after parsing
        if (!gameMoves || gameMoves.length === 0) {
            console.error('ERROR: Failed to parse game moves from PGN!');
            console.error('PGN:', currentGame.pgn);
            alert('Error: Could not parse game moves. Check console for details.');
            return;
        }
    }

    if (!gameMoves || gameMoves.length === 0) {
        console.error('ERROR: No game moves available!');
        alert('No game moves available. Please select a game first.');
        return;
    }

    const maxMoveNumber = Math.ceil(gameMoves.length / 2);
    console.log('maxMoveNumber:', maxMoveNumber);
    console.log('Condition check: currentMoveIndex (' + currentMoveIndex + ') < maxMoveNumber (' + maxMoveNumber + ') =', currentMoveIndex < maxMoveNumber);

    if (currentMoveIndex < maxMoveNumber) {
        currentMoveIndex++;
        console.log('✓ Incremented to move number:', currentMoveIndex);
        console.log('Calling applyMovesToBoard()...');
        applyMovesToBoard();
        console.log('Calling updateCommentBox()...');
        updateCommentBox();
        console.log('Calling renderGameBoard()...');
        renderGameBoard();
        console.log('Calling highlightCurrentMove()...');
        highlightCurrentMove();
        console.log('=== nextMove() COMPLETE ===');
    } else {
        console.log('✗ Already at last move - currentMoveIndex:', currentMoveIndex, 'maxMoveNumber:', maxMoveNumber);
        // Button is disabled, but just in case
    }
}

function prevMove() {
    console.log('prevMove called, currentMoveIndex:', currentMoveIndex);
    if (currentMoveIndex > 0) {
        currentMoveIndex--;
        console.log('Moved to move index:', currentMoveIndex);
        applyMovesToBoard();
        updateCommentBox();
        renderGameBoard();
        highlightCurrentMove();
    } else {
        console.log('Already at first move');
        // Button is disabled, but just in case
    }
}

function firstMove() {
    console.log('firstMove called');
    currentMoveIndex = 0;
    applyMovesToBoard();
    updateCommentBox();
    renderGameBoard();
    highlightCurrentMove();
}

function lastMove() {
    console.log('lastMove called, gameMoves.length:', gameMoves.length);
    if (!gameMoves || gameMoves.length === 0) {
        console.error('No game moves available!');
        return;
    }
    currentMoveIndex = Math.ceil(gameMoves.length / 2);
    console.log('Moved to move number:', currentMoveIndex);
    applyMovesToBoard();
    updateCommentBox();
    renderGameBoard();
    highlightCurrentMove();
}

function jumpToMove(moveNumber) {
    // moveNumber is 1-based (move 1, move 2, etc.)
    currentMoveIndex = moveNumber;
    applyMovesToBoard();
    updateCommentBox();
    renderGameBoard();
    highlightCurrentMove();
}

function highlightCurrentMove() {
    const moveItems = document.querySelectorAll('#moveList .move-item');
    moveItems.forEach((item, index) => {
        // index is 0-based (0 = move 1, 1 = move 2, etc.)
        // currentMoveIndex is 1-based (0 = initial position, 1 = after move 1, etc.)
        if (index + 1 === currentMoveIndex) {
            item.style.background = 'rgba(76, 175, 80, 0.3)';
        } else {
            item.style.background = '';
        }
    });

    // Update button states
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const firstBtn = document.querySelector('button[onclick*="firstMove"]');
    const prevBtn = document.querySelector('button[onclick*="prevMove"]');
    const nextBtn = document.querySelector('button[onclick*="nextMove"]');
    const lastBtn = document.querySelector('button[onclick*="lastMove"]');

    if (!gameMoves || gameMoves.length === 0) {
        // Disable all navigation buttons if no moves
        if (firstBtn) firstBtn.disabled = true;
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (lastBtn) lastBtn.disabled = true;
        return;
    }

    const maxMoveNumber = Math.ceil(gameMoves.length / 2);

    // First and Previous buttons: disabled when at start
    if (firstBtn) firstBtn.disabled = (currentMoveIndex === 0);
    if (prevBtn) prevBtn.disabled = (currentMoveIndex === 0);

    // Next and Last buttons: disabled when at end
    if (nextBtn) nextBtn.disabled = (currentMoveIndex >= maxMoveNumber);
    if (lastBtn) lastBtn.disabled = (currentMoveIndex >= maxMoveNumber);
}

function applyMovesToBoard() {
    // Reset to starting position
    initializeGameBoard();
    
    // Apply moves up to currentMoveIndex
    const movesToApply = currentMoveIndex * 2; // Each move number has white and black
    for (let i = 0; i < movesToApply && i < gameMoves.length; i++) {
        applyPGNMove(gameMoves[i], i % 2 === 0 ? 'white' : 'black');
    }
}

function applyPGNMove(moveNotation, color) {
    if (!moveNotation) return;

    // Safety check: ensure board is initialized
    if (!gameBoardState) {
        console.warn('applyPGNMove called before board initialization');
        return;
    }

    // Remove check/checkmate symbols
    moveNotation = moveNotation.replace(/[+#]/, '').trim();
    
    // Handle castling
    if (moveNotation === 'O-O' || moveNotation === '0-0' || moveNotation === 'O-O-O' || moveNotation === '0-0-0') {
        const side = (moveNotation === 'O-O' || moveNotation === '0-0') ? 'kingside' : 'queenside';
        applyCastle(color, side);
        return;
    }
    
    // Check for pawn file disambiguation before capture detection (e.g., "hxg3")
    let sourceHint = null;
    if (moveNotation.length > 3 && moveNotation[1] === 'x' && moveNotation[0] >= 'a' && moveNotation[0] <= 'h') {
        // Format: "hxg3" - h is the pawn's file
        sourceHint = { type: 'file', value: moveNotation[0].charCodeAt(0) - 97 };
        moveNotation = moveNotation.substring(1); // Remove the file hint
    }

    // Handle captures
    const isCapture = moveNotation.includes('x');
    moveNotation = moveNotation.replace('x', '');

    // Extract destination
    const destMatch = moveNotation.match(/([a-h])([1-8])$/);
    if (!destMatch) {
        console.warn('Could not parse move:', moveNotation);
        return;
    }

    const destCol = destMatch[1].charCodeAt(0) - 97;
    const destRow = 8 - parseInt(destMatch[2]);

    // Determine piece type
    let pieceType = 'pawn';

    // Check if first character is an uppercase piece letter
    const firstChar = moveNotation[0];
    const pieceLetters = ['K', 'Q', 'R', 'B', 'N'];
    if (firstChar && pieceLetters.includes(firstChar)) {
        const types = { 'R': 'rook', 'N': 'knight', 'B': 'bishop', 'Q': 'queen', 'K': 'king' };
        pieceType = types[firstChar] || 'pawn';
        moveNotation = moveNotation.substring(1);

        // Check for disambiguation hints (e.g., "R1e4" or "Rae4")
        if (moveNotation.length > 2) {
            const hint = moveNotation[0];
            if (hint >= 'a' && hint <= 'h') {
                sourceHint = { type: 'file', value: hint.charCodeAt(0) - 97 };
                moveNotation = moveNotation.substring(1);
            } else if (hint >= '1' && hint <= '8') {
                sourceHint = { type: 'rank', value: 8 - parseInt(hint) };
                moveNotation = moveNotation.substring(1);
            }
        }
    }
    
    // Find the piece that can make this move — collect all candidates, use closest/rightmost
    let bestCandidate = null;
    let bestScore = Infinity;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameBoardState[row][col];
            if (!piece || piece.type !== pieceType || piece.color !== color) continue;

            // Check disambiguation hints
            if (sourceHint) {
                if (sourceHint.type === 'file' && col !== sourceHint.value) continue;
                if (sourceHint.type === 'rank' && row !== sourceHint.value) continue;
            }

            if (!canPieceMoveTo(row, col, destRow, destCol, pieceType, color, isCapture)) continue;
            if (!isPathClear(row, col, destRow, destCol, pieceType)) continue;

            // Score: prefer closer-to-destination pieces (lower Manhattan distance from dest).
            // This avoids picking the wrong piece when PGN has no disambiguation
            // but only one piece would naturally be the intended mover.
            const score = Math.abs(row - destRow) + Math.abs(col - destCol);
            if (score < bestScore) {
                bestScore = score;
                bestCandidate = { row, col, piece };
            }
        }
    }

    if (bestCandidate) {
        // Handle pawn promotion
        if (pieceType === 'pawn' && (destRow === 0 || destRow === 7)) {
            // Check if PGN specified a promotion piece (e.g., "e8=Q" or "e8Q")
            if (promoMatch && promoMatch[2]) {
                const promoType = promoMatch[2].toLowerCase();
                const promoTypes = { 'q': 'queen', 'r': 'rook', 'b': 'bishop', 'n': 'knight' };
                bestCandidate.piece.type = promoTypes[promoType] || 'queen';
            } else {
                bestCandidate.piece.type = 'queen'; // Default to queen
            }
        }
        gameBoardState[destRow][destCol] = bestCandidate.piece;
        gameBoardState[bestCandidate.row][bestCandidate.col] = null;
        return;
    }

    console.warn('Could not apply move:', moveNotation, 'for', color);
}

function isPathClear(fromRow, fromCol, toRow, toCol, pieceType) {
    // Safety check: ensure board is initialized
    if (!gameBoardState) {
        console.warn('isPathClear called before board initialization');
        return false;
    }

    // Knights can jump, so path is always clear
    if (pieceType === 'knight') return true;
    
    const rowStep = toRow === fromRow ? 0 : (toRow > fromRow ? 1 : -1);
    const colStep = toCol === fromCol ? 0 : (toCol > fromCol ? 1 : -1);
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    // Check each square along the path (excluding destination)
    while (currentRow !== toRow || currentCol !== toCol) {
        if (gameBoardState[currentRow][currentCol] !== null) {
            return false; // Path is blocked
        }
        currentRow += rowStep;
        currentCol += colStep;
    }
    
    return true;
}

function canPieceMoveTo(fromRow, fromCol, toRow, toCol, pieceType, color, isCapture = false) {
    // Safety check: ensure board is initialized
    if (!gameBoardState) {
        console.warn('canPieceMoveTo called before board initialization');
        return false;
    }

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;

    // Can't move to the same square
    if (rowDiff === 0 && colDiff === 0) return false;

    // Check destination square validity
    const destPiece = gameBoardState[toRow][toCol];
    if (isCapture) {
        // For captures, destination must contain an enemy piece
        if (!destPiece || destPiece.color === color) return false;
    } else {
        // For non-captures, destination must be empty
        if (destPiece !== null) return false;
    }

    switch (pieceType) {
        case 'pawn':
            const direction = color === 'white' ? -1 : 1;
            const startRow = color === 'white' ? 6 : 1;

            // Forward move (one square) - already checked destination is empty above
            if (colDiff === 0 && rowDiff === direction) {
                return true;
            }
            // Forward move (two squares from start) - already checked destination is empty above
            if (colDiff === 0 && rowDiff === direction * 2 && fromRow === startRow) {
                return gameBoardState[fromRow + direction][fromCol] === null;
            }
            // Capture (diagonal) - only allowed for captures
            if (isCapture && Math.abs(colDiff) === 1 && rowDiff === direction) {
                return true;
            }
            return false;
        case 'rook':
            return (rowDiff === 0 || colDiff === 0);
        case 'knight':
            return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
                   (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
        case 'bishop':
            return Math.abs(rowDiff) === Math.abs(colDiff);
        case 'queen':
            return (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff));
        case 'king':
            return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        default:
            return false;
    }
}

function applyCastle(color, side) {
    // Safety check: ensure board is initialized
    if (!gameBoardState) {
        console.warn('applyCastle called before board initialization');
        return;
    }

    const row = color === 'white' ? 7 : 0;
    if (side === 'kingside') {
        // Move king
        gameBoardState[row][6] = gameBoardState[row][4];
        gameBoardState[row][4] = null;
        // Move rook
        gameBoardState[row][5] = gameBoardState[row][7];
        gameBoardState[row][7] = null;
    } else {
        // Move king
        gameBoardState[row][2] = gameBoardState[row][4];
        gameBoardState[row][4] = null;
        // Move rook
        gameBoardState[row][3] = gameBoardState[row][0];
        gameBoardState[row][0] = null;
    }
}

function renderGameBoard() {
    const boardElement = document.getElementById('chessboard');
    if (!boardElement) {
        console.error('chessboard element not found!');
        return;
    }
    
    if (!gameBoardState) {
        console.error('gameBoardState is null!');
        return;
    }
    
    boardElement.innerHTML = '';
    boardElement.style.display = 'grid';
    boardElement.style.gridTemplateColumns = 'repeat(8, 60px)';
    boardElement.style.gridTemplateRows = 'repeat(8, 60px)';
    boardElement.style.border = '3px solid #333';
    boardElement.style.margin = '20px auto';
    boardElement.style.width = 'fit-content';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.style.width = '60px';
            square.style.height = '60px';
            square.style.display = 'flex';
            square.style.alignItems = 'center';
            square.style.justifyContent = 'center';
            square.style.fontSize = '48px';
            square.style.background = (row + col) % 2 === 0 ? '#F0D9B5' : '#B58863';
            square.style.cursor = 'default';
            
            const piece = gameBoardState[row][col];
            if (piece) {
                square.textContent = getPieceSymbol(piece);
                // Add high contrast styling for pieces
                if (piece.color === 'white') {
                    square.style.color = '#FFFFFF';
                    square.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)';
                } else {
                    square.style.color = '#000000';
                    square.style.textShadow = '2px 2px 4px rgba(255,255,255,0.8), -1px -1px 2px rgba(255,255,255,0.5)';
                }
            }
            
            boardElement.appendChild(square);
        }
    }
    
    console.log('Board rendered, currentMoveIndex:', currentMoveIndex);
}

function updateCommentBox() {
    const commentBox = document.getElementById('commentBox');
    if (!commentBox) {
        console.error('commentBox element not found!');
        return;
    }
    if (!currentGame) {
        console.warn('No currentGame available for comments');
        return;
    }
    
    console.log('updateCommentBox called, currentMoveIndex:', currentMoveIndex);
    console.log('currentGame.comments:', currentGame.comments);
    
    // currentMoveIndex is 1-based (0 = initial position, 1 = after move 1, etc.)
    const moveKey = `move_${currentMoveIndex}`;
    
    // Check for exact match first
    if (currentGame.comments && currentGame.comments[moveKey]) {
        console.log('Found comment for', moveKey, ':', currentGame.comments[moveKey]);
        commentBox.innerHTML = `
            <div class="comment-box">
                <strong>Move ${currentMoveIndex}:</strong><br>
                ${currentGame.comments[moveKey]}
            </div>
        `;
        return;
    }
    
    // If no exact match, check for the most recent comment before this move
    if (currentMoveIndex > 0 && currentGame.comments) {
        let foundComment = null;
        let foundMove = 0;
        
        // Look backwards from current move to find the most recent comment
        for (let i = currentMoveIndex; i > 0; i--) {
            const checkKey = `move_${i}`;
            if (currentGame.comments[checkKey]) {
                foundComment = currentGame.comments[checkKey];
                foundMove = i;
                break;
            }
        }
        
        if (foundComment) {
            console.log('Found previous comment at move', foundMove);
            commentBox.innerHTML = `
                <div class="comment-box">
                    <strong>Move ${currentMoveIndex} (comment from move ${foundMove}):</strong><br>
                    ${foundComment}
                </div>
            `;
            return;
        }
    }
    
    // Show initial position or empty state
    if (currentMoveIndex === 0) {
        commentBox.innerHTML = '<div class="comment-box"><strong>Initial Position</strong><br>Click "Next" to start the game.</div>';
    } else {
        // Show move number even if no comment
        const whiteMove = gameMoves[(currentMoveIndex - 1) * 2] || '';
        const blackMove = gameMoves[(currentMoveIndex - 1) * 2 + 1] || '';
        const moveText = `${currentMoveIndex}. ${whiteMove}${blackMove ? ' ' + blackMove : ''}`;
        commentBox.innerHTML = `
            <div class="comment-box" style="opacity: 0.7;">
                <strong>Move ${currentMoveIndex}:</strong> ${moveText}<br>
                <em>No annotation available for this move</em>
            </div>
        `;
    }
}

function closeViewer() {
    document.getElementById('gamesList').style.display = 'grid';
    document.getElementById('gameViewer').style.display = 'none';
}

// Make famous games navigation functions globally accessible
window.firstMove = firstMove;
window.prevMove = prevMove;
window.nextMove = nextMove;
window.lastMove = lastMove;
window.closeViewer = closeViewer;
window.showTab = showTab;

// Make blunder navigation functions globally accessible
window.resetBlunderGame = resetBlunderGame;
window.prevBlunderMove = prevBlunderMove;
window.nextBlunderMove = nextBlunderMove;
window.showBlunderPosition = showBlunderPosition;
window.showBlunderMove = showBlunderMove;
window.showCorrectMove = showCorrectMove;
window.closeBlunderViewer = closeBlunderViewer;

// Debug: Verify functions are accessible
console.log('Navigation functions exposed to window:', {
    firstMove: typeof window.firstMove,
    prevMove: typeof window.prevMove,
    nextMove: typeof window.nextMove,
    lastMove: typeof window.lastMove
});

// Load lessons
async function loadLessons() {
    try {
        console.log('Fetching lessons...');
        const response = await fetch('../../data/chess/lessons.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Lessons loaded:', data.lessons.length);
        lessons = data.lessons;
        renderLessons();
    } catch (error) {
        console.error('Failed to load lessons:', error);
        const list = document.getElementById('lessonsList');
        if (list) {
            list.innerHTML = `<p style="color: #FF6B6B;">Error: ${error.message}</p>`;
        }
    }
}

function renderLessons() {
    const container = document.getElementById('lessonsList');
    
    if (lessons.length === 0) {
        container.innerHTML = '<p style="color: #FF6B6B;">Lessons not found. Check data/chess/lessons.json file.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    lessons.forEach(lesson => {
        const card = document.createElement('div');
        card.className = 'game-card-item';
        card.innerHTML = `
            <h3>${lesson.title}</h3>
            <p>${lesson.description}</p>
            <div class="status">
                <span class="badge">${lesson.difficulty}</span>
                <span class="badge">⏱️ ${lesson.duration}</span>
            </div>
        `;
        card.onclick = () => showLesson(lesson);
        container.appendChild(card);
    });
}

function showLesson(lesson) {
    const lessonsTab = document.getElementById('lessons-tab');
    lessonsTab.innerHTML = `
        <button onclick="loadLessons(); renderLessons();" style="margin-bottom: 20px; padding: 10px 20px; background: rgba(76, 175, 80, 0.3); border: none; color: white; border-radius: 5px; cursor: pointer;">← Back to Lessons</button>
        <h2>${lesson.title}</h2>
        <div class="status">
            <span class="badge">${lesson.difficulty}</span>
            <span class="badge">⏱️ ${lesson.duration}</span>
        </div>
        <div style="margin-top: 30px; white-space: pre-line; line-height: 1.8; color: #FFF;">
            ${lesson.content}
        </div>
    `;
}

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');
    if (event && event.target) { event.target.classList.add('active'); };
}

// Puzzle functionality
async function loadDailyPuzzle() {
    try {
        // Try Chess.com first since it provides FEN directly
        console.log('Fetching puzzle from Chess.com...');
        await loadChessComPuzzle();
    } catch (error) {
        console.error('Failed to load Chess.com puzzle, trying Lichess...', error);
        try {
            const response = await fetch('https://lichess.org/api/puzzle/daily');
            if (!response.ok) {
                throw new Error('Lichess API error');
            }
            
            const data = await response.json();
            console.log('Lichess puzzle loaded:', data);
            
            // Lichess API structure: { game: {...}, puzzle: {...} }
            const puzzle = data.puzzle || data;
            const game = data.game || {};
            
            // Store the full game data for FEN extraction
            currentPuzzle = {
                ...puzzle,
                game: game,
                source: 'Lichess'
            };
            
            // Extract FEN from game PGN if available
            if (game.pgn && puzzle.initialPly !== undefined) {
                currentPuzzle.fen = extractFENFromPGN(game.pgn, puzzle.initialPly);
            }
            
            // Also check if game has initialFen or fen field
            if (!currentPuzzle.fen && game.initialFen) {
                currentPuzzle.fen = game.initialFen;
            }
            if (!currentPuzzle.fen && game.fen) {
                currentPuzzle.fen = game.fen;
            }
            
            // If still no FEN, use starting position
            if (!currentPuzzle.fen) {
                console.warn('No FEN found, using starting position');
                currentPuzzle.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            }
            
            displayPuzzle();
        } catch (lichessError) {
            console.error('Failed to load Lichess puzzle:', lichessError);
            // Use a default puzzle with starting position
            currentPuzzle = {
                id: 'default',
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                solution: [],
                rating: 1200,
                source: 'Default',
                themes: ['tactics']
            };
            displayPuzzle();
        }
    }
}

async function loadChessComPuzzle() {
    try {
        console.log('Fetching puzzle from Chess.com...');
        const response = await fetch('https://api.chess.com/pub/puzzle');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Chess.com puzzle loaded:', data);
        
        // Chess.com provides FEN directly
        if (!data.fen) {
            throw new Error('No FEN in Chess.com response');
        }
        
        // Parse solution moves from PGN if available
        let solutionMoves = [];
        if (data.pgn) {
            // Extract moves from PGN (simplified - just split by spaces and filter)
            solutionMoves = data.pgn.split(/\s+/).filter(m => 
                m && !m.match(/^\d+\./) && m !== '1-0' && m !== '0-1' && m !== '1/2-1/2'
            );
        }
        
        currentPuzzle = {
            id: data.id || 'daily',
            fen: data.fen,
            solution: solutionMoves,
            rating: data.rating || 1500,
            source: 'Chess.com',
            title: data.title || 'Daily Puzzle'
        };
        
        console.log('Puzzle FEN:', currentPuzzle.fen);
        displayPuzzle();
        
    } catch (error) {
        console.error('Failed to load Chess.com puzzle:', error);
        throw error; // Re-throw to allow fallback
    }
}

async function loadNewPuzzle() {
    try {
        // Get random puzzle from Lichess
        const response = await fetch('https://lichess.org/api/puzzle/daily');
        const data = await response.json();
        
        // Lichess API structure: { game: {...}, puzzle: {...} }
        const puzzle = data.puzzle || data;
        const game = data.game || {};
        
        // Store the full game data for FEN extraction
        currentPuzzle = {
            ...puzzle,
            game: game,
            source: 'Lichess'
        };
        
        // Extract FEN from game PGN if available
        if (game.pgn && puzzle.initialPly !== undefined) {
            currentPuzzle.fen = extractFENFromPGN(game.pgn, puzzle.initialPly);
        }
        
        // Also check if game has initialFen or fen field
        if (!currentPuzzle.fen && game.initialFen) {
            currentPuzzle.fen = game.initialFen;
        }
        if (!currentPuzzle.fen && game.fen) {
            currentPuzzle.fen = game.fen;
        }
        
        displayPuzzle();
    } catch (error) {
        console.error('Failed to load puzzle:', error);
    }
}

function displayPuzzle() {
    if (!currentPuzzle) return;
    
    const puzzle = currentPuzzle;
    
    // Display puzzle info with source
    document.getElementById('puzzleTitle').textContent = 
        `${puzzle.source || 'Lichess'} Puzzle ${puzzle.id || 'Daily'}`;
    document.getElementById('puzzleRating').textContent = 
        `⭐ Rating: ${puzzle.rating || 'N/A'} | 🎮 Played: ${puzzle.plays || 0} times`;
    
    // Task description
    const initialPly = puzzle.initialPly || 0;
    const toMove = initialPly % 2 === 0 ? 'White' : 'Black';
    document.getElementById('puzzleTask').innerHTML = `
        <strong>${toMove} to move</strong><br>
        Find the winning continuation!<br>
        <em>Hint: Look for forcing moves (checks, captures, threats)</em>
    `;
    
    // Display themes
    if (puzzle.themes && puzzle.themes.length > 0) {
        document.getElementById('puzzleThemes').textContent = 
            '🏷️ Themes: ' + puzzle.themes.join(', ');
    } else {
        document.getElementById('puzzleThemes').textContent = '';
    }
    
    // Popularity
    document.getElementById('puzzlePopularity').textContent = 
        `👍 ${puzzle.likes || 0} likes | 🎯 ${puzzle.plays || 0} attempts | 📊 Source: ${puzzle.source}`;
    
    // Solution (hidden initially)
    document.getElementById('puzzleSolution').style.display = 'none';
    if (puzzle.solution && puzzle.solution.length > 0) {
        document.getElementById('solutionMoves').textContent = 
            'Moves: ' + puzzle.solution.join(' → ');
    }
    
    // Render board
    renderPuzzleBoard(puzzle);
}

// Extract FEN position from PGN at a specific move number
// Note: This is a simplified implementation. For full accuracy, use a chess library like chess.js
function extractFENFromPGN(pgn, targetPly) {
    if (!pgn) return null;
    
    try {
        // Check if PGN contains FEN tag (some formats include it)
        const fenMatch = pgn.match(/\[FEN\s+"([^"]+)"/);
        if (fenMatch) {
            return fenMatch[1];
        }
        
        // For Lichess puzzles, we'd need to parse the PGN and apply moves
        // This is complex without a chess library, so we'll return null
        // and let the code use a fallback or try to get FEN from another source
        console.warn('Cannot extract FEN from PGN without chess engine. Using fallback.');
        return null;
        
    } catch (error) {
        console.error('Error extracting FEN from PGN:', error);
        return null;
    }
}

function renderPuzzleBoard(puzzle) {
    const boardElement = document.getElementById('puzzleBoard');
    if (!boardElement) {
        console.error('puzzleBoard element not found!');
        return;
    }
    
    boardElement.innerHTML = '';
    boardElement.style.display = 'grid';
    boardElement.style.gridTemplateColumns = 'repeat(8, 60px)';
    boardElement.style.gridTemplateRows = 'repeat(8, 60px)';
    boardElement.style.border = '3px solid #333';
    boardElement.style.cursor = 'pointer';
    
    // Parse FEN if available - try multiple possible field names
    let fen = puzzle.fen || puzzle.position || puzzle.game?.fen;
    
    // If no FEN, try to get it from the game PGN
    if (!fen && puzzle.game?.pgn && puzzle.initialPly !== undefined) {
        fen = extractFENFromPGN(puzzle.game.pgn, puzzle.initialPly);
    }
    
    // For Lichess puzzles, try to use the game's initial position
    // Lichess API sometimes includes the position in a different format
    if (!fen && puzzle.game) {
        // Check if there's position data in the game object
        if (puzzle.game.initialFen) {
            fen = puzzle.game.initialFen;
        } else if (puzzle.game.fen) {
            fen = puzzle.game.fen;
        }
    }
    
    // Fallback to starting position if still no FEN
    if (!fen) {
        console.warn('No FEN found in puzzle data:', puzzle);
        console.warn('Using starting position as fallback');
        fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    
    console.log('Rendering puzzle board with FEN:', fen);
    puzzleBoardState = parseFENToBoard(fen);
    
    if (!puzzleBoardState) {
        console.error('Failed to parse FEN:', fen);
        console.error('Using default starting position');
        puzzleBoardState = parseFENToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }
    
    // Verify board was created correctly
    if (!puzzleBoardState || puzzleBoardState.length !== 8) {
        console.error('Invalid board state created, reinitializing...');
        puzzleBoardState = parseFENToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }
    
    puzzleMoves = [];
    puzzleCurrentMoveIndex = 0;
    puzzleSelectedSquare = null;
    
    // Determine whose turn it is from FEN
    const fenParts = fen.split(' ');
    const activeColor = fenParts[1] || 'w';
    
    // Render the board
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.style.width = '60px';
            square.style.height = '60px';
            square.style.display = 'flex';
            square.style.alignItems = 'center';
            square.style.justifyContent = 'center';
            square.style.fontSize = '40px';
            square.style.background = (row + col) % 2 === 0 ? '#F0D9B5' : '#B58863';
            square.style.cursor = 'pointer';
            square.dataset.row = row;
            square.dataset.col = col;
            
            const piece = puzzleBoardState[row][col];
            if (piece) {
                square.textContent = getPieceSymbol(piece);
                // Add high contrast styling for pieces
                if (piece.color === 'white') {
                    square.style.color = '#FFFFFF';
                    square.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)';
                } else {
                    square.style.color = '#000000';
                    square.style.textShadow = '2px 2px 4px rgba(255,255,255,0.8), -1px -1px 2px rgba(255,255,255,0.5)';
                }
            }
            
            // Make squares clickable
            square.onclick = () => handlePuzzleSquareClick(row, col, activeColor);
            
            boardElement.appendChild(square);
        }
    }
}

function parseFEN(fen) {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    const rows = fen.split(' ')[0].split('/');
    
    const pieceMap = {
        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
        'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };
    
    for (let row = 0; row < 8; row++) {
        let col = 0;
        for (const char of rows[row]) {
            if (char >= '1' && char <= '8') {
                col += parseInt(char);
            } else {
                board[row][col] = pieceMap[char] || char;
                col++;
            }
        }
    }
    
    return board;
}

function parseFENToBoard(fen) {
    if (!fen || typeof fen !== 'string') {
        console.error('Invalid FEN string:', fen);
        return null;
    }
    
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    const fenPart = fen.split(' ')[0]; // Get just the board position part
    const rows = fenPart.split('/');
    
    if (rows.length !== 8) {
        console.error('Invalid FEN format - expected 8 rows, got:', rows.length);
        return null;
    }
    
    const pieceTypes = {
        'K': 'king', 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight', 'P': 'pawn',
        'k': 'king', 'q': 'queen', 'r': 'rook', 'b': 'bishop', 'n': 'knight', 'p': 'pawn'
    };
    
    for (let row = 0; row < 8; row++) {
        let col = 0;
        for (const char of rows[row]) {
            if (char >= '1' && char <= '8') {
                // Empty squares
                col += parseInt(char);
            } else if (pieceTypes[char.toLowerCase()]) {
                // Piece
                const isWhite = char === char.toUpperCase();
                board[row][col] = {
                    type: pieceTypes[char.toLowerCase()],
                    color: isWhite ? 'white' : 'black'
                };
                col++;
            } else {
                // Invalid character, skip
                console.warn('Invalid FEN character:', char, 'at row', row);
            }
            
            if (col > 8) {
                console.error('Column overflow at row', row);
                break;
            }
        }
        
        if (col !== 8) {
            console.warn('Row', row, 'has', col, 'columns instead of 8');
        }
    }
    
    return board;
}

function getPieceSymbol(piece) {
    const symbols = {
        white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
        black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
    return symbols[piece.color][piece.type];
}

function handlePuzzleSquareClick(row, col, activeColor) {
    if (!puzzleBoardState) return;
    
    const piece = puzzleBoardState[row][col];
    const expectedColor = activeColor === 'w' ? 'white' : 'black';
    
    if (puzzleSelectedSquare) {
        const [fromRow, fromCol] = puzzleSelectedSquare;
        // Try to make move
        if (fromRow !== row || fromCol !== col) {
            makePuzzleMove(fromRow, fromCol, row, col, expectedColor);
        }
        clearPuzzleSelection();
    } else {
        // Select piece if it's the active color's turn
        if (piece && piece.color === expectedColor) {
            puzzleSelectedSquare = [row, col];
            highlightPuzzleSquare(row, col);
        }
    }
}

function highlightPuzzleSquare(row, col) {
    const squares = document.querySelectorAll('#puzzleBoard > div');
    squares.forEach(square => {
        square.style.boxShadow = '';
        const r = parseInt(square.dataset.row);
        const c = parseInt(square.dataset.col);
        if (r === row && c === col) {
            square.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.8)';
        }
    });
}

function clearPuzzleSelection() {
    puzzleSelectedSquare = null;
    const squares = document.querySelectorAll('#puzzleBoard > div');
    squares.forEach(square => {
        square.style.boxShadow = '';
    });
}

function makePuzzleMove(fromRow, fromCol, toRow, toCol, expectedColor) {
    const piece = puzzleBoardState[fromRow][fromCol];
    if (!piece || piece.color !== expectedColor) return;
    
    // Make the move
    puzzleBoardState[toRow][toCol] = piece;
    puzzleBoardState[fromRow][fromCol] = null;
    
    // Record move
    const moveNotation = `${String.fromCharCode(97 + fromCol)}${8 - fromRow}${String.fromCharCode(97 + toCol)}${8 - toRow}`;
    puzzleMoves.push(moveNotation);
    
    // Re-render board
    renderPuzzleBoardState();
    
    // Check if move matches solution
    if (currentPuzzle && currentPuzzle.solution) {
        const solutionMoves = currentPuzzle.solution;
        if (puzzleMoves.length <= solutionMoves.length) {
            const expectedMove = solutionMoves[puzzleMoves.length - 1];
            if (moveNotation === expectedMove || moveNotation.toLowerCase() === expectedMove.toLowerCase()) {
                // Correct move!
                if (puzzleMoves.length === solutionMoves.length) {
                    alert('🎉 Puzzle solved!');
                }
            } else {
                alert('❌ Incorrect move. Try again!');
                // Reset to initial position
                resetPuzzle();
            }
        }
    }
}

function renderPuzzleBoardState() {
    const boardElement = document.getElementById('puzzleBoard');
    if (!boardElement || !puzzleBoardState) return;
    
    const squares = boardElement.querySelectorAll('div');
    squares.forEach(square => {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        const piece = puzzleBoardState[row][col];
        
        if (piece) {
            square.textContent = getPieceSymbol(piece);
            // Add high contrast styling for pieces
            if (piece.color === 'white') {
                square.style.color = '#FFFFFF';
                square.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)';
            } else {
                square.style.color = '#000000';
                square.style.textShadow = '2px 2px 4px rgba(255,255,255,0.8), -1px -1px 2px rgba(255,255,255,0.5)';
            }
        } else {
            square.textContent = '';
            square.style.color = '';
            square.style.textShadow = '';
        }
    });
}

function showSolution() {
    document.getElementById('puzzleSolution').style.display = 'block';
}

function resetPuzzle() {
    document.getElementById('puzzleSolution').style.display = 'none';
    displayPuzzle();
}

// Load openings
async function loadOpenings() {
    try {
        console.log('Fetching chess openings...');
        const response = await fetch('../../data/chess/openings.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Openings loaded:', data.openings.length);
        openings = data.openings;
        allOpenings = [...openings];
        renderOpenings();
    } catch (error) {
        console.error('Failed to load openings:', error);
        const list = document.getElementById('openingsList');
        if (list) {
            list.innerHTML = `<p style="color: #FF6B6B;">Error loading openings: ${error.message}</p>`;
        }
    }
}

function renderOpenings() {
    const list = document.getElementById('openingsList');
    if (!list) return;
    
    list.innerHTML = '';
    
    openings.forEach(opening => {
        const card = document.createElement('div');
        card.className = 'game-card-item';
        card.innerHTML = `
            <h3>${opening.name}</h3>
            <p><strong>ECO:</strong> ${opening.eco}</p>
            <p>${opening.description}</p>
            <div class="status">
                <span class="badge">${opening.difficulty}</span>
                <span class="badge">${opening.popularity.replace('_', ' ')}</span>
            </div>
        `;
        card.onclick = () => viewOpening(opening);
        list.appendChild(card);
    });
}

function filterOpenings() {
    const difficulty = document.getElementById('difficultyFilter').value;
    const search = document.getElementById('openingSearch').value.toLowerCase();
    
    openings = allOpenings.filter(opening => {
        const matchesDifficulty = difficulty === 'all' || opening.difficulty === difficulty;
        const matchesSearch = search === '' || 
            opening.name.toLowerCase().includes(search) ||
            opening.eco.toLowerCase().includes(search) ||
            opening.description.toLowerCase().includes(search);
        return matchesDifficulty && matchesSearch;
    });
    
    renderOpenings();
}

function viewOpening(opening) {
    currentOpening = opening;
    openingMoveIndex = 0;
    
    document.getElementById('openingsList').parentElement.querySelector('div:first-of-type').style.display = 'none';
    document.getElementById('openingsList').style.display = 'none';
    document.getElementById('openingViewer').style.display = 'block';
    
    // Initialize opening board and parse moves
    console.log('Viewing opening:', currentOpening);
    initializeOpeningBoard();
    parseOpeningMoves();
    displayOpeningDetails();
    renderOpeningBoard();
    updateOpeningMoveDisplay();
}

function closeOpeningViewer() {
    document.getElementById('openingsList').parentElement.querySelector('div:first-of-type').style.display = 'block';
    document.getElementById('openingsList').style.display = 'grid';
    document.getElementById('openingViewer').style.display = 'none';
}

function displayOpeningDetails() {
    if (!currentOpening) return;
    
    document.getElementById('openingName').textContent = currentOpening.name;
    document.getElementById('openingECO').textContent = `ECO Code: ${currentOpening.eco} | Difficulty: ${currentOpening.difficulty}`;
    document.getElementById('openingDescription').textContent = currentOpening.description;
    
    if (currentOpening.variations) {
        document.getElementById('openingVariations').innerHTML = `
            <strong>Common Variations:</strong><br>
            ${currentOpening.variations.map(v => `• ${v}`).join('<br>')}
        `;
    } else {
        document.getElementById('openingVariations').innerHTML = '';
    }
    
    updateOpeningMoveDisplay();
}

function initializeOpeningBoard() {
    // Initialize board to starting position
    openingBoardState = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Set up starting position
    const startingPosition = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = startingPosition[row][col];
            if (piece) {
                const isWhite = piece === piece.toUpperCase();
                openingBoardState[row][col] = {
                    type: getPieceTypeFromChar(piece),
                    color: isWhite ? 'white' : 'black'
                };
            }
        }
    }
}

function parseOpeningMoves() {
    if (!currentOpening || !currentOpening.moves) {
        console.warn('No opening or moves found');
        openingMoves = [];
        return;
    }
    
    // Parse moves from the opening's moves array
    // Moves are typically in format like "e4", "Nf3", "d4", etc.
    openingMoves = currentOpening.moves.map(move => move.trim());
    console.log('Parsed opening moves:', openingMoves);
}

function renderOpeningBoard() {
    const boardElement = document.getElementById('openingBoard');
    if (!boardElement) {
        console.error('openingBoard element not found!');
        return;
    }
    
    console.log('=== renderOpeningBoard() CALLED ===');
    console.log('moveIndex:', openingMoveIndex, 'moves:', openingMoves.length);
    console.log('Board element exists:', !!boardElement);
    console.log('Board element parent:', boardElement.parentElement);
    console.log('Board element display before:', window.getComputedStyle(boardElement).display);
    console.log('openingBoardState:', openingBoardState);
    
    // Ensure board element is visible and properly positioned
    boardElement.style.display = 'grid';
    boardElement.style.visibility = 'visible';
    boardElement.style.opacity = '1';
    boardElement.style.position = 'relative';
    
    // Clear and set up grid
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = 'repeat(8, 60px)';
    boardElement.style.gridTemplateRows = 'repeat(8, 60px)';
    boardElement.style.border = '3px solid #333';
    boardElement.style.margin = '20px auto';
    boardElement.style.width = '480px'; // 8 * 60px
    boardElement.style.height = '480px'; // 8 * 60px
    boardElement.style.backgroundColor = 'transparent';
    
    // Reset to starting position
    if (!openingBoardState) {
        console.error('openingBoardState is null! Initializing...');
        initializeOpeningBoard();
    } else {
        initializeOpeningBoard(); // Reset to starting position
    }
    
    // Apply moves up to current index
    for (let i = 0; i < openingMoveIndex && i < openingMoves.length; i++) {
        const move = openingMoves[i];
        const color = i % 2 === 0 ? 'white' : 'black';
        console.log(`Applying move ${i}: ${move} (${color})`);
        applyOpeningMove(move, color);
    }
    
    console.log('Board state after applying moves:', openingBoardState);
    
    // Render the board
    let squaresCreated = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.style.width = '60px';
            square.style.height = '60px';
            square.style.display = 'flex';
            square.style.alignItems = 'center';
            square.style.justifyContent = 'center';
            square.style.fontSize = '40px';
            square.style.background = (row + col) % 2 === 0 ? '#F0D9B5' : '#B58863';
            square.style.border = 'none';
            square.style.boxSizing = 'border-box';
            
            const piece = openingBoardState[row][col];
            if (piece) {
                square.textContent = getPieceSymbol(piece);
                // Add high contrast styling for pieces
                if (piece.color === 'white') {
                    square.style.color = '#FFFFFF';
                    square.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)';
                } else {
                    square.style.color = '#000000';
                    square.style.textShadow = '2px 2px 4px rgba(255,255,255,0.8), -1px -1px 2px rgba(255,255,255,0.5)';
                }
            }
            
            boardElement.appendChild(square);
            squaresCreated++;
        }
    }
    
    console.log(`Created ${squaresCreated} squares`);
    
    // Final verification
    const computedStyle = window.getComputedStyle(boardElement);
    console.log('Board element display after:', computedStyle.display);
    console.log('Board element visibility after:', computedStyle.visibility);
    console.log('Board element opacity after:', computedStyle.opacity);
    console.log('Board element children:', boardElement.children.length);
    console.log('Board element width:', computedStyle.width);
    console.log('Board element height:', computedStyle.height);
    
    // Force a reflow to ensure rendering
    void boardElement.offsetHeight;
    
    // Double-check board is still in DOM
    if (!document.body.contains(boardElement)) {
        console.error('ERROR: Board element was removed from DOM!');
    }
    
    console.log('=== renderOpeningBoard() COMPLETE ===');
}

function applyOpeningMove(moveNotation, color) {
    if (!moveNotation) return;
    
    // Remove check/checkmate symbols
    moveNotation = moveNotation.replace(/[+#]/, '').trim();
    
    // Handle castling
    if (moveNotation === 'O-O' || moveNotation === '0-0') {
        applyOpeningCastle(color, 'kingside');
        return;
    }
    if (moveNotation === 'O-O-O' || moveNotation === '0-0-0') {
        applyOpeningCastle(color, 'queenside');
        return;
    }
    
    // Handle captures
    const isCapture = moveNotation.includes('x');
    moveNotation = moveNotation.replace('x', '');
    
    // Extract destination
    const destMatch = moveNotation.match(/([a-h])([1-8])$/);
    if (!destMatch) return;
    
    const destCol = destMatch[1].charCodeAt(0) - 97;
    const destRow = 8 - parseInt(destMatch[2]);
    
    // Determine piece type (default to pawn)
    let pieceType = 'pawn';
    let sourceHint = null;
    
    if (moveNotation[0] && moveNotation[0].toUpperCase() !== moveNotation[0].toLowerCase()) {
        const pieceChar = moveNotation[0].toUpperCase();
        const types = { 'R': 'rook', 'N': 'knight', 'B': 'bishop', 'Q': 'queen', 'K': 'king' };
        pieceType = types[pieceChar] || 'pawn';
        moveNotation = moveNotation.substring(1);
    }
    
    // Check for source file/rank hints (e.g., "Nbd2", "R1a3")
    if (moveNotation.length > 2) {
        const hint = moveNotation[0];
        if (hint >= 'a' && hint <= 'h') {
            sourceHint = { type: 'file', value: hint.charCodeAt(0) - 97 };
            moveNotation = moveNotation.substring(1);
        } else if (hint >= '1' && hint <= '8') {
            sourceHint = { type: 'rank', value: 8 - parseInt(hint) };
            moveNotation = moveNotation.substring(1);
        }
    }
    
    // Find the piece that can make this move — collect all candidates, use closest/rightmost
    let bestCandidate = null;
    let bestScore = Infinity;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = openingBoardState[row][col];
            if (!piece || piece.type !== pieceType || piece.color !== color) continue;

            if (sourceHint) {
                if (sourceHint.type === 'file' && col !== sourceHint.value) continue;
                if (sourceHint.type === 'rank' && row !== sourceHint.value) continue;
            }

            if (!canOpeningPieceMoveTo(row, col, destRow, destCol, pieceType, color)) continue;

            const score = Math.abs(row - destRow) + Math.abs(col - destCol);
            if (score < bestScore) {
                bestScore = score;
                bestCandidate = { row, col, piece };
            }
        }
    }

    if (bestCandidate) {
        openingBoardState[destRow][destCol] = bestCandidate.piece;
        openingBoardState[bestCandidate.row][bestCandidate.col] = null;
        console.log(`Applied opening move: ${moveNotation} from [${bestCandidate.row},${bestCandidate.col}] to [${destRow},${destCol}]`);
        return;
    }
}

function canOpeningPieceMoveTo(fromRow, fromCol, toRow, toCol, pieceType, color) {
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    
    // Can't move to the same square
    if (rowDiff === 0 && colDiff === 0) return false;
    
    // Check if destination is occupied by same color
    if (openingBoardState[toRow][toCol] && openingBoardState[toRow][toCol].color === color) {
        return false;
    }
    
    switch (pieceType) {
        case 'pawn':
            const direction = color === 'white' ? -1 : 1;
            const startRow = color === 'white' ? 6 : 1;
            
            // Forward move (one square)
            if (colDiff === 0 && rowDiff === direction) {
                return openingBoardState[toRow][toCol] === null;
            }
            // Forward move (two squares from start)
            if (colDiff === 0 && rowDiff === direction * 2 && fromRow === startRow) {
                return openingBoardState[toRow][toCol] === null && 
                       openingBoardState[fromRow + direction][fromCol] === null;
            }
            // Capture (diagonal)
            if (Math.abs(colDiff) === 1 && rowDiff === direction) {
                return openingBoardState[toRow][toCol] !== null && 
                       openingBoardState[toRow][toCol].color !== color;
            }
            return false;
        case 'rook':
            return (rowDiff === 0 || colDiff === 0);
        case 'knight':
            return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
                   (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
        case 'bishop':
            return Math.abs(rowDiff) === Math.abs(colDiff);
        case 'queen':
            return (rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff));
        case 'king':
            return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        default:
            return false;
    }
}

function applyOpeningCastle(color, side) {
    const row = color === 'white' ? 7 : 0;
    if (side === 'kingside') {
        // Move king
        openingBoardState[row][6] = openingBoardState[row][4];
        openingBoardState[row][4] = null;
        // Move rook
        openingBoardState[row][5] = openingBoardState[row][7];
        openingBoardState[row][7] = null;
    } else {
        // Move king
        openingBoardState[row][2] = openingBoardState[row][4];
        openingBoardState[row][4] = null;
        // Move rook
        openingBoardState[row][3] = openingBoardState[row][0];
        openingBoardState[row][0] = null;
    }
}

function prevOpeningMove() {
    console.log('prevOpeningMove called, current index:', openingMoveIndex);
    if (openingMoveIndex > 0) {
        openingMoveIndex--;
        console.log('Decremented to:', openingMoveIndex);
        renderOpeningBoard();
        updateOpeningMoveDisplay();
    } else {
        console.log('Already at first move');
    }
}

function nextOpeningMove() {
    console.log('=== nextOpeningMove() CALLED ===');
    console.log('current index:', openingMoveIndex, 'total moves:', openingMoves.length);
    console.log('openingMoves:', openingMoves);
    
    if (!openingMoves || openingMoves.length === 0) {
        console.error('No opening moves available!');
        alert('No opening moves available!');
        return;
    }
    
    if (openingMoveIndex < openingMoves.length) {
        openingMoveIndex++;
        console.log('Incremented to:', openingMoveIndex);
        
        // Ensure openingViewer is visible
        const viewer = document.getElementById('openingViewer');
        if (viewer) {
            viewer.style.display = 'block';
            console.log('openingViewer display set to block');
        } else {
            console.error('openingViewer element not found!');
        }
        
        // Ensure board element exists and is visible BEFORE rendering
        const boardElement = document.getElementById('openingBoard');
        if (!boardElement) {
            console.error('openingBoard element not found before render!');
            alert('Board element not found!');
            return;
        }
        
        // Check parent visibility
        const parent = boardElement.parentElement;
        if (parent) {
            const parentStyle = window.getComputedStyle(parent);
            console.log('Parent container display:', parentStyle.display);
            if (parentStyle.display === 'none') {
                console.warn('Parent container is hidden!');
                parent.style.display = 'block';
            }
        }
        
        // Ensure board is visible before rendering
        boardElement.style.display = 'grid';
        boardElement.style.visibility = 'visible';
        boardElement.style.opacity = '1';
        
        try {
            renderOpeningBoard();
            updateOpeningMoveDisplay();
        } catch (error) {
            console.error('Error during render:', error);
            alert('Error rendering board: ' + error.message);
            return;
        }
        
        // Verify board is still visible after rendering
        const computedStyle = window.getComputedStyle(boardElement);
        console.log('Board visibility after render:', {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            width: computedStyle.width,
            height: computedStyle.height,
            children: boardElement.children.length,
            inDOM: document.body.contains(boardElement)
        });
        
        // If board has no children, something went wrong
        if (boardElement.children.length === 0) {
            console.error('Board has no children after render! Re-rendering...');
            renderOpeningBoard();
        }
        
        console.log('=== nextOpeningMove() COMPLETE ===');
    } else {
        console.log('Already at last move');
        alert('Already at the last move!');
    }
}

function resetOpening() {
    console.log('resetOpening called');
    openingMoveIndex = 0;
    renderOpeningBoard();
    updateOpeningMoveDisplay();
}

// Make functions globally accessible
window.prevOpeningMove = prevOpeningMove;
window.nextOpeningMove = nextOpeningMove;
window.resetOpening = resetOpening;

function updateOpeningMoveDisplay() {
    const movesElement = document.getElementById('openingMoves');
    if (!movesElement || !currentOpening) return;
    
    let movesText = '<strong>Moves:</strong><br>';
    for (let i = 0; i < currentOpening.moves.length; i++) {
        const moveNum = Math.floor(i / 2) + 1;
        const isWhite = i % 2 === 0;
        
        if (isWhite) {
            movesText += `${moveNum}. `;
        }
        
        let moveText = currentOpening.moves[i];
        if (i < openingMoveIndex) {
            moveText = `<span style="color: #4CAF50; font-weight: bold;">${moveText}</span>`;
        } else if (i === openingMoveIndex) {
            moveText = `<span style="background: rgba(76, 175, 80, 0.3); padding: 2px 4px; border-radius: 3px;">${moveText}</span>`;
        }
        
        movesText += moveText + ' ';
        
        if (!isWhite || i === currentOpening.moves.length - 1) {
            movesText += '<br>';
        }
    }
    
    movesElement.innerHTML = movesText;
}

// Load blunders
async function loadBlunders() {
    try {
        console.log('Fetching chess blunders...');
        const response = await fetch('../../data/chess/blunders.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Blunders loaded:', data.blunders.length);
        blunders = data.blunders;
        renderBlundersList();
    } catch (error) {
        console.error('Failed to load blunders:', error);
        const list = document.getElementById('blundersList');
        if (list) {
            list.innerHTML = `<p style="color: #FF6B6B;">Error: ${error.message}</p>`;
        }
    }
}

function renderBlundersList() {
    const list = document.getElementById('blundersList');
    if (!list) return;
    
    list.innerHTML = '';
    
    blunders.forEach(blunder => {
        const card = document.createElement('div');
        card.className = 'game-card-item';
        card.innerHTML = `
            <h3>${blunder.title}</h3>
            <p><strong>${blunder.player}</strong> vs ${blunder.opponent}</p>
            <p>${blunder.date} | ${blunder.event}</p>
            <p>Move ${blunder.move_number}: ${blunder.blunder_move} ❌</p>
            <p style="color: #FFD700; margin-top: 10px;">${blunder.description.substring(0, 100)}...</p>
            <div class="status" style="margin-top: 10px;">
                <span class="badge">${blunder.difficulty}</span>
                ${blunder.themes.map(t => `<span class="badge">#${t}</span>`).join(' ')}
            </div>
        `;
        card.onclick = () => viewBlunder(blunder);
        list.appendChild(card);
    });
}

function viewBlunder(blunder) {
    currentBlunder = blunder;
    currentBlunderMoveIndex = 0;
    blunderMoves = [];

    document.getElementById('blundersList').style.display = 'none';
    document.getElementById('blunderViewer').style.display = 'block';

    document.getElementById('blunderTitle').textContent = blunder.title;
    document.getElementById('blunderPlayer').innerHTML = `<strong>Player:</strong> ${blunder.player}<br><strong>Opponent:</strong> ${blunder.opponent}<br><strong>Event:</strong> ${blunder.event} (${blunder.date})`;
    document.getElementById('blunderMove').innerHTML = `<strong>Blunder Move:</strong> ${blunder.blunder_move} ❌<br><strong>Correct Move:</strong> ${blunder.correct_move} ✅<br><strong>Move Number:</strong> ${blunder.move_number}`;
    document.getElementById('blunderDescription').textContent = blunder.description;
    document.getElementById('blunderAnalysisText').textContent = blunder.analysis;
    document.getElementById('blunderLessonText').textContent = blunder.lesson;

    // Initialize board to starting position
    initializeBlunderBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    // Parse PGN if available, otherwise use FEN position
    if (blunder.pgn) {
        parseBlunderPGN(blunder.pgn);
        applyBlunderMovesToBoard();
    } else {
        // Fallback to FEN position
        initializeBlunderBoard(blunder.position_fen);
    }

    renderBlunderBoard();
    updateBlunderMoveDisplay();
}

function closeBlunderViewer() {
    document.getElementById('blundersList').style.display = 'grid';
    document.getElementById('blunderViewer').style.display = 'none';
}

function initializeBlunderBoard(fen) {
    blunderBoardState = parseFENToBoard(fen);
}

function parseBlunderPGN(pgn) {
    // Parse PGN into individual moves (simplified version)
    if (!pgn) {
        blunderMoves = [];
        return;
    }

    // Remove move numbers and clean up the PGN
    const cleanPGN = pgn.replace(/\d+\./g, '').trim();
    blunderMoves = cleanPGN.split(/\s+/).filter(move => move && !move.includes('#') && move !== '1-0' && move !== '0-1' && move !== '1/2-1/2');

    console.log('Parsed blunder moves:', blunderMoves);
}

function applyBlunderMovesToBoard() {
    // Reset to starting position
    initializeBlunderBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

    // Apply moves up to currentMoveIndex
    const movesToApply = currentBlunderMoveIndex * 2; // Each move number has white and black
    for (let i = 0; i < movesToApply && i < blunderMoves.length; i++) {
        const color = i % 2 === 0 ? 'white' : 'black';
        applyPGNMove(blunderMoves[i], color);
    }
}

function nextBlunderMove() {
    if (!blunderMoves || blunderMoves.length === 0) {
        alert('No game moves available for this blunder.');
        return;
    }

    const maxMoveNumber = Math.ceil(blunderMoves.length / 2);
    if (currentBlunderMoveIndex < maxMoveNumber) {
        currentBlunderMoveIndex++;
        applyBlunderMovesToBoard();
        renderBlunderBoard();
        updateBlunderMoveDisplay();
    } else {
        alert('Already at the last move!');
    }
}

function prevBlunderMove() {
    if (currentBlunderMoveIndex > 0) {
        currentBlunderMoveIndex--;
        applyBlunderMovesToBoard();
        renderBlunderBoard();
        updateBlunderMoveDisplay();
    } else {
        alert('Already at the beginning!');
    }
}

function resetBlunderGame() {
    currentBlunderMoveIndex = 0;
    applyBlunderMovesToBoard();
    renderBlunderBoard();
    updateBlunderMoveDisplay();
}

function updateBlunderMoveDisplay() {
    const displayElement = document.getElementById('blunderMoveDisplay');
    if (!displayElement) return;

    if (!blunderMoves || blunderMoves.length === 0) {
        displayElement.textContent = 'Position before blunder';
        return;
    }

    const totalMoves = Math.ceil(blunderMoves.length / 2);
    const currentMove = currentBlunderMoveIndex;

    if (currentMove === 0) {
        displayElement.textContent = 'Starting position';
    } else if (currentMove <= totalMoves) {
        displayElement.textContent = `Move ${currentMove}`;
    } else {
        displayElement.textContent = 'Final position';
    }

    console.log('Current blunder move index:', currentBlunderMoveIndex, 'Total moves:', blunderMoves.length);
}

function showBlunderPosition() {
    if (!currentBlunder) return;

    // Go to the position just before the blunder
    if (currentBlunder.pgn) {
        const blunderMoveIndex = Math.floor((currentBlunder.move_number - 1) / 2);
        currentBlunderMoveIndex = blunderMoveIndex;
        applyBlunderMovesToBoard();
    } else {
        initializeBlunderBoard(currentBlunder.position_fen);
    }
    renderBlunderBoard();
    updateBlunderMoveDisplay();
}

function showBlunderMove() {
    if (!currentBlunder) return;

    // If we have PGN, go to the blunder move
    if (currentBlunder.pgn) {
        // Calculate which move index the blunder occurs at
        const blunderMoveIndex = Math.floor((currentBlunder.move_number - 1) / 2);
        currentBlunderMoveIndex = blunderMoveIndex;
        applyBlunderMovesToBoard();
        renderBlunderBoard();
        updateBlunderMoveDisplay();
    } else {
        // Fallback: just show the position
        initializeBlunderBoard(currentBlunder.position_fen);
        renderBlunderBoard();
    }

    alert(`Blunder: ${currentBlunder.blunder_move}\n\n${currentBlunder.analysis}`);
}

function showCorrectMove() {
    if (!currentBlunder) return;

    // Show the position and indicate the correct move
    if (currentBlunder.pgn) {
        const blunderMoveIndex = Math.floor((currentBlunder.move_number - 1) / 2);
        currentBlunderMoveIndex = blunderMoveIndex;
        applyBlunderMovesToBoard();
        renderBlunderBoard();
    } else {
        initializeBlunderBoard(currentBlunder.position_fen);
        renderBlunderBoard();
    }

    alert(`Correct Move: ${currentBlunder.correct_move}\n\nThis maintains the advantage and avoids the blunder.`);
}

function renderBlunderBoard() {
    const boardElement = document.getElementById('blunderBoard');
    if (!boardElement) return;
    
    boardElement.innerHTML = '';
    boardElement.style.display = 'grid';
    boardElement.style.gridTemplateColumns = 'repeat(8, 60px)';
    boardElement.style.gridTemplateRows = 'repeat(8, 60px)';
    boardElement.style.border = '3px solid #333';
    boardElement.style.margin = '20px auto';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.style.width = '60px';
            square.style.height = '60px';
            square.style.display = 'flex';
            square.style.alignItems = 'center';
            square.style.justifyContent = 'center';
            square.style.fontSize = '40px';
            square.style.background = (row + col) % 2 === 0 ? '#F0D9B5' : '#B58863';
            
            const piece = blunderBoardState[row][col];
            if (piece) {
                square.textContent = getPieceSymbol(piece);
                // Add high contrast styling for pieces
                if (piece.color === 'white') {
                    square.style.color = '#FFFFFF';
                    square.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)';
                } else {
                    square.style.color = '#000000';
                    square.style.textShadow = '2px 2px 4px rgba(255,255,255,0.8), -1px -1px 2px rgba(255,255,255,0.5)';
                }
            }
            
            boardElement.appendChild(square);
        }
    }
}

// Load endgames
async function loadEndgames() {
    try {
        console.log('Fetching chess endgames...');
        const response = await fetch('../../data/chess/endgames.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Endgames loaded:', data.endgames.length);
        endgames = data.endgames;
        allEndgames = [...endgames];
        renderEndgames();
    } catch (error) {
        console.error('Failed to load endgames:', error);
        const list = document.getElementById('endgamesList');
        if (list) {
            list.innerHTML = `<p style="color: #FF6B6B;">Error loading endgames: ${error.message}</p>`;
        }
    }
}

function renderEndgames() {
    const list = document.getElementById('endgamesList');
    if (!list) return;
    
    list.innerHTML = '';
    
    endgames.forEach(endgame => {
        const card = document.createElement('div');
        card.className = 'game-card-item';
        card.innerHTML = `
            <h3>${endgame.name}</h3>
            <p><strong>Category:</strong> ${endgame.category}</p>
            <p>${endgame.description}</p>
            <div class="status">
                <span class="badge">${endgame.difficulty}</span>
            </div>
        `;
        card.onclick = () => viewEndgame(endgame);
        list.appendChild(card);
    });
}

function filterEndgames() {
    const category = document.getElementById('endgameCategoryFilter').value;
    const difficulty = document.getElementById('endgameDifficultyFilter').value;
    const search = document.getElementById('endgameSearch').value.toLowerCase();
    
    endgames = allEndgames.filter(endgame => {
        const matchesCategory = category === 'all' || endgame.category === category;
        const matchesDifficulty = difficulty === 'all' || endgame.difficulty === difficulty;
        const matchesSearch = search === '' || 
            endgame.name.toLowerCase().includes(search) ||
            endgame.description.toLowerCase().includes(search) ||
            endgame.category.toLowerCase().includes(search);
        return matchesCategory && matchesDifficulty && matchesSearch;
    });
    
    renderEndgames();
}

function viewEndgame(endgame) {
    currentEndgame = endgame;
    endgameMoveIndex = 0;
    
    document.getElementById('endgamesList').parentElement.querySelector('div:first-of-type').style.display = 'none';
    document.getElementById('endgamesList').style.display = 'none';
    document.getElementById('endgameViewer').style.display = 'block';
    
    console.log('Viewing endgame:', currentEndgame);
    initializeEndgameBoard();
    parseEndgameMoves();
    displayEndgameDetails();
    renderEndgameBoard();
    updateEndgameMoveDisplay();
}

function closeEndgameViewer() {
    document.getElementById('endgamesList').parentElement.querySelector('div:first-of-type').style.display = 'block';
    document.getElementById('endgamesList').style.display = 'grid';
    document.getElementById('endgameViewer').style.display = 'none';
}

function displayEndgameDetails() {
    if (!currentEndgame) return;
    
    document.getElementById('endgameName').textContent = currentEndgame.name;
    document.getElementById('endgameCategory').textContent = `Category: ${currentEndgame.category} | Difficulty: ${currentEndgame.difficulty}`;
    document.getElementById('endgameDescription').textContent = currentEndgame.description;
    
    if (currentEndgame.keyPoints && currentEndgame.keyPoints.length > 0) {
        document.getElementById('endgameKeyPoints').innerHTML = `
            <strong>Key Points:</strong><br>
            ${currentEndgame.keyPoints.map(point => `• ${point}`).join('<br>')}
        `;
    } else {
        document.getElementById('endgameKeyPoints').innerHTML = '';
    }
    
    updateEndgameMoveDisplay();
}

function initializeEndgameBoard() {
    if (!currentEndgame || !currentEndgame.fen) {
        console.error('No endgame or FEN found');
        return;
    }
    
    endgameBoardState = parseFENToBoard(currentEndgame.fen);
}

function parseEndgameMoves() {
    if (!currentEndgame || !currentEndgame.solution) {
        console.warn('No endgame or solution found');
        endgameMoves = [];
        return;
    }
    
    if (Array.isArray(currentEndgame.solution)) {
        endgameMoves = currentEndgame.solution.map(move => String(move).trim()).filter(m => m);
    } else if (typeof currentEndgame.solution === 'string') {
        endgameMoves = currentEndgame.solution.split(/\s+/).map(m => m.trim()).filter(m => m);
    } else {
        console.error('Invalid solution format:', typeof currentEndgame.solution, currentEndgame.solution);
        endgameMoves = [];
    }
    
    console.log('Parsed endgame moves:', endgameMoves, 'from:', currentEndgame.solution);
}

function renderEndgameBoard() {
    const boardElement = document.getElementById('endgameBoard');
    if (!boardElement) {
        console.error('endgameBoard element not found!');
        return;
    }
    
    console.log('renderEndgameBoard called, moveIndex:', endgameMoveIndex, 'moves:', endgameMoves.length);
    
    boardElement.innerHTML = '';
    boardElement.style.display = 'grid';
    boardElement.style.gridTemplateColumns = 'repeat(8, 60px)';
    boardElement.style.gridTemplateRows = 'repeat(8, 60px)';
    boardElement.style.border = '3px solid #333';
    boardElement.style.margin = '20px auto';
    
    // Reset to starting position
    initializeEndgameBoard();
    
    // Apply moves up to current index
    if (endgameMoves && endgameMoves.length > 0) {
        for (let i = 0; i < endgameMoveIndex && i < endgameMoves.length; i++) {
            const move = endgameMoves[i];
            if (!move) {
                console.warn(`Skipping empty move at index ${i}`);
                continue;
            }
            const color = i % 2 === 0 ? 'white' : 'black';
            console.log(`Applying move ${i}: ${move} (${color})`);
            const success = applyEndgameMove(move, color);
            if (!success) {
                console.warn(`Failed to apply move ${i}: ${move}`);
            }
        }
    } else {
        console.warn('No moves to apply!');
    }
    
    // Render the board
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.style.width = '60px';
            square.style.height = '60px';
            square.style.display = 'flex';
            square.style.alignItems = 'center';
            square.style.justifyContent = 'center';
            square.style.fontSize = '40px';
            square.style.background = (row + col) % 2 === 0 ? '#F0D9B5' : '#B58863';
            
            const piece = endgameBoardState[row][col];
            if (piece) {
                square.textContent = getPieceSymbol(piece);
                // Add high contrast styling for pieces
                if (piece.color === 'white') {
                    square.style.color = '#FFFFFF';
                    square.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)';
                } else {
                    square.style.color = '#000000';
                    square.style.textShadow = '2px 2px 4px rgba(255,255,255,0.8), -1px -1px 2px rgba(255,255,255,0.5)';
                }
            }
            
            boardElement.appendChild(square);
        }
    }
}

function applyEndgameMove(moveNotation, color) {
    if (!moveNotation) {
        console.warn('Empty move notation');
        return false;
    }
    
    if (!endgameBoardState) {
        console.error('endgameBoardState is null!');
        return false;
    }
    
    // Remove check/checkmate symbols
    moveNotation = String(moveNotation).replace(/[+#]/, '').trim();
    
    console.log(`Attempting to apply endgame move: ${moveNotation} for ${color}`);

    // Handle castling
    if (moveNotation === 'O-O' || moveNotation === '0-0') {
        applyEndgameCastle(color, 'kingside');
        return true;
    }
    if (moveNotation === 'O-O-O' || moveNotation === '0-0-0') {
        applyEndgameCastle(color, 'queenside');
        return true;
    }

    // Handle pawn promotion
    if (moveNotation.includes('=')) {
        moveNotation = moveNotation.split('=')[0];
    }

    // Check for pawn file disambiguation before capture detection (e.g., "hxg3")
    let sourceHint = null;
    if (moveNotation.length > 3 && moveNotation[1] === 'x' && moveNotation[0] >= 'a' && moveNotation[0] <= 'h') {
        // Format: "hxg3" - h is the pawn's file
        sourceHint = { type: 'file', value: moveNotation[0].charCodeAt(0) - 97 };
        moveNotation = moveNotation.substring(1); // Remove the file hint
    }

    // Handle captures
    const isCapture = moveNotation.includes('x');
    moveNotation = moveNotation.replace('x', '');

    // Extract destination
    const destMatch = moveNotation.match(/([a-h])([1-8])$/);
    if (!destMatch) {
        console.warn(`Could not parse destination from move: ${moveNotation}`);
        return false;
    }

    const destCol = destMatch[1].charCodeAt(0) - 97;
    const destRow = 8 - parseInt(destMatch[2]);

    // Determine piece type (default to pawn)
    let pieceType = 'pawn';

    // Check if first character is an uppercase piece letter
    const firstChar = moveNotation[0];
    const pieceLetters = ['K', 'Q', 'R', 'B', 'N'];
    if (firstChar && pieceLetters.includes(firstChar)) {
        const types = { 'R': 'rook', 'N': 'knight', 'B': 'bishop', 'Q': 'queen', 'K': 'king' };
        pieceType = types[firstChar] || 'pawn';
        moveNotation = moveNotation.substring(1);

        // Check for disambiguation hints (e.g., "R1e4" or "Rae4")
        if (moveNotation.length > 2) {
            const hint = moveNotation[0];
            if (hint >= 'a' && hint <= 'h') {
                sourceHint = { type: 'file', value: hint.charCodeAt(0) - 97 };
                moveNotation = moveNotation.substring(1);
            } else if (hint >= '1' && hint <= '8') {
                sourceHint = { type: 'rank', value: 8 - parseInt(hint) };
                moveNotation = moveNotation.substring(1);
            }
        }
    }
    
    // Find the piece that can make this move — collect all candidates, use closest/rightmost
    let bestCandidate = null;
    let bestScore = Infinity;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = endgameBoardState[row][col];
            if (!piece || piece.type !== pieceType || piece.color !== color) continue;

            if (sourceHint) {
                if (sourceHint.type === 'file' && col !== sourceHint.value) continue;
                if (sourceHint.type === 'rank' && row !== sourceHint.value) continue;
            }

            if (!canPieceMoveTo(row, col, destRow, destCol, pieceType, color, isCapture)) continue;

            const score = Math.abs(row - destRow) + Math.abs(col - destCol);
            if (score < bestScore) {
                bestScore = score;
                bestCandidate = { row, col, piece };
            }
        }
    }

    if (bestCandidate) {
        endgameBoardState[destRow][destCol] = bestCandidate.piece;
        endgameBoardState[bestCandidate.row][bestCandidate.col] = null;
        console.log(`Successfully applied endgame move: ${moveNotation} from [${bestCandidate.row},${bestCandidate.col}] to [${destRow},${destCol}]`);
        return true;
    }
    
    console.warn(`Could not find piece to make move: ${moveNotation} for ${color}`);
    return false;
}

function applyEndgameCastle(color, side) {
    const row = color === 'white' ? 7 : 0;
    
    if (side === 'kingside') {
        endgameBoardState[row][6] = endgameBoardState[row][4];
        endgameBoardState[row][5] = endgameBoardState[row][7];
        endgameBoardState[row][4] = null;
        endgameBoardState[row][7] = null;
    } else {
        endgameBoardState[row][2] = endgameBoardState[row][4];
        endgameBoardState[row][3] = endgameBoardState[row][0];
        endgameBoardState[row][4] = null;
        endgameBoardState[row][0] = null;
    }
}

function prevEndgameMove() {
    console.log('prevEndgameMove called, current index:', endgameMoveIndex);
    if (endgameMoveIndex > 0) {
        endgameMoveIndex--;
        console.log('Decremented to:', endgameMoveIndex);
        renderEndgameBoard();
        updateEndgameMoveDisplay();
    } else {
        console.log('Already at first move');
    }
}

function nextEndgameMove() {
    console.log('nextEndgameMove called, current index:', endgameMoveIndex, 'total moves:', endgameMoves.length);
    
    if (!endgameMoves || endgameMoves.length === 0) {
        console.error('No endgame moves available!');
        return;
    }
    
    if (endgameMoveIndex < endgameMoves.length) {
        endgameMoveIndex++;
        console.log('Incremented to:', endgameMoveIndex);
        renderEndgameBoard();
        updateEndgameMoveDisplay();
    } else {
        console.log('Already at last move');
    }
}

function resetEndgame() {
    console.log('resetEndgame called');
    endgameMoveIndex = 0;
    renderEndgameBoard();
    updateEndgameMoveDisplay();
}

function updateEndgameMoveDisplay() {
    const movesElement = document.getElementById('endgameMoves');
    if (!movesElement || !endgameMoves || endgameMoves.length === 0) return;
    
    let moveText = '';
    for (let i = 0; i < endgameMoves.length; i++) {
        const moveNum = Math.floor(i / 2) + 1;
        const isWhite = i % 2 === 0;
        const move = endgameMoves[i];
        
        if (isWhite) {
            moveText += `${moveNum}. ${move} `;
        } else {
            moveText += `${move} `;
        }
        
        if (i < endgameMoves.length - 1 && isWhite) {
            moveText += ' ';
        }
    }
    
    // Highlight applied moves
    let highlightedText = '';
    let moveCount = 0;
    for (let i = 0; i < endgameMoves.length; i++) {
        const moveNum = Math.floor(i / 2) + 1;
        const isWhite = i % 2 === 0;
        const move = endgameMoves[i];
        let moveText = '';
        
        if (isWhite) {
            moveText = `${moveNum}. ${move} `;
        } else {
            moveText = `${move} `;
        }
        
        if (i < endgameMoveIndex) {
            moveText = `<span style="color: #4CAF50; font-weight: bold;">${moveText}</span>`;
        } else if (i === endgameMoveIndex) {
            moveText = `<span style="background: rgba(76, 175, 80, 0.3); padding: 2px 4px; border-radius: 3px;">${moveText}</span>`;
        }
        
        highlightedText += moveText;
    }
    
    movesElement.innerHTML = highlightedText;
}

// Make functions globally accessible
window.prevEndgameMove = prevEndgameMove;
window.nextEndgameMove = nextEndgameMove;
window.resetEndgame = resetEndgame;
window.viewEndgame = viewEndgame;
window.closeEndgameViewer = closeEndgameViewer;
window.filterEndgames = filterEndgames;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Loading chess education content...');
    loadFamousGames();
    loadEncyclopedia();
    loadLessons();
    loadDailyPuzzle();
    loadOpenings();
    loadBlunders();
    loadEndgames();
});

// Keyboard navigation for chess replays
document.addEventListener('keydown', function(e) {
    // Only handle keyboard navigation when viewing games/replays
    const gameViewer = document.getElementById('gameViewer');
    const endgameViewer = document.getElementById('endgameViewer');
    const blunderViewer = document.getElementById('blunderViewer');

    const isViewingGame = gameViewer && gameViewer.style.display !== 'none';
    const isViewingEndgame = endgameViewer && endgameViewer.style.display !== 'none';
    const isViewingBlunder = blunderViewer && blunderViewer.style.display !== 'none';

    if (isViewingGame || isViewingEndgame || isViewingBlunder) {
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (isViewingGame) {
                    prevMove();
                } else if (isViewingEndgame) {
                    prevEndgameMove();
                } else if (isViewingBlunder) {
                    prevBlunderMove();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (isViewingGame) {
                    nextMove();
                } else if (isViewingEndgame) {
                    nextEndgameMove();
                } else if (isViewingBlunder) {
                    nextBlunderMove();
                }
                break;
        }
    }
});


