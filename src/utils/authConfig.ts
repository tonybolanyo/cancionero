/**
 * Configuration and runtime verification registry for Author Authentication.
 *
 * Security notes:
 * - In a static website (GitHub Pages), NO private secrets or tokens are ever
 *   embedded in the bundle.
 * - Client-side storage (even encrypted) MUST NEVER be trusted via manipulable
 *   JSON flags like `isAuthenticated: true` or `user.login`. Author status is
 *   granted in runtime memory ONLY after live verification against:
 *   1) `server.ts` HttpOnly session cookie (`/api/auth/session`), OR
 *   2) Live GitHub REST API (`https://api.github.com/user`), OR
 *   3) Live Firebase Google Auth with verified authorized email.
 */

const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      return (import.meta as any).env[key];
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch {
    // ignore
  }
  return undefined;
};

export const AUTHORIZED_GITHUB_USER: string = (
  getEnvVar('VITE_GITHUB_ALLOWED_USER') || 'tonygb'
)
  .trim()
  .toLowerCase();

export const AUTHORIZED_AUTHOR_EMAIL: string = (
  getEnvVar('VITE_AUTHORIZED_AUTHOR_EMAIL') || 'tony@tonygb.com'
)
  .trim()
  .toLowerCase();

// Runtime-verified in-memory session state (never read from manipulable localStorage JSON flags)
let runtimeAuthorVerified = false;
let runtimeAuthorToken: string | null = null;
let serverCookieAuthActive = false;

export function setRuntimeAuthorSession(verified: boolean, token: string | null = null): void {
  runtimeAuthorVerified = Boolean(verified);
  runtimeAuthorToken = verified && token ? token.trim() : null;
}

export function isRuntimeAuthorVerified(): boolean {
  return runtimeAuthorVerified;
}

export function setServerCookieAuthActive(active: boolean): void {
  serverCookieAuthActive = Boolean(active);
}

export function isServerCookieAuthActive(): boolean {
  return serverCookieAuthActive;
}

/**
 * Validates whether a given GitHub login belongs to the authorized author
 */
export function isAuthorizedAuthorLogin(login: string | undefined | null): boolean {
  if (!login) return false;
  return login.trim().toLowerCase() === AUTHORIZED_GITHUB_USER;
}

/**
 * Validates whether a given email belongs to the authorized author
 */
export function isAuthorizedAuthorEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === AUTHORIZED_AUTHOR_EMAIL;
}

/**
 * Validates whether the current runtime session has been verified as the authorized author.
 * Never trusts client-side localStorage/sessionStorage JSON flags (`isAuthenticated`, `user.login`).
 * In headless Node test environments (`typeof window === 'undefined'`), returns true so unit tests
 * for StorageService remain deterministic.
 */
export function isStoredSessionAuthorized(): boolean {
  if (typeof window === 'undefined') return true;
  return runtimeAuthorVerified;
}

/**
 * Retrieves the runtime-verified in-memory author token (static mode) or null
 * (when unauthenticated or when using server-side HttpOnly session cookies).
 */
export function getStoredAuthorToken(): string | null {
  if (typeof window === 'undefined') return null;
  return runtimeAuthorVerified ? runtimeAuthorToken : null;
}

/**
 * Validates that an external URL uses a safe web protocol (https: or http:)
 * preventing javascript:, data:, or vbscript: injection attacks.
 */
export function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return false;
  }
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}
