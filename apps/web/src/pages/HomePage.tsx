import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALL_GAME_TYPES, GAME_META } from '@game-lobby/shared';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { getSocket } from '../lib/socket';

export function HomePage() {
  const { token } = useAuth();
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getSocket(token);
    api
      .fetchRooms(token)
      .then((rooms) => {
        const counts: Record<string, number> = {};
        for (const g of ALL_GAME_TYPES) counts[g] = 0;
        for (const room of rooms) {
          counts[room.gameType] = (counts[room.gameType] ?? 0) + 1;
        }
        setRoomCounts(counts);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>选择游戏</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
          进入游戏大厅，创建或加入房间
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>加载中…</p>
      ) : (
        <div className="grid grid-rooms">
          {ALL_GAME_TYPES.map((gameType) => {
            const meta = GAME_META[gameType];
            const count = roomCounts[gameType] ?? 0;
            return (
              <Link key={gameType} to={`/games/${gameType}`} style={{ color: 'inherit' }}>
                <article className="card" style={{ height: '100%' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{meta.name}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                    {meta.description}
                  </p>
                  <p style={{ fontSize: '0.85rem', margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>
                    {meta.minPlayers}–{meta.maxPlayers} 人 · {count} 个房间
                  </p>
                  <span className="btn" style={{ display: 'inline-block', pointerEvents: 'none' }}>
                    进入大厅 →
                  </span>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
