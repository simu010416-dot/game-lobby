import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  advanceFromMissionReveal,
  proposeTeam,
  sendEvilChat,
  submitAssassination,
  submitLadyPick,
  submitMissionCard,
  submitTeamVote,
  type AvalonGameState,
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

const speechSchema = z.object({ text: z.string().min(1).max(200) });
const targetSchema = z.object({ targetId: z.string().uuid() });
const teamSchema = z.object({ memberIds: z.array(z.string().uuid()).min(1).max(6) });
const teamVoteSchema = z.object({ approve: z.boolean() });
const missionSchema = z.object({ success: z.boolean() });

export function registerAvalonSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  async function updateGame(roomId: string, state: AvalonGameState) {
    const game = roomManager.getGame(roomId);
    if (!game) return;

    game.state = state;
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, state)) {
      await roomManager.markGameEnded(roomId);
    }
    await afterGameUpdate(roomId, state, { perPlayerState: true });
  }

  async function withMember(
    cb: (roomId: string, memberId: string) => Promise<void>,
  ) {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'avalon') return;
    await cb(roomId, member.id);
  }

  function applyReducer(
    roomId: string,
    reducer: (prev: AvalonGameState, memberId: string) => AvalonGameState,
    memberId: string,
  ) {
    const game = roomManager.getGame(roomId);
    if (!game) return;
    const prev = game.state as AvalonGameState;
    const next = reducer(prev, memberId);
    if (next === prev) return;
    return updateGame(roomId, next);
  }

  socket.on('game:avalon:propose_team', async (payload, cb) => {
    const parsed = teamSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => proposeTeam(prev, id, parsed.data.memberIds),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:avalon:team_vote', async (payload, cb) => {
    const parsed = teamVoteSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => submitTeamVote(prev, id, parsed.data.approve),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:avalon:mission_card', async (payload, cb) => {
    const parsed = missionSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => submitMissionCard(prev, id, parsed.data.success),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:avalon:continue', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'avalon') return;
    const prev = game.state as AvalonGameState;
    if (prev.phase !== 'mission_reveal') {
      cb?.({ ok: false });
      return;
    }
    await updateGame(roomId, advanceFromMissionReveal(prev));
    cb?.({ ok: true });
  });

  socket.on('game:avalon:lady_pick', async (payload, cb) => {
    const parsed = targetSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => submitLadyPick(prev, id, parsed.data.targetId),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:avalon:assassinate', async (payload, cb) => {
    const parsed = targetSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => submitAssassination(prev, id, parsed.data.targetId),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:avalon:evil_chat', async (payload, cb) => {
    const parsed = speechSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => sendEvilChat(prev, id, parsed.data.text),
        memberId,
      );
      cb?.({ ok: true });
    });
  });
}
