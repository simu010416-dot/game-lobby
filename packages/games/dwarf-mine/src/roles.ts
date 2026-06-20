import type { DwarfMineRole, BaseRole } from './types.js';
import { shuffle } from '@game-lobby/game-core';

export interface BaseRoleCounts {
  dwarves: number;
  saboteurs: number;
}

/** Official Saboteur base game role distribution by player count. */
export const BASE_ROLE_COUNTS: Record<number, BaseRoleCounts> = {
  3: { dwarves: 3, saboteurs: 1 },
  4: { dwarves: 4, saboteurs: 1 },
  5: { dwarves: 4, saboteurs: 2 },
  6: { dwarves: 5, saboteurs: 2 },
  7: { dwarves: 5, saboteurs: 3 },
  8: { dwarves: 6, saboteurs: 3 },
  9: { dwarves: 7, saboteurs: 3 },
  10: { dwarves: 7, saboteurs: 4 },
};

export function handSizeForPlayers(count: number): number {
  if (count <= 5) return 6;
  if (count <= 7) return 5;
  return 4;
}

export function assignBaseRoles(playerIds: string[]): Map<string, BaseRole> {
  const n = playerIds.length;
  const counts = BASE_ROLE_COUNTS[n];
  if (!counts) throw new Error(`Unsupported player count: ${n}`);

  const roles: BaseRole[] = [
    ...Array(counts.dwarves).fill('dwarf' as BaseRole),
    ...Array(counts.saboteurs).fill('saboteur' as BaseRole),
  ];
  const shuffled = shuffle(roles);
  const dealCount = n + 1;
  const dealt = shuffled.slice(0, dealCount);
  const extra = dealt.pop()!;
  void extra;

  const assignment = new Map<string, BaseRole>();
  playerIds.forEach((id, i) => {
    assignment.set(id, dealt[i]!);
  });
  return assignment;
}

export function saboteurGoldReward(saboteurCount: number): number {
  if (saboteurCount === 1) return 4;
  if (saboteurCount <= 3) return 3;
  return 2;
}

export function roleLabel(role: DwarfMineRole): string {
  const labels: Record<DwarfMineRole, string> = {
    dwarf: '好矮人',
    saboteur: '坏矮人',
    green_dwarf: '绿队矮人',
    blue_dwarf: '蓝队矮人',
    boss: 'Boss',
    profiteer: 'Profiteer',
    geologist: '地质学家',
  };
  return labels[role];
}

export function isSaboteur(role: DwarfMineRole): boolean {
  return role === 'saboteur';
}

export function isGoodDwarf(role: DwarfMineRole): boolean {
  return role === 'dwarf' || role === 'green_dwarf' || role === 'blue_dwarf';
}

export function isExpansionMiner(role: DwarfMineRole): boolean {
  return role === 'green_dwarf' || role === 'blue_dwarf';
}
