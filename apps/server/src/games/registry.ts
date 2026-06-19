import type { Socket } from 'socket.io';
import { registerUndercoverSockets } from './undercover/socket.js';
import { registerDaVinciSockets } from './da-vinci-code/socket.js';
import { registerDrawGuessSockets } from './draw-guess/socket.js';
import { registerHeartAttackSockets } from './german-heart-attack/socket.js';
import { registerWerewolfSockets } from './werewolf/socket.js';
import { registerGomokuSockets } from './gomoku/socket.js';
import type { GameSocketDeps } from './undercover/socket.js';

export type { GameSocketDeps };

export function registerAllGameSockets(
  socket: Socket,
  deps: GameSocketDeps & { io?: import('socket.io').Server },
) {
  registerUndercoverSockets(socket, deps);
  registerDaVinciSockets(socket, deps);
  registerDrawGuessSockets(socket, deps);
  registerHeartAttackSockets(socket, deps);
  registerWerewolfSockets(socket, deps);
  registerGomokuSockets(socket, deps);
}
