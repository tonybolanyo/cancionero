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

// Scope for Google Drive file access
export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

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

// In-memory token cache (NEVER persisted to localStorage/sessionStorage as required)
let cachedAccessToken: string | null = null;
let isSigningIn = false;
let firebaseAppInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

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

export class GoogleDriveService {
  /**
   * Initializes the auth state listener. Clears memory token on signout.
   */
  static initAuth(
    onSuccess?: (user: User, token: string) => void,
    onFailure?: () => void
  ) {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user && cachedAccessToken) {
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onFailure) onFailure();
      }
    });
  }

  /**
   * Returns current in-memory access token
   */
  static getAccessToken(): string | null {
    return cachedAccessToken;
  }

  /**
   * Signs in with Google Popup and requests Drive file scope
   */
  static async signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
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

      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    } finally {
      isSigningIn = false;
    }
  }

  /**
   * Signs out from Google and clears in-memory token
   */
  static async signOut(): Promise<void> {
    const auth = getFirebaseAuth();
    await signOut(auth);
    cachedAccessToken = null;
  }

  /**
   * Checks if user has an active Google Drive session with valid in-memory token
   */
  static isConnected(): boolean {
    return Boolean(cachedAccessToken);
  }

  /**
   * Uploads an audio file directly to Google Drive via multipart upload
   */
  static async uploadAudio(
    file: File,
    options?: { songTitle?: string; description?: string }
  ): Promise<GoogleDriveUploadResult> {
    const token = cachedAccessToken;
    if (!token) {
      throw new Error('No has iniciado sesión con Google Drive. Inicia sesión para guardar tu maqueta.');
    }

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
        cachedAccessToken = null;
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
    const token = cachedAccessToken;
    if (!token) {
      throw new Error('No has iniciado sesión con Google Drive. Inicia sesión para guardar tu vídeo.');
    }

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
        cachedAccessToken = null;
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
    const token = cachedAccessToken;
    if (!token) {
      throw new Error('Sesión de Google Drive no disponible. Inicia sesión como autor para acceder a esta maqueta.');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        cachedAccessToken = null;
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
    const token = cachedAccessToken;
    if (!token) {
      throw new Error('Inicia sesión en Google Drive para ver la información de la maqueta.');
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,webViewLink`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`No se pudo consultar el archivo de Google Drive (${response.status}).`);
    }

    return await response.json();
  }

  /**
   * Deletes a file from Google Drive.
   * NOTE: Destructive operation - Caller MUST display a user confirmation dialog first!
   */
  static async deleteFile(fileId: string): Promise<void> {
    const token = cachedAccessToken;
    if (!token) {
      throw new Error('Inicia sesión con Google Drive para eliminar la maqueta.');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Error al eliminar archivo de Google Drive (${response.status}).`);
    }
  }
}
