import type { RolePresetId, WerewolfRole } from '@game-lobby/game-engine';

/** Options collected from per-game RoomSettings before `game:start`. */
export type GameStartOptionsPayload = {
  useJoker?: boolean;
  assistMode?: boolean;
  categoryIds?: string[];
  userPackIds?: string[];
  userPairPackIds?: string[];
  roomExtraWords?: string;
  drawDurationSec?: number;
  wordSelectDurationSec?: number;
  useSpecialCards?: boolean;
  rolePreset?: RolePresetId;
  customRoles?: WerewolfRole[];
  discussionMode?: 'free' | 'sequential';
  boardSize?: 9 | 13 | 19;
  handicap?: number;
  mainTimeSec?: number;
  byoyomiSec?: number;
  byoyomiPeriods?: number;
};
