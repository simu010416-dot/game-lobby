import type { GameType } from '@game-lobby/shared';
import type { GameParticipant } from '@game-lobby/game-core';
import type { UndercoverGameState } from '@game-lobby/game-undercover';
import type { DaVinciGameState, DaVinciStartOptions } from '@game-lobby/game-da-vinci-code';
import { getGameModule } from './registry.js';

export type GameState = UndercoverGameState | DaVinciGameState;

export type GameStartOptionsMap = {
  undercover: Record<string, never>;
  da_vinci_code: DaVinciStartOptions;
};

export type GameStartOptions<T extends GameType = GameType> = GameStartOptionsMap[T];

export function createGame<T extends GameType>(
  gameType: T,
  participants: GameParticipant[],
  options: GameStartOptions<T> = {} as GameStartOptions<T>,
): GameState {
  const mod = getGameModule(gameType);
  return mod.create(participants, options) as GameState;
}

export function isGameEnded(gameType: GameType, state: GameState): boolean {
  return getGameModule(gameType).isEnded(state);
}

export function projectGameState(
  gameType: GameType,
  state: GameState,
  viewerId: string | null,
): GameState {
  const mod = getGameModule(gameType);
  if (mod.projectState) {
    return mod.projectState(state, viewerId) as GameState;
  }
  return state;
}

export { gameRegistry, getGameModule } from './registry.js';

export type { GameParticipant, GameModule, BotContext } from '@game-lobby/game-core';
export {
  pickRandom,
  shuffle,
  difficultyWeight,
  shouldBotMakeMistake,
} from '@game-lobby/game-core';

export {
  createUndercoverGame,
  submitUndercoverDescription,
  submitUndercoverVote,
  generateBotDescription,
  generateBotVote,
  undercoverModule,
  type UndercoverGameState,
  type UndercoverPlayerState,
  type UndercoverPhase,
  type UndercoverStartOptions,
} from '@game-lobby/game-undercover';

export {
  createDaVinciGame,
  submitDaVinciSetup,
  guessDaVinciTile,
  decideDaVinciContinue,
  placeDaVinciJoker,
  generateBotDaVinciMove,
  generateBotDaVinciDecision,
  generateBotDaVinciPlacement,
  computeDaVinciCandidates,
  jokerStillPossible,
  redactDaVinciState,
  tileKey,
  JOKER_VALUE,
  daVinciModule,
  type DaVinciGameState,
  type DaVinciPlayerState,
  type DaVinciTile,
  type DaVinciLastAction,
  type DaVinciColor,
  type DaVinciPhase,
  type DaVinciStage,
  type DaVinciStartOptions,
} from '@game-lobby/game-da-vinci-code';
