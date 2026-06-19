import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import type { GameType, RoomSummary } from '@game-lobby/shared';
import { ALL_GAME_TYPES, GAME_META } from '@game-lobby/shared';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { getSocket, subscribeLobby } from '../lib/socket';

export function GameLobbyPage() {
  const { gameType: gameTypeParam } = useParams<{ gameType: string }>();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;
  const { token } = useAuth();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const isValidGame = gameTypeParam != null && ALL_GAME_TYPES.includes(gameTypeParam as GameType);
  const gameType = (isValidGame ? gameTypeParam : 'undercover') as GameType;
  const meta = GAME_META[gameType];

  useEffect(() => {
    if (!token || !isValidGame) return;
    getSocket(token);
    const unsub = subscribeLobby(gameType, setRooms);
    api.fetchRooms(token, gameType).then(setRooms).finally(() => setLoading(false));
    return unsub;
  }, [token, gameType, isValidGame]);

  async function handleCreate() {
    if (!token || !roomName.trim() || !isValidGame) return;
    setCreating(true);
    try {
      const room = await api.createRoom(token, roomName.trim(), gameType);
      window.location.href = `/games/${gameType}/room/${room.id}`;
    } finally {
      setCreating(false);
    }
  }

  if (!isValidGame) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      {notice && (
        <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem' }}>{notice}</p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ← 返回主页
          </Link>
          <h1 style={{ margin: '0.25rem 0 0' }}>{meta.name} 大厅</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
            {meta.description}
            {meta.hasWordPacks && (
              <>
                {' '}
                ·{' '}
                <Link to={`/games/${gameType}/word-packs`}>管理词语包</Link>
              </>
            )}
            {meta.hasPairPacks && (
              <>
                {' '}
                ·{' '}
                <Link to="/games/undercover/word-pairs">管理词对包</Link>
              </>
            )}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flex: '1 1 280px' }}>
          <input
            className="input"
            placeholder="新房间名称"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <button className="btn" onClick={handleCreate} disabled={creating}>
            创建房间
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>加载中…</p>
      ) : rooms.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>暂无房间，创建第一个吧！</p>
        </div>
      ) : (
        <div className="grid grid-rooms">
          {rooms.map((room) => (
            <Link
              key={room.id}
              to={`/games/${gameType}/room/${room.id}`}
              style={{ color: 'inherit' }}
            >
              <article className="card" style={{ height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{room.name}</h2>
                  <span className={`badge badge-${room.status}`}>
                    {room.status === 'playing' ? '游戏中' : '等待中'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', margin: '0.5rem 0 0.75rem' }}>
                  玩家 {room.playerCount} · 旁观 {room.spectatorCount}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {room.players.slice(0, 6).map((p) => (
                    <span key={p.id} className="player-chip">
                      {p.isBot ? '🤖' : '👤'} {p.displayName}
                    </span>
                  ))}
                  {room.players.length > 6 && (
                    <span className="player-chip">+{room.players.length - 6}</span>
                  )}
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
