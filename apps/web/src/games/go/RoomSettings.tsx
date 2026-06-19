import { useEffect, useState } from 'react';
import type { GoBoardSize, GoGameState } from '@game-lobby/game-engine';
import type { RoomSettingsProps } from '../registry';

export function GoRoomSettings({
  isHost,
  isPlaying,
  isIntermission,
  gameState,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [boardSize, setBoardSize] = useState<GoBoardSize>(19);
  const [handicap, setHandicap] = useState(0);
  const [mainTimeSec, setMainTimeSec] = useState(600);
  const [byoyomiSec, setByoyomiSec] = useState(30);
  const [byoyomiPeriods, setByoyomiPeriods] = useState(3);

  useEffect(() => {
    onStartOptionsChange({ boardSize, handicap, mainTimeSec, byoyomiSec, byoyomiPeriods });
  }, [boardSize, handicap, mainTimeSec, byoyomiSec, byoyomiPeriods, onStartOptionsChange]);

  useEffect(() => {
    if (!isIntermission || !gameState) return;
    const s = gameState as GoGameState;
    setBoardSize(s.boardSize);
    setHandicap(s.handicap);
    setMainTimeSec(Math.round(s.timeSettings.mainTimeMs / 1000));
    setByoyomiSec(Math.round(s.timeSettings.byoyomiMs / 1000));
    setByoyomiPeriods(s.timeSettings.byoyomiPeriods);
  }, [gameState, isIntermission]);

  if (!isHost && !(isPlaying && gameState)) return null;

  if (!isHost && isPlaying && gameState) {
    const s = gameState as GoGameState;
    return (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        本局：{s.boardSize}×{s.boardSize}
        {s.handicap > 0 ? ` · 让 ${s.handicap} 子` : ''} · 贴目 {s.komi}
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem' }}>
        棋盘大小
        <select
          className="input"
          value={boardSize}
          disabled={isPlaying}
          onChange={(e) => setBoardSize(Number(e.target.value) as GoBoardSize)}
        >
          <option value={9}>9×9</option>
          <option value={13}>13×13</option>
          <option value={19}>19×19</option>
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem' }}>
        让子数（0–9）
        <input
          className="input"
          type="number"
          min={0}
          max={9}
          value={handicap}
          disabled={isPlaying}
          onChange={(e) => setHandicap(Number(e.target.value))}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem' }}>
        主时间（秒）
        <input
          className="input"
          type="number"
          min={60}
          max={3600}
          step={60}
          value={mainTimeSec}
          disabled={isPlaying}
          onChange={(e) => setMainTimeSec(Number(e.target.value))}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem' }}>
        读秒（秒/次）
        <input
          className="input"
          type="number"
          min={5}
          max={120}
          value={byoyomiSec}
          disabled={isPlaying}
          onChange={(e) => setByoyomiSec(Number(e.target.value))}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem' }}>
        读秒次数
        <input
          className="input"
          type="number"
          min={0}
          max={10}
          value={byoyomiPeriods}
          disabled={isPlaying}
          onChange={(e) => setByoyomiPeriods(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
