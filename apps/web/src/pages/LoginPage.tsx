import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';

export function LoginPage() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    api.fetchRandomGuestName().then((res) => setGuestName(res.displayName)).catch(() => {});
  }, []);

  if (token) {
    navigate('/');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = isRegister
        ? await api.register(username, password, displayName || undefined)
        : await api.login(username, password);
      login(res.token, res.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleRandomGuestName() {
    try {
      const res = await api.fetchRandomGuestName();
      setGuestName(res.displayName);
    } catch {
      setError('无法生成随机名称');
    }
  }

  async function handleGuestLogin() {
    setError('');
    setGuestLoading(true);
    try {
      const res = await api.guestLogin(guestName.trim() || undefined);
      login(res.token, res.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '访客登录失败');
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
    >
      <div style={{ width: 'min(400px, 100%)', display: 'grid', gap: '1rem' }}>
        <form className="card" onSubmit={handleSubmit}>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
            {isRegister ? '注册账号' : '登录'}
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem' }}>
            进入聚会游戏大厅，与好友一起玩
          </p>

          {error && (
            <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <input
              className="input"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            {isRegister && (
              <input
                className="input"
                placeholder="显示名称（可选）"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            )}
            <input
              className="input"
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="btn" type="submit" disabled={loading}>
              {loading ? '处理中…' : isRegister ? '注册' : '登录'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>
        </form>

        <div className="card">
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>访客进入</h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
            无需注册，设置昵称即可快速加入游戏
          </p>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input"
                placeholder="显示名称"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={64}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRandomGuestName}
                title="随机生成名称"
              >
                🎲
              </button>
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleGuestLogin}
              disabled={guestLoading}
            >
              {guestLoading ? '进入中…' : '以访客身份进入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
