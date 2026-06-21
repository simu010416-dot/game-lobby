import type { AvalonPlayerState } from '@game-lobby/game-engine';
import { AvalonTable } from './AvalonTable';

interface TeamVotePanelProps {
  players: AvalonPlayerState[];
  myMemberId: string | null;
  leaderId: string;
  proposedTeam: string[];
  teamVotes: Record<string, boolean>;
  hasVoted: boolean;
  onVote: (approve: boolean) => void;
}

export function TeamVotePanel({
  players,
  myMemberId,
  leaderId,
  proposedTeam,
  teamVotes,
  hasVoted,
  onVote,
}: TeamVotePanelProps) {
  const teamNames = proposedTeam
    .map((id) => players.find((p) => p.id === id)?.name ?? '?')
    .join('、');

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>队伍投票</h3>
      <p>本轮队伍：{teamNames}</p>
      <AvalonTable
        players={players}
        myMemberId={myMemberId}
        leaderId={leaderId}
        selectable={false}
        selectedIds={proposedTeam}
        highlightedIds={proposedTeam}
      />
      {!hasVoted ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="button" className="btn" onClick={() => onVote(true)}>
            赞成
          </button>
          <button type="button" className="btn btn-danger" onClick={() => onVote(false)}>
            反对
          </button>
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>已投票，等待其他玩家…</p>
      )}
      {Object.keys(teamVotes).length > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          {players.map((p) =>
            teamVotes[p.id] !== undefined ? (
              <div key={p.id}>
                {p.name}: {teamVotes[p.id] ? '赞成' : '反对'}
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
