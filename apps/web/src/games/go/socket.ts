import { getActiveSocket } from '../../lib/socket';

export function emitGoPlay(x: number, y: number): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    getActiveSocket()?.emit('game:go:play', { x, y }, resolve);
  });
}

export function emitGoPass(): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    getActiveSocket()?.emit('game:go:pass', {}, resolve);
  });
}

export function emitGoResign(): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    getActiveSocket()?.emit('game:go:resign', {}, resolve);
  });
}
