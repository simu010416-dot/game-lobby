import type { GameModule } from '@game-lobby/game-core';
import {
  createGomokuGame,
  generateBotGomokuMove,
  placeGomokuStone,
  type GomokuGameState,
  type GomokuStartOptions,
} from './logic.js';

export type { GomokuStartOptions } from './logic.js';

export const gomokuModule: GameModule<GomokuGameState, GomokuStartOptions> = {
  gameType: 'gomoku',

  create(participants) {
    return createGomokuGame(participants);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  runBotTurn(state, ctx) {
    const current = state.players[state.currentPlayerIndex];
    if (state.phase !== 'playing' || !current?.isBot || current.id !== ctx.playerId) {
      return null;
    }

    const move = generateBotGomokuMove(state, ctx.playerId, ctx.difficulty);
    if (!move) return null;

    return placeGomokuStone(state, ctx.playerId, move.row, move.col);
  },

  insufficientPlayersHint() {
    return '可添加电脑，或将多余玩家设为旁观。';
  },
};

export { createGomokuGame, generateBotGomokuMove, placeGomokuStone };
