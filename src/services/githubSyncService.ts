import { Song } from '../types/song';
import { Album } from '../types/album';
import { StorageService } from './storageService';
import { songToMarkdown } from '../utils/markdownParser';
import { AUTHORIZED_GITHUB_USER, isServerCookieAuthActive } from '../utils/authConfig';
import { resolveAppUrl } from '../utils/appUrl';

export interface RemoteConfig {
  owner: string;
  repo: string;
  branch: string;
}

const STORAGE_KEY_REMOTE = 'tony_cancionero_remote_config_v1';
const STORAGE_KEY_LAST_PUSH = 'tony_cancionero_last_push_v1';
const STORAGE_KEY_AUTO_COMMIT = 'tony_cancionero_auto_commit_v1';
export const STORAGE_KEY_CATALOG_ETAG = 'tony_cancionero_catalog_etag_v1';
export const STORAGE_KEY_REMOTE_SHA = 'tony_cancionero_remote_sha_v1';
export const STORAGE_KEY_REMOTE_COMMIT_SHA = 'tony_cancionero_remote_commit_sha_v1';
export const STORAGE_KEY_LAST_SYNC_META = 'tony_cancionero_last_sync_meta_v1';

export interface SyncMeta {
  repo: string;
  branch: string;
  catalogSha?: string | null;
  commitSha?: string | null;
  contentHash?: string | null;
  syncedAt: string;
}

export interface CatalogSyncResult {
  success: boolean;
  message: string;
  songs?: Song[];
  source?: 'remote' | 'local';
  notModified?: boolean;
  etag?: string | null;
  remoteSha?: string | null;
  commitSha?: string | null;
  preservedLocalIds?: string[];
  coalesced?: boolean;
}

export interface PushResult {
  success: boolean;
  message: string;
  commitSha?: string;
  fullCommitSha?: string;
  commitUrl?: string;
  isSimulated?: boolean;
  requiresPermissions?: boolean;
  isConflict?: boolean;
  targetRepo?: string;
  filesCommitted?: string[];
}

export interface AtomicCommitFile {
  path: string;
  content?: string;
  delete?: boolean;
}

export interface AtomicCommitOptions {
  files: AtomicCommitFile[];
  commitMessage: string;
  token?: string | null;
  customConfig?: RemoteConfig;
}

/**
 * Encodes a UTF-8 string to base64 safely in browser and Node environments
 * preserving unicode characters, accents, and musical symbols
 */
function utf8ToBase64(str: string): string {
  const btoaFn =
    typeof window !== 'undefined' && typeof window.btoa === 'function'
      ? window.btoa.bind(window)
      : globalThis.btoa.bind(globalThis);

  return btoaFn(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  );
}

