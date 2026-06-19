import type { GoBoardSize, GoColor } from './logic.js';

export type GoCell = GoColor | null;

const NEIGHBORS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const;

export function createEmptyBoard(size: GoBoardSize): GoCell[][] {
  return Array.from({ length: size }, () => Array<GoCell>(size).fill(null));
}

export function cloneBoard(board: GoCell[][]): GoCell[][] {
  return board.map((row) => [...row]);
}

export function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && x < size && y >= 0 && y < size;
}

export function opponent(color: GoColor): GoColor {
  return color === 'black' ? 'white' : 'black';
}

export interface GoGroup {
  color: GoColor;
  stones: Array<{ x: number; y: number }>;
  liberties: Set<string>;
}

function libertyKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function getGroup(board: GoCell[][], x: number, y: number): GoGroup | null {
  const size = board.length;
  if (!inBounds(size, x, y)) return null;
  const color = board[y]![x];
  if (!color) return null;

  const stones: Array<{ x: number; y: number }> = [];
  const liberties = new Set<string>();
  const visited = new Set<string>();
  const stack = [{ x, y }];

  while (stack.length > 0) {
    const cur = stack.pop()!;
    const key = libertyKey(cur.x, cur.y);
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = board[cur.y]![cur.x];
    if (cell === color) {
      stones.push(cur);
      for (const [dx, dy] of NEIGHBORS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (!inBounds(size, nx, ny)) continue;
        const neighbor = board[ny]![nx];
        if (neighbor === null) liberties.add(libertyKey(nx, ny));
        else if (neighbor === color) stack.push({ x: nx, y: ny });
      }
    }
  }

  return { color, stones, liberties };
}

export function removeGroup(board: GoCell[][], group: GoGroup): GoCell[][] {
  const next = cloneBoard(board);
  for (const { x, y } of group.stones) {
    next[y]![x] = null;
  }
  return next;
}

export interface PlayResult {
  board: GoCell[][];
  captured: number;
  koPoint: { x: number; y: number } | null;
}

export function applyStone(
  board: GoCell[][],
  x: number,
  y: number,
  color: GoColor,
): PlayResult | null {
  const size = board.length;
  if (!inBounds(size, x, y) || board[y]![x] !== null) return null;

  let next = cloneBoard(board);
  next[y]![x] = color;

  let captured = 0;
  const capturedPoints: Array<{ x: number; y: number }> = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(size, nx, ny)) continue;
      if (next[ny]![nx] !== opponent(color)) continue;

      const group = getGroup(next, nx, ny);
      if (group && group.liberties.size === 0) {
        captured += group.stones.length;
        for (const stone of group.stones) capturedPoints.push(stone);
        next = removeGroup(next, group);
        changed = true;
      }
    }
  }

  const ownGroup = getGroup(next, x, y);
  if (ownGroup && ownGroup.liberties.size === 0) {
    return null;
  }

  let koPoint: { x: number; y: number } | null = null;
  if (captured === 1 && capturedPoints.length === 1) {
    koPoint = capturedPoints[0]!;
  }

  return { board: next, captured, koPoint };
}

export function isLegalMove(
  board: GoCell[][],
  x: number,
  y: number,
  color: GoColor,
  koPoint: { x: number; y: number } | null,
): boolean {
  const size = board.length;
  if (!inBounds(size, x, y) || board[y]![x] !== null) return false;
  if (koPoint && koPoint.x === x && koPoint.y === y) return false;
  return applyStone(board, x, y, color) !== null;
}

export function getLegalMoves(
  board: GoCell[][],
  color: GoColor,
  koPoint: { x: number; y: number } | null,
): Array<{ x: number; y: number }> {
  const size = board.length;
  const moves: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isLegalMove(board, x, y, color, koPoint)) moves.push({ x, y });
    }
  }
  return moves;
}

export function countStones(board: GoCell[][], color: GoColor): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === color) count++;
    }
  }
  return count;
}
