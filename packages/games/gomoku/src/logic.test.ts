import { describe, expect, it } from 'vitest';
import {
  checkWin,
  createEmptyBoard,
  createGomokuGame,
  generateBotGomokuMove,
  placeGomokuStone,
} from './logic.js';

const participants = [
  { id: 'p1', name: 'Alice', isBot: false },
  { id: 'p2', name: 'Bob', isBot: false },
];

describe('createGomokuGame', () => {
  it('creates a 15x15 board with black moving first', () => {
    const state = createGomokuGame(participants);
    expect(state.boardSize).toBe(15);
    expect(state.board).toHaveLength(15);
    expect(state.board[0]).toHaveLength(15);
    expect(state.board.every((row) => row.every((c) => c === null))).toBe(true);
    expect(state.players).toHaveLength(2);
    expect(state.players[0]!.color).toBe('black');
    expect(state.players[1]!.color).toBe('white');
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.phase).toBe('playing');
  });
});

describe('placeGomokuStone', () => {
  it('places a stone and switches turn', () => {
    let state = createGomokuGame(participants);
    state = placeGomokuStone(state, 'p1', 7, 7);
    expect(state.board[7]![7]).toBe('black');
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.lastMove).toMatchObject({ row: 7, col: 7, playerId: 'p1' });
  });

  it('rejects out-of-turn moves', () => {
    const state = createGomokuGame(participants);
    const next = placeGomokuStone(state, 'p2', 7, 7);
    expect(next).toBe(state);
  });

  it('rejects occupied cells', () => {
    let state = createGomokuGame(participants);
    state = placeGomokuStone(state, 'p1', 7, 7);
    const next = placeGomokuStone(state, 'p2', 7, 7);
    expect(next).toBe(state);
  });

  it('rejects out-of-bounds moves', () => {
    const state = createGomokuGame(participants);
    expect(placeGomokuStone(state, 'p1', -1, 0)).toBe(state);
    expect(placeGomokuStone(state, 'p1', 15, 0)).toBe(state);
  });

  it('detects horizontal win', () => {
    let state = createGomokuGame(participants);
    const moves: [string, number, number][] = [
      ['p1', 7, 3],
      ['p2', 6, 3],
      ['p1', 7, 4],
      ['p2', 6, 4],
      ['p1', 7, 5],
      ['p2', 6, 5],
      ['p1', 7, 6],
      ['p2', 6, 6],
      ['p1', 7, 7],
    ];
    for (const [id, r, c] of moves) {
      state = placeGomokuStone(state, id, r, c);
    }
    expect(state.phase).toBe('ended');
    expect(state.winnerId).toBe('p1');
    expect(state.winLine).toHaveLength(5);
  });

  it('detects vertical win', () => {
    let state = createGomokuGame(participants);
    for (let i = 0; i < 4; i++) {
      state = placeGomokuStone(state, 'p1', i, 7);
      state = placeGomokuStone(state, 'p2', i, 8);
    }
    state = placeGomokuStone(state, 'p1', 4, 7);
    expect(state.winnerId).toBe('p1');
  });

  it('detects diagonal win', () => {
    let state = createGomokuGame(participants);
    for (let i = 0; i < 4; i++) {
      state = placeGomokuStone(state, 'p1', i, i);
      state = placeGomokuStone(state, 'p2', i, 14 - i);
    }
    state = placeGomokuStone(state, 'p1', 4, 4);
    expect(state.winnerId).toBe('p1');
  });

  it('detects draw on full small board', () => {
    const board = createEmptyBoard(2);
    board[0]![0] = 'black';
    board[0]![1] = 'white';
    board[1]![0] = 'white';
    const state = {
      phase: 'playing' as const,
      boardSize: 2,
      board,
      players: [
        { id: 'p1', name: 'Alice', isBot: false, color: 'black' as const },
        { id: 'p2', name: 'Bob', isBot: false, color: 'white' as const },
      ],
      currentPlayerIndex: 0,
      lastMove: null,
      winnerId: null,
      winLine: null,
      message: '',
    };
    const ended = placeGomokuStone(state, 'p1', 1, 1);
    expect(ended.phase).toBe('ended');
    expect(ended.winnerId).toBeNull();
    expect(ended.message).toContain('和棋');
  });
});

describe('checkWin', () => {
  it('returns win line when five in a row', () => {
    const board = createEmptyBoard(15);
    for (let c = 0; c < 5; c++) board[7]![c] = 'black';
    const line = checkWin(board, 7, 4, 'black');
    expect(line).not.toBeNull();
    expect(line).toHaveLength(5);
  });
});

describe('generateBotGomokuMove', () => {
  it('wins when possible', () => {
    const board = createEmptyBoard(15);
    for (let c = 0; c < 4; c++) board[7]![c] = 'black';
    const state = {
      phase: 'playing' as const,
      boardSize: 15,
      board,
      players: [
        { id: 'bot', name: 'Bot', isBot: true, color: 'black' as const },
        { id: 'p2', name: 'Bob', isBot: false, color: 'white' as const },
      ],
      currentPlayerIndex: 0,
      lastMove: null,
      winnerId: null,
      winLine: null,
      message: '',
    };
    const move = generateBotGomokuMove(state, 'bot', 'expert');
    expect(move).toEqual({ row: 7, col: 4 });
  });

  it('blocks opponent win', () => {
    const board = createEmptyBoard(15);
    for (let c = 0; c < 4; c++) board[7]![c] = 'white';
    const state = {
      phase: 'playing' as const,
      boardSize: 15,
      board,
      players: [
        { id: 'bot', name: 'Bot', isBot: true, color: 'black' as const },
        { id: 'p2', name: 'Bob', isBot: false, color: 'white' as const },
      ],
      currentPlayerIndex: 0,
      lastMove: null,
      winnerId: null,
      winLine: null,
      message: '',
    };
    const move = generateBotGomokuMove(state, 'bot', 'expert');
    expect(move).toEqual({ row: 7, col: 4 });
  });
});
