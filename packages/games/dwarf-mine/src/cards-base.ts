import type { GameCard, PathCardDef, ActionCardDef, CardDef } from './types.js';

let cardSeq = 0;

function nextId(prefix: string): string {
  cardSeq += 1;
  return `${prefix}-${cardSeq}`;
}

export function pathCard(def: Omit<PathCardDef, 'kind'>, count: number): GameCard[] {
  const cards: GameCard[] = [];
  const fullDef: PathCardDef = { kind: 'path', ...def };
  for (let i = 0; i < count; i++) {
    cards.push({ id: nextId('path'), def: fullDef });
  }
  return cards;
}

export function actionCard(actionKind: ActionCardDef['actionKind'], count: number): GameCard[] {
  const cards: GameCard[] = [];
  const def: ActionCardDef = { kind: 'action', actionKind };
  for (let i = 0; i < count; i++) {
    cards.push({ id: nextId('act'), def });
  }
  return cards;
}

export function buildBaseDrawDeck(): GameCard[] {
  cardSeq = 0;
  const paths: GameCard[] = [
    ...pathCard({ pathKind: 'straight', connections: DIR_E | DIR_W }, 6),
    ...pathCard({ pathKind: 'straight', connections: DIR_N | DIR_S }, 6),
    ...pathCard({ pathKind: 'curve', connections: DIR_N | DIR_E }, 8),
    ...pathCard({ pathKind: 't_junction', connections: DIR_W | DIR_N | DIR_E }, 8),
    ...pathCard({ pathKind: 'cross', connections: DIR_N | DIR_E | DIR_S | DIR_W }, 5),
    ...pathCard({ pathKind: 'dead_end', connections: DIR_E }, 7),
  ];
  const actions: GameCard[] = [
    ...actionCard('broken_lamp', 3),
    ...actionCard('broken_pickaxe', 3),
    ...actionCard('broken_cart', 3),
    ...actionCard('repair_lamp', 3),
    ...actionCard('repair_pickaxe', 3),
    ...actionCard('repair_cart', 3),
    ...actionCard('map', 2),
    ...actionCard('collapse', 2),
  ];
  return [...paths, ...actions];
}

/** Gold nugget card values for distribution. */
export function buildGoldDeck(): number[] {
  const values: number[] = [];
  for (let v = 0; v <= 3; v++) {
    const count = v === 3 ? 5 : v === 2 ? 8 : v === 1 ? 10 : 5;
    for (let i = 0; i < count; i++) values.push(v === 0 ? 1 : v);
  }
  return values;
}

export function isPathCard(def: CardDef): def is PathCardDef {
  return def.kind === 'path';
}

export function isActionCard(def: CardDef): def is ActionCardDef {
  return def.kind === 'action';
}

// Re-export direction constants used in path building
import { DIR_N, DIR_E, DIR_S, DIR_W } from './types.js';

export { DIR_N, DIR_E, DIR_S, DIR_W };
