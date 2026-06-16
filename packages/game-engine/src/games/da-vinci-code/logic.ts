import type { AiDifficulty } from '@game-lobby/shared';
import { pickRandom, shouldBotMakeMistake, shuffle } from '../../ai/utils.js';

export type DaVinciPhase = 'playing' | 'ended';

// Within a turn: the active player must first make a guess. If the guess is
// correct they then decide whether to keep guessing or stop and settle.
export type DaVinciStage = 'guessing' | 'deciding';

export type DaVinciColor = 'black' | 'white';

export interface DaVinciTile {
  color: DaVinciColor;
  value: number; // 0..11 (a hidden value redacted for opponents is sent as -1)
  revealed: boolean; // face up (known to everyone) when true
}

export interface DaVinciPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  // Always kept sorted ascending by (value, then black before white). Opponents
  // can see each tile's color (the back is colored) but not the value.
  rack: DaVinciTile[];
  eliminated: boolean;
}

export interface DaVinciLastAction {
  guesserId: string;
  guesserName: string;
  targetId: string;
  targetName: string;
  position: number;
  color: DaVinciColor;
  guessedValue: number;
  correct: boolean;
}

export interface DaVinciGameState {
  phase: DaVinciPhase;
  stage: DaVinciStage;
  players: DaVinciPlayerState[];
  currentPlayerIndex: number;
  // Hidden pile. Redacted to [] before being sent to clients; deckCount is the
  // public count.
  deck: DaVinciTile[];
  deckCount: number;
  // The tile the active player drew this turn. Held in hand until they settle
  // (placed face down) or guess wrong (placed face up). Value is redacted for
  // everyone except the active player.
  drawnTile: DaVinciTile | null;
  lastAction: DaVinciLastAction | null;
  winnerId: string | null;
  message: string;
}

const MAX_VALUE = 11;

// A strict global ordering key: each (color, value) pair maps to a unique key in
// 0..23. Sorting by key reproduces "ascending value, black before white", and
// because every key is unique a player's rack is a strictly increasing sequence
// of keys — the backbone of all deduction below.
export function tileKey(tile: { color: DaVinciColor; value: number }): number {
  return tile.value * 2 + (tile.color === 'white' ? 1 : 0);
}

const MAX_KEY = MAX_VALUE * 2 + 1; // 23

function buildDeck(): DaVinciTile[] {
  const tiles: DaVinciTile[] = [];
  for (let v = 0; v <= MAX_VALUE; v++) {
    tiles.push({ color: 'black', value: v, revealed: false });
    tiles.push({ color: 'white', value: v, revealed: false });
  }
  return tiles;
}

function sortRack(rack: DaVinciTile[]): DaVinciTile[] {
  return [...rack].sort((a, b) => tileKey(a) - tileKey(b));
}

function insertSorted(rack: DaVinciTile[], tile: DaVinciTile): DaVinciTile[] {
  const next = [...rack];
  const key = tileKey(tile);
  let i = next.findIndex((t) => tileKey(t) > key);
  if (i === -1) i = next.length;
  next.splice(i, 0, tile);
  return next;
}

function startingTileCount(playerCount: number): number {
  // Classic rule: 2 players draw 4 tiles each, 3-4 players draw 3 each.
  return playerCount <= 2 ? 4 : 3;
}

export function createDaVinciGame(
  participants: { id: string; name: string; isBot: boolean }[],
): DaVinciGameState {
  const deck = shuffle(buildDeck());
  const count = startingTileCount(participants.length);

  const players: DaVinciPlayerState[] = participants.map((p) => {
    const dealt: DaVinciTile[] = [];
    for (let i = 0; i < count; i++) {
      const tile = deck.pop();
      if (tile) dealt.push(tile);
    }
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      rack: sortRack(dealt),
      eliminated: false,
    };
  });

  const state: DaVinciGameState = {
    phase: 'playing',
    stage: 'guessing',
    players,
    currentPlayerIndex: 0,
    deck,
    deckCount: deck.length,
    drawnTile: null,
    lastAction: null,
    winnerId: null,
    message: '',
  };

  return beginTurn(state, 0);
}

