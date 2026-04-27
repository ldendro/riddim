import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('riddim_token'));
  const [isLoading, setIsLoading] = useState(true);

  // On mount, verify the stored token
  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchMe = useCallback(async (t) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setToken(t);
      } else {
        // Token expired or invalid
        localStorage.removeItem('riddim_token');
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem('riddim_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(() => {
    if (token) fetchMe(token);
  }, [token, fetchMe]);

  const register = async (email, password, displayName) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Registration failed');
    }

    const data = await res.json();
    localStorage.setItem('riddim_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }

    const data = await res.json();
    localStorage.setItem('riddim_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('riddim_token');
    setToken(null);
    setUser(null);
  }, []);

  const resetProfile = async () => {
    const res = await fetch(`${API_BASE}/api/auth/reset-profile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setUser(prev => ({ ...prev, onboarding_complete: false }));
    }
    return res.ok;
  };

  const completeOnboarding = useCallback(() => {
    setUser(prev => prev ? { ...prev, onboarding_complete: true } : prev);
  }, []);

  const isAuthenticated = !!token && !!user;
  const isOnboarded = user?.onboarding_complete === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isOnboarded,
        register,
        login,
        logout,
        resetProfile,
        completeOnboarding,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
