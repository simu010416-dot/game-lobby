import { useEffect, useState } from 'react';
import type { HeartAttackGameState } from '@game-lobby/game-engine';
import type { RoomSettingsProps } from '../registry';

export function HeartAttackRoomSettings({
  isHost,
  isPlaying,
  isIntermission,
  gameState,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [useSpecialCards, setUseSpecialCards] = useState(false);

  useEffect(() => {
    onStartOptionsChange({ useSpecialCards });
  }, [useSpecialCards, onStartOptionsChange]);

  useEffect(() => {
    if (!isIntermission || !gameState) return;
    const s = gameState as HeartAttackGameState;
    setUseSpecialCards(s.useSpecialCards);
  }, [gameState, isIntermission]);

  if (!isHost && !(isPlaying && gameState)) return null;

  if (!isHost && isPlaying && gameState) {
    const s = gameState as HeartAttackGameState;
    return (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        本局特殊牌：{s.useSpecialCards ? '开启' : '关闭'}
      </p>
    );
  }

  return (
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
        checked={useSpecialCards}
        disabled={isPlaying}
        onChange={(e) => setUseSpecialCards(e.target.checked)}
      />
      启用特殊牌（万能水果、双倍、炸弹）
    </label>
  );
}
