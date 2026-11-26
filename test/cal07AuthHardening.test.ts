import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveServerAuthConfig,
  resolveSessionSecretKey,
  sealSessionPayload,
  unsealSessionPayload,
  parseCookies,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
  verifyCsrfRequest,
  validateSafeRepoTarget,
  validateSafeGitHubRepoPath,
  SESSION_COOKIE_NAME,
  type SealedGitHubSession
} from '../src/lib/server/authSession';
import {
  GITHUB_VAULT_KEY,
  LEGACY_GITHUB_AUTH_KEY,
  GOOGLE_DRIVE_VAULT_KEY,
  saveEncryptedGitHubToken,
  loadEncryptedGitHubToken,
  clearEncryptedGitHubToken,
  consumeLegacyPlaintextGitHubAuth,
  saveEncryptedDriveSession,
  loadEncryptedDriveSession,
  clearEncryptedDriveSession,
  resetVaultCacheForTesting
} from '../src/utils/tokenVault';
import {
  isStoredSessionAuthorized,
  getStoredAuthorToken,
  setRuntimeAuthorSession,
  setServerCookieAuthActive,
  isServerCookieAuthActive
} from '../src/utils/authConfig';
import { GoogleDriveService, TOKEN_EXPIRY_BUFFER_MS } from '../src/services/googleDriveService';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const originalWindow = (globalThis as any).window;

function installMockBrowserWindow(): { localStorage: MemoryStorage; sessionStorage: MemoryStorage } {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  (globalThis as any).window = {
    location: { origin: 'https://cancionero.example.com' },
    localStorage,
    sessionStorage
  };
  return { localStorage, sessionStorage };
}

afterEach(() => {
  setRuntimeAuthorSession(false, null);
  setServerCookieAuthActive(false);
  GoogleDriveService.clearCachedTokenOnly();
  clearEncryptedGitHubToken();
  clearEncryptedDriveSession();
  resetVaultCacheForTesting();
  (globalThis as any).window = originalWindow;
});

describe('CAL-07: Server auth configuration and fail-closed production enforcement', () => {
  it('disallows hardcoded fallback author credentials in production mode', () => {
    const prodEmpty = resolveServerAuthConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv, true);
    assert.equal(prodEmpty.isProduction, true);
    assert.equal(prodEmpty.isGithubConfigured, false);
    assert.equal(prodEmpty.isEmailConfigured, false);
    assert.equal(prodEmpty.authorizedGithubUser, '');
    assert.equal(prodEmpty.authorizedAuthorEmail, '');
    assert.equal(prodEmpty.usedDevFallback, false);
  });

  it('resolves AUTHORIZED_GITHUB_USER and AUTHORIZED_AUTHOR_EMAIL cleanly from env in production', () => {
    const prodConfigured = resolveServerAuthConfig(
      {
        NODE_ENV: 'production',
        AUTHORIZED_GITHUB_USER: '  TonyGB ',
        AUTHORIZED_AUTHOR_EMAIL: '  Tony@TonyGB.com '
      } as unknown as NodeJS.ProcessEnv,
      true
    );
    assert.equal(prodConfigured.isGithubConfigured, true);
    assert.equal(prodConfigured.isEmailConfigured, true);
    assert.equal(prodConfigured.authorizedGithubUser, 'tonygb');
    assert.equal(prodConfigured.authorizedAuthorEmail, 'tony@tonygb.com');
    assert.equal(prodConfigured.usedDevFallback, false);
  });

  it('flags dev fallback when env vars are absent outside production', () => {
    const devEmpty = resolveServerAuthConfig({ NODE_ENV: 'development' } as NodeJS.ProcessEnv, false);
    assert.equal(devEmpty.isProduction, false);
    assert.equal(devEmpty.usedDevFallback, true);
    assert.ok(devEmpty.authorizedGithubUser.length > 0);
    assert.ok(devEmpty.authorizedAuthorEmail.length > 0);
  });
});

