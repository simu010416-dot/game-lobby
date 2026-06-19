import { useEffect, useState } from 'react';
import type { DaVinciGameState } from '@game-lobby/game-engine';
import type { RoomSettingsProps } from '../registry';

export function DaVinciRoomSettings({
  isHost,
  isPlaying,
  isIntermission,
  gameState,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [useJoker, setUseJoker] = useState(false);
  const [assistMode, setAssistMode] = useState(true);

  useEffect(() => {
    onStartOptionsChange({ useJoker, assistMode });
  }, [useJoker, assistMode, onStartOptionsChange]);

  useEffect(() => {
    if (!isIntermission || !gameState) return;
    const s = gameState as DaVinciGameState;
    setUseJoker(s.useJoker);
    setAssistMode(s.assistMode ?? true);
  }, [gameState, isIntermission]);

  if (!isHost && !(isPlaying && gameState)) return null;

  if (!isHost && isPlaying && gameState) {
    const s = gameState as DaVinciGameState;
    return (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        本局辅助模式：{s.assistMode !== false ? '开启' : '关闭'}
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
        }}
      >
        <input type="checkbox" checked={useJoker} onChange={(e) => setUseJoker(e.target.checked)} />
        使用 Joker 牌（[-] 万能牌，可插入任意位置）
      </label>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          opacity: isPlaying ? 0.6 : 1,
        }}
        title={isPlaying ? '本局进行中不可修改' : undefined}
      >
        <input
          type="checkbox"
          checked={assistMode}
          disabled={isPlaying}
          onChange={(e) => setAssistMode(e.target.checked)}
        />
        辅助模式（全员共享；高亮仍可猜测的数字，关闭后可猜任意数字）
      </label>
    </div>
  );
}
