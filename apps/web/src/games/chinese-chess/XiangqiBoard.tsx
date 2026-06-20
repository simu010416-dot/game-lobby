import { useMemo, useState } from 'react';
import type { ChineseChessColor, ChineseChessGameState, ChineseChessMoveOption } from '@game-lobby/game-engine';
import { getChineseChessLegalMoves } from '@game-lobby/game-engine';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

const PIECE_GLYPH: Record<string, string> = {
  R: '車',
  N: '馬',
  B: '相',
  A: '仕',
  K: '帥',
  C: '炮',
  P: '兵',
  r: '車',
  n: '馬',
  b: '象',
  a: '士',
  k: '將',
  c: '炮',
  p: '卒',
};

function parseBoard(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0]!.split('/');
  return rows.map((row) => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

function squareName(fileIndex: number, rankIndex: number, flipped: boolean): string {
  const file = flipped ? FILES[8 - fileIndex]! : FILES[fileIndex]!;
  const rank = flipped ? rankIndex : 9 - rankIndex;
  return `${file}${rank}`;
}

function isOwnPiece(piece: string, color: ChineseChessColor): boolean {
  const isRedPiece = piece === piece.toUpperCase();
  return color === 'red' ? isRedPiece : !isRedPiece;
}

interface Props {
  state: ChineseChessGameState;
  displayFen?: string;
  myColor: ChineseChessColor | null;
  canPlay: boolean;
  hintSquares?: { from: string; to: string } | null;
  onMove: (from: string, to: string) => void;
}

export function XiangqiBoard({
  state,
  displayFen,
  myColor,
  canPlay,
  hintSquares,
  onMove,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const fen = displayFen ?? state.fen;
  const flipped = myColor === 'black';
  const board = useMemo(() => parseBoard(fen), [fen]);

  const viewState = displayFen ? { ...state, fen: displayFen } : state;

  const legalMoves = useMemo(() => {
    if (!selected || displayFen) return [] as ChineseChessMoveOption[];
    return getChineseChessLegalMoves(viewState, selected);
  }, [viewState, selected, displayFen]);

  const legalTargets = useMemo(() => new Set(legalMoves.map((m) => m.to)), [legalMoves]);

  const displayRows = useMemo(() => {
    const rows = flipped ? [...board].reverse() : board;
    return rows.map((row) => (flipped ? [...row].reverse() : row));
  }, [board, flipped]);

  function handleSquareClick(fileIndex: number, rankIndex: number, piece: string | null) {
    if (!canPlay || displayFen) return;

    const sq = squareName(fileIndex, rankIndex, flipped);

    if (selected && legalTargets.has(sq)) {
      onMove(selected, sq);
      setSelected(null);
      return;
    }

    if (piece && myColor && isOwnPiece(piece, myColor)) {
      setSelected(sq);
      return;
    }

    setSelected(null);
  }

  const lastTo = state.lastMove?.to ?? null;

  return (
    <div
      style={{
        position: 'relative',
        padding: 8,
        background: '#c4a574',
        borderRadius: 6,
        border: '3px solid #5c4033',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9, 1fr)',
          aspectRatio: '9 / 10',
          maxWidth: 450,
          position: 'relative',
        }}
      >
        {displayRows.map((row, rankIndex) =>
          row.map((piece, fileIndex) => {
            const sq = squareName(fileIndex, rankIndex, flipped);
            const isSelected = selected === sq;
            const isTarget = legalTargets.has(sq);
            const isLast = lastTo === sq;
            const isHintFrom = hintSquares?.from === sq;
            const isHintTo = hintSquares?.to === sq;
            const hasRiverAbove = !flipped ? rankIndex === 4 : rankIndex === 5;

            return (
              <button
                key={sq}
                type="button"
                disabled={!canPlay && !piece}
                onClick={() => handleSquareClick(fileIndex, rankIndex, piece)}
                style={{
                  aspectRatio: '1',
                  border: '1px solid rgba(92, 64, 51, 0.45)',
                  padding: 0,
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.45)'
                    : isHintFrom || isHintTo
                      ? 'rgba(250, 204, 21, 0.45)'
                      : isTarget
                        ? 'rgba(34, 197, 94, 0.4)'
                        : 'transparent',
                  outline: isLast ? '2px solid rgba(59, 130, 246, 0.8)' : undefined,
                  cursor: canPlay && !displayFen ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'clamp(1rem, 3.5vw, 1.6rem)',
                  fontWeight: 700,
                  userSelect: 'none',
                  color: piece && piece === piece.toUpperCase() ? '#b91c1c' : '#1e293b',
                  boxShadow: hasRiverAbove ? 'inset 0 3px 0 rgba(59, 130, 246, 0.15)' : undefined,
                }}
              >
                {piece ? (
                  <span
                    style={{
                      width: '78%',
                      height: '78%',
                      borderRadius: '50%',
                      background: piece === piece.toUpperCase() ? '#fef3c7' : '#e2e8f0',
                      border: '2px solid rgba(92, 64, 51, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {PIECE_GLYPH[piece] ?? piece}
                  </span>
                ) : isTarget ? (
                  '·'
                ) : null}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
