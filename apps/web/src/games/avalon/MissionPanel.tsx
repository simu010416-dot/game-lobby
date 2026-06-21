interface MissionPanelProps {
  isOnTeam: boolean;
  hasVoted: boolean;
  isGood: boolean;
  onPlay: (success: boolean) => void;
}

export function MissionPanel({ isOnTeam, hasVoted, isGood, onPlay }: MissionPanelProps) {
  if (!isOnTeam) {
    return (
      <div className="card">
        <p>等待任务队员秘密出牌…</p>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="card">
        <p>已出牌，等待其他队员…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>任务出牌</h3>
      <p style={{ color: 'var(--text-muted)' }}>请选择成功或失败牌（仅你可见）</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="btn" onClick={() => onPlay(true)}>
          成功
        </button>
        {!isGood && (
          <button type="button" className="btn btn-danger" onClick={() => onPlay(false)}>
            失败
          </button>
        )}
      </div>
    </div>
  );
}
