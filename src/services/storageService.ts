import { Song, GitCommit, GitStatusSummary } from '../types/song';
import { INITIAL_SONGS } from '../data/initialSongs';
import { songToMarkdown, markdownToSong } from '../utils/markdownParser';

const STORAGE_KEY_SONGS = 'tony_cancionero_songs_v1';
const STORAGE_KEY_COMMITS = 'tony_cancionero_git_commits_v1';
const STORAGE_KEY_LAST_COMMITTED_SNAPSHOT = 'tony_cancionero_git_snapshot_v1';
const STORAGE_KEY_BACKUPS = 'tony_cancionero_backup_points_v1';

export interface SongBackupPoint {
  id: string;
  timestamp: string;
  name: string;
  reason: 'pre_import_json' | 'pre_import_md' | 'pre_sync' | 'pre_reset' | 'manual';
  songCount: number;
  songsJson: string;
  songsSummary: Array<{ id: string; title: string; key: string; status: string }>;
}

export interface SongVersionRecord {
  commit: GitCommit;
  markdown: string;
  isCurrent: boolean;
}

// Initial commit history with real snapshots
const createInitialCommits = (): GitCommit[] => {
  const nochesOriginal = INITIAL_SONGS[0];
  const faroOriginal = INITIAL_SONGS[1];
  const raizOriginal = INITIAL_SONGS[2];
  const laberintoOriginal = INITIAL_SONGS[3];

  // An earlier version of Noches de Cristal without the bridge strings
  const nochesV1Markdown = `---
id: "noches-de-cristal"
title: "Noches de Cristal"
status: "draft"
year: 2024
genre: "Indie Folk / Autor"
key: "Am"
tempo: 90
tuning: "Estándar (EADGBE)"
notes: "Primer borrador compuesto en casa con guitarra española."
createdAt: "2024-04-10T12:00:00Z"
updatedAt: "2024-05-12T16:00:00Z"
---

## Estrofa 1
[Am] Caminando por la calle ancha de los [F] faroles rotos,
[C] voy juntando en el bolsillo pedazos [G] de viejas fotos.
[Am] El asfalto devuelve un brillo [F] de plata y frío,
[C] mientras la ciudad olvida que alguna vez [G] tuviste un río.

## Estribillo (Borrador inicial)
[F] Y en estas noches de [C] cristal,
[G] donde nadie se atreve [Am] a hablar,
[F] dejamos la persiana [C] abierta
[G] para ver el tiempo [Am] pasar.`;

  // Earlier version of Laberintos de Otoño
  const laberintoV1Markdown = `---
id: "laberintos-de-otono"
title: "Laberintos de Otoño"
status: "draft"
year: 2026
genre: "Canción de Autor / Acústica"
key: "Em"
tempo: 94
tuning: "Estándar (EADGBE)"
notes: "Apunte rápido de acordes para no olvidar la melodía."
createdAt: "2026-02-10T10:00:00Z"
updatedAt: "2026-02-10T10:00:00Z"
---

## Estrofa 1
[Em] Caían las hojas como billetes viejos
[C] sobre los bancos de hierro del bulevar.
[G] Nos prometimos mirarnos desde lejos
[D] sin la tentación de volver a cruzar.`;

  return [
    {
      hash: 'a108f92',
      message: 'init: estructura inicial y primeros acordes de "Noches de Cristal"',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2024-05-12T16:00:00Z',
      filesChanged: ['songs/noches-de-cristal.md'],
      snapshot: {
        'noches-de-cristal': nochesV1Markdown
      }
    },
    {
      hash: 'b319e41',
      message: 'feat: agrega puente lírico, arreglos y publicación de "Noches de Cristal"',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2025-01-15T18:30:00Z',
      filesChanged: ['songs/noches-de-cristal.md'],
      snapshot: {
        'noches-de-cristal': songToMarkdown(nochesOriginal)
      }
    },
    {
      hash: 'c4e819b',
      message: 'feat: agrega balada en 3/4 "Faro de Sal" con afinación Drop D',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2025-08-20T11:15:00Z',
      filesChanged: ['songs/faro-de-sal.md'],
      snapshot: {
        'faro-de-sal': songToMarkdown(faroOriginal)
      }
    },
    {
      hash: 'e1d93aa',
      message: 'release: publicación oficial de "La Raíz del Viento" en Spotify',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2025-11-04T16:45:00Z',
      filesChanged: ['songs/la-raiz-del-viento.md'],
      snapshot: {
        'la-raiz-del-viento': songToMarkdown(raizOriginal)
      }
    },
    {
      hash: '93f0b42',
      message: 'draft: primeros compases y apuntes líricos de "Laberintos de Otoño"',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2026-02-10T10:00:00Z',
      filesChanged: ['songs/laberintos-de-otono.md'],
      snapshot: {
        'laberintos-de-otono': laberintoV1Markdown
      }
    },
    {
      hash: '7d41f0a',
      message: 'update: revisión de estrofa 2 e ideas para el estribillo de "Laberintos de Otoño"',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2026-10-15T09:20:00Z',
      filesChanged: ['songs/laberintos-de-otono.md'],
      snapshot: {
        'laberintos-de-otono': songToMarkdown(laberintoOriginal)
      }
    }
  ];
};