// Draws a tile for the player at `index` (if any remain) and hands them the turn.
function beginTurn(state: DaVinciGameState, index: number): DaVinciGameState {
  const deck = [...state.deck];
  const drawnTile = deck.pop() ?? null;
  const player = state.players[index]!;
  return {
    ...state,
    deck,
    deckCount: deck.length,
    drawnTile,
    currentPlayerIndex: index,
    stage: 'guessing',
    message: drawnTile
      ? `轮到 ${player.name}：你抽到一张牌，猜测某位对手的暗牌数字。`
      : `轮到 ${player.name}：牌堆已空，直接猜测对手暗牌。`,
  };
}

function nextActiveIndex(state: DaVinciGameState, from: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (!state.players[idx]!.eliminated) return idx;
  }
  return from;
}

function aliveCount(players: DaVinciPlayerState[]): number {
  return players.filter((p) => !p.eliminated).length;
}

function isFullyRevealed(player: DaVinciPlayerState): boolean {
  return player.rack.every((t) => t.revealed);
}

// Reveals everyone's tiles so the end screen can show the full board.
function revealAll(players: DaVinciPlayerState[]): DaVinciPlayerState[] {
  return players.map((p) => ({
    ...p,
    rack: p.rack.map((t) => ({ ...t, revealed: true })),
  }));
}

function endGame(state: DaVinciGameState, winnerId: string): DaVinciGameState {
  const winner = state.players.find((p) => p.id === winnerId);
  return {
    ...state,
    phase: 'ended',
    stage: 'guessing',
    players: revealAll(state.players),
    drawnTile: null,
    winnerId,
    message: `${winner?.name ?? '玩家'} 笑到最后，获胜！`,
  };
}

/**
 * The active player guesses the value of a specific face-down tile belonging to
 * an opponent (the color is public). Correct → the tile flips up and the player
 * may continue. Wrong → the player's drawn tile flips up and the turn ends.
 */
export function guessDaVinciTile(
  state: DaVinciGameState,
  playerId: string,
  targetPlayerId: string,
  tileIndex: number,
  value: number,
): DaVinciGameState {
  if (state.phase !== 'playing' || state.stage !== 'guessing') return state;

  const current = state.players[state.currentPlayerIndex];
  if (!current || current.id !== playerId || current.eliminated) return state;
  if (targetPlayerId === playerId) return state;

  const targetIndex = state.players.findIndex((p) => p.id === targetPlayerId);
  const target = state.players[targetIndex];
  if (!target || target.eliminated) return state;

  const tile = target.rack[tileIndex];
  if (!tile || tile.revealed) return state;

  const correct = tile.value === value;
  const lastAction: DaVinciLastAction = {
    guesserId: playerId,
    guesserName: current.name,
    targetId: targetPlayerId,
    targetName: target.name,
    position: tileIndex,
    color: tile.color,
    guessedValue: value,
    correct,
  };

  if (correct) {
    const newTargetRack = target.rack.map((t, i) =>
      i === tileIndex ? { ...t, revealed: true } : t,
    );
    const eliminated = newTargetRack.every((t) => t.revealed);
    const players = state.players.map((p, i) =>
      i === targetIndex ? { ...p, rack: newTargetRack, eliminated } : p,
    );

    const afterReveal: DaVinciGameState = { ...state, players, lastAction };

    if (aliveCount(players) <= 1) {
      const winner = players.find((p) => !p.eliminated) ?? current;
      return endGame(afterReveal, winner.id);
    }

    return {
      ...afterReveal,
      stage: 'deciding',
      message: `${current.name} 猜中了 ${target.name} 第 ${tileIndex + 1} 张牌（${formatTile(tile)}）！可继续猜测或停止结算。`,
    };
  }

  // Wrong guess: the drawn tile (or, if the deck is empty, the player's own
  // left-most still-hidden tile) is flipped face up, then the turn passes.
  return resolveWrongGuess(state, lastAction);
}

