import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { disconnectSocket, getSocket } from '../lib/socket';

export function Layout() {
  const { user, token, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    if (!user) return;
    setEditName(user.displayName);
    setEditing(true);
  }

  async function saveDisplayName() {
    if (!token || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await api.updateProfile(token, editName.trim());
      updateUser(res.token, res.user);
      getSocket(res.token);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(26, 35, 50, 0.9)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 0',
          }}
        >
          <Link to="/" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>
            🎮 Game Lobby
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {editing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={64}
                  style={{ width: '140px', padding: '0.35rem 0.5rem', fontSize: '0.9rem' }}
                  autoFocus
                />
                <button
                  className="btn"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                  onClick={saveDisplayName}
                  disabled={saving || !editName.trim()}
                >
                  保存
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                  onClick={() => setEditing(false)}
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                title="点击修改显示名称"
              >
                {user?.isGuest && <span style={{ marginRight: '0.25rem' }}>👤</span>}
                {user?.displayName}
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => {
                disconnectSocket();
                logout();
                navigate('/login');
              }}
            >
              退出
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
