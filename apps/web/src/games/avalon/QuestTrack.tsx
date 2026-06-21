import type { QuestResult } from '@game-lobby/game-engine';

interface QuestTrackProps {
  quest: number;
  successCount: number;
  failCount: number;
  questHistory: QuestResult[];
  teamSize: number;
}

export function QuestTrack({
  quest,
  successCount,
  failCount,
  questHistory,
  teamSize,
}: QuestTrackProps) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>任务进度</h3>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        成功 {successCount} / 3 · 失败 {failCount} / 3 · 当前第 {quest} 轮（需 {teamSize} 人）
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5].map((q) => {
          const result = questHistory.find((r) => r.quest === q);
          let label = `Q${q}`;
          if (result) {
            label += result.success ? ' ✓' : ' ✗';
          } else if (q === quest) {
            label += ' …';
          }
          return (
            <span
              key={q}
              className="btn"
              style={{
                opacity: q === quest && !result ? 1 : 0.7,
                background: result
                  ? result.success
                    ? 'var(--success, #2d6a4f)'
                    : 'var(--danger, #9b2226)'
                  : undefined,
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
