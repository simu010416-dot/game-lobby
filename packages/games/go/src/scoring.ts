import type { GoCell } from './board.js';
import type { GoColor } from './logic.js';
import { countStones } from './board.js';

const NEIGHBORS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const;

function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && x < size && y >= 0 && y < size;
}

/** Chinese rules area scoring: stones on board + surrounded empty points. */
export function scoreChinese(board: GoCell[][], komi: number): { black: number; white: number } {
  const size = board.length;
  const territory = { black: 0, white: 0 };
  const visited = new Set<string>();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const key = `${x},${y}`;
      if (board[y]![x] !== null || visited.has(key)) continue;

      const region: Array<{ x: number; y: number }> = [];
      const touches = new Set<GoColor>();
      const stack = [{ x, y }];

      while (stack.length > 0) {
        const cur = stack.pop()!;
        const curKey = `${cur.x},${cur.y}`;
        if (visited.has(curKey)) continue;
        visited.add(curKey);
        region.push(cur);

        for (const [dx, dy] of NEIGHBORS) {
          const nx = cur.x + dx;
          const ny = cur.y + dy;
          if (!inBounds(size, nx, ny)) continue;
          const cell = board[ny]![nx];
          if (cell === null) {
            const nKey = `${nx},${ny}`;
            if (!visited.has(nKey)) stack.push({ x: nx, y: ny });
          } else {
            touches.add(cell);
          }
        }
      }

      if (touches.size === 1) {
        const owner = [...touches][0]!;
        territory[owner] += region.length;
      }
    }
  }

  const blackStones = countStones(board, 'black');
  const whiteStones = countStones(board, 'white');

  return {
    black: blackStones + territory.black,
    white: whiteStones + territory.white + komi,
  };
}
