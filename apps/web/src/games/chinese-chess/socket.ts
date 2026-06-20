import { getActiveSocket } from '../../lib/socket';

export function emitChineseChessMove(from: string, to: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:xiangqi:move', { from, to }, resolve);
  });
}

export function emitChineseChessResign() {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:xiangqi:resign', {}, resolve);
  });
}

export function emitChineseChessOfferDraw() {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:xiangqi:offer_draw', {}, resolve);
  });
}

export function emitChineseChessRespondDraw(accept: boolean) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:xiangqi:respond_draw', { accept }, resolve);
  });
}
