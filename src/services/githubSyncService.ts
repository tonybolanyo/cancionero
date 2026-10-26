import { Song } from '../types/song';
import { StorageService } from './storageService';
import { songToMarkdown } from '../utils/markdownParser';
import { AUTHORIZED_GITHUB_USER } from '../utils/authConfig';

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

export interface CatalogSyncResult {
  success: boolean;
  message: string;
  songs?: Song[];
  source?: 'remote' | 'local';
  notModified?: boolean;
  etag?: string | null;
}

export interface PushResult {
  success: boolean;
  message: string;
  commitSha?: string;
  commitUrl?: string;
  isSimulated?: boolean;
  requiresPermissions?: boolean;
  targetRepo?: string;
}

/**
 * Encodes a UTF-8 string to base64 safely in browser environments
 * preserving unicode characters, accents, and musical symbols
 */
function utf8ToBase64(str: string): string {
  return window.btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  );
}

function base64ToUtf8(value: string): string {
  const normalized = value.replace(/\s/g, '');
  return decodeURIComponent(
    atob(normalized)
      .split('')
      .map(char => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
      .join('')
  );
}

export class GitHubSyncService {
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
   * Pull the remote catalog.json from GitHub / CDN / local deployment and reconcile it with local storage.
   * Utilizes GitHub API ETag headers (If-None-Match -> 304 Not Modified) to validate whether remote content
   * has changed before downloading, with robust no-cache fallbacks and cache-busting to ensure cross-device
   * updates are immediately detected without manual intervention or page reloads.
   */
  static async syncCatalogFromRemote(
    token?: string | null,
    customConfig?: RemoteConfig,
    options?: { forceReload?: boolean }
  ): Promise<CatalogSyncResult> {
    const config = customConfig || this.getRemoteConfig();
    const cleanToken = token?.trim();
    const targetRepo = `${config.owner}/${config.repo}`;
    const storedEtag = options?.forceReload ? null : this.getCatalogETag();

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

    // 1. Authenticated GitHub API (if token provided)
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
        etag: storedEtag
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
        etag: storedEtag
      };
    }

    // 3. Static deployment catalog (served from the same domain / GitHub Pages / local server with strict no-cache)
    if (!remoteSongs) {
      const base = import.meta.env.BASE_URL || '/';
      const candidateUrls = [
        `${base.endsWith('/') ? base : base + '/'}catalog.json?_t=${Date.now()}`,
        `/catalog.json?_t=${Date.now()}`
      ];
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
        etag: storedEtag
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
        etag: storedEtag
      };
    }

    // Save discovered ETag or remote SHA if fresh catalog was fetched
    if (newEtagToSave) {
      this.saveCatalogETag(newEtagToSave);
    }
    if (fetchedSha) {
      try {
        localStorage.setItem(STORAGE_KEY_REMOTE_SHA, fetchedSha);
      } catch {}
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

    // Reconcile retrieved catalog with local songs
    const localSongs = StorageService.getSongs();
    const { songs: reconciledSongs, hasChanges } = StorageService.reconcileWithCatalog(
      localSongs,
      remoteSongs,
      sourceLabel
    );

    return {
      success: true,
      message: hasChanges
        ? `Sincronizadas ${reconciledSongs.length} canciones actualizadas desde ${sourceLabel}.`
        : `El cancionero está completamente al día con ${sourceLabel} (${reconciledSongs.length} temas).`,
      songs: reconciledSongs,
      source: 'remote',
      notModified: false,
      etag: newEtagToSave || storedEtag
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

  /**
   * Push a single song's Markdown file directly to the GitHub repository
   * Real endpoint: https://api.github.com/repos/{owner}/{repo}/contents/songs/{id}.md
   */
  static async pushSongFile(
    song: Song,
    commitMessage: string,
    token?: string | null,
    customConfig?: RemoteConfig
  ): Promise<PushResult> {
    const config = customConfig || this.getRemoteConfig();
    const cleanToken = token?.trim();
    const targetRepo = `${config.owner}/${config.repo}`;
    const targetUrl = `https://github.com/${targetRepo}`;

    if (!cleanToken) {
      return {
        success: false,
        targetRepo,
        message: `No has iniciado sesión con token de GitHub. Para hacer push directo a ${targetRepo}, inicia sesión con tu Personal Access Token.`
      };
    }

    const path = `songs/${song.id}.md`;
    const markdown = songToMarkdown(song);
    const contentBase64 = utf8ToBase64(markdown);

    try {
      // 1. Get existing file SHA if already in repo
      const existingSha = await this.getFileSha(
        config.owner,
        config.repo,
        path,
        config.branch,
        cleanToken
      );

      // 2. Put file contents directly via GitHub REST API
      const putBody: any = {
        message: commitMessage || `update(song): ${song.title} (${path})`,
        content: contentBase64,
        branch: config.branch
      };
      if (existingSha) {
        putBody.sha = existingSha;
      }

      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(putBody)
        }
      );

      if (response.ok) {
        const data = await response.json();
        const sha = data.commit?.sha?.substring(0, 7) || 'HEAD';
        const commitUrl = data.commit?.html_url || `${targetUrl}/commit/${data.commit?.sha || ''}`;
        this.recordPushSuccess();
        return {
          success: true,
          commitSha: sha,
          commitUrl,
          targetRepo,
          message: `Push completado con éxito a GitHub: [${sha}] en ${targetUrl}/tree/${config.branch}/${path}`
        };
      }

      // If repo not found or lacks contents write scope
      if (response.status === 404) {
        return {
          success: false,
          requiresPermissions: true,
          targetRepo,
          message: `GitHub respondió 404 Not Found para "${targetUrl}". Comprueba que el repositorio "${config.repo}" exista en la cuenta @${config.owner} y que tu token de GitHub tenga permisos de acceso ("repo").`
        };
      }

      if (response.status === 403 || response.status === 401) {
        return {
          success: false,
          requiresPermissions: true,
          targetRepo,
          message: `GitHub denegó el Push (HTTP ${response.status} Forbidden). Tu Personal Access Token necesita permisos de escritura en el repositorio. Asegúrate de generar o editar tu token con el permiso "repo" (o "Contents: Read and write" para tokens Fine-grained) en GitHub.`
        };
      }

      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        targetRepo,
        message: `Error al hacer push a GitHub (${response.status}): ${errData.message || response.statusText}`
      };
    } catch (err: any) {
      return {
        success: false,
        targetRepo,
        message: `Error de conexión con api.github.com: ${err.message}`
      };
    }
  }

  /**
   * Push multiple files or full catalog to GitHub
   */
  static async pushFullCatalog(
    songs: Song[],
    commitMessage: string,
    token?: string | null,
    customConfig?: RemoteConfig
  ): Promise<PushResult> {
    const config = customConfig || this.getRemoteConfig();
    const cleanToken = token?.trim();
    const targetRepo = `${config.owner}/${config.repo}`;
    const targetUrl = `https://github.com/${targetRepo}`;

    if (!cleanToken) {
      return {
        success: false,
        targetRepo,
        message: `No has iniciado sesión con token de GitHub. Para hacer push a ${targetRepo}, inicia sesión con tu token.`
      };
    }

    try {
      const catalogJson = JSON.stringify(songs, null, 2);
      const catalogBase64 = utf8ToBase64(catalogJson);
      const path = 'catalog.json';

      const existingSha = await this.getFileSha(
        config.owner,
        config.repo,
        path,
        config.branch,
        cleanToken
      );

      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            message: commitMessage || `sync(catalog): actualización del catálogo (${songs.length} temas)`,
            content: catalogBase64,
            sha: existingSha || undefined,
            branch: config.branch
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const sha = data.commit?.sha?.substring(0, 7) || 'HEAD';
        const commitUrl = data.commit?.html_url || `${targetUrl}/commit/${data.commit?.sha || ''}`;
        this.recordPushSuccess();
        if (data.content?.sha) {
          try {
            localStorage.setItem(STORAGE_KEY_REMOTE_SHA, data.content.sha);
          } catch {}
        }
        this.clearCatalogETag();
        return {
          success: true,
          commitSha: sha,
          commitUrl,
          targetRepo,
          message: `Push completado a GitHub: catálogo sincronizado en ${targetUrl} [${sha}]`
        };
      }

      if (response.status === 403 || response.status === 401) {
        return {
          success: false,
          requiresPermissions: true,
          targetRepo,
          message: `GitHub denegó el Push (HTTP ${response.status}). Tu Personal Access Token necesita permisos de escritura ("repo" o "Contents: Read and write") en ${targetUrl}.`
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          requiresPermissions: true,
          targetRepo,
          message: `GitHub respondió 404 Not Found en ${targetUrl}. Comprueba que el repositorio exista y tu token tenga permiso "repo".`
        };
      }

      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        targetRepo,
        message: `Error al hacer push a GitHub (${response.status}): ${errData.message || response.statusText}`
      };
    } catch (err: any) {
      return {
        success: false,
        targetRepo,
        message: `Error de conexión con api.github.com: ${err.message}`
      };
    }
  }

  /**
   * Delete old file on GitHub when a song file is renamed
   */
  static async deleteRemoteFile(
    oldPath: string,
    message: string,
    token?: string | null,
    customConfig?: RemoteConfig
  ): Promise<boolean> {
    if (!token?.trim()) return false;
    const config = customConfig || this.getRemoteConfig();

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
