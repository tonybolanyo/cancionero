/**
 * Configuration for Author Authentication via GitHub
 * 
 * In a static website deployed on GitHub Pages:
 * - NO private secrets, passwords, or tokens are ever stored in the repository.
 * - The authorized GitHub username is configured here (or via VITE_GITHUB_ALLOWED_USER in build env).
 * - Only personal access tokens belonging to this exact GitHub user will be accepted.
 * - If any other GitHub account enters their token, authentication is strictly rejected by verifying
 *   the authenticated profile against the official GitHub REST API (https://api.github.com/user).
 */

const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      return (import.meta as any).env[key];
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch {}
  return undefined;
};

export const AUTHORIZED_GITHUB_USER: string = (
  getEnvVar('VITE_GITHUB_ALLOWED_USER') || 'tonygb'
).trim().toLowerCase();

export const AUTHORIZED_AUTHOR_EMAIL: string = (
  getEnvVar('VITE_AUTHORIZED_AUTHOR_EMAIL') || 'tony@tonygb.com'
).trim().toLowerCase();

const AUTH_STORAGE_KEY = 'tony_cancionero_github_auth_v2';

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
 * Safely validates whether the current browser session has a valid author authentication token
 */
export function isStoredSessionAuthorized(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    const rawSession = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) return false;

    const parsed = JSON.parse(rawSession);
    if (!parsed || !parsed.isAuthenticated || !parsed.token) return false;

    return isAuthorizedAuthorLogin(parsed.user?.login);
  } catch {
    return false;
  }
}

/**
 * Retrieves the stored author authentication token from sessionStorage or localStorage
 */
export function getStoredAuthorToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.isAuthenticated && isAuthorizedAuthorLogin(parsed.user?.login) && parsed.token) {
      return parsed.token;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Validates that an external URL uses a safe web protocol (https: or http:)
 * preventing javascript:, data:, or vbscript: injection attacks.
 */
export function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

