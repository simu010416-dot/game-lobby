import type { GoGameState } from './logic.js';

export function deductTime(state: GoGameState, now: number): GoGameState {
  if (state.phase !== 'playing') return state;

  const elapsed = Math.max(0, now - state.turnStartedAt);
  if (elapsed === 0) return state;

  const color = state.currentColor;
  const player = state.players.find((p) => p.color === color);
  if (!player) return state;

  let mainTimeMs = player.mainTimeMs;
  let byoyomiRemainingMs = player.byoyomiRemainingMs;
  let byoyomiPeriodsLeft = player.byoyomiPeriodsLeft;

  if (mainTimeMs > 0) {
    mainTimeMs = Math.max(0, mainTimeMs - elapsed);
    if (mainTimeMs === 0 && byoyomiPeriodsLeft > 0) {
      byoyomiRemainingMs = state.timeSettings.byoyomiMs;
    }
  } else if (byoyomiPeriodsLeft > 0) {
    byoyomiRemainingMs = Math.max(0, byoyomiRemainingMs - elapsed);
    if (byoyomiRemainingMs === 0) {
      byoyomiPeriodsLeft -= 1;
      if (byoyomiPeriodsLeft > 0) {
        byoyomiRemainingMs = state.timeSettings.byoyomiMs;
      }
    }
  }

  const players = state.players.map((p) =>
    p.color === color
      ? { ...p, mainTimeMs, byoyomiRemainingMs, byoyomiPeriodsLeft }
      : p,
  );

  return { ...state, players, turnStartedAt: now };
}

export function tickGoGame(state: GoGameState, now = Date.now()): GoGameState {
  if (state.phase !== 'playing') return state;

  const elapsed = now - state.turnStartedAt;
  if (elapsed < 1000) return state;

  const afterDeduct = deductTime(state, now);
  const color = afterDeduct.currentColor;
  const player = afterDeduct.players.find((p) => p.color === color);
  if (!player) return afterDeduct;

  const timedOut =
    player.mainTimeMs === 0 &&
    player.byoyomiPeriodsLeft === 0 &&
    (player.byoyomiRemainingMs === 0 || afterDeduct.timeSettings.byoyomiMs === 0);

  if (!timedOut) return afterDeduct;

  const winner = afterDeduct.players.find((p) => p.color !== color);
  return {
    ...afterDeduct,
    phase: 'ended',
    winnerId: winner?.id ?? null,
    message: `${player.name} 超时，${winner?.name ?? '对手'} 获胜`,
  };
}

export function resetTurnTimer(state: GoGameState, now = Date.now()): GoGameState {
  const color = state.currentColor;
  const players = state.players.map((p) =>
    p.color === color && p.mainTimeMs === 0 && p.byoyomiPeriodsLeft > 0
      ? { ...p, byoyomiRemainingMs: state.timeSettings.byoyomiMs }
      : p,
  );
  return { ...state, players, turnStartedAt: now };
}
