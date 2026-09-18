/**
 * Chess Game JavaScript - Refactored from inline HTML script
 * Handles all chess game logic, AI integration, and UI interactions
 */

console.log('Chess.js script STARTING execution...');

// Basic script loading check
console.log('Chess.js script loading...');
try {
    console.log('Chess.js script executing successfully');
} catch (error) {
    console.error('Chess.js script failed to execute:', error);
}

// Constants and configuration
const pieces = {
    white: {
        king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟'
    },
    black: {
        king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙'
    }
};

let board = [];
let selectedSquare = null;
let currentPlayer = 'white';
let whiteCaptured = [];
let blackCaptured = [];
let moveHistory = [];
let replayIndex = -1;
let savedGames = JSON.parse(localStorage.getItem('chess-games') || '[]');
let _savingDisabled = false;
let boardFlipped = false;
let currentPieceSet = 4; // SVG pieces as default (SOTA)
let isBoardLocked = false;
let onMoveCallback = null;

// SVG Chess Piece Paths (High-quality Staunton-style from chess.com/wikipedia)
const SVG_PIECES = {
    white: {
        king: 'M 22.5,11.63 V 6 H 25 V 11.63 C 28,12 31,14 31,17 C 31,18 30,19 29,20 H 31 V 26 H 30 V 27 C 30,29 28,30 26,30 V 35 H 27 V 39 H 18 V 35 H 19 V 30 C 17,30 15,29 15,27 V 26 H 14 V 20 H 16 C 15,19 14,18 14,17 C 14,14 17,12 22.5,11.63 Z M 22.5,26 V 23 H 25 V 26 H 22.5 Z',
        queen: 'M 9,26 C 17.5,24.5 30,24.5 39,26 L 38.5,13.5 L 31,25 L 30.7,10.1 L 25.5,24.5 L 22.5,8 L 19.5,24.5 L 14.3,10.1 L 14,25 L 6.5,13.5 Z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 H 33 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27,24.5 17.5,24.5 9,26 Z M 12,33.5 V 36 H 33 V 33.5 Z M 11,36 V 39 H 34 V 36 Z',
        rook: 'M 9,39 H 36 V 36 H 34 V 34.5 C 34,32 32.5,30 30.5,29 V 15 H 31 V 14 L 30,12 H 15 L 14,14 V 15 H 14.5 V 29 C 12.5,30 11,32 11,34.5 V 36 H 9 V 39 Z M 12,33 H 14 V 36 H 12 V 33 Z M 16,33 H 18 V 36 H 16 V 33 Z M 20,33 H 22 V 36 H 20 V 33 Z M 24,33 H 26 V 36 H 24 V 33 Z M 28,33 H 30 V 36 H 28 V 33 Z M 32,33 H 34 V 36 H 32 V 33 Z',
        bishop: 'M 9,36 C 12,31 18,15 22.5,15 C 27,15 33,31 36,36 V 39 H 9 V 36 Z M 20,15 L 22.5,11 L 25,15 Z M 18,34 H 27 V 36 H 18 Z',
        knight: 'M 22,10 C 32.5,11 38.5,18 38,39 H 15 C 15,30 25,32.5 23,18 Z M 9.5,25.5 C 9.5,25.5 15,24.5 15,30.5 C 15,36.5 9.5,38.5 9.5,38.5 Z M 11,12.5 C 11,12.5 15.5,12.5 16.5,15.5 C 16.5,15.5 18.5,12.5 22,11.5 C 22,11.5 19,13.5 19,16.5 C 19,19.5 22,18.5 22,18.5 Z',
        pawn: 'M 22,9 C 19.79,9 18,10.79 18,13 C 18,13.89 18.29,14.71 18.78,15.38 C 16.83,16.5 15.5,18.59 15.5,21 C 15.5,23.03 16.53,24.84 18,26.03 C 18,26.66 18,27.33 18,28 V 35 H 15 V 39 H 30 V 35 H 27 V 28 L 26,26.03 C 27.47,24.84 28.5,23.03 28.5,21 C 28.5,18.59 27.17,16.5 25.22,15.38 C 25.71,14.71 26,13.89 26,13 C 26,10.79 24.21,9 22,9 Z'
    },
    black: {
        king: 'M 22.5,11.63 V 6 H 25 V 11.63 C 28,12 31,14 31,17 C 31,18 30,19 29,20 H 31 V 26 H 30 V 27 C 30,29 28,30 26,30 V 35 H 27 V 39 H 18 V 35 H 19 V 30 C 17,30 15,29 15,27 V 26 H 14 V 20 H 16 C 15,19 14,18 14,17 C 14,14 17,12 22.5,11.63 Z M 22.5,26 V 23 H 25 V 26 H 22.5 Z',
        queen: 'M 9,26 C 17.5,24.5 30,24.5 39,26 L 38.5,13.5 L 31,25 L 30.7,10.1 L 25.5,24.5 L 22.5,8 L 19.5,24.5 L 14.3,10.1 L 14,25 L 6.5,13.5 Z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 H 33 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27,24.5 17.5,24.5 9,26 Z M 12,33.5 V 36 H 33 V 33.5 Z M 11,36 V 39 H 34 V 36 Z',
        rook: 'M 9,39 H 36 V 36 H 34 V 34.5 C 34,32 32.5,30 30.5,29 V 15 H 31 V 14 L 30,12 H 15 L 14,14 V 15 H 14.5 V 29 C 12.5,30 11,32 11,34.5 V 36 H 9 V 39 Z M 12,33 H 14 V 36 H 12 V 33 Z M 16,33 H 18 V 36 H 16 V 33 Z M 20,33 H 22 V 36 H 20 V 33 Z M 24,33 H 26 V 36 H 24 V 33 Z M 28,33 H 30 V 36 H 28 V 33 Z M 32,33 H 34 V 36 H 32 V 33 Z',
        bishop: 'M 9,36 C 12,31 18,15 22.5,15 C 27,15 33,31 36,36 V 39 H 9 V 36 Z M 20,15 L 22.5,11 L 25,15 Z M 18,34 H 27 V 36 H 18 Z',
        knight: 'M 22,10 C 32.5,11 38.5,18 38,39 H 15 C 15,30 25,32.5 23,18 Z M 9.5,25.5 C 9.5,25.5 15,24.5 15,30.5 C 15,36.5 9.5,38.5 9.5,38.5 Z M 11,12.5 C 11,12.5 15.5,12.5 16.5,15.5 C 16.5,15.5 18.5,12.5 22,11.5 C 22,11.5 19,13.5 19,16.5 C 19,19.5 22,18.5 22,18.5 Z',
        pawn: 'M 22,9 C 19.79,9 18,10.79 18,13 C 18,13.89 18.29,14.71 18.78,15.38 C 16.83,16.5 15.5,18.59 15.5,21 C 15.5,23.03 16.53,24.84 18,26.03 C 18,26.66 18,27.33 18,28 V 35 H 15 V 39 H 30 V 35 H 27 V 28 L 26,26.03 C 27.47,24.84 28.5,23.03 28.5,21 C 28.5,18.59 27.17,16.5 25.22,15.38 C 25.71,14.71 26,13.89 26,13 C 26,10.79 24.21,9 22,9 Z'
    }
};

