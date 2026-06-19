import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import type { GoColor } from '@game-lobby/game-engine';
import { getStarPoints } from '@game-lobby/game-engine';
import type { GoBoardSize } from '@game-lobby/game-engine';

interface Props {
  boardSize: GoBoardSize;
  board: (GoColor | null)[][];
  lastMove: { x: number; y: number } | 'pass' | null;
  koPoint: { x: number; y: number } | null;
  canPlay: boolean;
  onPlay: (x: number, y: number) => void;
}

function stoneStyle(color: GoColor): CSSProperties {
  return {
    width: '82%',
    height: '82%',
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

export function GoBoard({ boardSize, board, lastMove, koPoint, canPlay, onPlay }: Props) {
  const starSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of getStarPoints(boardSize)) set.add(`${p.x},${p.y}`);
    return set;
  }, [boardSize]);

  const lastKey =
    lastMove && lastMove !== 'pass' ? `${lastMove.x},${lastMove.y}` : null;
  const koKey = koPoint ? `${koPoint.x},${koPoint.y}` : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
        aspectRatio: '1',
        background: '#c4a35a',
        border: '3px solid #8b6914',
        borderRadius: 4,
        padding: 4,
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.15)',
      }}
    >
      {board.map((row, y) =>
        row.map((cell, x) => {
          const key = `${x},${y}`;
          const isLast = lastKey === key;
          const isKo = koKey === key;
          const isStar = starSet.has(key);
          const clickable = canPlay && cell === null;

          return (
            <button
              key={key}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onPlay(x, y)}
              style={{
                position: 'relative',
                aspectRatio: '1',
                border: 'none',
                padding: 0,
                background: 'transparent',
                cursor: clickable ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
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
              {isStar && !cell && (
                <span
                  style={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#333',
                    opacity: 0.6,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {cell && (
                <span
                  style={{
                    ...stoneStyle(cell),
                    outline: isLast ? '2px solid #3b82f6' : isKo ? '2px dashed #ef4444' : undefined,
                    zIndex: 1,
                  }}
                />
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
