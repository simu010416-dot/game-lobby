/** Pin Math.random for deterministic game creation in tests. */
export function withMockRandom(values: number[], fn: () => void): void {
  const original = Math.random;
  let i = 0;
  Math.random = () => {
    const v = values[Math.min(i, values.length - 1)] ?? 0;
    i++;
    return v;
  };
  try {
    fn();
  } finally {
    Math.random = original;
  }
}

export const FOUR_PLAYERS = [
  { id: 'p1', name: 'A', isBot: false },
  { id: 'p2', name: 'B', isBot: false },
  { id: 'p3', name: 'C', isBot: false },
  { id: 'p4', name: 'D', isBot: false },
] as const;