function base64ToUtf8(value: string): string {
  const normalized = value.replace(/\s/g, '');
  const atobFn =
    typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob.bind(window)
      : globalThis.atob.bind(globalThis);

  return decodeURIComponent(
    atobFn(normalized)
      .split('')
      .map(char => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
      .join('')
  );
}

/**
 * Deterministic 64-bit FNV-1a content hash for comparing remote/local payloads
 * even when CDN/static endpoints do not expose Git blob SHAs.
 */
function computeContentHash(content: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (code + i) & 0xffff;
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export class GitHubSyncService {
  private static syncInFlightPromise: Promise<CatalogSyncResult> | null = null;
  private static syncLocked = false;

  /**
   * Returns whether a catalog synchronization is currently in progress.
   */
  static isSyncInProgress(): boolean {
    return this.syncLocked || this.syncInFlightPromise !== null;
  }

  /**
   * Resets internal sync lock state (intended for unit tests).
   */
  static resetSyncStateForTesting(): void {
    this.syncInFlightPromise = null;
    this.syncLocked = false;
  }

  /**
   * Get configured remote repository details
   * Target: https://github.com/{owner}/{repo} (branch: {branch})
   */
  static getRemoteConfig(userLogin?: string): RemoteConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REMOTE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.owner && parsed.repo) {
          return {
            owner: parsed.owner.toLowerCase().trim(),
            repo: parsed.repo.trim(),
            branch: (parsed.branch || 'main').trim()
          };
        }
      }
    } catch {
      // ignore
    }

    return {
      owner: (userLogin || AUTHORIZED_GITHUB_USER || 'tonygb').toLowerCase().trim(),
      repo: 'cancionero',
      branch: 'main'
    };
  }

  /**
   * Save remote configuration
   */
  static saveRemoteConfig(config: RemoteConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY_REMOTE, JSON.stringify(config));
    } catch (err) {
      console.warn('Failed to save remote config', err);
    }
  }

  /**
   * Check if Auto-Commit & Auto-Push is enabled (defaults to true)
   */
  static isAutoCommitEnabled(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTO_COMMIT);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // ignore
    }
    return true; // enabled by default
  }

  /**
   * Set Auto-Commit & Auto-Push preference
   */
  static setAutoCommitEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_COMMIT, enabled ? 'true' : 'false');
    } catch (err) {
      console.warn('Failed to save auto commit config', err);
    }
  }

  /**
   * Retrieve timestamp of last successful push
   */
  static getLastPushTime(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_PUSH);
    } catch {
      return null;
    }
  }

  /**
   * Record a successful push
   */
  static recordPushSuccess(): void {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_PUSH, new Date().toISOString());
    } catch {
      // ignore
    }
  }

  /**
   * Retrieve stored catalog ETag
   */
  static getCatalogETag(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY_CATALOG_ETAG);
    } catch {
      return null;
    }
  }

  /**
   * Save catalog ETag to localStorage
   */
  static saveCatalogETag(etag: string): void {
    try {
      if (etag && typeof etag === 'string') {
        localStorage.setItem(STORAGE_KEY_CATALOG_ETAG, etag.trim());
      }
    } catch {
      // ignore
    }
  }

  /**
   * Clear catalog ETag to force an unconditional fetch on the next sync
   */
  static clearCatalogETag(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_CATALOG_ETAG);
    } catch {
      // ignore
    }
  }

  /**
   * Retrieve stored remote catalog blob SHA
   */
  static getRemoteSha(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY_REMOTE_SHA);
    } catch {
      return null;
    }
  }

  static saveRemoteSha(sha: string): void {
    try {
      if (sha && typeof sha === 'string') {
        localStorage.setItem(STORAGE_KEY_REMOTE_SHA, sha.trim());
      }
    } catch {
      // ignore
    }
  }

  static getRemoteCommitSha(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY_REMOTE_COMMIT_SHA);
    } catch {
      return null;
    }
  }

  static saveRemoteCommitSha(sha: string): void {
    try {
      if (sha && typeof sha === 'string') {
        localStorage.setItem(STORAGE_KEY_REMOTE_COMMIT_SHA, sha.trim());
      }
    } catch {
      // ignore
    }
  }

  static getLastSyncMeta(): SyncMeta | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_SYNC_META);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as SyncMeta) : null;
    } catch {
      return null;
    }
  }

  static saveLastSyncMeta(meta: SyncMeta): void {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_SYNC_META, JSON.stringify(meta));
    } catch {
      // ignore
    }
  }

  /**
   * Pull the remote catalog.json from GitHub / CDN / local deployment and reconcile it with local storage.
   * Protected by an anti-reentrancy concurrency lock so overlapping calls (e.g. visibilitychange + manual sync)
   * coalesce cleanly without race conditions, and compares remote SHA / content hash & timestamps before
   * overwriting uncommitted local changes.
   */
  static async syncCatalogFromRemote(
    token?: string | null,
    customConfig?: RemoteConfig,
    options?: { forceReload?: boolean }
  ): Promise<CatalogSyncResult> {
    if (this.syncInFlightPromise) {
      if (options?.forceReload) {
        await this.syncInFlightPromise.catch(() => undefined);
      } else {
        const sharedResult = await this.syncInFlightPromise;
        return { ...sharedResult, coalesced: true };
      }
    }

    this.syncLocked = true;
    const runPromise = this.performSyncCatalogFromRemote(token, customConfig, options).finally(() => {
      if (this.syncInFlightPromise === runPromise) {
        this.syncInFlightPromise = null;
      }
      this.syncLocked = false;
    });

    this.syncInFlightPromise = runPromise;
    return runPromise;
  }

  private static async performSyncCatalogFromRemote(
    token?: string | null,
    customConfig?: RemoteConfig,
    options?: { forceReload?: boolean }
  ): Promise<CatalogSyncResult> {
    await StorageService.init();
    const config = customConfig || this.getRemoteConfig();
    const cleanToken = token?.trim();
    const targetRepo = `${config.owner}/${config.repo}`;
    const storedEtag = options?.forceReload ? null : this.getCatalogETag();
    const previousMeta = this.getLastSyncMeta();
    const sameTargetRepo =
      previousMeta?.repo === targetRepo && previousMeta?.branch === config.branch;

    let remoteSongs: Song[] | null = null;
    let sourceLabel = '';
    let matchedEtag = false;
    let matchedSource = '';
    let newEtagToSave: string | null = null;
    let fetchedSha: string | null = null;

    // Strict no-cache headers to bypass intermediate cache proxies
    const noCacheHeaders: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    };

    // 1. Authenticated GitHub API (via explicit token OR server.ts HttpOnly cookie proxy)
    // Uses ETag If-None-Match to detect 304 Not Modified instantly without payload transfer
    if (cleanToken) {
      try {
        const headers: Record<string, string> = {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${cleanToken}`,
          ...noCacheHeaders
        };
        if (storedEtag) {
          headers['If-None-Match'] = storedEtag;
        }

        const response = await fetch(
          `https://api.github.com/repos/${config.owner}/${config.repo}/contents/catalog.json?ref=${encodeURIComponent(config.branch)}&_t=${Date.now()}`,
          {
            headers,
            cache: 'no-cache'
          }
        );

        if (response.status === 304) {
          matchedEtag = true;
          matchedSource = `GitHub API (${targetRepo})`;
          const respEtag = response.headers.get('etag');
          if (respEtag) {
            this.saveCatalogETag(respEtag);
          }
        } else if (response.ok) {
          const respEtag = response.headers.get('etag');
          if (respEtag) {
            newEtagToSave = respEtag;
          }
          const data = await response.json();
          if (data?.content) {
            const jsonStr = base64ToUtf8(data.content);
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              remoteSongs = parsed;
              sourceLabel = `GitHub API (${targetRepo})`;
              fetchedSha = data.sha || null;
            }
          }
        }
      } catch (err) {
        console.warn('Sync via authenticated GitHub API failed, checking fallbacks:', err);
      }
    } else if (isServerCookieAuthActive()) {
      try {
        const proxyHeaders: Record<string, string> = {
          Accept: 'application/json',
          'X-Requested-With': 'cancionero-client'
        };
        if (storedEtag) {
          proxyHeaders['If-None-Match'] = storedEtag;
        }
        const query = new URLSearchParams({
          owner: config.owner,
          repo: config.repo,
          branch: config.branch
        });
        const proxyRes = await fetch(resolveAppUrl(`api/github/catalog?${query.toString()}`), {
          credentials: 'include',
          headers: proxyHeaders,
          cache: 'no-cache'
        });
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData?.notModified) {
            matchedEtag = true;
            matchedSource = `GitHub API vía servidor (${targetRepo})`;
            if (proxyData.etag) {
              this.saveCatalogETag(proxyData.etag);
            }
          } else if (Array.isArray(proxyData?.songs) && proxyData.songs.length > 0) {
            remoteSongs = proxyData.songs;
            sourceLabel = `GitHub API vía servidor (${targetRepo})`;
            fetchedSha = proxyData.sha || null;
            if (proxyData.etag) {
              newEtagToSave = proxyData.etag;
            }
          }
        }
      } catch (err) {
        console.warn('Sync via server GitHub proxy failed, checking fallbacks:', err);
      }
    }

    // If validated via 304, the remote catalog has not changed at all. Return immediately without payload overhead!
    if (matchedEtag) {
      const current = StorageService.getSongs();
      return {
        success: true,
        message: `El catálogo remoto no ha cambiado (validado por ETag 304 en ${matchedSource || targetRepo}).`,
        songs: current,
        source: 'remote',
        notModified: true,
        etag: storedEtag,
        remoteSha: this.getRemoteSha()
      };
    }

    // 2. GitHub Raw Content CDN (No 60 req/hr IP limit, generous CORS, instant reflection of git push)
    if (!remoteSongs) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/catalog.json?_t=${Date.now()}`;
        const rawHeaders: Record<string, string> = {
          Accept: 'application/json',
          ...noCacheHeaders
        };
        if (storedEtag) {
          rawHeaders['If-None-Match'] = storedEtag;
        }

        const rawRes = await fetch(rawUrl, {
          cache: 'no-cache',
          headers: rawHeaders
        });

        if (rawRes.status === 304) {
          matchedEtag = true;
          matchedSource = `GitHub CDN (${targetRepo}@${config.branch})`;
          const rawEtag = rawRes.headers.get('etag');
          if (rawEtag) {
            this.saveCatalogETag(rawEtag);
          }
        } else if (rawRes.ok) {
          const rawEtag = rawRes.headers.get('etag');
          if (rawEtag) {
            newEtagToSave = rawEtag;
          }
          const parsed = await rawRes.json();
          if (Array.isArray(parsed) && parsed.length > 0) {
            remoteSongs = parsed;
            sourceLabel = `GitHub CDN (${targetRepo}@${config.branch})`;
          }
        }
      } catch (err) {
        console.warn('Sync via GitHub CDN failed, checking static fallback:', err);
      }
    }

    if (matchedEtag) {
      const current = StorageService.getSongs();
      return {
        success: true,
        message: `El catálogo remoto no ha cambiado (validado por ETag 304 en ${matchedSource || targetRepo}).`,
        songs: current,
        source: 'remote',
        notModified: true,
        etag: storedEtag,
        remoteSha: this.getRemoteSha()
      };
    }

    // 3. Static deployment catalog (served from the same domain / GitHub Pages / local server with strict no-cache)
    if (!remoteSongs) {
      const cacheBust = Date.now();
      const candidateUrls = Array.from(
        new Set([
          resolveAppUrl(`catalog.json?_t=${cacheBust}`),
          `/catalog.json?_t=${cacheBust}`
        ])
      );
      for (const url of candidateUrls) {
        try {
          const staticHeaders: Record<string, string> = {
            Accept: 'application/json',
            ...noCacheHeaders
          };
          if (storedEtag) {
            staticHeaders['If-None-Match'] = storedEtag;
          }

          const staticRes = await fetch(url, {
            cache: 'no-cache',
            headers: staticHeaders
          });

          if (staticRes.status === 304) {
            matchedEtag = true;
            matchedSource = `Catálogo estático desplegado (${url})`;
            const staticEtag = staticRes.headers.get('etag');
            if (staticEtag) {
              this.saveCatalogETag(staticEtag);
            }
            break;
          } else if (staticRes.ok) {
            const staticEtag = staticRes.headers.get('etag');
            if (staticEtag) {
              newEtagToSave = staticEtag;
            }
            const parsed = await staticRes.json();
            if (Array.isArray(parsed) && parsed.length > 0) {
              remoteSongs = parsed;
              sourceLabel = `Catálogo estático desplegado (${url})`;
              break;
            }
          }
        } catch {}
      }
    }

    if (matchedEtag) {
      const current = StorageService.getSongs();
      return {
        success: true,
        message: `El catálogo remoto no ha cambiado (validado por ETag 304 en ${matchedSource || targetRepo}).`,
        songs: current,
        source: 'remote',
        notModified: true,
        etag: storedEtag,
        remoteSha: this.getRemoteSha()
      };
    }

    // 4. Unauthenticated GitHub API contents endpoint as final network attempt
    if (!remoteSongs && !cleanToken) {
      try {
        const unauthHeaders: Record<string, string> = {
          Accept: 'application/vnd.github.v3+json',
          ...noCacheHeaders
        };
        if (storedEtag) {
          unauthHeaders['If-None-Match'] = storedEtag;
        }

        const unauthRes = await fetch(
          `https://api.github.com/repos/${config.owner}/${config.repo}/contents/catalog.json?ref=${encodeURIComponent(config.branch)}&_t=${Date.now()}`,
          {
            headers: unauthHeaders,
            cache: 'no-cache'
          }
        );

        if (unauthRes.status === 304) {
          matchedEtag = true;
          matchedSource = `GitHub API pública (${targetRepo})`;
          const apiEtag = unauthRes.headers.get('etag');
          if (apiEtag) {
            this.saveCatalogETag(apiEtag);
          }
        } else if (unauthRes.ok) {
          const apiEtag = unauthRes.headers.get('etag');
          if (apiEtag) {
            newEtagToSave = apiEtag;
          }
          const data = await unauthRes.json();
          if (data?.content) {
            const jsonStr = base64ToUtf8(data.content);
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              remoteSongs = parsed;
              sourceLabel = `GitHub API pública (${targetRepo})`;
              fetchedSha = data.sha || null;
            }
          }
        }
      } catch (err) {
        console.warn('Sync via unauthenticated GitHub API failed:', err);
      }
    }

    if (matchedEtag) {
      const current = StorageService.getSongs();
      return {
        success: true,
        message: `El catálogo remoto no ha cambiado (validado por ETag 304 en ${matchedSource || targetRepo}).`,
        songs: current,
        source: 'remote',
        notModified: true,
        etag: storedEtag,
        remoteSha: this.getRemoteSha()
      };
    }

    // Fallback: If no remote catalog was reachable (e.g. offline), use locally stored/bundled songs
    if (!remoteSongs || remoteSongs.length === 0) {
      const current = StorageService.getSongs();
      return {
        success: true,
        message: 'No se pudo contactar con el repositorio remoto. Se mantienen las canciones locales/empaquetadas.',
        songs: current,
        source: 'local'
      };
    }

    // Save discovered ETag
    if (newEtagToSave) {
      this.saveCatalogETag(newEtagToSave);
    }

    const remoteContentHash = computeContentHash(JSON.stringify(remoteSongs));

    // Compare remote SHA / content hash against last synced state BEFORE reconciling or touching uncommitted local edits
    const shaMatchesLastSync = Boolean(
      !options?.forceReload &&
      sameTargetRepo &&
      fetchedSha &&
      previousMeta?.catalogSha &&
      previousMeta.catalogSha === fetchedSha
    );

    const contentHashMatchesLastSync = Boolean(
      !options?.forceReload &&
      sameTargetRepo &&
      previousMeta?.contentHash &&
      previousMeta.contentHash === remoteContentHash
    );

    if (shaMatchesLastSync || contentHashMatchesLastSync) {
      if (fetchedSha) {
        this.saveRemoteSha(fetchedSha);
      }
      const current = StorageService.getSongs();
      return {
        success: true,
        message: `El catálogo remoto coincide con el último SHA sincronizado (${fetchedSha ? fetchedSha.substring(0, 7) : remoteContentHash.substring(0, 7)}). Cambios locales preservados.`,
        songs: current,
        source: 'remote',
        notModified: true,
        etag: newEtagToSave || storedEtag,
        remoteSha: fetchedSha || previousMeta?.catalogSha || null
      };
    }

    if (fetchedSha) {
      this.saveRemoteSha(fetchedSha);
    }

    // Reconcile retrieved catalog with local songs (validates base snapshot SHA/content & updatedAt before overwriting)
    const localSongs = StorageService.getSongs();
    const {
      songs: reconciledSongs,
      hasChanges,
      preservedConflictIds
    } = StorageService.reconcileWithCatalog(
      localSongs,
      remoteSongs,
      sourceLabel
    );

    this.saveLastSyncMeta({
      repo: targetRepo,
      branch: config.branch,
      catalogSha: fetchedSha || previousMeta?.catalogSha || null,
      commitSha: this.getRemoteCommitSha(),
      contentHash: remoteContentHash,
      syncedAt: new Date().toISOString()
    });

    const conflictNotice =
      preservedConflictIds && preservedConflictIds.length > 0
        ? ` Se protegieron ${preservedConflictIds.length} cambio(s) local(es) no confirmado(s) más reciente(s).`
        : '';

    return {
      success: true,
      message: (hasChanges
        ? `Sincronizadas ${reconciledSongs.length} canciones actualizadas desde ${sourceLabel}.`
        : `El cancionero está completamente al día con ${sourceLabel} (${reconciledSongs.length} temas).`) + conflictNotice,
      songs: reconciledSongs,
      source: 'remote',
      notModified: false,
      etag: newEtagToSave || storedEtag,
      remoteSha: fetchedSha,
      ...(preservedConflictIds && preservedConflictIds.length > 0 ? { preservedLocalIds: preservedConflictIds } : {})
    };
  }

  /**
   * Fetch SHA of an existing file in GitHub repository
   */
  static async getFileSha(
    owner: string,
    repo: string,
    path: string,
    branch: string,
    token: string
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.sha || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static mapGitHubHttpError(
    status: number,
    statusText: string,
    errMessage: string | undefined,
    targetRepo: string,
    owner: string,
    repo: string,
    branch: string
  ): PushResult {
    const targetUrl = `https://github.com/${targetRepo}`;

    if (status === 404) {
      return {
        success: false,
        requiresPermissions: true,
        targetRepo,
        message: `GitHub respondió 404 Not Found para "${targetUrl}" (rama "${branch}"). Comprueba que el repositorio "${repo}" exista en la cuenta @${owner} y que tu token tenga permisos de acceso ("repo").`
      };
    }

    if (status === 401 || status === 403) {
      return {
        success: false,
        requiresPermissions: true,
        targetRepo,
        message: `GitHub denegó el Push (HTTP ${status} Forbidden). Tu Personal Access Token necesita permisos de escritura ("repo" o "Contents: Read and write") en ${targetUrl}.`
      };
    }

    if (status === 409 || status === 422) {
      return {
        success: false,
        isConflict: true,
        targetRepo,
        message: `Conflicto al actualizar la rama ${targetRepo}@${branch} (HTTP ${status}): ${errMessage || 'la referencia remota cambió concurrentemente. Sincroniza desde GitHub e inténtalo de nuevo.'}`
      };
    }

    return {
      success: false,
      targetRepo,
      message: `Error al hacer push a GitHub (${status}): ${errMessage || statusText}`
    };
  }

  /**
   * Execute an atomic multi-file commit via the GitHub Git Data API:
   * git/ref -> git/commits (base) -> git/blobs -> git/trees -> git/commits (new) -> git/refs (PATCH)
   */
  static async pushAtomicCommit(options: AtomicCommitOptions): Promise<PushResult> {
    const config = options.customConfig || this.getRemoteConfig();
    const cleanToken = options.token?.trim();
    const targetRepo = `${config.owner}/${config.repo}`;
    const targetUrl = `https://github.com/${targetRepo}`;

    if (!options.files || options.files.length === 0) {
      return {
        success: false,
        targetRepo,
        message: 'No hay archivos especificados para el commit atómico.'
      };
    }

    // Deduplicate files by path (last entry wins)
    const dedupMap = new Map<string, AtomicCommitFile>();
    for (const f of options.files) {
      if (f.path) {
        dedupMap.set(f.path, f);
      }
    }
    const filesToCommit = Array.from(dedupMap.values());

    if (!cleanToken) {
      if (isServerCookieAuthActive()) {
        try {
          const proxyRes = await fetch(resolveAppUrl('api/github/push'), {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'cancionero-client'
            },
            body: JSON.stringify({
              owner: config.owner,
              repo: config.repo,
              branch: config.branch,
              commitMessage: options.commitMessage,
              files: filesToCommit
            })
          });
          const proxyData = await proxyRes.json().catch(() => ({}));
          if (!proxyRes.ok || !proxyData?.success) {
            return {
              success: false,
              requiresPermissions: proxyData?.requiresPermissions,
              isConflict: proxyData?.isConflict,
              targetRepo,
              message: proxyData?.message || proxyData?.error || `Error al hacer push vía servidor (${proxyRes.status}).`
            };
          }

          this.recordPushSuccess();
          if (proxyData.fullCommitSha) {
            this.saveRemoteCommitSha(proxyData.fullCommitSha);
          }
          if (proxyData.catalogBlobSha) {
            this.saveRemoteSha(proxyData.catalogBlobSha);
          }
          const catalogFile = filesToCommit.find(f => f.path === 'catalog.json' && !f.delete);
          let contentHash: string | null = null;
          if (catalogFile?.content !== undefined) {
            try {
              contentHash = computeContentHash(JSON.stringify(JSON.parse(catalogFile.content)));
            } catch {
              contentHash = computeContentHash(catalogFile.content);
            }
          }
          this.saveLastSyncMeta({
            repo: targetRepo,
            branch: config.branch,
            catalogSha: proxyData.catalogBlobSha || this.getRemoteSha(),
            commitSha: proxyData.fullCommitSha || null,
            contentHash,
            syncedAt: new Date().toISOString()
          });
          this.clearCatalogETag();

          return {
            success: true,
            commitSha: proxyData.commitSha,
            fullCommitSha: proxyData.fullCommitSha,
            commitUrl: proxyData.commitUrl,
            targetRepo,
            filesCommitted: proxyData.filesCommitted,
            message: proxyData.message
          };
        } catch (err: any) {
          return {
            success: false,
            targetRepo,
            message: `Error de conexión con servidor para push a GitHub: ${err?.message || 'Error desconocido'}`
          };
        }
      }

      return {
        success: false,
        targetRepo,
        message: `No has iniciado sesión con token de GitHub. Para hacer push directo a ${targetRepo}, inicia sesión con tu Personal Access Token.`
      };
    }

    const apiBase = `https://api.github.com/repos/${config.owner}/${config.repo}`;
    const encodedBranch = encodeURIComponent(config.branch);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${cleanToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json'
    };

    try {
      // 1. Get current branch reference SHA
      const refRes = await fetch(`${apiBase}/git/ref/heads/${encodedBranch}`, {
        method: 'GET',
        headers,
        cache: 'no-cache'
      });

      if (!refRes.ok) {
        const errData = await refRes.json().catch(() => ({}));
        return this.mapGitHubHttpError(
          refRes.status,
          refRes.statusText,
          errData.message,
          targetRepo,
          config.owner,
          config.repo,
          config.branch
        );
      }

      const refData = await refRes.json();
      const baseCommitSha: string | undefined = refData?.object?.sha;
      if (!baseCommitSha) {
        return {
          success: false,
          targetRepo,
          message: `Respuesta inesperada de GitHub al obtener la referencia heads/${config.branch}.`
        };
      }

      // 2. Get base commit to retrieve base tree SHA
      const baseCommitRes = await fetch(`${apiBase}/git/commits/${baseCommitSha}`, {
        method: 'GET',
        headers,
        cache: 'no-cache'
      });

      if (!baseCommitRes.ok) {
        const errData = await baseCommitRes.json().catch(() => ({}));
        return this.mapGitHubHttpError(
          baseCommitRes.status,
          baseCommitRes.statusText,
          errData.message,
          targetRepo,
          config.owner,
          config.repo,
          config.branch
        );
      }

      const baseCommitData = await baseCommitRes.json();
      const baseTreeSha: string | undefined = baseCommitData?.tree?.sha;
      if (!baseTreeSha) {
        return {
          success: false,
          targetRepo,
          message: `No se pudo obtener el árbol base del commit ${baseCommitSha}.`
        };
      }

      // 3. Create blobs via POST /git/blobs (batched for concurrency safety)
      let catalogBlobSha: string | null = null;
      let catalogContentForHash: string | null = null;
      const treeEntries: Array<{
        path: string;
        mode: '100644';
        type: 'blob';
        sha: string | null;
      }> = [];

      const filesToCreate = filesToCommit.filter(f => !f.delete);
      const filesToDelete = filesToCommit.filter(f => f.delete);

      const BATCH_SIZE = 6;
      for (let i = 0; i < filesToCreate.length; i += BATCH_SIZE) {
        const batch = filesToCreate.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async file => {
            const rawContent = file.content ?? '';
            const blobRes = await fetch(`${apiBase}/git/blobs`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                content: utf8ToBase64(rawContent),
                encoding: 'base64'
              })
            });

            if (!blobRes.ok) {
              const errData = await blobRes.json().catch(() => ({}));
              throw {
                httpError: true,
                status: blobRes.status,
                statusText: blobRes.statusText,
                message: errData.message
              };
            }

            const blobData = await blobRes.json();
            if (!blobData?.sha) {
              throw new Error(`GitHub no devolvió SHA para el blob de "${file.path}".`);
            }

            if (file.path === 'catalog.json') {
              catalogBlobSha = blobData.sha;
              catalogContentForHash = rawContent;
            }

            return {
              path: file.path,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: blobData.sha as string
            };
          })
        );
        treeEntries.push(...batchResults);
      }

      for (const delFile of filesToDelete) {
        treeEntries.push({
          path: delFile.path,
          mode: '100644',
          type: 'blob',
          sha: null
        });
      }

      // 4. Create new Git tree via POST /git/trees
      const treeRes = await fetch(`${apiBase}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries
        })
      });

      if (!treeRes.ok) {
        const errData = await treeRes.json().catch(() => ({}));
        return this.mapGitHubHttpError(
          treeRes.status,
          treeRes.statusText,
          errData.message,
          targetRepo,
          config.owner,
          config.repo,
          config.branch
        );
      }

      const treeData = await treeRes.json();
      const newTreeSha: string | undefined = treeData?.sha;
      if (!newTreeSha) {
        return {
          success: false,
          targetRepo,
          message: 'GitHub no devolvió SHA al crear el árbol Git.'
        };
      }

      // 5. Create new commit via POST /git/commits
      const commitRes = await fetch(`${apiBase}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: options.commitMessage,
          tree: newTreeSha,
          parents: [baseCommitSha]
        })
      });

      if (!commitRes.ok) {
        const errData = await commitRes.json().catch(() => ({}));
        return this.mapGitHubHttpError(
          commitRes.status,
          commitRes.statusText,
          errData.message,
          targetRepo,
          config.owner,
          config.repo,
          config.branch
        );
      }

      const newCommitData = await commitRes.json();
      const newCommitSha: string | undefined = newCommitData?.sha;
      if (!newCommitSha) {
        return {
          success: false,
          targetRepo,
          message: 'GitHub no devolvió SHA al crear el commit atómico.'
        };
      }

      // 6. Fast-forward branch ref via PATCH /git/refs/heads/{branch}
      const patchRefRes = await fetch(`${apiBase}/git/refs/heads/${encodedBranch}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: newCommitSha,
          force: false
        })
      });

      if (!patchRefRes.ok) {
        const errData = await patchRefRes.json().catch(() => ({}));
        return this.mapGitHubHttpError(
          patchRefRes.status,
          patchRefRes.statusText,
          errData.message,
          targetRepo,
          config.owner,
          config.repo,
          config.branch
        );
      }

      // Persist sync metadata after atomic commit succeeds
      this.recordPushSuccess();
      this.saveRemoteCommitSha(newCommitSha);
      if (catalogBlobSha) {
        this.saveRemoteSha(catalogBlobSha);
      }

      let contentHash: string | null = null;
      if (catalogContentForHash !== null) {
        try {
          contentHash = computeContentHash(JSON.stringify(JSON.parse(catalogContentForHash)));
        } catch {
          contentHash = computeContentHash(catalogContentForHash);
        }
      }

      this.saveLastSyncMeta({
        repo: targetRepo,
        branch: config.branch,
        catalogSha: catalogBlobSha || this.getRemoteSha(),
        commitSha: newCommitSha,
        contentHash,
        syncedAt: new Date().toISOString()
      });
      this.clearCatalogETag();

      const shortSha = newCommitSha.substring(0, 7);
      const commitUrl = newCommitData.html_url || `${targetUrl}/commit/${newCommitSha}`;
      const committedPaths = filesToCommit.map(f => f.path);

      return {
        success: true,
        commitSha: shortSha,
        fullCommitSha: newCommitSha,
        commitUrl,
        targetRepo,
        filesCommitted: committedPaths,
        message: `Commit atómico completado en GitHub: [${shortSha}] (${committedPaths.length} archivos sincronizados en ${targetRepo}@${config.branch})`
      };
    } catch (err: any) {
      if (err && err.httpError) {
        return this.mapGitHubHttpError(
          err.status,
          err.statusText || '',
          err.message,
          targetRepo,
          config.owner,
          config.repo,
          config.branch
        );
      }
      return {
        success: false,
        targetRepo,
        message: `Error de conexión con api.github.com: ${err?.message || 'Error desconocido'}`
      };
    }
  }

  /**
   * Push a single song's Markdown file together with updated catalog.json, albums.json,
   * and any other locally dirty songs/*.md files in ONE atomic Git commit.
   */
  static async pushSongFile(
    song: Song,
    commitMessage: string,
    token?: string | null,
    customConfig?: RemoteConfig,
    options?: {
      songs?: Song[];
      albums?: Album[];
      deletePaths?: string[];
    }
  ): Promise<PushResult> {
    const deletePathSet = new Set<string>(options?.deletePaths || []);
    const deletedSongIds = new Set<string>();
    deletePathSet.forEach(p => {
      const m = p.match(/^songs\/(.+)\.md$/);
      if (m && m[1] !== song.id) {
        deletedSongIds.add(m[1]);
      }
    });

    // Build authoritative songs catalog including this song
    const baseSongs = (options?.songs || StorageService.getSongs()).filter(
      s => !deletedSongIds.has(s.id)
    );
    const existingIdx = baseSongs.findIndex(s => s.id === song.id);
    const updatedCatalogSongs = [...baseSongs];
    if (existingIdx >= 0) {
      updatedCatalogSongs[existingIdx] = song;
    } else {
      updatedCatalogSongs.unshift(song);
    }

    const albums = options?.albums || StorageService.getAlbums();
    const files: AtomicCommitFile[] = [];
    const includedPaths = new Set<string>();

    // 1. Target song markdown
    const primaryPath = `songs/${song.id}.md`;
    files.push({
      path: primaryPath,
      content: songToMarkdown(song)
    });
    includedPaths.add(primaryPath);

    // 2. Include any other dirty songs/*.md from local git status so songs/*.md never drift from catalog.json
    const gitStatus = StorageService.getGitStatus();
    const songMap = new Map(updatedCatalogSongs.map(s => [s.id, s]));

    for (const relPath of [...gitStatus.modified, ...gitStatus.created]) {
      if (includedPaths.has(relPath) || deletePathSet.has(relPath)) continue;
      const match = relPath.match(/^songs\/(.+)\.md$/);
      if (match) {
        const dirtySong = songMap.get(match[1]);
        if (dirtySong) {
          files.push({
            path: relPath,
            content: songToMarkdown(dirtySong)
          });
          includedPaths.add(relPath);
        }
      }
    }

    for (const delPath of [...deletePathSet, ...gitStatus.deleted]) {
      if (includedPaths.has(delPath) || delPath === primaryPath) continue;
      files.push({
        path: delPath,
        delete: true
      });
      includedPaths.add(delPath);
    }

    // 3. Always include catalog.json & albums.json in the same atomic commit
    files.push({
      path: 'catalog.json',
      content: `${JSON.stringify(updatedCatalogSongs, null, 2)}\n`
    });
    files.push({
      path: 'albums.json',
      content: `${JSON.stringify(albums, null, 2)}\n`
    });

    return this.pushAtomicCommit({
      files,
      commitMessage: commitMessage || `update(song): ${song.title} (${primaryPath})`,
      token,
      customConfig
    });
  }

  /**
   * Push modified/created/deleted songs/*.md + catalog.json + albums.json in ONE atomic commit.
   */
  static async pushFullCatalog(
    songs: Song[],
    commitMessage: string,
    token?: string | null,
    customConfig?: RemoteConfig,
    options?: {
      albums?: Album[];
      changedFiles?: string[];
      deletedPaths?: string[];
      includeAllSongs?: boolean;
    }
  ): Promise<PushResult> {
    const albums = options?.albums || StorageService.getAlbums();
    const songMap = new Map((songs || []).map(s => [s.id, s]));
    const gitStatus = StorageService.getGitStatus();
    const snapshot = StorageService.getSnapshot();
    const unpushedFiles = StorageService.getUnpushedChangedFiles();

    const files: AtomicCommitFile[] = [];
    const handledPaths = new Set<string>();

    const candidateSongPaths = new Set<string>([
      ...(options?.changedFiles || []),
      ...gitStatus.modified,
      ...gitStatus.created,
      ...gitStatus.deleted,
      ...unpushedFiles
    ]);

    // Also detect any songs that differ from committed snapshot
    for (const song of songs || []) {
      const committedMd = snapshot[song.id];
      const currentMd = songToMarkdown(song);
      if (
        options?.includeAllSongs ||
        !committedMd ||
        committedMd.trim() !== currentMd.trim()
      ) {
        candidateSongPaths.add(`songs/${song.id}.md`);
      }
    }

    // Process explicit deletions first
    for (const delPath of options?.deletedPaths || []) {
      if (!handledPaths.has(delPath)) {
        const m = delPath.match(/^songs\/(.+)\.md$/);
        if (!m || !songMap.has(m[1])) {
          files.push({ path: delPath, delete: true });
          handledPaths.add(delPath);
        }
      }
    }

    // Process modified/created/deleted candidate paths
    for (const relPath of candidateSongPaths) {
      if (handledPaths.has(relPath)) continue;
      const match = relPath.match(/^songs\/(.+)\.md$/);
      if (!match) continue;

      const songId = match[1];
      const songObj = songMap.get(songId);
      if (songObj) {
        files.push({
          path: relPath,
          content: songToMarkdown(songObj)
        });
      } else {
        files.push({
          path: relPath,
          delete: true
        });
      }
      handledPaths.add(relPath);
    }

    // Always include catalog.json and albums.json atomically
    files.push({
      path: 'catalog.json',
      content: `${JSON.stringify(songs, null, 2)}\n`
    });
    files.push({
      path: 'albums.json',
      content: `${JSON.stringify(albums, null, 2)}\n`
    });

    return this.pushAtomicCommit({
      files,
      commitMessage: commitMessage || `sync(catalog): actualización atómica del catálogo (${songs.length} temas)`,
      token,
      customConfig
    });
  }

  /**
   * Delete old file on GitHub when a song file is deleted or renamed standalone
   */
  static async deleteRemoteFile(
    oldPath: string,
    message: string,
    token?: string | null,
    customConfig?: RemoteConfig
  ): Promise<boolean> {
    const config = customConfig || this.getRemoteConfig();
    if (!token?.trim()) {
      if (!isServerCookieAuthActive()) return false;
      try {
        const res = await fetch(resolveAppUrl('api/github/delete-file'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'cancionero-client'
          },
          body: JSON.stringify({
            owner: config.owner,
            repo: config.repo,
            branch: config.branch,
            path: oldPath,
            message
          })
        });
        const data = await res.json().catch(() => ({}));
        return Boolean(res.ok && data?.success);
      } catch {
        return false;
      }
    }

    try {
      const sha = await this.getFileSha(config.owner, config.repo, oldPath, config.branch, token);
      if (!sha) return false;

      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${oldPath}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            message,
            sha,
            branch: config.branch
          })
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
