import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RoomDetail } from '@game-lobby/shared';
import {
  ALL_AI_DIFFICULTIES,
  ALL_GAME_TYPES,
  AI_DIFFICULTY_LABELS,
  GAME_META,
  type AiDifficulty,
  type GameType,
} from '@game-lobby/shared';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import {
  closeRoom,
  emitAddBot,
  emitDaVinciDecision,
  emitDaVinciGuess,
  emitSetRoles,
  emitStartGame,
  emitUndercoverDescribe,
  emitUndercoverVote,
  emitUpdateQueue,
  getSocket,
  joinRoom,
  leaveRoom,
  onGameState,
  onRoomClosed,
  onRoomKicked,
  onRoomUpdated,
} from '../lib/socket';
import { UndercoverGame } from '../components/games/UndercoverGame';
import { DaVinciGame } from '../components/games/DaVinciGame';
import type { DaVinciGameState, UndercoverGameState } from '../types/game';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [closed, setClosed] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [gameState, setGameState] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [botDifficulty, setBotDifficulty] = useState<AiDifficulty>('medium');
  const [queueMode, setQueueMode] = useState<'ordered' | 'random'>('ordered');
  const [selectedQueue, setSelectedQueue] = useState<GameType[]>([...ALL_GAME_TYPES]);

  const myMember = useMemo(
    () => room?.players.find((p) => p.userId === user?.id) ?? null,
    [room, user],
  );
  const isHost = myMember?.role === 'host';
  const isSpectator = myMember?.role === 'spectator';

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
        setClosed(true);
        navigate('/', { replace: true });
      }
    });
    const unsubKicked = onRoomKicked((payload) => {
      if (payload.roomId === roomId) {
        setKicked(true);
        navigate('/', { replace: true });
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
  }, [token, roomId]);

  useEffect(() => {
    if (!token || !roomId) return;
    api.fetchRoom(token, roomId).then(setRoom).catch(() => {});
  }, [token, roomId]);

  useEffect(() => {
    if (room) {
      setQueueMode(room.queueMode);
      setSelectedQueue(room.gameQueue.map((q) => q.gameType));
    }
  }, [room?.id]);

  async function handleAddBot() {
    await emitAddBot(botDifficulty);
  }

  async function handleStartGame() {
    await emitUpdateQueue(
      selectedQueue.map((g, i) => ({ gameType: g, order: i })),
      queueMode,
    );
    const res = await emitStartGame();
    if (!res.ok) setError(res.message ?? '无法开始');
  }

  async function handleCloseRoom() {
    if (!window.confirm('确定要关闭房间吗？所有玩家将被移出房间。')) return;
    const res = await closeRoom();
    if (!res.ok) setError(res.message ?? '无法关闭房间');
  }

  async function handleToggleRole(memberId: string) {
    if (!room || !isHost) return;
    const spectators = new Set(room.spectatorIds);
    const active = new Set(room.activePlayerIds);

    if (spectators.has(memberId)) {
      spectators.delete(memberId);
      active.add(memberId);
    } else {
      active.delete(memberId);
      spectators.add(memberId);
    }

    await emitSetRoles([...active], [...spectators]);
  }

  if (kicked) {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        你已在其他位置加入了新房间，正在返回大厅…
      </p>
    );
  }

  if (closed) {
    return <p style={{ color: 'var(--text-muted)' }}>房间已关闭，正在返回大厅…</p>;
  }

  if (!room) {
    return <p style={{ color: 'var(--text-muted)' }}>{error || '加载房间…'}</p>;
  }

  const nextGame = selectedQueue[0];
  const nextMeta = nextGame ? GAME_META[nextGame] : null;
  const activeCount = room.players.filter((p) => p.role !== 'spectator').length;
  const needsRoleSplit =
    nextMeta && (activeCount > nextMeta.maxPlayers || activeCount < nextMeta.minPlayers);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-muted)' }}>
          ← 返回大厅
        </Link>
        <h1 style={{ margin: 0, flex: 1 }}>{room.name}</h1>
        <span className={`badge badge-${room.status}`}>
          {room.status === 'playing' ? '游戏中' : '等待中'}
        </span>
        {isHost && (
          <button className="btn btn-secondary" onClick={handleCloseRoom}>
            关闭房间
          </button>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <section className="card">
          <h3 style={{ marginTop: 0 }}>玩家列表</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {room.players.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                }}
              >
                <span>
                  {p.isBot ? '🤖' : '👤'} {p.displayName}
                  {p.role === 'host' && '（房主）'}
                  {p.role === 'spectator' && '（旁观）'}
                  {p.isBot && p.botDifficulty && ` · ${AI_DIFFICULTY_LABELS[p.botDifficulty]}`}
                </span>
                {isHost && p.role !== 'host' && (
                  <button className="btn btn-secondary" onClick={() => handleToggleRole(p.id)}>
                    {p.role === 'spectator' ? '设为玩家' : '设为旁观'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {isHost && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="input"
                style={{ width: 'auto' }}
                value={botDifficulty}
                onChange={(e) => setBotDifficulty(e.target.value as AiDifficulty)}
              >
                {ALL_AI_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {AI_DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={handleAddBot}>
                添加电脑
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <h3 style={{ marginTop: 0 }}>游戏队列（房主设置）</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            下一局将玩队列中的游戏。可排序或随机。
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <label>
              <input
                type="radio"
                checked={queueMode === 'ordered'}
                onChange={() => setQueueMode('ordered')}
                disabled={!isHost}
              />{' '}
              按顺序
            </label>
            <label>
              <input
                type="radio"
                checked={queueMode === 'random'}
                onChange={() => setQueueMode('random')}
                disabled={!isHost}
              />{' '}
              随机
            </label>
          </div>

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {selectedQueue.map((g, i) => (
              <div key={`${g}-${i}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ flex: 1 }}>{GAME_META[g].name}</span>
                {isHost && (
                  <>
                    <button
                      className="btn btn-secondary"
                      disabled={i === 0}
                      onClick={() => {
                        const next = [...selectedQueue];
                        [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                        setSelectedQueue(next);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setSelectedQueue(selectedQueue.filter((_, j) => j !== i))}
                    >
                      移除
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {isHost && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ALL_GAME_TYPES.filter((g) => !selectedQueue.includes(g)).map((g) => (
                <button
                  key={g}
                  className="btn btn-secondary"
                  onClick={() => setSelectedQueue([...selectedQueue, g])}
                >
                  + {GAME_META[g].name}
                </button>
              ))}
            </div>
          )}

          {needsRoleSplit && isHost && (
            <p style={{ color: 'var(--warning)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
              下一局 {nextMeta!.name} 需要 {nextMeta!.minPlayers}-{nextMeta!.maxPlayers} 人，
              当前玩家 {activeCount} 人。请使用上方按钮设置旁观/玩家。
            </p>
          )}

          {isHost && room.status !== 'playing' && (
            <button className="btn" style={{ marginTop: '1rem', width: '100%' }} onClick={handleStartGame}>
              保存队列并开始
            </button>
          )}
        </section>
      </div>

      {gameType === 'undercover' && gameState != null ? (
        <UndercoverGame
          state={gameState as UndercoverGameState}
          myMemberId={myMember?.id ?? null}
          isSpectator={isSpectator}
          onDescribe={emitUndercoverDescribe}
          onVote={emitUndercoverVote}
        />
      ) : null}

      {gameType === 'da_vinci_code' && gameState != null ? (
        <DaVinciGame
          state={gameState as DaVinciGameState}
          myMemberId={myMember?.id ?? null}
          isSpectator={isSpectator}
          onGuess={emitDaVinciGuess}
          onDecision={emitDaVinciDecision}
        />
      ) : null}
    </div>
  );
}
