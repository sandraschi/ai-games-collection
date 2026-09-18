/**
 * Chess AI regression tests — targets B1 bugs (engine desync, dedup body-reuse, timeout race).
 * Requires Stockfish engine running on port 11211 (just docker-up or start.ps1).
 */
import { test, expect } from '@playwright/test';

const STOCKFISH = process.env.STOCKFISH_URL || 'http://127.0.0.1:11211';
const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test.describe('Stockfish Engine — Concurrency & Reliability', () => {
  test('should return a valid move for initial position', async ({ request }) => {
    const r = await request.post(`${STOCKFISH}/api/move`, {
      data: { fen: INITIAL_FEN, depth: 5 },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.move).toMatch(/^[a-h][1-8][a-h][1-8]/);
  });

  test('should survive 30 consecutive move requests without desync', async ({ request }) => {
    for (let i = 0; i < 30; i++) {
      const r = await request.post(`${STOCKFISH}/api/move`, {
        data: { fen: INITIAL_FEN, depth: 5 },
      });
      expect(r.status()).toBe(200);
      const body = await r.json();
      expect(body.success).toBe(true);
      expect(body.move).toBeTruthy();
      expect(body.engine).toBe('Stockfish 16');
    }
  });

  test('should handle 5 concurrent requests without desync (dedup regression)', async ({ request }) => {
    const promises = Array.from({ length: 5 }, () =>
      request.post(`${STOCKFISH}/api/move`, {
        data: { fen: INITIAL_FEN, depth: 5 },
      })
    );
    const responses = await Promise.all(promises);
    for (const r of responses) {
      expect(r.status()).toBe(200);
      const body = await r.json();
      expect(body.success).toBe(true);
      expect(body.move).toBeTruthy();
    }
  });

  test('should return valid moves for midgame position', async ({ request }) => {
    const midgameFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const r = await request.post(`${STOCKFISH}/api/move`, {
      data: { fen: midgameFen, depth: 10 },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.move).toBeTruthy();
  });

  test('should handle invalid FEN gracefully', async ({ request }) => {
    const r = await request.post(`${STOCKFISH}/api/move`, {
      data: { fen: 'invalid', depth: 5 },
    });
    const body = await r.json();
    expect(body.success).toBe(false);
  });
});

test.describe('Stockfish Engine — Status', () => {
  test('should report ready status', async ({ request }) => {
    const r = await request.get(`${STOCKFISH}/api/status`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.ready).toBe(true);
    expect(body.status).toBe('online');
  });
});
