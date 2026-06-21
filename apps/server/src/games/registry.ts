import type { Socket } from 'socket.io';
import { registerUndercoverSockets } from './undercover/socket.js';
import { registerDaVinciSockets } from './da-vinci-code/socket.js';
import { registerDrawGuessSockets } from './draw-guess/socket.js';
import { registerActGuessSockets } from './act-guess/socket.js';
import { registerHeartAttackSockets } from './german-heart-attack/socket.js';
import { registerWerewolfSockets } from './werewolf/socket.js';
import { registerGomokuSockets } from './gomoku/socket.js';
import { registerGoSockets } from './go/socket.js';
import { registerChessSockets } from './chess/socket.js';
import { registerScriptMurderSockets } from './script-murder/socket.js';
import { registerDwarfMineSockets } from './dwarf-mine/socket.js';
import { registerChineseChessSockets } from './chinese-chess/socket.js';
import { registerGoldMinerSockets } from './gold-miner/socket.js';
import { registerAvalonSockets } from './avalon/socket.js';
import { registerLifeboatSockets } from './lifeboat/socket.js';
import type { GameSocketDeps } from './undercover/socket.js';

export type { GameSocketDeps };

export function registerAllGameSockets(
  socket: Socket,
  deps: GameSocketDeps & { io?: import('socket.io').Server },
) {
  registerUndercoverSockets(socket, deps);
  registerDaVinciSockets(socket, deps);
  registerDrawGuessSockets(socket, deps);
  registerActGuessSockets(socket, deps);
  registerHeartAttackSockets(socket, deps);
  registerWerewolfSockets(socket, deps);
  registerGomokuSockets(socket, deps);
  registerGoSockets(socket, deps);
  registerChessSockets(socket, deps);
  registerScriptMurderSockets(socket, deps);
  registerDwarfMineSockets(socket, deps);
  registerChineseChessSockets(socket, deps);
  registerGoldMinerSockets(socket, deps);
  registerLifeboatSockets(socket, deps);
  registerAvalonSockets(socket, deps);
}
