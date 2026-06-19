import {
  applyStone,
  cloneBoard,
  createEmptyBoard,
  getLegalMoves,
  opponent,
  type GoCell,
} from './board.js';
import { defaultKomi, getHandicapPoints } from './handicap.js';
import { scoreChinese } from './scoring.js';
import { deductTime, resetTurnTimer } from './timer.js';

export type GoBoardSize = 9 | 13 | 19;
export type GoColor = 'black' | 'white';
export type GoPhase = 'playing' | 'ended';

export interface GoPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: GoColor;
  captured: number;
  resigned: boolean;
  mainTimeMs: number;
  byoyomiPeriodsLeft: number;
  byoyomiRemainingMs: number;
}

export interface GoTimeSettings {
  mainTimeMs: number;
  byoyomiMs: number;
  byoyomiPeriods: number;
}

export interface GoGameState {
  phase: GoPhase;
  boardSize: GoBoardSize;
  board: GoCell[][];
  currentColor: GoColor;
  blackPlayerId: string;
  whitePlayerId: string;
  players: GoPlayerState[];
  handicap: number;
  komi: number;
  consecutivePasses: number;
  koPoint: { x: number; y: number } | null;
  lastMove: { x: number; y: number } | 'pass' | null;
  moveHistory: Array<{ color: GoColor; x: number; y: number } | 'pass'>;
  turnStartedAt: number;
  timeSettings: GoTimeSettings;
  winnerId: string | null;
  score: { black: number; white: number } | null;
  message: string;
}

export interface GoStartOptions {
  boardSize?: GoBoardSize;
  handicap?: number;
  komi?: number;
  mainTimeSec?: number;
  byoyomiSec?: number;
  byoyomiPeriods?: number;
}

function colorLabel(color: GoColor): string {
  return color === 'black' ? '黑' : '白';
}

function findPlayerByColor(state: GoGameState, color: GoColor): GoPlayerState | undefined {
  return state.players.find((p) => p.color === color);
}

function findPlayerById(state: GoGameState, id: string): GoPlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function endByScore(state: GoGameState): GoGameState {
  const score = scoreChinese(state.board, state.komi);
  const blackWins = score.black > score.white;
  const winner = blackWins
    ? findPlayerByColor(state, 'black')
    : findPlayerByColor(state, 'white');
  const winnerName = winner?.name ?? '未知';
  const resultText =
    score.black === score.white
      ? '和棋'
      : `${winnerName} 获胜（黑 ${score.black} : 白 ${score.white.toFixed(1)}，含贴目 ${state.komi}）`;

  return {
    ...state,
    phase: 'ended',
    winnerId: score.black === score.white ? null : (winner?.id ?? null),
    score,
    message: `双方 Pass，${resultText}`,
  };
}

export function createGoGame(
  participants: { id: string; name: string; isBot: boolean }[],
  options: GoStartOptions = {},
): GoGameState {
  const active = participants.slice(0, 2);
  const boardSize = options.boardSize ?? 19;
  const handicap = Math.max(0, Math.min(9, options.handicap ?? 0));
  const komi = options.komi ?? defaultKomi(boardSize, handicap);
  const mainTimeMs = (options.mainTimeSec ?? 600) * 1000;
  const byoyomiMs = (options.byoyomiSec ?? 30) * 1000;
  const byoyomiPeriods = options.byoyomiPeriods ?? 3;

  const black = active[0]!;
  const white = active[1]!;

  let board = createEmptyBoard(boardSize);
  for (const { x, y } of getHandicapPoints(boardSize, handicap)) {
    board[y]![x] = 'black';
  }

  const timeSettings: GoTimeSettings = { mainTimeMs, byoyomiMs, byoyomiPeriods };
  const now = Date.now();

  const players: GoPlayerState[] = [
    {
      id: black.id,
      name: black.name,
      isBot: black.isBot,
      color: 'black',
      captured: 0,
      resigned: false,
      mainTimeMs,
      byoyomiPeriodsLeft: byoyomiPeriods,
      byoyomiRemainingMs: byoyomiMs,
    },
    {
      id: white.id,
      name: white.name,
      isBot: white.isBot,
      color: 'white',
      captured: 0,
      resigned: false,
      mainTimeMs,
      byoyomiPeriodsLeft: byoyomiPeriods,
      byoyomiRemainingMs: byoyomiMs,
    },
  ];

  const currentColor: GoColor = handicap > 0 ? 'white' : 'black';
  const current = findPlayerByColor({ players } as GoGameState, currentColor);

  return {
    phase: 'playing',
    boardSize,
    board,
    currentColor,
    blackPlayerId: black.id,
    whitePlayerId: white.id,
    players,
    handicap,
    komi,
    consecutivePasses: 0,
    koPoint: null,
    lastMove: null,
    moveHistory: [],
    turnStartedAt: now,
    timeSettings,
    winnerId: null,
    score: null,
    message:
      handicap > 0
        ? `让 ${handicap} 子，${current?.name ?? '白方'} 先行`
        : `${black.name}（黑）先行`,
  };
}

