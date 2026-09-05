'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  persistSession,
  destroySession,
} from './api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
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
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { token: newToken, refreshToken, user: userData } = await apiLogin(email, password);
    persistSession(newToken, refreshToken, userData);
    setToken(newToken);
    setUser(userData);
  };

  const register = async (data: any) => {
    const { token: newToken, refreshToken, user: userData } = await apiRegister(data);
    persistSession(newToken, refreshToken, userData);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    const refreshToken =
      typeof window !== 'undefined' ? window.localStorage.getItem('refreshToken') : null;
    setUser(null);
    setToken(null);
    if (refreshToken) {
      apiLogout(refreshToken);
    } else {
      destroySession(false);
    }
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
        isAdmin: user?.role === 'admin' || user?.role === 'organizer' || user?.role === 'cashier' || user?.role === 'bar' || user?.role === 'kitchen' || user?.role === 'treasurer' || user?.role === 'superadmin',
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
