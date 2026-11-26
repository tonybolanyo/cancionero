import crypto from 'crypto';
import type { Request } from 'express';

export const SESSION_COOKIE_NAME = 'cancionero_gh_session';
export const SESSION_DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const SESSION_REMEMBER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ServerAuthConfig {
  authorizedGithubUser: string;
  authorizedAuthorEmail: string;
  isProduction: boolean;
  isGithubConfigured: boolean;
  isEmailConfigured: boolean;
  usedDevFallback: boolean;
}

export interface SealedGitHubSession {
  token: string;
  login: string;
  user: {
    login: string;
    name: string;
    avatar_url: string;
    html_url: string;
    bio?: string;
    email?: string;
  };
  rememberMe: boolean;
  iat: number;
  exp: number;
}

const DEV_FALLBACK_GITHUB_USER = 'tonygb';
const DEV_FALLBACK_AUTHOR_EMAIL = 'tony@tonygb.com';

let inMemoryFallbackSecret: Buffer | null = null;

/**
 * Resolves authorized author identity strictly from environment variables in production.
 * In production (isProduction = true), NO hardcoded fallback values are ever permitted.
 */
export function resolveServerAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  isProduction: boolean = env.NODE_ENV === 'production'
): ServerAuthConfig {
  const envGithubUser = (env.AUTHORIZED_GITHUB_USER || env.VITE_GITHUB_ALLOWED_USER || '')
    .trim()
    .toLowerCase();
  const envAuthorEmail = (env.AUTHORIZED_AUTHOR_EMAIL || env.VITE_AUTHORIZED_AUTHOR_EMAIL || '')
    .trim()
    .toLowerCase();

  if (isProduction) {
    return {
      authorizedGithubUser: envGithubUser,
      authorizedAuthorEmail: envAuthorEmail,
      isProduction: true,
      isGithubConfigured: Boolean(envGithubUser),
      isEmailConfigured: Boolean(envAuthorEmail),
      usedDevFallback: false
    };
  }

  const usedDevFallback = !envGithubUser || !envAuthorEmail;
  return {
    authorizedGithubUser: envGithubUser || DEV_FALLBACK_GITHUB_USER,
    authorizedAuthorEmail: envAuthorEmail || DEV_FALLBACK_AUTHOR_EMAIL,
    isProduction: false,
    isGithubConfigured: Boolean(envGithubUser || DEV_FALLBACK_GITHUB_USER),
    isEmailConfigured: Boolean(envAuthorEmail || DEV_FALLBACK_AUTHOR_EMAIL),
    usedDevFallback
  };
}

export function resolveSessionSecretKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const configured = env.AUTH_SESSION_SECRET?.trim();
  if (configured) {
    return crypto.createHash('sha256').update(configured, 'utf8').digest();
  }
  if (!inMemoryFallbackSecret) {
    inMemoryFallbackSecret = crypto.randomBytes(32);
  }
  return inMemoryFallbackSecret;
}

export function sealSessionPayload(payload: SealedGitHubSession, secretKey: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey, iv);
  const serialized = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url')
  ].join('.');
}

export function unsealSessionPayload(
  rawCookieValue: string | undefined | null,
  secretKey: Buffer
): SealedGitHubSession | null {
  if (!rawCookieValue || typeof rawCookieValue !== 'string') {
    return null;
  }

  const parts = rawCookieValue.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    return null;
  }

  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const authTag = Buffer.from(parts[2], 'base64url');
    const ciphertext = Buffer.from(parts[3], 'base64url');

    if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
      return null;
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted) as SealedGitHubSession;

    if (
      !parsed ||
      typeof parsed.token !== 'string' ||
      !parsed.token ||
      typeof parsed.login !== 'string' ||
      typeof parsed.exp !== 'number' ||
      Date.now() >= parsed.exp
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return result;
  }

  for (const segment of cookieHeader.split(';')) {
    const eqIdx = segment.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = segment.slice(0, eqIdx).trim();
    const rawVal = segment.slice(eqIdx + 1).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(rawVal);
    } catch {
      result[name] = rawVal;
    }
  }

  return result;
}

