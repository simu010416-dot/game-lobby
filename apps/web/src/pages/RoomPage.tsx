import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RoomDetail } from '@game-lobby/shared';
import {
  ALL_AI_DIFFICULTIES,
  AI_DIFFICULTY_LABELS,
  GAME_META,
  type AiDifficulty,
  type GameType,
} from '@game-lobby/shared';
import type { DaVinciGameState } from '@game-lobby/game-engine';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import {
  closeRoom,
  emitAddBot,
  emitSetRoles,
  emitStartGame,
  getSocket,
  joinRoom,
  leaveRoom,
  onGameState,
  onRoomClosed,
  onRoomKicked,
  onRoomUpdated,
} from '../lib/socket';
import { GAME_REGISTRY, renderGameSettings } from '../games/registry';

export function RoomPage() {
  const { gameType: gameTypeParam, roomId } = useParams<{ gameType: string; roomId: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [closed, setClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState('房间已关闭，正在返回大厅…');
  const [kicked, setKicked] = useState(false);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [gameState, setGameState] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [botDifficulty, setBotDifficulty] = useState<AiDifficulty>('medium');
  const [useJoker, setUseJoker] = useState(false);
  const [assistMode, setAssistMode] = useState(true);
  const [categoryIds, setCategoryIds] = useState<string[]>(['animal', 'daily', 'movie', 'sport']);
  const [userPackIds, setUserPackIds] = useState<string[]>([]);
  const [roomExtraWords, setRoomExtraWords] = useState('');

  const gameTypeFromUrl = gameTypeParam as GameType;
  const lobbyPath = `/games/${gameTypeFromUrl}`;

  const activeGameMod = gameType ? GAME_REGISTRY[gameType] : null;
  const isGameEnded = (state: unknown) =>
    activeGameMod ? activeGameMod.isEnded(state) : false;

  const myMember = useMemo(
    () => room?.players.find((p) => p.userId === user?.id) ?? null,
    [room, user],
  );
  const isHost = myMember?.role === 'host';
  const isSpectator = myMember?.role === 'spectator';

  const isPlaying = room?.status === 'playing';
  const isIntermission = room?.status === 'waiting' && gameState != null && isGameEnded(gameState);
  const isPreGame = room?.status === 'waiting' && !isIntermission;
  const showSidePanels = isPreGame || isIntermission;

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
        setKicked(true);
        navigate(lobbyPath, { replace: true });
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
    api.fetchRoom(token, roomId).then(setRoom).catch(() => {});
  }, [token, roomId]);

  useEffect(() => {
    if (gameType !== 'da_vinci_code' || !gameState || !isGameEnded(gameState)) return;
    const s = gameState as DaVinciGameState;
    setUseJoker(s.useJoker);
    setAssistMode(s.assistMode ?? true);
  }, [gameState, gameType]);

  async function handleAddBot() {
    await emitAddBot(botDifficulty);
  }

  async function handleStartGame() {
    if (!room) return;
    const res = await emitStartGame(room.gameType, {
      useJoker,
      assistMode,
      categoryIds,
      userPackIds,
      roomExtraWords,
    });
    if (!res.ok) setError(res.message ?? '无法开始');
  }

  async function handleCloseRoom() {
    if (!window.confirm('确定要关闭房间吗？所有玩家将被移出房间。')) return;
    const res = await closeRoom();
    if (!res.ok) setError(res.message ?? '无法关闭房间');
  }

  async function handleToggleRole(memberId: string) {
    if (!room || !isHost || isPlaying) return;
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
    return <p style={{ color: 'var(--text-muted)' }}>{closedMessage}</p>;
  }

  if (!room) {
    return <p style={{ color: 'var(--text-muted)' }}>{error || '加载房间…'}</p>;
  }

  const meta = GAME_META[room.gameType];
  const activeCount = room.players.filter((p) => p.role !== 'spectator').length;
  const needsRoleSplit =
    meta && (activeCount > meta.maxPlayers || activeCount < meta.minPlayers);

  const GameComponent = activeGameMod?.Component;

  const playerListPanel = (
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
            {isHost && p.role !== 'host' && !isPlaying && (
              <button className="btn btn-secondary" onClick={() => handleToggleRole(p.id)}>
                {p.role === 'spectator' ? '设为玩家' : '设为旁观'}
              </button>
            )}
          </div>
        ))}
      </div>

      {isHost && !isPlaying && meta.botsAllowed && (
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
  );

  const settingsPanel = (
    <section className="card">
      <h3 style={{ marginTop: 0 }}>游戏设置</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
        {meta.name} · {meta.minPlayers}–{meta.maxPlayers} 人
      </p>

      {needsRoleSplit && isHost && (
        <p style={{ color: 'var(--warning)', fontSize: '0.85rem', marginTop: 0 }}>
          需要 {meta.minPlayers}–{meta.maxPlayers} 名玩家，当前 {activeCount} 人。请调整旁观/玩家。
        </p>
      )}

      {renderGameSettings(room.gameType, {
        isHost,
        isPlaying,
        gameState: gameState as import('@game-lobby/game-engine').GameState | null,
        useJoker,
        setUseJoker,
        assistMode,
        setAssistMode,
        categoryIds,
        setCategoryIds,
        userPackIds,
        setUserPackIds,
        roomExtraWords,
        setRoomExtraWords,
      })}

      {isHost && (
        <button
          className="btn"
          style={{ marginTop: '1rem', width: '100%' }}
          onClick={handleStartGame}
        >
          {isIntermission ? '再来一局' : '开始游戏'}
        </button>
      )}
    </section>
  );

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <Link to={lobbyPath} style={{ color: 'var(--text-muted)' }}>
          ← 返回 {meta.name} 大厅
        </Link>
        <h1 style={{ margin: 0, flex: 1 }}>{room.name}</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{meta.name}</span>
        <span className={`badge badge-${room.status}`}>
          {room.status === 'playing' ? '游戏中' : isIntermission ? '局间休息' : '等待中'}
        </span>
        {isHost && (
          <button className="btn btn-secondary" onClick={handleCloseRoom}>
            关闭房间
          </button>
        )}
      </div>

      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

      {showSidePanels && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {playerListPanel}
          {settingsPanel}
        </div>
      )}

      {GameComponent && gameState != null ? (
        <GameComponent
          state={gameState as import('@game-lobby/game-engine').GameState}
          myMemberId={myMember?.id ?? null}
          isSpectator={isSpectator}
        />
      ) : null}
    </div>
  );
}
