import type { GameModule } from '@game-lobby/game-core';
import { applyBotGoMove } from './bot.js';
import {
  createGoGame,
  getCurrentPlayerId,
  passGoTurn,
  playGoStone,
  resignGoGame,
  getLegalMoves,
  cloneBoard,
  createEmptyBoard,
  type GoGameState,
  type GoStartOptions,
} from './logic.js';

export type { GoStartOptions } from './logic.js';

export const goModule: GameModule<GoGameState, GoStartOptions> = {
  gameType: 'go',

  create(participants, options = {}) {
    return createGoGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  runBotTurn(state, ctx) {
    const currentId = getCurrentPlayerId(state);
    if (state.phase !== 'playing' || currentId !== ctx.playerId) return null;

    const member = ctx.roomPlayers.find((p) => p.id === ctx.playerId);
    if (!member?.botDifficulty) return null;

    return applyBotGoMove(state, ctx.playerId, member.botDifficulty);
  },

  insufficientPlayersHint() {
    return '可添加电脑，或将多余玩家设为旁观。';
  },
};

export {
  createGoGame,
  playGoStone,
  passGoTurn,
  resignGoGame,
  getCurrentPlayerId,
  getLegalMoves,
  cloneBoard,
  createEmptyBoard,
};
