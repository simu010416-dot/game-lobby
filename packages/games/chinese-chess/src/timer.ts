import type { ChineseChessColor, ChineseChessGameState } from './logic.js';

function findPlayerByColor(state: ChineseChessGameState, color: ChineseChessColor) {
  return state.players.find((p) => p.color === color);
}

export function deductElapsedTime(state: ChineseChessGameState, now: number): ChineseChessGameState {
  if (state.phase !== 'playing' || !state.timeSettings) return state;

  const elapsed = Math.max(0, now - state.turnStartedAt);
  if (elapsed === 0) return state;

  const color = state.currentColor;
  const player = findPlayerByColor(state, color);
  if (!player) return state;

  const mainTimeMs = Math.max(0, player.mainTimeMs - elapsed);
  const players = state.players.map((p) =>
    p.color === color ? { ...p, mainTimeMs } : p,
  );

  return { ...state, players, turnStartedAt: now };
}

export function applyIncrementAfterMove(
  state: ChineseChessGameState,
  moverColor: ChineseChessColor,
  now: number,
): ChineseChessGameState {
  const afterDeduct = deductElapsedTime(state, now);
  const incrementMs = afterDeduct.timeSettings?.incrementMs ?? 0;
  const players =
    incrementMs > 0
      ? afterDeduct.players.map((p) =>
          p.color === moverColor ? { ...p, mainTimeMs: p.mainTimeMs + incrementMs } : p,
        )
      : afterDeduct.players;

  return {
    ...afterDeduct,
    players,
    currentColor: moverColor === 'red' ? 'black' : 'red',
    turnStartedAt: now,
    drawOffer: null,
  };
}

export function tickChineseChessGame(
  state: ChineseChessGameState,
  now = Date.now(),
): ChineseChessGameState {
  if (state.phase !== 'playing' || !state.timeSettings) return state;

  const elapsed = now - state.turnStartedAt;
  if (elapsed < 1000) return state;

  const afterDeduct = deductElapsedTime(state, now);
  const color = afterDeduct.currentColor;
  const player = findPlayerByColor(afterDeduct, color);
  if (!player || player.mainTimeMs > 0) return afterDeduct;

  const winner = afterDeduct.players.find((p) => p.color !== color);
  return {
    ...afterDeduct,
    phase: 'ended',
    winnerId: winner?.id ?? null,
    endReason: 'timeout',
    message: `${player.name} 超时，${winner?.name ?? '对手'} 获胜`,
  };
}