function switchTurn(state: GoGameState, now: number): GoGameState {
  const nextColor = opponent(state.currentColor);
  const next = findPlayerByColor(state, nextColor);
  return resetTurnTimer(
    {
      ...state,
      currentColor: nextColor,
      message: `轮到 ${next?.name ?? colorLabel(nextColor)}（${colorLabel(nextColor)}）`,
    },
    now,
  );
}

export function playGoStone(
  state: GoGameState,
  playerId: string,
  x: number,
  y: number,
  now = Date.now(),
): GoGameState {
  if (state.phase !== 'playing') return state;

  const player = findPlayerById(state, playerId);
  if (!player || player.resigned || player.color !== state.currentColor) return state;

  const result = applyStone(state.board, x, y, player.color);
  if (!result) return state;
  if (state.koPoint && state.koPoint.x === x && state.koPoint.y === y) return state;

  let next = deductTime(state, now);
  const capturedBy = player.color;
  const players = next.players.map((p) =>
    p.color === capturedBy ? { ...p, captured: p.captured + result.captured } : p,
  );

  next = {
    ...next,
    board: result.board,
    players,
    consecutivePasses: 0,
    koPoint: result.koPoint,
    lastMove: { x, y },
    moveHistory: [...next.moveHistory, { color: player.color, x, y }],
    message: `${player.name} 落子 (${x + 1}, ${y + 1})${result.captured > 0 ? `，提 ${result.captured} 子` : ''}`,
  };

  return switchTurn(next, now);
}

export function passGoTurn(state: GoGameState, playerId: string, now = Date.now()): GoGameState {
  if (state.phase !== 'playing') return state;

  const player = findPlayerById(state, playerId);
  if (!player || player.resigned || player.color !== state.currentColor) return state;

  let next = deductTime(state, now);
  const consecutivePasses = next.consecutivePasses + 1;

  next = {
    ...next,
    consecutivePasses,
    koPoint: null,
    lastMove: 'pass',
    moveHistory: [...next.moveHistory, 'pass'],
    message: `${player.name} Pass`,
  };

  if (consecutivePasses >= 2) {
    return endByScore(next);
  }

  return switchTurn(next, now);
}

export function resignGoGame(state: GoGameState, playerId: string): GoGameState {
  if (state.phase !== 'playing') return state;

  const player = findPlayerById(state, playerId);
  if (!player || player.resigned) return state;

  const winner = state.players.find((p) => p.id !== playerId);
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, resigned: true } : p,
  );

  return {
    ...state,
    phase: 'ended',
    players,
    winnerId: winner?.id ?? null,
    message: `${player.name} 认输，${winner?.name ?? '对手'} 获胜`,
  };
}

export function getCurrentPlayerId(state: GoGameState): string | null {
  return findPlayerByColor(state, state.currentColor)?.id ?? null;
}

export { getLegalMoves, cloneBoard, createEmptyBoard };
