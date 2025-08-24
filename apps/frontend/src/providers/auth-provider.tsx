import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService } from '../services/auth-service';

// Types
interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * @component AuthProvider
 * @purpose Provides authentication context to the application
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState(() => authService.getState());

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe(setAuthState);

    // Cleanup subscription
    return unsubscribe;
  }, []);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.token) {
      return;
    }

    // Check token expiration every 5 minutes
    const interval = setInterval(async () => {
      try {
        // Decode token to check expiration
        const payload = JSON.parse(atob(authState.token!.split('.')[1]));
        const currentTime = Date.now() / 1000;
        const timeUntilExpiry = payload.exp - currentTime;

        // Refresh if token expires in less than 10 minutes
        if (timeUntilExpiry < 600) {
          await authService.refreshToken();
        }
      } catch (error) {
        console.error('Token refresh check failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [authState.isAuthenticated, authState.token]);

  const contextValue: AuthContextType = {
    user: authState.user,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    login: authService.login.bind(authService),
    loginWithGoogle: authService.loginWithGoogle.bind(authService),
    logout: authService.logout.bind(authService),
    refreshToken: authService.refreshToken.bind(authService),
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * @hook useAuth
 * @purpose Hook to access authentication context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}