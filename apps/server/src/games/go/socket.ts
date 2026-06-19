import type { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  passGoTurn,
  playGoStone,
  resignGoGame,
  tickGoGame,
  type GoGameState,
} from '@game-lobby/game-engine';

const goPlaySchema = z.object({
  x: z.number().int().min(0).max(18),
  y: z.number().int().min(0).max(18),
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

export function registerGoSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  socket.on('game:go:play', async (payload, cb) => {
    const parsed = goPlaySchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'go') return;

    game.state = playGoStone(
      game.state as GoGameState,
      member.id,
      parsed.data.x,
      parsed.data.y,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });

  socket.on('game:go:pass', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'go') return;

    game.state = passGoTurn(game.state as GoGameState, member.id);
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });

  socket.on('game:go:resign', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'go') return;

    game.state = resignGoGame(game.state as GoGameState, member.id);
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });
}

let timerStarted = false;

export function startGoTimer(
  io: Server,
  roomManager: RoomManager,
  emitGameState: (roomId: string) => Promise<void>,
  emitRoomIfGameEnded: (roomId: string, state: unknown) => Promise<void>,
) {
  if (timerStarted) return;
  timerStarted = true;

  setInterval(async () => {
    const now = Date.now();
    for (const [roomId, game] of roomManager.getActiveGameEntries()) {
      if (game.gameType !== 'go') continue;
      const before = JSON.stringify(game.state);
      game.state = tickGoGame(game.state as GoGameState, now);
      if (JSON.stringify(game.state) === before) continue;

      roomManager.touchGameRoom(roomId);
      if (roomManager.isGameStateEnded(game.gameType, game.state)) {
        await roomManager.markGameEnded(roomId);
      }
      await emitGameState(roomId);
      await emitRoomIfGameEnded(roomId, game.state);
    }
  }, 1000);
}
