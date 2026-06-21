import { useState } from 'react';
import type { AvalonPlayerState } from '@game-lobby/game-engine';
import { AvalonTable } from './AvalonTable';

interface LadyOfLakePanelProps {
  players: AvalonPlayerState[];
  myMemberId: string | null;
  leaderId: string;
  holderId: string;
  usedOn: string[];
  onPick: (targetId: string) => void;
}

export function LadyOfLakePanel({
  players,
  myMemberId,
  leaderId,
  holderId,
  usedOn,
  onPick,
}: LadyOfLakePanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const isHolder = myMemberId === holderId;
  const holderName = players.find((p) => p.id === holderId)?.name ?? '?';

  if (!isHolder) {
    return (
      <div className="card">
        <p>等待 {holderName} 使用湖中仙女…</p>
      </div>
    );
  }

  const candidates = players.filter((p) => p.id !== holderId && !usedOn.includes(p.id));

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>湖中仙女</h3>
      <p style={{ color: 'var(--text-muted)' }}>选择一名玩家调查其阵营（仅你可见结果）</p>
      <AvalonTable
        players={players}
        myMemberId={myMemberId}
        leaderId={leaderId}
        selectable
        selectedIds={selected ? [selected] : []}
        onToggleSelect={(id) => setSelected(id === selected ? null : id)}
      />
      <button
        type="button"
        className="btn"
        style={{ marginTop: '1rem' }}
        disabled={!selected || !candidates.some((p) => p.id === selected)}
        onClick={() => selected && onPick(selected)}
      >
        调查
      </button>
    </div>
  );
}
