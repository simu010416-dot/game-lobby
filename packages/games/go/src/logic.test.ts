import { describe, expect, it } from 'vitest';
import { applyStone, getLegalMoves, isLegalMove } from './board.js';
import { applyBotGoMove, generateBotGoMove } from './bot.js';
import { createEmptyBoard } from './board.js';
import {
  createGoGame,
  passGoTurn,
  playGoStone,
  resignGoGame,
  type GoGameState,
} from './logic.js';
import { tickGoGame } from './timer.js';

function twoPlayers() {
  return [
    { id: 'black-id', name: '黑方', isBot: false },
    { id: 'white-id', name: '白方', isBot: false },
  ];
}

function play(state: GoGameState, playerId: string, x: number, y: number) {
  return playGoStone(state, playerId, x, y, state.turnStartedAt + 1000);
}

describe('capture', () => {
  it('captures a single stone with no liberties', () => {
    const board = createEmptyBoard(9);
    board[0]![1] = 'white';
    board[0]![0] = 'black';
    board[0]![2] = 'black';
    board[1]![0] = 'black';
    board[1]![2] = 'black';
    board[2]![1] = 'black';

    const result = applyStone(board, 1, 1, 'black');
    expect(result).not.toBeNull();
    expect(result!.captured).toBe(1);
    expect(result!.board[0]![1]).toBeNull();
  });

});

describe('ko', () => {
  it('forbids immediate ko recapture', () => {
    const board = createEmptyBoard(9);
    board[0]![1] = 'white';
    board[0]![0] = 'black';
    board[0]![2] = 'black';
    board[1]![0] = 'black';
    board[1]![2] = 'black';

    const capture = applyStone(board, 1, 1, 'black');
    expect(capture).not.toBeNull();
    expect(capture!.captured).toBe(1);
    expect(capture!.koPoint).toEqual({ x: 1, y: 0 });

    expect(isLegalMove(capture!.board, 1, 0, 'white', capture!.koPoint)).toBe(false);
  });
});

describe('suicide', () => {
  it('forbids suicide unless capturing', () => {
    let board = createEmptyBoard(9);
    board[0]![1] = 'white';
    board[1]![0] = 'white';
    board[1]![2] = 'white';
    board[2]![1] = 'white';

    expect(isLegalMove(board, 1, 1, 'black', null)).toBe(false);

    board[0]![0] = 'black';
    board[2]![0] = 'black';
    board[0]![2] = 'black';
    board[2]![2] = 'black';
    expect(isLegalMove(board, 1, 1, 'black', null)).toBe(true);
  });
});

describe('pass and scoring', () => {
  it('ends game on double pass with score', () => {
    let state = createGoGame(twoPlayers(), { boardSize: 9, mainTimeSec: 600 });
    state = passGoTurn(state, 'black-id', state.turnStartedAt + 1000);
    expect(state.consecutivePasses).toBe(1);
    state = passGoTurn(state, 'white-id', state.turnStartedAt + 1000);
    expect(state.phase).toBe('ended');
    expect(state.score).not.toBeNull();
  });
});

describe('handicap', () => {
  it('places handicap stones and white moves first', () => {
    const state = createGoGame(twoPlayers(), { boardSize: 9, handicap: 2, mainTimeSec: 600 });
    expect(state.handicap).toBe(2);
    expect(state.currentColor).toBe('white');
    expect(state.board[2]![2]).toBe('black');
    expect(state.board[6]![6]).toBe('black');
    expect(state.komi).toBe(0.5);
  });
});

describe('resign', () => {
  it('ends game when a player resigns', () => {
    let state = createGoGame(twoPlayers(), { boardSize: 9 });
    state = resignGoGame(state, 'black-id');
    expect(state.phase).toBe('ended');
    expect(state.winnerId).toBe('white-id');
  });
});

describe('timer', () => {
  it('declares loss on timeout', () => {
    let state = createGoGame(twoPlayers(), {
      boardSize: 9,
      mainTimeSec: 1,
      byoyomiSec: 1,
      byoyomiPeriods: 0,
    });
    state = {
      ...state,
      turnStartedAt: Date.now() - 5000,
      players: state.players.map((p) =>
        p.color === 'black' ? { ...p, mainTimeMs: 0, byoyomiPeriodsLeft: 0, byoyomiRemainingMs: 0 } : p,
      ),
    };
    const after = tickGoGame(state, Date.now());
    expect(after.phase).toBe('ended');
    expect(after.winnerId).toBe('white-id');
  });
});

describe('bot', () => {
  it('returns only legal moves', () => {
    let state = createGoGame(
      [
        { id: 'human', name: '人', isBot: false },
        { id: 'bot', name: '电脑', isBot: true },
      ],
      { boardSize: 9 },
    );
    state = play(state, 'human', 4, 4);

    const action = generateBotGoMove(state, 'bot', 'medium');
    expect(action).not.toBeNull();
    if (action?.type === 'play') {
      const legal = getLegalMoves(state.board, 'white', state.koPoint);
      expect(legal.some((m) => m.x === action.x && m.y === action.y)).toBe(true);
    }
  });

  it('applyBotGoMove updates state', () => {
    const state = createGoGame(
      [
        { id: 'human', name: '人', isBot: false },
        { id: 'bot', name: '电脑', isBot: true },
      ],
      { boardSize: 9 },
    );
    const botState = { ...state, currentColor: 'white' as const };
    const next = applyBotGoMove(botState, 'bot', 'easy', Date.now());
    expect(next).not.toBeNull();
    expect(next!.currentColor).toBe('black');
  });
});