// Multiple piece sets to choose from
const PIECE_SETS = [
    {
        name: "Classic",
        white: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
        black: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' }
    },
    {
        name: "Modern",
        white: { king: '🌟', queen: '✨', rook: '⬜', bishop: '◽', knight: '▫️', pawn: '⚪' },
        black: { king: '⭐', queen: '🌠', rook: '⬛', bishop: '◾', knight: '▪️', pawn: '⚫' }
    },
    {
        name: "Ethnic",
        white: { king: '🤴', queen: '👸', rook: '🏰', bishop: '⛪', knight: '🦄', pawn: '⚪' },
        black: { king: '🤴🏿', queen: '👸🏿', rook: '🏯', bishop: '⛩️', knight: '🐎', pawn: '⚫' }
    },
    {
        name: "Emoji",
        white: { king: '👑', queen: '💎', rook: '🏛️', bishop: '⛪', knight: '🦄', pawn: '🔹' },
        black: { king: '🎩', queen: '💍', rook: '🏰', bishop: '🕌', knight: '🦓', pawn: '🔸' }
    },
    {
        name: "Mathematical",
        white: { king: 'π', queen: '∑', rook: '√', bishop: '∆', knight: '∠', pawn: '∞' },
        black: { king: 'π', queen: '∑', rook: '√', bishop: '∆', knight: '∠', pawn: '∞' }
    },
    {
        name: "SVG",
        type: 'svg',
        white: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
        black: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' }
    }
];

// Create SVG chess piece (using high-quality vector paths)
function createSVGPiece(color, type) {
    try {
        const pathData = SVG_PIECES[color][type];
        if (!pathData) {
            console.warn(`ERROR: No path data for ${color} ${type}`);
            return null;
        }

        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '45');
        svg.setAttribute('height', '45');
        svg.setAttribute('viewBox', '-2 -2 49 49'); // Add 2px padding to prevent clipping
        svg.style.display = 'block';
        svg.style.margin = '0 auto';
        svg.style.filter = 'drop-shadow(2px 2px 2px rgba(0,0,0,0.3))';

        // Create path element
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);

        if (color === 'white') {
            // White pieces: high-contrast Ivory with dark outline
            path.setAttribute('fill', '#ffffff');
            path.setAttribute('stroke', '#000000');
            path.setAttribute('stroke-width', '1');
            path.setAttribute('stroke-linejoin', 'round');
        } else {
            // Black pieces: high-contrast Obsidian with light outline for dark squares
            path.setAttribute('fill', '#000000');
            path.setAttribute('stroke', '#ffffff');
            path.setAttribute('stroke-width', '0.5');
            path.setAttribute('stroke-linejoin', 'round');
        }

        svg.appendChild(path);
        return svg;
    } catch (error) {
        console.error('ERROR: createSVGPiece failed:', error);
        return null;
    }
}

function initBoard() {
    board = [
        [{ type: 'rook', color: 'black', hasMoved: false }, { type: 'knight', color: 'black' }, { type: 'bishop', color: 'black' }, { type: 'queen', color: 'black' }, { type: 'king', color: 'black', hasMoved: false }, { type: 'bishop', color: 'black' }, { type: 'knight', color: 'black' }, { type: 'rook', color: 'black', hasMoved: false }],
        Array(8).fill(null).map(() => ({ type: 'pawn', color: 'black' })),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null).map(() => ({ type: 'pawn', color: 'white' })),
        [{ type: 'rook', color: 'white', hasMoved: false }, { type: 'knight', color: 'white' }, { type: 'bishop', color: 'white' }, { type: 'queen', color: 'white' }, { type: 'king', color: 'white', hasMoved: false }, { type: 'bishop', color: 'white' }, { type: 'knight', color: 'white' }, { type: 'rook', color: 'white', hasMoved: false }]
    ];
}

function renderBoard() {
    console.log('renderBoard: Starting board render');
    const boardElement = document.getElementById('chessBoard');
    if (!boardElement) {
        console.error('renderBoard: chessBoard element not found');
        throw new Error('chessBoard element not found in DOM');
    }
    console.log('renderBoard: Found board element');

    // Initialize board if needed
    if (!board || board.length === 0) {
        console.log('renderBoard: Initializing board');
        initBoard();
    }

    // Clear existing board
    console.log('renderBoard: Clearing board HTML');
    boardElement.innerHTML = '';

    // Create board squares
    console.log('renderBoard: Creating board squares');

    // Dynamic loop order based on board orientation
    const startIdx = boardFlipped ? 7 : 0;
    const endIdx = boardFlipped ? -1 : 8;
    const step = boardFlipped ? -1 : 1;

    for (let row = startIdx; row !== endIdx; row += step) {
        for (let col = startIdx; col !== endIdx; col += step) {
            const square = document.createElement('div');
            // Visual coordinates for pattern calculation
            const visualRow = boardFlipped ? 7 - row : row;
            const visualCol = boardFlipped ? 7 - col : col;

            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;

            // Add piece if present
            const piece = board[row] && board[row][col];
            if (piece) {
                const pieceSet = PIECE_SETS[currentPieceSet];
                if (pieceSet.type === 'svg') {
                    const svg = createSVGPiece(piece.color, piece.type);
                    if (svg) {
                        square.appendChild(svg);
                    } else {
                        square.textContent = pieces[piece.color][piece.type];
                    }
                } else if (pieceSet && pieceSet[piece.color] && pieceSet[piece.color][piece.type]) {
                    square.textContent = pieceSet[piece.color][piece.type];
                } else {
                    // Fallback to basic pieces
                    square.textContent = pieces[piece.color][piece.type];
                }
            }

            square.addEventListener('click', () => handleSquareClick(row, col));
            boardElement.appendChild(square);
        }
    }

    console.log('renderBoard: Board squares created, updating status');
    // Update game status and captured pieces
    updateStatus();
    updateCapturedPieces();
    console.log('renderBoard: Board render complete');
}

function flipBoard() {
    boardFlipped = !boardFlipped;
    renderBoard();
    console.log('Board flipped:', boardFlipped ? 'Black perspective' : 'White perspective');
}

function handleSquareClick(row, col) {
    if (isBoardLocked) return;
    if (selectedSquare) {
        const [selectedRow, selectedCol] = selectedSquare;
        if (isValidMove(selectedRow, selectedCol, row, col)) {
            makeMove(selectedRow, selectedCol, row, col);
        }
        clearSelection();
    } else {
        const piece = board[row][col];
        if (piece && piece.color === currentPlayer) {
            selectedSquare = [row, col];
            highlightValidMoves(row, col);
        }
    }
}

function highlightValidMoves(row, col) {
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        const r = parseInt(square.dataset.row);
        const c = parseInt(square.dataset.col);
        if (r === row && c === col) {
            square.classList.add('selected');
        } else if (isValidMove(row, col, r, c)) {
            square.classList.add('valid-move');
        }
    });
}

function clearSelection() {
    selectedSquare = null;
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('selected', 'valid-move');
    });
}

