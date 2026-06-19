import { useEffect, useState } from 'react';
import type { RoomSettingsProps } from '../registry';
import {
  ROLE_LABELS,
  ROLE_PRESET_ROLES,
  type RolePresetId,
  type WerewolfRole,
} from '@game-lobby/game-engine';

const PRESET_LABELS: Record<Exclude<RolePresetId, 'custom'>, string> = {
  simple_6: '6 人简化（2狼+预+猎+2民）',
  standard_9: '9 人标准（3狼+预+女+猎+2民）',
  classic_12: '12 人经典（4狼+预+女+猎+守+痴+2民）',
};

const ALL_ROLES: WerewolfRole[] = [
  'werewolf',
  'villager',
  'seer',
  'witch',
  'hunter',
  'guard',
  'idiot',
];

function defaultCustomRoles(): WerewolfRole[] {
  return [...ROLE_PRESET_ROLES.simple_6];
}

export function WerewolfRoomSettings({
  isHost,
  isPlaying,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [rolePreset, setRolePreset] = useState<RolePresetId>('simple_6');
  const [customRoles, setCustomRoles] = useState<WerewolfRole[]>(() => defaultCustomRoles());
  const [discussionMode, setDiscussionMode] = useState<'free' | 'sequential'>('sequential');

  useEffect(() => {
    onStartOptionsChange({
      rolePreset,
      customRoles,
      discussionMode,
    });
  }, [rolePreset, customRoles, discussionMode, onStartOptionsChange]);

  const disabled = !isHost || isPlaying;

  function toggleRole(role: WerewolfRole) {
    if (customRoles.includes(role)) {
      setCustomRoles(customRoles.filter((r) => r !== role));
    } else {
      setCustomRoles([...customRoles, role]);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>角色板预设</span>
        <select
          className="input"
          value={rolePreset}
          disabled={disabled}
          onChange={(e) => setRolePreset(e.target.value as RolePresetId)}
        >
          {(Object.keys(PRESET_LABELS) as Exclude<RolePresetId, 'custom'>[]).map((id) => (
            <option key={id} value={id}>
              {PRESET_LABELS[id]}
            </option>
          ))}
          <option value="custom">自定义</option>
        </select>
      </label>

      {rolePreset === 'custom' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
            勾选角色（数量须与玩家人数一致）
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {ALL_ROLES.map((role) => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="checkbox"
                  checked={customRoles.includes(role)}
                  disabled={disabled}
                  onChange={() => toggleRole(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            已选 {customRoles.length} 个角色
          </p>
        </div>
      )}

      {rolePreset !== 'custom' && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          {PRESET_LABELS[rolePreset as Exclude<RolePresetId, 'custom'>]}
        </p>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="radio"
          name="ww-discuss"
          checked={discussionMode === 'sequential'}
          disabled={disabled}
          onChange={() => setDiscussionMode('sequential')}
        />
        顺序发言
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="radio"
          name="ww-discuss"
          checked={discussionMode === 'free'}
          disabled={disabled}
          onChange={() => setDiscussionMode('free')}
        />
        自由讨论
      </label>
    </div>
  );
}
