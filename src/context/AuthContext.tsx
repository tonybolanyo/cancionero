import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GitHubUser, GoogleAuthUser, AuthState } from '../types/auth';
import { AUTHORIZED_GITHUB_USER, isAuthorizedAuthorLogin, AUTHORIZED_AUTHOR_EMAIL, isAuthorizedAuthorEmail } from '../utils/authConfig';
import { GoogleDriveService } from '../services/googleDriveService';

interface AuthContextType extends AuthState {
  loginWithGitHub: (token: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string; user?: GitHubUser }>;
  logout: () => void;
  isVerifyingSession: boolean;
  authorToken: string | null;
  // Google Drive Integration
  googleUser: GoogleAuthUser | null;
  isGoogleDriveConnected: boolean;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string; user?: GoogleAuthUser }>;
  logoutGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'tony_cancionero_github_auth_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<GoogleAuthUser | null>(null);
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState<boolean>(false);

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
   * Initialize Google Drive Auth Listener
   */
  useEffect(() => {
    const unsubscribe = GoogleDriveService.initAuth(
      async (user, token) => {
        // Enforce strict check on author email
        if (!isAuthorizedAuthorEmail(user.email)) {
          console.warn(`Cuenta Google (${user.email}) no coincide con el autor autorizado (${AUTHORIZED_AUTHOR_EMAIL}). Desconectando.`);
          await GoogleDriveService.signOut();
          setGoogleUser(null);
          setIsGoogleDriveConnected(false);
          return;
        }

        setGoogleUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        });
        setIsGoogleDriveConnected(Boolean(token));
      },
      () => {
        setGoogleUser(null);
        setIsGoogleDriveConnected(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

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
        if (response.status === 403) {
          return {
            success: false,
            error: 'Límite de solicitudes de la API de GitHub superado (HTTP 403 Forbidden).'
          };
        }
        return {
          success: false,
          error: `Error al conectar con la API de GitHub (código HTTP ${response.status}).`
        };
      }

      const userData = await response.json();
      const authenticatedLogin = String(userData.login || '').trim();

      if (!isAuthorizedAuthorLogin(authenticatedLogin)) {
        return {
          success: false,
          error: `Acceso denegado: Te has identificado en GitHub como @${authenticatedLogin}, pero solamente el usuario @${AUTHORIZED_GITHUB_USER} tiene permisos de autor en este cancionero.`
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
   * Sign in with Google Drive via Firebase Popup
   */
  /**
   * Sign in with Google Drive via Firebase Popup
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string; user?: GoogleAuthUser }> => {
    try {
      const result = await GoogleDriveService.signInWithGoogle();
      const email = result.user.email;

      // Enforce strict check on author email
      if (!isAuthorizedAuthorEmail(email)) {
        await GoogleDriveService.signOut();
        setGoogleUser(null);
        setIsGoogleDriveConnected(false);
        return {
          success: false,
          error: `Acceso denegado: Te has identificado con ${email || 'una cuenta de Google no autorizada'}, pero solamente el propietario (${AUTHORIZED_AUTHOR_EMAIL}) tiene permisos de autor en este cancionero.`
        };
      }

      const mappedUser: GoogleAuthUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      };

      setGoogleUser(mappedUser);
      setIsGoogleDriveConnected(true);

      return { success: true, user: mappedUser };
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      return {
        success: false,
        error: err.message || 'Error al iniciar sesión con Google Drive.'
      };
    }
  };

  /**
   * Sign out from Google Drive
   */
  const logoutGoogle = async () => {
    await GoogleDriveService.signOut();
    setGoogleUser(null);
    setIsGoogleDriveConnected(false);
  };

  /**
   * Log out completely and wipe stored token
   */
  const logout = () => {
    clearStoredAuth();
    logoutGoogle();
    setAuthState({
      isAuthenticated: false,
      isAuthor: false,
      user: null,
      token: null,
      authorizedUsername: AUTHORIZED_GITHUB_USER,
      rememberMe: false
    });
  };

  // The user is recognized as Author ONLY if authenticated as the authorized GitHub account or authorized Google account
  const isAuthor =
    (authState.isAuthenticated && isAuthorizedAuthorLogin(authState.user?.login)) ||
    (Boolean(googleUser) && isAuthorizedAuthorEmail(googleUser?.email));

  // Author token for authenticated API calls
  const authorToken = authState.token || GoogleDriveService.getAccessToken();

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        isAuthor,
        authorToken,
        loginWithGitHub,
        logout,
        isVerifyingSession,
        googleUser,
        isGoogleDriveConnected,
        loginWithGoogle,
        logoutGoogle
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
