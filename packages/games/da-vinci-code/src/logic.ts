import type { AiDifficulty } from '@game-lobby/shared';
import { pickRandom, shouldBotMakeMistake, shuffle } from '@game-lobby/game-core';

// `setup` is a Joker-mode-only opening phase where every player privately
// arranges their starting rack at the same time. Because everyone goes through
// it (and individual readiness is not exposed), no one can tell who drew a
// Joker from the existence of the step.
export type DaVinciPhase = 'setup' | 'playing' | 'ended';

// Within a turn: the active player must first make a guess. If the guess is
// correct they then decide whether to keep guessing or stop and settle.
// `placing` is only reached in Joker mode, when the active player holds a Joker
// they drew and must choose where to insert it into their own rack.
export type DaVinciStage = 'guessing' | 'deciding' | 'placing';

export type DaVinciColor = 'black' | 'white';

// Sentinel "value" used both for a Joker tile and for a guess of "this is a
// Joker". MAX_VALUE is 11, so 12 never collides with a real numbered tile.
export const JOKER_VALUE = 12;

export interface DaVinciTile {
  color: DaVinciColor;
  value: number; // 0..11 (a hidden value redacted for opponents is sent as -1)
  revealed: boolean; // face up (known to everyone) when true
  isJoker: boolean; // wildcard tile shown as "-"; can sit anywhere in the rack
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
  // Whether this match includes the two Joker tiles.
  useJoker: boolean;
  // Room-wide UI assist: highlight still-possible guess values. Locked at game start.
  assistMode: boolean;
  // When stage === 'placing', describes the pending Joker placement: faceUp is
  // true for a wrong-guess penalty (placed revealed), false when settling
  // (placed face down). null otherwise.
  placement: { faceUp: boolean } | null;
  // During the `setup` phase, the ids of players who have locked in their
  // starting arrangement. Clients should only surface the count, never the
  // membership, to avoid timing-based inference about who holds a Joker.
  setupReady: string[];
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

function buildDeck(useJoker: boolean): DaVinciTile[] {
  const tiles: DaVinciTile[] = [];
  for (let v = 0; v <= MAX_VALUE; v++) {
    tiles.push({ color: 'black', value: v, revealed: false, isJoker: false });
    tiles.push({ color: 'white', value: v, revealed: false, isJoker: false });
  }
  if (useJoker) {
    tiles.push({ color: 'black', value: JOKER_VALUE, revealed: false, isJoker: true });
    tiles.push({ color: 'white', value: JOKER_VALUE, revealed: false, isJoker: true });
  }
  return tiles;
}

// Inserts a NUMBERED tile so the numbered subsequence stays strictly ascending.
// Jokers carry no numeric key, so they are skipped when finding the slot and
// simply remain wherever their owner placed them.
function insertNumbered(rack: DaVinciTile[], tile: DaVinciTile): DaVinciTile[] {
  const next = [...rack];
  const key = tileKey(tile);
  let i = next.findIndex((t) => !t.isJoker && tileKey(t) > key);
  if (i === -1) i = next.length;
  next.splice(i, 0, tile);
  return next;
}

// Adds a tile to a rack during play: numbered tiles auto-sort; a Joker is
// inserted at the explicit index its owner (or a bot) chose.
function addTile(rack: DaVinciTile[], tile: DaVinciTile, jokerIndex?: number): DaVinciTile[] {
  if (!tile.isJoker) return insertNumbered(rack, tile);
  const idx = Math.max(0, Math.min(jokerIndex ?? rack.length, rack.length));
  const next = [...rack];
  next.splice(idx, 0, tile);
  return next;
}

// Builds a starting rack. Numbered tiles are sorted; any dealt Joker is dropped
// at a random position (its hidden initial placement isn't visible to others).
function buildStartingRack(dealt: DaVinciTile[]): DaVinciTile[] {
  let rack: DaVinciTile[] = [];
  for (const tile of dealt.filter((t) => !t.isJoker)) {
    rack = insertNumbered(rack, tile);
  }
  for (const joker of dealt.filter((t) => t.isJoker)) {
    const idx = Math.floor(Math.random() * (rack.length + 1));
    rack = addTile(rack, joker, idx);
  }
  return rack;
}

function startingTileCount(playerCount: number): number {
  // Classic rule: 2 players draw 4 tiles each, 3-4 players draw 3 each.
  return playerCount <= 2 ? 4 : 3;
}

export function createDaVinciGame(
  participants: { id: string; name: string; isBot: boolean }[],
  options: { useJoker?: boolean; assistMode?: boolean } = {},
): DaVinciGameState {
  const useJoker = options.useJoker ?? false;
  const assistMode = options.assistMode ?? true;
  const deck = shuffle(buildDeck(useJoker));
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
      rack: buildStartingRack(dealt),
      eliminated: false,
    };
  });

  // In Joker mode every player first arranges their starting rack. Bots lock in
  // their (already randomized) arrangement immediately so only humans gate the
  // start; this keeps the setup step uniform and non-revealing.
  const botIds = participants.filter((p) => p.isBot).map((p) => p.id);

  const state: DaVinciGameState = {
    phase: useJoker ? 'setup' : 'playing',
    stage: 'guessing',
    players,
    currentPlayerIndex: 0,
    deck,
    deckCount: deck.length,
    drawnTile: null,
    lastAction: null,
    winnerId: null,
    message: useJoker ? '摆放阶段：安排你的起始牌（可移动 Joker），完成后确认。' : '',
    useJoker,
    assistMode,
    placement: null,
    setupReady: useJoker ? botIds : [],
  };

  return useJoker ? maybeStartPlay(state) : beginTurn(state, 0);
}

