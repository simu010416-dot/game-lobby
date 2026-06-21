import { getActiveSocket } from '../../lib/socket';

function emit(event: string, payload: unknown): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    getActiveSocket()?.emit(event, payload, resolve);
  });
}

export function emitProposeTeam(memberIds: string[]) {
  return emit('game:avalon:propose_team', { memberIds });
}

export function emitTeamVote(approve: boolean) {
  return emit('game:avalon:team_vote', { approve });
}

export function emitMissionCard(success: boolean) {
  return emit('game:avalon:mission_card', { success });
}

export function emitContinue() {
  return emit('game:avalon:continue', {});
}

export function emitLadyPick(targetId: string) {
  return emit('game:avalon:lady_pick', { targetId });
}

export function emitAssassinate(targetId: string) {
  return emit('game:avalon:assassinate', { targetId });
}

export function emitEvilChat(text: string) {
  return emit('game:avalon:evil_chat', { text });
}