function isValidMove(fromRow, fromCol, toRow, toCol) {
    if (fromRow === toRow && fromCol === toCol) return false;

    const piece = board[fromRow][fromCol];
    const target = board[toRow][toCol];

    if (!piece) return false;
    if (target && target.color === piece.color) return false;

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
        case 'pawn':
            const direction = piece.color === 'white' ? -1 : 1;
            const startRow = piece.color === 'white' ? 6 : 1;

            if (colDiff === 0 && !target) {
                if (rowDiff === direction) return true;
                if (fromRow === startRow && rowDiff === 2 * direction && !board[fromRow + direction][fromCol]) return true;
            }
            if (absColDiff === 1 && rowDiff === direction && target) return true;
            return false;

        case 'rook':
            if (rowDiff === 0 || colDiff === 0) {
                return !isPathBlocked(fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'knight':
            return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);

        case 'bishop':
            if (absRowDiff === absColDiff) {
                return !isPathBlocked(fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'queen':
            if (rowDiff === 0 || colDiff === 0 || absRowDiff === absColDiff) {
                return !isPathBlocked(fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'king':
            // Standard move
            if (absRowDiff <= 1 && absColDiff <= 1) return true;

            // Castling
            if (absRowDiff === 0 && absColDiff === 2 && !piece.hasMoved) {
                const rookCol = toCol > fromCol ? 7 : 0;
                const rook = board[fromRow][rookCol];
                if (rook && rook.type === 'rook' && rook.color === piece.color && !rook.hasMoved) {
                    if (!isPathBlocked(fromRow, fromCol, fromRow, rookCol)) {
                        return true;
                    }
                }
            }
            return false;
    }

    return false;
}

function isPathBlocked(fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;

    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;

    while (currentRow !== toRow || currentCol !== toCol) {
        if (board[currentRow][currentCol]) return true;
        currentRow += rowStep;
        currentCol += colStep;
    }

    return false;
}

function makeMove(fromRow, fromCol, toRow, toCol) {
    console.log('Original makeMove called with:', fromRow, fromCol, 'to', toRow, toCol);
    console.log('Board exists:', !!board, 'board length:', board ? board.length : 'N/A');
    console.log('Board piece at source:', board[fromRow] ? board[fromRow][fromCol] : 'invalid row');

    const piece = board[fromRow][fromCol];
    const captured = board[toRow][toCol];

    console.log('Piece to move:', piece, 'Captured:', captured);

    if (!piece) {
        console.log('ERROR: No piece to move!');
        return;
    }

    const wasFirstMove = !piece.hasMoved;
    const isCastling = piece.type === 'king' && Math.abs(toCol - fromCol) === 2;

    moveHistory.push({
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        piece: piece,
        captured: captured,
        wasFirstMove: wasFirstMove,
        isCastling: isCastling
    });
    if (!_savingDisabled) _saveChessGame();

    if (captured) {
        if (currentPlayer === 'white') {
            whiteCaptured.push(captured);
        } else {
            blackCaptured.push(captured);
        }
        // Play capture sound
        if (window.gameSound) {
            window.gameSound.playSound('chess_capture', { gameType: 'chess' });
        }
    } else {
        // Play move sound
        if (window.gameSound) {
            window.gameSound.playSound('chess_move', { gameType: 'chess' });
        }
    }

    console.log('Updating board array...');

    // Castling detection and execution
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
        const isKingside = toCol > fromCol;
        const rookFromCol = isKingside ? 7 : 0;
        const rookToCol = isKingside ? 5 : 3;
        const rook = board[fromRow][rookFromCol];

        // Move rook
        board[fromRow][rookToCol] = rook;
        board[fromRow][rookFromCol] = null;
        if (rook) rook.hasMoved = true;
    }

    // Update piece move state
    if (piece.type === 'king' || piece.type === 'rook') {
        piece.hasMoved = true;
    }

    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;
    console.log('Board updated. New piece at destination:', board[toRow][toCol]);

    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    console.log('Turn switched to:', currentPlayer);

    // Multiplayer Hook: Notify listeners
    if (onMoveCallback) {
        onMoveCallback({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            fen: boardToFEN(),
            turn: currentPlayer
        });
    }

    // Update timer
    if (typeof window.switchTimer === 'function') {
        window.switchTimer(currentPlayer);
    }

    console.log('Calling renderBoard...');
    renderBoard();
    console.log('renderBoard completed');
}

function undoMove() {
    if (moveHistory.length === 0) return;

    const lastMove = moveHistory.pop();
    const piece = lastMove.piece;

    // Restore piece position
    board[lastMove.from.row][lastMove.from.col] = piece;
    board[lastMove.to.row][lastMove.to.col] = lastMove.captured;

    // Restore move state
    if (lastMove.wasFirstMove) {
        piece.hasMoved = false;
    }

    // Restore Rook if it was castling
    if (lastMove.isCastling) {
        const isKingside = lastMove.to.col > lastMove.from.col;
        const rookFromCol = isKingside ? 7 : 0;
        const rookToCol = isKingside ? 5 : 3;
        const rook = board[lastMove.from.row][rookToCol];

        board[lastMove.from.row][rookFromCol] = rook;
        board[lastMove.from.row][rookToCol] = null;
        if (rook) rook.hasMoved = false;
    }

    if (lastMove.captured) {
        if (currentPlayer === 'black') {
            whiteCaptured.pop();
        } else {
            blackCaptured.pop();
        }
    }

    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    renderBoard();
    updateStatus();

    // Play sound from global sound system
    if (window.gameSound) {
        window.gameSound.playSound('chess_move', { gameType: 'chess' });
    }
    _analyzeCurrentPosition();
}

// === Save / Load / Replay / Analyze ===
function _saveChessGame() {
    try {
        const moves = moveHistory.map(m => ({from: m.from, to: m.to}));
        localStorage.setItem('chess-last-game', JSON.stringify({moves, ts: Date.now()}));
    } catch (_) {}
}

function _generateFEN() {
    // Build FEN from the current board state
    const files = 'abcdefgh';
    let fen = '';
    for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) { empty++; continue; }
            if (empty > 0) { fen += empty; empty = 0; }
            const symbol = p.type[0].toUpperCase();
            fen += p.color === 'white' ? symbol : symbol.toLowerCase();
        }
        if (empty > 0) fen += empty;
        if (r < 7) fen += '/';
    }
    fen += ' ' + (currentPlayer === 'white' ? 'w' : 'b') + ' KQkq - 0 ' + Math.floor(moveHistory.length / 2 + 1);
    return fen;
}

function _analyzeCurrentPosition() {
    if (moveHistory.length === 0) return;
    if (!window.apiConfig || !window.apiConfig.stockfishUrl) return;
    const fen = _generateFEN();
    const lastMove = moveHistory[moveHistory.length - 1];
    // Mark the last move as "analyze pending"
    lastMove._analysis = 'pending';
    fetch(window.apiConfig.stockfishUrl + '/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen, depth: 12, movetime: 2000 }),
        signal: AbortSignal.timeout(5000),
    }).then(r => r.json()).then(data => {
        if (data.success && data.move) {
            lastMove._analysis = data.move;
            lastMove._analysisEval = data.eval || null;
        }
    }).catch(() => { lastMove._analysis = null; });
}

