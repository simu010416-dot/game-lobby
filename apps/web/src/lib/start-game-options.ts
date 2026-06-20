import type { ActGuessTeamId, RolePresetId, WerewolfRole } from '@game-lobby/game-engine';

/** Options collected from per-game RoomSettings before `game:start`. */
export type GameStartOptionsPayload = {
  useJoker?: boolean;
  assistMode?: boolean;
  categoryIds?: string[];
  userPackIds?: string[];
  userPairPackIds?: string[];
  roomExtraWords?: string;
  drawDurationSec?: number;
  performDurationSec?: number;
  wordSelectDurationSec?: number;
  enableTeams?: boolean;
  teamAssignments?: Record<string, ActGuessTeamId>;
  useSpecialCards?: boolean;
  rolePreset?: RolePresetId;
  customRoles?: WerewolfRole[];
  discussionMode?: 'free' | 'sequential';
  boardSize?: 9 | 13 | 19;
  handicap?: number;
  mainTimeSec?: number;
  byoyomiSec?: number;
  byoyomiPeriods?: number;
  incrementSec?: number;
  scriptId?: string;
  dwarfMineMode?: 'base' | 'expansion';
  unlimitedTime?: boolean;
};
