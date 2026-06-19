import { useMemo } from 'react';
import type { GomokuGameState, GomokuStone } from '@game-lobby/game-engine';

interface Props {
  state: GomokuGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onPlace: (row: number, col: number) => void;
}

function stoneStyle(color: GomokuStone): React.CSSProperties {
  return {
    width: '78%',
    height: '78%',
    borderRadius: '50%',
    background:
      color === 'black'
        ? 'radial-gradient(circle at 35% 35%, #555, #111)'
        : 'radial-gradient(circle at 35% 30%, #fff, #ccc)',
    boxShadow:
      color === 'black'
        ? '0 2px 6px rgba(0,0,0,0.5)'
        : '0 2px 6px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(0,0,0,0.08)',
  };
}

export function GomokuGame({ state, myMemberId, isSpectator, onPlace }: Props) {
  const current = state.players[state.currentPlayerIndex];
  const isMyTurn =
    !isSpectator && current?.id === myMemberId && state.phase === 'playing';
  const me = state.players.find((p) => p.id === myMemberId);
  const ended = state.phase === 'ended';
  const winner =
    state.winnerId != null
      ? (state.players.find((p) => p.id === state.winnerId) ?? null)
      : null;
  const iWon = state.winnerId != null && state.winnerId === myMemberId;

  const winSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of state.winLine ?? []) set.add(`${c.row},${c.col}`);
    return set;
  }, [state.winLine]);

  const lastMoveKey =
    state.lastMove != null ? `${state.lastMove.row},${state.lastMove.col}` : null;

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        <div style={{ flex: '1 1 280px', maxWidth: 520 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${state.boardSize}, 1fr)`,
              aspectRatio: '1',
              background: '#c4a35a',
              border: '3px solid #8b6914',
              borderRadius: 4,
              padding: 4,
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.15)',
            }}
          >
            {state.board.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r},${c}`;
                const isLast = lastMoveKey === key;
                const isWin = winSet.has(key);
                const canPlace = isMyTurn && cell === null;

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!canPlace}
                    onClick={() => canPlace && onPlace(r, c)}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      border: 'none',
                      padding: 0,
                      background: 'transparent',
                      cursor: canPlace ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={canPlace ? `落子 (${r}, ${c})` : undefined}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `
                          linear-gradient(to right, transparent calc(50% - 0.5px), rgba(0,0,0,0.35) calc(50% - 0.5px), rgba(0,0,0,0.35) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
                          linear-gradient(to bottom, transparent calc(50% - 0.5px), rgba(0,0,0,0.35) calc(50% - 0.5px), rgba(0,0,0,0.35) calc(50% + 0.5px), transparent calc(50% + 0.5px))
                        `,
                        pointerEvents: 'none',
                      }}
                    />
                    {cell && (
                      <span
                        style={{
                          ...stoneStyle(cell),
                          outline: isWin
                            ? '3px solid #fbbf24'
                            : isLast
                              ? '2px solid #3b82f6'
                              : undefined,
                          zIndex: 1,
                        }}
                      />
                    )}
                    {canPlace && (
                      <span
                        style={{
                          width: '30%',
                          height: '30%',
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.08)',
                          zIndex: 1,
                        }}
                      />
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <div style={{ flex: '0 1 220px', minWidth: 200 }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>五子棋</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {state.message}
          </p>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {state.players.map((p) => {
              const active = current?.id === p.id && !ended;
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 8,
                    background: active ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255,255,255,0.04)',
                    border: active
                      ? '1px solid rgba(59, 130, 246, 0.4)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span style={stoneStyle(p.color)} />
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {p.name}
                      {p.id === myMemberId ? '（你）' : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {p.color === 'black' ? '黑棋' : '白棋'}
                      {active ? ' · 当前回合' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!ended && !isSpectator && me && (
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isMyTurn ? '点击棋盘交叉点落子' : `等待 ${current?.name ?? '对手'} 落子`}
            </p>
          )}

          {isSpectator && !ended && (
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              旁观模式
            </p>
          )}

          {ended && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: 8,
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
              }}
            >
              <strong>
                {winner
                  ? iWon
                    ? '你赢了！'
                    : `${winner.name} 获胜`
                  : '和棋'}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