function _loadChessGame() {
    try {
        const raw = localStorage.getItem('chess-last-game');
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data.moves || !data.moves.length) return false;
        _savingDisabled = true;
        safeCallNewGame();
        for (const m of data.moves) {
            makeMove(m.from.row, m.from.col, m.to.row, m.to.col);
        }
        _savingDisabled = false;
        document.getElementById('resumeBtn').style.display = 'inline-block';
        return true;
    } catch (_) { return false; }
}

function resumeGame() {
    document.getElementById('resumeBtn').style.display = 'none';
    _loadChessGame();
}

function updateStatus() {
    const status = document.getElementById('status');
    status.textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn`;
}

function updateCapturedPieces() {
    const pieceSet = PIECE_SETS[currentPieceSet];
    const whiteEl = document.getElementById('whiteCaptured');
    const blackEl = document.getElementById('blackCaptured');

    whiteEl.innerHTML = '';
    blackEl.innerHTML = '';

    if (pieceSet.type === 'svg') {
        const createCapturedSvg = (p) => {
            const svg = createSVGPiece(p.color, p.type);
            if (!svg) return null;
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.setAttribute('viewBox', '-2 -2 49 49');
            svg.style.display = 'inline-block';
            svg.style.margin = '0 1px';
            svg.style.verticalAlign = 'middle';
            svg.style.filter = 'none'; // No shadow for small icons
            return svg;
        };

        whiteCaptured.forEach(p => {
            const svg = createCapturedSvg(p);
            if (svg) whiteEl.appendChild(svg);
        });
        blackCaptured.forEach(p => {
            const svg = createCapturedSvg(p);
            if (svg) blackEl.appendChild(svg);
        });
    } else {
        whiteEl.textContent = whiteCaptured.map(p => pieceSet[p.color][p.type]).join(' ');
        blackEl.textContent = blackCaptured.map(p => pieceSet[p.color][p.type]).join(' ');
    }
}

function cyclePieceSet() {
    currentPieceSet = (currentPieceSet + 1) % PIECE_SETS.length;
    const setName = PIECE_SETS[currentPieceSet].name;
    document.getElementById('pieceSetBtn').textContent = `Pieces: ${setName}`;
    renderBoard();
    updateCapturedPieces();
}

function toggleSound() {
    if (window.gameSound) {
        const isEnabled = window.gameSound.isEnabled;
        if (isEnabled) {
            window.gameSound.disable();
            document.getElementById('soundToggle').textContent = '🔇 Sound: Off';
        } else {
            window.gameSound.enable();
            document.getElementById('soundToggle').textContent = '🔊 Sound: On';
        }
    } else {
        // Show permanent warning in status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML += '<br><span style="color: #FFA500;">WARNING: Sound system not available. Make sure the sound service is running.</span>';
        }
    }
}

function newGame() {
    try {
        console.log('Starting new chess game...');

        // Initialize board state
        initBoard();

        // Reset game state
        currentPlayer = 'white';
        whiteCaptured = [];
        blackCaptured = [];
        moveHistory = [];
        selectedSquare = null;

        // Clear AI state
        aiThinkingNow = false;

        // Reset status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'White to move';
        }

        // Clear AI move highlights
        clearAIMoveHighlight();

        // Start timer for white if enabled
        if (typeof window.startTimer === 'function') {
            try {
                window.startTimer('white');
            } catch (timerError) {
                console.warn('WARNING: Timer start failed:', timerError);
            }
        }

        // Render the board
        renderBoard();

        // Update piece set button text
        const setName = PIECE_SETS[currentPieceSet].name;
        const pieceSetBtn = document.getElementById('pieceSetBtn');
        if (pieceSetBtn) {
            pieceSetBtn.textContent = `Pieces: ${setName}`;
        }

        console.log('OK: New game started successfully');

    } catch (error) {
        console.error('ERROR: Failed to start new game:', error);

        // Show error to user
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML = `
                <div style="color: #FFD700; padding: 10px; border: 1px solid #FFD700; border-radius: 5px; background: rgba(255, 215, 0, 0.1);">
                    <strong>⚠️ New Game Failed</strong><br>
                    ${error.message}<br>
                    <small>Trying to recover...</small>
                </div>
            `;
        }

        // Try recovery
        try {
            initBoard();
            renderBoard();
        } catch (recoveryError) {
            console.error('ERROR: Recovery failed:', recoveryError);
        }
    }
}

// Make newGame globally accessible for timer integration
window.newGame = newGame;

// AI Integration with Stockfish
let aiEnabled = false;
let aiVsAiMode = false;
let aiVsAiPaused = true;
let aiLevel = 10;
let whiteAILevel = 10;
let blackAILevel = 10;
let moveDelay = 1000; // Delay between AI moves in AI vs AI mode
let aiThinkingNow = false;
// REMOVED: AI fallback modes - only real Stockfish integration

async function initializeAI() {
    try {
        console.log('Initializing AI system...');

        // Show AI loading status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = '🔄 Connecting to AI...';
        }

        // Check API config first
        if (!window.apiConfig) {
            throw new Error('API configuration not loaded');
        }

        const apiConfig = window.apiConfig;
        console.log('API Config:', {
            stockfishUrl: apiConfig.stockfishUrl,
            isLocal: apiConfig.isLocal,
            aiHost: apiConfig.aiServerHost
        });

        // Try to connect to Stockfish backend
        try {
            console.log('Connecting to Stockfish backend:', apiConfig.stockfishUrl);

            // Remote access: Works for iPad/iPhone/Bangalore players
            // Uses apiConfig to automatically include API key if configured
            const response = await apiConfig.optimizedFetch(`${apiConfig.stockfishUrl}/api/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(20000) // 20 second timeout (Docker cold start)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const status = await response.json();
            console.log('OK: AI Status:', status);
            console.log('Checking status.ready:', status.ready, 'status.engine:', status.engine);

            if (status.ready && status.engine) {
                console.log('OK: ELO:', status.elo);

                // Show success message
                if (statusEl) {
                    statusEl.textContent = `AI Connected: ${status.engine} (ELO: ${status.elo})`;
                }

                console.log(`SUCCESS: Connected to ${status.engine} - ELO: ${status.elo}`);
                return;

            } else {
                throw new Error('Backend reports not ready: ' + JSON.stringify(status));
            }

        } catch (networkError) {
            console.error('ERROR: Failed to connect to Stockfish backend:', networkError);
            console.error('DEBUG: Debug info:', {
                error: networkError.message,
                stockfishUrl: apiConfig.stockfishUrl,
                aiHost: apiConfig.aiServerHost,
                isLocal: apiConfig.isLocal,
                userAgent: navigator.userAgent
            });

            // REMOVED: No client-side AI fallback - only real Stockfish integration

            // Show error when Stockfish connection fails
            let errorMessage = 'Stockfish AI Connection Failed\n\n';
            const useProxy = apiConfig._useProxy ? apiConfig._useProxy() : false;

            if (useProxy) {
                errorMessage += 'Docker mode: Check stockfish-engine container.\n';
                errorMessage += '1. Run: docker compose ps\n';
                errorMessage += '2. Both games-collection-web and stockfish-engine must be healthy\n';
                errorMessage += '3. If timeout: try direct http://' + apiConfig.currentHost + ':11211/api/status\n\n';
                errorMessage += 'Debug: ' + networkError.message;
            } else if (apiConfig.isLocal) {
                errorMessage += 'Local Setup Required:\n';
                errorMessage += '1. Open terminal in ai-games-collection directory\n';
                errorMessage += '2. Run: uv run python engines/stockfish-server.py\n';
                errorMessage += '3. Refresh this page\n\n';
                errorMessage += 'Debug: ' + networkError.message;
            } else {
                errorMessage += 'Remote AI Issues:\n';
                errorMessage += '• Server may be down\n';
                errorMessage += '• Network connection blocked\n';
                errorMessage += '• CORS policy issues\n\n';
                errorMessage += 'Debug: ' + networkError.message + '\n';
                errorMessage += 'Try: connectivity-test.html';
            }

            // Show error to user
            if (statusEl) {
                statusEl.innerHTML = `
                    <div style="color: #FF6B6B; padding: 10px; border: 1px solid #FF6B6B; border-radius: 5px; background: rgba(255, 107, 107, 0.1);">
                        <strong>AI Connection Failed</strong><br>
                        <small>${errorMessage.replace(/\n/g, '<br>')}</small>
                    </div>
                `;
            }

            // Error already shown in status area above
        }

    } catch (error) {
        console.error('AI initialization failed:', error);

        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML = `
                <div style="color: #FFD700; padding: 10px; border: 1px solid #FFD700; border-radius: 5px; background: rgba(255, 215, 0, 0.1);">
                    <strong>AI Initialization Error</strong><br>
                    ${error.message}<br>
                    <small>Game will work in Human vs Human mode</small>
                </div>
            `;
        }
    }
}

