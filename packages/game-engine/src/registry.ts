import type { GameType } from '@game-lobby/shared';
import type { GameModule } from '@game-lobby/game-core';
import { undercoverModule } from '@game-lobby/game-undercover';
import { daVinciModule } from '@game-lobby/game-da-vinci-code';

export const gameRegistry: Record<GameType, GameModule<unknown, unknown>> = {
  undercover: undercoverModule as GameModule<unknown, unknown>,
  da_vinci_code: daVinciModule as GameModule<unknown, unknown>,
};

export function getGameModule(gameType: GameType): GameModule<unknown, unknown> {
  return gameRegistry[gameType];
}
