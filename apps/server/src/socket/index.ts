import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { Database } from '@game-lobby/db';
import { verifyToken } from '../middleware/auth.js';
import type { RoomCloseReason, RoomManager } from '../services/room-manager.js';
import { projectGameState, type GameState, type UndercoverGameState } from '@game-lobby/game-engine';
import type { AiDifficulty, GameType } from '@game-lobby/shared';
import { ALL_GAME_TYPES, GAME_META, GAME_TYPE_ZOD_VALUES } from '@game-lobby/shared';
import { registerAllGameSockets } from '../games/registry.js';
import { startDrawGuessTimer } from '../games/draw-guess/socket.js';
import { startActGuessTimer } from '../games/act-guess/socket.js';
import { startGoTimer } from '../games/go/socket.js';
import { startChessTimer } from '../games/chess/socket.js';
import { startChineseChessTimer } from '../games/chinese-chess/socket.js';
import { resolveWordPool } from '../services/word-pack-service.js';
import { resolvePairPool } from '../services/word-pair-service.js';
import { getScriptForGame } from '../services/script-murder-service.js';
import { parsePairLines } from '@game-lobby/word-pairs';

const joinSchema = z.object({ roomId: z.string().uuid() });
const lobbySubscribeSchema = z.object({ gameType: z.enum(GAME_TYPE_ZOD_VALUES) });
const addBotSchema = z.object({ difficulty: z.enum(['easy', 'medium', 'hard', 'expert']) });
const removeMemberSchema = z.object({ memberId: z.string().uuid() });
const setRolesSchema = z.object({
  activePlayerIds: z.array(z.string().uuid()),
  spectatorIds: z.array(z.string().uuid()),
});
const startGameSchema = z
  .object({
    useJoker: z.boolean().optional(),
    assistMode: z.boolean().optional(),
    categoryIds: z.array(z.string()).optional(),
    userPackIds: z.array(z.string().uuid()).optional(),
    userPairPackIds: z.array(z.string().uuid()).optional(),
    roomExtraWords: z.array(z.string()).optional(),
    roomExtraPairs: z
      .array(z.tuple([z.string().min(1).max(32), z.string().min(1).max(32)]))
      .optional(),
    drawDurationSec: z.number().int().min(30).max(300).optional(),
    performDurationSec: z.number().int().min(30).max(300).optional(),
    wordSelectDurationSec: z.number().int().min(5).max(60).optional(),
    enableTeams: z.boolean().optional(),
    teamAssignments: z.record(z.enum(['A', 'B'])).optional(),
    useSpecialCards: z.boolean().optional(),
    rolePreset: z.enum(['simple_6', 'standard_9', 'classic_12', 'custom']).optional(),
    customRoles: z
      .array(
        z.enum(['werewolf', 'villager', 'seer', 'witch', 'hunter', 'guard', 'idiot']),
      )
      .optional(),
    discussionMode: z.enum(['free', 'sequential']).optional(),
    boardSize: z.union([z.literal(9), z.literal(13), z.literal(19)]).optional(),
    handicap: z.number().int().min(0).max(9).optional(),
    mainTimeSec: z.number().int().min(60).max(3600).optional(),
    byoyomiSec: z.number().int().min(5).max(120).optional(),
    byoyomiPeriods: z.number().int().min(0).max(10).optional(),
    incrementSec: z.number().int().min(0).max(60).optional(),
    scriptId: z.string().uuid().optional(),
    dwarfMineMode: z.enum(['base', 'expansion']).optional(),
    unlimitedTime: z.boolean().optional(),
  })
  .optional();

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

    const gameSocketDeps = {
      roomManager,
      io,
      getRoomId,
      findMember: (roomId: string, userId: string) => findMember(roomManager, roomId, userId),
      afterGameUpdate: async (
        roomId: string,
        state: unknown,
        options?: { perPlayerState?: boolean },
      ) => {
        if (options?.perPlayerState) {
          await emitGameState(io, roomManager, roomId);
        } else {
          const game = roomManager.getGame(roomId);
          if (game) {
            io.to(roomId).emit('game:state', { gameType: game.gameType, state });
          }
        }
        await emitRoomIfGameEnded(io, roomManager, roomId, state);
        await processBots(io, roomManager, roomId);
      },
    };

    registerAllGameSockets(socket, gameSocketDeps);

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
        io.to(kicked.socketId).emit('room:kicked', { roomId: kicked.roomId, reason: 'joined_other_room' });
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
        const member = detail.players.find((p) => p.userId === user.id);
        const meta = GAME_META[game.gameType];
        if (meta.requiresPerPlayerState) {
          socket.emit('game:state', {
            gameType: game.gameType,
            state: projectGameState(game.gameType, game.state, member?.id ?? null),
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
        cb?.({ ok: false, message: '无法添加电脑' });
        return;
      }
      if ('error' in detail) {
        cb?.({ ok: false, message: detail.error });
        return;
      }
      io.to(roomId).emit('room:updated', detail);
      cb?.({ ok: true, room: detail });
    });

    socket.on('room:remove-member', async (payload, cb) => {
      const parsed = removeMemberSchema.safeParse(payload);
      const roomId = getRoomId(socket);
      if (!parsed.success || !roomId) {
        cb?.({ ok: false });
        return;
      }

      const member = await findMember(roomManager, roomId, user.id);
      const result = await roomManager.removeMember(
        roomId,
        parsed.data.memberId,
        member?.id ?? '',
      );
      if (!result) {
        cb?.({ ok: false, message: '无法移除成员' });
        return;
      }
      if ('error' in result) {
        cb?.({ ok: false, message: result.error });
        return;
      }
      if (result.kickedSocketId) {
        io.to(result.kickedSocketId).emit('room:kicked', {
          roomId,
          reason: 'removed_by_host',
        });
      }
      io.to(roomId).emit('room:updated', result.detail);
      cb?.({ ok: true, room: result.detail });
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

      const detail = await roomManager.getRoomDetail(roomId);
      const hostMember = detail?.players.find((p) => p.userId === user.id && p.role === 'host');
      if (!hostMember) {
        cb?.({ ok: false, message: '仅房主可开始游戏' });
        return;
      }

      const parsedStart = startGameSchema.safeParse(payload);
      const gameType = detail!.gameType;
      let startOptions: Record<string, unknown> = {};

      if (gameType === 'da_vinci_code') {
        startOptions = {
          useJoker: parsedStart.success ? (parsedStart.data?.useJoker ?? false) : false,
          assistMode: parsedStart.success ? (parsedStart.data?.assistMode ?? true) : true,
        };
      } else if (gameType === 'undercover') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        const categoryIds = data?.categoryIds ?? ['food', 'sport', 'entertainment', 'transport', 'life', 'animal', 'nature', 'jobs', 'places', 'daily'];
        const userPairPackIds = data?.userPairPackIds ?? [];
        const roomExtraPairs =
          data?.roomExtraPairs ??
          (data?.roomExtraWords ? parsePairLines(data.roomExtraWords.join('\n')) : []);
        const pairPool = await resolvePairPool(db, {
          categoryIds,
          userPairPackIds,
          roomExtraPairs,
        });
        if (pairPool.length < 1) {
          cb?.({ ok: false, message: '词对池不足，请至少选择包含 1 组词对的分类或词库' });
          return;
        }
        startOptions = {
          categoryIds,
          userPairPackIds,
          roomExtraPairs,
          pairPool,
        };
      } else if (gameType === 'draw_guess') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        const categoryIds = data?.categoryIds ?? ['animal', 'daily', 'movie', 'sport'];
        const userPackIds = data?.userPackIds ?? [];
        const roomExtraWords = data?.roomExtraWords ?? [];
        const wordPool = await resolveWordPool(db, {
          categoryIds,
          userPackIds,
          roomExtraWords,
        });
        if (wordPool.length < 3) {
          cb?.({ ok: false, message: '词语池不足，请至少选择包含 3 个词的分类或词库' });
          return;
        }
        startOptions = {
          categoryIds,
          userPackIds,
          roomExtraWords,
          drawDurationSec: data?.drawDurationSec ?? 90,
          wordSelectDurationSec: data?.wordSelectDurationSec ?? 10,
          wordPool,
          allPlayers: detail!.players.map((p) => ({
            id: p.id,
            name: p.displayName,
            isSpectator: p.role === 'spectator',
          })),
        };
      } else if (gameType === 'act_guess') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        const categoryIds = data?.categoryIds ?? ['animal', 'daily', 'movie', 'sport'];
        const userPackIds = data?.userPackIds ?? [];
        const roomExtraWords = data?.roomExtraWords ?? [];
        const wordPool = await resolveWordPool(db, {
          categoryIds,
          userPackIds,
          roomExtraWords,
        });
        if (wordPool.length < 3) {
          cb?.({ ok: false, message: '词语池不足，请至少选择包含 3 个词的分类或词库' });
          return;
        }

        const enableTeams = data?.enableTeams ?? false;
        const activePlayers = detail!.players.filter((p) => p.role !== 'spectator');
        let teamAssignments = data?.teamAssignments;

        if (enableTeams) {
          if (activePlayers.length < 4) {
            cb?.({ ok: false, message: '分队模式至少需要 4 名玩家' });
            return;
          }
          if (!teamAssignments) {
            cb?.({ ok: false, message: '请为所有玩家分配队伍' });
            return;
          }
          const teamA = activePlayers.filter((p) => teamAssignments![p.id] === 'A');
          const teamB = activePlayers.filter((p) => teamAssignments![p.id] === 'B');
          const unassigned = activePlayers.filter((p) => !teamAssignments![p.id]);
          if (unassigned.length > 0) {
            cb?.({ ok: false, message: '请为所有玩家分配队伍' });
            return;
          }
          if (teamA.length < 1 || teamB.length < 1) {
            cb?.({ ok: false, message: '每队至少需要 1 名玩家' });
            return;
          }
        }

        startOptions = {
          categoryIds,
          userPackIds,
          roomExtraWords,
          performDurationSec: data?.performDurationSec ?? 60,
          wordSelectDurationSec: data?.wordSelectDurationSec ?? 10,
          wordPool,
          enableTeams,
          teamAssignments: enableTeams ? teamAssignments : undefined,
          allPlayers: detail!.players.map((p) => ({
            id: p.id,
            name: p.displayName,
            isSpectator: p.role === 'spectator',
          })),
        };
      } else if (gameType === 'german_heart_attack') {
        startOptions = {
          useSpecialCards: parsedStart.success
            ? (parsedStart.data?.useSpecialCards ?? false)
            : false,
        };
      } else if (gameType === 'werewolf') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        startOptions = {
          rolePreset: data?.rolePreset ?? 'simple_6',
          customRoles: data?.customRoles,
          discussionMode: data?.discussionMode ?? 'sequential',
        };
      } else if (gameType === 'go') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        startOptions = {
          boardSize: data?.boardSize ?? 19,
          handicap: data?.handicap ?? 0,
          mainTimeSec: data?.mainTimeSec ?? 600,
          byoyomiSec: data?.byoyomiSec ?? 30,
          byoyomiPeriods: data?.byoyomiPeriods ?? 3,
        };
      } else if (gameType === 'chess') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        startOptions = {
          mainTimeSec: data?.mainTimeSec ?? 600,
          incrementSec: data?.incrementSec ?? 5,
        };
      } else if (gameType === 'script_murder') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        const scriptId = data?.scriptId;
        if (!scriptId) {
          cb?.({ ok: false, message: '请先选择剧本' });
          return;
        }
        const script = await getScriptForGame(db, scriptId, user.id);
        if (!script) {
          cb?.({ ok: false, message: '剧本不存在或无权使用' });
          return;
        }
        const activeCount = detail!.players.filter(
          (p) => p.role === 'host' || p.role === 'player',
        ).length;
        if (script.content.characters.length !== activeCount) {
          cb?.({
            ok: false,
            message: `该剧本需要 ${script.content.characters.length} 名玩家，当前 ${activeCount} 名`,
          });
          return;
        }
        startOptions = {
          scriptId: script.id,
          scriptTitle: script.title,
          script: script.content,
          hostMemberId: hostMember.id,
        };
      } else if (gameType === 'dwarf_mine') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        startOptions = {
          mode: data?.dwarfMineMode ?? 'base',
        };
      } else if (gameType === 'chinese_chess') {
        const data = parsedStart.success ? parsedStart.data : undefined;
        startOptions = {
          mainTimeSec: data?.mainTimeSec ?? 600,
          incrementSec: data?.incrementSec ?? 5,
          unlimitedTime: data?.unlimitedTime ?? false,
        };
      }

      const result = await roomManager.startNextGame(roomId, hostMember.id, startOptions);
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

  startDrawGuessTimer(
    io,
    roomManager,
    (roomId) => emitGameState(io, roomManager, roomId),
    (roomId, state) => emitRoomIfGameEnded(io, roomManager, roomId, state),
  );
  startActGuessTimer(
    io,
    roomManager,
    (roomId) => emitGameState(io, roomManager, roomId),
    (roomId, state) => emitRoomIfGameEnded(io, roomManager, roomId, state),
  );
  startGoTimer(
    io,
    roomManager,
    (roomId) => emitGameState(io, roomManager, roomId),
    (roomId, state) => emitRoomIfGameEnded(io, roomManager, roomId, state),
  );
  startChessTimer(
    io,
    roomManager,
    (roomId) => emitGameState(io, roomManager, roomId),
    (roomId, state) => emitRoomIfGameEnded(io, roomManager, roomId, state),
  );
  startChineseChessTimer(
    io,
    roomManager,
    (roomId) => emitGameState(io, roomManager, roomId),
    (roomId, state) => emitRoomIfGameEnded(io, roomManager, roomId, state),
  );
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
  const game = roomManager.getGame(roomId);
  if (!game) return;

  const ended = roomManager.isGameStateEnded(game.gameType, state as GameState);
  const finalReveal =
    game.gameType === 'undercover' &&
    (state as UndercoverGameState).phase === 'reveal' &&
    (state as UndercoverGameState).gameContinues === false;

  if (!ended && !finalReveal) return;

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

  const meta = GAME_META[game.gameType];
  if (meta.requiresPerPlayerState) {
    const detail = await roomManager.getRoomDetail(roomId);
    const sockets = await io.in(roomId).fetchSockets();
    for (const s of sockets) {
      const u = s.data.user as { id: string } | undefined;
      const member = detail?.players.find((p) => p.userId === u?.id);
      s.emit('game:state', {
        gameType: game.gameType,
        state: projectGameState(game.gameType, game.state, member?.id ?? null),
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