describe('CAL-07: Sealed HttpOnly session cookies, CSRF & path validation', () => {
  const secretKey = resolveSessionSecretKey({ AUTH_SESSION_SECRET: 'cal07-test-secret-material' } as NodeJS.ProcessEnv);

  const samplePayload: SealedGitHubSession = {
    token: 'ghp_super_secret_token_value',
    login: 'tonygb',
    user: {
      login: 'tonygb',
      name: 'Tony',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
      html_url: 'https://github.com/tonygb'
    },
    rememberMe: false,
    iat: Date.now(),
    exp: Date.now() + 60_000
  };

  it('seals and unseals valid session payloads and rejects tampering/expiration/wrong keys', () => {
    const sealed = sealSessionPayload(samplePayload, secretKey);
    assert.equal(sealed.includes('ghp_super_secret_token_value'), false);

    const parsed = unsealSessionPayload(sealed, secretKey);
    assert.ok(parsed);
    assert.equal(parsed.token, samplePayload.token);
    assert.equal(parsed.login, 'tonygb');

    // Wrong key
    const wrongKey = resolveSessionSecretKey({ AUTH_SESSION_SECRET: 'wrong-secret' } as NodeJS.ProcessEnv);
    assert.equal(unsealSessionPayload(sealed, wrongKey), null);

    // Tampered ciphertext
    const parts = sealed.split('.');
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
    assert.equal(unsealSessionPayload(parts.join('.'), secretKey), null);

    // Expired session
    const expired = sealSessionPayload({ ...samplePayload, exp: Date.now() - 1000 }, secretKey);
    assert.equal(unsealSessionPayload(expired, secretKey), null);
  });

  it('builds HttpOnly cookie headers appropriately for HTTPS and plain HTTP', () => {
    const sealed = sealSessionPayload(samplePayload, secretKey);
    const httpsCookie = buildSessionCookieHeader(sealed, {
      rememberMe: true,
      maxAgeSeconds: 3600,
      req: { secure: true, headers: { host: 'cancionero.example.com' }, hostname: 'cancionero.example.com' }
    });
    assert.match(httpsCookie, new RegExp(`^${SESSION_COOKIE_NAME}=`));
    assert.match(httpsCookie, /\bHttpOnly\b/);
    assert.match(httpsCookie, /\bSecure\b/);
    assert.match(httpsCookie, /\bSameSite=None\b/);
    assert.match(httpsCookie, /\bPartitioned\b/);
    assert.match(httpsCookie, /\bMax-Age=3600\b/);

    const plainHttpCookie = buildSessionCookieHeader(sealed, {
      rememberMe: false,
      req: { secure: false, headers: { host: '192.168.1.50:3000' }, hostname: '192.168.1.50' }
    });
    assert.match(plainHttpCookie, /\bHttpOnly\b/);
    assert.match(plainHttpCookie, /\bSameSite=Lax\b/);
    assert.doesNotMatch(plainHttpCookie, /\bSecure\b/);

    const parsedCookies = parseCookies(`foo=bar; ${SESSION_COOKIE_NAME}=${encodeURIComponent(sealed)}`);
    assert.equal(parsedCookies[SESSION_COOKIE_NAME], sealed);

    const clearHeader = buildClearSessionCookieHeader({
      secure: true,
      headers: { host: 'localhost:3000' },
      hostname: 'localhost'
    });
    assert.match(clearHeader, /\bMax-Age=0\b/);
    assert.match(clearHeader, /\bHttpOnly\b/);
  });

  it('verifies anti-CSRF header and matching Origin host', () => {
    assert.equal(verifyCsrfRequest({ headers: {} }).ok, false);
    assert.equal(
      verifyCsrfRequest({
        headers: {
          'x-requested-with': 'cancionero-client',
          origin: 'https://evil.example.com',
          host: 'cancionero.example.com'
        }
      }).ok,
      false
    );
    assert.equal(
      verifyCsrfRequest({
        headers: {
          'x-requested-with': 'cancionero-client',
          origin: 'https://cancionero.example.com',
          host: 'cancionero.example.com'
        }
      }).ok,
      true
    );
  });

  it('validates safe GitHub repo targets and path allowlist', () => {
    assert.equal(validateSafeRepoTarget('otheruser', 'cancionero', 'main', 'tonygb').valid, false);
    assert.equal(validateSafeRepoTarget('tonygb', '../etc', 'main', 'tonygb').valid, false);
    assert.equal(validateSafeRepoTarget('tonygb', 'cancionero', '../main', 'tonygb').valid, false);
    assert.equal(validateSafeRepoTarget('TonyGB', 'cancionero', 'main', 'tonygb').valid, true);

    assert.equal(validateSafeGitHubRepoPath('catalog.json'), true);
    assert.equal(validateSafeGitHubRepoPath('albums.json'), true);
    assert.equal(validateSafeGitHubRepoPath('songs/mi-cancion-1.md'), true);
    assert.equal(validateSafeGitHubRepoPath('../.env'), false);
    assert.equal(validateSafeGitHubRepoPath('server.ts'), false);
    assert.equal(validateSafeGitHubRepoPath('songs/nested/hack.md'), false);
  });
});

