import type { Socket } from 'socket.io';
import type { RoomManager } from '../../services/room-manager.js';
import {
  submitUndercoverDescription,
  submitUndercoverVote,
  type UndercoverGameState,
} from '@game-lobby/game-engine';

export interface GameSocketDeps {
  roomManager: RoomManager;
  getRoomId: (socket: Socket) => string | null;
  findMember: (roomId: string, userId: string) => Promise<{ id: string } | undefined>;
  afterGameUpdate: (
    roomId: string,
    state: unknown,
    options?: { perPlayerState?: boolean },
  ) => Promise<void>;
}

export function registerUndercoverSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  socket.on('game:undercover:describe', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'undercover') return;

    game.state = submitUndercoverDescription(
      game.state as UndercoverGameState,
      member.id,
      payload.description,
    );
    roomManager.touchGameRoom(roomId);

    await afterGameUpdate(roomId, game.state, { perPlayerState: false });
    cb?.({ ok: true });
  });

  socket.on('game:undercover:vote', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'undercover') return;

    game.state = submitUndercoverVote(
      game.state as UndercoverGameState,
      member.id,
      payload.targetId,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state, { perPlayerState: false });
    cb?.({ ok: true });
  });
}