export class StorageService {
  /**
   * Merge two song catalogs preferring the most recent updatedAt value for each song.
   * Kept for backwards compatibility and delegates to reconcileWithCatalog.
   */
  static mergeSongsByUpdatedAt(localSongs: Song[], remoteSongs: Song[]): Song[] {
    return this.reconcileWithCatalog(localSongs, remoteSongs, 'catálogo remoto').songs;
  }

  /**
   * Reconciles local stored songs with an incoming catalog of songs (from bundled .md files or remote catalog.json).
   * Ensures new songs in the repository appear automatically, updated songs are merged, and local uncommitted
   * drafts by an author are preserved without requiring manual actions or clearing localStorage.
   */
  static reconcileWithCatalog(
    localSongs: Song[],
    incomingSongs: Song[],
    sourceName: string = 'remoto/empaquetado'
  ): { songs: Song[]; hasChanges: boolean } {
    if (!Array.isArray(incomingSongs) || incomingSongs.length === 0) {
      return { songs: localSongs, hasChanges: false };
    }

    const snapshot = this.getSnapshot();
    const localMap = new Map<string, Song>();
    (localSongs || []).forEach(s => localMap.set(s.id, s));

    const nextSnapshot: Record<string, string> = { ...snapshot };
    let hasChanges = false;

    const handledIds = new Set<string>();
    const reconciledSongs: Song[] = [];

    // 1. Process incoming songs from repository/catalog
    for (const incomingSong of incomingSongs) {
      handledIds.add(incomingSong.id);
      const localSong = localMap.get(incomingSong.id);

      if (!localSong) {
        // New song from repository! Add it seamlessly.
        reconciledSongs.push(incomingSong);
        nextSnapshot[incomingSong.id] = songToMarkdown(incomingSong);
        hasChanges = true;
        continue;
      }

      const committedMarkdown = snapshot[localSong.id];
      const localMarkdown = songToMarkdown(localSong);
      const incomingMarkdown = songToMarkdown(incomingSong);

      // Check if user has uncommitted changes locally
      const isLocallyModified = committedMarkdown !== undefined && localMarkdown.trim() !== committedMarkdown.trim();

      if (!isLocallyModified) {
        // Local song has NO uncommitted edits (either a visitor or an author whose work was committed).
        // If incoming song is different in any way (lyrics, chords, key, tempo, tags, status, updatedAt),
        // adopt the incoming repository version.
        const isDifferent = localMarkdown.trim() !== incomingMarkdown.trim() ||
          localSong.status !== incomingSong.status ||
          localSong.genre !== incomingSong.genre ||
          localSong.key !== incomingSong.key ||
          localSong.tempo !== incomingSong.tempo ||
          JSON.stringify(localSong.tags || []) !== JSON.stringify(incomingSong.tags || []);

        if (isDifferent) {
          reconciledSongs.push(incomingSong);
          nextSnapshot[incomingSong.id] = incomingMarkdown;
          hasChanges = true;
        } else {
          // If tags were missing in local, adopt tags from incoming
          if ((!localSong.tags || localSong.tags.length === 0) && incomingSong.tags && incomingSong.tags.length > 0) {
            reconciledSongs.push({ ...localSong, tags: incomingSong.tags });
            hasChanges = true;
          } else {
            reconciledSongs.push(localSong);
          }
        }
      } else {
        // Local song has uncommitted edits on this device.
        const localTs = Date.parse(localSong.updatedAt || '0');
        const incomingTs = Date.parse(incomingSong.updatedAt || '0');

        if (Number.isFinite(incomingTs) && Number.isFinite(localTs) && incomingTs > localTs) {
          // The incoming version from the repo is strictly newer than when the local draft was touched.
          // Backup local state first so user work is never lost:
          try {
            this.createBackupPoint(
              `Backup automático antes de actualizar "${localSong.title}" desde ${sourceName}`,
              'pre_sync'
            );
          } catch {
            // ignore backup failure
          }
          reconciledSongs.push(incomingSong);
          nextSnapshot[incomingSong.id] = incomingMarkdown;
          hasChanges = true;
        } else {
          // Keep the local uncommitted draft intact so author work is preserved
          reconciledSongs.push(localSong);
        }
      }
    }

    // 2. Process local songs that were NOT in incomingSongs
    for (const localSong of (localSongs || [])) {
      if (handledIds.has(localSong.id)) continue;

      const committedMarkdown = snapshot[localSong.id];
      const localMarkdown = songToMarkdown(localSong);
      const isLocallyCreated = committedMarkdown === undefined;
      const isLocallyModified = committedMarkdown !== undefined && localMarkdown.trim() !== committedMarkdown.trim();

      if (isLocallyCreated || isLocallyModified) {
        // Author created or modified this song locally, keep it!
        reconciledSongs.push(localSong);
      } else {
        // This song was previously committed but has been deleted from the repository.
        // Since local user made no edits to it, remove it cleanly.
        delete nextSnapshot[localSong.id];
        hasChanges = true;
      }
    }

    // 3. Sort reconciled songs consistently (published first, then drafts, then private; then year/recency)
    reconciledSongs.sort((a, b) => {
      const statusOrder: Record<string, number> = { published: 1, draft: 2, private: 3 };
      const orderDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (orderDiff !== 0) return orderDiff;
      const bTs = Date.parse(b.updatedAt || new Date(0).toISOString());
      const aTs = Date.parse(a.updatedAt || new Date(0).toISOString());
      if (bTs !== aTs) return bTs - aTs;
      return (b.year || 0) - (a.year || 0);
    });

    if (hasChanges) {
      this.saveSongs(reconciledSongs);
      try {
        localStorage.setItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT, JSON.stringify(nextSnapshot));
      } catch (err) {
        console.warn('Failed to update snapshot during catalog reconciliation', err);
      }
    }

