import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api } from "../lib/api";

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

const SESSION_KEY = "tax_platform_session";

export function useAuth() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<AuthSession>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored) as AuthUser;
        setSession({ user, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setSession({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      setSession({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const user = await api.post<AuthUser>("/auth/login", { email, password });
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setSession({ user, isAuthenticated: true, isLoading: false });
    setLocation("/dashboard");
  };

  const signup = async (
    email: string,
    password: string,
    fullName: string,
    role: string,
    companyId?: string
  ): Promise<void> => {
    const user = await api.post<AuthUser>("/auth/signup", {
      email,
      password,
      fullName,
      role,
      companyId,
    });
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setSession({ user, isAuthenticated: true, isLoading: false });
    setLocation("/dashboard");
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      // ignore errors on logout
    }
    localStorage.removeItem(SESSION_KEY);
    setSession({ user: null, isAuthenticated: false, isLoading: false });
    setLocation("/login");
  };

  return { ...session, login, signup, logout };
}