function toggleAI() {
    // If AI vs AI is active, disable it first
    if (aiVsAiMode) {
        toggleAIVsAI();
    }

    aiEnabled = !aiEnabled;
    const btn = document.getElementById('aiToggle');
    const controls = document.getElementById('aiControls');

    if (aiEnabled) {
        btn.textContent = 'AI: Play vs AI';
        btn.style.background = 'rgba(76, 175, 80, 0.3)';
        controls.style.display = 'block';
        // Initialize AI and handle success/failure
        initializeAI().then(() => {
            console.log('AI initialized successfully');
        }).catch((error) => {
            console.error('AI initialization failed:', error);
            // Revert button state on failure
            aiEnabled = false;
            btn.textContent = '👤 Play vs Human';
            btn.style.background = '';
            controls.style.display = 'none';
            // Show permanent error in status
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.innerHTML += '<br><span style="color: #FF0000;">ERROR: AI initialization failed. Check console for details.</span>';
            }
        });
    } else {
        btn.textContent = '👤 Play vs Human';
        btn.style.background = '';
        controls.style.display = 'none';
    }
}

function toggleAIVsAI() {
    // If regular AI is active, disable it first
    if (aiEnabled) {
        toggleAI();
    }

    aiVsAiMode = !aiVsAiMode;
    const btn = document.getElementById('aiVsAiToggle');
    const controls = document.getElementById('aiVsAiControls');
    const statusEl = document.getElementById('aiVsAiStatus');

    if (aiVsAiMode) {
        btn.textContent = '👤 Human vs Human';
        btn.style.background = 'rgba(255, 152, 0, 0.3)';
        controls.style.display = 'block';
        aiVsAiPaused = false;
        statusEl.textContent = '▶️ Running - AI vs AI in progress';
        initializeAI().then(() => {
            console.log('AI initialized for AI vs AI mode');
            // Start the AI vs AI game
            if (currentPlayer === 'white') {
                setTimeout(() => getAIMoveForPlayer('white'), 500);
            } else {
                setTimeout(() => getAIMoveForPlayer('black'), 500);
            }
        }).catch((error) => {
            console.error('AI initialization failed for AI vs AI:', error);
            // Revert on failure
            aiVsAiMode = false;
            btn.textContent = 'AI:AI: AI vs AI';
            btn.style.background = '';
            controls.style.display = 'none';
            aiVsAiPaused = true;
            statusEl.textContent = 'ERROR: AI initialization failed';
            // Show permanent error in status
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.innerHTML += '<br><span style="color: #FF0000;">ERROR: AI initialization failed for AI vs AI mode. Check console for details.</span>';
            }
        });
    } else {
        btn.textContent = 'AI:AI: AI vs AI';
        btn.style.background = '';
        controls.style.display = 'none';
        aiVsAiPaused = true;
    }
}

function setWhiteAIDifficulty() {
    whiteAILevel = parseInt(document.getElementById('whiteAILevel').value);
    console.log('White AI difficulty set to', whiteAILevel);
}

function setBlackAIDifficulty() {
    blackAILevel = parseInt(document.getElementById('blackAILevel').value);
    console.log('Black AI difficulty set to', blackAILevel);
}

function setMoveDelay() {
    moveDelay = parseInt(document.getElementById('moveDelay').value);
    console.log('Move delay set to', moveDelay, 'ms');
}

// REMOVED: Client-side AI - only real Stockfish integration

// Simple API connectivity test
window.testAPIConnection = async function () {
    console.log('LINK: Testing basic API connection...');
    try {
        const response = await fetch('/api/test');
        const data = await response.json();
        console.log('OK: API test successful:', data);
        // Show permanent success in status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML += '<br><span style="color: #00AA00;">OK: API works! Response: ' + JSON.stringify(data) + '</span>';
        }
    } catch (error) {
        console.error('ERROR: API test failed:', error);
        // Show permanent error in status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML += '<br><span style="color: #FF0000;">ERROR: API failed: ' + error.message + '</span>';
        }
    }
};

// Debug function for testing AI connectivity
window.testAIConnection = async function () {
    console.log('TEST: Testing AI Connection...');
    console.log('API Config:', {
        currentHost: apiConfig.currentHost,
        currentPort: apiConfig.currentPort,
        protocol: apiConfig.protocol,
        isLocal: apiConfig.isLocal,
        aiServerHost: apiConfig.aiServerHost,
        stockfishUrl: apiConfig.stockfishUrl
    });

    try {
        // Remote access check for competitive play
        // Uses apiConfig to automatically include API key if configured
        const response = await apiConfig.optimizedFetch(`${apiConfig.stockfishUrl}/api/status`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const status = await response.json();
            console.log('OK: AI Status:', status);
            // Show permanent success in status
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.innerHTML += '<br><span style="color: #00AA00;">OK: AI Connected!<br>' + JSON.stringify(status, null, 2).replace(/\n/g, '<br>') + '</span>';
            }
        } else {
            console.error('ERROR: AI Status failed:', response.status, response.statusText);
            // Show permanent error in status
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.innerHTML += '<br><span style="color: #FF0000;">ERROR: AI Status failed: ' + response.status + ' ' + response.statusText + '</span>';
            }
        }
    } catch (error) {
        console.error('ERROR: AI Connection error:', error);
        // Show permanent error in status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML += '<br><span style="color: #FF0000;">ERROR: AI Connection failed: ' + error.message + '<br>Check console for details.</span>';
        }
    }
};

