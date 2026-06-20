export type DwarfMineMode = 'base' | 'expansion';

export type DwarfMinePhase =
  | 'playing'
  | 'map_peek'
  | 'role_peek'
  | 'gold_distribution'
  | 'theft_resolution'
  | 'round_end'
  | 'ended';

export type TeamColor = 'green' | 'blue';

export type BaseRole = 'dwarf' | 'saboteur';

export type ExpansionRole =
  | 'green_dwarf'
  | 'blue_dwarf'
  | 'saboteur'
  | 'boss'
  | 'profiteer'
  | 'geologist';

export type DwarfMineRole = BaseRole | ExpansionRole;

/** Shown to other players when role is redacted (projection only). */
export type DwarfMineRoleHidden = DwarfMineRole | 'hidden';

export type ToolType = 'lamp' | 'pickaxe' | 'cart';

export type PathKind =
  | 'straight'
  | 'curve'
  | 't_junction'
  | 'cross'
  | 'dead_end'
  | 'bridge'
  | 'double_curve'
  | 'ladder'
  | 'door';

export type ActionKind =
  | 'broken_lamp'
  | 'broken_pickaxe'
  | 'broken_cart'
  | 'repair_lamp'
  | 'repair_pickaxe'
  | 'repair_cart'
  | 'map'
  | 'collapse'
  | 'theft'
  | 'hands_off'
  | 'swap_hand'
  | 'inspection'
  | 'swap_hat'
  | 'trapped'
  | 'free';

export type CardKind = 'path' | 'action';

export interface PathCardDef {
  kind: 'path';
  pathKind: PathKind;
  /** Connection bitmask: N=1, E=2, S=4, W=8 */
  connections: number;
  doorColor?: TeamColor;
  crystals?: number;
  hasLadder?: boolean;
  /** For bridge/double_curve: second disconnected path bitmask */
  secondaryConnections?: number;
}

export interface ActionCardDef {
  kind: 'action';
  actionKind: ActionKind;
}

export type CardDef = PathCardDef | ActionCardDef;

export interface GameCard {
  id: string;
  def: CardDef;
}

export interface FaceUpCard {
  cardId: string;
  actionKind: ActionKind;
  playedBy: string;
}

export interface BoardCell {
  row: number;
  col: number;
  card: GameCard | null;
  rotation: 0 | 90 | 180 | 270;
  /** start | goal | path */
  cellType: 'empty' | 'start' | 'goal' | 'path';
  goalHasGold?: boolean;
  goalRevealed?: boolean;
}

export interface DwarfMinePlayerState {
  id: string;
  name: string;
  role: DwarfMineRole;
  team: TeamColor | null;
  hand: GameCard[];
  handCount: number;
  tools: Record<ToolType, boolean>;
  faceUpCards: FaceUpCard[];
  isTrapped: boolean;
  roundGold: number;
  jailedFromGold: boolean;
}

export type PendingAction =
  | { type: 'map_peek'; playerId: string; goalIndices: number[] }
  | { type: 'role_peek'; playerId: string; targetId: string; revealedRole: DwarfMineRole }
  | { type: 'swap_hand'; playerId: string; targetId: string }
  | { type: 'swap_hat'; playerId: string; targetId: string };

export interface RoundOutcome {
  kind: 'dwarves_win' | 'saboteurs_win';
  connectingPlayerId: string | null;
  winningPlayerIds: string[];
  winningTeams: TeamColor[];
}

export interface DwarfMineGameState {
  mode: DwarfMineMode;
  phase: DwarfMinePhase;
  round: number;
  maxRounds: number;
  players: DwarfMinePlayerState[];
  board: BoardCell[][];
  deck: GameCard[];
  discard: GameCard[];
  removedDeck: GameCard[];
  deckCount: number;
  discardCount: number;
  removedDeckCount: number;
  currentPlayerIndex: number;
  lastPathPlayerId: string | null;
  lastPlayedPlayerId: string | null;
  goldPool: number[];
  goldDistributionQueue: string[];
  goldDistributionIndex: number;
  theftQueue: string[];
  theftIndex: number;
  totalGold: Record<string, number>;
  roundOutcome: RoundOutcome | null;
  winnerIds: string[] | null;
  message: string;
  pendingAction: PendingAction | null;
  spareRoleDeck: DwarfMineRole[];
  rolesRevealed: boolean;
  /** Private peek result for map card — cleared after viewing */
  privatePeek?: { playerId: string; goalIndex: number; hasGold: boolean };
}

export interface DwarfMineStartOptions {
  mode?: DwarfMineMode;
}

export const BOARD_ROWS = 5;
export const BOARD_COLS = 9;
export const START_ROW = 2;
export const START_COL = 0;
export const GOAL_ROWS = [1, 2, 3] as const;
export const GOAL_COL = 8;

export const DIR_N = 1;
export const DIR_E = 2;
export const DIR_S = 4;
export const DIR_W = 8;

export const OPPOSITE: Record<number, number> = {
  [DIR_N]: DIR_S,
  [DIR_E]: DIR_W,
  [DIR_S]: DIR_N,
  [DIR_W]: DIR_E,
};

export const DELTA: Record<number, [number, number]> = {
  [DIR_N]: [-1, 0],
  [DIR_E]: [0, 1],
  [DIR_S]: [1, 0],
  [DIR_W]: [0, -1],
};
