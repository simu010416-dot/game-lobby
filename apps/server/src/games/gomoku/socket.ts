import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import { placeGomokuStone, type GomokuGameState } from '@game-lobby/game-engine';

const gomokuPlaceSchema = z.object({
  row: z.number().int().min(0).max(14),
  col: z.number().int().min(0).max(14),
});

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

export function registerGomokuSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  socket.on('game:gomoku:place', async (payload, cb) => {
    const parsed = gomokuPlaceSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'gomoku') return;

    game.state = placeGomokuStone(
      game.state as GomokuGameState,
      member.id,
      parsed.data.row,
      parsed.data.col,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });
}
