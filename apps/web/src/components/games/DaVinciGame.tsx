import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  isMusicEnabled,
  isSfxEnabled,
  playDrawSound,
  playGuessCorrect,
  playGuessWrong,
  playPlaceJoker,
  playTurnSound,
  playVictorySound,
  setMusicEnabled,
  setSfxEnabled,
  unlockAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
} from '../../lib/game-sounds';
import { JOKER_VALUE } from '../../types/game';
import type { DaVinciColor, DaVinciGameState, DaVinciTile } from '../../types/game';
import type { DaVinciLastAction } from '../../types/game';

const DaVinciBoard3D = lazy(() =>
  import('./DaVinciBoard3D').then((m) => ({ default: m.DaVinciBoard3D })),
);

interface Props {
  state: DaVinciGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onGuess: (targetPlayerId: string, tileIndex: number, value: number) => void;
  onDecision: (shouldContinue: boolean) => void;
  onPlaceJoker: (index: number) => void;
  onSubmitSetup: (tiles: { color: DaVinciColor; value: number; isJoker: boolean }[]) => void;
}

function tileText(tile: DaVinciTile): string {
  if (tile.isJoker) return '-';
  return tile.value >= 0 ? String(tile.value) : '?';
}

const MAX_VALUE = 11;
const MAX_KEY = MAX_VALUE * 2 + 1;

function tileKey(tile: { color: DaVinciColor; value: number }): number {
  return tile.value * 2 + (tile.color === 'white' ? 1 : 0);
}

// Mirror of the engine's deduction: which values can a given face-down opponent
// tile still hold, given what this client can see. Used purely as a hint.
function computeCandidates(
  state: DaVinciGameState,
  viewerId: string | null,
  targetId: string,
  tileIndex: number,
): number[] {
  const target = state.players.find((p) => p.id === targetId);
  if (!target) return [];
  const tile = target.rack[tileIndex];
  if (!tile || tile.revealed) return [];
  const parity = tile.color === 'white' ? 1 : 0;

  const used = new Set<number>();
  for (const p of state.players) {
    for (const t of p.rack) {
      if (t.isJoker || t.value < 0) continue;
      if (t.revealed || p.id === viewerId) used.add(tileKey(t));
    }
  }
  const cur = state.players[state.currentPlayerIndex];
  if (cur && cur.id === viewerId && state.drawnTile && !state.drawnTile.isJoker && state.drawnTile.value >= 0) {
    used.add(tileKey(state.drawnTile));
  }

  let leftBound: number;
  let rightBound: number;
  if (state.useJoker) {
    // A hidden tile might be a Joker, so positional ordering can't narrow it.
    leftBound = 0;
    rightBound = MAX_KEY;
  } else {
    leftBound = tileIndex;
    for (let a = tileIndex - 1; a >= 0; a--) {
      const t = target.rack[a]!;
      if (t.revealed) {
        leftBound = tileKey(t) + (tileIndex - a);
        break;
      }
    }
    rightBound = MAX_KEY - (target.rack.length - 1 - tileIndex);
    for (let b = tileIndex + 1; b < target.rack.length; b++) {
      const t = target.rack[b]!;
      if (t.revealed) {
        rightBound = tileKey(t) - (b - tileIndex);
        break;
      }
    }
  }

  const candidates: number[] = [];
  for (let k = Math.max(0, leftBound); k <= Math.min(MAX_KEY, rightBound); k++) {
    if (k % 2 !== parity) continue;
    if (used.has(k)) continue;
    candidates.push((k - parity) / 2);
  }
  return candidates;
}

// Could the still-hidden tile be a Joker the viewer can't account for yet?
function jokerStillPossible(
  state: DaVinciGameState,
  viewerId: string | null,
  color: DaVinciColor,
): boolean {
  if (!state.useJoker) return false;
  for (const p of state.players) {
    for (const t of p.rack) {
      if (!t.isJoker || t.color !== color) continue;
      if (t.revealed || p.id === viewerId) return false;
    }
  }
  const cur = state.players[state.currentPlayerIndex];
  if (cur && cur.id === viewerId && state.drawnTile?.isJoker && state.drawnTile.color === color) {
    return false;
  }
  return true;
}

