import { applyIncrementAfterMove } from './timer.js';
import { createXiangqi, INITIAL_FEN, type XiangqiPrettyMove } from './xiangqi-engine.js';

export type ChineseChessColor = 'red' | 'black';
export type ChineseChessPhase = 'playing' | 'ended';
export type ChineseChessEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'resignation'
  | 'timeout'
  | 'agreement'
  | null;

export interface ChineseChessPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: ChineseChessColor;
  mainTimeMs: number;
}

export interface ChineseChessTimeSettings {
  mainTimeMs: number;
  incrementMs: number;
}

export interface ChineseChessMoveRecord {
  side: ChineseChessColor;
  from: string;
  to: string;
  iccs: string;
  captured?: string;
  at: number;
}

export interface ChineseChessLastMove {
  from: string;
  to: string;
  iccs: string;
}

export interface ChineseChessMoveOption {
  from: string;
  to: string;
  iccs: string;
}

export interface ChineseChessGameState {
  phase: ChineseChessPhase;
  fen: string;
  players: ChineseChessPlayerState[];
  currentColor: ChineseChessColor;
  turnStartedAt: number;
  timeSettings: ChineseChessTimeSettings | null;
  moves: ChineseChessMoveRecord[];
  drawOffer: { fromColor: ChineseChessColor } | null;
  lastMove: ChineseChessLastMove | null;
  winnerId: string | null;
  endReason: ChineseChessEndReason;
  inCheck: boolean;
  message: string;
}

export interface ChineseChessStartOptions {
  mainTimeSec?: number;
  incrementSec?: number;
  unlimitedTime?: boolean;
}

function xiangqiColorToSide(color: 'r' | 'b'): ChineseChessColor {
  return color === 'r' ? 'red' : 'black';
}

function sideToXiangqiColor(side: ChineseChessColor): 'r' | 'b' {
  return side === 'red' ? 'r' : 'b';
}

function colorLabel(color: ChineseChessColor): string {
  return color === 'red' ? '红方' : '黑方';
}

function findPlayerById(state: ChineseChessGameState, id: string): ChineseChessPlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function findPlayerByColor(
  state: ChineseChessGameState,
  color: ChineseChessColor,
): ChineseChessPlayerState | undefined {
  return state.players.find((p) => p.color === color);
}

function resolveGameOver(
  state: ChineseChessGameState,
  xq: ReturnType<typeof createXiangqi>,
  mover: ChineseChessPlayerState,
): ChineseChessGameState {
  const inCheck = xq.in_check();

  if (!xq.game_over()) {
    const next = findPlayerByColor(state, state.currentColor);
    return {
      ...state,
      inCheck,
      message: inCheck
        ? `${next?.name ?? colorLabel(state.currentColor)} 被将军`
        : `轮到 ${next?.name ?? colorLabel(state.currentColor)}`,
    };
  }

  if (xq.in_checkmate()) {
    return {
      ...state,
      phase: 'ended',
      winnerId: mover.id,
      endReason: 'checkmate',
      inCheck: true,
      message: `${mover.name} 将死获胜`,
    };
  }

  if (xq.in_stalemate()) {
    return {
      ...state,
      phase: 'ended',
      winnerId: null,
      endReason: 'stalemate',
      inCheck: false,
      message: '困毙，和棋',
    };
  }

  return {
    ...state,
    phase: 'ended',
    winnerId: null,
    endReason: 'draw',
    inCheck: false,
    message: '和棋',
  };
}

export function createChineseChessGame(
  participants: { id: string; name: string; isBot: boolean }[],
  options: ChineseChessStartOptions = {},
): ChineseChessGameState {
  const active = participants.slice(0, 2);
  const red = active[0]!;
  const black = active[1]!;
  const unlimitedTime = options.unlimitedTime === true;
  const mainTimeMs = unlimitedTime ? 0 : (options.mainTimeSec ?? 600) * 1000;
  const incrementMs = unlimitedTime ? 0 : (options.incrementSec ?? 5) * 1000;
  const now = Date.now();

  const players: ChineseChessPlayerState[] = [
    { id: red.id, name: red.name, isBot: red.isBot, color: 'red', mainTimeMs },
    { id: black.id, name: black.name, isBot: black.isBot, color: 'black', mainTimeMs },
  ];

  return {
    phase: 'playing',
    fen: INITIAL_FEN,
    players,
    currentColor: 'red',
    turnStartedAt: now,
    timeSettings: unlimitedTime ? null : { mainTimeMs, incrementMs },
    moves: [],
    drawOffer: null,
    lastMove: null,
    winnerId: null,
    endReason: null,
    inCheck: false,
    message: `${red.name}（红）先行`,
  };
}

