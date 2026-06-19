import { getActiveSocket } from '../../lib/socket';

export function emitGomokuPlace(row: number, col: number) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:gomoku:place', { row, col }, resolve);
  });
}
