import { getActiveSocket } from '../../lib/socket';

export function emitUndercoverDescribe(description: string) {
  getActiveSocket()?.emit('game:undercover:describe', { description });
}

export function emitUndercoverVote(targetId: string) {
  getActiveSocket()?.emit('game:undercover:vote', { targetId });
}