function resolveWrongGuess(
  state: DaVinciGameState,
  lastAction: DaVinciLastAction,
): DaVinciGameState {
  const currentIndex = state.currentPlayerIndex;
  const current = state.players[currentIndex]!;

  let players = state.players;
  let penaltyTile: DaVinciTile | null = state.drawnTile;

  if (penaltyTile) {
    const placed: DaVinciTile = { ...penaltyTile, revealed: true };
    players = players.map((p, i) =>
      i === currentIndex ? { ...p, rack: insertSorted(p.rack, placed) } : p,
    );
  } else {
    // Deck empty: reveal the player's own left-most hidden tile as the penalty.
    const hiddenIdx = current.rack.findIndex((t) => !t.revealed);
    if (hiddenIdx !== -1) {
      const rack = current.rack.map((t, i) =>
        i === hiddenIdx ? { ...t, revealed: true } : t,
      );
      players = players.map((p, i) => (i === currentIndex ? { ...p, rack } : p));
      penaltyTile = current.rack[hiddenIdx]!;
    }
  }

  players = players.map((p, i) =>
    i === currentIndex ? { ...p, eliminated: isFullyRevealed(p) } : p,
  );

  const afterState: DaVinciGameState = {
    ...state,
    players,
    drawnTile: null,
    lastAction,
  };

  if (aliveCount(players) <= 1) {
    const winner = players.find((p) => !p.eliminated) ?? current;
    return endGame(afterState, winner.id);
  }

  const nextIdx = nextActiveIndex(afterState, currentIndex);
  const penaltyText = penaltyTile ? `，亮出 ${formatTile(penaltyTile)}` : '';
  const begun = beginTurn(afterState, nextIdx);
  return {
    ...begun,
    message: `${current.name} 猜错了${penaltyText}。${begun.message}`,
  };
}

/**
 * After a correct guess the player either continues guessing or stops. Stopping
 * tucks the drawn tile face down into their rack and passes the turn.
 */
export function decideDaVinciContinue(
  state: DaVinciGameState,
  playerId: string,
  shouldContinue: boolean,
): DaVinciGameState {
  if (state.phase !== 'playing' || state.stage !== 'deciding') return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || current.id !== playerId) return state;

  if (shouldContinue) {
    return {
      ...state,
      stage: 'guessing',
      message: `${current.name} 选择继续猜测。`,
    };
  }

  const currentIndex = state.currentPlayerIndex;
  let players = state.players;
  if (state.drawnTile) {
    const tucked: DaVinciTile = { ...state.drawnTile, revealed: false };
    players = players.map((p, i) =>
      i === currentIndex ? { ...p, rack: insertSorted(p.rack, tucked) } : p,
    );
  }

  const afterState: DaVinciGameState = { ...state, players, drawnTile: null, lastAction: state.lastAction };
  const nextIdx = nextActiveIndex(afterState, currentIndex);
  const begun = beginTurn(afterState, nextIdx);
  return {
    ...begun,
    message: `${current.name} 收手并放回暗牌。${begun.message}`,
  };
}

function formatTile(tile: { color: DaVinciColor; value: number }): string {
  return `${tile.color === 'white' ? '白' : '黑'}${tile.value}`;
}

/**
 * Computes the set of values a face-down tile could still hold, from the
 * perspective of `viewerId`, using: the tile's known color, global uniqueness of
 * each (color, value) pair, and the strictly-increasing ordering of the rack.
 * A result of length 1 means the value is fully deducible (a guaranteed guess).
 */
export function computeDaVinciCandidates(
  state: DaVinciGameState,
  viewerId: string,
  targetId: string,
  tileIndex: number,
): number[] {
  const target = state.players.find((p) => p.id === targetId);
  if (!target) return [];
  const tile = target.rack[tileIndex];
  if (!tile || tile.revealed) return [];
  const parity = tile.color === 'white' ? 1 : 0;

  // Keys the viewer already knows are taken (so the hidden tile can't be them).
  const used = new Set<number>();
  for (const p of state.players) {
    for (const t of p.rack) {
      if (t.revealed || p.id === viewerId) used.add(tileKey(t));
    }
  }
  const cur = state.players[state.currentPlayerIndex];
  if (cur && cur.id === viewerId && state.drawnTile && state.drawnTile.value >= 0) {
    used.add(tileKey(state.drawnTile));
  }

  // Lower bound from the nearest revealed tile on the left (or the position).
  let leftBound = tileIndex;
  for (let a = tileIndex - 1; a >= 0; a--) {
    const t = target.rack[a]!;
    if (t.revealed) {
      leftBound = tileKey(t) + (tileIndex - a);
      break;
    }
  }
  // Upper bound from the nearest revealed tile on the right (or the position).
  let rightBound = MAX_KEY - (target.rack.length - 1 - tileIndex);
  for (let b = tileIndex + 1; b < target.rack.length; b++) {
    const t = target.rack[b]!;
    if (t.revealed) {
      rightBound = tileKey(t) - (b - tileIndex);
      break;
    }
  }

  const candidates: number[] = [];
  for (let k = Math.max(0, leftBound); k <= Math.min(MAX_KEY, rightBound); k++) {
    if (k % 2 !== parity) continue;
    if (used.has(k)) continue;
    candidates.push((k - parity) / 2);
  }
  return candidates;
}

