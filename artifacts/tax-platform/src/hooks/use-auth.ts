import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api, AUTH_EXPIRED_EVENT, SESSION_KEY } from "../lib/api";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string | null;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

function readStoredSession(): AuthResponse | null {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<AuthResponse>;
    if (parsed.user?.id && parsed.accessToken) {
      return parsed as AuthResponse;
    }
  } catch {
    // fall through to cleanup
  }

  localStorage.removeItem(SESSION_KEY);
  return null;
}

export function useAuth() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<AuthSession>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession({ user: null, isAuthenticated: false, isLoading: false });
  };

  useEffect(() => {
    let cancelled = false;

    const expireSession = () => {
      if (cancelled) return;
      clearSession();
      setLocation("/login");
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, expireSession);

    const stored = readStoredSession();
    if (stored) {
      api.get<AuthUser>("/auth/me")
        .then(user => {
          if (cancelled) return;
          const refreshed = { ...stored, user };
          localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
          setSession({ user, isAuthenticated: true, isLoading: false });
        })
        .catch(() => {
          if (!cancelled) expireSession();
        });
    } else {
      setSession({ user: null, isAuthenticated: false, isLoading: false });
    }

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, expireSession);
    };
  }, [setLocation]);

  const login = async (email: string, password: string): Promise<void> => {
    const auth = await api.post<AuthResponse>("/auth/login", { email, password });
    localStorage.setItem(SESSION_KEY, JSON.stringify(auth));
    setSession({ user: auth.user, isAuthenticated: true, isLoading: false });
    setLocation("/dashboard");
  };

  const signup = async (
    email: string,
    password: string,
    fullName: string,
    role: string,
    companyId?: string
  ): Promise<void> => {
    const auth = await api.post<AuthResponse>("/auth/signup", {
      email,
      password,
      fullName,
      role,
      companyId,
    });
    localStorage.setItem(SESSION_KEY, JSON.stringify(auth));
    setSession({ user: auth.user, isAuthenticated: true, isLoading: false });
    setLocation("/dashboard");
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      // ignore errors on logout
    }
    localStorage.removeItem(SESSION_KEY);
    clearSession();
    setLocation("/login");
  };

  return { ...session, login, signup, logout };
}

