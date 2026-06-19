import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameType, RoomDetail } from '@game-lobby/shared';
import * as api from '../lib/api';
import {
  getSocket,
  joinRoom,
  leaveRoom,
  onGameState,
  onRoomClosed,
  onRoomKicked,
  onRoomUpdated,
} from '../lib/socket';

export interface UseRoomSessionOptions {
  roomId: string | undefined;
  token: string | null;
  lobbyPath: string;
}

export interface UseRoomSessionResult {
  room: RoomDetail | null;
  error: string;
  setError: (msg: string) => void;
  kicked: boolean;
  kickedMessage: string;
  closed: boolean;
  closedMessage: string;
  gameType: GameType | null;
  gameState: unknown;
}

export function useRoomSession({
  roomId,
  token,
  lobbyPath,
}: UseRoomSessionOptions): UseRoomSessionResult {
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [closed, setClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState('房间已关闭，正在返回大厅…');
  const [kicked, setKicked] = useState(false);
  const [kickedMessage, setKickedMessage] = useState('你已在其他位置加入了新房间，正在返回大厅…');
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [gameState, setGameState] = useState<unknown>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !roomId) return;
    getSocket(token);

    let mounted = true;
    (async () => {
      const res = await joinRoom(roomId);
      if (!mounted) return;
      if (!res.ok) {
        setError(res.message ?? '加入房间失败');
        return;
      }
      if (res.room) setRoom(res.room);
    })();

    const unsubRoom = onRoomUpdated((r) => {
      if (r.id === roomId) setRoom(r);
    });
    const unsubGame = onGameState((payload) => {
      setGameType(payload.gameType as GameType);
      setGameState(payload.state);
    });
    const unsubClosed = onRoomClosed((payload) => {
      if (payload.roomId === roomId) {
        if (payload.message) setClosedMessage(`${payload.message}，正在返回大厅…`);
        setClosed(true);
        navigate(lobbyPath, { replace: true });
      }
    });
    const unsubKicked = onRoomKicked((payload) => {
      if (payload.roomId === roomId) {
        const message =
          payload.reason === 'removed_by_host'
            ? '你已被房主移出房间，正在返回大厅…'
            : '你已在其他位置加入了新房间，正在返回大厅…';
        setKickedMessage(message);
        setKicked(true);
        navigate(lobbyPath, { replace: true, state: { notice: message } });
      }
    });

    return () => {
      mounted = false;
      leaveRoom();
      unsubRoom();
      unsubGame();
      unsubClosed();
      unsubKicked();
    };
  }, [token, roomId, lobbyPath, navigate]);

  useEffect(() => {
    if (!token || !roomId) return;
    api
      .fetchRoom(token, roomId)
      .then((detail) => setRoom((prev) => prev ?? detail))
      .catch(() => {});
  }, [token, roomId]);

  return { room, error, setError, kicked, kickedMessage, closed, closedMessage, gameType, gameState };
}
