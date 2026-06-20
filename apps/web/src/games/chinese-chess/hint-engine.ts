import type { ChineseChessGameState } from '@game-lobby/game-engine';
import { generateBotChineseChessMove } from '@game-lobby/game-engine';

export interface HintResult {
  from: string;
  to: string;
  iccs: string;
}

/** Client-side hint using the same search as medium-difficulty bot (no server call). */
export function computeChineseChessHint(state: ChineseChessGameState): HintResult | null {
  const move = generateBotChineseChessMove(state, 'medium');
  if (!move) return null;
  return {
    from: move.from,
    to: move.to,
    iccs: `${move.from}${move.to}`,
  };
}
