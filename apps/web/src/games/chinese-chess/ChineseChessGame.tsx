import { useMemo, useState } from 'react';
import type { ChineseChessGameState } from '@game-lobby/game-engine';
import { replayChineseChessToIndex } from '@game-lobby/game-engine';
import { XiangqiBoard } from './XiangqiBoard';
import { MoveList } from './MoveList';
import { computeChineseChessHint } from './hint-engine';

interface Props {
  state: ChineseChessGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onMove: (from: string, to: string) => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (accept: boolean) => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function endReasonLabel(reason: ChineseChessGameState['endReason']): string {
  switch (reason) {
    case 'checkmate':
      return '将死';
    case 'stalemate':
      return '困毙';
    case 'draw':
      return '和棋';
    case 'agreement':
      return '协议和棋';
    case 'resignation':
      return '认输';
    case 'timeout':
      return '超时';
    default:
      return '';
  }
}

export function ChineseChessGame({
  state,
  myMemberId,
  isSpectator,
  onMove,
  onResign,
  onOfferDraw,
  onRespondDraw,
}: Props) {
  const me = state.players.find((p) => p.id === myMemberId);
  const current = state.players.find((p) => p.color === state.currentColor);
  const isMyTurn =
    !isSpectator && current?.id === myMemberId && state.phase === 'playing';
  const ended = state.phase === 'ended';
  const winner =
    state.winnerId != null
      ? (state.players.find((p) => p.id === state.winnerId) ?? null)
      : null;
  const iWon = state.winnerId != null && state.winnerId === myMemberId;

  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);

  const replayView = useMemo(() => {
    if (replayIndex == null) return null;
    return replayChineseChessToIndex(state, replayIndex);
  }, [state, replayIndex]);

  const drawPending =
    state.drawOffer != null && me && state.drawOffer.fromColor !== me.color;

  function handleHint() {
    if (!isMyTurn) return;
    const result = computeChineseChessHint(state);
    setHint(result ? { from: result.from, to: result.to } : null);
  }

  function handleMove(from: string, to: string) {
    setHint(null);
    setReplayIndex(null);
    onMove(from, to);
  }

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
        <XiangqiBoard
          state={state}
          displayFen={replayView?.fen}
          myColor={me?.color ?? null}
          canPlay={isMyTurn && replayIndex == null}
          hintSquares={hint}
          onMove={handleMove}
        />

        <div style={{ flex: '0 1 260px', minWidth: 220 }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>中国象棋</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {replayIndex != null ? `复盘：第 ${replayIndex} 手` : state.message}
          </p>

          {state.inCheck && !ended && replayIndex == null && (
            <p style={{ margin: '0 0 0.75rem', color: '#f87171', fontSize: '0.85rem' }}>将军！</p>
          )}

          {state.timeSettings && (
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              {state.players.map((p) => {
                const active = current?.id === p.id && !ended;
                const timeSettings = state.timeSettings!;
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      background: active ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255,255,255,0.04)',
                      border: active
                        ? '1px solid rgba(239, 68, 68, 0.4)'
                        : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {p.name}
                      {p.id === myMemberId ? '（你）' : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {p.color === 'red' ? '红方' : '黑方'}
                      {active ? ' · 当前回合' : ''}
                    </div>
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontVariantNumeric: 'tabular-nums',
                        marginTop: 4,
                      }}
                    >
                      {formatTime(p.mainTimeMs)}
                      {!ended && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginLeft: 6,
                          }}
                        >
                          +{Math.round(timeSettings.incrementMs / 1000)}s/步
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!state.timeSettings && !ended && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              本局不限时
            </p>
          )}

          <MoveList
            state={state}
            replayIndex={replayIndex}
            onSelectMove={setReplayIndex}
          />

          {!ended && !isSpectator && me && replayIndex == null && (
            <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {isMyTurn ? '点击棋子并选择目标格走子' : `等待 ${current?.name ?? '对手'} 走子`}
              </p>

              {isMyTurn && (
                <button type="button" className="btn" onClick={handleHint}>
                  提示
                </button>
              )}

              {drawPending ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn" style={{ flex: 1 }} onClick={() => onRespondDraw(true)}>
                    接受和棋
                  </button>
                  <button type="button" className="btn" style={{ flex: 1 }} onClick={() => onRespondDraw(false)}>
                    拒绝
                  </button>
                </div>
              ) : (
                <button type="button" className="btn" onClick={onOfferDraw}>
                  求和
                </button>
              )}

              <button type="button" className="btn" onClick={onResign}>
                认输
              </button>
            </div>
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
                background: winner ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                border: winner
                  ? '1px solid rgba(34, 197, 94, 0.35)'
                  : '1px solid rgba(148, 163, 184, 0.35)',
              }}
            >
              <strong>
                {winner
                  ? iWon
                    ? '你赢了！'
                    : `${winner.name} 获胜`
                  : endReasonLabel(state.endReason) || '和棋'}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
