/**
 * Client-side encrypted token vault for static (GitHub Pages) deployments
 * and short-lived Google Drive OAuth session persistence.
 *
 * Security properties:
 * - Never stores Personal Access Tokens or OAuth tokens in plaintext.
 * - Uses Web Crypto AES-256-GCM when available, backed by a non-extractable
 *   CryptoKey stored in IndexedDB (`cancionero-auth-vault`) or an origin-scoped
 *   ephemeral wrapping key fallback.
 * - Enforces explicit `expiresAt` expiration on every stored record.
 * - Stores ZERO authorization trust flags (`isAuthenticated`, `isAuthor`, `login`):
 *   session validity is always verified live before granting author privileges.
 */

export const GITHUB_VAULT_KEY = 'tony_cancionero_gh_vault_v3';
export const LEGACY_GITHUB_AUTH_KEY = 'tony_cancionero_github_auth_v2';
export const GOOGLE_DRIVE_VAULT_KEY = 'tony_cancionero_gdrive_vault_v1';

const KEY_DB_NAME = 'cancionero-auth-vault';
const KEY_DB_VERSION = 1;
const KEY_STORE_NAME = 'crypto-keys';
const VAULT_KEY_ID = 'aes-gcm-master-v1';

// 12 hours for default sessionStorage tab-scoped sessions; 7 days for explicit "remember me"
export const SESSION_GITHUB_TTL_MS = 12 * 60 * 60 * 1000;
export const PERSISTENT_GITHUB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface VaultEnvelope {
  v: 3;
  alg: 'AES-GCM';
  iv: string;
  ct: string;
  expiresAt: number;
  persistent: boolean;
}

export interface StoredDrivePayload {
  accessToken: string;
  expiresAt: number;
  uid: string;
  email: string | null;
}

let memoryFallbackKey: CryptoKey | null = null;
let cachedIdbKeyPromise: Promise<CryptoKey | null> | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hasWebCrypto(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    Boolean(globalThis.crypto?.subtle) &&
    typeof globalThis.crypto.getRandomValues === 'function'
  );
}

function getStorageArea(persistent: boolean): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return persistent ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

async function getOrCreateIndexedDbKey(): Promise<CryptoKey | null> {
  if (!hasWebCrypto() || typeof indexedDB === 'undefined') {
    return null;
  }

  if (cachedIdbKeyPromise) {
    return cachedIdbKeyPromise;
  }

  cachedIdbKeyPromise = (async () => {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(KEY_DB_NAME, KEY_DB_VERSION);
        req.onupgradeneeded = () => {
          const database = req.result;
          if (!database.objectStoreNames.contains(KEY_STORE_NAME)) {
            database.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB key vault error'));
      });

      try {
        const existing = await new Promise<CryptoKey | null>((resolve) => {
          const tx = db.transaction(KEY_STORE_NAME, 'readonly');
          const store = tx.objectStore(KEY_STORE_NAME);
          const getReq = store.get(VAULT_KEY_ID);
          getReq.onsuccess = () => resolve(getReq.result?.key ?? null);
          getReq.onerror = () => resolve(null);
        });

        if (existing) {
          return existing;
        }

        const generated = await globalThis.crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable CryptoKey
          ['encrypt', 'decrypt']
        );

        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
          const store = tx.objectStore(KEY_STORE_NAME);
          store.put({ id: VAULT_KEY_ID, key: generated, createdAt: Date.now() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error('Failed storing vault key'));
        });

        return generated;
      } finally {
        db.close();
      }
    } catch {
      return null;
    }
  })();

  const resolved = await cachedIdbKeyPromise;
  if (!resolved) {
    cachedIdbKeyPromise = null;
  }
  return resolved;
}