export function getLegalMoves(state: ChineseChessGameState, from?: string): ChineseChessMoveOption[] {
  if (state.phase !== 'playing') return [];

  const xq = createXiangqi(state.fen);
  const raw = from
    ? xq.moves({ square: from, verbose: true })
    : xq.moves({ verbose: true });

  return raw.map((m) => {
    const move = m as XiangqiPrettyMove;
    return {
      from: move.from,
      to: move.to,
      iccs: move.iccs ?? `${move.from}${move.to}`,
    };
  });
}

export function applyChineseChessMove(
  state: ChineseChessGameState,
  playerId: string,
  from: string,
  to: string,
  now = Date.now(),
): ChineseChessGameState {
  if (state.phase !== 'playing') return state;

  const player = findPlayerById(state, playerId);
  if (!player || player.color !== state.currentColor) return state;

  const xq = createXiangqi(state.fen);
  const move = xq.move({ from, to });
  if (!move) return state;

  let next = applyIncrementAfterMove(state, player.color, now);
  const record: ChineseChessMoveRecord = {
    side: player.color,
    from: move.from,
    to: move.to,
    iccs: move.iccs ?? `${move.from}${move.to}`,
    captured: move.captured,
    at: now,
  };

  next = {
    ...next,
    fen: xq.fen(),
    lastMove: {
      from: move.from,
      to: move.to,
      iccs: record.iccs,
    },
    moves: [...state.moves, record],
  };

  return resolveGameOver(next, xq, player);
}

export function resignChineseChessGame(
  state: ChineseChessGameState,
  playerId: string,
): ChineseChessGameState {
  if (state.phase !== 'playing') return state;

  const player = findPlayerById(state, playerId);
  if (!player) return state;

  const winner = state.players.find((p) => p.id !== playerId);
  return {
    ...state,
    phase: 'ended',
    winnerId: winner?.id ?? null,
    endReason: 'resignation',
    drawOffer: null,
    message: `${player.name} 认输，${winner?.name ?? '对手'} 获胜`,
  };
}

export function offerChineseChessDraw(
  state: ChineseChessGameState,
  playerId: string,
): ChineseChessGameState {
  if (state.phase !== 'playing') return state;

  const player = findPlayerById(state, playerId);
  if (!player) return state;

  if (state.drawOffer?.fromColor === player.color) return state;

  return {
    ...state,
    drawOffer: { fromColor: player.color },
    message: `${player.name} 提出和棋`,
  };
}

export function respondChineseChessDraw(
  state: ChineseChessGameState,
  playerId: string,
  accept: boolean,
): ChineseChessGameState {
  if (state.phase !== 'playing' || !state.drawOffer) return state;

  const player = findPlayerById(state, playerId);
  if (!player || player.color === state.drawOffer.fromColor) return state;

  if (!accept) {
    const offerer = findPlayerByColor(state, state.drawOffer.fromColor);
    return {
      ...state,
      drawOffer: null,
      message: `${player.name} 拒绝和棋，继续对局`,
    };
  }

  return {
    ...state,
    phase: 'ended',
    winnerId: null,
    endReason: 'agreement',
    drawOffer: null,
    message: '双方同意和棋',
  };
}

export function getCurrentPlayerId(state: ChineseChessGameState): string | null {
  return findPlayerByColor(state, state.currentColor)?.id ?? null;
}

export function replayChineseChessToIndex(
  state: ChineseChessGameState,
  moveIndex: number,
): { fen: string; lastMove: ChineseChessLastMove | null } {
  const xq = createXiangqi(INITIAL_FEN);
  const capped = Math.max(0, Math.min(moveIndex, state.moves.length));
  let lastMove: ChineseChessLastMove | null = null;

  for (let i = 0; i < capped; i++) {
    const m = state.moves[i]!;
    const result = xq.move({ from: m.from, to: m.to });
    if (result) {
      lastMove = { from: m.from, to: m.to, iccs: m.iccs };
    }
  }

  return { fen: xq.fen(), lastMove };
}

export { deductElapsedTime, tickChineseChessGame } from './timer.js';

export { sideToXiangqiColor, xiangqiColorToSide };
