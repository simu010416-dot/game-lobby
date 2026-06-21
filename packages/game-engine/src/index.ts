import type { GameType } from '@game-lobby/shared';
import type { GameParticipant } from '@game-lobby/game-core';
import type { UndercoverGameState, UndercoverStartOptions } from '@game-lobby/game-undercover';
import type { DaVinciGameState, DaVinciStartOptions } from '@game-lobby/game-da-vinci-code';
import type { DrawGuessGameState, DrawGuessStartOptions } from '@game-lobby/game-draw-guess';
import type { ActGuessGameState, ActGuessStartOptions } from '@game-lobby/game-act-guess';
import type { HeartAttackGameState, HeartAttackStartOptions } from '@game-lobby/game-german-heart-attack';
import type { WerewolfGameState, WerewolfStartOptions } from '@game-lobby/game-werewolf';
import type { GomokuGameState, GomokuStartOptions } from '@game-lobby/game-gomoku';
import type { GoGameState, GoStartOptions } from '@game-lobby/game-go';
import type { ChessGameState, ChessStartOptions } from '@game-lobby/game-chess';
import type { ScriptMurderGameState, ScriptMurderStartOptions } from '@game-lobby/game-script-murder';
import type { DwarfMineGameState, DwarfMineStartOptions } from '@game-lobby/game-dwarf-mine';
import type { ChineseChessGameState, ChineseChessStartOptions } from '@game-lobby/game-chinese-chess';
import type { GoldMinerGameState, GoldMinerStartOptions } from '@game-lobby/game-gold-miner';
import type { LifeboatGameState, LifeboatStartOptions } from '@game-lobby/game-lifeboat';
import type { AvalonGameState, AvalonStartOptions } from '@game-lobby/game-avalon';
import { getGameModule } from './registry.js';

export type GameState =
  | UndercoverGameState
  | DaVinciGameState
  | DrawGuessGameState
  | ActGuessGameState
  | HeartAttackGameState
  | WerewolfGameState
  | GomokuGameState
  | GoGameState
  | ChessGameState
  | ScriptMurderGameState
  | DwarfMineGameState
  | ChineseChessGameState
  | GoldMinerGameState
  | LifeboatGameState
  | AvalonGameState;

export type GameStartOptionsMap = {
  undercover: UndercoverStartOptions;
  da_vinci_code: DaVinciStartOptions;
  draw_guess: DrawGuessStartOptions;
  act_guess: ActGuessStartOptions;
  german_heart_attack: HeartAttackStartOptions;
  werewolf: WerewolfStartOptions;
  gomoku: GomokuStartOptions;
  go: GoStartOptions;
  chess: ChessStartOptions;
  script_murder: ScriptMurderStartOptions;
  dwarf_mine: DwarfMineStartOptions;
  chinese_chess: ChineseChessStartOptions;
  gold_miner: GoldMinerStartOptions;
  lifeboat: LifeboatStartOptions;
  avalon: AvalonStartOptions;
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
  createActGuessGame,
  selectWord as selectActGuessWord,
  tickActGuess,
  submitGuess as submitActGuess,
  performerPass as actGuessPerformerPass,
  performerConfirmCorrect as actGuessPerformerConfirmCorrect,
  redactActGuessState,
  canPlayerGuess,
  canPlayerSeeWord,
  getConfirmableGuessers,
  getPlayerTeam,
  actGuessModule,
  type ActGuessGameState,
  type ActGuessPhase,
  type ActGuessPlayerState,
  type ActGuessTeamId,
  type ActGuessTeams,
  type ActGuessStartOptions,
} from '@game-lobby/game-act-guess';

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

export {
  createGoGame,
  playGoStone,
  passGoTurn,
  resignGoGame,
  getCurrentPlayerId,
  getLegalMoves,
  tickGoGame,
  scoreChinese,
  getHandicapPoints,
  getStarPoints,
  defaultKomi,
  applyBotGoMove,
  generateBotGoMove,
  goModule,
  type GoGameState,
  type GoPlayerState,
  type GoBoardSize,
  type GoColor,
  type GoPhase,
  type GoTimeSettings,
  type GoStartOptions,
  type BotGoAction,
} from '@game-lobby/game-go';

export {
  createChessGame,
  applyChessMove,
  resignChessGame,
  getCurrentPlayerId as getChessCurrentPlayerId,
  getLegalMoves as getChessLegalMoves,
  tickChessGame,
  generateBotChessMove,
  applyBotChessMove,
  chessModule,
  type ChessGameState,
  type ChessPlayerState,
  type ChessColor,
  type ChessPhase,
  type ChessPromotion,
  type ChessEndReason,
  type ChessLastMove,
  type ChessMoveOption,
  type ChessTimeSettings,
  type ChessStartOptions,
} from '@game-lobby/game-chess';

export {
  createScriptMurderGame,
  sendSpeech as sendScriptMurderSpeech,
  submitVote as submitScriptMurderVote,
  discoverClue,
  hostAdvancePhase,
  hostRevealClue,
  hostPause,
  hostJumpAct,
  advanceFromReveal as advanceScriptMurderFromReveal,
  advancePhaseOnTimeout as advanceScriptMurderPhaseOnTimeout,
  redactScriptMurderState,
  getVisibleClues,
  scriptMurderModule,
  type ScriptMurderGameState,
  type ScriptMurderPlayerState,
  type ScriptMurderStartOptions,
  type ScriptPhaseType,
  type SpeechMessage as ScriptMurderSpeechMessage,
} from '@game-lobby/game-script-murder';

