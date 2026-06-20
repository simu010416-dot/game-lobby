import type { GameParticipant } from '@game-lobby/game-core';
import { shuffle } from '@game-lobby/game-core';
import { buildBaseDrawDeck, buildGoldDeck, isPathCard, isActionCard } from './cards-base.js';
import {
  canPlacePath,
  findConnectedGoals,
  setupBoard,
  GOAL_ROWS,
  GOAL_COL,
} from './board.js';
import {
  assignBaseRoles,
  handSizeForPlayers,
  saboteurGoldReward,
  isGoodDwarf,
  isSaboteur,
} from './roles.js';
import type {
  DwarfMineGameState,
  DwarfMinePlayerState,
  GameCard,
  ToolType,
  ActionKind,
  RoundOutcome,
} from './types.js';

function cloneState(state: DwarfMineGameState): DwarfMineGameState {
  return JSON.parse(JSON.stringify(state)) as DwarfMineGameState;
}

function syncCounts(state: DwarfMineGameState): void {
  state.deckCount = state.deck.length;
  state.discardCount = state.discard.length;
  state.removedDeckCount = state.removedDeck.length;
  state.players.forEach((p) => {
    p.handCount = p.hand.length;
  });
}

function createPlayer(
  p: GameParticipant,
  role: import('./types.js').DwarfMineRole,
): DwarfMinePlayerState {
  return {
    id: p.id,
    name: p.name,
    role,
    team: null,
    hand: [],
    handCount: 0,
    tools: { lamp: false, pickaxe: false, cart: false },
    faceUpCards: [],
    isTrapped: false,
    roundGold: 0,
    jailedFromGold: false,
  };
}

function drawFromDeck(state: DwarfMineGameState, count: number): GameCard[] {
  const drawn: GameCard[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) break;
    drawn.push(state.deck.pop()!);
  }
  syncCounts(state);
  return drawn;
}

function toolForBroken(action: ActionKind): ToolType | null {
  if (action === 'broken_lamp') return 'lamp';
  if (action === 'broken_pickaxe') return 'pickaxe';
  if (action === 'broken_cart') return 'cart';
  return null;
}

function toolForRepair(action: ActionKind): ToolType | null {
  if (action === 'repair_lamp') return 'lamp';
  if (action === 'repair_pickaxe') return 'pickaxe';
  if (action === 'repair_cart') return 'cart';
  return null;
}

function hasAllTools(player: DwarfMinePlayerState): boolean {
  return !player.tools.lamp && !player.tools.pickaxe && !player.tools.cart;
}

function hasBrokenTool(player: DwarfMinePlayerState, tool: ToolType): boolean {
  return player.tools[tool];
}

function hasFaceUpAction(player: DwarfMinePlayerState, kind: ActionKind): boolean {
  return player.faceUpCards.some((c) => c.actionKind === kind);
}

function currentPlayer(state: DwarfMineGameState): DwarfMinePlayerState | undefined {
  return state.players[state.currentPlayerIndex];
}

function nextPlayerIndex(state: DwarfMineGameState): number {
  return (state.currentPlayerIndex + 1) % state.players.length;
}

function advanceTurn(state: DwarfMineGameState): void {
  state.currentPlayerIndex = nextPlayerIndex(state);
  const next = currentPlayer(state);
  state.message = next ? `轮到 ${next.name}` : '';
}

function removeFromHand(player: DwarfMinePlayerState, cardId: string): GameCard | null {
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;
  return player.hand.splice(idx, 1)[0] ?? null;
}

function findPlayer(state: DwarfMineGameState, id: string): DwarfMinePlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function goalIndices(): number[] {
  return GOAL_ROWS.map((_row: number, i: number) => i);
}

