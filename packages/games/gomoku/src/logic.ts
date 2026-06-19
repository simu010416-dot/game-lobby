import type { AiDifficulty } from '@game-lobby/shared';
import { pickRandom, shouldBotMakeMistake } from '@game-lobby/game-core';

export const GOMOKU_BOARD_SIZE = 15;

export type GomokuStone = 'black' | 'white';
export type GomokuCell = GomokuStone | null;
export type GomokuPhase = 'playing' | 'ended';

export interface GomokuPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: GomokuStone;
}

export interface GomokuLastMove {
  row: number;
  col: number;
  playerId: string;
  playerName: string;
}

export interface GomokuCoord {
  row: number;
  col: number;
}

export interface GomokuGameState {
  phase: GomokuPhase;
  boardSize: number;
  board: GomokuCell[][];
  players: GomokuPlayerState[];
  currentPlayerIndex: number;
  lastMove: GomokuLastMove | null;
  winnerId: string | null;
  winLine: GomokuCoord[] | null;
  message: string;
}

export type GomokuStartOptions = Record<string, never>;

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function createEmptyBoard(size: number): GomokuCell[][] {
  return Array.from({ length: size }, () => Array<GomokuCell>(size).fill(null));
}

export function createGomokuGame(
  participants: { id: string; name: string; isBot: boolean }[],
): GomokuGameState {
  const active = participants.slice(0, 2);
  const colors: GomokuStone[] = ['black', 'white'];
  const players: GomokuPlayerState[] = active.map((p, i) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    color: colors[i]!,
  }));

  const first = players[0];
  return {
    phase: 'playing',
    boardSize: GOMOKU_BOARD_SIZE,
    board: createEmptyBoard(GOMOKU_BOARD_SIZE),
    players,
    currentPlayerIndex: 0,
    lastMove: null,
    winnerId: null,
    winLine: null,
    message: first ? `${first.name}（黑棋）先行` : '游戏开始',
  };
}

function cloneBoard(board: GomokuCell[][]): GomokuCell[][] {
  return board.map((row) => [...row]);
}

function inBounds(board: GomokuCell[][], row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[0]!.length;
}

function countLine(
  board: GomokuCell[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: GomokuStone,
): GomokuCoord[] {
  const cells: GomokuCoord[] = [{ row, col }];
  let r = row + dr;
  let c = col + dc;
  while (inBounds(board, r, c) && board[r]![c] === stone) {
    cells.push({ row: r, col: c });
    r += dr;
    c += dc;
  }
  r = row - dr;
  c = col - dc;
  while (inBounds(board, r, c) && board[r]![c] === stone) {
    cells.unshift({ row: r, col: c });
    r -= dr;
    c -= dc;
  }
  return cells;
}

export function checkWin(
  board: GomokuCell[][],
  row: number,
  col: number,
  stone: GomokuStone,
): GomokuCoord[] | null {
  for (const [dr, dc] of DIRECTIONS) {
    const line = countLine(board, row, col, dr, dc, stone);
    if (line.length >= 5) {
      return line.slice(0, 5);
    }
  }
  return null;
}

function isBoardFull(board: GomokuCell[][]): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

function opponentStone(stone: GomokuStone): GomokuStone {
  return stone === 'black' ? 'white' : 'black';
}

function getEmptyCells(board: GomokuCell[][]): GomokuCoord[] {
  const cells: GomokuCoord[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r]!.length; c++) {
      if (board[r]![c] === null) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function hasNeighbor(board: GomokuCell[][], row: number, col: number, radius = 2): boolean {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (inBounds(board, r, c) && board[r]![c] !== null) return true;
    }
  }
  return false;
}

function wouldWin(board: GomokuCell[][], row: number, col: number, stone: GomokuStone): boolean {
  if (board[row]![col] !== null) return false;
  const next = cloneBoard(board);
  next[row]![col] = stone;
  return checkWin(next, row, col, stone) !== null;
}

function maxLineLength(
  board: GomokuCell[][],
  row: number,
  col: number,
  stone: GomokuStone,
): number {
  if (board[row]![col] !== null) return 0;
  const next = cloneBoard(board);
  next[row]![col] = stone;
  let max = 0;
  for (const [dr, dc] of DIRECTIONS) {
    max = Math.max(max, countLine(next, row, col, dr, dc, stone).length);
  }
  return max;
}

function scoreMove(board: GomokuCell[][], row: number, col: number, stone: GomokuStone): number {
  const opp = opponentStone(stone);
  let score = 0;

  if (wouldWin(board, row, col, stone)) return 1_000_000;
  if (wouldWin(board, row, col, opp)) return 900_000;

  score += maxLineLength(board, row, col, stone) ** 3 * 100;
  score += maxLineLength(board, row, col, opp) ** 3 * 80;

  const center = (board.length - 1) / 2;
  score += Math.max(0, 14 - Math.abs(row - center) - Math.abs(col - center)) * 2;

  if (hasNeighbor(board, row, col)) score += 20;

  return score;
}

export function generateBotGomokuMove(
  state: GomokuGameState,
  botId: string,
  difficulty: AiDifficulty,
): GomokuCoord | null {
  if (state.phase !== 'playing') return null;

  const bot = state.players.find((p) => p.id === botId);
  const current = state.players[state.currentPlayerIndex];
  if (!bot || current?.id !== botId) return null;

  const empty = getEmptyCells(state.board);
  if (empty.length === 0) return null;

  const stone = bot.color;
  const candidates =
    empty.some((c) => hasNeighbor(state.board, c.row, c.col)) || empty.length <= 2
      ? empty.filter((c) => hasNeighbor(state.board, c.row, c.col) || empty.length <= 2)
      : empty.filter((c) => {
          const center = (state.boardSize - 1) / 2;
          return Math.abs(c.row - center) <= 2 && Math.abs(c.col - center) <= 2;
        });

  const pool = candidates.length > 0 ? candidates : empty;

  if (shouldBotMakeMistake(difficulty)) {
    return pickRandom(pool);
  }

  let best = pool[0]!;
  let bestScore = -Infinity;
  for (const cell of pool) {
    const s = scoreMove(state.board, cell.row, cell.col, stone);
    if (s > bestScore) {
      bestScore = s;
      best = cell;
    }
  }
  return best;
}

export function placeGomokuStone(
  state: GomokuGameState,
  playerId: string,
  row: number,
  col: number,
): GomokuGameState {
  if (state.phase !== 'playing') return state;

  const current = state.players[state.currentPlayerIndex];
  if (!current || current.id !== playerId) return state;

  if (!inBounds(state.board, row, col)) return state;
  if (state.board[row]![col] !== null) return state;

  const board = cloneBoard(state.board);
  const stone = current.color;
  board[row]![col] = stone;

  const winLine = checkWin(board, row, col, stone);
  if (winLine) {
    return {
      ...state,
      phase: 'ended',
      board,
      lastMove: { row, col, playerId, playerName: current.name },
      winnerId: playerId,
      winLine,
      message: `${current.name} 连成五子，获胜！`,
    };
  }

  if (isBoardFull(board)) {
    return {
      ...state,
      phase: 'ended',
      board,
      lastMove: { row, col, playerId, playerName: current.name },
      winnerId: null,
      winLine: null,
      message: '棋盘已满，和棋',
    };
  }

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const next = state.players[nextIndex]!;
  return {
    ...state,
    board,
    currentPlayerIndex: nextIndex,
    lastMove: { row, col, playerId, playerName: current.name },
    message: `轮到 ${next.name}（${next.color === 'black' ? '黑' : '白'}棋）`,
  };
}
