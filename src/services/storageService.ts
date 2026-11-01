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

// Initial commit history with real snapshots from canonical repository songs
const createInitialCommits = (): GitCommit[] => {
  const s0 = INITIAL_SONGS[0];
  const s1 = INITIAL_SONGS[1];
  const s2 = INITIAL_SONGS[2];
  const s3 = INITIAL_SONGS[3];

  const commits: GitCommit[] = [];

  if (s0) {
    commits.push({
      hash: 'a108f92',
      message: `init: estructura inicial y primeros acordes de "${s0.title}"`,
      author: 'Tony <tony@tonygb.com>',
      timestamp: s0.createdAt || '2024-05-12T16:00:00Z',
      filesChanged: [`songs/${s0.id}.md`],
      snapshot: { [s0.id]: songToMarkdown(s0) }
    });
  }

  if (s1) {
    commits.push({
      hash: 'b319e41',
      message: `feat: arreglos y publicación de "${s1.title}"`,
      author: 'Tony <tony@tonygb.com>',
      timestamp: s1.createdAt || '2025-01-15T18:30:00Z',
      filesChanged: [`songs/${s1.id}.md`],
      snapshot: { [s1.id]: songToMarkdown(s1) }
    });
  }

  if (s2) {
    commits.push({
      hash: 'c4e819b',
      message: `feat: acordes y metadatos de "${s2.title}"`,
      author: 'Tony <tony@tonygb.com>',
      timestamp: s2.createdAt || '2025-08-20T11:15:00Z',
      filesChanged: [`songs/${s2.id}.md`],
      snapshot: { [s2.id]: songToMarkdown(s2) }
    });
  }

  if (s3) {
    commits.push({
      hash: 'e1d93aa',
      message: `feat: registro de composición "${s3.title}"`,
      author: 'Tony <tony@tonygb.com>',
      timestamp: s3.createdAt || '2025-11-04T16:45:00Z',
      filesChanged: [`songs/${s3.id}.md`],
      snapshot: { [s3.id]: songToMarkdown(s3) }
    });
  }

  return commits.length > 0 ? commits : [
    {
      hash: 'init123',
      message: 'init: catálogo completo de canciones del cancionero',
      author: 'Tony <tony@tonygb.com>',
      timestamp: new Date().toISOString(),
      filesChanged: ['catalog.json'],
      snapshot: {}
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

    // Obsolete mock template song IDs that do not exist in the actual /songs repository
    const legacyMockIds = new Set([
      'noches-de-cristal',
      'faro-de-sal',
      'la-raiz-del-viento',
      'laberintos-de-otono'
    ]);

    // 1. Process incoming songs from repository/catalog
    for (const incomingSong of incomingSongs) {
      handledIds.add(incomingSong.id);
      const localSong = localMap.get(incomingSong.id);

      // Ensure lyrics are never erased if incoming catalog only has metadata (e.g., from stripped JSON)
      const bundledSong = INITIAL_SONGS.find(s => s.id === incomingSong.id);
      const effectiveLyrics = (incomingSong.lyrics && incomingSong.lyrics.trim().length > 0)
        ? incomingSong.lyrics
        : (localSong?.lyrics && localSong.lyrics.trim().length > 0)
          ? localSong.lyrics
          : bundledSong?.lyrics || '';

      const resolvedIncoming: Song = {
        ...bundledSong,
        ...localSong,
        ...incomingSong,
        lyrics: effectiveLyrics
      };

      if (!localSong) {
        // New song from repository! Add it seamlessly.
        reconciledSongs.push(resolvedIncoming);
        nextSnapshot[resolvedIncoming.id] = songToMarkdown(resolvedIncoming);
        hasChanges = true;
        continue;
      }

      const committedMarkdown = snapshot[localSong.id];
      const localMarkdown = songToMarkdown(localSong);
      const incomingMarkdown = songToMarkdown(resolvedIncoming);

      // Check if user has uncommitted changes locally
      const isLocallyModified = committedMarkdown !== undefined && localMarkdown.trim() !== committedMarkdown.trim();

      if (!isLocallyModified) {
        // Local song has NO uncommitted edits (either a visitor or an author whose work was committed).
        // If incoming song is different in any way (lyrics, chords, key, tempo, tags, status, updatedAt),
        // adopt the incoming repository version.
        const isDifferent = localMarkdown.trim() !== incomingMarkdown.trim() ||
          localSong.status !== resolvedIncoming.status ||
          localSong.genre !== resolvedIncoming.genre ||
          localSong.key !== resolvedIncoming.key ||
          localSong.tempo !== resolvedIncoming.tempo ||
          JSON.stringify(localSong.tags || []) !== JSON.stringify(resolvedIncoming.tags || []);

        if (isDifferent) {
          reconciledSongs.push(resolvedIncoming);
          nextSnapshot[resolvedIncoming.id] = incomingMarkdown;
          hasChanges = true;
        } else {
          // If tags or lyrics were missing in local, adopt from incoming
          let updatedItem = localSong;
          let itemChanged = false;
          if ((!localSong.tags || localSong.tags.length === 0) && resolvedIncoming.tags && resolvedIncoming.tags.length > 0) {
            updatedItem = { ...updatedItem, tags: resolvedIncoming.tags };
            itemChanged = true;
          }
          if ((!localSong.lyrics || localSong.lyrics.trim().length === 0) && effectiveLyrics) {
            updatedItem = { ...updatedItem, lyrics: effectiveLyrics };
            itemChanged = true;
          }
          if (itemChanged) {
            reconciledSongs.push(updatedItem);
            hasChanges = true;
          } else {
            reconciledSongs.push(localSong);
          }
        }
      } else {
        // Local song has uncommitted edits on this device.
        const localTs = Date.parse(localSong.updatedAt || '0');
        const incomingTs = Date.parse(resolvedIncoming.updatedAt || '0');

        if (Number.isFinite(incomingTs) && Number.isFinite(localTs) && incomingTs > localTs) {
          // The incoming version from the repo is strictly newer than when the local draft was touched.
          // Backup local state first so user work is never lost:
          try {
            this.createBackupPoint(
              `Backup automático antes de actualizar "${localSong.title}" desde ${sourceName}`,
              'pre_sync',
              localSongs
            );
          } catch {
            // ignore backup failure
          }
          reconciledSongs.push(resolvedIncoming);
          nextSnapshot[resolvedIncoming.id] = incomingMarkdown;
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

      // Purge obsolete mock songs that do not belong to the repository
      if (legacyMockIds.has(localSong.id)) {
        delete nextSnapshot[localSong.id];
        hasChanges = true;
        continue;
      }

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
   * Find a song by its unique identifier
   */
  static getSongById(id: string): Song | undefined {
    return this.getSongs().find(s => s.id === id);
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
   * Delete a song by ID, cleaning up snapshot and recording local commit
   */
  static deleteSong(id: string, autoCommit: boolean = true): { success: boolean; songs: Song[]; deletedSong?: Song } {
    const songs = this.getSongs();
    const targetSong = songs.find(s => s.id === id);
    const filtered = songs.filter(s => s.id !== id);
    this.saveSongs(filtered);

    // Clean up snapshot entry for this song
    const snapshot = this.getSnapshot();
    if (snapshot[id]) {
      delete snapshot[id];
      try {
        localStorage.setItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT, JSON.stringify(snapshot));
      } catch (err) {
        console.warn('Failed to update snapshot on delete', err);
      }
    }

    if (autoCommit && targetSong) {
      const commit: GitCommit = {
        hash: Math.random().toString(16).substring(2, 9),
        message: `delete: eliminar canción "${targetSong.title}" (songs/${id}.md)`,
        author: 'Tony (Autor)',
        timestamp: new Date().toISOString(),
        filesChanged: [`songs/${id}.md`],
        snapshot: { ...this.getSnapshot() }
      };
      this.saveCommits([commit, ...this.getCommits()]);
    }

    return { success: true, songs: filtered, deletedSong: targetSong };
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
    reason: SongBackupPoint['reason'] = 'manual',
    songsToBackup?: Song[]
  ): SongBackupPoint {
    let currentSongs = songsToBackup;
    if (!currentSongs) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_SONGS);
        currentSongs = stored ? JSON.parse(stored) : [];
      } catch {
        currentSongs = [];
      }
    }
    const safeSongs = currentSongs || [];
    const songsJson = JSON.stringify(safeSongs, null, 2);

    const backupPoint: SongBackupPoint = {
      id: `backup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      name: name.trim() || `Punto de restauración (${new Date().toLocaleTimeString('es-ES')})`,
      reason,
      songCount: safeSongs.length,
      songsJson,
      songsSummary: safeSongs.map(s => ({
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
