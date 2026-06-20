import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  applyChineseChessMove,
  resignChineseChessGame,
  offerChineseChessDraw,
  respondChineseChessDraw,
  tickChineseChessGame,
  type ChineseChessGameState,
} from '@game-lobby/game-engine';

const squareSchema = z.string().regex(/^[a-i][0-9]$/);

const xiangqiMoveSchema = z.object({
  from: squareSchema,
  to: squareSchema,
});

const drawResponseSchema = z.object({
  accept: z.boolean(),
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

export function registerChineseChessSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  socket.on('game:xiangqi:move', async (payload, cb) => {
    const parsed = xiangqiMoveSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'chinese_chess') return;

    game.state = applyChineseChessMove(
      game.state as ChineseChessGameState,
      member.id,
      parsed.data.from,
      parsed.data.to,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });

  socket.on('game:xiangqi:resign', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'chinese_chess') return;

    game.state = resignChineseChessGame(game.state as ChineseChessGameState, member.id);
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });

  socket.on('game:xiangqi:offer_draw', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'chinese_chess') return;

    game.state = offerChineseChessDraw(game.state as ChineseChessGameState, member.id);
    roomManager.touchGameRoom(roomId);
    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });

  socket.on('game:xiangqi:respond_draw', async (payload, cb) => {
    const parsed = drawResponseSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'chinese_chess') return;

    game.state = respondChineseChessDraw(
      game.state as ChineseChessGameState,
      member.id,
      parsed.data.accept,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });
}

let timerStarted = false;

export function startChineseChessTimer(
  io: import('socket.io').Server,
  roomManager: RoomManager,
  emitGameState: (roomId: string) => Promise<void>,
  emitRoomIfGameEnded: (roomId: string, state: unknown) => Promise<void>,
) {
  if (timerStarted) return;
  timerStarted = true;

  setInterval(async () => {
    const now = Date.now();
    for (const [roomId, game] of roomManager.getActiveGameEntries()) {
      if (game.gameType !== 'chinese_chess') continue;
      const before = JSON.stringify(game.state);
      game.state = tickChineseChessGame(game.state as ChineseChessGameState, now);
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
