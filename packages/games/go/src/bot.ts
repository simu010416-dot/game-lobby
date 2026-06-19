import type { AiDifficulty } from '@game-lobby/shared';
import { pickRandom, shouldBotMakeMistake } from '@game-lobby/game-core';
import { getGroup, getLegalMoves } from './board.js';
import type { GoGameState } from './logic.js';
import { passGoTurn, playGoStone } from './logic.js';

function wouldCapture(
  state: GoGameState,
  x: number,
  y: number,
): number {
  const size = state.board.length;
  const color = state.currentColor;
  const opp = color === 'black' ? 'white' : 'black';
  let captured = 0;

  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
    if (state.board[ny]![nx] !== opp) continue;
    const group = getGroup(state.board, nx, ny);
    if (group && group.liberties.size === 1) captured += group.stones.length;
  }
  return captured;
}

function isAtariMove(state: GoGameState, x: number, y: number): boolean {
  return wouldCapture(state, x, y) > 0;
}

function cornerBonus(state: GoGameState, x: number, y: number): number {
  const size = state.boardSize;
  const margin = Math.min(x, y, size - 1 - x, size - 1 - y);
  if (margin <= 2) return 8;
  if (margin <= 3) return 4;
  return 0;
}

function scoreMove(state: GoGameState, x: number, y: number, difficulty: AiDifficulty): number {
  let score = 0;
  const capture = wouldCapture(state, x, y);
  score += capture * 1000;

  if (difficulty !== 'easy') {
    if (isAtariMove(state, x, y)) score += 200;
    score += cornerBonus(state, x, y);
    const center = (state.boardSize - 1) / 2;
    score += Math.max(0, 6 - Math.abs(x - center) - Math.abs(y - center));
  }

  return score;
}

export type BotGoAction =
  | { type: 'play'; x: number; y: number }
  | { type: 'pass' };

export function generateBotGoMove(
  state: GoGameState,
  botId: string,
  difficulty: AiDifficulty,
): BotGoAction | null {
  if (state.phase !== 'playing') return null;

  const bot = state.players.find((p) => p.id === botId);
  if (!bot || bot.color !== state.currentColor) return null;

  const legal = getLegalMoves(state.board, state.currentColor, state.koPoint);
  if (legal.length === 0) return { type: 'pass' };

  if (difficulty === 'easy' && Math.random() < 0.05) {
    return { type: 'pass' };
  }

  if (shouldBotMakeMistake(difficulty)) {
    return { type: 'play', ...pickRandom(legal) };
  }

  let best = legal[0]!;
  let bestScore = -Infinity;
  for (const move of legal) {
    const s = scoreMove(state, move.x, move.y, difficulty);
    if (s > bestScore) {
      bestScore = s;
      best = move;
    }
  }
  return { type: 'play', ...best };
}

export function applyBotGoMove(
  state: GoGameState,
  botId: string,
  difficulty: AiDifficulty,
  now = Date.now(),
): GoGameState | null {
  const action = generateBotGoMove(state, botId, difficulty);
  if (!action) return null;
  if (action.type === 'pass') return passGoTurn(state, botId, now);
  return playGoStone(state, botId, action.x, action.y, now);
}
