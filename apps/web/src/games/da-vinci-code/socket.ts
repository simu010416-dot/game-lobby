import { getActiveSocket } from '../../lib/socket';

export function emitDaVinciGuess(targetPlayerId: string, tileIndex: number, value: number) {
  getActiveSocket()?.emit('game:davinci:guess', { targetPlayerId, tileIndex, value });
}

export function emitDaVinciDecision(shouldContinue: boolean) {
  getActiveSocket()?.emit('game:davinci:decision', { continue: shouldContinue });
}

export function emitDaVinciPlace(index: number) {
  getActiveSocket()?.emit('game:davinci:place', { index });
}

export function emitDaVinciSetup(
  tiles: { color: 'black' | 'white'; value: number; isJoker: boolean }[],
) {
  getActiveSocket()?.emit('game:davinci:setup', { tiles });
}