export function createBaseRound(
  participants: GameParticipant[],
  round: number,
  totalGold: Record<string, number>,
): DwarfMineGameState {
  const roleMap = assignBaseRoles(participants.map((p) => p.id));
  const players = participants.map((p) =>
    createPlayer(p, roleMap.get(p.id)!),
  );
  const deck = shuffle(buildBaseDrawDeck());
  const handSize = handSizeForPlayers(participants.length);
  for (const player of players) {
    player.hand = deck.splice(0, handSize);
  }
  const goalGoldIndex = Math.floor(Math.random() * 3);
  const board = setupBoard(goalGoldIndex);

  return {
    mode: 'base',
    phase: 'playing',
    round,
    maxRounds: 3,
    players,
    board,
    deck,
    discard: [],
    removedDeck: [],
    deckCount: deck.length,
    discardCount: 0,
    removedDeckCount: 0,
    currentPlayerIndex: 0,
    lastPathPlayerId: null,
    lastPlayedPlayerId: null,
    goldPool: [],
    goldDistributionQueue: [],
    goldDistributionIndex: 0,
    theftQueue: [],
    theftIndex: 0,
    totalGold: { ...totalGold },
    roundOutcome: null,
    winnerIds: null,
    message: `第 ${round} 轮开始，轮到 ${players[0]?.name ?? '玩家'}`,
    pendingAction: null,
    spareRoleDeck: [],
    rolesRevealed: false,
  };
}

export function createBaseGame(participants: GameParticipant[]): DwarfMineGameState {
  const totalGold: Record<string, number> = {};
  for (const p of participants) totalGold[p.id] = 0;
  return createBaseRound(participants, 1, totalGold);
}

function startGoldDistribution(state: DwarfMineGameState, outcome: RoundOutcome): DwarfMineGameState {
  const next = cloneState(state);
  next.phase = 'gold_distribution';
  next.roundOutcome = outcome;
  next.rolesRevealed = true;

  if (outcome.kind === 'dwarves_win') {
    const goodIds = next.players.filter((p) => isGoodDwarf(p.role)).map((p) => p.id);
    const pool = shuffle(buildGoldDeck()).slice(0, next.players.length);
    next.goldPool = pool;
    const startIdx = outcome.connectingPlayerId
      ? goodIds.indexOf(outcome.connectingPlayerId)
      : 0;
    const queue: string[] = [];
    for (let i = 0; i < goodIds.length; i++) {
      queue.push(goodIds[(startIdx + i + goodIds.length) % goodIds.length]!);
    }
    next.goldDistributionQueue = queue;
    next.goldDistributionIndex = 0;
    next.message = '好矮人获胜！请依次选取金块。';
  } else {
    const sabCount = next.players.filter((p) => isSaboteur(p.role)).length;
    const reward = saboteurGoldReward(sabCount);
    for (const p of next.players) {
      if (isSaboteur(p.role)) {
        p.roundGold = reward;
        next.totalGold[p.id] = (next.totalGold[p.id] ?? 0) + reward;
      }
    }
    next.phase = 'round_end';
    next.message = `坏矮人获胜！各获 ${reward} 金块。`;
  }
  syncCounts(next);
  return next;
}

function checkGoldConnection(state: DwarfMineGameState, playerId: string): DwarfMineGameState | null {
  const connected = findConnectedGoals(state.board);
  for (const idx of connected) {
    const goal = state.board[GOAL_ROWS[idx]!]![GOAL_COL]!;
    goal.goalRevealed = true;
    if (goal.goalHasGold) {
      const goodIds = state.players.filter((p) => isGoodDwarf(p.role)).map((p) => p.id);
      return startGoldDistribution(state, {
        kind: 'dwarves_win',
        connectingPlayerId: playerId,
        winningPlayerIds: goodIds,
        winningTeams: [],
      });
    }
  }
  return null;
}

function allPlayersCannotPlay(state: DwarfMineGameState): boolean {
  for (const p of state.players) {
    if (p.hand.length > 0) return false;
  }
  return true;
}

function endSaboteursWin(state: DwarfMineGameState): DwarfMineGameState {
  const sabIds = state.players.filter((p) => isSaboteur(p.role)).map((p) => p.id);
  return startGoldDistribution(state, {
    kind: 'saboteurs_win',
    connectingPlayerId: null,
    winningPlayerIds: sabIds,
    winningTeams: [],
  });
}

