import type { GameType } from '@game-lobby/shared';
import type { GameModule } from '@game-lobby/game-core';
import { undercoverModule } from '@game-lobby/game-undercover';
import { daVinciModule } from '@game-lobby/game-da-vinci-code';
import { drawGuessModule } from '@game-lobby/game-draw-guess';
import { actGuessModule } from '@game-lobby/game-act-guess';
import { heartAttackModule } from '@game-lobby/game-german-heart-attack';
import { werewolfModule } from '@game-lobby/game-werewolf';
import { gomokuModule } from '@game-lobby/game-gomoku';
import { goModule } from '@game-lobby/game-go';
import { chessModule } from '@game-lobby/game-chess';
import { scriptMurderModule } from '@game-lobby/game-script-murder';
import { dwarfMineModule } from '@game-lobby/game-dwarf-mine';
import { chineseChessModule } from '@game-lobby/game-chinese-chess';
import { goldMinerModule } from '@game-lobby/game-gold-miner';
import { lifeboatModule } from '@game-lobby/game-lifeboat';
import { avalonModule } from '@game-lobby/game-avalon';

export const gameRegistry: Record<GameType, GameModule<unknown, unknown>> = {
  undercover: undercoverModule as GameModule<unknown, unknown>,
  da_vinci_code: daVinciModule as GameModule<unknown, unknown>,
  draw_guess: drawGuessModule as GameModule<unknown, unknown>,
  act_guess: actGuessModule as GameModule<unknown, unknown>,
  german_heart_attack: heartAttackModule as GameModule<unknown, unknown>,
  werewolf: werewolfModule as GameModule<unknown, unknown>,
  gomoku: gomokuModule as GameModule<unknown, unknown>,
  go: goModule as GameModule<unknown, unknown>,
  chess: chessModule as GameModule<unknown, unknown>,
  script_murder: scriptMurderModule as GameModule<unknown, unknown>,
  dwarf_mine: dwarfMineModule as GameModule<unknown, unknown>,
  chinese_chess: chineseChessModule as GameModule<unknown, unknown>,
  gold_miner: goldMinerModule as GameModule<unknown, unknown>,
  lifeboat: lifeboatModule as GameModule<unknown, unknown>,
  avalon: avalonModule as GameModule<unknown, unknown>,
};

export function getGameModule(gameType: GameType): GameModule<unknown, unknown> {
  return gameRegistry[gameType];
}
