import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { Database } from '@game-lobby/db';
import { verifyToken } from '../middleware/auth.js';
import type { RoomManager } from '../services/room-manager.js';
import { redactDaVinciState, type DaVinciGameState } from '@game-lobby/game-engine';
import type { AiDifficulty, GameQueueItem, GameQueueMode } from '@game-lobby/shared';

const joinSchema = z.object({ roomId: z.string().uuid() });
const addBotSchema = z.object({ difficulty: z.enum(['easy', 'medium', 'hard', 'expert']) });
const updateQueueSchema = z.object({
  queue: z.array(z.object({ gameType: z.enum(['undercover', 'da_vinci_code']), order: z.number() })),
  mode: z.enum(['ordered', 'random']),
});
const setRolesSchema = z.object({
  activePlayerIds: z.array(z.string().uuid()),
  spectatorIds: z.array(z.string().uuid()),
});
const davinciGuessSchema = z.object({
  targetPlayerId: z.string(),
  tileIndex: z.number().int().min(0),
  value: z.number().int().min(0).max(11),
});
const davinciDecisionSchema = z.object({ continue: z.boolean() });

export function setupSocketHandlers(io: Server, db: Database, roomManager: RoomManager) {
  // Notify clients (and refresh the lobby) when an empty room is auto-closed.
  roomManager.setRoomClosedListener(async (roomId) => {
    io.to(roomId).emit('room:closed', { roomId });
    const lobbyRooms = await roomManager.listRooms();
    io.emit('lobby:rooms', lobbyRooms);
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error('未授权'));
      return;
    }
    const user = verifyToken(token);
    if (!user) {
      next(new Error('登录已过期'));
      return;
    }
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as {
      id: string;
      username: string;
      displayName: string;
    };

    socket.on('lobby:subscribe', async () => {
      const rooms = await roomManager.listRooms();
      socket.emit('lobby:rooms', rooms);
    });

    socket.on('room:join', async (payload, cb) => {
      const parsed = joinSchema.safeParse(payload);
      if (!parsed.success) {
        cb?.({ ok: false, message: '参数无效' });
        return;
      }

      const result = await roomManager.joinRoom(parsed.data.roomId, user, socket.id);
      if (!result) {
        cb?.({ ok: false, message: '房间不存在' });
        return;
      }

      const { detail, leftRooms, kickedSockets } = result;
      socket.join(parsed.data.roomId);
      io.to(parsed.data.roomId).emit('room:updated', detail);

      // Redirect any other connected sessions of this user out of their old room.
      for (const kicked of kickedSockets) {
        if (kicked.socketId === socket.id) continue;
        io.to(kicked.socketId).emit('room:kicked', { roomId: kicked.roomId });
      }

      for (const left of leftRooms) {
        if (left.deleted) {
          io.to(left.roomId).emit('room:closed', { roomId: left.roomId });
        } else {
          const leftDetail = await roomManager.getRoomDetail(left.roomId);
          if (leftDetail) io.to(left.roomId).emit('room:updated', leftDetail);
        }
      }

      const game = roomManager.getGame(parsed.data.roomId);
      if (game) {
        if (game.gameType === 'da_vinci_code') {
          const member = detail.players.find((p) => p.userId === user.id);
          socket.emit('game:state', {
            gameType: game.gameType,
            state: redactDaVinciState(game.state as DaVinciGameState, member?.id ?? null),
          });
        } else {
          socket.emit('game:state', {
            gameType: game.gameType,
            state: game.state,
          });
        }
      }

      const lobbyRooms = await roomManager.listRooms();
      io.emit('lobby:rooms', lobbyRooms);
      cb?.({ ok: true, room: detail });
    });

    socket.on('room:leave', async () => {
      const left = await roomManager.leaveRoom(socket.id);
      if (left) {
        socket.leave(left.roomId);
        if (left.deleted) {
          io.to(left.roomId).emit('room:closed', { roomId: left.roomId });
        } else {
          const detail = await roomManager.getRoomDetail(left.roomId);
          if (detail) io.to(left.roomId).emit('room:updated', detail);
        }
        const lobbyRooms = await roomManager.listRooms();
        io.emit('lobby:rooms', lobbyRooms);
      }
    });

    socket.on('room:close', async (_payload, cb) => {
      const roomId = getRoomId(socket);
      if (!roomId) {
        cb?.({ ok: false, message: '未加入房间' });
        return;
      }

      const member = await findMember(roomManager, roomId, user.id);
      const ok = await roomManager.closeRoom(roomId, member?.id ?? '');
      if (!ok) {
        cb?.({ ok: false, message: '仅房主可关闭房间' });
        return;
      }

      io.to(roomId).emit('room:closed', { roomId });
      const lobbyRooms = await roomManager.listRooms();
      io.emit('lobby:rooms', lobbyRooms);
      cb?.({ ok: true });
    });

    socket.on('room:add-bot', async (payload, cb) => {
      const parsed = addBotSchema.safeParse(payload);
      const roomId = getRoomId(socket);
      if (!parsed.success || !roomId) {
        cb?.({ ok: false });
        return;
      }

      const member = await findMember(roomManager, roomId, user.id);
      const detail = await roomManager.addBot(roomId, parsed.data.difficulty as AiDifficulty, member?.id ?? '');
      if (!detail) {
        cb?.({ ok: false });
        return;
      }
      io.to(roomId).emit('room:updated', detail);
      cb?.({ ok: true, room: detail });
    });

    socket.on('room:update-queue', async (payload, cb) => {
      const parsed = updateQueueSchema.safeParse(payload);
      const roomId = getRoomId(socket);
      if (!parsed.success || !roomId) {
        cb?.({ ok: false });
        return;
      }

      const member = await findMember(roomManager, roomId, user.id);
      const detail = await roomManager.updateQueue(
        roomId,
        parsed.data.queue as GameQueueItem[],
        parsed.data.mode as GameQueueMode,
        member?.id ?? '',
      );
      if (!detail) {
        cb?.({ ok: false });
        return;
      }
      io.to(roomId).emit('room:updated', detail);
      cb?.({ ok: true, room: detail });
    });

    socket.on('room:set-roles', async (payload, cb) => {
      const parsed = setRolesSchema.safeParse(payload);
      const roomId = getRoomId(socket);
      if (!parsed.success || !roomId) {
        cb?.({ ok: false });
        return;
      }

      const member = await findMember(roomManager, roomId, user.id);
      const detail = await roomManager.setParticipantRoles(
        roomId,
        parsed.data.activePlayerIds,
        parsed.data.spectatorIds,
        member?.id ?? '',
      );
      if (!detail) {
        cb?.({ ok: false });
        return;
      }
      io.to(roomId).emit('room:updated', detail);
      cb?.({ ok: true, room: detail });
    });

    socket.on('game:start', async (_payload, cb) => {
      const roomId = getRoomId(socket);
      if (!roomId) {
        cb?.({ ok: false, message: '未加入房间' });
        return;
      }

      const detail = await roomManager.getRoomDetail(roomId);
      const hostMember = detail?.players.find((p) => p.userId === user.id && p.role === 'host');
      if (!hostMember) {
        cb?.({ ok: false, message: '仅房主可开始游戏' });
        return;
      }

      const result = await roomManager.startNextGame(roomId, hostMember.id);
      if (!result.ok) {
        cb?.({ ok: false, message: result.message });
        return;
      }

      io.to(roomId).emit('room:updated', result.detail);
      await emitGameState(io, roomManager, roomId);

      await processBots(io, roomManager, roomId);
      const lobbyRooms = await roomManager.listRooms();
      io.emit('lobby:rooms', lobbyRooms);
      cb?.({ ok: true });
    });

    socket.on('game:undercover:describe', async (payload, cb) => {
      const roomId = getRoomId(socket);
      if (!roomId) return;
      const member = await findMember(roomManager, roomId, user.id);
      if (!member) return;

      const game = await roomManager.processUndercoverDescribe(roomId, member.id, payload.description);
      if (!game) return;

      io.to(roomId).emit('game:state', { gameType: game.gameType, state: game.state });
      await processBots(io, roomManager, roomId);
      cb?.({ ok: true });
    });

    socket.on('game:undercover:vote', async (payload, cb) => {
      const roomId = getRoomId(socket);
      if (!roomId) return;
      const member = await findMember(roomManager, roomId, user.id);
      if (!member) return;

      const game = await roomManager.processUndercoverVote(roomId, member.id, payload.targetId);
      if (!game) return;

      io.to(roomId).emit('game:state', { gameType: game.gameType, state: game.state });
      await processBots(io, roomManager, roomId);
      cb?.({ ok: true });
    });

    socket.on('game:davinci:guess', async (payload, cb) => {
      const parsed = davinciGuessSchema.safeParse(payload);
      const roomId = getRoomId(socket);
      if (!parsed.success || !roomId) {
        cb?.({ ok: false });
        return;
      }
      const member = await findMember(roomManager, roomId, user.id);
      if (!member) return;

      const game = await roomManager.processDaVinciGuess(
        roomId,
        member.id,
        parsed.data.targetPlayerId,
        parsed.data.tileIndex,
        parsed.data.value,
      );
      if (!game) return;

      await emitGameState(io, roomManager, roomId);
      await processBots(io, roomManager, roomId);
      cb?.({ ok: true });
    });

    socket.on('game:davinci:decision', async (payload, cb) => {
      const parsed = davinciDecisionSchema.safeParse(payload);
      const roomId = getRoomId(socket);
      if (!parsed.success || !roomId) {
        cb?.({ ok: false });
        return;
      }
      const member = await findMember(roomManager, roomId, user.id);
      if (!member) return;

      const game = await roomManager.processDaVinciDecision(roomId, member.id, parsed.data.continue);
      if (!game) return;

      await emitGameState(io, roomManager, roomId);
      await processBots(io, roomManager, roomId);
      cb?.({ ok: true });
    });

    socket.on('disconnect', async () => {
      const left = await roomManager.leaveRoom(socket.id);
      if (left) {
        if (left.deleted) {
          io.to(left.roomId).emit('room:closed', { roomId: left.roomId });
        } else {
          const detail = await roomManager.getRoomDetail(left.roomId);
          if (detail) io.to(left.roomId).emit('room:updated', detail);
        }
        const lobbyRooms = await roomManager.listRooms();
        io.emit('lobby:rooms', lobbyRooms);
      }
    });
  });
}