export function playBasePath(
  state: DwarfMineGameState,
  playerId: string,
  cardId: string,
  row: number,
  col: number,
  rotation: 0 | 90 | 180 | 270,
): DwarfMineGameState {
  if (state.phase !== 'playing' || state.mode !== 'base') return state;
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return state;
  if (player.isTrapped || !hasAllTools(player)) {
    return { ...state, message: '工具损坏或被囚禁，不能出通道卡。' };
  }

  const card = removeFromHand(player, cardId);
  if (!card || !isPathCard(card.def)) {
    if (card) player.hand.push(card);
    return state;
  }

  if (!canPlacePath(state.board, row, col, card.def, rotation)) {
    player.hand.push(card);
    return { ...state, message: '此处不能放置该通道卡。' };
  }

  const next = cloneState(state);
  const np = currentPlayer(next)!;
  removeFromHand(np, cardId);
  next.board[row]![col]! = {
    row,
    col,
    card,
    rotation,
    cellType: 'path',
  };
  next.lastPathPlayerId = playerId;
  next.lastPlayedPlayerId = playerId;

  const winState = checkGoldConnection(next, playerId);
  if (winState) {
    drawFromDeck(winState, 1);
    syncCounts(winState);
    return winState;
  }

  drawFromDeck(next, 1);
  if (next.deck.length === 0 && allPlayersCannotPlay(next)) {
    return endSaboteursWin(next);
  }
  advanceTurn(next);
  syncCounts(next);
  return next;
}

export function playBaseAction(
  state: DwarfMineGameState,
  playerId: string,
  cardId: string,
  targetPlayerId?: string,
  collapseRow?: number,
  collapseCol?: number,
): DwarfMineGameState {
  if (state.phase !== 'playing' || state.mode !== 'base') return state;
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return state;

  const card = removeFromHand(player, cardId);
  if (!card || !isActionCard(card.def)) {
    if (card) player.hand.push(card);
    return state;
  }

  const next = cloneState(state);
  const np = currentPlayer(next)!;
  removeFromHand(np, cardId);
  const action = card.def.actionKind;

  const broken = toolForBroken(action);
  if (broken && targetPlayerId) {
    const target = findPlayer(next, targetPlayerId);
    if (!target || hasFaceUpAction(target, action)) {
      np.hand.push(card);
      return { ...state, message: '不能对该玩家使用此妨碍卡。' };
    }
    target.tools[broken] = true;
    target.faceUpCards.push({ cardId: card.id, actionKind: action, playedBy: playerId });
    next.discard.push(card);
  } else if (toolForRepair(action) && targetPlayerId) {
    const repair = toolForRepair(action)!;
    const target = findPlayer(next, targetPlayerId);
    if (!target || !hasBrokenTool(target, repair)) {
      np.hand.push(card);
      return { ...state, message: '该玩家没有对应的损坏工具。' };
    }
    target.tools[repair] = false;
    target.faceUpCards = target.faceUpCards.filter((f) => toolForBroken(f.actionKind) !== repair);
    next.discard.push(card);
  } else if (action === 'map') {
    next.pendingAction = { type: 'map_peek', playerId, goalIndices: goalIndices() };
    next.phase = 'map_peek';
    next.discard.push(card);
    next.message = '请选择要查看的终点卡。';
    drawFromDeck(next, 0);
    syncCounts(next);
    return next;
  } else if (action === 'collapse' && collapseRow != null && collapseCol != null) {
    const cell = next.board[collapseRow]?.[collapseCol];
    if (!cell || cell.cellType !== 'path' || !cell.card) {
      np.hand.push(card);
      return { ...state, message: '只能移除通道卡。' };
    }
    next.discard.push(cell.card, card);
    next.board[collapseRow]![collapseCol]! = {
      row: collapseRow,
      col: collapseCol,
      card: null,
      rotation: 0,
      cellType: 'empty',
    };
  } else {
    np.hand.push(card);
    return state;
  }

  next.lastPlayedPlayerId = playerId;
  drawFromDeck(next, 1);
  if (next.deck.length === 0 && allPlayersCannotPlay(next)) {
    return endSaboteursWin(next);
  }
  if (next.phase === 'playing') advanceTurn(next);
  syncCounts(next);
  return next;
}

