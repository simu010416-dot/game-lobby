import { useEffect, useState } from 'react';
import type { ChineseChessGameState } from '@game-lobby/game-engine';
import type { RoomSettingsProps } from '../registry';

const PRESETS = [
  { label: '10+5', mainTimeSec: 600, incrementSec: 5, unlimitedTime: false },
  { label: '5+0', mainTimeSec: 300, incrementSec: 0, unlimitedTime: false },
  { label: '15+10', mainTimeSec: 900, incrementSec: 10, unlimitedTime: false },
  { label: '不限时', mainTimeSec: 600, incrementSec: 0, unlimitedTime: true },
] as const;

export function ChineseChessRoomSettings({
  isHost,
  isPlaying,
  isIntermission,
  gameState,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [presetIndex, setPresetIndex] = useState(0);
  const preset = PRESETS[presetIndex]!;

  useEffect(() => {
    onStartOptionsChange({
      mainTimeSec: preset.mainTimeSec,
      incrementSec: preset.incrementSec,
      unlimitedTime: preset.unlimitedTime,
    });
  }, [preset, onStartOptionsChange]);

  useEffect(() => {
    if (!isIntermission || !gameState) return;
    const s = gameState as ChineseChessGameState;
    if (!s.timeSettings) {
      setPresetIndex(3);
      return;
    }
    const main = Math.round(s.timeSettings.mainTimeMs / 1000);
    const inc = Math.round(s.timeSettings.incrementMs / 1000);
    const idx = PRESETS.findIndex(
      (p) => p.mainTimeSec === main && p.incrementSec === inc && !p.unlimitedTime,
    );
    if (idx >= 0) setPresetIndex(idx);
  }, [gameState, isIntermission]);

  if (!isHost && !(isPlaying && gameState)) return null;

  if (!isHost && isPlaying && gameState) {
    const s = gameState as ChineseChessGameState;
    if (!s.timeSettings) {
      return (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          本局：不限时
        </p>
      );
    }
    return (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        本局：{Math.round(s.timeSettings.mainTimeMs / 1000)} 秒 +{' '}
        {Math.round(s.timeSettings.incrementMs / 1000)} 秒/步
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem' }}>
        时控
        <select
          className="input"
          value={presetIndex}
          disabled={isPlaying}
          onChange={(e) => setPresetIndex(Number(e.target.value))}
        >
          {PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
