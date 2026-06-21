import type { CSSProperties } from 'react';
import type { AvalonPlayerState } from '@game-lobby/game-engine';

interface AvalonTableProps {
  players: AvalonPlayerState[];
  myMemberId: string | null;
  leaderId: string;
  selectable: boolean;
  selectedIds: string[];
  highlightedIds?: string[];
  onToggleSelect?: (playerId: string) => void;
}

function seatStyle(index: number, total: number, viewerSeat: number): CSSProperties {
  const adjusted = (index - viewerSeat + total) % total;
  const angle = (adjusted / total) * 2 * Math.PI + Math.PI / 2;
  const rx = 42;
  const ry = 36;
  const x = 50 + rx * Math.cos(angle);
  const y = 50 + ry * Math.sin(angle);
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)',
  };
}

export function AvalonTable({
  players,
  myMemberId,
  leaderId,
  selectable,
  selectedIds,
  highlightedIds = [],
  onToggleSelect,
}: AvalonTableProps) {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const me = players.find((p) => p.id === myMemberId);
  const viewerSeat = me?.seatIndex ?? 0;

  return (
    <div className="ww-table-wrap">
      <div className="ww-table-surface">
        <div className="ww-table-center" aria-hidden>
          ⚔️
        </div>
        {sorted.map((p) => {
          const isMe = p.id === myMemberId;
          const isLeader = p.id === leaderId;
          const isSelected = selectedIds.includes(p.id);
          const isHighlighted = highlightedIds.includes(p.id);
          const canSelect = selectable && onToggleSelect;

          return (
            <button
              key={p.id}
              type="button"
              className={[
                'ww-seat',
                isMe && 'ww-seat-me',
                isLeader && 'ww-seat-speaking',
                isSelected && 'ww-seat-selected',
                isHighlighted && 'ww-seat-selectable',
                canSelect && 'ww-seat-selectable',
              ]
                .filter(Boolean)
                .join(' ')}
              style={seatStyle(p.seatIndex, sorted.length, viewerSeat)}
              disabled={!canSelect}
              onClick={() => canSelect && onToggleSelect(p.id)}
            >
              <span className="ww-seat-avatar">{p.isBot ? '🤖' : '👤'}</span>
              <span className="ww-seat-name">{p.name}</span>
              <span className="ww-seat-number">{p.seatIndex + 1}</span>
              {isLeader && <span className="ww-seat-votes">队长</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