// REMOVED: AI fallback mode - only real Stockfish integration

function setAIDifficulty() {
    aiLevel = parseInt(document.getElementById('aiLevel').value);
    console.log('AI difficulty set to', aiLevel);
}

// REMOVED: Random AI - only real Stockfish integration


function squareToAlgebraic(square) {
    const files = 'abcdefgh';
    return files[square.col] + (8 - square.row);
}

// Override makeMove to trigger AI
const originalMakeMove = makeMove;
makeMove = function (fromRow, fromCol, toRow, toCol) {
    console.log('AI: makeMove override called!');
    originalMakeMove(fromRow, fromCol, toRow, toCol);

    // If AI vs AI mode, trigger next AI move (requires Stockfish server)
    if (aiVsAiMode && !aiVsAiPaused) {
        setTimeout(() => {
            getAIMoveForPlayer(currentPlayer);
        }, moveDelay);
    }
    // If regular AI enabled and it's black's turn, get AI move (requires Stockfish server)
    else if (aiEnabled && currentPlayer === 'black') {
        console.log('AI: AI trigger: aiEnabled=', aiEnabled, 'currentPlayer=', currentPlayer);
        setTimeout(() => {
            console.log('AI: Calling getAIMoveForPlayer for black');
            getAIMoveForPlayer('black', aiLevel);
        }, moveDelay);
    } else {
        console.log('ERROR: AI not triggered: aiEnabled=', aiEnabled, 'currentPlayer=', currentPlayer);
    }
};

async function getAIMove() {
    // Use black AI level for regular AI mode
    return getAIMoveForPlayer('black', aiLevel);
}

