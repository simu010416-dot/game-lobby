import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { Database } from '@game-lobby/db';
import { verifyToken } from '../middleware/auth.js';
import type { RoomCloseReason, RoomManager } from '../services/room-manager.js';
import { redactDaVinciState, type DaVinciGameState } from '@game-lobby/game-engine';
import type { AiDifficulty, GameType } from '@game-lobby/shared';
import { ALL_GAME_TYPES } from '@game-lobby/shared';

const joinSchema = z.object({ roomId: z.string().uuid() });
const lobbySubscribeSchema = z.object({ gameType: z.enum(['undercover', 'da_vinci_code']) });
const addBotSchema = z.object({ difficulty: z.enum(['easy', 'medium', 'hard', 'expert']) });
const setRolesSchema = z.object({
  activePlayerIds: z.array(z.string().uuid()),
  spectatorIds: z.array(z.string().uuid()),
});
const davinciGuessSchema = z.object({
  targetPlayerId: z.string(),
  tileIndex: z.number().int().min(0),
  value: z.number().int().min(0).max(12),
});
const davinciDecisionSchema = z.object({ continue: z.boolean() });
const davinciPlaceSchema = z.object({ index: z.number().int().min(0) });
const davinciSetupSchema = z.object({
  tiles: z.array(
    z.object({
      color: z.enum(['black', 'white']),
      value: z.number().int().min(0).max(12),
      isJoker: z.boolean(),
    }),
  ),
});
const startGameSchema = z.object({ useJoker: z.boolean().optional() }).optional();

export function setupSocketHandlers(io: Server, db: Database, roomManager: RoomManager) {
  roomManager.setRoomClosedListener(async (roomId, reason) => {
    io.to(roomId).emit('room:closed', { roomId, reason, message: roomCloseMessage(reason) });
    await broadcastLobbyRooms(io, roomManager);
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

    socket.on('lobby:subscribe', async (payload) => {
      const parsed = lobbySubscribeSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return;
      }
      socket.data.lobbyGameType = parsed.data.gameType;
      const rooms = await roomManager.listRooms(parsed.data.gameType);
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

      await broadcastLobbyRooms(io, roomManager, detail.gameType);
      cb?.({ ok: true, room: detail });
    });

    socket.on('room:leave', async () => {
      const roomId = getRoomId(socket);
      const left = await roomManager.leaveRoom(socket.id);
      if (left) {
        socket.leave(left.roomId);
        if (left.deleted) {
          io.to(left.roomId).emit('room:closed', { roomId: left.roomId });
        } else {
          const detail = await roomManager.getRoomDetail(left.roomId);
          if (detail) io.to(left.roomId).emit('room:updated', detail);
        }
        const detail = roomId ? await roomManager.getRoomDetail(roomId) : null;
        await broadcastLobbyRooms(io, roomManager, detail?.gameType);
      }
    });

    socket.on('room:close', async (_payload, cb) => {
      const roomId = getRoomId(socket);
      if (!roomId) {
        cb?.({ ok: false, message: '未加入房间' });
        return;
      }

      const detailBefore = await roomManager.getRoomDetail(roomId);
      const member = await findMember(roomManager, roomId, user.id);
      const ok = await roomManager.closeRoom(roomId, member?.id ?? '');
      if (!ok) {
        cb?.({ ok: false, message: '仅房主可关闭房间' });
        return;
      }

      io.to(roomId).emit('room:closed', { roomId });
      await broadcastLobbyRooms(io, roomManager, detailBefore?.gameType);
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
      if ('error' in detail) {
        cb?.({ ok: false, message: detail.error });
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
      if ('error' in detail) {
        cb?.({ ok: false, message: detail.error });
        return;
      }
      io.to(roomId).emit('room:updated', detail);
      cb?.({ ok: true, room: detail });
    });

    socket.on('game:start', async (payload, cb) => {
      const roomId = getRoomId(socket);
      if (!roomId) {
        cb?.({ ok: false, message: '未加入房间' });
        return;
      }

      const parsedStart = startGameSchema.safeParse(payload);
      const useJoker = parsedStart.success ? parsedStart.data?.useJoker ?? false : false;

      const detail = await roomManager.getRoomDetail(roomId);
      const hostMember = detail?.players.find((p) => p.userId === user.id && p.role === 'host');
      if (!hostMember) {
        cb?.({ ok: false, message: '仅房主可开始游戏' });
        return;
      }

      const result = await roomManager.startNextGame(roomId, hostMember.id, { useJoker });
      if (!result.ok) {
        cb?.({ ok: false, message: result.message });
        return;
      }

      io.to(roomId).emit('room:updated', result.detail);
      await emitGameState(io, roomManager, roomId);

      await processBots(io, roomManager, roomId);
      await broadcastLobbyRooms(io, roomManager, result.detail.gameType);
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
      await emitRoomIfGameEnded(io, roomManager, roomId, game.state);
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
      await emitRoomIfGameEnded(io, roomManager, roomId, game.state);
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
      await emitRoomIfGameEnded(io, roomManager, roomId, game.state);
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
      await emitRoomIfGameEnded(io, roomManager, roomId, game.state);
      await processBots(io, roomManager, roomId);
      cb?.({ ok: true });
    });

    socket.on('game:davinci:place', async (payload, cb) => {
      const parsed = davinciPlaceSchema.safeParse(payload);
      const roomId = getRoomId(socket);
      if (!parsed.success || !roomId) {
        cb?.({ ok: false });
        return;
      }
      const member = await findMember(roomManager, roomId, user.id);
      if (!member) return;

      const game = await roomManager.processDaVinciPlace(roomId, member.id, parsed.data.index);
      if (!game) return;

      await emitGameState(io, roomManager, roomId);
      await emitRoomIfGameEnded(io, roomManager, roomId, game.state);
      await processBots(io, roomManager, roomId);
      cb?.({ ok: true });
    });

    socket.on('game:davinci:setup', async (payload, cb) => {
      const parsed = davinciSetupSchema.safeParse(payload);
      const roomId = getRoomId(socket);
      if (!parsed.success || !roomId) {
        cb?.({ ok: false });
        return;
      }
      const member = await findMember(roomManager, roomId, user.id);
      if (!member) return;

      const game = await roomManager.processDaVinciSetup(roomId, member.id, parsed.data.tiles);
      if (!game) return;

      await emitGameState(io, roomManager, roomId);
      await processBots(io, roomManager, roomId);
      cb?.({ ok: true });
    });

    socket.on('disconnect', async () => {
      const roomId = getRoomId(socket);
      const left = await roomManager.leaveRoom(socket.id);
      if (left) {
        if (left.deleted) {
          io.to(left.roomId).emit('room:closed', { roomId: left.roomId });
        } else {
          const detail = await roomManager.getRoomDetail(left.roomId);
          if (detail) io.to(left.roomId).emit('room:updated', detail);
        }
        const detail = roomId ? await roomManager.getRoomDetail(roomId) : null;
        await broadcastLobbyRooms(io, roomManager, detail?.gameType);
      }
    });
  });
}

