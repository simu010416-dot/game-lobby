import { describe, it, expect } from 'vitest';
import { FOUR_PLAYERS, withMockRandom } from '@game-lobby/game-core/test/helpers';
import {
  createUndercoverGame,
  submitUndercoverDescription,
  submitUndercoverVote,
} from './logic.js';

describe('undercover logic', () => {
  it('rejects describe from wrong player', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      const state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨']);
      const alive = state.players.filter((p) => p.isAlive);
      const wrongId = alive[1]!.id;
      const next = submitUndercoverDescription(state, wrongId, 'hint');
      expect(next).toBe(state);
    });
  });

  it('advances to vote after all players describe', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      let state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨']);
      const alive = state.players.filter((p) => p.isAlive);
      for (const p of alive) {
        state = submitUndercoverDescription(state, p.id, '描述');
      }
      expect(state.phase).toBe('vote');
    });
  });

  it('ends with civilian win when undercover is eliminated', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      let state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨']);
      const alive = state.players.filter((p) => p.isAlive);
      for (const p of alive) {
        state = submitUndercoverDescription(state, p.id, '描述');
      }
      const undercover = state.players.find((p) => p.isUndercover)!;
      for (const p of alive) {
        state = submitUndercoverVote(state, p.id, undercover.id);
        if (state.phase === 'ended') break;
      }
      expect(state.phase).toBe('ended');
      expect(state.winner).toBe('civilian');
    });
  });

  it('rejects vote in describe phase', () => {
    withMockRandom([0.1], () => {
      const state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨']);
      const target = state.players[0]!.id;
      expect(submitUndercoverVote(state, state.players[1]!.id, target)).toBe(state);
    });
  });
});
