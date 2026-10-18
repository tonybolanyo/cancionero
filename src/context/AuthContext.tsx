import React, { createContext, useContext, useState, useEffect } from 'react';
import { GitHubUser, AuthState } from '../types/auth';

interface AuthContextType extends AuthState {
  loginWithGitHub: (token: string, targetUsername?: string) => Promise<{ success: boolean; error?: string; user?: GitHubUser }>;
  logout: () => void;
  setAuthorizedUsername: (username: string) => void;
  simulateAuthorDemoLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'tony_cancionero_github_auth_v1';
const USERNAME_STORAGE_KEY = 'tony_cancionero_authorized_username_v1';
const DEFAULT_AUTHORIZED_USERNAME = 'tonygb';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authorizedUsername, setAuthorizedUsernameState] = useState<string>(() => {
    try {
      return localStorage.getItem(USERNAME_STORAGE_KEY) || DEFAULT_AUTHORIZED_USERNAME;
    } catch {
      return DEFAULT_AUTHORIZED_USERNAME;
    }
  });

  const [authState, setAuthState] = useState<Omit<AuthState, 'authorizedUsername'>>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          isAuthenticated: Boolean(parsed.isAuthenticated),
          isAuthor: Boolean(parsed.isAuthor),
          user: parsed.user || null,
          token: parsed.token || null
        };
      }
    } catch {
      // ignore
    }
    return {
      isAuthenticated: false,
      isAuthor: false,
      user: null,
      token: null
    };
  });

  const persistAuth = (state: Omit<AuthState, 'authorizedUsername'>) => {
    setAuthState(state);
    try {
      if (state.isAuthenticated) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  };

  const setAuthorizedUsername = (username: string) => {
    const clean = username.trim().toLowerCase();
    setAuthorizedUsernameState(clean);
    try {
      localStorage.setItem(USERNAME_STORAGE_KEY, clean);
    } catch {
      // ignore
    }
  };

  /**
   * Client-side verification directly against GitHub REST API (No backend needed)
   */
  const loginWithGitHub = async (
    token: string,
    targetUsername?: string
  ): Promise<{ success: boolean; error?: string; user?: GitHubUser }> => {
    const cleanToken = token.trim();
    const expectedUser = (targetUsername || authorizedUsername).toLowerCase().trim();

    if (!cleanToken) {
      return { success: false, error: 'Por favor introduce un token personal de GitHub.' };
    }

    try {
      // Direct call to official GitHub API
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            error: 'Token de GitHub no válido o expirado (HTTP 401 Unauthorized).'
          };
        }
        return {
          success: false,
          error: `Error al conectar con la API de GitHub (HTTP ${response.status}).`
        };
      }

      const userData = await response.json();
      const githubUser: GitHubUser = {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
        html_url: userData.html_url,
        bio: userData.bio,
        email: userData.email
      };

      // Check if logged in user is the authorized author
      const isAuthorized = githubUser.login.toLowerCase() === expectedUser;

      if (!isAuthorized) {
        return {
          success: false,
          error: `Acceso denegado: el usuario autenticado (@${githubUser.login}) no coincide con el autor autorizado (@${expectedUser}).`
        };
      }

      persistAuth({
        isAuthenticated: true,
        isAuthor: true,
        user: githubUser,
        token: cleanToken
      });

      return { success: true, user: githubUser };
    } catch (err: any) {
      return {
        success: false,
        error: `Error de red al conectar con api.github.com: ${err.message || 'Error desconocido'}`
      };
    }
  };

  /**
   * Demo author toggle for instant testing in local preview
   */
  const simulateAuthorDemoLogin = () => {
    const demoUser: GitHubUser = {
      login: authorizedUsername,
      name: 'Tony (Autor)',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      html_url: `https://github.com/${authorizedUsername}`,
      bio: 'Compositor y cantautor.'
    };

    persistAuth({
      isAuthenticated: true,
      isAuthor: true,
      user: demoUser,
      token: 'demo-token-preview'
    });
  };

  const logout = () => {
    persistAuth({
      isAuthenticated: false,
      isAuthor: false,
      user: null,
      token: null
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        authorizedUsername,
        loginWithGitHub,
        logout,
        setAuthorizedUsername,
        simulateAuthorDemoLogin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
