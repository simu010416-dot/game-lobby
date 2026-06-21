import { useState } from 'react';
import { AVALON_ROLE_LABELS, type AvalonViewerInfo } from '@game-lobby/game-engine';

interface RoleBriefingProps {
  viewerInfo?: AvalonViewerInfo;
}

export function RoleBriefing({ viewerInfo }: RoleBriefingProps) {
  const [expanded, setExpanded] = useState(true);
  if (!viewerInfo?.myRole) return null;

  const role = viewerInfo.myRole;

  return (
    <div className="card ww-role-card">
      <button type="button" className="ww-role-card-toggle" onClick={() => setExpanded((v) => !v)}>
        <span className="ww-role-card-label">你的身份</span>
        <span className="ww-role-card-name">{AVALON_ROLE_LABELS[role]}</span>
        <span className="ww-role-card-hint">{expanded ? '收起' : '展开情报'}</span>
      </button>
      {expanded && (
        <div className="ww-role-card-body">
          {viewerInfo.evilTeammates && viewerInfo.evilTeammates.length > 0 && (
            <p className="ww-wolf-team">
              邪恶队友：{viewerInfo.evilTeammates.map((p) => p.name).join('、')}
            </p>
          )}
          {viewerInfo.merlinSeesEvil && viewerInfo.merlinSeesEvil.length > 0 && (
            <p>你看到的邪恶：{viewerInfo.merlinSeesEvil.map((p) => p.name).join('、')}</p>
          )}
          {viewerInfo.percivalSees && viewerInfo.percivalSees.length > 0 && (
            <p>
              梅林与莫甘娜（未知谁是谁）：
              {viewerInfo.percivalSees.map((p) => p.name).join('、')}
            </p>
          )}
          {viewerInfo.ladyResults && viewerInfo.ladyResults.length > 0 && (
            <div>
              <p>湖中仙女调查结果：</p>
              <ul>
                {viewerInfo.ladyResults.map((r, i) => (
                  <li key={i}>
                    {r.targetName} — {r.isEvil ? '邪恶' : '善良'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
