import type { ChineseChessGameState } from '@game-lobby/game-engine';

interface Props {
  state: ChineseChessGameState;
  replayIndex: number | null;
  onSelectMove: (index: number | null) => void;
}

export function MoveList({ state, replayIndex, onSelectMove }: Props) {
  const pairs: { red?: string; black?: string; redIdx: number; blackIdx: number }[] = [];
  for (let i = 0; i < state.moves.length; i++) {
    const m = state.moves[i]!;
    const moveNum = Math.floor(i / 2) + 1;
    if (i % 2 === 0) {
      pairs[moveNum - 1] = { red: m.iccs, redIdx: i, blackIdx: -1 };
    } else if (pairs[moveNum - 1]) {
      pairs[moveNum - 1]!.black = m.iccs;
      pairs[moveNum - 1]!.blackIdx = i;
    }
  }

  return (
    <div
      style={{
        maxHeight: 220,
        overflowY: 'auto',
        fontSize: '0.85rem',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        padding: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>棋谱</strong>
        {replayIndex != null && (
          <button type="button" className="btn" style={{ fontSize: '0.75rem', padding: '2px 8px' }} onClick={() => onSelectMove(null)}>
            返回当前
          </button>
        )}
      </div>
      {pairs.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>暂无走子</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th style={{ textAlign: 'left', padding: '2px 4px' }}>#</th>
              <th style={{ textAlign: 'left', padding: '2px 4px' }}>红</th>
              <th style={{ textAlign: 'left', padding: '2px 4px' }}>黑</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, idx) => (
              <tr key={idx}>
                <td style={{ padding: '2px 4px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                <td style={{ padding: '2px 4px' }}>
                  {pair.red && (
                    <button
                      type="button"
                      style={{
                        background: replayIndex === pair.redIdx + 1 ? 'rgba(59,130,246,0.3)' : 'transparent',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: '1px 4px',
                        borderRadius: 4,
                      }}
                      onClick={() => onSelectMove(pair.redIdx + 1)}
                    >
                      {pair.red}
                    </button>
                  )}
                </td>
                <td style={{ padding: '2px 4px' }}>
                  {pair.black && (
                    <button
                      type="button"
                      style={{
                        background: replayIndex === pair.blackIdx + 1 ? 'rgba(59,130,246,0.3)' : 'transparent',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: '1px 4px',
                        borderRadius: 4,
                      }}
                      onClick={() => onSelectMove(pair.blackIdx + 1)}
                    >
                      {pair.black}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