function isTrustworthyContext(req: Pick<Request, 'secure' | 'headers' | 'hostname'>): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const hostname = (req.hostname || hostHeader.split(':')[0] || '').toLowerCase();
  return Boolean(
    req.secure ||
    forwardedProto === 'https' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

export function buildSessionCookieHeader(
  sealedValue: string,
  options: {
    rememberMe?: boolean;
    maxAgeSeconds?: number;
    req?: Pick<Request, 'secure' | 'headers' | 'hostname'>;
  } = {}
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sealedValue)}`,
    'Path=/',
    'HttpOnly'
  ];

  if (options.rememberMe && typeof options.maxAgeSeconds === 'number' && options.maxAgeSeconds > 0) {
    parts.push(`Max-Age=${Math.floor(options.maxAgeSeconds)}`);
  }

  const secureContext = options.req ? isTrustworthyContext(options.req) : true;
  if (secureContext) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }

  return parts.join('; ');
}

export function buildClearSessionCookieHeader(
  req?: Pick<Request, 'secure' | 'headers' | 'hostname'>
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];

  const secureContext = req ? isTrustworthyContext(req) : true;
  if (secureContext) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }

  return parts.join('; ');
}

/**
 * Verifies same-origin / custom-header CSRF protection for cookie-authenticated state-changing requests.
 */
export function verifyCsrfRequest(req: Pick<Request, 'headers'>): { ok: boolean; reason?: string } {
  const requestedWith = String(req.headers['x-requested-with'] || '').trim();
  if (!requestedWith) {
    return { ok: false, reason: 'Cabecera anti-CSRF X-Requested-With requerida.' };
  }

  const originHeader = String(req.headers.origin || '').trim();
  if (originHeader) {
    const expectedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();

    if (expectedHost) {
      try {
        const originUrl = new URL(originHeader);
        if (originUrl.host.toLowerCase() !== expectedHost) {
          return { ok: false, reason: 'Origen de solicitud no coincide con el host del servidor.' };
        }
      } catch {
        return { ok: false, reason: 'Cabecera Origin inválida.' };
      }
    }
  }

  return { ok: true };
}

const ALLOWED_REPO_NAME_REGEX = /^[a-zA-Z0-9._-]{1,100}$/;
const ALLOWED_BRANCH_REGEX = /^[a-zA-Z0-9._/-]{1,120}$/;
const ALLOWED_SONG_MD_PATH_REGEX = /^songs\/[a-zA-Z0-9_-]{1,140}\.md$/;

export function validateSafeRepoTarget(
  owner: unknown,
  repo: unknown,
  branch: unknown,
  authorizedGithubUser: string
): { valid: true; owner: string; repo: string; branch: string } | { valid: false; error: string } {
  const cleanOwner = typeof owner === 'string' ? owner.trim().toLowerCase() : '';
  const cleanRepo = typeof repo === 'string' ? repo.trim() : '';
  const cleanBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : 'main';

  if (!authorizedGithubUser) {
    return { valid: false, error: 'AUTHORIZED_GITHUB_USER no está configurado en el servidor.' };
  }

  if (!cleanOwner || cleanOwner !== authorizedGithubUser) {
    return { valid: false, error: 'El propietario del repositorio remoto no coincide con el autor autorizado.' };
  }

  if (!ALLOWED_REPO_NAME_REGEX.test(cleanRepo) || cleanRepo === '.' || cleanRepo === '..') {
    return { valid: false, error: 'Nombre de repositorio inválido.' };
  }

  if (!ALLOWED_BRANCH_REGEX.test(cleanBranch) || cleanBranch.includes('..') || cleanBranch.startsWith('/')) {
    return { valid: false, error: 'Nombre de rama Git inválido.' };
  }

  return { valid: true, owner: cleanOwner, repo: cleanRepo, branch: cleanBranch };
}

export function validateSafeGitHubRepoPath(filePath: unknown): filePath is string {
  if (typeof filePath !== 'string') return false;
  const trimmed = filePath.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('\\')) {
    return false;
  }
  if (trimmed === 'catalog.json' || trimmed === 'albums.json') {
    return true;
  }
  return ALLOWED_SONG_MD_PATH_REGEX.test(trimmed);
}
