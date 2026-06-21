import { useState } from 'react';
import type { EvilChatMessage } from '@game-lobby/game-engine';

interface EvilChatPanelProps {
  messages: EvilChatMessage[];
  canChat: boolean;
  onChat: (text: string) => void;
}

export function EvilChatPanel({ messages, canChat, onChat }: EvilChatPanelProps) {
  const [text, setText] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onChat(trimmed);
    setText('');
  }

  return (
    <div className="card uc-chat-panel ww-wolf-chat">
      <h3 style={{ marginTop: 0 }}>邪恶频道</h3>
      <div className="uc-chat-feed">
        {messages.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>与邪恶队友私聊</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="uc-chat-message">
            <strong>{m.playerName}</strong>：{m.text}
          </div>
        ))}
      </div>
      {canChat && (
        <form onSubmit={handleSubmit}>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="邪恶私聊…"
            maxLength={200}
          />
          <button type="submit" className="btn" style={{ marginTop: '0.5rem' }}>
            发送
          </button>
        </form>
      )}
    </div>
  );
}
