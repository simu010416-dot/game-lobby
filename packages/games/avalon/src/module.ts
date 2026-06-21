import type { GameModule } from '@game-lobby/game-core';
import {
  advanceFromMissionReveal,
  createAvalonGame,
  pickAssassinationTarget,
  pickLadyTarget,
  pickMissionCard,
  pickRandomTeam,
  pickTeamVote,
  proposeTeam,
  redactAvalonState,
  sendEvilChat,
  submitAssassination,
  submitLadyPick,
  submitMissionCard,
  submitTeamVote,
  type AvalonGameState,
  type AvalonStartOptions,
} from './logic.js';

export type { AvalonStartOptions } from './logic.js';

export const avalonModule: GameModule<AvalonGameState, AvalonStartOptions> = {
  gameType: 'avalon',

  create(participants, options = {}) {
    return createAvalonGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  projectState(state, viewerId) {
    return redactAvalonState(state, viewerId);
  },

  insufficientPlayersHint() {
    return '阿瓦隆至少需要 5 名玩家';
  },

  runBotTurn(state, ctx) {
    if (state.phase === 'ended') return null;

    const player = state.players.find((p) => p.id === ctx.playerId);
    if (!player?.isBot) return null;

    switch (state.phase) {
      case 'team_propose': {
        if (currentLeader(state).id !== ctx.playerId) return null;
        const team = pickRandomTeam(state, ctx.playerId);
        return team ? proposeTeam(state, ctx.playerId, team) : null;
      }
      case 'team_vote': {
        if (state.teamVotes[ctx.playerId] !== undefined) return null;
        return submitTeamVote(state, ctx.playerId, pickTeamVote(state, ctx.playerId));
      }
      case 'mission_play': {
        if (!state.proposedTeam.includes(ctx.playerId)) return null;
        if (state.missionVotes[ctx.playerId] !== undefined) return null;
        return submitMissionCard(state, ctx.playerId, pickMissionCard(state, ctx.playerId));
      }
      case 'mission_reveal':
        return advanceFromMissionReveal(state);
      case 'lady_pick': {
        if (state.ladyHolderId !== ctx.playerId) return null;
        const targetId = pickLadyTarget(state, ctx.playerId);
        return targetId ? submitLadyPick(state, ctx.playerId, targetId) : null;
      }
      case 'assassination': {
        if (player.role !== 'assassin') return null;
        const targetId = pickAssassinationTarget(state);
        return targetId ? submitAssassination(state, ctx.playerId, targetId) : null;
      }
      default:
        return null;
    }
  },
};

function currentLeader(state: AvalonGameState) {
  return state.players[state.leaderIndex]!;
}