interface BotGuessOption {
  targetId: string;
  tileIndex: number;
  candidates: number[];
}

function collectGuessOptions(state: DaVinciGameState, botId: string): BotGuessOption[] {
  const options: BotGuessOption[] = [];
  for (const opp of state.players) {
    if (opp.id === botId || opp.eliminated) continue;
    opp.rack.forEach((tile, i) => {
      if (tile.revealed) return;
      options.push({
        targetId: opp.id,
        tileIndex: i,
        candidates: computeDaVinciCandidates(state, botId, opp.id, i),
      });
    });
  }
  return options;
}

export function generateBotDaVinciMove(
  state: DaVinciGameState,
  botId: string,
  difficulty: AiDifficulty,
): { targetPlayerId: string; tileIndex: number; value: number } {
  const options = collectGuessOptions(state, botId);
  if (options.length === 0) {
    const fallback = state.players.find((p) => p.id !== botId && !p.eliminated);
    return { targetPlayerId: fallback?.id ?? botId, tileIndex: 0, value: 0 };
  }

  // Weaker bots (and the occasional slip from strong ones) ignore deduction.
  if (shouldBotMakeMistake(difficulty)) {
    const choice = pickRandom(options);
    return {
      targetPlayerId: choice.targetId,
      tileIndex: choice.tileIndex,
      value: Math.floor(Math.random() * (MAX_VALUE + 1)),
    };
  }

  const sorted = [...options].sort((a, b) => a.candidates.length - b.candidates.length);
  const sure = sorted.filter((o) => o.candidates.length === 1);
  const choice = sure.length > 0 ? pickRandom(sure) : sorted[0]!;
  const value =
    choice.candidates.length > 0
      ? pickRandom(choice.candidates)
      : Math.floor(Math.random() * (MAX_VALUE + 1));
  return { targetPlayerId: choice.targetId, tileIndex: choice.tileIndex, value };
}

export function generateBotDaVinciDecision(
  state: DaVinciGameState,
  botId: string,
  difficulty: AiDifficulty,
): boolean {
  const options = collectGuessOptions(state, botId);
  if (options.length === 0) return false;

  const minCandidates = Math.min(...options.map((o) => o.candidates.length));
  // A guaranteed guess is free value — always take it.
  if (minCandidates === 1) return true;

  // Otherwise press your luck only if the odds are good enough for the level.
  const riskThreshold: Record<AiDifficulty, number> = {
    easy: 1,
    medium: 1,
    hard: 2,
    expert: 3,
  };
  return minCandidates > 1 && minCandidates <= riskThreshold[difficulty];
}

/** Strips information the viewer is not allowed to see before sending to a client. */
export function redactDaVinciState(
  state: DaVinciGameState,
  viewerId: string | null,
): DaVinciGameState {
  const current = state.players[state.currentPlayerIndex];
  const hide = (t: DaVinciTile): DaVinciTile => ({ color: t.color, value: -1, revealed: false });

  const drawnVisible = current != null && viewerId != null && current.id === viewerId;

  return {
    ...state,
    deck: [],
    drawnTile: state.drawnTile
      ? drawnVisible
        ? state.drawnTile
        : hide(state.drawnTile)
      : null,
    players: state.players.map((p) => ({
      ...p,
      rack: p.rack.map((t) => (t.revealed || (viewerId != null && p.id === viewerId) ? t : hide(t))),
    })),
  };
}