async function broadcastLobbyRooms(io: Server, roomManager: RoomManager, gameType?: GameType) {
  const targets = gameType ? [gameType] : ALL_GAME_TYPES;
  const sockets = await io.fetchSockets();
  for (const gt of targets) {
    const rooms = await roomManager.listRooms(gt);
    for (const s of sockets) {
      if (s.data.lobbyGameType === gt) {
        s.emit('lobby:rooms', rooms);
      }
    }
  }
}

async function emitRoomIfGameEnded(
  io: Server,
  roomManager: RoomManager,
  roomId: string,
  state: unknown,
) {
  if ((state as { phase?: string }).phase !== 'ended') return;
  const detail = await roomManager.getRoomDetail(roomId);
  if (detail) {
    io.to(roomId).emit('room:updated', detail);
    await broadcastLobbyRooms(io, roomManager, detail.gameType);
  }
}

function roomCloseMessage(reason: RoomCloseReason): string {
  switch (reason) {
    case 'idle':
      return '房间长时间未开始游戏，已自动关闭';
    case 'stale':
      return '游戏长时间无响应，已自动关闭';
    default:
      return '房间已关闭';
  }
}

function getRoomId(socket: Socket): string | null {
  const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
  return rooms[0] ?? null;
}

async function findMember(roomManager: RoomManager, roomId: string, userId: string) {
  const detail = await roomManager.getRoomDetail(roomId);
  return detail?.players.find((p) => p.userId === userId);
}

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
    const beforeJson = JSON.stringify(roomManager.getGame(roomId)?.state);
    const after = await roomManager.runBotTurns(roomId);
    if (!after) break;
    const afterJson = JSON.stringify(after.state);
    if (beforeJson === afterJson) break;
    await emitGameState(io, roomManager, roomId);
    await emitRoomIfGameEnded(io, roomManager, roomId, after.state);
    safety++;
  }
}
