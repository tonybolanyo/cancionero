import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  Auth
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleDriveTokenStatus } from '../types/auth';
import {
  saveEncryptedDriveSession,
  loadEncryptedDriveSession,
  clearEncryptedDriveSession
} from '../utils/tokenVault';

// Scope for Google Drive file access
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

// Google OAuth access tokens typically last 3600s; refresh/mark expired 60s early
export const DEFAULT_GOOGLE_TOKEN_TTL_SECONDS = 3500;
export const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  webViewLink?: string;
}

export interface GoogleDriveUploadResult {
  id: string;
  name: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface GoogleDriveSessionCallbacks {
  onSuccess?: (user: User, token: string, expiresAt: number) => void;
  onExpired?: (user: User) => void;
  onFailure?: () => void;
}

// In-memory token cache paired with explicit expiration timestamp
let cachedAccessToken: string | null = null;
let cachedExpiresAt: number | null = null;
let cachedUid: string | null = null;
let isSigningIn = false;
let firebaseAppInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

type TokenStateListener = (state: { status: GoogleDriveTokenStatus; expiresAt: number | null }) => void;
const tokenListeners = new Set<TokenStateListener>();

function notifyTokenListeners(): void {
  const status = GoogleDriveService.getTokenStatus();
  const expiresAt = GoogleDriveService.getTokenExpiresAt();
  tokenListeners.forEach(listener => {
    try {
      listener({ status, expiresAt });
    } catch {
      // ignore listener errors
    }
  });
}

function getFirebaseApp(): FirebaseApp {
  if (!firebaseAppInstance) {
    firebaseAppInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return firebaseAppInstance;
}

function getFirebaseAuth(): Auth {
  if (!authInstance) {
    const app = getFirebaseApp();
    authInstance = getAuth(app);
  }
  return authInstance;
}

function extractTokenExpiryMs(result: unknown): number {
  const rawTokenResponse = (result as any)?._tokenResponse;
  const rawSeconds = Number(rawTokenResponse?.oauthExpireIn ?? rawTokenResponse?.expiresIn);
  const ttlSeconds =
    Number.isFinite(rawSeconds) && rawSeconds > 120
      ? rawSeconds
      : DEFAULT_GOOGLE_TOKEN_TTL_SECONDS;
  return Date.now() + ttlSeconds * 1000;
}

/**
 * Attempts a strictly non-interactive silent token renewal via Google Identity Services
 * only if GIS is already loaded in window. Never opens a popup on mount.
 */
async function trySilentGisRenewal(userEmail?: string | null): Promise<{ accessToken: string; expiresAt: number } | null> {
  try {
    const gisOauth2 = (typeof window !== 'undefined' ? (window as any)?.google?.accounts?.oauth2 : null);
    const clientId = (firebaseConfig as any)?.oAuthClientId;
    if (!gisOauth2?.initTokenClient || !clientId) {
      return null;
    }

    return await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 4000);
      try {
        const client = gisOauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_DRIVE_SCOPES.join(' '),
          hint: userEmail || undefined,
          prompt: '',
          callback: (resp: any) => {
            clearTimeout(timeout);
            if (resp?.access_token && !resp?.error) {
              const ttlSec = Number(resp.expires_in);
              const expiresAt = Date.now() + (Number.isFinite(ttlSec) && ttlSec > 120 ? ttlSec : DEFAULT_GOOGLE_TOKEN_TTL_SECONDS) * 1000;
              resolve({ accessToken: resp.access_token, expiresAt });
            } else {
              resolve(null);
            }
          },
          error_callback: () => {
            clearTimeout(timeout);
            resolve(null);
          }
        });
        client.requestAccessToken({ prompt: 'none' });
      } catch {
        clearTimeout(timeout);
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export class GoogleDriveService {
  /**
   * Subscribes to Drive token status transitions (e.g. automatic expiry)
   */
  static onTokenStateChange(listener: TokenStateListener): () => void {
    tokenListeners.add(listener);
    return () => {
      tokenListeners.delete(listener);
    };
  }

  /**
   * Initializes the auth state listener. Restores valid short-lived Drive tokens from
   * encrypted sessionStorage across reloads without launching popups on mount, and
   * reports explicit expired status when Firebase Auth is active but Drive token expired.
   */
  static initAuth(
    onSuccess?: (user: User, token: string, expiresAt: number) => void,
    onFailure?: () => void,
    onExpired?: (user: User) => void
  ) {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        if (!isSigningIn) {
          this.clearCachedTokenOnly();
          if (onFailure) onFailure();
        }
        return;
      }

      // 1. Check active non-expired in-memory token for this user
      if (cachedAccessToken && cachedUid === user.uid && !this.isTokenExpired()) {
        if (onSuccess) onSuccess(user, cachedAccessToken, cachedExpiresAt!);
        return;
      }

      // 2. Restore from encrypted sessionStorage (survives page reload within token TTL)
      const restored = await loadEncryptedDriveSession(user.uid);
      if (restored && Date.now() < restored.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
        cachedAccessToken = restored.accessToken;
        cachedExpiresAt = restored.expiresAt;
        cachedUid = restored.uid;
        notifyTokenListeners();
        if (onSuccess) onSuccess(user, restored.accessToken, restored.expiresAt);
        return;
      }

      // 3. Attempt strictly non-interactive silent renewal if GIS is loaded (never popup on mount)
      if (!isSigningIn) {
        const silent = await trySilentGisRenewal(user.email);
        if (silent) {
          cachedAccessToken = silent.accessToken;
          cachedExpiresAt = silent.expiresAt;
          cachedUid = user.uid;
          await saveEncryptedDriveSession({
            accessToken: silent.accessToken,
            expiresAt: silent.expiresAt,
            uid: user.uid,
            email: user.email
          });
          notifyTokenListeners();
          if (onSuccess) onSuccess(user, silent.accessToken, silent.expiresAt);
          return;
        }

        // 4. Token missing or expired while Firebase Auth user remains signed in:
        // Do NOT open an unexpected popup on mount — emit explicit expired state.
        this.clearCachedTokenOnly();
        if (onExpired) {
          onExpired(user);
        } else if (onFailure) {
          onFailure();
        }
      }
    });
  }

  /**
   * Clears in-memory and sessionStorage token state without signing out Firebase Auth.
   */
  static clearCachedTokenOnly(): void {
    cachedAccessToken = null;
    cachedExpiresAt = null;
    cachedUid = null;
    clearEncryptedDriveSession();
    notifyTokenListeners();
  }

  /**
   * Seeds an active token session (primarily for unit tests or post-popup restoration).
   */
  static async setSessionToken(params: {
    accessToken: string;
    expiresAt: number;
    uid: string;
    email: string | null;
  }): Promise<void> {
    cachedAccessToken = params.accessToken;
    cachedExpiresAt = params.expiresAt;
    cachedUid = params.uid;
    await saveEncryptedDriveSession(params);
    notifyTokenListeners();
  }

  /**
   * Returns current in-memory access token if valid and non-expired
   */
  static getAccessToken(): string | null {
    if (!cachedAccessToken || this.isTokenExpired()) {
      return null;
    }
    return cachedAccessToken;
  }

  /**
   * Returns token expiration timestamp (epoch ms) or null if disconnected/expired
   */
  static getTokenExpiresAt(): number | null {
    if (!cachedAccessToken || !cachedExpiresAt || Date.now() >= cachedExpiresAt - TOKEN_EXPIRY_BUFFER_MS) {
      return null;
    }
    return cachedExpiresAt;
  }

  /**
   * Returns true if no token is cached or the cached token is past its expiration buffer
   */
  static isTokenExpired(): boolean {
    if (!cachedAccessToken || !cachedExpiresAt) return true;
    return Date.now() >= cachedExpiresAt - TOKEN_EXPIRY_BUFFER_MS;
  }

  /**
   * Explicit Drive token lifecycle status
   */
  static getTokenStatus(): GoogleDriveTokenStatus {
    if (cachedAccessToken && cachedExpiresAt) {
      return Date.now() < cachedExpiresAt - TOKEN_EXPIRY_BUFFER_MS ? 'connected' : 'expired';
    }
    try {
      const auth = authInstance;
      if (auth?.currentUser) {
        return 'expired';
      }
    } catch {
      // ignore
    }
    return 'disconnected';
  }

  private static requireValidAccessToken(missingMessage: string): string {
    if (!cachedAccessToken || this.isTokenExpired()) {
      if (cachedAccessToken) {
        this.clearCachedTokenOnly();
        throw new Error('Tu sesión de Google Drive ha caducado. Renueva el acceso a Drive para continuar.');
      }
      throw new Error(missingMessage);
    }
    return cachedAccessToken;
  }

  /**
   * Signs in with Google Popup (must be triggered by explicit user action) and requests Drive file scope
   */
  static async signInWithGoogle(): Promise<{ user: User; accessToken: string; expiresAt: number }> {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    GOOGLE_DRIVE_SCOPES.forEach(scope => provider.addScope(scope));

    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential?.accessToken) {
        throw new Error('No se pudo obtener el token de acceso de Google Drive.');
      }

      const expiresAt = extractTokenExpiryMs(result);
      cachedAccessToken = credential.accessToken;
      cachedExpiresAt = expiresAt;
      cachedUid = result.user.uid;

      await saveEncryptedDriveSession({
        accessToken: cachedAccessToken,
        expiresAt,
        uid: result.user.uid,
        email: result.user.email
      });
      notifyTokenListeners();

      return { user: result.user, accessToken: cachedAccessToken, expiresAt };
    } finally {
      isSigningIn = false;
    }
  }

  /**
   * Signs out from Google and clears in-memory + sessionStorage Drive tokens
   */
  static async signOut(): Promise<void> {
    this.clearCachedTokenOnly();
    const auth = getFirebaseAuth();
    await signOut(auth);
  }

  /**
   * Checks if user has an active, non-expired Google Drive session
   */
  static isConnected(): boolean {
    return Boolean(this.getAccessToken());
  }

  /**
   * Uploads an audio file directly to Google Drive via multipart upload
   */
  static async uploadAudio(
    file: File,
    options?: { songTitle?: string; description?: string }
  ): Promise<GoogleDriveUploadResult> {
    const token = this.requireValidAccessToken(
      'No has iniciado sesión con Google Drive. Inicia sesión para guardar tu maqueta.'
    );

    const boundary = '-------CancioneroDriveBoundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const metadata = {
      name: file.name,
      mimeType: file.type || 'audio/mpeg',
      description: options?.description || `Maqueta privada de autor para "${options?.songTitle || 'cancionero'}"`,
      properties: {
        app: 'cancionero',
        songTitle: options?.songTitle || '',
        uploadedAt: new Date().toISOString()
      }
    };

    const multipartRequestBody = new Blob([
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${file.type || 'audio/mpeg'}\r\n\r\n`,
      file,
      closeDelim
    ], { type: `multipart/related; boundary=${boundary}` });

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) {
        this.clearCachedTokenOnly();
        throw new Error('Tu sesión de Google Drive ha caducado. Vuelve a iniciar sesión.');
      }
      throw new Error(`Error al subir a Google Drive (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name || file.name,
      fileId: data.id,
      fileName: data.name || file.name,
      mimeType: data.mimeType || file.type || 'audio/mpeg',
      size: file.size
    };
  }

  /**
   * Uploads a video file or blob directly to Google Drive via multipart upload
   */
  static async uploadVideo(
    blobOrFile: Blob | File,
    fileName: string,
    options?: { songTitle?: string; description?: string; mimeType?: string }
  ): Promise<GoogleDriveUploadResult> {
    const token = this.requireValidAccessToken(
      'No has iniciado sesión con Google Drive. Inicia sesión para guardar tu vídeo.'
    );

    const boundary = '-------CancioneroDriveBoundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const mimeType = options?.mimeType || blobOrFile.type || 'video/webm';

    const metadata = {
      name: fileName,
      mimeType: mimeType,
      description: options?.description || `Vídeo musical para YouTube con letra sincronizada de "${options?.songTitle || 'cancionero'}"`,
      properties: {
        app: 'cancionero',
        type: 'youtube-visualizer',
        songTitle: options?.songTitle || '',
        uploadedAt: new Date().toISOString()
      }
    };

    const multipartRequestBody = new Blob([
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`,
      blobOrFile,
      closeDelim
    ], { type: `multipart/related; boundary=${boundary}` });

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) {
        this.clearCachedTokenOnly();
        throw new Error('Tu sesión de Google Drive ha caducado. Vuelve a iniciar sesión.');
      }
      throw new Error(`Error al subir vídeo a Google Drive (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name || fileName,
      fileId: data.id,
      fileName: data.name || fileName,
      mimeType: data.mimeType || mimeType,
      size: blobOrFile.size
    };
  }

  /**
   * Alias for uploadAudio with file parameter
   */
  static async uploadAudioFile(
    file: File,
    customName?: string,
    options?: { songId?: string; title?: string }
  ): Promise<{ id: string; name: string; fileId: string; fileName: string; mimeType: string; size: number }> {
    const fileToUpload = customName && customName !== file.name
      ? new File([file], customName, { type: file.type || 'audio/mpeg' })
      : file;
    return await this.uploadAudio(fileToUpload, { songTitle: options?.title });
  }

  /**
   * Alias for fetchAudioBlob
   */
  static async downloadFileBlob(fileId: string): Promise<Blob> {
    return await this.fetchAudioBlob(fileId);
  }

  /**
   * Fetches the raw audio binary from Google Drive as a Blob
   */
  static async fetchAudioBlob(fileId: string): Promise<Blob> {
    const token = this.requireValidAccessToken(
      'Sesión de Google Drive no disponible. Inicia sesión como autor para acceder a esta maqueta.'
    );

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearCachedTokenOnly();
        throw new Error('Sesión de Google Drive expirada. Vuelve a iniciar sesión.');
      }
      if (response.status === 404) {
        throw new Error('El archivo de maqueta no fue encontrado en tu Google Drive.');
      }
      throw new Error(`Error al descargar la maqueta de Google Drive (código ${response.status}).`);
    }

    return await response.blob();
  }

  /**
   * Creates a playable Blob URL for audio elements
   */
  static async createAudioObjectUrl(fileId: string): Promise<string> {
    const blob = await this.fetchAudioBlob(fileId);
    return URL.createObjectURL(blob);
  }

  /**
   * Retrieves file metadata from Google Drive
   */
  static async getFileMetadata(fileId: string): Promise<GoogleDriveFile> {
    const token = this.requireValidAccessToken(
      'Inicia sesión en Google Drive para ver la información de la maqueta.'
    );

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,webViewLink`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        this.clearCachedTokenOnly();
        throw new Error('Sesión de Google Drive expirada. Vuelve a iniciar sesión.');
      }
      throw new Error(`No se pudo consultar el archivo de Google Drive (${response.status}).`);
    }

    return await response.json();
  }

  /**
   * Deletes a file from Google Drive.
   * NOTE: Destructive operation - Caller MUST display a user confirmation dialog first!
   */
  static async deleteFile(fileId: string): Promise<void> {
    const token = this.requireValidAccessToken(
      'Inicia sesión con Google Drive para eliminar la maqueta.'
    );

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      this.clearCachedTokenOnly();
      throw new Error('Sesión de Google Drive expirada. Vuelve a iniciar sesión.');
    }

    if (!response.ok && response.status !== 404) {
      throw new Error(`Error al eliminar archivo de Google Drive (${response.status}).`);
    }
  }
}
