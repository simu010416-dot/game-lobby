import { useEffect, useState } from 'react';
import type { RoomSettingsProps } from '../registry';

export function AvalonRoomSettings({
  isHost,
  isPlaying,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [useLadyOfLake, setUseLadyOfLake] = useState(true);

  useEffect(() => {
    onStartOptionsChange({ useLadyOfLake });
  }, [useLadyOfLake, onStartOptionsChange]);

  const disabled = !isHost || isPlaying;

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
        角色板按玩家人数自动匹配标准阿瓦隆配置（5–10 人）。
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={useLadyOfLake}
          disabled={disabled}
          onChange={(e) => setUseLadyOfLake(e.target.checked)}
        />
        启用湖中仙女（第 2、3、4 轮任务后调查阵营）
      </label>
    </div>
  );
}
