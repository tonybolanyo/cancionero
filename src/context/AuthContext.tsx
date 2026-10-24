import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GitHubUser, AuthState } from '../types/auth';
import { AUTHORIZED_GITHUB_USER, isAuthorizedAuthorLogin } from '../utils/authConfig';

interface AuthContextType extends AuthState {
  loginWithGitHub: (token: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string; user?: GitHubUser }>;
  logout: () => void;
  isVerifyingSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'tony_cancionero_github_auth_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(false);

  // Initialize auth state by checking sessionStorage first (preferred), then localStorage
  const [authState, setAuthState] = useState<AuthState>(() => {
    try {
      // Check session storage first
      const sessionStored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (sessionStored) {
        const parsed = JSON.parse(sessionStored);
        if (parsed.isAuthenticated && isAuthorizedAuthorLogin(parsed.user?.login)) {
          return {
            isAuthenticated: true,
            isAuthor: true,
            user: parsed.user || null,
            token: parsed.token || null,
            authorizedUsername: AUTHORIZED_GITHUB_USER,
            rememberMe: false
          };
        }
      }

      // Check local storage if user chose "remember me"
      const localStored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (localStored) {
        const parsed = JSON.parse(localStored);
        if (parsed.isAuthenticated && isAuthorizedAuthorLogin(parsed.user?.login)) {
          return {
            isAuthenticated: true,
            isAuthor: true,
            user: parsed.user || null,
            token: parsed.token || null,
            authorizedUsername: AUTHORIZED_GITHUB_USER,
            rememberMe: true
          };
        }
      }
    } catch (e) {
      console.warn('Error reading stored auth state', e);
    }

    return {
      isAuthenticated: false,
      isAuthor: false,
      user: null,
      token: null,
      authorizedUsername: AUTHORIZED_GITHUB_USER,
      rememberMe: false
    };
  });

  const clearStoredAuth = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const persistAuth = useCallback((state: AuthState) => {
    setAuthState(state);
    try {
      if (state.isAuthenticated && state.token) {
        const payload = JSON.stringify({
          isAuthenticated: true,
          isAuthor: true,
          user: state.user,
          token: state.token
        });

        if (state.rememberMe) {
          localStorage.setItem(AUTH_STORAGE_KEY, payload);
          sessionStorage.removeItem(AUTH_STORAGE_KEY);
        } else {
          sessionStorage.setItem(AUTH_STORAGE_KEY, payload);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } else {
        clearStoredAuth();
      }
    } catch (e) {
      console.warn('Failed to persist auth state', e);
    }
  }, [clearStoredAuth]);

  /**
   * Verify an existing saved session against GitHub API on initial mount
   */
  useEffect(() => {
    if (!authState.token || !authState.isAuthenticated) return;

    let isMounted = true;
    const verifySavedToken = async () => {
      setIsVerifyingSession(true);
      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${authState.token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        });

        if (!response.ok) {
          // Token expired, invalid or revoked
          console.warn('Saved GitHub token is no longer valid, clearing session.');
          if (isMounted) {
            clearStoredAuth();
            setAuthState({
              isAuthenticated: false,
              isAuthor: false,
              user: null,
              token: null,
              authorizedUsername: AUTHORIZED_GITHUB_USER,
              rememberMe: false
            });
          }
          return;
        }

        const userData = await response.json();
        if (!isAuthorizedAuthorLogin(userData.login)) {
          // Username mismatch
          console.warn('Authenticated user does not match authorized author, clearing session.');
          if (isMounted) {
            clearStoredAuth();
            setAuthState({
              isAuthenticated: false,
              isAuthor: false,
              user: null,
              token: null,
              authorizedUsername: AUTHORIZED_GITHUB_USER,
              rememberMe: false
            });
          }
          return;
        }

        // Token still valid, update profile details in state
        if (isMounted) {
          setAuthState(prev => ({
            ...prev,
            user: {
              login: userData.login,
              name: userData.name || userData.login,
              avatar_url: userData.avatar_url,
              html_url: userData.html_url,
              bio: userData.bio,
              email: userData.email
            }
          }));
        }
      } catch (err) {
        // Network failure during background check, do not kick out if offline
        console.warn('Network error verifying saved GitHub token', err);
      } finally {
        if (isMounted) {
          setIsVerifyingSession(false);
        }
      }
    };

    verifySavedToken();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Authenticate strictly with GitHub REST API
   * Rejects any token that does not belong to the authorized GitHub account
   */
  const loginWithGitHub = async (
    token: string,
    rememberMe: boolean = false
  ): Promise<{ success: boolean; error?: string; user?: GitHubUser }> => {
    const cleanToken = token.trim();

    if (!cleanToken) {
      return { success: false, error: 'Por favor introduce tu Personal Access Token (PAT) de GitHub.' };
    }

    try {
      // Validate directly with GitHub's official API
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
            error: 'Token de GitHub no válido o expirado (HTTP 401 Unauthorized). Comprueba que el token esté activo.'
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            error: 'Límite de solicitudes de la API de GitHub superado o permisos insuficientes (HTTP 403 Forbidden).'
          };
        }
        return {
          success: false,
          error: `Error al conectar con la API de GitHub (código HTTP ${response.status}).`
        };
      }

      const userData = await response.json();
      const authenticatedLogin = String(userData.login || '').trim();

      // STRICT AUTHORIZATION CHECK:
      // Only the exact GitHub user configured in AUTHORIZED_GITHUB_USER has author permissions.
      // Any other user, even with valid GitHub credentials, is explicitly rejected.
      if (!isAuthorizedAuthorLogin(authenticatedLogin)) {
        return {
          success: false,
          error: `Acceso denegado: Te has identificado en GitHub como @${authenticatedLogin}, pero solamente el usuario @${AUTHORIZED_GITHUB_USER} tiene permisos de autor en este cancionero. Ninguna otra cuenta puede acceder a la sección de autor.`
        };
      }

      const githubUser: GitHubUser = {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
        html_url: userData.html_url,
        bio: userData.bio,
        email: userData.email
      };

      persistAuth({
        isAuthenticated: true,
        isAuthor: true,
        user: githubUser,
        token: cleanToken,
        authorizedUsername: AUTHORIZED_GITHUB_USER,
        rememberMe
      });

      return { success: true, user: githubUser };
    } catch (err: any) {
      return {
        success: false,
        error: `Error de red al conectar con api.github.com: ${err.message || 'Comprueba tu conexión a internet.'}`
      };
    }
  };

  /**
   * Log out completely and wipe stored token
   */
  const logout = () => {
    clearStoredAuth();
    setAuthState({
      isAuthenticated: false,
      isAuthor: false,
      user: null,
      token: null,
      authorizedUsername: AUTHORIZED_GITHUB_USER,
      rememberMe: false
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        loginWithGitHub,
        logout,
        isVerifyingSession
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
