import type { Socket } from 'socket.io';
import { registerUndercoverSockets } from './undercover/socket.js';
import { registerDaVinciSockets } from './da-vinci-code/socket.js';
import type { GameSocketDeps } from './undercover/socket.js';

export type { GameSocketDeps };

export function registerAllGameSockets(socket: Socket, deps: GameSocketDeps) {
  registerUndercoverSockets(socket, deps);
  registerDaVinciSockets(socket, deps);
}
