import { useEffect, useState } from 'react';
import type { DwarfMineMode, DwarfMineGameState } from '@game-lobby/game-engine';
import type { RoomSettingsProps } from '../registry';

export function DwarfMineRoomSettings({
  isHost,
  isPlaying,
  isIntermission,
  gameState,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [mode, setMode] = useState<DwarfMineMode>('base');

  useEffect(() => {
    onStartOptionsChange({ dwarfMineMode: mode });
  }, [mode, onStartOptionsChange]);

  useEffect(() => {
    if (!isIntermission || !gameState) return;
    const s = gameState as DwarfMineGameState;
    setMode(s.mode);
  }, [gameState, isIntermission]);

  if (!isHost && !(isPlaying && gameState)) return null;

  if (!isHost && isPlaying && gameState) {
    const s = gameState as DwarfMineGameState;
    return (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        本局模式：{s.mode === 'expansion' ? '扩展版（Saboteur 2）' : '基本版（Saboteur）'}
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>游戏模式</span>
        <select
          className="input"
          value={mode}
          disabled={isPlaying}
          onChange={(e) => setMode(e.target.value as DwarfMineMode)}
        >
          <option value="base">基本版（Saboteur）</option>
          <option value="expansion">扩展版（Saboteur 2）</option>
        </select>
      </label>
      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {mode === 'base'
          ? '好矮人 vs 坏矮人，铺设通道寻找金矿。'
          : '绿/蓝淘金队、Boss、Profiteer、地质学家与更多行动卡。'}
      </p>
    </div>
  );
}
