import type { AiDifficulty } from '@game-lobby/shared';

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function difficultyWeight(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case 'easy':
      return 0.25;
    case 'medium':
      return 0.5;
    case 'hard':
      return 0.75;
    case 'expert':
      return 1;
  }
}

export function shouldBotMakeMistake(difficulty: AiDifficulty): boolean {
  const mistakeChance: Record<AiDifficulty, number> = {
    easy: 0.45,
    medium: 0.25,
    hard: 0.1,
    expert: 0.03,
  };
  return Math.random() < mistakeChance[difficulty];
}
