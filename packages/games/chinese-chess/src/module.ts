import type { GameModule } from '@game-lobby/game-core';
import { applyBotChineseChessMove } from './bot.js';
import {
  createChineseChessGame,
  applyChineseChessMove,
  resignChineseChessGame,
  getCurrentPlayerId,
  type ChineseChessGameState,
  type ChineseChessStartOptions,
} from './logic.js';

export type { ChineseChessStartOptions } from './logic.js';

export const chineseChessModule: GameModule<ChineseChessGameState, ChineseChessStartOptions> = {
  gameType: 'chinese_chess',

  create(participants, options = {}) {
    return createChineseChessGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  runBotTurn(state, ctx) {
    const currentId = getCurrentPlayerId(state);
    if (state.phase !== 'playing' || currentId !== ctx.playerId) return null;

    const member = ctx.roomPlayers.find((p) => p.id === ctx.playerId);
    if (!member?.botDifficulty) return null;

    return applyBotChineseChessMove(state, ctx.playerId, member.botDifficulty);
  },

  insufficientPlayersHint() {
    return '可添加电脑，或将多余玩家设为旁观。';
  },
};

export {
  createChineseChessGame,
  applyChineseChessMove,
  resignChineseChessGame,
  offerChineseChessDraw,
  respondChineseChessDraw,
  getCurrentPlayerId,
  getLegalMoves,
  replayChineseChessToIndex,
} from './logic.js';
export { generateBotChineseChessMove, applyBotChineseChessMove } from './bot.js';
export { tickChineseChessGame } from './timer.js';
