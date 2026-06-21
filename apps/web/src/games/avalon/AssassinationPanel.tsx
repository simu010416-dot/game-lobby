import { useState } from 'react';
import type { AvalonPlayerState } from '@game-lobby/game-engine';
import { AvalonTable } from './AvalonTable';

interface AssassinationPanelProps {
  players: AvalonPlayerState[];
  myMemberId: string | null;
  leaderId: string;
  isAssassin: boolean;
  onAssassinate: (targetId: string) => void;
}

export function AssassinationPanel({
  players,
  myMemberId,
  leaderId,
  isAssassin,
  onAssassinate,
}: AssassinationPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!isAssassin) {
    return (
      <div className="card">
        <p>好人完成 3 次任务！等待刺客猜测梅林…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>刺杀梅林</h3>
      <p style={{ color: 'var(--text-muted)' }}>选择你认为是梅林的玩家</p>
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
        className="btn btn-danger"
        style={{ marginTop: '1rem' }}
        disabled={!selected}
        onClick={() => selected && onAssassinate(selected)}
      >
        刺杀
      </button>
    </div>
  );
}
