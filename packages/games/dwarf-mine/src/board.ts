import type { BoardCell, GameCard, PathCardDef, TeamColor, DwarfMineRole } from './types.js';
import {
  BOARD_ROWS,
  BOARD_COLS,
  START_ROW,
  START_COL,
  GOAL_ROWS,
  GOAL_COL,
  DIR_N,
  DIR_E,
  DIR_S,
  DIR_W,
  OPPOSITE,
  DELTA,
} from './types.js';
import { isPathCard } from './cards-base.js';

export { GOAL_ROWS, GOAL_COL, BOARD_ROWS, BOARD_COLS, START_ROW, START_COL };

export function createEmptyBoard(): BoardCell[][] {
  const board: BoardCell[][] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      row.push({ row: r, col: c, card: null, rotation: 0, cellType: 'empty' });
    }
    board.push(row);
  }
  return board;
}

export function rotateConnections(conns: number, rotation: 0 | 90 | 180 | 270): number {
  let result = 0;
  const dirs = [DIR_N, DIR_E, DIR_S, DIR_W];
  for (let i = 0; i < 4; i++) {
    if (conns & dirs[i]!) {
      const newIdx = (i + rotation / 90) % 4;
      result |= dirs[newIdx]!;
    }
  }
  return result;
}

export function getCellConnections(cell: BoardCell): number[] {
  if (cell.cellType === 'start') {
    // Saboteur 起点（梯子卡）：仅向东进入矿道，其余方向为岩壁
    return [DIR_E];
  }
  if (cell.cellType === 'goal') {
    if (!cell.goalRevealed && cell.card === null) {
      return [rotateConnections(DIR_W, cell.rotation)];
    }
    if (cell.card && isPathCard(cell.card.def)) {
      return getPathConnections(cell.card.def, cell.rotation);
    }
    return [rotateConnections(DIR_W, cell.rotation)];
  }
  if (cell.card && isPathCard(cell.card.def)) {
    return getPathConnections(cell.card.def, cell.rotation);
  }
  return [];
}

function getPathConnections(def: PathCardDef, rotation: 0 | 90 | 180 | 270): number[] {
  const primary = rotateConnections(def.connections, rotation);
  if (def.secondaryConnections != null) {
    const secondary = rotateConnections(def.secondaryConnections, rotation);
    return [primary, secondary];
  }
  return [primary];
}

