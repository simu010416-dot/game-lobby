import { AVALON_ROLE_LABELS, type AvalonGameState } from '@game-lobby/game-engine';

interface GameEndScreenProps {
  state: AvalonGameState;
}

export function GameEndScreen({ state }: GameEndScreenProps) {
  const winnerLabel = state.winner === 'good' ? '好人阵营胜利' : '邪恶阵营胜利';

  return (
    <div className="card uc-ended-banner ww-end-screen">
      <h2 style={{ marginTop: 0 }}>{winnerLabel}</h2>
      {state.winReason && <p style={{ color: 'var(--text-muted)' }}>{state.winReason}</p>}
      <p style={{ color: 'var(--text-muted)' }}>全员身份揭晓</p>
      <div className="ww-end-roles">
        {state.players.map((p) => (
          <div key={p.id} className="ww-end-role-row">
            <span>{p.name}</span>
            <span>{p.role !== 'unknown' ? AVALON_ROLE_LABELS[p.role] : '?'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
