import type { AiDifficulty, GameType, RoomDetail, RoomPlayer } from '@game-lobby/shared';

export interface GameParticipant {
  id: string;
  name: string;
  isBot: boolean;
}

export interface BotContext {
  difficulty: AiDifficulty;
  playerId: string;
  playerName: string;
  roomPlayers: RoomPlayer[];
}

export interface GameModule<TState = unknown, TStartOptions = void> {
  gameType: GameType;
  create(participants: GameParticipant[], options: TStartOptions): TState;
  isEnded(state: TState): boolean;
  projectState?(state: TState, viewerId: string | null): TState;
  runBotTurn?(state: TState, ctx: BotContext): TState | null;
  /** Member ids to demote to spectator before start (e.g. bots in undercover). */
  preStartSpectatorIds?(room: RoomDetail): string[];
  insufficientPlayersHint?(): string;
}