export function setupBoard(goalGoldIndex: number): BoardCell[][] {
  const board = createEmptyBoard();
  board[START_ROW]![START_COL]! = {
    row: START_ROW,
    col: START_COL,
    card: null,
    rotation: 0,
    cellType: 'start',
  };
  GOAL_ROWS.forEach((row, i) => {
    board[row]![GOAL_COL]! = {
      row,
      col: GOAL_COL,
      card: null,
      rotation: 0,
      cellType: 'goal',
      goalHasGold: i === goalGoldIndex,
      goalRevealed: false,
    };
  });
  return board;
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

export function isAdjacentToPath(board: BoardCell[][], row: number, col: number): boolean {
  for (const dir of [DIR_N, DIR_E, DIR_S, DIR_W]) {
    const [dr, dc] = DELTA[dir]!;
    const nr = row + dr;
    const nc = col + dc;
    if (!inBounds(nr, nc)) continue;
    const neighbor = board[nr]![nc]!;
    if (neighbor.cellType !== 'empty') return true;
  }
  return false;
}

export function edgesMatch(
  board: BoardCell[][],
  row: number,
  col: number,
  newConns: number[],
): boolean {
  for (const dir of [DIR_N, DIR_E, DIR_S, DIR_W]) {
    const [dr, dc] = DELTA[dir]!;
    const nr = row + dr;
    const nc = col + dc;
    const myHas = newConns.some((c) => c & dir);
    if (!inBounds(nr, nc)) {
      // 官方规则：通道可延伸到 5×9 区域之外，指向棋盘外的开口合法
      continue;
    }
    const neighbor = board[nr]![nc]!;
    if (neighbor.cellType === 'empty') {
      if (myHas) return false;
      continue;
    }
    const neighborConns = getCellConnections(neighbor);
    const opp = OPPOSITE[dir]!;
    const neighborHas = neighborConns.some((c) => c & opp);
    if (myHas !== neighborHas) return false;
  }
  return true;
}

/** At least one path segment must connect to start (for bridge/double_curve). */
export function connectsToStart(
  board: BoardCell[][],
  row: number,
  col: number,
  newConns: number[],
): boolean {
  const testBoard = board.map((r) => r.map((c) => ({ ...c })));
  testBoard[row]![col]! = {
    row,
    col,
    card: {
      id: 'test',
      def: { kind: 'path', pathKind: 'straight', connections: newConns[0]! },
    },
    rotation: 0,
    cellType: 'path',
  };
  return isReachableFromStart(testBoard);
}

export function isReachableFromStart(board: BoardCell[][]): boolean {
  const visited = new Set<string>();
  const queue: [number, number][] = [[START_ROW, START_COL]];
  visited.add(`${START_ROW},${START_COL}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const cell = board[r]![c]!;
    const connsList = getCellConnections(cell);
    const allConns = connsList.reduce((a, b) => a | b, 0);

    for (const dir of [DIR_N, DIR_E, DIR_S, DIR_W]) {
      if (!(allConns & dir)) continue;
      const [dr, dc] = DELTA[dir]!;
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (!inBounds(nr, nc) || visited.has(key)) continue;
      const neighbor = board[nr]![nc]!;
      if (neighbor.cellType === 'empty') continue;
      const opp = OPPOSITE[dir]!;
      const nConns = getCellConnections(neighbor).reduce((a, b) => a | b, 0);
      if (nConns & opp) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  for (const goalRow of GOAL_ROWS) {
    if (visited.has(`${goalRow},${GOAL_COL}`)) return true;
  }
  return visited.size > 1;
}

export function canPlacePath(
  board: BoardCell[][],
  row: number,
  col: number,
  def: PathCardDef,
  rotation: 0 | 90 | 180 | 270,
): boolean {
  if (!inBounds(row, col)) return false;
  const cell = board[row]![col]!;
  if (cell.cellType !== 'empty') return false;
  if (def.pathKind === 'ladder') {
    for (const goalRow of GOAL_ROWS) {
      if (Math.abs(row - goalRow) + Math.abs(col - GOAL_COL) === 1) return false;
    }
  }
  if (!isAdjacentToPath(board, row, col)) return false;
  const conns = getPathConnections(def, rotation);
  if (!edgesMatch(board, row, col, conns)) return false;
  if (def.pathKind === 'bridge' || def.pathKind === 'double_curve') {
    if (!connectsToStart(board, row, col, conns)) return false;
  }
  const testBoard = board.map((r) => r.map((c) => ({ ...c })));
  testBoard[row]![col]! = {
    row,
    col,
    card: { id: 'test', def },
    rotation,
    cellType: 'path',
  };
  return isReachableFromStart(testBoard);
}

export interface PathPlacement {
  row: number;
  col: number;
  rotation: 0 | 90 | 180 | 270;
}

/** 返回某张通道卡在当前棋盘上的全部合法落点（含旋转）。 */
export function findValidPathPlacements(
  board: BoardCell[][],
  def: PathCardDef,
): PathPlacement[] {
  const placements: PathPlacement[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      for (const rotation of [0, 90, 180, 270] as const) {
        if (canPlacePath(board, row, col, def, rotation)) {
          placements.push({ row, col, rotation });
        }
      }
    }
  }
  return placements;
}

export function findConnectedGoals(board: BoardCell[][]): number[] {
  const connected: number[] = [];
  const visited = new Set<string>();
  const queue: [number, number][] = [[START_ROW, START_COL]];
  visited.add(`${START_ROW},${START_COL}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const cell = board[r]![c]!;
    const allConns = getCellConnections(cell).reduce((a, b) => a | b, 0);

    for (const dir of [DIR_N, DIR_E, DIR_S, DIR_W]) {
      if (!(allConns & dir)) continue;
      const [dr, dc] = DELTA[dir]!;
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (!inBounds(nr, nc) || visited.has(key)) continue;
      const neighbor = board[nr]![nc]!;
      if (neighbor.cellType === 'empty') continue;
      const opp = OPPOSITE[dir]!;
      const nConns = getCellConnections(neighbor).reduce((a, b) => a | b, 0);
      if (nConns & opp) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  GOAL_ROWS.forEach((row, i) => {
    if (visited.has(`${row},${GOAL_COL}`)) connected.push(i);
  });
  return connected;
}

export function countVisibleCrystals(board: BoardCell[][]): number {
  let total = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.card && isPathCard(cell.card.def) && cell.card.def.crystals) {
        total += cell.card.def.crystals;
      }
    }
  }
  return total;
}

export function pathHasDoorOfColor(board: BoardCell[][], team: TeamColor): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (
        cell.card &&
        isPathCard(cell.card.def) &&
        cell.card.def.doorColor &&
        cell.card.def.doorColor !== team
      ) {
        return true;
      }
    }
  }
  return false;
}

export function teamCanReachGold(board: BoardCell[][], team: TeamColor): boolean {
  const connected = findConnectedGoals(board);
  for (const idx of connected) {
    const goal = board[GOAL_ROWS[idx]!]![GOAL_COL]!;
    if (goal.goalHasGold) {
      if (!pathHasDoorOfColor(board, team)) return true;
    }
  }
  return false;
}

export function isNeutralConnector(role: DwarfMineRole): boolean {
  return role === 'boss' || role === 'profiteer' || role === 'geologist' || role === 'saboteur';
}

export function getPlayerTeam(role: DwarfMineRole): TeamColor | null {
  if (role === 'green_dwarf') return 'green';
  if (role === 'blue_dwarf') return 'blue';
  return null;
}
