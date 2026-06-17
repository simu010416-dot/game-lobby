import { eq, asc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { rooms, roomMembers, type Database } from '@game-lobby/db';
import type { AiDifficulty, GameType, RoomDetail, RoomPlayer, RoomSummary } from '@game-lobby/shared';
import { GAME_META } from '@game-lobby/shared';
import {
  createGame,
  getGameModule,
  type GameStartOptions,
  type GameState,
} from '@game-lobby/game-engine';

interface InMemoryGame {
  sessionId: string;
  gameType: GameType;
  state: GameState;
  activePlayerIds: string[];
}

export type RoomCloseReason = 'empty' | 'idle' | 'stale';

export class RoomManager {
  private games = new Map<string, InMemoryGame>();
  private socketToMember = new Map<string, { roomId: string; memberId: string }>();
  private locks = new Map<string, Promise<unknown>>();
  private pendingClose = new Map<string, NodeJS.Timeout>();
  private roomActivity = new Map<string, number>();
  private sweeper?: NodeJS.Timeout;
  private onRoomClosed?: (roomId: string, reason: RoomCloseReason) => void;
  private static readonly EMPTY_ROOM_GRACE_MS = 30_000;
  private static readonly IDLE_ROOM_TIMEOUT_MS =
    Number(process.env.IDLE_ROOM_TIMEOUT_MS) || 15 * 60_000;
  private static readonly STALE_GAME_TIMEOUT_MS =
    Number(process.env.STALE_GAME_TIMEOUT_MS) || 5 * 60_000;
  private static readonly SWEEP_INTERVAL_MS = 30_000;

  constructor(private db: Database) {}

  setRoomClosedListener(cb: (roomId: string, reason: RoomCloseReason) => void) {
    this.onRoomClosed = cb;
  }

  startSweeper(): () => void {
    if (!this.sweeper) {
      this.sweeper = setInterval(() => {
        void this.sweepTimeouts();
      }, RoomManager.SWEEP_INTERVAL_MS);
      if (typeof this.sweeper.unref === 'function') this.sweeper.unref();
    }
    return () => this.stopSweeper();
  }

  stopSweeper() {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = undefined;
    }
  }

  private touchRoom(roomId: string) {
    this.roomActivity.set(roomId, Date.now());
  }

  private isGameEnded(game: InMemoryGame): boolean {
    return getGameModule(game.gameType).isEnded(game.state);
  }

  isGameStateEnded(gameType: GameType, state: GameState): boolean {
    return getGameModule(gameType).isEnded(state);
  }

  touchGameRoom(roomId: string) {
    this.touchRoom(roomId);
  }

  private getTimeoutStatus(room: typeof rooms.$inferSelect): {
    timedOut: boolean;
    reason: Exclude<RoomCloseReason, 'empty'>;
  } {
    const game = this.games.get(room.id);
    const hasActiveGame = room.status === 'playing' && !!game && !this.isGameEnded(game);
    const reason = hasActiveGame ? 'stale' : 'idle';
    const limit = hasActiveGame
      ? RoomManager.STALE_GAME_TIMEOUT_MS
      : RoomManager.IDLE_ROOM_TIMEOUT_MS;
    const last = this.roomActivity.get(room.id) ?? room.createdAt.getTime();
    return { timedOut: Date.now() - last >= limit, reason };
  }

  private async sweepTimeouts() {
    const allRooms = await this.db.select().from(rooms);
    for (const room of allRooms) {
      if (this.getTimeoutStatus(room).timedOut) {
        await this.finalizeTimeoutClose(room.id);
      }
    }
  }

  private async finalizeTimeoutClose(roomId: string) {
    await this.runExclusive(`room:${roomId}`, async () => {
      const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));
      if (!room) return;

      const { timedOut, reason } = this.getTimeoutStatus(room);
      if (!timedOut) return;

      this.cancelScheduledClose(roomId);
      await this.db.delete(rooms).where(eq(rooms.id, roomId));
      this.games.delete(roomId);
      this.roomActivity.delete(roomId);
      this.forgetRoomSockets(roomId);
      this.onRoomClosed?.(roomId, reason);
    });
  }

  private runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const run = prev.then(task, task);
    this.locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  async listRooms(gameType?: GameType): Promise<RoomSummary[]> {
    const allRooms = gameType
      ? await this.db
          .select()
          .from(rooms)
          .where(eq(rooms.gameType, gameType))
          .orderBy(asc(rooms.createdAt))
      : await this.db.select().from(rooms).orderBy(asc(rooms.createdAt));
    const summaries: RoomSummary[] = [];

    for (const room of allRooms) {
      const members = await this.getMembers(room.id);
      summaries.push(this.toSummary(room, members));
    }
    return summaries;
  }

  async createRoom(input: {
    name: string;
    gameType: GameType;
    hostUserId: string;
    hostUsername: string;
    hostDisplayName: string;
    maxPlayers: number;
  }): Promise<RoomDetail> {
    const meta = GAME_META[input.gameType];
    const maxPlayers = Math.min(Math.max(input.maxPlayers, meta.minPlayers), meta.maxPlayers);

    const [room] = await this.db
      .insert(rooms)
      .values({
        name: input.name,
        hostUserId: input.hostUserId,
        gameType: input.gameType,
        maxPlayers,
      })
      .returning();

    const [hostMember] = await this.db
      .insert(roomMembers)
      .values({
        roomId: room!.id,
        userId: input.hostUserId,
        username: input.hostUsername,
        displayName: input.hostDisplayName,
        role: 'host',
        isOnline: true,
        isReady: true,
      })
      .returning();

    this.touchRoom(room!.id);
    const members = [this.mapMember(hostMember!)];
    return this.toDetail(room!, members);
  }

  async getRoomDetail(roomId: string): Promise<RoomDetail | null> {
    const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));
    if (!room) return null;

    const members = await this.getMembers(roomId);
    return this.toDetail(room, members);
  }

  async joinRoom(
    roomId: string,
    user: { id: string; username: string; displayName: string },
    socketId: string,
  ): Promise<{
    detail: RoomDetail;
    leftRooms: { roomId: string; deleted: boolean }[];
    kickedSockets: { socketId: string; roomId: string }[];
  } | null> {
    return this.runExclusive(`room:${roomId}`, async () => {
      const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));
      if (!room) return null;

      this.cancelScheduledClose(roomId);
      this.touchRoom(roomId);

      const { leftRooms, kickedSockets } = await this.removeUserFromOtherRooms(user.id, roomId);

      const existing = await this.db
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)));

      let memberId: string;
      if (existing.length > 0) {
        memberId = existing[0]!.id;
        for (const dup of existing.slice(1)) {
          await this.db.delete(roomMembers).where(eq(roomMembers.id, dup.id));
        }
        await this.db
          .update(roomMembers)
          .set({ isOnline: true, displayName: user.displayName })
          .where(eq(roomMembers.id, memberId));
      } else {
        const joinRole = room.status === 'playing' ? 'spectator' : 'player';
        const [created] = await this.db
          .insert(roomMembers)
          .values({
            roomId,
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            role: joinRole,
            isOnline: true,
          })
          .returning();
        memberId = created!.id;
      }

      this.socketToMember.set(socketId, { roomId, memberId });
      const detail = await this.getRoomDetail(roomId);
      return detail ? { detail, leftRooms, kickedSockets } : null;
    });
  }

  async leaveRoom(socketId: string): Promise<{ roomId: string; deleted: boolean } | null> {
    const mapping = this.socketToMember.get(socketId);
    if (!mapping) return null;
    this.socketToMember.delete(socketId);

    return this.runExclusive(`room:${mapping.roomId}`, async () => {
      await this.db
        .update(roomMembers)
        .set({ isOnline: false })
        .where(eq(roomMembers.id, mapping.memberId));

      this.touchRoom(mapping.roomId);
      const deleted = await this.cleanupRoom(mapping.roomId);
      return { roomId: mapping.roomId, deleted };
    });
  }

  async closeRoom(roomId: string, requesterId: string): Promise<boolean> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return false;

    this.cancelScheduledClose(roomId);
    await this.db.delete(rooms).where(eq(rooms.id, roomId));
    this.games.delete(roomId);
    this.roomActivity.delete(roomId);
    this.forgetRoomSockets(roomId);
    return true;
  }

  private async removeUserFromOtherRooms(
    userId: string,
    exceptRoomId: string,
  ): Promise<{
    leftRooms: { roomId: string; deleted: boolean }[];
    kickedSockets: { socketId: string; roomId: string }[];
  }> {
    const memberships = await this.db
      .select()
      .from(roomMembers)
      .where(eq(roomMembers.userId, userId));

    const leftRooms: { roomId: string; deleted: boolean }[] = [];
    const kickedSockets: { socketId: string; roomId: string }[] = [];
    const otherRoomIds = new Set(
      memberships.map((m) => m.roomId).filter((id) => id !== exceptRoomId),
    );

    for (const m of memberships) {
      if (m.roomId === exceptRoomId) continue;
      await this.db.delete(roomMembers).where(eq(roomMembers.id, m.id));
      for (const [sid, map] of this.socketToMember) {
        if (map.memberId === m.id) {
          kickedSockets.push({ socketId: sid, roomId: m.roomId });
          this.socketToMember.delete(sid);
        }
      }
    }

    for (const otherRoomId of otherRoomIds) {
      const deleted = await this.cleanupRoom(otherRoomId);
      leftRooms.push({ roomId: otherRoomId, deleted });
    }

    return { leftRooms, kickedSockets };
  }

  private async cleanupRoom(roomId: string): Promise<boolean> {
    const members = await this.getMembers(roomId);
    const onlineHumans = members.filter((m) => !m.isBot && m.isOnline);

    if (members.length === 0 || onlineHumans.length === 0) {
      this.scheduleRoomClose(roomId);
      return false;
    }

    this.cancelScheduledClose(roomId);

    const hasHost = members.some((m) => m.role === 'host');
    if (!hasHost) {
      const newHost = onlineHumans[0]!;
      if (newHost.userId) {
        await this.db
          .update(roomMembers)
          .set({ role: 'host' })
          .where(eq(roomMembers.id, newHost.id));
        await this.db
          .update(rooms)
          .set({ hostUserId: newHost.userId })
          .where(eq(rooms.id, roomId));
      }
    }

    return false;
  }

  private scheduleRoomClose(roomId: string) {
    if (this.pendingClose.has(roomId)) return;
    const timer = setTimeout(() => {
      this.pendingClose.delete(roomId);
      void this.finalizeRoomClose(roomId);
    }, RoomManager.EMPTY_ROOM_GRACE_MS);
    if (typeof timer.unref === 'function') timer.unref();
    this.pendingClose.set(roomId, timer);
  }

  private cancelScheduledClose(roomId: string) {
    const timer = this.pendingClose.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.pendingClose.delete(roomId);
    }
  }

  private async finalizeRoomClose(roomId: string) {
    await this.runExclusive(`room:${roomId}`, async () => {
      const members = await this.getMembers(roomId);
      const onlineHumans = members.filter((m) => !m.isBot && m.isOnline);
      if (onlineHumans.length > 0) return;

      await this.db.delete(rooms).where(eq(rooms.id, roomId));
      this.games.delete(roomId);
      this.roomActivity.delete(roomId);
      this.forgetRoomSockets(roomId);
      this.onRoomClosed?.(roomId, 'empty');
    });
  }

  private forgetRoomSockets(roomId: string) {
    for (const [sid, map] of this.socketToMember) {
      if (map.roomId === roomId) this.socketToMember.delete(sid);
    }
  }

  private async assertWaitingRoom(
    roomId: string,
  ): Promise<{ ok: true; detail: RoomDetail } | { ok: false; message: string }> {
    const detail = await this.getRoomDetail(roomId);
    if (!detail) return { ok: false, message: '房间不存在' };
    if (detail.status === 'playing') {
      return { ok: false, message: '游戏进行中，请在局间调整人员' };
    }
    return { ok: true, detail };
  }

  async addBot(
    roomId: string,
    difficulty: AiDifficulty,
    requesterId: string,
  ): Promise<RoomDetail | { error: string } | null> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return null;

    const waiting = await this.assertWaitingRoom(roomId);
    if (!waiting.ok) return { error: waiting.message };

    const botName = `电脑-${difficulty}-${Math.floor(Math.random() * 1000)}`;
    await this.db.insert(roomMembers).values({
      roomId,
      userId: null,
      username: botName,
      displayName: botName,
      isBot: true,
      botDifficulty: difficulty,
      role: 'player',
      isOnline: true,
      isReady: true,
    });

    this.touchRoom(roomId);
    return this.getRoomDetail(roomId);
  }

  async removeMember(roomId: string, memberId: string, requesterId: string): Promise<RoomDetail | null> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return null;

    const waiting = await this.assertWaitingRoom(roomId);
    if (!waiting.ok) return null;

    await this.db.delete(roomMembers).where(eq(roomMembers.id, memberId));
    return this.getRoomDetail(roomId);
  }

  async setParticipantRoles(
    roomId: string,
    activePlayerIds: string[],
    spectatorIds: string[],
    requesterId: string,
  ): Promise<RoomDetail | { error: string } | null> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return null;

    const waiting = await this.assertWaitingRoom(roomId);
    if (!waiting.ok) return { error: waiting.message };

    const members = await this.getMembers(roomId);
    for (const m of members) {
      let role = m.role;
      if (m.id === detail.hostId) {
        role = 'host';
      } else if (spectatorIds.includes(m.id)) {
        role = 'spectator';
      } else if (activePlayerIds.includes(m.id)) {
        role = 'player';
      }
      await this.db.update(roomMembers).set({ role }).where(eq(roomMembers.id, m.id));
    }

    this.touchRoom(roomId);
    return this.getRoomDetail(roomId);
  }

  async startNextGame(
    roomId: string,
    requesterId: string,
    options: GameStartOptions<GameType> = {} as GameStartOptions<GameType>,
  ): Promise<
    | { ok: true; detail: RoomDetail; gameState: GameState; gameType: GameType }
    | { ok: false; message: string }
  > {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) {
      return { ok: false, message: '仅房主可开始游戏' };
    }

    if (detail.status === 'playing') {
      return { ok: false, message: '游戏已在进行中' };
    }

    const nextGame = detail.gameType;
    const mod = getGameModule(nextGame);

    const spectatorIds = mod.preStartSpectatorIds?.(detail) ?? [];
    for (const memberId of spectatorIds) {
      await this.db
        .update(roomMembers)
        .set({ role: 'spectator' })
        .where(eq(roomMembers.id, memberId));
    }

    const roster = spectatorIds.length > 0 ? await this.getRoomDetail(roomId) : detail;
    if (!roster) return { ok: false, message: '房间不存在' };

    const meta = GAME_META[nextGame];
    const activePlayers = roster.players.filter(
      (p) => p.role === 'host' || p.role === 'player',
    );

    if (activePlayers.length < meta.minPlayers) {
      const hint = mod.insufficientPlayersHint?.() ?? '';
      return {
        ok: false,
        message: `「${meta.name}」需要至少 ${meta.minPlayers} 名玩家，当前仅 ${activePlayers.length} 名。${hint}`,
      };
    }

    const participants = activePlayers.slice(0, meta.maxPlayers).map((p) => ({
      id: p.id,
      name: p.displayName,
      isBot: p.isBot,
    }));

    const state = createGame(nextGame, participants, options);
    const sessionId = uuid();

    this.games.set(roomId, {
      sessionId,
      gameType: nextGame,
      state,
      activePlayerIds: participants.map((p) => p.id),
    });

    await this.db.update(rooms).set({ status: 'playing' }).where(eq(rooms.id, roomId));

    this.touchRoom(roomId);
    const updated = await this.getRoomDetail(roomId);
    return updated
      ? { ok: true, detail: updated, gameState: state, gameType: nextGame }
      : { ok: false, message: '房间不存在' };
  }

  getGame(roomId: string): InMemoryGame | undefined {
    return this.games.get(roomId);
  }

  async markGameEnded(roomId: string): Promise<RoomDetail | null> {
    await this.db.update(rooms).set({ status: 'waiting' }).where(eq(rooms.id, roomId));
    return this.getRoomDetail(roomId);
  }

  async runBotTurns(roomId: string): Promise<InMemoryGame | null> {
    const game = this.games.get(roomId);
    if (!game) return null;

    const detail = await this.getRoomDetail(roomId);
    if (!detail) return game;

    const mod = getGameModule(game.gameType);
    if (!mod.runBotTurn) return game;

    const before = JSON.stringify(game.state);

    for (const player of detail.players) {
      if (!player.isBot || !player.botDifficulty) continue;

      const next = mod.runBotTurn(game.state, {
        difficulty: player.botDifficulty,
        playerId: player.id,
        playerName: player.displayName,
        roomPlayers: detail.players,
      });

      if (next && JSON.stringify(next) !== JSON.stringify(game.state)) {
        game.state = next as GameState;
        if (mod.isEnded(game.state)) {
          await this.markGameEnded(roomId);
        }
        this.touchRoom(roomId);
        return game;
      }
    }

    if (JSON.stringify(game.state) !== before) this.touchRoom(roomId);
    return game;
  }

  private async getMembers(roomId: string) {
    const rows = await this.db
      .select()
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId));
    return rows.map((r) => this.mapMember(r));
  }

  private mapMember(row: typeof roomMembers.$inferSelect): RoomPlayer {
    return {
      id: row.id,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      isBot: row.isBot,
      botDifficulty: row.botDifficulty as AiDifficulty | null,
      role: row.role as RoomPlayer['role'],
      isOnline: row.isOnline,
      isReady: row.isReady,
    };
  }

  private toSummary(room: typeof rooms.$inferSelect, members: RoomPlayer[]): RoomSummary {
    const host = members.find((m) => m.role === 'host');
    return {
      id: room.id,
      name: room.name,
      hostId: host?.id ?? room.hostUserId,
      gameType: room.gameType as GameType,
      status: room.status as RoomSummary['status'],
      playerCount: members.filter((m) => m.role !== 'spectator').length,
      spectatorCount: members.filter((m) => m.role === 'spectator').length,
      maxPlayers: room.maxPlayers,
      players: members,
      createdAt: room.createdAt.toISOString(),
    };
  }

  private toDetail(room: typeof rooms.$inferSelect, members: RoomPlayer[]): RoomDetail {
    const summary = this.toSummary(room, members);
    return {
      ...summary,
      activePlayerIds: members.filter((m) => m.role !== 'spectator').map((m) => m.id),
      spectatorIds: members.filter((m) => m.role === 'spectator').map((m) => m.id),
    };
  }
}
