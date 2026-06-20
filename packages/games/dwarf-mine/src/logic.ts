import type { GameParticipant } from '@game-lobby/game-core';
import type { DwarfMineGameState, DwarfMineStartOptions } from './types.js';
import {
  createBaseGame,
  playBasePath,
  playBaseAction,
  discardBaseCard,
  resolveMapPeek,
  pickBaseGold,
  continueBaseRound,
  redactBaseState,
} from './logic-base.js';
import {
  createExpansionGame,
  playExpansionPath,
  playExpansionAction,
  discardExpansionTwo,
  passExpansion,
  resolveRolePeek,
  stealGold,
  skipTheft,
  continueExpansionRound,
  redactExpansionState,
} from './logic-expansion.js';

export type { DwarfMineGameState, DwarfMineStartOptions, DwarfMineMode, DwarfMinePhase } from './types.js';
export { roleLabel } from './roles.js';
export { BOARD_ROWS, BOARD_COLS, START_ROW, START_COL, GOAL_ROWS, GOAL_COL } from './types.js';

export function createDwarfMineGame(
  participants: GameParticipant[],
  options: DwarfMineStartOptions = {},
): DwarfMineGameState {
  const mode = options.mode ?? 'base';
  if (mode === 'expansion') return createExpansionGame(participants);
  return createBaseGame(participants);
}

export function playPath(
  state: DwarfMineGameState,
  playerId: string,
  cardId: string,
  row: number,
  col: number,
  rotation: 0 | 90 | 180 | 270,
): DwarfMineGameState {
  if (state.mode === 'expansion') {
    return playExpansionPath(state, playerId, cardId, row, col, rotation);
  }
  return playBasePath(state, playerId, cardId, row, col, rotation);
}

export function playAction(
  state: DwarfMineGameState,
  playerId: string,
  cardId: string,
  targetPlayerId?: string,
  collapseRow?: number,
  collapseCol?: number,
): DwarfMineGameState {
  if (state.mode === 'expansion') {
    return playExpansionAction(state, playerId, cardId, targetPlayerId, collapseRow, collapseCol);
  }
  return playBaseAction(state, playerId, cardId, targetPlayerId, collapseRow, collapseCol);
}

export function discardCard(
  state: DwarfMineGameState,
  playerId: string,
  cardId: string,
): DwarfMineGameState {
  return discardBaseCard(state, playerId, cardId);
}

export function discardTwo(
  state: DwarfMineGameState,
  playerId: string,
  cardId1: string,
  cardId2: string,
  faceUpCardId?: string,
): DwarfMineGameState {
  return discardExpansionTwo(state, playerId, cardId1, cardId2, faceUpCardId);
}

export function passTurn(
  state: DwarfMineGameState,
  playerId: string,
  cardIds: string[],
): DwarfMineGameState {
  return passExpansion(state, playerId, cardIds);
}

export function mapPeek(
  state: DwarfMineGameState,
  playerId: string,
  goalIndex: number,
): DwarfMineGameState {
  return resolveMapPeek(state, playerId, goalIndex);
}

export function rolePeekContinue(
  state: DwarfMineGameState,
  playerId: string,
): DwarfMineGameState {
  return resolveRolePeek(state, playerId);
}

export function pickGold(
  state: DwarfMineGameState,
  playerId: string,
  goldIndex: number,
): DwarfMineGameState {
  return pickBaseGold(state, playerId, goldIndex);
}

export function stealGoldFrom(
  state: DwarfMineGameState,
  playerId: string,
  targetId: string,
): DwarfMineGameState {
  return stealGold(state, playerId, targetId);
}

export function skipSteal(
  state: DwarfMineGameState,
  playerId: string,
): DwarfMineGameState {
  return skipTheft(state, playerId);
}

export function continueRound(state: DwarfMineGameState): DwarfMineGameState {
  if (state.mode === 'expansion') return continueExpansionRound(state);
  return continueBaseRound(state);
}

export function redactDwarfMineState(
  state: DwarfMineGameState,
  viewerId: string | null,
): DwarfMineGameState {
  if (state.mode === 'expansion') return redactExpansionState(state, viewerId);
  return redactBaseState(state, viewerId);
}

export function isDwarfMineEnded(state: DwarfMineGameState): boolean {
  return state.phase === 'ended';
}

export function cardLabel(card: import('./types.js').GameCard): string {
  const def = card.def;
  if (def.kind === 'path') return def.pathKind;
  return def.actionKind;
}