export {
  createDwarfMineGame,
  playPath as playDwarfMinePath,
  playAction as playDwarfMineAction,
  discardCard as discardDwarfMineCard,
  discardTwo as discardDwarfMineTwo,
  passTurn as passDwarfMineTurn,
  mapPeek as dwarfMineMapPeek,
  rolePeekContinue as dwarfMineRolePeekContinue,
  pickGold as pickDwarfMineGold,
  stealGoldFrom as stealDwarfMineGold,
  skipSteal as skipDwarfMineSteal,
  continueRound as continueDwarfMineRound,
  redactDwarfMineState,
  isDwarfMineEnded,
  cardLabel as dwarfMineCardLabel,
  roleLabel as dwarfMineRoleLabel,
  canPlacePath as canPlaceDwarfMinePath,
  findValidPathPlacements as findValidDwarfMinePathPlacements,
  dwarfMineModule,
  BOARD_ROWS as DWARF_MINE_BOARD_ROWS,
  BOARD_COLS as DWARF_MINE_BOARD_COLS,
  GOAL_ROWS,
  GOAL_COL,
  type DwarfMineGameState,
  type DwarfMineStartOptions,
  type DwarfMineMode,
  type DwarfMinePhase,
  type DwarfMinePlayerState,
  type GameCard as DwarfMineGameCard,
} from '@game-lobby/game-dwarf-mine';

export {
  createChineseChessGame,
  applyChineseChessMove,
  resignChineseChessGame,
  offerChineseChessDraw,
  respondChineseChessDraw,
  getCurrentPlayerId as getChineseChessCurrentPlayerId,
  getLegalMoves as getChineseChessLegalMoves,
  replayChineseChessToIndex,
  tickChineseChessGame,
  generateBotChineseChessMove,
  applyBotChineseChessMove,
  chineseChessModule,
  INITIAL_FEN as CHINESE_CHESS_INITIAL_FEN,
  type ChineseChessGameState,
  type ChineseChessPlayerState,
  type ChineseChessColor,
  type ChineseChessPhase,
  type ChineseChessEndReason,
  type ChineseChessLastMove,
  type ChineseChessMoveOption,
  type ChineseChessMoveRecord,
  type ChineseChessTimeSettings,
  type ChineseChessStartOptions,
} from '@game-lobby/game-chinese-chess';

export {
  createGoldMinerGame,
  tickGoldMiner,
  launchHook,
  useDynamite,
  buyShopItem,
  skipShop,
  computeSwingAngle,
  hookTip,
  generateBotLaunch,
  generateBotShop,
  generateBotDynamite,
  scoreItemAtAngle,
  SHOP_PRICES,
  ITEM_LABELS,
  FIELD_WIDTH,
  FIELD_HEIGHT,
  MINER_X,
  MINER_Y,
  goldMinerModule,
  type GoldMinerGameState,
  type GoldMinerPlayerState,
  type GoldMinerPhase,
  type HookStage,
  type ItemType,
  type ShopItemType,
  type MineItem,
  type GoldMinerHookState,
  type GoldMinerLastGrab,
  type GoldMinerInventory,
  type GoldMinerStartOptions,
} from '@game-lobby/game-gold-miner';

export {
  createLifeboatGame,
  pickSupply,
  submitAction,
  respondToRequest,
  submitCombatSupport,
  resolveCombat,
  pickNavigation,
  playSupplyForThirst,
  skipThirst,
  redactLifeboatState,
  supplyCardLabel,
  SUPPLY_LABELS,
  CHARACTER_LABELS,
  lifeboatModule,
  type LifeboatGameState,
  type LifeboatPlayerState,
  type LifeboatPhase,
  type LifeboatActionType,
  type LifeboatActionPayload,
  type LifeboatStartOptions,
  type LifeboatScoreEntry,
  type CombatSide,
  type CharacterId,
  ALL_CHARACTERS,
  CHARACTER_BY_ID,
} from '@game-lobby/game-lifeboat';

export {
  createAvalonGame,
  proposeTeam,
  submitTeamVote,
  submitMissionCard,
  advanceFromMissionReveal,
  submitLadyPick,
  submitAssassination,
  sendEvilChat,
  redactAvalonState,
  validatePlayerCount,
  getTeamSize,
  failsRequired,
  isEvilRole,
  isGoodRole,
  ROLE_LABELS as AVALON_ROLE_LABELS,
  QUEST_TEAM_SIZES,
  ROLE_PRESETS as AVALON_ROLE_PRESETS,
  avalonModule,
  type AvalonGameState,
  type AvalonPlayerState,
  type AvalonPhase,
  type AvalonRole,
  type AvalonRoleOrHidden,
  type AvalonStartOptions,
  type AvalonWinner,
  type AvalonViewerInfo,
  type EvilChatMessage,
  type QuestResult,
  type LadyRecord,
} from '@game-lobby/game-avalon';
