import type { GameModule } from '@game-lobby/game-core';
import {
  createDaVinciGame,
  guessDaVinciTile,
  decideDaVinciContinue,
  placeDaVinciJoker,
  generateBotDaVinciMove,
  generateBotDaVinciDecision,
  generateBotDaVinciPlacement,
  redactDaVinciState,
  type DaVinciGameState,
} from './logic.js';

export interface DaVinciStartOptions {
  useJoker?: boolean;
  assistMode?: boolean;
}

export const daVinciModule: GameModule<DaVinciGameState, DaVinciStartOptions> = {
  gameType: 'da_vinci_code',

  create(participants, options = {}) {
    return createDaVinciGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  projectState(state, viewerId) {
    return redactDaVinciState(state, viewerId);
  },

  runBotTurn(state, ctx) {
    const member = ctx.roomPlayers.find((p) => p.id === ctx.playerId);
    if (!member?.botDifficulty || state.phase !== 'playing') return null;

    const current = state.players[state.currentPlayerIndex];
    if (!current || current.id !== ctx.playerId || !current.isBot) return null;

    if (state.stage === 'guessing') {
      const move = generateBotDaVinciMove(state, current.id, member.botDifficulty);
      return guessDaVinciTile(
        state,
        current.id,
        move.targetPlayerId,
        move.tileIndex,
        move.value,
      );
    }

    if (state.stage === 'placing') {
      const index = generateBotDaVinciPlacement(state, current.id);
      return placeDaVinciJoker(state, current.id, index);
    }

    const keepGoing = generateBotDaVinciDecision(state, current.id, member.botDifficulty);
    return decideDaVinciContinue(state, current.id, keepGoing);
  },
};
