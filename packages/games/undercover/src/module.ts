import type { GameModule } from '@game-lobby/game-core';
import { pickRandom } from '@game-lobby/game-core';
import type { RoomDetail } from '@game-lobby/shared';
import {
  createUndercoverGame,
  submitUndercoverDescription,
  submitUndercoverVote,
  generateBotDescription,
  generateBotVote,
  type UndercoverGameState,
} from './logic.js';
import { UNDERCOVER_WORD_PAIRS } from './words.js';

export type UndercoverStartOptions = Record<string, never>;

export const undercoverModule: GameModule<UndercoverGameState, UndercoverStartOptions> = {
  gameType: 'undercover',

  create(participants, _options = {}) {
    return createUndercoverGame(participants, pickRandom(UNDERCOVER_WORD_PAIRS));
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  preStartSpectatorIds(room: RoomDetail) {
    return room.players.filter((p) => p.isBot && p.role !== 'spectator').map((p) => p.id);
  },

  insufficientPlayersHint() {
    return '（电脑无法参与谁是卧底，已自动设为旁观）';
  },

  runBotTurn(state, ctx) {
    const member = ctx.roomPlayers.find((p) => p.id === ctx.playerId);
    if (!member?.botDifficulty) return null;

    const alive = state.players.filter((p) => p.isAlive);

    if (state.phase === 'describe') {
      const speaker = alive[state.currentSpeakerIndex];
      if (!speaker || speaker.id !== ctx.playerId || !speaker.isBot) return null;
      const desc = generateBotDescription(speaker, member.botDifficulty);
      return submitUndercoverDescription(state, speaker.id, desc);
    }

    if (state.phase === 'vote') {
      const bot = state.players.find((p) => p.id === ctx.playerId);
      if (!bot?.isBot || state.votes[ctx.playerId]) return null;
      const target = generateBotVote(state, ctx.playerId, member.botDifficulty);
      return submitUndercoverVote(state, ctx.playerId, target);
    }

    return null;
  },
};
