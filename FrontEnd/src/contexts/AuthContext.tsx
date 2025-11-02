import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, User } from '@/lib/api';
import { AuthContext, AuthState, AuthContextType } from './AuthContextBase';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    role: null,
  });

  const queryClient = useQueryClient();

  const setToken = (token: string | null) => {
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  };

  const verifyUser = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        role: null,
      });
      return;
    }

    try {
      const user = await apiClient.getCurrentUser();
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        role: user.role,
      });
    } catch (err) {
      const error = err as Error;
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.message,
        role: null,
      });
      setToken(null); // Clear invalid token
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await apiClient.login(email, password);
      setToken(response.access_token);
      const user = await apiClient.getCurrentUser();
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        role: user.role,
      });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      return user;
    } catch (err) {
      const error = err as Error;
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      role: null,
    });
    queryClient.invalidateQueries({ queryKey: ['user'] }); // Clear user cache
    // Optionally clear all queries: queryClient.clear();
  };

  useEffect(() => {
    verifyUser(); // Auto-verify on mount
  }, [verifyUser]);

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    verifyUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
