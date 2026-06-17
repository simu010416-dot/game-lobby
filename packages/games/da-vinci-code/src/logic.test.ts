import { describe, it, expect } from 'vitest';
import { FOUR_PLAYERS, withMockRandom } from '@game-lobby/game-core/test/helpers';
import {
  createDaVinciGame,
  guessDaVinciTile,
  redactDaVinciState,
  computeDaVinciCandidates,
  JOKER_VALUE,
} from './logic.js';

describe('da-vinci logic', () => {
  it('creates a playing game without joker', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4, 0.5], () => {
      const state = createDaVinciGame([...FOUR_PLAYERS], { useJoker: false });
      expect(state.phase).toBe('playing');
      expect(state.players).toHaveLength(4);
      expect(state.useJoker).toBe(false);
    });
  });

  it('rejects guess from non-current player', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4, 0.5], () => {
      const state = createDaVinciGame(
        [
          { id: 'p1', name: 'A', isBot: false },
          { id: 'p2', name: 'B', isBot: false },
        ],
        { useJoker: false },
      );
      const notCurrent = state.players.find((p) => p.id !== state.players[state.currentPlayerIndex]!.id)!;
      const target = state.players.find((p) => p.id !== notCurrent.id)!;
      const hiddenIdx = target.rack.findIndex((t) => !t.revealed);
      const next = guessDaVinciTile(state, notCurrent.id, target.id, hiddenIdx, 0);
      expect(next).toBe(state);
    });
  });

  it('redacts hidden tiles for opponents', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4, 0.5], () => {
      const state = createDaVinciGame(
        [
          { id: 'p1', name: 'A', isBot: false },
          { id: 'p2', name: 'B', isBot: false },
        ],
        { useJoker: false },
      );
      const redacted = redactDaVinciState(state, 'p1');
      const opponent = redacted.players.find((p) => p.id === 'p2')!;
      for (const tile of opponent.rack) {
        if (!tile.revealed) {
          expect(tile.value).toBe(-1);
        }
      }
    });
  });

  it('returns empty candidates for revealed tile', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4, 0.5], () => {
      const state = createDaVinciGame(
        [
          { id: 'p1', name: 'A', isBot: false },
          { id: 'p2', name: 'B', isBot: false },
        ],
        { useJoker: false },
      );
      const target = state.players[1]!;
      const revealedIdx = target.rack.findIndex((t) => t.revealed);
      if (revealedIdx >= 0) {
        expect(computeDaVinciCandidates(state, 'p1', 'p2', revealedIdx)).toEqual([]);
      }
    });
  });

  it('exports joker sentinel value', () => {
    expect(JOKER_VALUE).toBe(12);
  });
});
