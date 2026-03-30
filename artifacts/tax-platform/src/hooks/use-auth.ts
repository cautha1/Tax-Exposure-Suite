import { create } from 'zustard'; // Will use a simple local state approach instead
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Profile, ProfileRole } from '@workspace/api-client-react';

// Define session type based on schema
export interface AuthSession {
  user: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const SESSION_KEY = 'tax_platform_session';

// A lightweight mock authentication hook since login/signup endpoints aren't strictly defined
// In a real app, this would use React Query mutations for login/signup
export function useAuth() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<AuthSession>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Check local storage on mount
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored) as Profile;
        setSession({ user, isAuthenticated: true, isLoading: false });
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        setSession({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      setSession({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    // Mock login delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    // Create a mock user
    const mockUser: Profile = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      email,
      fullName: email.split('@')[0].replace('.', ' '),
      role: 'advisor' as ProfileRole,
      createdAt: new Date().toISOString(),
      companyId: null, // Admins/Advisors don't need a specific company ID
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
    setSession({ user: mockUser, isAuthenticated: true, isLoading: false });
    setLocation('/dashboard');
  };

  const signup = async (email: string, password: string, fullName: string, role: ProfileRole, companyId?: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const mockUser: Profile = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      email,
      fullName,
      role,
      companyId: companyId || null,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(mockUser));
    setSession({ user: mockUser, isAuthenticated: true, isLoading: false });
    setLocation('/dashboard');
  };

  const logout = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    localStorage.removeItem(SESSION_KEY);
    setSession({ user: null, isAuthenticated: false, isLoading: false });
    setLocation('/login');
  };

  return {
    ...session,
    login,
    signup,
    logout,
  };
}