async function getFallbackCryptoKey(): Promise<CryptoKey | null> {
  if (!hasWebCrypto()) return null;
  if (memoryFallbackKey) return memoryFallbackKey;

  try {
    // Derive a per-origin/session key when IndexedDB CryptoKey storage is unavailable
    const originSeed =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'cancionero-static-vault';

    let sessionSaltB64: string | null = null;
    try {
      const ss = getStorageArea(false);
      if (ss) {
        sessionSaltB64 = ss.getItem('tony_cancionero_vault_salt_v1');
        if (!sessionSaltB64) {
          const saltBytes = new Uint8Array(16);
          globalThis.crypto.getRandomValues(saltBytes);
          sessionSaltB64 = toBase64(saltBytes);
          ss.setItem('tony_cancionero_vault_salt_v1', sessionSaltB64);
        }
      }
    } catch {
      // ignore storage errors
    }

    const materialInput = new TextEncoder().encode(`${originSeed}:${sessionSaltB64 || 'ephemeral'}`);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', materialInput);
    memoryFallbackKey = await globalThis.crypto.subtle.importKey(
      'raw',
      digest,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    return memoryFallbackKey;
  } catch {
    return null;
  }
}

async function getVaultKey(): Promise<CryptoKey | null> {
  const idbKey = await getOrCreateIndexedDbKey();
  if (idbKey) return idbKey;
  return getFallbackCryptoKey();
}

export async function encryptVaultString(
  plaintext: string,
  options: { persistent: boolean; ttlMs: number }
): Promise<VaultEnvelope> {
  if (!hasWebCrypto()) {
    throw new Error('Web Crypto API (AES-GCM) no está disponible en este contexto.');
  }

  const key = await getVaultKey();
  if (!key) {
    throw new Error('No se pudo inicializar la clave de cifrado local.');
  }

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(plaintext);

  const encryptedBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    v: 3,
    alg: 'AES-GCM',
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(encryptedBuf)),
    expiresAt: Date.now() + options.ttlMs,
    persistent: options.persistent
  };
}

export async function decryptVaultString(envelope: unknown): Promise<string | null> {
  if (!envelope || typeof envelope !== 'object') return null;
  const candidate = envelope as Partial<VaultEnvelope>;

  if (
    candidate.v !== 3 ||
    candidate.alg !== 'AES-GCM' ||
    typeof candidate.iv !== 'string' ||
    typeof candidate.ct !== 'string' ||
    typeof candidate.expiresAt !== 'number'
  ) {
    return null;
  }

  if (Date.now() >= candidate.expiresAt) {
    return null;
  }

  if (!hasWebCrypto()) return null;
  const key = await getVaultKey();
  if (!key) return null;

  try {
    const iv = fromBase64(candidate.iv);
    const ct = fromBase64(candidate.ct);
    const decryptedBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ct)
    );
    return new TextDecoder().decode(decryptedBuf);
  } catch {
    return null;
  }
}

export function clearLegacyPlaintextGitHubAuth(): void {
  try {
    getStorageArea(false)?.removeItem(LEGACY_GITHUB_AUTH_KEY);
    getStorageArea(true)?.removeItem(LEGACY_GITHUB_AUTH_KEY);
  } catch {
    // ignore
  }
}

/**
 * Reads and removes any legacy plaintext GitHub PAT stored prior to CAL-07
 * so it can be migrated cleanly into encrypted storage or an HttpOnly cookie.
 */
export function consumeLegacyPlaintextGitHubAuth(): { token: string; rememberMe: boolean } | null {
  try {
    const ss = getStorageArea(false);
    const ls = getStorageArea(true);
    const rawSession = ss?.getItem(LEGACY_GITHUB_AUTH_KEY);
    const rawLocal = ls?.getItem(LEGACY_GITHUB_AUTH_KEY);
    const raw = rawSession || rawLocal;
    const rememberMe = Boolean(!rawSession && rawLocal);

    clearLegacyPlaintextGitHubAuth();

    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && parsed.token.trim()) {
      return { token: parsed.token.trim(), rememberMe };
    }
    return null;
  } catch {
    clearLegacyPlaintextGitHubAuth();
    return null;
  }
}

