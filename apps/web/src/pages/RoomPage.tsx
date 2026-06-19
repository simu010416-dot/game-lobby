import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { UndercoverGameState } from '@game-lobby/game-engine';
import {
  ALL_AI_DIFFICULTIES,
  AI_DIFFICULTY_LABELS,
  GAME_META,
  type AiDifficulty,
  type GameType,
} from '@game-lobby/shared';
import { useAuth } from '../context/AuthContext';
import {
  closeRoom,
  emitAddBot,
  emitRemoveMember,
  emitSetRoles,
  emitStartGame,
} from '../lib/socket';
import type { GameStartOptionsPayload } from '../lib/start-game-options';
import { useRoomSession } from '../hooks/useRoomSession';
import { GAME_REGISTRY, renderGameSettings } from '../games/registry';

export function RoomPage() {
  const { gameType: gameTypeParam, roomId } = useParams<{ gameType: string; roomId: string }>();
  const gameTypeFromUrl = gameTypeParam as GameType;
  const lobbyPath = `/games/${gameTypeFromUrl}`;
  const { token, user } = useAuth();
  const [botDifficulty, setBotDifficulty] = useState<AiDifficulty>('medium');
  const [startOptions, setStartOptions] = useState<Partial<GameStartOptionsPayload>>({});

  const { room, error, setError, kicked, kickedMessage, closed, closedMessage, gameType, gameState } =
    useRoomSession({ roomId, token, lobbyPath });

  useEffect(() => {
    setStartOptions({});
  }, [roomId]);

  const handleStartOptionsChange = useCallback((options: Partial<GameStartOptionsPayload>) => {
    setStartOptions((prev) => ({ ...prev, ...options }));
  }, []);

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
  const isUndercoverFinalReveal =
    gameType === 'undercover' &&
    gameState != null &&
    (gameState as UndercoverGameState).phase === 'reveal' &&
    (gameState as UndercoverGameState).gameContinues === false;
  const isGameFinished =
    gameState != null && (isGameEnded(gameState) || isUndercoverFinalReveal);
  const isIntermission = room?.status === 'waiting' && gameState != null && isGameFinished;
  const isPreGame = room?.status === 'waiting' && !isIntermission;
  const orphanedPlaying = room?.status === 'playing' && gameState == null;
  const showSidePanels = isPreGame || isIntermission || orphanedPlaying;

  async function handleAddBot() {
    const res = await emitAddBot(botDifficulty);
    if (!res.ok) setError(res.message ?? '无法添加电脑');
  }

  async function handleRemoveMember(memberId: string, displayName: string, isBot: boolean) {
    if (!isBot && !window.confirm(`确定将 ${displayName} 移出房间吗？`)) return;
    const res = await emitRemoveMember(memberId);
    if (!res.ok) setError(res.message ?? '无法移除成员');
  }

  async function handleStartGame() {
    if (!room) return;
    const res = await emitStartGame(room.gameType, startOptions);
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
        {kickedMessage}
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
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
        同一时间只能待在一个房间；加入新房间会自动离开旧房间。
      </p>
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!p.isBot && (
                  <button className="btn btn-secondary" onClick={() => handleToggleRole(p.id)}>
                    {p.role === 'spectator' ? '设为玩家' : '设为旁观'}
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => handleRemoveMember(p.id, p.displayName, p.isBot)}
                >
                  {p.isBot ? '移除' : '移出'}
                </button>
              </div>
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

      {orphanedPlaying && isHost && (
        <p style={{ color: 'var(--warning)', fontSize: '0.85rem', marginTop: 0 }}>
          房间状态异常（无进行中的对局），请重新点击「开始游戏」。
        </p>
      )}

      {renderGameSettings(room.gameType, {
        isHost,
        isPlaying,
        isIntermission,
        gameState: gameState as import('@game-lobby/game-engine').GameState | null,
        onStartOptionsChange: handleStartOptionsChange,
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
          isHost={isHost}
          canStartNext={isIntermission}
          onStartNextGame={handleStartGame}
        />
      ) : null}
    </div>
  );
}
