import { useState } from 'react';
import type { AvalonPlayerState } from '@game-lobby/game-engine';
import { AvalonTable } from './AvalonTable';

interface TeamProposePanelProps {
  players: AvalonPlayerState[];
  myMemberId: string | null;
  leaderId: string;
  requiredSize: number;
  onPropose: (memberIds: string[]) => void;
}

export function TeamProposePanel({
  players,
  myMemberId,
  leaderId,
  requiredSize,
  onPropose,
}: TeamProposePanelProps) {
  const isLeader = myMemberId === leaderId;
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= requiredSize) return prev;
      return [...prev, id];
    });
  }

  if (!isLeader) {
    return (
      <div className="card">
        <p>等待队长提议 {requiredSize} 人任务队伍…</p>
        <AvalonTable
          players={players}
          myMemberId={myMemberId}
          leaderId={leaderId}
          selectable={false}
          selectedIds={[]}
        />
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>提议任务队伍</h3>
      <p style={{ color: 'var(--text-muted)' }}>
        请选择 {requiredSize} 名玩家（已选 {selected.length}）
      </p>
      <AvalonTable
        players={players}
        myMemberId={myMemberId}
        leaderId={leaderId}
        selectable
        selectedIds={selected}
        onToggleSelect={toggle}
      />
      <button
        type="button"
        className="btn"
        style={{ marginTop: '1rem' }}
        disabled={selected.length !== requiredSize}
        onClick={() => onPropose(selected)}
      >
        提交队伍
      </button>
    </div>
  );
}
