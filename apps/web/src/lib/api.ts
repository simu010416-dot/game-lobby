import type { AuthResponse, GameType, RoomDetail, RoomSummary } from '@game-lobby/shared';

const API_URL = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? '请求失败');
  return data as T;
}

export function register(username: string, password: string, displayName?: string) {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName }),
  });
}

export function login(username: string, password: string) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchRandomGuestName() {
  return request<{ displayName: string }>('/api/auth/guest/random-name');
}

export function guestLogin(displayName?: string) {
  return request<AuthResponse>('/api/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ displayName: displayName || undefined }),
  });
}

export function updateProfile(token: string, displayName: string) {
  return request<AuthResponse>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  }, token);
}

export function fetchRooms(token: string, gameType?: GameType) {
  const query = gameType ? `?gameType=${gameType}` : '';
  return request<RoomSummary[]>(`/api/rooms${query}`, {}, token);
}

export function createRoom(token: string, name: string, gameType: GameType, maxPlayers?: number) {
  return request<RoomDetail>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ name, gameType, maxPlayers }),
  }, token);
}

export function fetchRoom(token: string, roomId: string) {
  return request<RoomDetail>(`/api/rooms/${roomId}`, {}, token);
}
