import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { UserProfile } from '@game-lobby/shared';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  login: (token: string, user: UserProfile) => void;
  updateUser: (token: string, user: UserProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'game-lobby-token';
const USER_KEY = 'game-lobby-user';

function loadStored(): { token: string | null; user: UserProfile | null } {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return { token: null, user: null };
  try {
    return { token, user: JSON.parse(raw) as UserProfile };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [token, setToken] = useState<string | null>(stored.token);
  const [user, setUser] = useState<UserProfile | null>(stored.user);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      login: (newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      },
      updateUser: (newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      },
      logout: () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