type HistoryEntry = DaVinciLastAction & { id: number };

export function DaVinciGame({
  state,
  myMemberId,
  isSpectator,
  onGuess,
  onDecision,
  onPlaceJoker,
  onSubmitSetup,
}: Props) {
  const assistMode = state.assistMode !== false;
  const current = state.players[state.currentPlayerIndex];
  const isMyTurn = !isSpectator && current?.id === myMemberId && state.phase === 'playing';
  const [selected, setSelected] = useState<{ targetId: string; tileIndex: number } | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [guessPanelOpen, setGuessPanelOpen] = useState(true);
  const [sfxOn, setSfxOn] = useState(isSfxEnabled);
  const [musicOn, setMusicOn] = useState(isMusicEnabled);

  // Accumulate a guess log from the rolling `lastAction` the server sends.
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const lastSigRef = useRef<string | null>(null);
  const histIdRef = useRef(0);
  useEffect(() => {
    const la = state.lastAction;
    if (!la) {
      // A fresh game (or pre-first-guess state) clears the log.
      if (lastSigRef.current !== null) {
        lastSigRef.current = null;
        setHistory([]);
      }
      return;
    }
    const sig = `${la.guesserId}|${la.targetId}|${la.position}|${la.color}|${la.guessedValue}|${la.correct}`;
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      setHistory((h) => [{ ...la, id: histIdRef.current++ }, ...h].slice(0, 60));
    }
  }, [state.lastAction]);

  // Drop any stale selection whenever it's no longer actionable.
  useEffect(() => {
    if (!isMyTurn || state.stage !== 'guessing') setSelected(null);
  }, [isMyTurn, state.stage, state.currentPlayerIndex]);

  // Background music while the match is active.
  useEffect(() => {
    if (state.phase !== 'ended') {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
    return () => stopBackgroundMusic();
  }, [state.phase]);

  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== 'ended' && state.phase === 'ended' && state.winnerId) {
      playVictorySound();
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.winnerId]);

  // Game sound effects — keyed off server state transitions.
  const actionSigRef = useRef<string | null>(null);
  useEffect(() => {
    const la = state.lastAction;
    if (!la || state.phase !== 'playing') return;
    const sig = `${la.guesserId}|${la.targetId}|${la.position}|${la.guessedValue}|${la.correct}`;
    if (sig === actionSigRef.current) return;
    actionSigRef.current = sig;
    if (la.correct) playGuessCorrect();
    else playGuessWrong();
  }, [state.lastAction, state.phase]);

  const hadDrawnRef = useRef(false);
  useEffect(() => {
    const hasDrawn = state.phase === 'playing' && state.drawnTile != null;
    if (hasDrawn && !hadDrawnRef.current) playDrawSound();
    hadDrawnRef.current = hasDrawn;
    if (state.phase !== 'playing') hadDrawnRef.current = false;
  }, [state.drawnTile, state.phase]);

  const prevStageRef = useRef(state.stage);
  useEffect(() => {
    if (state.phase !== 'playing') {
      prevStageRef.current = state.stage;
      return;
    }
    if (prevStageRef.current !== 'placing' && state.stage === 'placing') playPlaceJoker();
    prevStageRef.current = state.stage;
  }, [state.stage, state.phase]);

  const prevTurnRef = useRef(state.currentPlayerIndex);
  useEffect(() => {
    if (state.phase !== 'playing') {
      prevTurnRef.current = state.currentPlayerIndex;
      return;
    }
    if (
      prevTurnRef.current !== state.currentPlayerIndex &&
      state.stage === 'guessing' &&
      state.drawnTile == null
    ) {
      playTurnSound();
    }
    prevTurnRef.current = state.currentPlayerIndex;
  }, [state.currentPlayerIndex, state.stage, state.drawnTile, state.phase]);

  const candidates =
    assistMode && selected && isMyTurn
      ? computeCandidates(state, myMemberId, selected.targetId, selected.tileIndex)
      : [];
  const candidateSet = new Set(candidates);

  const selectedTile =
    selected != null
      ? state.players.find((p) => p.id === selected.targetId)?.rack[selected.tileIndex] ?? null
      : null;
  const jokerGuessPossible =
    state.useJoker &&
    selectedTile != null &&
    (assistMode ? jokerStillPossible(state, myMemberId, selectedTile.color) : true);

  function handleGuess(value: number) {
    if (!selected) return;
    onGuess(selected.targetId, selected.tileIndex, value);
    setSelected(null);
  }

  const me = myMemberId != null ? state.players.find((p) => p.id === myMemberId) ?? null : null;
  const isPlacing = isMyTurn && state.stage === 'placing';

  const inSetup = state.phase === 'setup';
  const iAmReady = myMemberId != null && state.setupReady.includes(myMemberId);
  const needSetup = inSetup && !isSpectator && me != null && !iAmReady;

  // Local working copy of my starting rack while arranging Jokers in setup.
  const [setupRack, setSetupRack] = useState<DaVinciTile[]>([]);
  const setupKey = needSetup ? (me?.rack.map((t) => `${t.color}${t.isJoker ? 'J' : t.value}`).join(',') ?? '') : '';
  useEffect(() => {
    if (needSetup && me) setSetupRack(me.rack.map((t) => ({ ...t })));
    else setSetupRack([]);
    // Re-seed only when entering setup or the dealt rack identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needSetup, setupKey]);

  function moveJoker(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= setupRack.length) return;
    const next = [...setupRack];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setSetupRack(next);
  }

  const totalSetup = state.players.length;
  const readyCount = state.setupReady.length;

  const drawnLabel = state.drawnTile ? tileText(state.drawnTile) : null;

  const ended = state.phase === 'ended';
  const winner = state.winnerId != null ? state.players.find((p) => p.id === state.winnerId) ?? null : null;
  const iWon = state.winnerId != null && state.winnerId === myMemberId;

  return (
    <div
      className="card"
      style={{
        position: 'relative',
        padding: 0,
        height: 'min(72vh, 640px)',
        overflow: 'hidden',
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              background: 'radial-gradient(ellipse at top, #16243f 0%, #0a0f18 70%)',
            }}
          >
            正在加载 3D 牌桌…
          </div>
        }
      >
        <DaVinciBoard3D
          state={state}
          myMemberId={myMemberId}
          isMyTurn={isMyTurn}
          selected={selected}
          onSelectTile={(targetId, tileIndex) => setSelected({ targetId, tileIndex })}
        />
      </Suspense>

      {/* Overlay layer: panels capture clicks, the gaps fall through to the canvas. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
        {/* Top-left: title, status, audio */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            maxWidth: infoPanelOpen ? 'min(60%, 360px)' : undefined,
            pointerEvents: 'auto',
            ...panelStyle,
          }}
        >
          <button
            type="button"
            onClick={() => setInfoPanelOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              width: '100%',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              marginBottom: infoPanelOpen ? '0.35rem' : 0,
            }}
          >
            <strong style={{ fontSize: '1rem' }}>达芬奇密码</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              {infoPanelOpen ? '收起 ▲' : '展开 ▼'}
            </span>
          </button>
          {infoPanelOpen ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {inSetup ? (
                  <span style={{ fontSize: '0.78rem', color: '#c4b5fd' }}>开局摆放 · {readyCount}/{totalSetup}</span>
                ) : (
                  <>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>牌堆 {state.deckCount}</span>
                    {drawnLabel && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {current?.id === myMemberId ? '你抽到 ' : `${current?.name ?? '当前'}抽到 `}
                        <strong style={{ color: 'var(--text)' }}>{drawnLabel}</strong>
                      </span>
                    )}
                  </>
                )}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  辅助：{assistMode ? '开' : '关'}
                </span>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {inSetup
                  ? '牌桌暂不上牌，请在下方完成摆放。全员确认后同时发牌，避免暴露 Joker。'
                  : state.message}
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: '0.35rem',
                  marginTop: '0.45rem',
                  flexWrap: 'wrap',
                }}
              >
                <AudioToggle
                  label="音效"
                  active={sfxOn}
                  onToggle={() => {
                    const next = !sfxOn;
                    setSfxOn(next);
                    setSfxEnabled(next);
                  }}
                />
                <AudioToggle
                  label="音乐"
                  active={musicOn}
                  onToggle={() => {
                    const next = !musicOn;
                    setMusicOn(next);
                    setMusicEnabled(next);
                    if (next) {
                      startBackgroundMusic();
                      unlockAudio();
                    }
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {inSetup ? (
                <span>摆放 {readyCount}/{totalSetup}</span>
              ) : (
                <span>牌堆 {state.deckCount}</span>
              )}
              <span>·</span>
              <span>{sfxOn ? '🔊' : '🔇'}</span>
              <span>{musicOn ? '🎵' : '🔕'}</span>
            </div>
          )}
        </div>

        {/* Top-right: guess history log */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: historyOpen ? 'min(46%, 240px)' : 'auto',
            maxHeight: historyOpen ? '46%' : undefined,
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
            ...panelStyle,
          }}
        >
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              width: '100%',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: historyOpen ? '0.4rem' : 0,
            }}
          >
            <span>猜测记录{!historyOpen && history.length > 0 ? ` (${history.length})` : ''}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{historyOpen ? '收起 ▲' : '展开 ▼'}</span>
          </button>
          {historyOpen && (
            <div style={{ overflowY: 'auto', display: 'grid', gap: '0.3rem', paddingRight: 2 }}>
              {history.length === 0 ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>暂无记录</span>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      fontSize: '0.76rem',
                      lineHeight: 1.35,
                      padding: '0.3rem 0.45rem',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.04)',
                      borderLeft: `3px solid ${h.correct ? 'var(--success)' : 'var(--danger)'}`,
                      color: 'var(--text)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{h.guesserName}</span> 猜{' '}
                    <span style={{ color: 'var(--text-muted)' }}>{h.targetName}</span> 第{h.position + 1}张（
                    {h.color === 'white' ? '白' : '黑'}）={h.guessedValue}{' '}
                    <span style={{ color: h.correct ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                      {h.correct ? '✓中' : '✗错'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bottom-center: actions */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            width: 'min(92%, 560px)',
            pointerEvents: 'auto',
          }}
        >
          {inSetup && needSetup && (
            <div style={{ ...panelStyle, display: 'grid', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                在下方面板安排起始牌（数字顺序固定，Joker 可移动）。确认后等待全员完成，牌才会一起上桌。
              </p>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', opacity: 0.85 }}>
                黑 0 → 白 11（从左到右递增）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', alignItems: 'flex-end' }}>
                {setupRack.map((t, i) => (
                  <div key={i} style={{ display: 'grid', gap: 2, justifyItems: 'center' }}>
                    <MiniTile tile={t} />
                    {t.isJoker ? (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0 6px', minWidth: 0 }}
                          disabled={i === 0}
                          onClick={() => moveJoker(i, -1)}
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0 6px', minWidth: 0 }}
                          disabled={i === setupRack.length - 1}
                          onClick={() => moveJoker(i, 1)}
                        >
                          ▶
                        </button>
                      </div>
                    ) : (
                      <div style={{ height: 22 }} />
                    )}
                  </div>
                ))}
              </div>
              <button
                className="btn"
                style={{ justifySelf: 'center' }}
                onClick={() =>
                  onSubmitSetup(
                    setupRack.map((t) => ({ color: t.color, value: t.value, isJoker: t.isJoker })),
                  )
                }
              >
                确认摆放（{readyCount}/{totalSetup} 已完成）
              </button>
            </div>
          )}

          {inSetup && !needSetup && (
            <div style={{ ...panelStyle, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              等待所有玩家完成摆放… {readyCount}/{totalSetup}
            </div>
          )}

          {isMyTurn && state.stage === 'guessing' && (
            <div style={{ ...panelStyle }}>
              {!selected ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  点击一名对手的暗牌（带 ? 的牌）来猜测它的数字。
                </p>
              ) : guessPanelOpen ? (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {assistMode
                        ? '选择数字进行猜测（高亮为仍然可能的值）：'
                        : '选择数字进行猜测（无辅助，可猜任意数字）：'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', minWidth: 0, flexShrink: 0 }}
                      onClick={() => setGuessPanelOpen(false)}
                    >
                      收起
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center' }}>
                    {Array.from({ length: MAX_VALUE + 1 }, (_, v) => {
                      const possible = !assistMode || candidateSet.has(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          className="btn"
                          onClick={() => handleGuess(v)}
                          style={{
                            minWidth: 40,
                            opacity: possible ? 1 : 0.4,
                            background: assistMode && !possible ? 'var(--surface-2)' : undefined,
                          }}
                        >
                          {v}
                        </button>
                      );
                    })}
                    {jokerGuessPossible && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleGuess(JOKER_VALUE)}
                        style={{ minWidth: 48, background: 'linear-gradient(180deg, #a855f7, #7c3aed)' }}
                        title="猜这张是 Joker"
                      >
                        [-]
                      </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>已选中暗牌，选数面板已收起</span>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    onClick={() => setGuessPanelOpen(true)}
                  >
                    展开选数
                  </button>
                  <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                    取消
                  </button>
                </div>
              )}
            </div>
          )}

          {isPlacing && me && (
            <div style={{ ...panelStyle, display: 'grid', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                选择位置插入你的 Joker（{state.placement?.faceUp ? '将亮出' : '暗置'}）。点击牌之间的缝隙。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', alignItems: 'center' }}>
                <InsertSlot onClick={() => onPlaceJoker(0)} />
                {me.rack.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <MiniTile tile={t} />
                    <InsertSlot onClick={() => onPlaceJoker(i + 1)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {isMyTurn && state.stage === 'deciding' && (
            <div style={{ ...panelStyle, display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>猜中了！</span>
              <button className="btn" onClick={() => onDecision(true)}>
                继续猜测
              </button>
              <button className="btn btn-secondary" onClick={() => onDecision(false)}>
                停止结算
              </button>
            </div>
          )}

        </div>

        {/* Center: animated end-of-game banner */}
        {ended && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 40,
                background: 'rgba(0, 0, 0, 0.42)',
                pointerEvents: 'none',
              }}
            />
            <div
              key={state.winnerId ?? 'end'}
              style={{
                position: 'absolute',
                left: '50%',
                top: '36%',
                transform: 'translate(-50%, -50%)',
                zIndex: 50,
                pointerEvents: 'none',
                textAlign: 'center',
                padding: '1.1rem 1.8rem',
                borderRadius: 16,
                background: iWon
                  ? 'linear-gradient(160deg, rgba(245,158,11,0.95), rgba(217,119,6,0.95))'
                  : 'rgba(12, 18, 30, 0.92)',
                border: iWon ? '1px solid #fde047' : '1px solid rgba(255,255,255,0.12)',
                color: iWon ? '#1a1206' : 'var(--text)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
                animation: 'dv-banner-pop 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both, dv-banner-glow 2.2s ease-in-out 0.5s infinite',
              }}
            >
              <div style={{ fontSize: '2.2rem', lineHeight: 1, marginBottom: '0.3rem' }}>
                {iWon ? '🎉' : '🏆'}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                {iWon ? '胜利！' : winner ? `${winner.name} 获胜` : '游戏结束'}
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.9rem', opacity: 0.85 }}>
                {iWon ? '你赢得了本局' : state.message}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MiniTile({ tile }: { tile: DaVinciTile }) {
  const white = tile.color === 'white';
  return (
    <div
      style={{
        width: 30,
        height: 42,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: '1rem',
        background: white ? '#e9edf4' : '#171f2c',
        color: white ? '#0f172a' : '#f1f5f9',
        border: tile.revealed ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
      }}
    >
      {tileText(tile)}
    </div>
  );
}

function AudioToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${active ? '关闭' : '开启'}${label}`}
      style={{
        padding: '0.2rem 0.55rem',
        fontSize: '0.72rem',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.12)',
        background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
        color: active ? '#c7d2fe' : 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {active ? '🔊' : '🔇'} {label}
    </button>
  );
}

function InsertSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="插入到这里"
      style={{
        width: 16,
        height: 46,
        borderRadius: 6,
        border: '2px dashed rgba(168,85,247,0.7)',
        background: 'rgba(168,85,247,0.12)',
        cursor: 'pointer',
        padding: 0,
      }}
    />
  );
}

const panelStyle: CSSProperties = {
  background: 'rgba(12, 18, 30, 0.72)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '0.6rem 0.75rem',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
};