describe('CAL-07: Encrypted static token vault & anti-spoofing client guards', () => {
  it('encrypts GitHub PAT into sessionStorage by default without plaintext or trust flags', async () => {
    const { localStorage, sessionStorage } = installMockBrowserWindow();

    const saved = await saveEncryptedGitHubToken('ghp_static_secret_pat_12345', false);
    assert.equal(saved, true);

    const rawSession = sessionStorage.getItem(GITHUB_VAULT_KEY);
    assert.ok(rawSession, 'Token should be saved in sessionStorage');
    assert.equal(localStorage.getItem(GITHUB_VAULT_KEY), null, 'Default mode must not write localStorage');

    assert.equal(rawSession.includes('ghp_static_secret_pat_12345'), false);
    assert.equal(rawSession.includes('isAuthenticated'), false);
    assert.equal(rawSession.includes('"login"'), false);

    const parsedEnvelope = JSON.parse(rawSession);
    assert.equal(parsedEnvelope.alg, 'AES-GCM');
    assert.equal(parsedEnvelope.persistent, false);

    const loaded = await loadEncryptedGitHubToken();
    assert.ok(loaded);
    assert.equal(loaded.token, 'ghp_static_secret_pat_12345');
    assert.equal(loaded.persistent, false);
  });

  it('stores persistent token in localStorage when rememberMe=true and rejects tampered or expired envelopes', async () => {
    const { localStorage, sessionStorage } = installMockBrowserWindow();

    await saveEncryptedGitHubToken('ghp_persistent_pat_67890', true);
    assert.equal(sessionStorage.getItem(GITHUB_VAULT_KEY), null);
    assert.ok(localStorage.getItem(GITHUB_VAULT_KEY));

    const loaded = await loadEncryptedGitHubToken();
    assert.ok(loaded);
    assert.equal(loaded.token, 'ghp_persistent_pat_67890');
    assert.equal(loaded.persistent, true);

    // Tamper ciphertext -> returns null and clears entry
    const env = JSON.parse(localStorage.getItem(GITHUB_VAULT_KEY)!);
    env.ct = env.ct.slice(0, -2) + (env.ct.endsWith('AA') ? 'BB' : 'AA');
    localStorage.setItem(GITHUB_VAULT_KEY, JSON.stringify(env));
    assert.equal(await loadEncryptedGitHubToken(), null);
    assert.equal(localStorage.getItem(GITHUB_VAULT_KEY), null);

    // Expired TTL -> returns null and clears entry
    await saveEncryptedGitHubToken('ghp_expiring_pat', false);
    const ssEnv = JSON.parse(sessionStorage.getItem(GITHUB_VAULT_KEY)!);
    ssEnv.expiresAt = Date.now() - 5000;
    sessionStorage.setItem(GITHUB_VAULT_KEY, JSON.stringify(ssEnv));
    assert.equal(await loadEncryptedGitHubToken(), null);
    assert.equal(sessionStorage.getItem(GITHUB_VAULT_KEY), null);
  });

  it('consumes and wipes legacy plaintext GitHub auth storage', () => {
    const { localStorage } = installMockBrowserWindow();
    localStorage.setItem(
      LEGACY_GITHUB_AUTH_KEY,
      JSON.stringify({ isAuthenticated: true, token: 'ghp_legacy_plain', user: { login: 'tonygb' } })
    );

    const consumed = consumeLegacyPlaintextGitHubAuth();
    assert.deepEqual(consumed, { token: 'ghp_legacy_plain', rememberMe: true });
    assert.equal(localStorage.getItem(LEGACY_GITHUB_AUTH_KEY), null);
  });

  it('ignores manipulable localStorage/sessionStorage JSON flags in isStoredSessionAuthorized()', () => {
    const { localStorage, sessionStorage } = installMockBrowserWindow();

    // Attacker writes forged flags in both storages
    const forgedPayload = JSON.stringify({
      isAuthenticated: true,
      isAuthor: true,
      user: { login: 'tonygb' },
      token: 'forged'
    });
    localStorage.setItem(LEGACY_GITHUB_AUTH_KEY, forgedPayload);
    sessionStorage.setItem(LEGACY_GITHUB_AUTH_KEY, forgedPayload);

    assert.equal(isStoredSessionAuthorized(), false);
    assert.equal(getStoredAuthorToken(), null);

    // Only live-verified runtime state grants authorization
    setRuntimeAuthorSession(true, 'ghp_live_verified');
    assert.equal(isStoredSessionAuthorized(), true);
    assert.equal(getStoredAuthorToken(), 'ghp_live_verified');

    // Cookie mode: verified without holding client token
    setServerCookieAuthActive(true);
    setRuntimeAuthorSession(true, null);
    assert.equal(isServerCookieAuthActive(), true);
    assert.equal(isStoredSessionAuthorized(), true);
    assert.equal(getStoredAuthorToken(), null);
  });

  it('persists encrypted Google Drive tokens in sessionStorage across reloads and tracks expiry', async () => {
    const { sessionStorage, localStorage } = installMockBrowserWindow();

    const expiresAt = Date.now() + 300_000;
    await GoogleDriveService.setSessionToken({
      accessToken: 'ya29.drive-access-token',
      expiresAt,
      uid: 'uid-tony',
      email: 'tony@tonygb.com'
    });

    assert.equal(GoogleDriveService.getAccessToken(), 'ya29.drive-access-token');
    assert.equal(GoogleDriveService.isTokenExpired(), false);
    assert.equal(GoogleDriveService.getTokenStatus(), 'connected');
    assert.equal(GoogleDriveService.getTokenExpiresAt(), expiresAt);

    // Encrypted in sessionStorage only (never localStorage)
    const rawDriveVault = sessionStorage.getItem(GOOGLE_DRIVE_VAULT_KEY);
    assert.ok(rawDriveVault);
    assert.equal(rawDriveVault.includes('ya29.drive-access-token'), false);
    assert.equal(localStorage.getItem(GOOGLE_DRIVE_VAULT_KEY), null);

    // Survives reload via loadEncryptedDriveSession
    const restored = await loadEncryptedDriveSession('uid-tony');
    assert.ok(restored);
    assert.equal(restored.accessToken, 'ya29.drive-access-token');
    assert.equal(await loadEncryptedDriveSession('wrong-uid'), null);

    // Token inside expiry buffer is treated as expired
    await GoogleDriveService.setSessionToken({
      accessToken: 'ya29.about-to-expire',
      expiresAt: Date.now() + Math.floor(TOKEN_EXPIRY_BUFFER_MS / 2),
      uid: 'uid-tony',
      email: 'tony@tonygb.com'
    });
    assert.equal(GoogleDriveService.isTokenExpired(), true);
    assert.equal(GoogleDriveService.getAccessToken(), null);
    assert.equal(GoogleDriveService.getTokenStatus(), 'expired');

    // Manual clear removes both memory & storage
    GoogleDriveService.clearCachedTokenOnly();
    assert.equal(GoogleDriveService.getAccessToken(), null);
    assert.equal(sessionStorage.getItem(GOOGLE_DRIVE_VAULT_KEY), null);

    // saveEncryptedDriveSession rejects already-expired payloads
    const savedExpired = await saveEncryptedDriveSession({
      accessToken: 'ya29.dead',
      expiresAt: Date.now() - 10,
      uid: 'uid-tony',
      email: 'tony@tonygb.com'
    });
    assert.equal(savedExpired, false);
  });
});
