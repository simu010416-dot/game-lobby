import type { GameType } from '@game-lobby/shared';
import type { GameModule } from '@game-lobby/game-core';
import { undercoverModule } from '@game-lobby/game-undercover';
import { daVinciModule } from '@game-lobby/game-da-vinci-code';
import { drawGuessModule } from '@game-lobby/game-draw-guess';
import { heartAttackModule } from '@game-lobby/game-german-heart-attack';
import { werewolfModule } from '@game-lobby/game-werewolf';
import { gomokuModule } from '@game-lobby/game-gomoku';

export const gameRegistry: Record<GameType, GameModule<unknown, unknown>> = {
  undercover: undercoverModule as GameModule<unknown, unknown>,
  da_vinci_code: daVinciModule as GameModule<unknown, unknown>,
  draw_guess: drawGuessModule as GameModule<unknown, unknown>,
  german_heart_attack: heartAttackModule as GameModule<unknown, unknown>,
  werewolf: werewolfModule as GameModule<unknown, unknown>,
  gomoku: gomokuModule as GameModule<unknown, unknown>,
};

export function getGameModule(gameType: GameType): GameModule<unknown, unknown> {
  return gameRegistry[gameType];
}