export async function saveEncryptedGitHubToken(
  token: string,
  rememberMe: boolean
): Promise<boolean> {
  const clean = token.trim();
  if (!clean) return false;

  clearEncryptedGitHubToken();
  clearLegacyPlaintextGitHubAuth();

  const ttlMs = rememberMe ? PERSISTENT_GITHUB_TTL_MS : SESSION_GITHUB_TTL_MS;
  const targetStorage = getStorageArea(rememberMe);
  if (!targetStorage) return false;

  try {
    const payload = JSON.stringify({ token: clean });
    const envelope = await encryptVaultString(payload, { persistent: rememberMe, ttlMs });
    targetStorage.setItem(GITHUB_VAULT_KEY, JSON.stringify(envelope));
    return true;
  } catch (err) {
    console.warn('Could not persist encrypted GitHub token:', err);
    return false;
  }
}

export async function loadEncryptedGitHubToken(): Promise<{
  token: string;
  persistent: boolean;
  expiresAt: number;
} | null> {
  const checks: Array<{ storage: Storage | null; persistent: boolean }> = [
    { storage: getStorageArea(false), persistent: false },
    { storage: getStorageArea(true), persistent: true }
  ];

  for (const { storage, persistent } of checks) {
    if (!storage) continue;
    try {
      const raw = storage.getItem(GITHUB_VAULT_KEY);
      if (!raw) continue;
      const envelope = JSON.parse(raw) as VaultEnvelope;
      const decrypted = await decryptVaultString(envelope);
      if (!decrypted) {
        storage.removeItem(GITHUB_VAULT_KEY);
        continue;
      }
      const parsed = JSON.parse(decrypted);
      if (parsed && typeof parsed.token === 'string' && parsed.token.trim()) {
        return {
          token: parsed.token.trim(),
          persistent,
          expiresAt: envelope.expiresAt
        };
      }
      storage.removeItem(GITHUB_VAULT_KEY);
    } catch {
      storage.removeItem(GITHUB_VAULT_KEY);
    }
  }

  return null;
}

export function clearEncryptedGitHubToken(): void {
  try {
    getStorageArea(false)?.removeItem(GITHUB_VAULT_KEY);
    getStorageArea(true)?.removeItem(GITHUB_VAULT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Saves a short-lived Google Drive OAuth token exclusively in sessionStorage
 * (encrypted with AES-GCM) so page reloads preserve Drive access without popups
 * while clearing automatically when the tab/browser closes.
 */
export async function saveEncryptedDriveSession(payload: StoredDrivePayload): Promise<boolean> {
  const ss = getStorageArea(false);
  if (!ss || !payload.accessToken || !payload.uid) return false;

  const remainingMs = payload.expiresAt - Date.now();
  if (remainingMs <= 0) {
    clearEncryptedDriveSession();
    return false;
  }

  try {
    const envelope = await encryptVaultString(JSON.stringify(payload), {
      persistent: false,
      ttlMs: remainingMs
    });
    ss.setItem(GOOGLE_DRIVE_VAULT_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export async function loadEncryptedDriveSession(expectedUid?: string): Promise<StoredDrivePayload | null> {
  const ss = getStorageArea(false);
  if (!ss) return null;

  try {
    const raw = ss.getItem(GOOGLE_DRIVE_VAULT_KEY);
    if (!raw) return null;

    const envelope = JSON.parse(raw) as VaultEnvelope;
    const decrypted = await decryptVaultString(envelope);
    if (!decrypted) {
      ss.removeItem(GOOGLE_DRIVE_VAULT_KEY);
      return null;
    }

    const parsed = JSON.parse(decrypted) as StoredDrivePayload;
    if (
      !parsed ||
      typeof parsed.accessToken !== 'string' ||
      !parsed.accessToken ||
      typeof parsed.expiresAt !== 'number' ||
      Date.now() >= parsed.expiresAt
    ) {
      ss.removeItem(GOOGLE_DRIVE_VAULT_KEY);
      return null;
    }

    if (expectedUid && parsed.uid !== expectedUid) {
      return null;
    }

    return parsed;
  } catch {
    ss.removeItem(GOOGLE_DRIVE_VAULT_KEY);
    return null;
  }
}

export function clearEncryptedDriveSession(): void {
  try {
    getStorageArea(false)?.removeItem(GOOGLE_DRIVE_VAULT_KEY);
  } catch {
    // ignore
  }
}

export function resetVaultCacheForTesting(): void {
  memoryFallbackKey = null;
  cachedIdbKeyPromise = null;
}
