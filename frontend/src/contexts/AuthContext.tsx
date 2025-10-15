import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface User {
  user_id: string;
  username: string;
  email: string;
  pinecone_namespace: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authAPI.login({ username, password });
      
      // Store token and user
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);

      toast({
        title: '✓ Login successful',
        description: `Welcome back, ${response.user.username}!`,
        className: 'border-terminal-green',
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Login failed';
      toast({
        title: '✗ Login failed',
        description: errorMessage,
        variant: 'destructive',
        className: 'border-terminal-red',
      });
      throw error;
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    try {
      const response = await authAPI.signup({ username, email, password });
      
      // Store token and user
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);

      toast({
        title: '✓ Account created',
        description: `Welcome to IntelliBase, ${response.user.username}!`,
        className: 'border-terminal-green',
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Signup failed';
      toast({
        title: '✗ Signup failed',
        description: errorMessage,
        variant: 'destructive',
        className: 'border-terminal-red',
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      setUser(null);

      toast({
        title: '✓ Logged out',
        description: 'See you next time!',
        className: 'border-terminal-yellow',
      });
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authAPI.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
