import type { GameType } from '@game-lobby/shared';
import {
  createUndercoverGame,
  submitUndercoverDescription,
  submitUndercoverVote,
  generateBotDescription,
  generateBotVote,
  type UndercoverGameState,
} from './games/undercover/logic.js';
import { UNDERCOVER_WORD_PAIRS } from './games/undercover/words.js';
import {
  createDaVinciGame,
  guessDaVinciTile,
  decideDaVinciContinue,
  generateBotDaVinciMove,
  generateBotDaVinciDecision,
  computeDaVinciCandidates,
  redactDaVinciState,
  type DaVinciGameState,
} from './games/da-vinci-code/logic.js';
import { pickRandom } from './ai/utils.js';

export type GameState = UndercoverGameState | DaVinciGameState;

export interface GameParticipant {
  id: string;
  name: string;
  isBot: boolean;
}

export function createGame(
  gameType: GameType,
  participants: GameParticipant[],
): GameState {
  switch (gameType) {
    case 'undercover':
      return createUndercoverGame(participants, pickRandom(UNDERCOVER_WORD_PAIRS));
    case 'da_vinci_code':
      return createDaVinciGame(participants);
  }
}

export {
  createUndercoverGame,
  submitUndercoverDescription,
  submitUndercoverVote,
  generateBotDescription,
  generateBotVote,
  type UndercoverGameState,
  createDaVinciGame,
  guessDaVinciTile,
  decideDaVinciContinue,
  generateBotDaVinciMove,
  generateBotDaVinciDecision,
  computeDaVinciCandidates,
  redactDaVinciState,
  type DaVinciGameState,
};
