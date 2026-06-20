import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  continueDwarfMineRound,
  discardDwarfMineCard,
  discardDwarfMineTwo,
  dwarfMineMapPeek,
  dwarfMineRolePeekContinue,
  passDwarfMineTurn,
  pickDwarfMineGold,
  playDwarfMineAction,
  playDwarfMinePath,
  skipDwarfMineSteal,
  stealDwarfMineGold,
  type DwarfMineGameState,
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

const pathSchema = z.object({
  cardId: z.string(),
  row: z.number().int().min(0).max(4),
  col: z.number().int().min(0).max(8),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});

const actionSchema = z.object({
  cardId: z.string(),
  targetPlayerId: z.string().uuid().optional(),
  collapseRow: z.number().int().optional(),
  collapseCol: z.number().int().optional(),
});

const discardSchema = z.object({ cardId: z.string() });
const discardTwoSchema = z.object({
  cardId1: z.string(),
  cardId2: z.string(),
  faceUpCardId: z.string().optional(),
});
const passSchema = z.object({ cardIds: z.array(z.string()).min(1).max(3) });
const goalSchema = z.object({ goalIndex: z.number().int().min(0).max(2) });
const goldSchema = z.object({ goldIndex: z.number().int().min(0) });
const stealSchema = z.object({ targetId: z.string().uuid() });

export function registerDwarfMineSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  async function updateGame(roomId: string, state: DwarfMineGameState, ended?: boolean) {
    const game = roomManager.getGame(roomId);
    if (!game) return;
    game.state = state;
    roomManager.touchGameRoom(roomId);
    const shouldEnd =
      ended || roomManager.isGameStateEnded(game.gameType, state);
    if (shouldEnd) {
      await roomManager.markGameEnded(roomId);
    }
    await afterGameUpdate(roomId, state, { perPlayerState: true });
  }

  async function getGameState(roomId: string, memberId: string) {
    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'dwarf_mine') return null;
    return { game, state: game.state as DwarfMineGameState, memberId };
  }

  socket.on('game:dwarf_mine:play_path', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false, message: '未加入房间' });
      return;
    }
    const parsed = pathSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) {
      cb?.({ ok: false, message: '不是房间成员' });
      return;
    }
    const ctx = await getGameState(roomId, member.id);
    if (!ctx) {
      cb?.({ ok: false, message: '游戏未开始' });
      return;
    }

    const next = playDwarfMinePath(
      ctx.state,
      member.id,
      parsed.data.cardId,
      parsed.data.row,
      parsed.data.col,
      parsed.data.rotation,
    );
    if (next === ctx.state) {
      cb?.({ ok: false, message: next.message });
      return;
    }
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:play_action', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = actionSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx) return;

    const next = playDwarfMineAction(
      ctx.state,
      member.id,
      parsed.data.cardId,
      parsed.data.targetPlayerId,
      parsed.data.collapseRow,
      parsed.data.collapseCol,
    );
    if (next === ctx.state) {
      cb?.({ ok: false, message: next.message });
      return;
    }
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:discard', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = discardSchema.safeParse(payload);
    if (!parsed.success) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx || ctx.state.mode !== 'base') {
      cb?.({ ok: false, message: '基本版才能单张弃牌' });
      return;
    }

    const next = discardDwarfMineCard(ctx.state, member.id, parsed.data.cardId);
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:discard_two', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = discardTwoSchema.safeParse(payload);
    if (!parsed.success) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx || ctx.state.mode !== 'expansion') {
      cb?.({ ok: false, message: '扩展版才能弃两张' });
      return;
    }

    const next = discardDwarfMineTwo(
      ctx.state,
      member.id,
      parsed.data.cardId1,
      parsed.data.cardId2,
      parsed.data.faceUpCardId,
    );
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:pass', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = passSchema.safeParse(payload);
    if (!parsed.success) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx || ctx.state.mode !== 'expansion') {
      cb?.({ ok: false, message: '扩展版才能 Pass' });
      return;
    }

    const next = passDwarfMineTurn(ctx.state, member.id, parsed.data.cardIds);
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:map_peek', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = goalSchema.safeParse(payload);
    if (!parsed.success) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx) return;

    const next = dwarfMineMapPeek(ctx.state, member.id, parsed.data.goalIndex);
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:role_peek_continue', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx) return;

    const next = dwarfMineRolePeekContinue(ctx.state, member.id);
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:pick_gold', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = goldSchema.safeParse(payload);
    if (!parsed.success) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx) return;

    const next = pickDwarfMineGold(ctx.state, member.id, parsed.data.goldIndex);
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:steal_gold', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = stealSchema.safeParse(payload);
    if (!parsed.success) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx || ctx.state.mode !== 'expansion') return;

    const next = stealDwarfMineGold(ctx.state, member.id, parsed.data.targetId);
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:skip_steal', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const ctx = await getGameState(roomId, member.id);
    if (!ctx) return;

    const next = skipDwarfMineSteal(ctx.state, member.id);
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:dwarf_mine:continue', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'dwarf_mine') return;

    const prev = game.state as DwarfMineGameState;
    if (prev.phase !== 'round_end') {
      cb?.({ ok: false });
      return;
    }

    const next = continueDwarfMineRound(prev);
    const ended = next.phase === 'ended';
    await updateGame(roomId, next, ended);
    cb?.({ ok: true });
  });
}
