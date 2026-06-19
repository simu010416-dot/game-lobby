import type { RoomDetail, RoomStatus } from '@game-lobby/shared';

export interface JoinRoleContext {
  roomStatus: RoomStatus;
  activePlayerCount: number;
  maxPlayers: number;
}

export type CanAddBotResult = true | { ok: false; message: string };

export function defaultResolveJoinRole(ctx: JoinRoleContext): 'player' | 'spectator' {
  if (ctx.roomStatus === 'playing') return 'spectator';
  if (ctx.activePlayerCount >= ctx.maxPlayers) return 'spectator';
  return 'player';
}

export function defaultCanAddBot(room: RoomDetail): CanAddBotResult {
  const activeCount = room.players.filter((p) => p.role !== 'spectator').length;
  if (activeCount >= room.maxPlayers) {
    return {
      ok: false,
      message: `房间玩家已满（${room.maxPlayers} 人），请先将有玩家设为旁观或移除后再添加电脑`,
    };
  }
  return true;
}
