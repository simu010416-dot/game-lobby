import { useMemo } from 'react';
import type { GoGameState } from '@game-lobby/game-engine';
import { GoBoard } from './GoBoard';

interface Props {
  state: GoGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onPlay: (x: number, y: number) => void;
  onPass: () => void;
  onResign: () => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function playerTimeLabel(player: GoGameState['players'][0]): string {
  if (player.mainTimeMs > 0) return formatTime(player.mainTimeMs);
  if (player.byoyomiPeriodsLeft <= 0) return '0:00';
  return `${formatTime(player.byoyomiRemainingMs)} ×${player.byoyomiPeriodsLeft}`;
}

export function GoGame({ state, myMemberId, isSpectator, onPlay, onPass, onResign }: Props) {
  const currentPlayer = state.players.find((p) => p.color === state.currentColor);
  const me = state.players.find((p) => p.id === myMemberId);
  const isMyTurn =
    !isSpectator && currentPlayer?.id === myMemberId && state.phase === 'playing';
  const ended = state.phase === 'ended';
  const winner = state.winnerId
    ? (state.players.find((p) => p.id === state.winnerId) ?? null)
    : null;
  const iWon = state.winnerId != null && state.winnerId === myMemberId;

  const black = state.players.find((p) => p.color === 'black');
  const white = state.players.find((p) => p.color === 'white');

  const boardMaxWidth = useMemo(() => {
    if (state.boardSize >= 19) return 560;
    if (state.boardSize >= 13) return 480;
    return 400;
  }, [state.boardSize]);

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
        <div style={{ flex: `1 1 ${boardMaxWidth}px`, maxWidth: boardMaxWidth }}>
          <GoBoard
            boardSize={state.boardSize}
            board={state.board}
            lastMove={state.lastMove}
            koPoint={state.koPoint}
            canPlay={isMyTurn}
            onPlay={onPlay}
          />
        </div>

        <div style={{ flex: '1 1 220px', minWidth: 200, display: 'grid', gap: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>{state.message}</p>

          {black && white && (
            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                  background:
                    state.currentColor === 'black' && !ended
                      ? 'var(--surface-2)'
                      : 'transparent',
                  border:
                    state.currentColor === 'black' && !ended
                      ? '1px solid var(--accent)'
                      : '1px solid transparent',
                }}
              >
                <strong>黑</strong> · {black.name}
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  提子 {black.captured} · {playerTimeLabel(black)}
                </div>
              </div>
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                  background:
                    state.currentColor === 'white' && !ended
                      ? 'var(--surface-2)'
                      : 'transparent',
                  border:
                    state.currentColor === 'white' && !ended
                      ? '1px solid var(--accent)'
                      : '1px solid transparent',
                }}
              >
                <strong>白</strong> · {white.name}
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  提子 {white.captured} · 贴目 {state.komi} ·{' '}
                  {playerTimeLabel(white)}
                </div>
              </div>
            </div>
          )}

          {state.handicap > 0 && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              让子：{state.handicap}
            </p>
          )}

          {me && !isSpectator && state.phase === 'playing' && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                disabled={!isMyTurn}
                onClick={onPass}
              >
                Pass
              </button>
              <button className="btn btn-secondary" onClick={onResign}>
                认输
              </button>
            </div>
          )}

          {ended && (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: 8,
                background: 'var(--surface-2)',
              }}
            >
              {state.score ? (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                  终局数子：黑 {state.score.black} : 白 {state.score.white.toFixed(1)}
                </p>
              ) : null}
              <p style={{ margin: 0, fontWeight: 600 }}>
                {state.winnerId == null
                  ? '和棋'
                  : iWon
                    ? '你赢了！'
                    : winner
                      ? `${winner.name} 获胜`
                      : '对局结束'}
              </p>
            </div>
          )}

          {isSpectator && state.phase === 'playing' && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              观战模式
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
