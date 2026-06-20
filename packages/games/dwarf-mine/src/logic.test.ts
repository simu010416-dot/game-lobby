import { describe, it, expect } from 'vitest';
import { createDwarfMineGame, playPath, discardCard, redactDwarfMineState, continueRound } from './logic.js';
import { assignBaseRoles, handSizeForPlayers } from './roles.js';
import { createExpansionGame } from './logic-expansion.js';
import { EXPANSION_HAND_SIZE } from './cards-expansion.js';
import { canPlacePath } from './board.js';
import { DIR_E, DIR_W } from './types.js';

const players = [
  { id: 'p1', name: 'Alice', isBot: false },
  { id: 'p2', name: 'Bob', isBot: false },
  { id: 'p3', name: 'Carol', isBot: false },
];

describe('base mode', () => {
  it('assigns roles for 3 players from deck', () => {
    const roles = assignBaseRoles(['p1', 'p2', 'p3']);
    expect(roles.size).toBe(3);
    const values = [...roles.values()];
    expect(values.filter((r) => r === 'dwarf').length + values.filter((r) => r === 'saboteur').length).toBe(3);
  });

  it('deals correct hand size', () => {
    expect(handSizeForPlayers(4)).toBe(6);
    expect(handSizeForPlayers(7)).toBe(5);
    expect(handSizeForPlayers(10)).toBe(4);
  });

  it('creates a playable base game', () => {
    const state = createDwarfMineGame(players, { mode: 'base' });
    expect(state.mode).toBe('base');
    expect(state.phase).toBe('playing');
    expect(state.players).toHaveLength(3);
    expect(state.players[0]!.hand.length).toBe(6);
    expect(state.deckCount).toBeGreaterThan(0);
  });

  it('rejects invalid path placement', () => {
    const pathDef = { kind: 'path' as const, pathKind: 'straight' as const, connections: DIR_E | DIR_W };
    const board = createDwarfMineGame(players).board;
    expect(canPlacePath(board, 0, 0, pathDef, 0)).toBe(false);
  });

  it('opening hand usually has playable path placements', () => {
    let zero = 0;
    for (let i = 0; i < 50; i++) {
      const state = createDwarfMineGame(players, { mode: 'base' });
      let count = 0;
      for (const card of state.players[0]!.hand) {
        if (card.def.kind !== 'path') continue;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 9; c++) {
            for (const rot of [0, 90, 180, 270] as const) {
              if (canPlacePath(state.board, r, c, card.def, rot)) count++;
            }
          }
        }
      }
      if (count === 0) zero++;
    }
    expect(zero).toBeLessThan(10);
  });

  it('allows discard on turn', () => {
    const state = createDwarfMineGame(players, { mode: 'base' });
    const cardId = state.players[0]!.hand[0]!.id;
    const next = discardCard(state, 'p1', cardId);
    expect(next.players[0]!.hand.length).toBe(5);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('redacts other players hands and roles', () => {
    const state = createDwarfMineGame(players, { mode: 'base' });
    const view = redactDwarfMineState(state, 'p1');
    expect(view.players[0]!.hand.length).toBeGreaterThan(0);
    expect(view.players[1]!.hand).toHaveLength(0);
    expect(view.players[1]!.role).toBe('hidden');
  });

  it('advances rounds until ended', () => {
    let state = createDwarfMineGame(players, { mode: 'base' });
    state.phase = 'round_end';
    state.round = 1;
    state = continueRound(state);
    expect(state.round).toBe(2);
    state.phase = 'round_end';
    state.round = 3;
    state = continueRound(state);
    expect(state.phase).toBe('ended');
  });
});

describe('expansion mode', () => {
  it('creates expansion game with 6 cards each', () => {
    const state = createExpansionGame(players);
    expect(state.mode).toBe('expansion');
    expect(state.players.every((p) => p.hand.length === EXPANSION_HAND_SIZE)).toBe(true);
    expect(state.removedDeckCount).toBe(10);
  });

  it('assigns expansion roles with teams', () => {
    const state = createExpansionGame(players);
    const teams = state.players.map((p) => p.team);
    expect(teams.some((t) => t === 'green' || t === 'blue' || t === null)).toBe(true);
  });
});