async function getAIMoveForPlayer(player, customLevel = null) {
    console.log('TARGET: getAIMoveForPlayer called for', player);
    if (aiThinkingNow) {
        console.log('AI already thinking, skipping...');
        return;
    }

    // Always try server - no JavaScript fallbacks

    // Check if game is over
    // Simple game over check - if status indicates game over, stop AI
    const gameStatusEl = document.getElementById('status');
    if (gameStatusEl && (gameStatusEl.textContent.includes('Checkmate') ||
        gameStatusEl.textContent.includes('Stalemate') ||
        gameStatusEl.textContent.includes('Game Over'))) {
        console.log('Game over detected, stopping AI moves');
        if (aiVsAiMode) {
            const aiStatusEl = document.getElementById('aiVsAiStatus');
            if (aiStatusEl) {
                aiStatusEl.textContent = '🏁 Game Over';
            }
        }
        return;
    }

    aiThinkingNow = true;
    const thinking = document.getElementById('aiThinking');
    const statusEl = document.getElementById('aiVsAiStatus');

    if (aiVsAiMode) {
        statusEl.textContent = `🤔 ${player.toUpperCase()} AI thinking...`;
    } else {
        thinking.style.display = 'inline';
        thinking.style.fontSize = '16px';
        thinking.style.fontWeight = 'bold';
        thinking.style.color = '#FFD700';
        thinking.textContent = '🤔 AI is calculating move... Please wait 2-3 seconds!';

        // Also show in status
        const statusEl = document.getElementById('status');
        statusEl.textContent = '🤔 AI is thinking...';
    }

    try {
        // Generate FEN from current board
        const fen = boardToFEN();
        // Force FEN side-to-move to match requested player
        const fenParts = fen.split(' ');
        const correctedFen = fenParts[0] + ' ' + (player === 'white' ? 'w' : 'b') + ' ' + fenParts.slice(2).join(' ');
        console.log(`AI: Requesting move from REAL Stockfish for ${player}...`);
        console.log('Position FEN:', correctedFen);

        // Configure based on difficulty
        let skillLevel;
        if (customLevel !== null) {
            skillLevel = customLevel;
        } else {
            skillLevel = player === 'white' ? whiteAILevel : blackAILevel;
        }
        const depth = Math.min(20, Math.floor(skillLevel / 2) + 5); // 5-20 depth
        const moveTime = 100 + (skillLevel * 100); // 200ms - 2100ms

        console.log(`Settings: Player=${player}, Skill=${skillLevel}, Depth=${depth}, Time=${moveTime}ms`);

        // Only use server-side Stockfish - no JavaScript fallbacks
        console.log('Using server-side Stockfish...');
        // Remote access: Works for iPad/iPhone/Bangalore players via api-config.js
        // Uses apiConfig.optimizedFetch to automatically include API key if configured
        const response = await apiConfig.optimizedFetch(`${apiConfig.stockfishUrl}/api/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fen: fen,
                skill: skillLevel,
                depth: depth,
                movetime: moveTime
            })
        }, false); // Don't cache POST requests

        const result = await response.json();

        if (result.success && result.move) {
            move = result.move;
            console.log(`OK: Stockfish says for ${player}:`, move);
            console.log('Engine:', result.engine);
        } else {
            throw new Error(result.error || 'No move returned');
        }

        if (move) {
            executeStockfishMove(move, player);
        } else {
            throw new Error('No move generated');
        }

    } catch (error) {
        console.error('ERROR: AI error:', error);

        // Show error if Stockfish AI failed
        if (!aiVsAiMode) {
            let errorMessage = 'Stockfish AI Connection Failed\n\nError: ' + error.message + '\n\n';
            if (apiConfig.isLocal) {
                errorMessage += 'Make sure backend is running:\nuv run python engines/stockfish-server.py';
            } else {
                errorMessage += 'Check remote connectivity or try refreshing the page.';
            }
            // Show permanent error in status
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.innerHTML += '<br><span style="color: #FF0000;">' + errorMessage.replace(/\n/g, '<br>') + '</span>';
            }
        }
        aiThinkingNow = false;
        thinking.style.display = 'none';
        if (aiVsAiMode) {
            statusEl.textContent = 'ERROR: Stockfish AI failed';
        }
    }
}

function boardToFEN() {
    let fen = '';

    // Board position
    for (let row = 0; row < 8; row++) {
        let emptyCount = 0;
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                const pieceChar = getPieceFEN(piece);
                fen += pieceChar;
            }
        }
        if (emptyCount > 0) fen += emptyCount;
        if (row < 7) fen += '/';
    }

    // Active color
    fen += ' ' + (currentPlayer === 'white' ? 'w' : 'b');

    // Castling rights (simplified - assume all available at start)
    fen += ' KQkq';

    // En passant target square (simplified)
    fen += ' -';

    // Halfmove clock (simplified)
    fen += ' 0';

    // Fullmove number
    fen += ' ' + Math.floor(moveHistory.length / 2 + 1);

    return fen;
}

/**
 * Load board state from a FEN string
 * Simplified: Only handles piece placement and active color
 */
function loadFEN(fen) {
    console.log('loadFEN: Loading from', fen);
    const parts = fen.split(' ');
    const placement = parts[0];
    const turn = parts[1];

    const rows = placement.split('/');
    const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));

    const charToPiece = {
        'p': 'pawn', 'n': 'knight', 'b': 'bishop',
        'r': 'rook', 'q': 'queen', 'k': 'king'
    };

    for (let row = 0; row < 8; row++) {
        let col = 0;
        for (const char of rows[row]) {
            if (!isNaN(char)) {
                col += parseInt(char);
            } else {
                const color = char === char.toUpperCase() ? 'white' : 'black';
                const type = charToPiece[char.toLowerCase()];
                newBoard[row][col] = { type, color };
                col++;
            }
        }
    }

    board = newBoard;
    currentPlayer = turn === 'w' ? 'white' : 'black';

    renderBoard();
}

function getPieceFEN(piece) {
    const pieceMap = {
        'pawn': 'p', 'knight': 'n', 'bishop': 'b',
        'rook': 'r', 'queen': 'q', 'king': 'k'
    };
    const char = pieceMap[piece.type];
    return piece.color === 'white' ? char.toUpperCase() : char;
}

function highlightAIMove(fromRow, fromCol, toRow, toCol) {
    // Clear any existing AI move highlights
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('ai-move-from', 'ai-move-to');
    });

    // Find and highlight the squares
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);

        // Account for board flipping
        const displayRow = boardFlipped ? 7 - row : row;
        const displayCol = boardFlipped ? 7 - col : col;

        if (row === fromRow && col === fromCol) {
            square.classList.add('ai-move-from');
        } else if (row === toRow && col === toCol) {
            square.classList.add('ai-move-to');
        }
    });
}

function clearAIMoveHighlight() {
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('ai-move-from', 'ai-move-to');
    });
}

function executeStockfishMove(uciMove, player = null) {
    console.log(`TARGET: executeStockfishMove called with: ${uciMove}, player: ${player}`);

    // Parse UCI move (e.g., "e2e4", "e7e8q")
    if (uciMove.length < 4) {
        console.log('ERROR: UCI move too short:', uciMove);
        aiThinkingNow = false;
        document.getElementById('aiThinking').style.display = 'none';
        const statusEl = document.getElementById('aiVsAiStatus');
        if (aiVsAiMode && statusEl) {
            statusEl.textContent = 'ERROR: Invalid move';
        }
        return;
    }

    const fromCol = uciMove.charCodeAt(0) - 97; // a=0, b=1, etc.
    const fromRow = 8 - parseInt(uciMove[1]);
    const toCol = uciMove.charCodeAt(2) - 97;
    const toRow = 8 - parseInt(uciMove[3]);

    console.log(`Stockfish move: ${uciMove} => (${fromRow},${fromCol}) to (${toRow},${toCol})`);
    console.log(`Board state before: board[${fromRow}][${fromCol}] = "${board[fromRow] ? board[fromRow][fromCol] : 'undefined'}"`);

    // Highlight the AI move before executing
    highlightAIMove(fromRow, fromCol, toRow, toCol);

    // Temporarily disable AI trigger to prevent infinite loop
    const wasAIEnabled = aiEnabled;
    const wasAiVsAiMode = aiVsAiMode;
    aiEnabled = false;
    aiVsAiMode = false;

    // Execute the move (bypass validation for AI moves since they come from server)
    console.log('🔄 About to execute move directly');
    try {
        originalMakeMove(fromRow, fromCol, toRow, toCol);
        console.log('OK: Stockfish move executed successfully');

        // Keep highlight for a moment after move
        setTimeout(() => {
            clearAIMoveHighlight();
        }, 300);

        // Play move sound
        playMoveSound();

        // If AI vs AI mode, trigger next player's move after delay
        if (wasAiVsAiMode && !aiVsAiPaused) {
            const statusEl = document.getElementById('aiVsAiStatus');
            if (statusEl) {
                statusEl.textContent = `▶️ ${currentPlayer.toUpperCase()}'s turn next...`;
            }
            // The makeMove override will handle triggering the next AI move
        }

        // Show move confirmation briefly
        const statusEl = document.getElementById('status');
        const originalStatus = statusEl.textContent;
        statusEl.textContent = `OK: AI moved! ${currentPlayer === 'white' ? 'Your' : 'Black\'s'} turn`;

        setTimeout(() => {
            statusEl.textContent = originalStatus;
        }, 2000);

        // Re-enable AI and reset flags
        aiEnabled = wasAIEnabled;
        aiVsAiMode = wasAiVsAiMode;
        aiThinkingNow = false;
        document.getElementById('aiThinking').style.display = 'none';
    } catch (error) {
        console.error('ERROR: Error executing Stockfish move:', error);
        clearAIMoveHighlight();
        const statusEl = document.getElementById('aiVsAiStatus');
        if (wasAiVsAiMode && statusEl) {
            statusEl.textContent = 'ERROR: Invalid move - Game may be over';
        }
        // Re-enable AI and reset flags
        aiEnabled = wasAIEnabled;
        aiVsAiMode = wasAiVsAiMode;
        aiThinkingNow = false;
        document.getElementById('aiThinking').style.display = 'none';
    }
    console.error('Invalid Stockfish move:', uciMove);
    clearAIMoveHighlight();
    const statusEl = document.getElementById('aiVsAiStatus');
    if (wasAiVsAiMode && statusEl) {
        statusEl.textContent = 'ERROR: Invalid move - Game may be over';
    }
    // Re-enable AI and reset flags
    aiEnabled = wasAIEnabled;
    aiVsAiMode = wasAiVsAiMode;
    aiThinkingNow = false;
    document.getElementById('aiThinking').style.display = 'none';
}

