import type { GameParticipant } from '@game-lobby/game-core';
import { shuffle } from '@game-lobby/game-core';
import {
  buildExpansionDrawDeck,
  buildExpansionRoleDeck,
  EXPANSION_CARDS_REMOVED_PER_ROUND,
  EXPANSION_HAND_SIZE,
  EXPANSION_GOLD_BY_WINNERS,
} from './cards-expansion.js';
import { buildGoldDeck, isPathCard, isActionCard } from './cards-base.js';
import {
  canPlacePath,
  findConnectedGoals,
  setupBoard,
  countVisibleCrystals,
  pathHasDoorOfColor,
  teamCanReachGold,
  isNeutralConnector,
  getPlayerTeam,
  GOAL_ROWS,
  GOAL_COL,
} from './board.js';
import { roleLabel, isSaboteur } from './roles.js';
import type {
  DwarfMineGameState,
  DwarfMinePlayerState,
  DwarfMineRole,
  GameCard,
  TeamColor,
  RoundOutcome,
  ActionKind,
  ToolType,
} from './types.js';
import {
  playBasePath,
  playBaseAction,
  resolveMapPeek,
  pickBaseGold,
} from './logic-base.js';

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

function createPlayer(p: GameParticipant, role: DwarfMineRole): DwarfMinePlayerState {
  return {
    id: p.id,
    name: p.name,
    role,
    team: getPlayerTeam(role),
    hand: [],
    handCount: 0,
    tools: { lamp: false, pickaxe: false, cart: false },
    faceUpCards: [],
    isTrapped: false,
    roundGold: 0,
    jailedFromGold: false,
  };
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

function findPlayer(state: DwarfMineGameState, id: string): DwarfMinePlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function removeFromHand(player: DwarfMinePlayerState, cardId: string): GameCard | null {
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;
  return player.hand.splice(idx, 1)[0] ?? null;
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

function hasAllTools(player: DwarfMinePlayerState): boolean {
  return !player.tools.lamp && !player.tools.pickaxe && !player.tools.cart;
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

function hasBrokenTool(player: DwarfMinePlayerState, tool: ToolType): boolean {
  return player.tools[tool];
}

function hasFaceUpAction(player: DwarfMinePlayerState, kind: ActionKind): boolean {
  return player.faceUpCards.some((c) => c.actionKind === kind);
}

function assignExpansionRoles(playerIds: string[]): {
  assignments: Map<string, DwarfMineRole>;
  spare: DwarfMineRole[];
} {
  const deck = shuffle(buildExpansionRoleDeck());
  const assignments = new Map<string, DwarfMineRole>();
  playerIds.forEach((id, i) => assignments.set(id, deck[i]!));
  return { assignments, spare: deck.slice(playerIds.length) };
}

function prepareExpansionDeck(state: DwarfMineGameState): void {
  const allRemoved = [...state.removedDeck];
  state.removedDeck = [];
  let deck = shuffle([...buildExpansionDrawDeck(), ...allRemoved]);
  if (deck.length > EXPANSION_CARDS_REMOVED_PER_ROUND) {
    state.removedDeck = deck.splice(0, EXPANSION_CARDS_REMOVED_PER_ROUND);
  }
  state.deck = deck;
}

export function createExpansionRound(
  participants: GameParticipant[],
  round: number,
  totalGold: Record<string, number>,
  startPlayerIndex = 0,
): DwarfMineGameState {
  const { assignments, spare } = assignExpansionRoles(participants.map((p) => p.id));
  const players = participants.map((p) => createPlayer(p, assignments.get(p.id)!));

  const state: DwarfMineGameState = {
    mode: 'expansion',
    phase: 'playing',
    round,
    maxRounds: 3,
    players,
    board: setupBoard(Math.floor(Math.random() * 3)),
    deck: [],
    discard: [],
    removedDeck: [],
    deckCount: 0,
    discardCount: 0,
    removedDeckCount: 0,
    currentPlayerIndex: startPlayerIndex,
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
    message: `第 ${round} 轮开始（扩展版）`,
    pendingAction: null,
    spareRoleDeck: spare,
    rolesRevealed: false,
  };

  prepareExpansionDeck(state);
  for (const player of players) {
    player.hand = state.deck.splice(0, EXPANSION_HAND_SIZE);
  }
  syncCounts(state);
  const cur = players[startPlayerIndex];
  state.message = `第 ${round} 轮开始，轮到 ${cur?.name ?? '玩家'}`;
  return state;
}

export function createExpansionGame(participants: GameParticipant[]): DwarfMineGameState {
  const totalGold: Record<string, number> = {};
  for (const p of participants) totalGold[p.id] = 0;
  return createExpansionRound(participants, 1, totalGold);
}

function computeExpansionWinners(
  state: DwarfMineGameState,
  connectorId: string,
  connectorRole: DwarfMineRole,
): RoundOutcome {
  const connector = findPlayer(state, connectorId)!;
  const connected = findConnectedGoals(state.board);
  let goldFound = false;
  for (const idx of connected) {
    const goal = state.board[GOAL_ROWS[idx]!]![GOAL_COL]!;
    goal.goalRevealed = true;
    if (goal.goalHasGold) goldFound = true;
  }

  if (!goldFound) {
    const sabIds = state.players.filter((p) => isSaboteur(p.role) || p.role === 'profiteer').map((p) => p.id);
    return {
      kind: 'saboteurs_win',
      connectingPlayerId: connectorId,
      winningPlayerIds: sabIds,
      winningTeams: [],
    };
  }

  const winningTeams: TeamColor[] = [];
  const winningPlayerIds: string[] = [];

  if (isNeutralConnector(connectorRole)) {
    if (!pathHasDoorOfColor(state.board, 'green')) winningTeams.push('green');
    if (!pathHasDoorOfColor(state.board, 'blue')) winningTeams.push('blue');
    for (const p of state.players) {
      if (p.team && winningTeams.includes(p.team)) winningPlayerIds.push(p.id);
      if (connectorRole === 'profiteer' || connectorRole === 'boss') winningPlayerIds.push(p.id);
      if (connectorRole === 'boss' && !winningPlayerIds.includes(p.id)) {
        if (p.role === 'boss') winningPlayerIds.push(p.id);
      }
    }
    if (connectorRole === 'profiteer') {
      for (const p of state.players) {
        if (p.role === 'profiteer' && !winningPlayerIds.includes(p.id)) winningPlayerIds.push(p.id);
      }
    }
    if (connectorRole === 'boss') {
      for (const p of state.players) {
        if (p.role === 'boss' && !winningPlayerIds.includes(p.id)) winningPlayerIds.push(p.id);
      }
    }
  } else if (connector.team) {
    const team = connector.team;
    if (teamCanReachGold(state.board, team)) {
      winningTeams.push(team);
      for (const p of state.players) {
        if (p.team === team) winningPlayerIds.push(p.id);
      }
    } else {
      const other: TeamColor = team === 'green' ? 'blue' : 'green';
      if (teamCanReachGold(state.board, other)) {
        winningTeams.push(other);
        for (const p of state.players) {
          if (p.team === other) winningPlayerIds.push(p.id);
        }
      }
    }
  }

  const uniqueWinners = [...new Set(winningPlayerIds.filter((id) => {
    const p = findPlayer(state, id);
    return p && !p.jailedFromGold && p.role !== 'geologist';
  }))];

  return {
    kind: 'dwarves_win',
    connectingPlayerId: connectorId,
    winningPlayerIds: uniqueWinners,
    winningTeams,
  };
}

function startExpansionGoldDistribution(state: DwarfMineGameState, outcome: RoundOutcome): DwarfMineGameState {
  const next = cloneState(state);
  next.roundOutcome = outcome;
  next.rolesRevealed = true;

  if (outcome.kind === 'saboteurs_win') {
    for (const p of next.players) {
      if (isSaboteur(p.role) || p.role === 'profiteer') {
        const reward = saboteurReward(next);
        p.roundGold = reward;
        next.totalGold[p.id] = (next.totalGold[p.id] ?? 0) + reward;
      }
    }
    next.phase = 'round_end';
    next.message = '坏矮人方获胜！';
    assignGeologistGold(next);
    return startTheftPhase(next);
  }

  const winners = outcome.winningPlayerIds;
  const perWinner = EXPANSION_GOLD_BY_WINNERS[winners.length] ?? 1;
  for (const id of winners) {
    const p = findPlayer(next, id)!;
    let gold = perWinner;
    if (p.role === 'boss') gold = Math.max(0, gold - 1);
    if (p.role === 'profiteer') gold = Math.max(0, gold - 2);
    p.roundGold = gold;
    next.totalGold[id] = (next.totalGold[id] ?? 0) + gold;
  }
  assignGeologistGold(next);
  next.phase = 'round_end';
  next.message = '本轮淘金方获胜，金块已分配。';
  return startTheftPhase(next);
}

function saboteurReward(state: DwarfMineGameState): number {
  const sabCount = state.players.filter((p) => isSaboteur(p.role)).length;
  if (sabCount === 1) return 4;
  if (sabCount <= 3) return 3;
  return 2;
}

function assignGeologistGold(state: DwarfMineGameState): void {
  const crystals = countVisibleCrystals(state.board);
  const geologists = state.players.filter((p) => p.role === 'geologist');
  if (geologists.length === 0 || crystals === 0) return;
  const each = Math.floor(crystals / geologists.length);
  for (const g of geologists) {
    g.roundGold += each;
    state.totalGold[g.id] = (state.totalGold[g.id] ?? 0) + each;
  }
}

function startTheftPhase(state: DwarfMineGameState): DwarfMineGameState {
  const thieves = state.players
    .filter((p) => p.faceUpCards.some((f) => f.actionKind === 'theft') && !p.isTrapped)
    .map((p) => p.id);
  if (thieves.length === 0) {
    state.phase = 'round_end';
    return state;
  }
  state.theftQueue = thieves;
  state.theftIndex = 0;
  state.phase = 'theft_resolution';
  state.message = '偷窃阶段：有偷窃卡的玩家可偷取金块。';
  return state;
}

function checkExpansionGold(state: DwarfMineGameState, playerId: string): DwarfMineGameState | null {
  const connected = findConnectedGoals(state.board);
  for (const idx of connected) {
    const goal = state.board[GOAL_ROWS[idx]!]![GOAL_COL]!;
    if (goal.goalHasGold && goal.goalRevealed !== false) {
      const player = findPlayer(state, playerId)!;
      const outcome = computeExpansionWinners(state, playerId, player.role);
      if (connected.some((i) => state.board[GOAL_ROWS[i]!]![GOAL_COL]!.goalHasGold)) {
        return startExpansionGoldDistribution(state, outcome);
      }
    }
  }
  const revealed = connected.filter((idx) => {
    state.board[GOAL_ROWS[idx]!]![GOAL_COL]!.goalRevealed = true;
    return state.board[GOAL_ROWS[idx]!]![GOAL_COL]!.goalHasGold;
  });
  if (revealed.length > 0) {
    const player = findPlayer(state, playerId)!;
    const outcome = computeExpansionWinners(state, playerId, player.role);
    return startExpansionGoldDistribution(state, outcome);
  }
  return null;
}

function allHandsEmpty(state: DwarfMineGameState): boolean {
  return state.players.every((p) => p.hand.length === 0);
}

function endExpansionSaboteursWin(state: DwarfMineGameState): DwarfMineGameState {
  const outcome: RoundOutcome = {
    kind: 'saboteurs_win',
    connectingPlayerId: null,
    winningPlayerIds: state.players.filter((p) => isSaboteur(p.role)).map((p) => p.id),
    winningTeams: [],
  };
  return startExpansionGoldDistribution(state, outcome);
}

export function playExpansionPath(
  state: DwarfMineGameState,
  playerId: string,
  cardId: string,
  row: number,
  col: number,
  rotation: 0 | 90 | 180 | 270,
): DwarfMineGameState {
  if (state.mode !== 'expansion') return playBasePath(state, playerId, cardId, row, col, rotation);
  if (state.phase !== 'playing') return state;
  const player = currentPlayer(state);
  if (!player || player.id !== playerId || player.isTrapped || !hasAllTools(player)) {
    return { ...state, message: '不能出通道卡。' };
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
  next.board[row]![col]! = { row, col, card, rotation, cellType: 'path' };
  next.lastPathPlayerId = playerId;
  next.lastPlayedPlayerId = playerId;

  const connected = findConnectedGoals(next.board);
  for (const idx of connected) {
    next.board[GOAL_ROWS[idx]!]![GOAL_COL]!.goalRevealed = true;
  }

  const win = checkExpansionGold(next, playerId);
  if (win) {
    drawFromDeck(win, 1);
    return win;
  }

  drawFromDeck(next, 1);
  if (next.deck.length === 0 && allHandsEmpty(next)) {
    return endExpansionSaboteursWin(next);
  }
  advanceTurn(next);
  syncCounts(next);
  return next;
}

export function playExpansionAction(
  state: DwarfMineGameState,
  playerId: string,
  cardId: string,
  targetPlayerId?: string,
  collapseRow?: number,
  collapseCol?: number,
): DwarfMineGameState {
  if (state.mode !== 'expansion') {
    return playBaseAction(state, playerId, cardId, targetPlayerId, collapseRow, collapseCol);
  }
  if (state.phase !== 'playing') return state;
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return state;

  const card = removeFromHand(player, cardId);
  if (!card || !isActionCard(card.def)) {
    if (card) player.hand.push(card);
    return state;
  }

  const action = card.def.actionKind;
  const expansionOnly: ActionKind[] = [
    'theft', 'hands_off', 'swap_hand', 'inspection', 'swap_hat', 'trapped', 'free',
  ];

  if (!expansionOnly.includes(action)) {
    player.hand.push(card);
    return playBaseAction(state, playerId, cardId, targetPlayerId, collapseRow, collapseCol);
  }

  const next = cloneState(state);
  const np = currentPlayer(next)!;
  removeFromHand(np, cardId);

  if (action === 'theft') {
    np.faceUpCards.push({ cardId: card.id, actionKind: action, playedBy: playerId });
  } else if (action === 'trapped' && targetPlayerId) {
    const target = findPlayer(next, targetPlayerId)!;
    if (target.isTrapped || hasFaceUpAction(target, 'trapped')) {
      np.hand.push(card);
      return { ...state, message: '该玩家已被囚禁。' };
    }
    target.isTrapped = true;
    target.jailedFromGold = true;
    target.faceUpCards.push({ cardId: card.id, actionKind: action, playedBy: playerId });
    next.discard.push(card);
  } else if (action === 'free' && targetPlayerId) {
    const target = findPlayer(next, targetPlayerId)!;
    if (!target.isTrapped) {
      np.hand.push(card);
      return { ...state, message: '该玩家未被囚禁。' };
    }
    target.isTrapped = false;
    target.jailedFromGold = false;
    target.faceUpCards = target.faceUpCards.filter((f) => f.actionKind !== 'trapped');
    next.discard.push(card);
  } else if (action === 'hands_off' && targetPlayerId) {
    const target = findPlayer(next, targetPlayerId)!;
    if (!hasFaceUpAction(target, 'theft')) {
      np.hand.push(card);
      return { ...state, message: '该玩家没有偷窃卡。' };
    }
    target.faceUpCards = target.faceUpCards.filter((f) => f.actionKind !== 'theft');
    next.discard.push(card);
  } else if (action === 'inspection' && targetPlayerId) {
    const target = findPlayer(next, targetPlayerId)!;
    next.pendingAction = {
      type: 'role_peek',
      playerId,
      targetId: targetPlayerId,
      revealedRole: target.role,
    };
    next.phase = 'role_peek';
    next.discard.push(card);
    next.message = `你查验了 ${target.name}：${roleLabel(target.role)}`;
    drawFromDeck(next, 0);
    syncCounts(next);
    return next;
  } else if (action === 'swap_hand' && targetPlayerId) {
    const target = findPlayer(next, targetPlayerId)!;
    const tmp = np.hand;
    np.hand = target.hand;
    target.hand = tmp;
    next.discard.push(card);
    drawFromDeck(next, 1);
    next.lastPlayedPlayerId = playerId;
    advanceTurn(next);
    syncCounts(next);
    return next;
  } else if (action === 'swap_hat' && targetPlayerId) {
    const target = findPlayer(next, targetPlayerId)!;
    if (next.spareRoleDeck.length === 0) {
      np.hand.push(card);
      return { ...state, message: '没有剩余身份牌。' };
    }
    const newRole = next.spareRoleDeck.pop()!;
    next.spareRoleDeck.push(target.role);
    target.role = newRole;
    target.team = getPlayerTeam(newRole);
    next.discard.push(card);
  } else {
    np.hand.push(card);
    return state;
  }

  next.lastPlayedPlayerId = playerId;
  drawFromDeck(next, 1);
  if (next.deck.length === 0 && allHandsEmpty(next)) {
    return endExpansionSaboteursWin(next);
  }
  if (next.phase === 'playing') advanceTurn(next);
  syncCounts(next);
  return next;
}

export function discardExpansionTwo(
  state: DwarfMineGameState,
  playerId: string,
  cardId1: string,
  cardId2: string,
  faceUpCardId?: string,
): DwarfMineGameState {
  if (state.mode !== 'expansion' || state.phase !== 'playing') return state;
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return state;

  const c1 = removeFromHand(player, cardId1);
  const c2 = removeFromHand(player, cardId2);
  if (!c1 || !c2) {
    if (c1) player.hand.push(c1);
    if (c2) player.hand.push(c2);
    return state;
  }

  const next = cloneState(state);
  const np = currentPlayer(next)!;
  removeFromHand(np, cardId1);
  removeFromHand(np, cardId2);
  next.discard.push(c1, c2);

  if (faceUpCardId) {
    const faceIdx = np.faceUpCards.findIndex((f) => f.cardId === faceUpCardId);
    if (faceIdx >= 0) {
      const removed = np.faceUpCards.splice(faceIdx, 1)[0]!;
      const broken = toolForBroken(removed.actionKind);
      if (broken) np.tools[broken] = false;
      if (removed.actionKind === 'trapped') {
        np.isTrapped = false;
        np.jailedFromGold = false;
      }
    }
  }

  next.lastPlayedPlayerId = playerId;
  drawFromDeck(next, 1);
  if (next.deck.length === 0 && allHandsEmpty(next)) {
    return endExpansionSaboteursWin(next);
  }
  advanceTurn(next);
  syncCounts(next);
  return next;
}

export function passExpansion(
  state: DwarfMineGameState,
  playerId: string,
  cardIds: string[],
): DwarfMineGameState {
  if (state.mode !== 'expansion' || state.phase !== 'playing') return state;
  if (cardIds.length < 1 || cardIds.length > 3) return state;
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return state;

  const next = cloneState(state);
  const np = currentPlayer(next)!;
  for (const id of cardIds) {
    const c = removeFromHand(np, id);
    if (c) next.discard.push(c);
  }
  if (next.discard.length === 0) return state;

  next.lastPlayedPlayerId = playerId;
  drawFromDeck(next, cardIds.length);
  if (next.deck.length === 0 && allHandsEmpty(next)) {
    return endExpansionSaboteursWin(next);
  }
  advanceTurn(next);
  syncCounts(next);
  return next;
}

export function resolveRolePeek(state: DwarfMineGameState, playerId: string): DwarfMineGameState {
  if (state.phase !== 'role_peek' || state.pendingAction?.type !== 'role_peek') return state;
  if (state.pendingAction.playerId !== playerId) return state;

  const next = cloneState(state);
  next.pendingAction = null;
  next.phase = 'playing';
  advanceTurn(next);
  syncCounts(next);
  return next;
}

export function stealGold(
  state: DwarfMineGameState,
  playerId: string,
  targetId: string,
): DwarfMineGameState {
  if (state.phase !== 'theft_resolution') return state;
  const expected = state.theftQueue[state.theftIndex];
  if (expected !== playerId) return state;

  const next = cloneState(state);
  const thief = findPlayer(next, playerId)!;
  const target = findPlayer(next, targetId);
  if (!target || (next.totalGold[targetId] ?? 0) < 1) {
    return { ...state, message: '目标没有可偷的金块。' };
  }

  next.totalGold[targetId]! -= 1;
  next.totalGold[playerId] = (next.totalGold[playerId] ?? 0) + 1;
  thief.faceUpCards = thief.faceUpCards.filter((f) => f.actionKind !== 'theft');
  next.theftIndex += 1;

  if (next.theftIndex >= next.theftQueue.length) {
    next.phase = 'round_end';
    next.message = '偷窃阶段结束，本轮结束。';
  } else {
    const nextThief = findPlayer(next, next.theftQueue[next.theftIndex]!);
    next.message = `${nextThief?.name ?? '玩家'} 可以偷窃。`;
  }
  syncCounts(next);
  return next;
}

export function skipTheft(state: DwarfMineGameState, playerId: string): DwarfMineGameState {
  if (state.phase !== 'theft_resolution') return state;
  if (state.theftQueue[state.theftIndex] !== playerId) return state;
  const next = cloneState(state);
  next.theftIndex += 1;
  if (next.theftIndex >= next.theftQueue.length) {
    next.phase = 'round_end';
    next.message = '本轮结束。';
  }
  return next;
}

export function continueExpansionRound(state: DwarfMineGameState): DwarfMineGameState {
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
  const lastIdx = state.players.findIndex((p) => p.id === state.lastPlayedPlayerId);
  const startIdx = lastIdx >= 0 ? (lastIdx + 1) % participants.length : 0;
  return createExpansionRound(participants, state.round + 1, state.totalGold, startIdx);
}

export function redactExpansionState(
  state: DwarfMineGameState,
  viewerId: string | null,
): DwarfMineGameState {
  const revealRoles = state.rolesRevealed || state.phase === 'round_end' || state.phase === 'ended';
  return {
    ...state,
    deck: [],
    discard: [],
    removedDeck: [],
    spareRoleDeck: [],
    privatePeek:
      viewerId && state.privatePeek?.playerId === viewerId ? state.privatePeek : undefined,
    pendingAction:
      viewerId &&
      state.pendingAction?.type === 'role_peek' &&
      state.pendingAction.playerId === viewerId
        ? state.pendingAction
        : state.pendingAction?.type === 'map_peek' &&
            state.pendingAction.playerId === viewerId
          ? state.pendingAction
          : null,
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
}
