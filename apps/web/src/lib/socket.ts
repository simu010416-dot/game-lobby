import { io, type Socket } from 'socket.io-client';
import type { GameType, RoomDetail, RoomSummary } from '@game-lobby/shared';
import type { RolePresetId, WerewolfRole } from '@game-lobby/game-engine';

/** Same-origin in dev (via Vite proxy) avoids localhost vs 127.0.0.1 CORS mismatches. */
function resolveWsUrl(): string {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl !== undefined && envUrl !== '') return envUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3001';
}

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket && (socket.auth as { token?: string }).token !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socket = io(resolveWsUrl(), {
      auth: { token },
      autoConnect: true,
    });
  } else {
    (socket.auth as { token: string }).token = token;
    if (!socket.connected) socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function subscribeLobby(gameType: GameType, onRooms: (rooms: RoomSummary[]) => void) {
  const s = socket;
  if (!s) return () => {};
  s.emit('lobby:subscribe', { gameType });
  s.on('lobby:rooms', onRooms);
  return () => s.off('lobby:rooms', onRooms);
}

export function joinRoom(roomId: string): Promise<{ ok: boolean; room?: RoomDetail; message?: string }> {
  return new Promise((resolve) => {
    socket?.emit('room:join', { roomId }, resolve);
  });
}

export function onRoomUpdated(handler: (room: RoomDetail) => void) {
  socket?.on('room:updated', handler);
  return () => socket?.off('room:updated', handler);
}

export function onGameState(handler: (payload: { gameType: string; state: unknown }) => void) {
  socket?.on('game:state', handler);
  return () => socket?.off('game:state', handler);
}

export function onRoomClosed(
  handler: (payload: { roomId: string; reason?: string; message?: string }) => void,
) {
  socket?.on('room:closed', handler);
  return () => socket?.off('room:closed', handler);
}

export function onRoomKicked(
  handler: (payload: { roomId: string; reason?: 'joined_other_room' | 'removed_by_host' }) => void,
) {
  socket?.on('room:kicked', handler);
  return () => socket?.off('room:kicked', handler);
}

export function closeRoom() {
  return new Promise<{ ok: boolean; message?: string }>((resolve) => {
    socket?.emit('room:close', {}, resolve);
  });
}

export function emitAddBot(difficulty: string) {
  return new Promise<{ ok: boolean; room?: RoomDetail; message?: string }>((resolve) => {
    socket?.emit('room:add-bot', { difficulty }, resolve);
  });
}

export function emitRemoveMember(memberId: string) {
  return new Promise<{ ok: boolean; room?: RoomDetail; message?: string }>((resolve) => {
    socket?.emit('room:remove-member', { memberId }, resolve);
  });
}

export function emitSetRoles(activePlayerIds: string[], spectatorIds: string[]) {
  return new Promise<{ ok: boolean }>((resolve) => {
    socket?.emit('room:set-roles', { activePlayerIds, spectatorIds }, resolve);
  });
}

export function getActiveSocket(): Socket | null {
  return socket;
}

export function emitStartGame(
  gameType: GameType,
  options: {
    useJoker?: boolean;
    assistMode?: boolean;
    categoryIds?: string[];
    userPackIds?: string[];
    userPairPackIds?: string[];
    roomExtraWords?: string | string[];
    drawDurationSec?: number;
    wordSelectDurationSec?: number;
    useSpecialCards?: boolean;
    rolePreset?: RolePresetId;
    customRoles?: WerewolfRole[];
    discussionMode?: 'free' | 'sequential';
  } = {},
) {
  return new Promise<{ ok: boolean; message?: string }>((resolve) => {
    let payload: Record<string, unknown> = {};
    if (gameType === 'da_vinci_code') {
      payload = {
        useJoker: options.useJoker ?? false,
        assistMode: options.assistMode ?? true,
      };
    } else if (gameType === 'undercover') {
      const rawExtra = options.roomExtraWords;
      const extraText = typeof rawExtra === 'string' ? rawExtra : (rawExtra ?? []).join('\n');
      payload = {
        categoryIds: options.categoryIds ?? ['food', 'sport', 'entertainment', 'transport', 'life', 'animal', 'nature', 'jobs', 'places', 'daily'],
        userPairPackIds: options.userPairPackIds ?? options.userPackIds ?? [],
        roomExtraWords: extraText.split('\n').map((w) => w.trim()).filter(Boolean),
      };
    } else if (gameType === 'draw_guess') {
      const rawExtra = options.roomExtraWords;
      const extra = (typeof rawExtra === 'string' ? rawExtra : (rawExtra ?? []).join('\n'))
        .split(/[,，\n]/)
        .map((w) => w.trim())
        .filter(Boolean);
      payload = {
        categoryIds: options.categoryIds ?? ['animal', 'daily', 'movie', 'sport'],
        userPackIds: options.userPackIds ?? [],
        roomExtraWords: extra ?? [],
        drawDurationSec: options.drawDurationSec,
        wordSelectDurationSec: options.wordSelectDurationSec,
      };
    } else if (gameType === 'german_heart_attack') {
      payload = {
        useSpecialCards: options.useSpecialCards ?? false,
      };
    } else if (gameType === 'werewolf') {
      payload = {
        rolePreset: options.rolePreset ?? 'simple_6',
        customRoles: options.customRoles,
        discussionMode: options.discussionMode ?? 'sequential',
      };
    }
    socket?.emit('game:start', payload, resolve);
  });
}

export function leaveRoom() {
  socket?.emit('room:leave');
}