function playMoveSound() {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure sound (pleasant "click" tone)
    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

// ===== CHEAT FUNCTIONS =====

// Show position evaluation and AI suggestion
async function cheatShowEval() {
    // Show loading in status
    const statusEl = document.getElementById('status');
    const originalStatus = statusEl.textContent;
    statusEl.textContent = '📊 AI is analyzing position...';

    // Get current FEN
    const fen = boardToFEN();

    try {
        // Simple heuristic evaluation for material
        let materialEval = evaluatePosition();
        let materialText = materialEval > 0 ? `White +${materialEval}` :
            materialEval < 0 ? `Black +${Math.abs(materialEval)}` : "Equal";

        // Query Stockfish for best move
        const response = await apiConfig.optimizedFetch(`${apiConfig.stockfishUrl}/api/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fen: fen,
                skill: 20,
                depth: 15,
                movetime: 1000
            })
        }, false);

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.move) {
                statusEl.innerHTML = `📊 Material: ${materialText} | <span style="color: #00ff00; font-weight: bold;">AI Recommends: ${data.move}</span>`;
            } else {
                statusEl.textContent = `📊 Material: ${materialText}`;
            }
        } else {
            statusEl.textContent = `📊 Material: ${materialText} (AI server unavailable)`;
        }
    } catch (error) {
        console.error('Cheat Show Eval failed:', error);
        statusEl.textContent = '📊 Evaluation failed (Check AI server)';
    }

    // Reset status after 5 seconds
    setTimeout(() => {
        updateStatus();
    }, 5000);
}

// Simple position evaluation
function evaluatePosition() {
    let score = 0;

    // Material count
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                let value = 0;
                switch (piece.type) {
                    case 'pawn': value = 1; break;
                    case 'knight': case 'bishop': value = 3; break;
                    case 'rook': value = 5; break;
                    case 'queen': value = 9; break;
                    case 'king': value = 0; break; // King has no material value
                }

                if (piece.color === 'white') {
                    score += value;
                } else {
                    score -= value;
                }
            }
        }
    }

    // Positional factors (simplified)
    // Center control, piece development, etc. would go here

    return score;
}

// Initialize game with error handling
function safeInitializeGame() {
    console.log('safeInitializeGame: Starting initialization');

    // Simple direct initialization for testing
    console.log('safeInitializeGame: Calling initializeChessGame directly');
    initializeChessGame();
}

function initializeChessGame() {
    try {
        console.log('initializeChessGame: Starting actual initialization');

        // Check if chessBoard element exists
        const boardElement = document.getElementById('chessBoard');
        if (!boardElement) {
            throw new Error('chessBoard element not found');
        }
        console.log('initializeChessGame: Found chessBoard element');

        // Simple test: just clear the loading message and add a success message
        boardElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 400px; font-size: 24px; color: #4CAF50;">♟️ Chess Board Loaded Successfully!</div>';

        console.log('initializeChessGame: Basic test completed successfully');

        // Now try the full initialization
        console.log('initializeChessGame: Attempting full initialization...');

        // Initialize board state
        initBoard();
        console.log('initializeChessGame: Board initialized');

        // Initialize game state
        currentPlayer = 'white';
        whiteCaptured = [];
        blackCaptured = [];
        moveHistory = [];
        selectedSquare = null;
        boardFlipped = false;

        // Render the board
        renderBoard();
        console.log('initializeChessGame: Board rendered');

        // Update status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML = 'Chess game initialized successfully!';
            statusEl.style.color = '#4CAF50';
        }

        console.log('OK: Chess game initialized successfully');

    } catch (error) {
        console.error('initializeChessGame failed:', error);
        showInitializationError(error);
    }
}

function showInitializationError(error) {
    console.error('ERROR: Chess game initialization failed:', error);
    console.error('ERROR TYPE:', error.constructor.name);
    console.error('ERROR STACK:', error.stack);

    // Show detailed error message to user
    const statusEl = document.getElementById('status');
    if (statusEl) {
        const errorDetails = error.message || 'Unknown error occurred';
        const errorType = error.constructor.name || 'Error';
        statusEl.innerHTML = `
            <div style="color: #FF6B6B; padding: 15px; border: 2px solid #FF6B6B; border-radius: 8px; background: rgba(255, 107, 107, 0.1); font-family: monospace; font-size: 12px;">
                <strong>Chess Game Error - ${errorType}</strong><br><br>
                <strong>Message:</strong> ${errorDetails}<br><br>
                <strong>What to do:</strong><br>
                1. Check browser console (F12) for full error details<br>
                2. Try refreshing the page<br>
                3. If problem persists, the chess board may have rendering issues
            </div>
        `;
    } else {
        // Fallback: create status element if not found
        console.error('STATUS ELEMENT NOT FOUND, creating one...');
        const statusDiv = document.createElement('div');
        statusDiv.id = 'status';
        statusDiv.style.cssText = 'color: #FF0000; padding: 15px; border: 3px solid #FF0000; border-radius: 8px; background: rgba(255, 0, 0, 0.1); font-family: monospace; font-size: 14px; margin: 10px 0; position: fixed; top: 10px; left: 10px; right: 10px; z-index: 9999;';
        statusDiv.innerHTML = `
            <strong>CRITICAL ERROR - Status Element Missing</strong><br><br>
            <strong>Error:</strong> ${error.message || 'Unknown error'}<br>
            <strong>Type:</strong> ${error.constructor.name || 'Error'}<br><br>
            <strong>Action:</strong> Check browser console (F12) and refresh page.
        `;
        document.body.insertBefore(statusDiv, document.body.firstChild);
    }

    // Try to recover with minimal initialization
    try {
        console.log('Attempting recovery initialization...');
        initBoard();
        renderBoard();
    } catch (recoveryError) {
        console.error('ERROR: Recovery initialization also failed:', recoveryError);
        console.error('RECOVERY ERROR TYPE:', recoveryError.constructor.name);
        console.error('RECOVERY ERROR STACK:', recoveryError.stack);

        // Show recovery error as well
        if (statusEl) {
            statusEl.innerHTML += `<br><br><div style="color: #FF4444; padding: 5px; border: 1px solid #FF4444; border-radius: 3px; margin-top: 10px;">
                <strong>Recovery Failed:</strong> ${recoveryError.message || 'Unknown recovery error'}
            </div>`;
        }
    }
}

// Safe function to call newGame with retry logic
function safeCallNewGame() {
    const statusEl = document.getElementById('status');

    if (typeof newGame === 'function' && window.chessScriptLoaded) {
        newGame();
    } else {
        console.warn('newGame function not yet available, retrying...');

        // Update status to show loading
        if (statusEl) {
            statusEl.innerHTML = 'Loading chess script...';
            statusEl.style.color = '#FFA500';
        }

        // Retry after a longer delay
        setTimeout(() => {
            if (typeof newGame === 'function' && window.chessScriptLoaded) {
                newGame();
                // Status will be updated by markScriptLoaded
            } else {
                console.error('newGame function still not available after first retry, trying again...');
                // Try one more time with longer delay
                setTimeout(() => {
                    if (typeof newGame === 'function' && window.chessScriptLoaded) {
                        newGame();
                    } else {
                        console.error('newGame function still not available after second retry');
                        if (statusEl) {
                            statusEl.innerHTML = 'Error: Chess script failed to load. Please refresh the page.';
                            statusEl.style.color = '#FF0000';
                        }
                        alert('Chess script not loaded yet. Please refresh the page and try again.');
                    }
                }, 1000);
            }
        }, 1000);
    }
}

// Mark script as loaded
function markScriptLoaded() {
    console.log('markScriptLoaded: Script loaded, updating UI');
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerHTML = 'Chess script loaded successfully! Ready to play.';
        statusEl.style.color = '#4CAF50';
    }

    // Enable the New Game button
    const newGameBtn = document.querySelector('button[onclick*="safeCallNewGame"]');
    if (newGameBtn) {
        console.log('markScriptLoaded: Enabling New Game button');
        newGameBtn.disabled = false;
        newGameBtn.style.opacity = '1';
    } else {
        console.warn('markScriptLoaded: New Game button not found');
    }

    console.log('markScriptLoaded: Script initialization complete');
}

// Ensure functions are globally available
window.newGame = newGame;
window.safeCallNewGame = safeCallNewGame;

// Mark script as loaded globally
window.chessScriptLoaded = true;

// Initialize when script loads (deferred execution)
safeInitializeGame();

// Mark as loaded after initialization
setTimeout(markScriptLoaded, 100);