    return { songs: reconciledSongs, hasChanges };
  }

  /**
   * Load all songs from local storage, seamlessly reconciling with bundled repository songs.
   * Any newly pushed songs or updates in the repository are automatically incorporated
   * for every visitor on any device without requiring manual cache clearing.
   */
  static getSongs(): Song[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SONGS);
      if (stored) {
        const localSongs: Song[] = JSON.parse(stored);
        if (Array.isArray(localSongs) && localSongs.length > 0) {
          const { songs: reconciled } = this.reconcileWithCatalog(
            localSongs,
            INITIAL_SONGS,
            'repositorio empaquetado (INITIAL_SONGS)'
          );
          return reconciled;
        }
      }
    } catch (e) {
      console.warn('Failed to parse songs from storage', e);
    }
    // Seed initial
    this.saveSongs(INITIAL_SONGS);
    this.saveSnapshot(INITIAL_SONGS);
    return INITIAL_SONGS;
  }

  /**
   * Save songs collection to local storage
   */
  static saveSongs(songs: Song[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify(songs));
    } catch (e) {
      console.error('Failed to save songs', e);
    }
  }

  /**
   * Save or update a single song
   */
  static upsertSong(song: Song): Song[] {
    const songs = this.getSongs();
    const existingIndex = songs.findIndex(s => s.id === song.id);
    const updatedSong: Song = {
      ...song,
      updatedAt: new Date().toISOString()
    };

    let updatedList: Song[];
    if (existingIndex >= 0) {
      updatedList = [...songs];
      updatedList[existingIndex] = updatedSong;
    } else {
      updatedList = [updatedSong, ...songs];
    }

    this.saveSongs(updatedList);
    return updatedList;
  }

  /**
   * Delete a song by ID
   */
  static deleteSong(id: string): Song[] {
    const songs = this.getSongs();
    const filtered = songs.filter(s => s.id !== id);
    this.saveSongs(filtered);
    return filtered;
  }

  /**
   * Rename a song file (id) from songs/oldId.md to songs/newId.md
   * updates the songs collection, snapshots, and optionally records a Git commit
   */
  static renameSongFile(
    oldId: string,
    newIdRaw: string,
    autoCommit: boolean = true
  ): { success: boolean; error?: string; songs: Song[]; renamedSong?: Song } {
    const cleanNewId = newIdRaw
      .trim()
      .toLowerCase()
      .replace(/\.md$/i, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanNewId) {
      return {
        success: false,
        error: 'El nombre del archivo no puede estar vacío y debe contener caracteres válidos (a-z, 0-9, guiones).',
        songs: this.getSongs()
      };
    }

    if (cleanNewId === oldId) {
      return {
        success: true,
        songs: this.getSongs(),
        renamedSong: this.getSongs().find(s => s.id === oldId)
      };
    }

    const songs = this.getSongs();
    if (songs.some(s => s.id === cleanNewId)) {
      return {
        success: false,
        error: `Ya existe otra canción con el archivo "songs/${cleanNewId}.md". Elige otro nombre.`,
        songs
      };
    }

    const songIndex = songs.findIndex(s => s.id === oldId);
    if (songIndex === -1) {
      return {
        success: false,
        error: `No se encontró la canción original con identificador "${oldId}".`,
        songs
      };
    }

    const targetSong = songs[songIndex];
    const renamedSong: Song = {
      ...targetSong,
      id: cleanNewId,
      updatedAt: new Date().toISOString()
    };

    const updatedSongs = [...songs];
    updatedSongs[songIndex] = renamedSong;
    this.saveSongs(updatedSongs);

    // Update snapshot: move snapshot[oldId] to snapshot[cleanNewId]
    const snapshot = this.getSnapshot();
    if (snapshot[oldId]) {
      snapshot[cleanNewId] = songToMarkdown(renamedSong);
      delete snapshot[oldId];
      try {
        localStorage.setItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT, JSON.stringify(snapshot));
      } catch (err) {
        console.warn('Failed to update snapshot on rename', err);
      }
    }

    if (autoCommit) {
      this.createGitCommit(
        `refactor(files): renombrar 'songs/${oldId}.md' a 'songs/${cleanNewId}.md'`
      );
    }

    return {
      success: true,
      songs: updatedSongs,
      renamedSong
    };
  }

  /**
   * Count how many commits have been created locally since the last push
   */
  static getUnpushedCommitsCount(): number {
    const commits = this.getCommits();
    const lastPushed = localStorage.getItem('tony_cancionero_last_push_v1');
    if (!lastPushed) return commits.length;
    const lastPushedTime = new Date(lastPushed).getTime();
    return commits.filter(c => new Date(c.timestamp).getTime() > lastPushedTime).length;
  }

  /**
   * Get Git commit history
   */
  static getCommits(): GitCommit[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMMITS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse git commits', e);
    }
    const initial = createInitialCommits();
    this.saveCommits(initial);
    return initial;
  }

  static saveCommits(commits: GitCommit[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_COMMITS, JSON.stringify(commits));
    } catch (e) {
      console.error('Failed to save commits', e);
    }
  }

  /**
   * Snapshot dictionary of committed markdown content by song ID
   */
  static getSnapshot(): Record<string, string> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse snapshot', e);
    }
    return {};
  }

  static saveSnapshot(songs: Song[]): void {
    const snapshot: Record<string, string> = {};
    songs.forEach(s => {
      snapshot[s.id] = songToMarkdown(s);
    });
    localStorage.setItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT, JSON.stringify(snapshot));
  }

  /**
   * Calculate git status against the last committed snapshot
   */
  static getGitStatus(): GitStatusSummary {
    const currentSongs = this.getSongs();
    const snapshot = this.getSnapshot();

    const modified: string[] = [];
    const created: string[] = [];
    const deleted: string[] = [];

    const currentMap = new Map<string, Song>();
    currentSongs.forEach(s => currentMap.set(s.id, s));

    // Check current songs against snapshot
    currentSongs.forEach(song => {
      const committedMarkdown = snapshot[song.id];
      if (!committedMarkdown) {
        created.push(`songs/${song.id}.md`);
      } else {
        const currentMarkdown = songToMarkdown(song);
        if (currentMarkdown.trim() !== committedMarkdown.trim()) {
          modified.push(`songs/${song.id}.md`);
        }
      }
    });

    // Check for deleted
    Object.keys(snapshot).forEach(songId => {
      if (!currentMap.has(songId)) {
        deleted.push(`songs/${songId}.md`);
      }
    });

    const isClean = modified.length === 0 && created.length === 0 && deleted.length === 0;

    return {
      modified,
      created,
      deleted,
      isClean
    };
  }

  /**
   * Create a new Git commit recording current files state
   */
  static createGitCommit(message: string, author: string = 'Tony <tony@tonygb.com>'): { commit: GitCommit; status: GitStatusSummary } {
    const songs = this.getSongs();
    const status = this.getGitStatus();

    const filesChanged = [...status.created, ...status.modified, ...status.deleted];
    if (filesChanged.length === 0) {
      filesChanged.push('catalog.json');
    }

    const hash = Math.random().toString(16).substring(2, 9);
    const newCommit: GitCommit = {
      hash,
      message: message.trim() || `chore: actualización del cancionero (${new Date().toLocaleDateString('es-ES')})`,
      author,
      timestamp: new Date().toISOString(),
      filesChanged,
      snapshot: {}
    };

    // Store markdown snapshot for rollback
    songs.forEach(s => {
      newCommit.snapshot[s.id] = songToMarkdown(s);
    });

    // Update commits list
    const currentCommits = this.getCommits();
    const updatedCommits = [newCommit, ...currentCommits];
    this.saveCommits(updatedCommits);

    // Save current state as baseline snapshot
    this.saveSnapshot(songs);

    return {
      commit: newCommit,
      status: this.getGitStatus()
    };
  }

  /**
   * Retrieve the version history specifically associated with a single song
   */
  static getSongVersionHistory(songId: string): SongVersionRecord[] {
    const commits = this.getCommits();
    const currentSongs = this.getSongs();
    const currentSong = currentSongs.find(s => s.id === songId);
    const currentMarkdown = currentSong ? songToMarkdown(currentSong) : '';

    const records: SongVersionRecord[] = [];

    // Filter commits that touched this song or have a snapshot for it
    commits.forEach(commit => {
      const hasChangedFile = commit.filesChanged?.some(f => f.includes(songId));
      const snapshotMarkdown = commit.snapshot?.[songId];

      if (snapshotMarkdown || hasChangedFile) {
        const md = snapshotMarkdown || currentMarkdown;
        records.push({
          commit,
          markdown: md,
          isCurrent: md.trim() === currentMarkdown.trim()
        });
      }
    });

    // Ensure there is at least one record (the current version)
    if (records.length === 0 && currentSong) {
      records.push({
        commit: {
          hash: currentSong.gitHash || 'head-current',
          message: `Estado actual de la composición "${currentSong.title}"`,
          author: 'Tony <tony@tonygb.com>',
          timestamp: currentSong.updatedAt,
          filesChanged: [`songs/${songId}.md`],
          snapshot: { [songId]: currentMarkdown }
        },
        markdown: currentMarkdown,
        isCurrent: true
      });
    }

    return records;
  }

  /**
   * Revert a song to a previous historical version
   */
  static restoreSongVersion(songId: string, markdown: string, commitHash: string): Song {
    const restored = markdownToSong(markdown, songId);
    this.upsertSong(restored);
    this.createGitCommit(`revert: restaurar versión [${commitHash}] de '${restored.title}'`);
    return restored;
  }

  /**
   * Reset data to initial demo state
   */
  static resetToDefault(): Song[] {
    // Create automatic safety backup point before resetting
    this.createBackupPoint(
      'Backup automático previo a restablecer catálogo inicial de demostración',
      'pre_reset'
    );
    this.saveSongs(INITIAL_SONGS);
    this.saveSnapshot(INITIAL_SONGS);
    const initialCommits = createInitialCommits();
    this.saveCommits(initialCommits);
    return INITIAL_SONGS;
  }

  /**
   * Import songs from JSON string
   */
  static importFromJson(jsonString: string): { success: boolean; count: number; error?: string; backup?: SongBackupPoint } {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data)) {
        throw new Error('El archivo JSON debe contener un arreglo de canciones.');
      }

      // Automatic backup point before mass JSON import
      const backup = this.createBackupPoint(
        `Backup automático previo a importar archivo JSON (${data.length} temas)`,
        'pre_import_json'
      );

      const existing = this.getSongs();
      const existingMap = new Map(existing.map(s => [s.id, s]));

      let addedOrUpdated = 0;
      data.forEach(item => {
        if (item.id && item.title) {
          existingMap.set(item.id, {
            ...item,
            status: item.status || 'draft',
            lyrics: item.lyrics || '',
            updatedAt: new Date().toISOString()
          });
          addedOrUpdated++;
        }
      });

      const merged = Array.from(existingMap.values());
      this.saveSongs(merged);
      return { success: true, count: addedOrUpdated, backup };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Error al procesar JSON' };
    }
  }

  /**
   * Import a single Markdown file
   */
  static importFromMarkdown(filename: string, content: string): { success: boolean; song?: Song; error?: string } {
    try {
      const fallbackId = filename.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const song = markdownToSong(content, fallbackId);
      this.upsertSong(song);
      return { success: true, song };
    } catch (e: any) {
      return { success: false, error: e.message || 'Error al procesar Markdown' };
    }
  }

  /**
   * Retrieve all saved backup points (restore points)
   */
  static getBackupPoints(): SongBackupPoint[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BACKUPS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Error reading backup points from localStorage:', err);
    }
    return [];
  }

  /**
   * Save backup points list to localStorage (retains up to 20 most recent points)
   */
  static saveBackupPoints(backups: SongBackupPoint[]): void {
    try {
      const trimmed = backups.slice(0, 20);
      localStorage.setItem(STORAGE_KEY_BACKUPS, JSON.stringify(trimmed));
    } catch (err) {
      console.warn('Error saving backup points to localStorage:', err);
    }
  }

  /**
   * Create an automatic or manual restore point of the entire songs catalog
   */
  static createBackupPoint(
    name: string,
    reason: SongBackupPoint['reason'] = 'manual'
  ): SongBackupPoint {
    const currentSongs = this.getSongs();
    const songsJson = JSON.stringify(currentSongs, null, 2);

    const backupPoint: SongBackupPoint = {
      id: `backup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      name: name.trim() || `Punto de restauración (${new Date().toLocaleTimeString('es-ES')})`,
      reason,
      songCount: currentSongs.length,
      songsJson,
      songsSummary: currentSongs.map(s => ({
        id: s.id,
        title: s.title,
        key: s.key,
        status: s.status
      }))
    };

    const currentBackups = this.getBackupPoints();
    const updated = [backupPoint, ...currentBackups];
    this.saveBackupPoints(updated);

    return backupPoint;
  }

  /**
   * Revert the entire songs catalog to a previously saved backup point
   */
  static restoreBackupPoint(backupId: string): {
    success: boolean;
    songs?: Song[];
    backup?: SongBackupPoint;
    error?: string;
  } {
    try {
      const backups = this.getBackupPoints();
      const target = backups.find(b => b.id === backupId);

      if (!target) {
        return { success: false, error: 'Punto de restauración no encontrado.' };
      }

      // Create a safety checkpoint of current state before restoring
      this.createBackupPoint(
        `Punto de seguridad previo a revertir a "${target.name}"`,
        'manual'
      );

      const parsedSongs: Song[] = JSON.parse(target.songsJson);
      if (!Array.isArray(parsedSongs)) {
        throw new Error('El contenido del backup no es un catálogo de canciones válido.');
      }

      // Save restored songs
      this.saveSongs(parsedSongs);
      this.saveSnapshot(parsedSongs);

      // Create a Git commit marking this restoration
      this.createGitCommit(
        `revert: revertir cancionero completo al punto de restauración '${target.name}' (${parsedSongs.length} temas)`
      );

      return {
        success: true,
        songs: parsedSongs,
        backup: target
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error al restaurar el punto de backup.'
      };
    }
  }

  /**
   * Delete a specific backup point
   */
  static deleteBackupPoint(backupId: string): boolean {
    const backups = this.getBackupPoints();
    const filtered = backups.filter(b => b.id !== backupId);
    this.saveBackupPoints(filtered);
    return true;
  }

  /**
   * Clear all backup points
   */
  static clearAllBackups(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_BACKUPS);
    } catch (e) {
      console.warn('Error clearing backups', e);
    }
  }
}
