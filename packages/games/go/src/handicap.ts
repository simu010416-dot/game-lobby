import type { GoBoardSize } from './logic.js';

/** Standard handicap stone positions (x, y) per board size. */
const HANDICAP_POINTS: Record<GoBoardSize, Array<{ x: number; y: number }>> = {
  9: [
    { x: 2, y: 2 },
    { x: 6, y: 6 },
    { x: 2, y: 6 },
    { x: 6, y: 2 },
    { x: 4, y: 4 },
    { x: 2, y: 4 },
    { x: 6, y: 4 },
    { x: 4, y: 2 },
    { x: 4, y: 6 },
  ],
  13: [
    { x: 3, y: 3 },
    { x: 9, y: 3 },
    { x: 3, y: 9 },
    { x: 9, y: 9 },
    { x: 6, y: 6 },
    { x: 3, y: 6 },
    { x: 9, y: 6 },
    { x: 6, y: 3 },
    { x: 6, y: 9 },
  ],
  19: [
    { x: 3, y: 3 },
    { x: 15, y: 3 },
    { x: 3, y: 15 },
    { x: 15, y: 15 },
    { x: 9, y: 9 },
    { x: 3, y: 9 },
    { x: 15, y: 9 },
    { x: 9, y: 3 },
    { x: 9, y: 15 },
  ],
};

export function getHandicapPoints(boardSize: GoBoardSize, handicap: number): Array<{ x: number; y: number }> {
  if (handicap <= 0) return [];
  const points = HANDICAP_POINTS[boardSize];
  return points.slice(0, Math.min(handicap, points.length));
}

export function getStarPoints(boardSize: GoBoardSize): Array<{ x: number; y: number }> {
  if (boardSize === 9) {
    return [
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
      { x: 4, y: 4 },
    ];
  }
  if (boardSize === 13) {
    return [
      { x: 3, y: 3 },
      { x: 9, y: 3 },
      { x: 3, y: 9 },
      { x: 9, y: 9 },
      { x: 6, y: 6 },
    ];
  }
  return [
    { x: 3, y: 3 },
    { x: 9, y: 3 },
    { x: 15, y: 3 },
    { x: 3, y: 9 },
    { x: 9, y: 9 },
    { x: 15, y: 9 },
    { x: 3, y: 15 },
    { x: 9, y: 15 },
    { x: 15, y: 15 },
  ];
}

export function defaultKomi(boardSize: GoBoardSize, handicap: number): number {
  if (handicap > 0) return 0.5;
  if (boardSize === 9) return 5.5;
  if (boardSize === 13) return 6.5;
  return 7.5;
}
