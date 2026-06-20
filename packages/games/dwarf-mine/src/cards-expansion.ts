import { buildBaseDrawDeck, pathCard, actionCard } from './cards-base.js';
import type { GameCard } from './types.js';
import { DIR_E, DIR_W, DIR_N, DIR_S } from './types.js';

let cardSeq = 10000;

function expansionPath(
  def: Parameters<typeof pathCard>[0],
  count: number,
): GameCard[] {
  return pathCard(def, count).map((c: GameCard) => ({
    ...c,
    id: `exp-${++cardSeq}`,
  }));
}

function expansionAction(
  actionKind: Parameters<typeof actionCard>[0],
  count: number,
): GameCard[] {
  return actionCard(actionKind, count).map((c: GameCard) => ({
    ...c,
    id: `exp-${++cardSeq}`,
  }));
}

/** Expansion path + action cards mixed with base deck. */
export function buildExpansionDrawDeck(): GameCard[] {
  const base = buildBaseDrawDeck();
  const extraPaths: GameCard[] = [
    ...expansionPath(
      { pathKind: 'bridge', connections: DIR_N | DIR_S, secondaryConnections: DIR_E | DIR_W },
      2,
    ),
    ...expansionPath(
      {
        pathKind: 'double_curve',
        connections: DIR_N | DIR_E,
        secondaryConnections: DIR_S | DIR_W,
      },
      2,
    ),
    ...expansionPath({ pathKind: 'ladder', connections: DIR_N | DIR_E | DIR_S | DIR_W, hasLadder: true }, 4),
    ...expansionPath({ pathKind: 'door', connections: DIR_N | DIR_E | DIR_S, doorColor: 'green' }, 3),
    ...expansionPath({ pathKind: 'door', connections: DIR_N | DIR_E | DIR_S, doorColor: 'blue' }, 3),
    ...expansionPath({ pathKind: 'straight', connections: DIR_E | DIR_W, crystals: 1 }, 4),
    ...expansionPath({ pathKind: 'curve', connections: DIR_N | DIR_E, crystals: 1 }, 4),
    ...expansionPath({ pathKind: 't_junction', connections: DIR_W | DIR_N | DIR_E, crystals: 2 }, 2),
  ];
  const extraActions: GameCard[] = [
    ...expansionAction('theft', 4),
    ...expansionAction('hands_off', 3),
    ...expansionAction('swap_hand', 2),
    ...expansionAction('inspection', 2),
    ...expansionAction('swap_hat', 2),
    ...expansionAction('trapped', 3),
    ...expansionAction('free', 4),
  ];
  return [...base, ...extraPaths, ...extraActions];
}

export const EXPANSION_ROLE_COUNTS: Record<string, number> = {
  green_dwarf: 4,
  blue_dwarf: 4,
  saboteur: 3,
  boss: 1,
  profiteer: 1,
  geologist: 2,
};

export function buildExpansionRoleDeck(): import('./types.js').DwarfMineRole[] {
  const roles: import('./types.js').DwarfMineRole[] = [];
  for (const [role, count] of Object.entries(EXPANSION_ROLE_COUNTS)) {
    for (let i = 0; i < count; i++) roles.push(role as import('./types.js').DwarfMineRole);
  }
  return roles;
}

export const EXPANSION_CARDS_REMOVED_PER_ROUND = 10;
export const EXPANSION_HAND_SIZE = 6;

/** Gold per winner count in expansion (official table simplified). */
export const EXPANSION_GOLD_BY_WINNERS: Record<number, number> = {
  1: 4,
  2: 3,
  3: 2,
  4: 2,
  5: 2,
  6: 1,
  7: 1,
  8: 1,
  9: 1,
  10: 1,
};
