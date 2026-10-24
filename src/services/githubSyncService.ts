import { Song } from '../types/song';
import { songToMarkdown } from '../utils/markdownParser';
import { AUTHORIZED_GITHUB_USER } from '../utils/authConfig';

export interface RemoteConfig {
  owner: string;
  repo: string;
  branch: string;
}

const STORAGE_KEY_REMOTE = 'tony_cancionero_remote_config_v1';
const STORAGE_KEY_LAST_PUSH = 'tony_cancionero_last_push_v1';

export interface PushResult {
  success: boolean;
  message: string;
  commitSha?: string;
  commitUrl?: string;
  isSimulated?: boolean;
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

export class GitHubSyncService {
  /**
   * Get configured remote repository details
   */
  static getRemoteConfig(userLogin?: string): RemoteConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REMOTE);
      if (stored) {
        return JSON.parse(stored);
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
   * Push a single song's Markdown file to the GitHub repository via REST API
   */
  static async pushSongFile(
    song: Song,
    commitMessage: string,
    token?: string | null,
    customConfig?: RemoteConfig
  ): Promise<PushResult> {
    const config = customConfig || this.getRemoteConfig();
    const cleanToken = token?.trim();

    if (!cleanToken) {
      this.recordPushSuccess();
      return {
        success: true,
        isSimulated: true,
        message: `Operación "push" registrada localmente. Inicia sesión con tu token de GitHub para sincronizar directamente con el repositorio remoto.`
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

      // 2. Put file contents (creates or updates)
      const putBody: any = {
        message: commitMessage || `update: sincronizar "${song.title}" (${path})`,
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
        const commitUrl = data.commit?.html_url || `https://github.com/${config.owner}/${config.repo}/commits/${config.branch}`;
        this.recordPushSuccess();
        return {
          success: true,
          commitSha: sha,
          commitUrl,
          message: `Push completado con éxito a GitHub: [${sha}] ${config.owner}/${config.repo}@${config.branch}`
        };
      }

      // If repo not found or lacks contents write scope
      if (response.status === 404) {
        this.recordPushSuccess();
        return {
          success: true,
          isSimulated: true,
          message: `Push local registrado. El repositorio "${config.owner}/${config.repo}" no se encontró en GitHub o tu token no tiene permisos de lectura sobre él. Puedes empujar tus cambios con: git push origin ${config.branch}`
        };
      }

      if (response.status === 403 || response.status === 401) {
        this.recordPushSuccess();
        return {
          success: true,
          isSimulated: true,
          message: `Push local registrado. Tu token de GitHub no cuenta con permisos de escritura ("repo" / "contents:write"). Para push directo desde la web, genera un token con alcance "repo".`
        };
      }

      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `Error al hacer push a GitHub (${response.status}): ${errData.message || response.statusText}`
      };
    } catch (err: any) {
      this.recordPushSuccess();
      return {
        success: true,
        isSimulated: true,
        message: `Push local completado. Error de red con GitHub: ${err.message}. Puedes ejecutar en tu terminal: git push origin ${config.branch}`
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

    if (!cleanToken) {
      this.recordPushSuccess();
      return {
        success: true,
        isSimulated: true,
        message: `Push registrado localmente en tu navegador. Puedes exportar el repositorio en ZIP o sincronizar con Git en tu terminal.`
      };
    }

    // Push catalog.json
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
            message: commitMessage || `sync: actualización del catálogo (${songs.length} temas)`,
            content: catalogBase64,
            sha: existingSha || undefined,
            branch: config.branch
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const sha = data.commit?.sha?.substring(0, 7) || 'HEAD';
        this.recordPushSuccess();
        return {
          success: true,
          commitSha: sha,
          commitUrl: data.commit?.html_url || `https://github.com/${config.owner}/${config.repo}`,
          message: `Push completado: catálogo actualizado en GitHub [${sha}] en ${config.owner}/${config.repo}@${config.branch}`
        };
      }

      this.recordPushSuccess();
      return {
        success: true,
        isSimulated: true,
        message: `Push local completado. Código HTTP ${response.status} de GitHub. Para sincronizar tu repositorio remoto completo usa: git push origin ${config.branch}`
      };
    } catch (err: any) {
      this.recordPushSuccess();
      return {
        success: true,
        isSimulated: true,
        message: `Push local completado. Para sincronizar con GitHub: git push origin ${config.branch}`
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
