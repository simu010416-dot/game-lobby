import { useEffect, useState } from 'react';
import type { DaVinciColor, DaVinciGameState, DaVinciTile } from '../../types/game';

interface Props {
  state: DaVinciGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onGuess: (targetPlayerId: string, tileIndex: number, value: number) => void;
  onDecision: (shouldContinue: boolean) => void;
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
      if (t.value < 0) continue;
      if (t.revealed || p.id === viewerId) used.add(tileKey(t));
    }
  }
  const cur = state.players[state.currentPlayerIndex];
  if (cur && cur.id === viewerId && state.drawnTile && state.drawnTile.value >= 0) {
    used.add(tileKey(state.drawnTile));
  }

  let leftBound = tileIndex;
  for (let a = tileIndex - 1; a >= 0; a--) {
    const t = target.rack[a]!;
    if (t.revealed) {
      leftBound = tileKey(t) + (tileIndex - a);
      break;
    }
  }
  let rightBound = MAX_KEY - (target.rack.length - 1 - tileIndex);
  for (let b = tileIndex + 1; b < target.rack.length; b++) {
    const t = target.rack[b]!;
    if (t.revealed) {
      rightBound = tileKey(t) - (b - tileIndex);
      break;
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

function tileColors(color: DaVinciColor) {
  return color === 'white'
    ? { background: '#e2e8f0', color: '#0f172a', border: '#cbd5e1' }
    : { background: '#1e293b', color: '#f8fafc', border: '#0f172a' };
}

interface TileViewProps {
  tile: DaVinciTile;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

function TileView({ tile, selectable, selected, onClick }: TileViewProps) {
  const c = tileColors(tile.color);
  const label = tile.value >= 0 ? String(tile.value) : '?';
  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onClick}
      style={{
        width: 38,
        height: 52,
        borderRadius: 8,
        background: c.background,
        color: c.color,
        border: selected ? '2px solid var(--accent, #6366f1)' : `1px solid ${c.border}`,
        fontSize: '1.1rem',
        fontWeight: 700,
        cursor: selectable ? 'pointer' : 'default',
        opacity: tile.revealed ? 0.65 : 1,
        boxShadow: selected ? '0 0 0 2px rgba(99,102,241,0.4)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
      title={tile.revealed ? '已亮出' : '暗牌'}
    >
      {label}
    </button>
  );
}

export function DaVinciGame({ state, myMemberId, isSpectator, onGuess, onDecision }: Props) {
  const current = state.players[state.currentPlayerIndex];
  const isMyTurn = !isSpectator && current?.id === myMemberId && state.phase === 'playing';
  const [selected, setSelected] = useState<{ targetId: string; tileIndex: number } | null>(null);

  // Drop any stale selection whenever it's no longer actionable.
  useEffect(() => {
    if (!isMyTurn || state.stage !== 'guessing') setSelected(null);
  }, [isMyTurn, state.stage, state.currentPlayerIndex]);

  const candidates =
    selected && isMyTurn
      ? computeCandidates(state, myMemberId, selected.targetId, selected.tileIndex)
      : [];
  const candidateSet = new Set(candidates);

  function handleGuess(value: number) {
    if (!selected) return;
    onGuess(selected.targetId, selected.tileIndex, value);
    setSelected(null);
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>达芬奇密码</h2>
      <p style={{ color: 'var(--text-muted)' }}>{state.message}</p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>牌堆剩余：{state.deckCount}</span>
        {state.drawnTile && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {current?.id === myMemberId ? '你抽到：' : `${current?.name ?? '当前玩家'} 抽到：`}
            <TileView tile={state.drawnTile} />
          </span>
        )}
      </div>

      {state.lastAction && (
        <div
          style={{
            marginBottom: '1rem',
            fontSize: '0.9rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            background: 'var(--surface-2)',
            color: state.lastAction.correct ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)',
          }}
        >
          {state.lastAction.guesserName} 猜 {state.lastAction.targetName} 第 {state.lastAction.position + 1} 张（
          {state.lastAction.color === 'white' ? '白' : '黑'}）= {state.lastAction.guessedValue} →{' '}
          {state.lastAction.correct ? '猜中！' : '猜错'}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {state.players.map((p) => {
          const isCurrent = p.id === current?.id;
          const isMe = p.id === myMemberId;
          return (
            <div
              key={p.id}
              style={{
                background: 'var(--surface-2)',
                borderRadius: 8,
                padding: '0.75rem',
                opacity: p.eliminated ? 0.5 : 1,
                border: isCurrent ? '1px solid var(--accent, #6366f1)' : '1px solid transparent',
              }}
            >
              <strong>
                {p.name} {p.isBot && '🤖'} {isMe && '（你）'}
                {isCurrent && state.phase === 'playing' && ' ← 当前回合'}
                {p.eliminated && ' · 已出局'}
              </strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                {p.rack.map((tile, i) => {
                  const canSelect =
                    isMyTurn &&
                    state.stage === 'guessing' &&
                    !isMe &&
                    !p.eliminated &&
                    !tile.revealed;
                  return (
                    <TileView
                      key={i}
                      tile={tile}
                      selectable={canSelect}
                      selected={selected?.targetId === p.id && selected?.tileIndex === i}
                      onClick={canSelect ? () => setSelected({ targetId: p.id, tileIndex: i }) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isMyTurn && state.stage === 'guessing' && (
        <div style={{ marginTop: '1rem' }}>
          {!selected ? (
            <p style={{ color: 'var(--text-muted)' }}>点击一名对手的暗牌（带 ? 的牌）来猜测它的数字。</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                选择数字进行猜测（高亮为根据已知信息仍然可能的值）：
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {Array.from({ length: MAX_VALUE + 1 }, (_, v) => {
                  const possible = candidateSet.has(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      className="btn"
                      onClick={() => handleGuess(v)}
                      style={{
                        minWidth: 40,
                        opacity: possible ? 1 : 0.4,
                        background: possible ? undefined : 'var(--surface-2)',
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-secondary" style={{ width: 'fit-content' }} onClick={() => setSelected(null)}>
                取消选择
              </button>
            </div>
          )}
        </div>
      )}

      {isMyTurn && state.stage === 'deciding' && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ alignSelf: 'center', color: 'var(--success, #22c55e)' }}>猜中了！</span>
          <button className="btn" onClick={() => onDecision(true)}>
            继续猜测
          </button>
          <button className="btn btn-secondary" onClick={() => onDecision(false)}>
            停止结算（放回暗牌）
          </button>
        </div>
      )}

      {state.phase === 'ended' && (
        <div style={{ marginTop: '1rem', color: 'var(--success, #22c55e)', fontWeight: 600 }}>
          {state.message}
        </div>
      )}
    </div>
  );
}
