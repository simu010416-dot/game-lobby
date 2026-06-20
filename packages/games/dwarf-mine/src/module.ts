import type { GameModule } from '@game-lobby/game-core';
import {
  createDwarfMineGame,
  redactDwarfMineState,
  isDwarfMineEnded,
  type DwarfMineGameState,
  type DwarfMineStartOptions,
} from './logic.js';

export const dwarfMineModule: GameModule<DwarfMineGameState, DwarfMineStartOptions> = {
  gameType: 'dwarf_mine',

  create(participants, options = {}) {
    return createDwarfMineGame(participants, options);
  },

  isEnded(state) {
    return isDwarfMineEnded(state);
  },

  projectState(state, viewerId) {
    return redactDwarfMineState(state, viewerId);
  },

  canAddBot() {
    return { ok: false as const, message: '矮人矿坑不支持电脑玩家' };
  },
};

export {
  createDwarfMineGame,
  redactDwarfMineState,
  isDwarfMineEnded,
  playPath,
  playAction,
  discardCard,
  discardTwo,
  passTurn,
  mapPeek,
  rolePeekContinue,
  pickGold,
  stealGoldFrom,
  skipSteal,
  continueRound,
  cardLabel,
} from './logic.js';

export type { DwarfMineGameState, DwarfMineStartOptions, DwarfMineMode, DwarfMinePhase } from './logic.js';
