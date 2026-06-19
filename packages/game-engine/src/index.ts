import type { GameType } from '@game-lobby/shared';
import type { GameParticipant } from '@game-lobby/game-core';
import type { UndercoverGameState, UndercoverStartOptions } from '@game-lobby/game-undercover';
import type { DaVinciGameState, DaVinciStartOptions } from '@game-lobby/game-da-vinci-code';
import type { DrawGuessGameState, DrawGuessStartOptions } from '@game-lobby/game-draw-guess';
import type { HeartAttackGameState, HeartAttackStartOptions } from '@game-lobby/game-german-heart-attack';
import type { WerewolfGameState, WerewolfStartOptions } from '@game-lobby/game-werewolf';
import type { GomokuGameState, GomokuStartOptions } from '@game-lobby/game-gomoku';
import { getGameModule } from './registry.js';

export type GameState =
  | UndercoverGameState
  | DaVinciGameState
  | DrawGuessGameState
  | HeartAttackGameState
  | WerewolfGameState
  | GomokuGameState;

export type GameStartOptionsMap = {
  undercover: UndercoverStartOptions;
  da_vinci_code: DaVinciStartOptions;
  draw_guess: DrawGuessStartOptions;
  german_heart_attack: HeartAttackStartOptions;
  werewolf: WerewolfStartOptions;
  gomoku: GomokuStartOptions;
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

export type { GameParticipant, GameModule, BotContext, CanAddBotResult, JoinRoleContext } from '@game-lobby/game-core';
export {
  pickRandom,
  shuffle,
  difficultyWeight,
  shouldBotMakeMistake,
  defaultCanAddBot,
  defaultResolveJoinRole,
} from '@game-lobby/game-core';

export {
  createUndercoverGame,
  sendUndercoverSpeech,
  endUndercoverSpeaking,
  submitUndercoverVote,
  advanceFromReveal,
  redactUndercoverState,
  pickPairFromPool,
  undercoverModule,
  type UndercoverGameState,
  type UndercoverPlayerState,
  type UndercoverPhase,
  type SpeechMessage,
  type UndercoverStartOptions,
  type PairSourceSnapshot,
  type EliminatedRole,
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

export {
  createDrawGuessGame,
  selectWord,
  tickDrawGuess,
  appendStrokes,
  clearCanvas,
  submitGuess,
  submitPainterHint,
  revealPainterChar,
  maxRevealableChars,
  redactDrawGuessState,
  drawGuessModule,
  type DrawGuessGameState,
  type DrawGuessPhase,
  type DrawGuessPlayerState,
  type DrawStroke,
  type GuessEntry,
  type PainterHintEntry,
  type WordSourceSnapshot,
  type DrawGuessStartOptions,
} from '@game-lobby/game-draw-guess';

export {
  createHeartAttackGame,
  flipHeartAttackCard,
  chooseWildFruit,
  slapHeartAttack,
  buildDeck,
  computeFruitTotals,
  isBellActive,
  emptyFruitTotals,
  pickBestWildFruit,
  generateBotWildChoice,
  generateBotShouldSlap,
  redactHeartAttackState,
  cardLabel,
  ALL_FRUITS,
  FRUIT_LABELS,
  FRUIT_EMOJI,
  heartAttackModule,
  type HeartAttackGameState,
  type HeartAttackPlayerState,
  type HeartAttackCard,
  type HeartAttackLastAction,
  type HeartAttackPhase,
  type HeartAttackStage,
  type Fruit,
  type CardKind,
  type HeartAttackStartOptions,
} from '@game-lobby/game-german-heart-attack';

export {
  createWerewolfGame,
  sendWerewolfSpeech,
  endWerewolfSpeaking,
  submitDayVote,
  submitWolfVote,
  sendWolfChat,
  submitSeerPeek,
  submitWitchAction,
  submitGuardProtect,
  submitHunterShoot,
  advanceFromDayAnnounce,
  advanceWerewolfFromReveal,
  advancePhaseOnTimeout,
  skipHunterShoot,
  resolveNight,
  validateRoleBoard,
  resolveRolesFromOptions,
  redactWerewolfState,
  getWolfTeammateIds,
  ROLE_LABELS,
  ROLE_PRESET_ROLES,
  werewolfModule,
  type WerewolfGameState,
  type WerewolfPlayerState,
  type WerewolfPhase,
  type WerewolfRole,
  type WerewolfRoleOrHidden,
  type WerewolfStartOptions,
  type RolePresetId,
  type RoleBoardConfig,
  type WolfChatMessage,
  type SeerPeekRecord,
  type EliminationRecord,
  type DiscussionMode,
  type WitchActionType,
} from '@game-lobby/game-werewolf';

export {
  createGomokuGame,
  placeGomokuStone,
  generateBotGomokuMove,
  checkWin,
  createEmptyBoard,
  GOMOKU_BOARD_SIZE,
  gomokuModule,
  type GomokuGameState,
  type GomokuPlayerState,
  type GomokuLastMove,
  type GomokuCoord,
  type GomokuStone,
  type GomokuCell,
  type GomokuPhase,
  type GomokuStartOptions,
} from '@game-lobby/game-gomoku';
