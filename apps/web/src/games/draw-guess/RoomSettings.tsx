import { useEffect, useState } from 'react';
import type { RoomSettingsProps } from '../registry';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';

const DEFAULT_CATEGORY_IDS = ['animal', 'daily', 'movie', 'sport'];

export function DrawGuessRoomSettings({
  isHost,
  isPlaying,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const { token } = useAuth();
  const [categories, setCategories] = useState<api.WordPackCategory[]>([]);
  const [userPacks, setUserPacks] = useState<api.UserWordPack[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>(() => [...DEFAULT_CATEGORY_IDS]);
  const [userPackIds, setUserPackIds] = useState<string[]>([]);
  const [roomExtraWords, setRoomExtraWords] = useState('');

  useEffect(() => {
    onStartOptionsChange({ categoryIds, userPackIds, roomExtraWords });
  }, [categoryIds, userPackIds, roomExtraWords, onStartOptionsChange]);

  useEffect(() => {
    if (!token) return;
    api.fetchWordPackCategories(token).then(setCategories).catch(() => {});
    api.fetchMyWordPacks(token).then(setUserPacks).catch(() => {});
  }, [token]);

  if (!isHost || isPlaying) return null;

  const toggleCategory = (id: string) => {
    setCategoryIds(
      categoryIds.includes(id) ? categoryIds.filter((c) => c !== id) : [...categoryIds, id],
    );
  };

  const toggleUserPack = (id: string) => {
    setUserPackIds(
      userPackIds.includes(id) ? userPackIds.filter((c) => c !== id) : [...userPackIds, id],
    );
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div>
        <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>官方分类</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {categories.map((c) => (
            <label
              key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}
            >
              <input
                type="checkbox"
                checked={categoryIds.includes(c.id)}
                onChange={() => toggleCategory(c.id)}
              />
              {c.name}（{c.wordCount}）
            </label>
          ))}
        </div>
      </div>

      {userPacks.length > 0 && (
        <div>
          <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>个人词库</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {userPacks.map((p) => (
              <label
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}
              >
                <input
                  type="checkbox"
                  checked={userPackIds.includes(p.id)}
                  onChange={() => toggleUserPack(p.id)}
                />
                {p.name}（{p.words.length}）
              </label>
            ))}
          </div>
        </div>
      )}

      <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
        本局专用词（逗号或换行分隔）
        <textarea
          className="input"
          rows={2}
          value={roomExtraWords}
          onChange={(e) => setRoomExtraWords(e.target.value)}
          placeholder="例如：公司团建, 周末烧烤"
        />
      </label>
    </div>
  );
}
