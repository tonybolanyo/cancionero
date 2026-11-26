import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  GitHubUser,
  GoogleAuthUser,
  AuthState,
  GoogleDriveTokenStatus,
  AuthStorageMode
} from '../types/auth';
import {
  AUTHORIZED_GITHUB_USER,
  isAuthorizedAuthorLogin,
  AUTHORIZED_AUTHOR_EMAIL,
  isAuthorizedAuthorEmail,
  setRuntimeAuthorSession,
  setServerCookieAuthActive
} from '../utils/authConfig';
import { GoogleDriveService, TOKEN_EXPIRY_BUFFER_MS } from '../services/googleDriveService';
import { resolveAppUrl } from '../utils/appUrl';
import {
  saveEncryptedGitHubToken,
  loadEncryptedGitHubToken,
  clearEncryptedGitHubToken,
  consumeLegacyPlaintextGitHubAuth
} from '../utils/tokenVault';

interface AuthContextType extends AuthState {
  loginWithGitHub: (token: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string; user?: GitHubUser }>;
  logout: () => Promise<void>;
  isVerifyingSession: boolean;
  authorToken: string | null;
  authStorageMode: AuthStorageMode;
  isServerAuthMode: boolean;
  // Google Drive Integration
  googleUser: GoogleAuthUser | null;
  isGoogleDriveConnected: boolean;
  driveTokenStatus: GoogleDriveTokenStatus;
  driveTokenExpiresAt: number | null;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string; user?: GoogleAuthUser }>;
  logoutGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INITIAL_UNAUTHENTICATED_STATE: AuthState = {
  isAuthenticated: false,
  isAuthor: false,
  user: null,
  token: null,
  authorizedUsername: AUTHORIZED_GITHUB_USER,
  rememberMe: false,
  storageMode: 'none'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(true);
  const [isServerAuthMode, setIsServerAuthMode] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<GoogleAuthUser | null>(null);
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState<boolean>(false);
  const [driveTokenStatus, setDriveTokenStatus] = useState<GoogleDriveTokenStatus>('disconnected');
  const [driveTokenExpiresAt, setDriveTokenExpiresAt] = useState<number | null>(null);
  const [authState, setAuthState] = useState<AuthState>(INITIAL_UNAUTHENTICATED_STATE);
  const driveExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDriveExpiryTimer = useCallback(() => {
    if (driveExpiryTimerRef.current) {
      clearTimeout(driveExpiryTimerRef.current);
      driveExpiryTimerRef.current = null;
    }
  }, []);

  const scheduleDriveExpiryCheck = useCallback((expiresAt: number | null) => {
    clearDriveExpiryTimer();
    if (!expiresAt) return;

    const msUntilExpiry = Math.max(0, expiresAt - TOKEN_EXPIRY_BUFFER_MS - Date.now());
    driveExpiryTimerRef.current = setTimeout(() => {
      GoogleDriveService.clearCachedTokenOnly();
      setIsGoogleDriveConnected(false);
      setDriveTokenStatus('expired');
      setDriveTokenExpiresAt(null);
    }, msUntilExpiry);
  }, [clearDriveExpiryTimer]);

  const clearStoredAuth = useCallback(() => {
    clearEncryptedGitHubToken();
    consumeLegacyPlaintextGitHubAuth();
  }, []);

  // Keep runtime verification registry synchronized ONLY from verified auth states
  useEffect(() => {
    const githubVerified =
      authState.isAuthenticated && isAuthorizedAuthorLogin(authState.user?.login);
    const googleVerified =
      Boolean(googleUser) && isAuthorizedAuthorEmail(googleUser?.email);
    const verified = githubVerified || googleVerified;
    const activeToken = githubVerified
      ? authState.token
      : googleVerified
        ? GoogleDriveService.getAccessToken()
        : null;

    setRuntimeAuthorSession(verified, activeToken);
  }, [authState.isAuthenticated, authState.user, authState.token, googleUser, isGoogleDriveConnected]);

  /**
   * Initialize Google Drive Auth Listener (restores encrypted sessionStorage token across reloads
   * without launching popups on mount, and exposes explicit expired status).
   */
  useEffect(() => {
    const unsubscribeAuth = GoogleDriveService.initAuth(
      async (user, _token, expiresAt) => {
        if (!isAuthorizedAuthorEmail(user.email)) {
          console.warn(`Cuenta Google (${user.email}) no coincide con el autor autorizado (${AUTHORIZED_AUTHOR_EMAIL}). Desconectando.`);
          await GoogleDriveService.signOut();
          setGoogleUser(null);
          setIsGoogleDriveConnected(false);
          setDriveTokenStatus('disconnected');
          setDriveTokenExpiresAt(null);
          clearDriveExpiryTimer();
          return;
        }

        setGoogleUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        });
        setIsGoogleDriveConnected(true);
        setDriveTokenStatus('connected');
        setDriveTokenExpiresAt(expiresAt);
        scheduleDriveExpiryCheck(expiresAt);
      },
      () => {
        setGoogleUser(null);
        setIsGoogleDriveConnected(false);
        setDriveTokenStatus('disconnected');
        setDriveTokenExpiresAt(null);
        clearDriveExpiryTimer();
      },
      async (user) => {
        // Firebase Auth user is still signed in, but Google Drive OAuth access token expired or was cleared
        if (!isAuthorizedAuthorEmail(user.email)) {
          await GoogleDriveService.signOut();
          setGoogleUser(null);
          setIsGoogleDriveConnected(false);
          setDriveTokenStatus('disconnected');
          setDriveTokenExpiresAt(null);
          clearDriveExpiryTimer();
          return;
        }

        setGoogleUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        });
        setIsGoogleDriveConnected(false);
        setDriveTokenStatus('expired');
        setDriveTokenExpiresAt(null);
        clearDriveExpiryTimer();
      }
    );

    const unsubscribeToken = GoogleDriveService.onTokenStateChange(({ status, expiresAt }) => {
      setDriveTokenStatus(status);
      setIsGoogleDriveConnected(status === 'connected');
      setDriveTokenExpiresAt(expiresAt);
      if (status === 'connected' && expiresAt) {
        scheduleDriveExpiryCheck(expiresAt);
      } else {
        clearDriveExpiryTimer();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
      clearDriveExpiryTimer();
    };
  }, [clearDriveExpiryTimer, scheduleDriveExpiryCheck]);

  /**
   * Bootstrap GitHub session on initial mount:
   * 1. Probe server.ts (`/api/auth/session`). If available, use HttpOnly cookie auth exclusively.
   * 2. Otherwise (static GitHub Pages), decrypt token from sessionStorage/localStorage vault
   *    and verify it live against `https://api.github.com/user` BEFORE granting isAuthor.
   */
  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      setIsVerifyingSession(true);

      // Clean up any legacy plaintext token, keeping it transiently only for immediate secure migration
      const legacyAuth = consumeLegacyPlaintextGitHubAuth();

      // 1. Check if server.ts backend session endpoints are available
      try {
        const sessionRes = await fetch(resolveAppUrl('api/auth/session'), {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });

        const contentType = sessionRes.headers.get('content-type') || '';
        if (sessionRes.ok && contentType.includes('application/json')) {
          const data = await sessionRes.json();
          if (data && data.authMode === 'server_cookie') {
            if (!isMounted) return;
            setIsServerAuthMode(true);
            setServerCookieAuthActive(true);
            // Ensure no client-side GitHub PAT remains in browser storage in server mode
            clearEncryptedGitHubToken();

            if (data.authenticated && data.user && isAuthorizedAuthorLogin(data.user.login)) {
              setAuthState({
                isAuthenticated: true,
                isAuthor: true,
                user: data.user,
                token: null, // Held strictly in HttpOnly cookie on server.ts
                authorizedUsername: AUTHORIZED_GITHUB_USER,
                rememberMe: Boolean(data.rememberMe),
                storageMode: 'http_only_cookie'
              });
              setIsVerifyingSession(false);
              return;
            }

            // If user had a legacy plaintext token in browser storage, migrate it into HttpOnly cookie once
            if (legacyAuth?.token) {
              try {
                const migrateRes = await fetch(resolveAppUrl('api/auth/github'), {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'cancionero-client'
                  },
                  body: JSON.stringify({
                    token: legacyAuth.token,
                    rememberMe: legacyAuth.rememberMe
                  })
                });
                if (migrateRes.ok) {
                  const migrated = await migrateRes.json();
                  if (migrated.success && migrated.user && isMounted) {
                    setAuthState({
                      isAuthenticated: true,
                      isAuthor: true,
                      user: migrated.user,
                      token: null,
                      authorizedUsername: AUTHORIZED_GITHUB_USER,
                      rememberMe: legacyAuth.rememberMe,
                      storageMode: 'http_only_cookie'
                    });
                    setIsVerifyingSession(false);
                    return;
                  }
                }
              } catch {
                // ignore migration failure
              }
            }

            setAuthState({
              ...INITIAL_UNAUTHENTICATED_STATE,
              storageMode: 'http_only_cookie'
            });
            setIsVerifyingSession(false);
            return;
          }
        }
      } catch {
        // Static GitHub Pages or offline: proceed to encrypted client vault
      }

      if (!isMounted) return;
      setIsServerAuthMode(false);
      setServerCookieAuthActive(false);

      // 2. Static mode: decrypt token from encrypted vault (or migrate legacy plaintext token)
      let candidateToken: string | null = null;
      let candidatePersistent = false;

      const vaulted = await loadEncryptedGitHubToken();
      if (vaulted) {
        candidateToken = vaulted.token;
        candidatePersistent = vaulted.persistent;
      } else if (legacyAuth?.token) {
        candidateToken = legacyAuth.token;
        candidatePersistent = legacyAuth.rememberMe;
        await saveEncryptedGitHubToken(candidateToken, candidatePersistent);
      }

      if (!candidateToken) {
        if (isMounted) {
          setAuthState(INITIAL_UNAUTHENTICATED_STATE);
          setIsVerifyingSession(false);
        }
        return;
      }

      // Live verification against GitHub API before granting isAuthor
      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${candidateToken}`,
            Accept: 'application/vnd.github.v3+json'
          }
        });

        if (!response.ok) {
          clearStoredAuth();
          if (isMounted) {
            setAuthState(INITIAL_UNAUTHENTICATED_STATE);
          }
          return;
        }

        const userData = await response.json();
        if (!isAuthorizedAuthorLogin(userData.login)) {
          clearStoredAuth();
          if (isMounted) {
            setAuthState(INITIAL_UNAUTHENTICATED_STATE);
          }
          return;
        }

        if (isMounted) {
          setAuthState({
            isAuthenticated: true,
            isAuthor: true,
            user: {
              login: userData.login,
              name: userData.name || userData.login,
              avatar_url: userData.avatar_url,
              html_url: userData.html_url,
              bio: userData.bio,
              email: userData.email
            },
            token: candidateToken,
            authorizedUsername: AUTHORIZED_GITHUB_USER,
            rememberMe: candidatePersistent,
            storageMode: candidatePersistent ? 'persistent_encrypted' : 'session_encrypted'
          });
        }
      } catch (err) {
        console.warn('Network error verifying saved GitHub token', err);
        if (isMounted) {
          setAuthState(INITIAL_UNAUTHENTICATED_STATE);
        }
      } finally {
        if (isMounted) {
          setIsVerifyingSession(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, [clearStoredAuth]);

  /**
   * Authenticate with GitHub:
   * - In server mode: validates via POST /api/auth/github and stores PAT solely in an HttpOnly cookie.
   * - In static mode: validates directly against api.github.com/user and stores AES-GCM encrypted PAT
   *   in sessionStorage (default) or localStorage (if rememberMe=true).
   */
  const loginWithGitHub = async (
    token: string,
    rememberMe: boolean = false
  ): Promise<{ success: boolean; error?: string; user?: GitHubUser }> => {
    const cleanToken = token.trim();

    if (!cleanToken) {
      return { success: false, error: 'Por favor introduce tu Personal Access Token (PAT) de GitHub.' };
    }

    if (isServerAuthMode) {
      try {
        const res = await fetch(resolveAppUrl('api/auth/github'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'cancionero-client'
          },
          body: JSON.stringify({ token: cleanToken, rememberMe })
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.success || !data?.user) {
          return {
            success: false,
            error: data?.error || `Error al autenticar con el servidor (HTTP ${res.status}).`
          };
        }

        clearStoredAuth();
        setServerCookieAuthActive(true);
        setAuthState({
          isAuthenticated: true,
          isAuthor: true,
          user: data.user,
          token: null, // Never retained in client storage or React state in server mode
          authorizedUsername: AUTHORIZED_GITHUB_USER,
          rememberMe,
          storageMode: 'http_only_cookie'
        });

        return { success: true, user: data.user };
      } catch (err: any) {
        return {
          success: false,
          error: `Error de red autenticando con el servidor: ${err?.message || 'Comprueba tu conexión.'}`
        };
      }
    }

    // Static mode (GitHub Pages)
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

      const saved = await saveEncryptedGitHubToken(cleanToken, rememberMe);
      const storageMode: AuthStorageMode = saved
        ? rememberMe
          ? 'persistent_encrypted'
          : 'session_encrypted'
        : 'none';

      setAuthState({
        isAuthenticated: true,
        isAuthor: true,
        user: githubUser,
        token: cleanToken,
        authorizedUsername: AUTHORIZED_GITHUB_USER,
        rememberMe,
        storageMode
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
   * Sign in with Google Drive via user-triggered Firebase Popup
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string; user?: GoogleAuthUser }> => {
    try {
      const result = await GoogleDriveService.signInWithGoogle();
      const email = result.user.email;

      if (!isAuthorizedAuthorEmail(email)) {
        await GoogleDriveService.signOut();
        setGoogleUser(null);
        setIsGoogleDriveConnected(false);
        setDriveTokenStatus('disconnected');
        setDriveTokenExpiresAt(null);
        clearDriveExpiryTimer();
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
      setDriveTokenStatus('connected');
      setDriveTokenExpiresAt(result.expiresAt);
      scheduleDriveExpiryCheck(result.expiresAt);

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
  const logoutGoogle = async (): Promise<void> => {
    clearDriveExpiryTimer();
    await GoogleDriveService.signOut();
    setGoogleUser(null);
    setIsGoogleDriveConnected(false);
    setDriveTokenStatus('disconnected');
    setDriveTokenExpiresAt(null);
  };

  /**
   * Log out completely: awaits Google Drive signOut, clears server HttpOnly cookie, and wipes encrypted client vaults.
   */
  const logout = async (): Promise<void> => {
    clearStoredAuth();
    setRuntimeAuthorSession(false, null);

    if (isServerAuthMode) {
      try {
        await fetch(resolveAppUrl('api/auth/logout'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-Requested-With': 'cancionero-client'
          }
        });
      } catch (err) {
        console.warn('Error clearing server session cookie:', err);
      }
    }

    await logoutGoogle();

    setAuthState({
      ...INITIAL_UNAUTHENTICATED_STATE,
      storageMode: isServerAuthMode ? 'http_only_cookie' : 'none'
    });
  };

  const isAuthor =
    (authState.isAuthenticated && isAuthorizedAuthorLogin(authState.user?.login)) ||
    (Boolean(googleUser) && isAuthorizedAuthorEmail(googleUser?.email));

  const authorToken = authState.token || GoogleDriveService.getAccessToken();

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        isAuthor,
        authorToken,
        authStorageMode: authState.storageMode || 'none',
        isServerAuthMode,
        loginWithGitHub,
        logout,
        isVerifyingSession,
        googleUser,
        isGoogleDriveConnected,
        driveTokenStatus,
        driveTokenExpiresAt,
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