function allSetupReady(state: DaVinciGameState): boolean {
  return state.players.every((p) => state.setupReady.includes(p.id));
}

// Transitions out of setup once everyone has locked in their arrangement.
function maybeStartPlay(state: DaVinciGameState): DaVinciGameState {
  if (state.phase !== 'setup' || !allSetupReady(state)) return state;
  return beginTurn({ ...state, phase: 'playing' }, 0);
}

/**
 * Joker-mode setup: a player submits the final order of their own starting rack.
 * The numbered tiles must stay strictly ascending; Jokers may sit anywhere. The
 * submitted multiset must exactly match what was dealt (the server stays
 * authoritative over tile values). Idempotent per player.
 */
export function submitDaVinciSetup(
  state: DaVinciGameState,
  playerId: string,
  tiles: { color: DaVinciColor; value: number; isJoker: boolean }[],
): DaVinciGameState {
  if (state.phase !== 'setup') return state;
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return state;
  if (state.setupReady.includes(playerId)) return state;

  const current = state.players[idx]!.rack;
  if (tiles.length !== current.length) return state;

  const sig = (t: { color: DaVinciColor; value: number; isJoker: boolean }) =>
    `${t.color}|${t.isJoker ? 'J' : t.value}`;
  const want = current.map(sig).sort().join(',');
  const got = tiles.map(sig).sort().join(',');
  if (want !== got) return state;

  // Numbered subsequence must remain strictly ascending by key.
  const numbered = tiles.filter((t) => !t.isJoker);
  for (let i = 1; i < numbered.length; i++) {
    if (tileKey(numbered[i - 1]!) >= tileKey(numbered[i]!)) return state;
  }

  const newRack: DaVinciTile[] = tiles.map((t) => ({
    color: t.color,
    value: t.isJoker ? JOKER_VALUE : t.value,
    revealed: false,
    isJoker: t.isJoker,
  }));

  const players = state.players.map((p, i) => (i === idx ? { ...p, rack: newRack } : p));
  const next: DaVinciGameState = { ...state, players, setupReady: [...state.setupReady, playerId] };
  return maybeStartPlay(next);
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
    placement: null,
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
    placement: null,
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

  // A guess of JOKER_VALUE means "I think this is a Joker"; any other value is a
  // numeric guess. Each only matches its own kind of tile.
  const isJokerGuess = value === JOKER_VALUE;
  const correct = tile.isJoker ? isJokerGuess : !isJokerGuess && tile.value === value;
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

  // A drawn Joker can't auto-sort — the player chooses where it goes (face up).
  if (state.drawnTile && state.drawnTile.isJoker) {
    return {
      ...state,
      stage: 'placing',
      placement: { faceUp: true },
      lastAction,
      message: `${current.name} 猜错了，请选择位置将 Joker 亮出插入你的牌组。`,
    };
  }

  let players = state.players;
  let penaltyTile: DaVinciTile | null = state.drawnTile;

  if (penaltyTile) {
    const placed: DaVinciTile = { ...penaltyTile, revealed: true };
    players = players.map((p, i) =>
      i === currentIndex ? { ...p, rack: insertNumbered(p.rack, placed) } : p,
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

  // A drawn Joker is placed face down at a position of the player's choosing.
  if (state.drawnTile && state.drawnTile.isJoker) {
    return {
      ...state,
      stage: 'placing',
      placement: { faceUp: false },
      message: `${current.name} 收手，请选择位置将 Joker 暗置插入你的牌组。`,
    };
  }

  let players = state.players;
  if (state.drawnTile) {
    const tucked: DaVinciTile = { ...state.drawnTile, revealed: false };
    players = players.map((p, i) =>
      i === currentIndex ? { ...p, rack: insertNumbered(p.rack, tucked) } : p,
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

/**
 * Joker mode only: the active player inserts the Joker they are holding into
 * their own rack at `index`. A wrong-guess Joker goes face up and ends the turn;
 * a settled Joker goes face down and ends the turn.
 */
export function placeDaVinciJoker(
  state: DaVinciGameState,
  playerId: string,
  index: number,
): DaVinciGameState {
  if (state.phase !== 'playing' || state.stage !== 'placing') return state;
  const currentIndex = state.currentPlayerIndex;
  const current = state.players[currentIndex];
  if (!current || current.id !== playerId) return state;
  if (!state.drawnTile || !state.drawnTile.isJoker) return state;

  const faceUp = state.placement?.faceUp ?? false;
  const joker: DaVinciTile = { ...state.drawnTile, revealed: faceUp };
  const clamped = Math.max(0, Math.min(index, current.rack.length));

  let players = state.players.map((p, i) =>
    i === currentIndex ? { ...p, rack: addTile(p.rack, joker, clamped) } : p,
  );
  players = players.map((p, i) =>
    i === currentIndex ? { ...p, eliminated: isFullyRevealed(p) } : p,
  );

  const afterState: DaVinciGameState = {
    ...state,
    players,
    drawnTile: null,
    placement: null,
  };

  if (aliveCount(players) <= 1) {
    const winner = players.find((p) => !p.eliminated) ?? current;
    return endGame(afterState, winner.id);
  }

  const nextIdx = nextActiveIndex(afterState, currentIndex);
  const begun = beginTurn(afterState, nextIdx);
  const placedText = faceUp ? '亮出' : '暗置';
  return {
    ...begun,
    message: `${current.name} 将 Joker ${placedText}插入牌组。${begun.message}`,
  };
}

function formatTile(tile: { color: DaVinciColor; value: number; isJoker?: boolean }): string {
  const c = tile.color === 'white' ? '白' : '黑';
  return tile.isJoker ? `${c}Joker(-)` : `${c}${tile.value}`;
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
  // Jokers carry no numeric key, so they never consume one.
  const used = new Set<number>();
  for (const p of state.players) {
    for (const t of p.rack) {
      if (t.isJoker) continue;
      if (t.revealed || p.id === viewerId) used.add(tileKey(t));
    }
  }
  const cur = state.players[state.currentPlayerIndex];
  if (cur && cur.id === viewerId && state.drawnTile && !state.drawnTile.isJoker && state.drawnTile.value >= 0) {
    used.add(tileKey(state.drawnTile));
  }

  let leftBound: number;
  let rightBound: number;
  if (state.useJoker) {
    // With Jokers in play a hidden tile may be a Joker, so positional ordering
    // can't be trusted to narrow the range — fall back to colour parity only.
    leftBound = 0;
    rightBound = MAX_KEY;
  } else {
    // Lower bound from the nearest revealed tile on the left (or the position).
    leftBound = tileIndex;
    for (let a = tileIndex - 1; a >= 0; a--) {
      const t = target.rack[a]!;
      if (t.revealed) {
        leftBound = tileKey(t) + (tileIndex - a);
        break;
      }
    }
    // Upper bound from the nearest revealed tile on the right (or the position).
    rightBound = MAX_KEY - (target.rack.length - 1 - tileIndex);
    for (let b = tileIndex + 1; b < target.rack.length; b++) {
      const t = target.rack[b]!;
      if (t.revealed) {
        rightBound = tileKey(t) - (b - tileIndex);
        break;
      }
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

/**
 * Whether a still-hidden Joker of `color` could exist somewhere the viewer can't
 * see (i.e. the Joker hasn't been revealed and isn't in the viewer's own rack).
 * Used to decide whether "guess Joker" is a live option for a given tile.
 */
export function jokerStillPossible(
  state: DaVinciGameState,
  viewerId: string,
  color: DaVinciColor,
): boolean {
  if (!state.useJoker) return false;
  for (const p of state.players) {
    for (const t of p.rack) {
      if (!t.isJoker || t.color !== color) continue;
      // Seen by the viewer if revealed or it's the viewer's own tile.
      if (t.revealed || p.id === viewerId) return false;
    }
  }
  const cur = state.players[state.currentPlayerIndex];
  if (cur && cur.id === viewerId && state.drawnTile?.isJoker && state.drawnTile.color === color) {
    return false;
  }
  return true;
}

interface BotGuessOption {
  targetId: string;
  tileIndex: number;
  candidates: number[];
  jokerPossible: boolean;
}

// How many distinct things this tile could still be: numeric candidates plus a
// Joker if one could still be hiding there.
function optionUncertainty(o: BotGuessOption): number {
  return o.candidates.length + (o.jokerPossible ? 1 : 0);
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
        jokerPossible: jokerStillPossible(state, botId, tile.color),
      });
    });
  }
  return options;
}

function botGuessValue(o: BotGuessOption): number {
  if (o.candidates.length === 0) {
    // No number fits — it must be a Joker (when one is still possible).
    return o.jokerPossible ? JOKER_VALUE : Math.floor(Math.random() * (MAX_VALUE + 1));
  }
  return pickRandom(o.candidates);
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

  const sorted = [...options].sort((a, b) => optionUncertainty(a) - optionUncertainty(b));
  const sure = sorted.filter((o) => optionUncertainty(o) === 1);
  const choice = sure.length > 0 ? pickRandom(sure) : sorted[0]!;
  return { targetPlayerId: choice.targetId, tileIndex: choice.tileIndex, value: botGuessValue(choice) };
}

/** Joker mode: a bot drops its held Joker at a random slot in its own rack. */
export function generateBotDaVinciPlacement(state: DaVinciGameState, botId: string): number {
  const bot = state.players.find((p) => p.id === botId);
  const len = bot ? bot.rack.length : 0;
  return Math.floor(Math.random() * (len + 1));
}

export function generateBotDaVinciDecision(
  state: DaVinciGameState,
  botId: string,
  difficulty: AiDifficulty,
): boolean {
  const options = collectGuessOptions(state, botId);
  if (options.length === 0) return false;

  const minUncertainty = Math.min(...options.map(optionUncertainty));
  // A guaranteed guess is free value — always take it.
  if (minUncertainty === 1) return true;

  // Otherwise press your luck only if the odds are good enough for the level.
  const riskThreshold: Record<AiDifficulty, number> = {
    easy: 1,
    medium: 1,
    hard: 2,
    expert: 3,
  };
  return minUncertainty > 1 && minUncertainty <= riskThreshold[difficulty];
}

/** Strips information the viewer is not allowed to see before sending to a client. */
export function redactDaVinciState(
  state: DaVinciGameState,
  viewerId: string | null,
): DaVinciGameState {
  const current = state.players[state.currentPlayerIndex];
  // A hidden tile (incl. a hidden Joker) looks like any other face-down tile of
  // its colour: its value AND its Joker-ness are stripped.
  const hide = (t: DaVinciTile): DaVinciTile => ({ color: t.color, value: -1, revealed: false, isJoker: false });

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
