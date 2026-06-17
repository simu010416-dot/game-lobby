import { useState } from 'react';
import type { UndercoverGameState } from '@game-lobby/game-engine';

interface Props {
  state: UndercoverGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onDescribe: (text: string) => void;
  onVote: (targetId: string) => void;
}

export function UndercoverGame({ state, myMemberId, isSpectator, onDescribe, onVote }: Props) {
  const me = state.players.find((p) => p.id === myMemberId);
  const alive = state.players.filter((p) => p.isAlive);
  const currentSpeaker = alive[state.currentSpeakerIndex];
  const isMyTurn = currentSpeaker?.id === myMemberId && state.phase === 'describe';
  const [desc, setDesc] = useState('');

  return (
    <div className="card">
      <h2>谁是卧底 · 第 {state.round} 轮</h2>
      <p style={{ color: 'var(--text-muted)' }}>{state.message}</p>

      {me && !isSpectator && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'var(--surface-2)',
            borderRadius: 8,
          }}
        >
          <strong>你的词语：</strong>
          {me.isWhiteBoard ? '（白板 - 你没有词语）' : (me.word ?? '???')}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
        {state.players.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem',
              opacity: p.isAlive ? 1 : 0.4,
              background: 'var(--surface-2)',
              borderRadius: 8,
            }}
          >
            <span>
              {p.name} {p.isBot && '🤖'}
              {!p.isAlive && '（已淘汰）'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {p.description ?? '-'}
            </span>
          </div>
        ))}
      </div>

      {state.phase === 'describe' && isMyTurn && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="描述你的词语（不要直接说出词语）"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <button
            className="btn"
            onClick={() => {
              if (desc.trim()) {
                onDescribe(desc.trim());
                setDesc('');
              }
            }}
          >
            提交描述
          </button>
        </div>
      )}

      {state.phase === 'vote' && me?.isAlive && !isSpectator && myMemberId && !state.votes[myMemberId] && (
        <div>
          <p>请选择投票对象：</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {alive
              .filter((p) => p.id !== myMemberId)
              .map((p) => (
                <button key={p.id} className="btn btn-secondary" onClick={() => onVote(p.id)}>
                  投 {p.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {state.phase === 'ended' && (
        <div style={{ color: 'var(--success)', fontWeight: 600 }}>{state.message}</div>
      )}
    </div>
  );
}
