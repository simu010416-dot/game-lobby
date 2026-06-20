import { describe, expect, it } from 'vitest';
import { applyBotChineseChessMove, generateBotChineseChessMove } from './bot.js';
import {
  applyChineseChessMove,
  createChineseChessGame,
  getLegalMoves,
  offerChineseChessDraw,
  replayChineseChessToIndex,
  respondChineseChessDraw,
  resignChineseChessGame,
  tickChineseChessGame,
} from './logic.js';
import { createXiangqi } from './xiangqi-engine.js';

const participants = [
  { id: 'p1', name: 'Alice', isBot: false },
  { id: 'p2', name: 'Bob', isBot: false },
];

describe('createChineseChessGame', () => {
  it('creates initial position with red to move', () => {
    const state = createChineseChessGame(participants);
    expect(state.phase).toBe('playing');
    expect(state.currentColor).toBe('red');
    expect(state.players).toHaveLength(2);
    expect(state.players[0]!.color).toBe('red');
    expect(state.players[1]!.color).toBe('black');
    expect(state.timeSettings?.mainTimeMs).toBe(600_000);
    expect(state.timeSettings?.incrementMs).toBe(5_000);
  });

  it('supports unlimited time', () => {
    const state = createChineseChessGame(participants, { unlimitedTime: true });
    expect(state.timeSettings).toBeNull();
  });
});

describe('applyChineseChessMove', () => {
  it('plays legal moves and switches turn', () => {
    let state = createChineseChessGame(participants);
    state = applyChineseChessMove(state, 'p1', 'b0', 'c2', 1000);
    expect(state.currentColor).toBe('black');
    expect(state.lastMove?.from).toBe('b0');
    expect(state.moves).toHaveLength(1);
  });

  it('rejects illegal moves', () => {
    const state = createChineseChessGame(participants);
    const next = applyChineseChessMove(state, 'p1', 'e0', 'e9');
    expect(next).toBe(state);
  });

  it('rejects out-of-turn moves', () => {
    const state = createChineseChessGame(participants);
    const next = applyChineseChessMove(state, 'p2', 'b9', 'c7');
    expect(next).toBe(state);
  });
});

describe('getLegalMoves', () => {
  it('returns moves for a selected piece', () => {
    const state = createChineseChessGame(participants);
    const moves = getLegalMoves(state, 'b0');
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe('resignChineseChessGame', () => {
  it('ends game with opponent winning', () => {
    const state = createChineseChessGame(participants);
    const next = resignChineseChessGame(state, 'p1');
    expect(next.phase).toBe('ended');
    expect(next.winnerId).toBe('p2');
    expect(next.endReason).toBe('resignation');
  });
});

describe('draw offer', () => {
  it('accepts draw agreement', () => {
    let state = createChineseChessGame(participants);
    state = offerChineseChessDraw(state, 'p1');
    expect(state.drawOffer?.fromColor).toBe('red');
    state = respondChineseChessDraw(state, 'p2', true);
    expect(state.phase).toBe('ended');
    expect(state.endReason).toBe('agreement');
    expect(state.winnerId).toBeNull();
  });

  it('rejects draw offer', () => {
    let state = createChineseChessGame(participants);
    state = offerChineseChessDraw(state, 'p1');
    state = respondChineseChessDraw(state, 'p2', false);
    expect(state.drawOffer).toBeNull();
    expect(state.phase).toBe('playing');
  });
});

describe('tickChineseChessGame', () => {
  it('ends game on timeout', () => {
    let state = createChineseChessGame(participants, { mainTimeSec: 1, incrementSec: 0 });
    state = {
      ...state,
      turnStartedAt: Date.now() - 5000,
      players: state.players.map((p) =>
        p.color === 'red' ? { ...p, mainTimeMs: 0 } : p,
      ),
    };
    const next = tickChineseChessGame(state, Date.now());
    expect(next.phase).toBe('ended');
    expect(next.endReason).toBe('timeout');
    expect(next.winnerId).toBe('p2');
  });
});

describe('replayChineseChessToIndex', () => {
  it('replays moves to index', () => {
    let state = createChineseChessGame(participants);
    state = applyChineseChessMove(state, 'p1', 'b0', 'c2');
    state = applyChineseChessMove(state, 'p2', 'b9', 'c7');
    const replay = replayChineseChessToIndex(state, 1);
    const xq = createXiangqi(replay.fen);
    expect(xq.turn()).toBe('b');
  });
});

describe('bot', () => {
  it('generates a legal move', () => {
    const state = createChineseChessGame(participants);
    const move = generateBotChineseChessMove(state, 'medium');
    expect(move).not.toBeNull();
    const xq = createXiangqi(state.fen);
    expect(xq.move({ from: move!.from, to: move!.to })).toBeTruthy();
  });

  it('applies bot move', () => {
    const state = createChineseChessGame([
      { id: 'bot', name: 'Bot', isBot: true },
      { id: 'p2', name: 'Bob', isBot: false },
    ]);
    const next = applyBotChineseChessMove(state, 'bot', 'easy');
    expect(next.lastMove).not.toBeNull();
    expect(next.currentColor).toBe('black');
  });
});