function getRoomId(socket: Socket): string | null {
  const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
  return rooms[0] ?? null;
}

async function findMember(roomManager: RoomManager, roomId: string, userId: string) {
  const detail = await roomManager.getRoomDetail(roomId);
  return detail?.players.find((p) => p.userId === userId);
}

// Broadcasts the current game state to everyone in the room. For games with
// hidden information (Da Vinci Code) each socket receives a personalized,
// redacted view so opponents' secret tiles never leave the server.
async function emitGameState(io: Server, roomManager: RoomManager, roomId: string) {
  const game = roomManager.getGame(roomId);
  if (!game) return;

  if (game.gameType === 'da_vinci_code') {
    const detail = await roomManager.getRoomDetail(roomId);
    const sockets = await io.in(roomId).fetchSockets();
    for (const s of sockets) {
      const u = s.data.user as { id: string } | undefined;
      const member = detail?.players.find((p) => p.userId === u?.id);
      s.emit('game:state', {
        gameType: game.gameType,
        state: redactDaVinciState(game.state as DaVinciGameState, member?.id ?? null),
      });
    }
    return;
  }

  io.to(roomId).emit('game:state', { gameType: game.gameType, state: game.state });
}

async function processBots(io: Server, roomManager: RoomManager, roomId: string) {
  let safety = 0;
  while (safety < 50) {
    // Snapshot the state BEFORE running bot turns. runBotTurns mutates the same
    // in-memory game object, so we must serialize the previous state up front to
    // detect whether any progress was actually made this iteration.
    const beforeJson = JSON.stringify(roomManager.getGame(roomId)?.state);
    const after = await roomManager.runBotTurns(roomId);
    if (!after) break;
    const afterJson = JSON.stringify(after.state);
    if (beforeJson === afterJson) break;
    await emitGameState(io, roomManager, roomId);
    safety++;
  }
}
