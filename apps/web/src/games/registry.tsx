import type { ComponentType, ReactNode } from 'react';
import type { GameType } from '@game-lobby/shared';
import { isGameEnded } from '@game-lobby/game-engine';
import type { GameState } from '@game-lobby/game-engine';
import type { GameStartOptionsPayload } from '../lib/start-game-options';
import { UndercoverGame } from './undercover/UndercoverGame';
import {
  emitUndercoverSpeech,
  emitUndercoverEndSpeaking,
  emitUndercoverVote,
  emitUndercoverContinueReveal,
} from './undercover/socket';
import { UndercoverRoomSettings } from './undercover/RoomSettings';
import { DaVinciGame } from './da-vinci-code/DaVinciGame';
import {
  emitDaVinciGuess,
  emitDaVinciDecision,
  emitDaVinciPlace,
  emitDaVinciSetup,
} from './da-vinci-code/socket';
import { DaVinciRoomSettings } from './da-vinci-code/RoomSettings';
import { DrawGuessGame } from './draw-guess/DrawGuessGame';
import {
  emitSelectWord,
  emitStroke,
  emitClearCanvas,
  emitGuess,
  emitPainterHint,
  emitRevealChar,
} from './draw-guess/socket';
import { DrawGuessRoomSettings } from './draw-guess/RoomSettings';
import { HeartAttackGame } from './german-heart-attack/HeartAttackGame';
import {
  emitHeartAttackFlip,
  emitHeartAttackSlap,
  emitHeartAttackChooseWild,
} from './german-heart-attack/socket';
import { HeartAttackRoomSettings } from './german-heart-attack/RoomSettings';
import { WerewolfGame } from './werewolf/WerewolfGame';
import {
  emitContinue,
  emitDayVote,
  emitEndSpeaking,
  emitGuardProtect,
  emitHunterShoot,
  emitSeerPeek,
  emitSkipHunter,
  emitWerewolfSpeech,
  emitWitchAct,
  emitWolfChat,
  emitWolfVote,
} from './werewolf/socket';
import { WerewolfRoomSettings } from './werewolf/RoomSettings';
import { GomokuGame } from './gomoku/GomokuGame';
import { emitGomokuPlace } from './gomoku/socket';
import { GoGame } from './go/GoGame';
import { emitGoPass, emitGoPlay, emitGoResign } from './go/socket';
import { GoRoomSettings } from './go/RoomSettings';

export interface GameComponentProps {
  state: GameState;
  myMemberId: string | null;
  isSpectator: boolean;
  isHost?: boolean;
  canStartNext?: boolean;
  onStartNextGame?: () => void;
}

export interface RoomSettingsProps {
  isHost: boolean;
  isPlaying: boolean;
  isIntermission: boolean;
  gameState: GameState | null;
  onStartOptionsChange: (options: Partial<GameStartOptionsPayload>) => void;
}

export interface WebGameModule {
  Component: ComponentType<GameComponentProps>;
  RoomSettings?: ComponentType<RoomSettingsProps>;
  isEnded: (state: unknown) => boolean;
}

function UndercoverGameWrapper({
  state,
  myMemberId,
  isSpectator,
  isHost,
  canStartNext,
  onStartNextGame,
}: GameComponentProps) {
  return (
    <UndercoverGame
      state={state as import('@game-lobby/game-engine').UndercoverGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      isHost={isHost}
      canStartNext={canStartNext}
      onStartNext={onStartNextGame}
      onSpeech={emitUndercoverSpeech}
      onEndSpeaking={emitUndercoverEndSpeaking}
      onVote={emitUndercoverVote}
      onContinueReveal={emitUndercoverContinueReveal}
    />
  );
}

function DaVinciGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <DaVinciGame
      state={state as import('@game-lobby/game-engine').DaVinciGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onGuess={emitDaVinciGuess}
      onDecision={emitDaVinciDecision}
      onPlaceJoker={emitDaVinciPlace}
      onSubmitSetup={emitDaVinciSetup}
    />
  );
}

function DrawGuessGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <DrawGuessGame
      state={state as import('@game-lobby/game-engine').DrawGuessGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onSelectWord={emitSelectWord}
      onStroke={emitStroke}
      onClear={emitClearCanvas}
      onGuess={emitGuess}
      onPainterHint={emitPainterHint}
      onRevealChar={emitRevealChar}
    />
  );
}

function HeartAttackGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <HeartAttackGame
      state={state as import('@game-lobby/game-engine').HeartAttackGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onFlip={emitHeartAttackFlip}
      onSlap={emitHeartAttackSlap}
      onChooseWild={emitHeartAttackChooseWild}
    />
  );
}

function WerewolfGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <WerewolfGame
      state={state as import('@game-lobby/game-engine').WerewolfGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onWolfVote={emitWolfVote}
      onWolfChat={emitWolfChat}
      onSeerPeek={emitSeerPeek}
      onWitchAct={emitWitchAct}
      onGuardProtect={emitGuardProtect}
      onSpeech={emitWerewolfSpeech}
      onEndSpeaking={emitEndSpeaking}
      onDayVote={emitDayVote}
      onHunterShoot={emitHunterShoot}
      onSkipHunter={emitSkipHunter}
      onContinue={emitContinue}
    />
  );
}

function GomokuGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <GomokuGame
      state={state as import('@game-lobby/game-engine').GomokuGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onPlace={emitGomokuPlace}
    />
  );
}

function GoGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <GoGame
      state={state as import('@game-lobby/game-engine').GoGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onPlay={emitGoPlay}
      onPass={emitGoPass}
      onResign={emitGoResign}
    />
  );
}

export const GAME_REGISTRY: Record<GameType, WebGameModule> = {
  undercover: {
    Component: UndercoverGameWrapper,
    RoomSettings: UndercoverRoomSettings,
    isEnded: (state) => isGameEnded('undercover', state as GameState),
  },
  da_vinci_code: {
    Component: DaVinciGameWrapper,
    RoomSettings: DaVinciRoomSettings,
    isEnded: (state) => isGameEnded('da_vinci_code', state as GameState),
  },
  draw_guess: {
    Component: DrawGuessGameWrapper,
    RoomSettings: DrawGuessRoomSettings,
    isEnded: (state) => isGameEnded('draw_guess', state as GameState),
  },
  german_heart_attack: {
    Component: HeartAttackGameWrapper,
    RoomSettings: HeartAttackRoomSettings,
    isEnded: (state) => isGameEnded('german_heart_attack', state as GameState),
  },
  werewolf: {
    Component: WerewolfGameWrapper,
    RoomSettings: WerewolfRoomSettings,
    isEnded: (state) => isGameEnded('werewolf', state as GameState),
  },
  gomoku: {
    Component: GomokuGameWrapper,
    isEnded: (state) => isGameEnded('gomoku', state as GameState),
  },
  go: {
    Component: GoGameWrapper,
    RoomSettings: GoRoomSettings,
    isEnded: (state) => isGameEnded('go', state as GameState),
  },
};

export function renderGameSettings(
  gameType: GameType,
  props: RoomSettingsProps,
): ReactNode {
  const mod = GAME_REGISTRY[gameType];
  if (!mod.RoomSettings) return null;
  const Settings = mod.RoomSettings;
  return <Settings {...props} />;
}
