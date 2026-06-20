import type { AiDifficulty } from '@game-lobby/shared';
import { pickRandom, shouldBotMakeMistake } from '@game-lobby/game-core';
import type { ChineseChessGameState } from './logic.js';
import { applyChineseChessMove, getLegalMoves } from './logic.js';
import { createXiangqi, type XiangqiPrettyMove } from './xiangqi-engine.js';

const PIECE_VALUES: Record<string, number> = {
  p: 10,
  c: 45,
  r: 90,
  n: 40,
  b: 20,
  a: 20,
  k: 10000,
};

function evaluateFen(fen: string, forColor: 'r' | 'b'): number {
  const xq = createXiangqi(fen);
  const board = xq.board();
  let score = 0;

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      const val = PIECE_VALUES[piece.type] ?? 0;
      score += piece.color === forColor ? val : -val;
    }
  }

  if (xq.in_checkmate()) {
    return xq.turn() === forColor ? -100000 : 100000;
  }
  if (xq.in_check()) {
    score += xq.turn() === forColor ? -30 : 30;
  }

  return score;
}

function getVerboseMoves(fen: string, from?: string): XiangqiPrettyMove[] {
  const xq = createXiangqi(fen);
  const raw = from
    ? xq.moves({ square: from, verbose: true })
    : xq.moves({ verbose: true });
  return raw as XiangqiPrettyMove[];
}

function applyMoveOnFen(fen: string, from: string, to: string): string | null {
  const xq = createXiangqi(fen);
  const move = xq.move({ from, to });
  return move ? xq.fen() : null;
}

function minimax(
  fen: string,
  depth: number,
  maximizingColor: 'r' | 'b',
  currentColor: 'r' | 'b',
  alpha: number,
  beta: number,
): number {
  const xq = createXiangqi(fen);
  if (depth === 0 || xq.game_over()) {
    return evaluateFen(fen, maximizingColor);
  }

  const moves = getVerboseMoves(fen);
  if (moves.length === 0) {
    return evaluateFen(fen, maximizingColor);
  }

  if (currentColor === maximizingColor) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const nextFen = applyMoveOnFen(fen, m.from, m.to);
      if (!nextFen) continue;
      const evalScore = minimax(
        nextFen,
        depth - 1,
        maximizingColor,
        currentColor === 'r' ? 'b' : 'r',
        alpha,
        beta,
      );
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const m of moves) {
    const nextFen = applyMoveOnFen(fen, m.from, m.to);
    if (!nextFen) continue;
    const evalScore = minimax(
      nextFen,
      depth - 1,
      maximizingColor,
      currentColor === 'r' ? 'b' : 'r',
      alpha,
      beta,
    );
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) break;
  }
  return minEval;
}

function searchBestMove(
  state: ChineseChessGameState,
  depth: number,
): { from: string; to: string } | null {
  const xq = createXiangqi(state.fen);
  const botColor = state.currentColor === 'red' ? 'r' : 'b';
  const moves = getVerboseMoves(state.fen);
  if (moves.length === 0) return null;

  let best = moves[0]!;
  let bestScore = -Infinity;

  for (const m of moves) {
    const nextFen = applyMoveOnFen(state.fen, m.from, m.to);
    if (!nextFen) continue;
    const score = minimax(
      nextFen,
      depth - 1,
      botColor,
      botColor === 'r' ? 'b' : 'r',
      -Infinity,
      Infinity,
    );
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return { from: best.from, to: best.to };
}

function depthForDifficulty(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case 'easy':
      return 1;
    case 'medium':
      return 2;
    case 'hard':
      return 4;
    case 'expert':
      return 6;
    default:
      return 2;
  }
}

export function generateBotChineseChessMove(
  state: ChineseChessGameState,
  difficulty: AiDifficulty,
): { from: string; to: string } | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;

  if (shouldBotMakeMistake(difficulty)) {
    const m = pickRandom(moves);
    return m ? { from: m.from, to: m.to } : null;
  }

  if (difficulty === 'easy') {
    const m = pickRandom(moves);
    return m ? { from: m.from, to: m.to } : null;
  }

  return searchBestMove(state, depthForDifficulty(difficulty));
}

export function applyBotChineseChessMove(
  state: ChineseChessGameState,
  playerId: string,
  difficulty: AiDifficulty,
): ChineseChessGameState {
  const move = generateBotChineseChessMove(state, difficulty);
  if (!move) return state;
  return applyChineseChessMove(state, playerId, move.from, move.to);
}
