'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  persistSession,
  destroySession,
  ensureFreshToken,
  hydrateSession,
  getAccessToken,
} from './api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  accessCode?: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (data: any) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperadmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await hydrateSession();
      if (cancelled) return;
      if (session) {
        setUser(session as User);
        setToken(getAccessToken());
      } else {
        destroySession(false);
      }
    })();

    const refreshInterval = setInterval(() => {
      ensureFreshToken();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const { token: newToken, user: userData } = await apiLogin(email, password);
    persistSession(newToken, userData);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (data: any): Promise<User> => {
    const { token: newToken, user: userData } = await apiRegister(data);
    persistSession(newToken, userData);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    apiLogout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === 'superadmin' || user?.role === 'organizer',
        isSuperadmin: user?.role === 'superadmin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}