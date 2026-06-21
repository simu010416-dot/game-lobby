import { describe, expect, it } from 'vitest';
import type { AvalonRole } from './logic.js';
import {
  advanceFromMissionReveal,
  createAvalonGame,
  proposeTeam,
  redactAvalonState,
  submitAssassination,
  submitLadyPick,
  submitMissionCard,
  submitTeamVote,
  validatePlayerCount,
} from './logic.js';

function participants(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `玩家${i}`,
    isBot: false,
  }));
}

function forceRoles(state: ReturnType<typeof createAvalonGame>, roles: AvalonRole[]) {
  return {
    ...state,
    players: state.players.map((p, i) => ({ ...p, role: roles[i] ?? p.role })),
  } as ReturnType<typeof createAvalonGame>;
}

function approveTeam(state: ReturnType<typeof createAvalonGame>) {
  let s = state;
  for (const p of s.players) {
    s = submitTeamVote(s, p.id, true);
  }
  return s;
}

describe('validatePlayerCount', () => {
  it('requires at least 5 players', () => {
    expect(validatePlayerCount(4).ok).toBe(false);
    expect(validatePlayerCount(5).ok).toBe(true);
  });
});

describe('createAvalonGame', () => {
  it('starts at team propose for quest 1', () => {
    const state = createAvalonGame(participants(5));
    expect(state.phase).toBe('team_propose');
    expect(state.quest).toBe(1);
    expect(state.players).toHaveLength(5);
  });
});

describe('five rejections', () => {
  it('evil wins after 5 consecutive team rejections', () => {
    let state = createAvalonGame(participants(5));
    for (let i = 0; i < 5; i++) {
      const leader = state.players[state.leaderIndex]!;
      const team = state.players.slice(0, 2).map((p) => p.id);
      state = proposeTeam(state, leader.id, team);
      for (const p of state.players) {
        state = submitTeamVote(state, p.id, false);
      }
    }
    expect(state.phase).toBe('ended');
    expect(state.winner).toBe('evil');
  });
});

describe('mission flow', () => {
  it('good wins three quests then enters assassination', () => {
    let state = forceRoles(createAvalonGame(participants(5), { useLadyOfLake: false }), [
      'merlin',
      'loyal',
      'loyal',
      'assassin',
      'minion',
    ]);

    for (let q = 0; q < 3; q++) {
      const leader = state.players[state.leaderIndex]!;
      const teamSize = q === 1 ? 3 : 2;
      const team = state.players.slice(state.leaderIndex, state.leaderIndex + teamSize).map((p) => p.id);
      if (team.length < teamSize) {
        team.push(...state.players.slice(0, teamSize - team.length).map((p) => p.id));
      }
      state = proposeTeam(state, leader.id, team.slice(0, teamSize));
      state = approveTeam(state);
      for (const id of state.proposedTeam) {
        state = submitMissionCard(state, id, true);
      }
      state = advanceFromMissionReveal(state);
    }

    expect(state.phase).toBe('assassination');
    expect(state.successCount).toBe(3);
  });

  it('assassin killing merlin lets evil win', () => {
    let state = forceRoles(createAvalonGame(participants(5)), [
      'merlin',
      'loyal',
      'loyal',
      'assassin',
      'minion',
    ]);
    state = { ...state, phase: 'assassination', successCount: 3 };
    const assassin = state.players.find((p) => p.role === 'assassin')!;
    const merlin = state.players.find((p) => p.role === 'merlin')!;
    state = submitAssassination(state, assassin.id, merlin.id);
    expect(state.winner).toBe('evil');
  });

  it('assassin missing merlin lets good win', () => {
    let state = forceRoles(createAvalonGame(participants(5)), [
      'merlin',
      'loyal',
      'loyal',
      'assassin',
      'minion',
    ]);
    state = { ...state, phase: 'assassination', successCount: 3 };
    const assassin = state.players.find((p) => p.role === 'assassin')!;
    const loyal = state.players.find((p) => p.role === 'loyal')!;
    state = submitAssassination(state, assassin.id, loyal!.id);
    expect(state.winner).toBe('good');
  });
});

describe('visibility', () => {
  it('merlin sees evil except mordred and oberon', () => {
    const state = forceRoles(createAvalonGame(participants(10)), [
      'merlin',
      'percival',
      'loyal',
      'loyal',
      'loyal',
      'loyal',
      'assassin',
      'morgana',
      'mordred',
      'oberon',
    ]);
    const merlin = state.players.find((p) => p.role === 'merlin')!;
    const view = redactAvalonState(state, merlin.id);
    expect(view.viewerInfo?.merlinSeesEvil?.map((p) => p.id)).toEqual([
      state.players.find((p) => p.role === 'assassin')!.id,
      state.players.find((p) => p.role === 'morgana')!.id,
    ]);
  });

  it('oberon is isolated from evil chat teammates', () => {
    const state = forceRoles(createAvalonGame(participants(10)), [
      'merlin',
      'percival',
      'loyal',
      'loyal',
      'loyal',
      'loyal',
      'assassin',
      'morgana',
      'mordred',
      'oberon',
    ]);
    const oberon = state.players.find((p) => p.role === 'oberon')!;
    const view = redactAvalonState(state, oberon.id);
    expect(view.viewerInfo?.evilTeammates).toBeUndefined();
  });

  it('percival sees merlin and morgana', () => {
    const state = forceRoles(createAvalonGame(participants(8)), [
      'merlin',
      'percival',
      'loyal',
      'loyal',
      'loyal',
      'assassin',
      'morgana',
      'mordred',
    ]);
    const percival = state.players.find((p) => p.role === 'percival')!;
    const view = redactAvalonState(state, percival.id);
    expect(view.viewerInfo?.percivalSees).toHaveLength(2);
  });

  it('hides mission votes until reveal', () => {
    let state = forceRoles(createAvalonGame(participants(5)), [
      'merlin',
      'loyal',
      'loyal',
      'assassin',
      'minion',
    ]);
    const leader = state.players[state.leaderIndex]!;
    state = proposeTeam(state, leader.id, [leader.id, state.players[1]!.id]);
    state = approveTeam(state);
    const voterId = state.proposedTeam[0]!;
    state = submitMissionCard(state, voterId, true);
    const viewer = redactAvalonState(state, voterId);
    expect(Object.keys(viewer.missionVotes)).toEqual([voterId]);
  });
});

describe('lady of the lake', () => {
  it('passes token to investigated player', () => {
    let state = forceRoles(createAvalonGame(participants(5), { useLadyOfLake: true }), [
      'merlin',
      'loyal',
      'loyal',
      'assassin',
      'minion',
    ]);
    const holderId = state.ladyHolderId!;
    const target = state.players.find((p) => p.id !== holderId)!;
    state = {
      ...state,
      phase: 'lady_pick',
      quest: 3,
    };
    state = submitLadyPick(state, holderId, target.id);
    expect(state.ladyHolderId).toBe(target.id);
    expect(state.ladyUsedOn).toContain(target.id);
    expect(state.phase).toBe('team_propose');
  });
});
