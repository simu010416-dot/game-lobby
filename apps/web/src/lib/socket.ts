import { io, type Socket } from 'socket.io-client';
import type { RoomDetail, RoomSummary } from '@game-lobby/shared';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket && (socket.auth as { token?: string }).token !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socket = io(WS_URL, {
      auth: { token },
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function subscribeLobby(onRooms: (rooms: RoomSummary[]) => void) {
  const s = socket;
  if (!s) return () => {};
  s.emit('lobby:subscribe');
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

export function onRoomClosed(handler: (payload: { roomId: string }) => void) {
  socket?.on('room:closed', handler);
  return () => socket?.off('room:closed', handler);
}

export function onRoomKicked(handler: (payload: { roomId: string }) => void) {
  socket?.on('room:kicked', handler);
  return () => socket?.off('room:kicked', handler);
}

export function closeRoom() {
  return new Promise<{ ok: boolean; message?: string }>((resolve) => {
    socket?.emit('room:close', {}, resolve);
  });
}

export function emitAddBot(difficulty: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    socket?.emit('room:add-bot', { difficulty }, resolve);
  });
}

export function emitUpdateQueue(queue: { gameType: string; order: number }[], mode: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    socket?.emit('room:update-queue', { queue, mode }, resolve);
  });
}

export function emitSetRoles(activePlayerIds: string[], spectatorIds: string[]) {
  return new Promise<{ ok: boolean }>((resolve) => {
    socket?.emit('room:set-roles', { activePlayerIds, spectatorIds }, resolve);
  });
}

export function emitStartGame() {
  return new Promise<{ ok: boolean; message?: string }>((resolve) => {
    socket?.emit('game:start', {}, resolve);
  });
}

export function emitUndercoverDescribe(description: string) {
  socket?.emit('game:undercover:describe', { description });
}

export function emitUndercoverVote(targetId: string) {
  socket?.emit('game:undercover:vote', { targetId });
}

export function emitDaVinciGuess(targetPlayerId: string, tileIndex: number, value: number) {
  socket?.emit('game:davinci:guess', { targetPlayerId, tileIndex, value });
}

export function emitDaVinciDecision(shouldContinue: boolean) {
  socket?.emit('game:davinci:decision', { continue: shouldContinue });
}

export function leaveRoom() {
  socket?.emit('room:leave');
}