export function discardBaseCard(
  state: DwarfMineGameState,
  playerId: string,
  cardId: string,
): DwarfMineGameState {
  if (state.phase !== 'playing' || state.mode !== 'base') return state;
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return state;

  const card = removeFromHand(player, cardId);
  if (!card) return state;

  const next = cloneState(state);
  const np = currentPlayer(next)!;
  removeFromHand(np, cardId);
  next.discard.push(card);
  next.lastPlayedPlayerId = playerId;
  drawFromDeck(next, 1);
  if (next.deck.length === 0 && allPlayersCannotPlay(next)) {
    return endSaboteursWin(next);
  }
  advanceTurn(next);
  syncCounts(next);
  return next;
}

export function resolveMapPeek(
  state: DwarfMineGameState,
  playerId: string,
  goalIndex: number,
): DwarfMineGameState {
  if (state.phase !== 'map_peek' || !state.pendingAction || state.pendingAction.type !== 'map_peek') {
    return state;
  }
  if (state.pendingAction.playerId !== playerId) return state;

  const next = cloneState(state);
  const goal = next.board[GOAL_ROWS[goalIndex]!]![GOAL_COL]!;
  next.privatePeek = {
    playerId,
    goalIndex,
    hasGold: !!goal.goalHasGold,
  };
  next.pendingAction = null;
  next.phase = 'playing';
  advanceTurn(next);
  next.message = '已查看终点（仅你可见）。';
  syncCounts(next);
  return next;
}

export function pickBaseGold(
  state: DwarfMineGameState,
  playerId: string,
  goldIndex: number,
): DwarfMineGameState {
  if (state.phase !== 'gold_distribution' || state.mode !== 'base') return state;
  const expected = state.goldDistributionQueue[state.goldDistributionIndex];
  if (expected !== playerId) return state;
  if (goldIndex < 0 || goldIndex >= state.goldPool.length) return state;

  const next = cloneState(state);
  const value = next.goldPool.splice(goldIndex, 1)[0]!;
  const player = findPlayer(next, playerId)!;
  player.roundGold += value;
  next.totalGold[playerId] = (next.totalGold[playerId] ?? 0) + value;
  next.goldDistributionIndex += 1;

  if (next.goldDistributionIndex >= next.goldDistributionQueue.length || next.goldPool.length === 0) {
    next.phase = 'round_end';
    next.message = '金块分配完毕，本轮结束。';
  } else {
    const nextPicker = findPlayer(next, next.goldDistributionQueue[next.goldDistributionIndex]!);
    next.message = `请 ${nextPicker?.name ?? '玩家'} 选取金块。`;
  }
  syncCounts(next);
  return next;
}

export function continueBaseRound(state: DwarfMineGameState): DwarfMineGameState {
  if (state.phase !== 'round_end') return state;

  if (state.round >= state.maxRounds) {
    const next = cloneState(state);
    next.phase = 'ended';
    next.rolesRevealed = true;
    const maxGold = Math.max(...Object.values(next.totalGold));
    next.winnerIds = Object.entries(next.totalGold)
      .filter(([, g]) => g === maxGold)
      .map(([id]) => id);
    next.message = '游戏结束！';
    return next;
  }

  const participants = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: false,
  }));
  return createBaseRound(participants, state.round + 1, state.totalGold);
}

export function redactBaseState(
  state: DwarfMineGameState,
  viewerId: string | null,
): DwarfMineGameState {
  const revealRoles = state.rolesRevealed || state.phase === 'round_end' || state.phase === 'ended';
  const redacted = {
    ...state,
    deck: [],
    discard: [],
    removedDeck: [],
    privatePeek:
      viewerId && state.privatePeek?.playerId === viewerId ? state.privatePeek : undefined,
    players: state.players.map((p) => {
      const showRole = revealRoles || (viewerId != null && p.id === viewerId);
      const showHand = viewerId != null && p.id === viewerId;
      return {
        ...p,
        role: showRole ? p.role : ('hidden' as unknown as typeof p.role),
        hand: showHand ? p.hand : [],
        handCount: p.hand.length,
      };
    }),
  };
  return redacted;
}
