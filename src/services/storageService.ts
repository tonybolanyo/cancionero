import { Song, GitCommit, GitStatusSummary } from '../types/song';
import { Album } from '../types/album';
import { INITIAL_SONGS } from '../data/initialSongs';
import { INITIAL_ALBUMS } from '../data/initialAlbums';
import { songToMarkdown, markdownToSong, isValidPlayableAudioUrl } from '../utils/markdownParser';
import { isStoredSessionAuthorized, AUTHORIZED_GITHUB_USER } from '../utils/authConfig';
import { IndexedDbStore, KV_KEYS, MigrationBundle } from './indexedDbStore';
import {
  MAX_BACKUP_POINTS,
  SongBackupPoint,
  StoredBackupEntry,
  encodeBackupArchive,
  decodeBackupArchive
} from '../utils/backupCompression';

export const STORAGE_KEY_SONGS = 'tony_cancionero_songs_v1';
export const STORAGE_KEY_ALBUMS = 'tony_cancionero_albums_v1';
export const STORAGE_KEY_COMMITS = 'tony_cancionero_git_commits_v1';
export const STORAGE_KEY_LAST_COMMITTED_SNAPSHOT = 'tony_cancionero_git_snapshot_v1';
export const STORAGE_KEY_BACKUPS = 'tony_cancionero_backup_points_v1';

const LEGACY_DATA_KEYS = [
  STORAGE_KEY_SONGS,
  STORAGE_KEY_ALBUMS,
  STORAGE_KEY_COMMITS,
  STORAGE_KEY_LAST_COMMITTED_SNAPSHOT,
  STORAGE_KEY_BACKUPS
] as const;

export type { SongBackupPoint };
export { MAX_BACKUP_POINTS };

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

function safeReadLocalStorageJson<T>(key: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Failed to parse localStorage key "${key}":`, err);
    return null;
  }
}

function safeWriteLocalStorageJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write localStorage key "${key}":`, err);
  }
}

function safeRemoveLocalStorage(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function sanitizeSongsList(songs: Song[]): Song[] {
  return (songs || []).map(s => {
    if (s.audioUrl && (s.audioUrl.startsWith('blob:') || !isValidPlayableAudioUrl(s.audioUrl))) {
      return { ...s, audioUrl: undefined };
    }
    return s;
  });
}

export class StorageService {
  private static cache: {
    songs: Song[] | null;
    albums: Album[] | null;
    commits: GitCommit[] | null;
    snapshot: Record<string, string> | null;
    backups: SongBackupPoint[] | null;
  } = {
    songs: null,
    albums: null,
    commits: null,
    snapshot: null,
    backups: null
  };

  private static isHydrated = false;
  private static initPromise: Promise<void> | null = null;
  private static writeQueue: Promise<void> = Promise.resolve();
  private static markdownCache = new WeakMap<Song, string>();
  private static reconciliationCount = 0;

  private static getSongMarkdownCached(song: Song): string {
    const cached = this.markdownCache.get(song);
    if (cached !== undefined) return cached;
    const md = songToMarkdown(song);
    this.markdownCache.set(song, md);
    return md;
  }

  private static enqueueDbWrite(task: () => Promise<void>): void {
    if (!IndexedDbStore.isAvailable()) return;
    this.writeQueue = this.writeQueue
      .then(() => task())
      .catch(err => {
        console.warn('IndexedDB persistence write failed:', err);
      });
  }

  /**
   * Returns whether IndexedDB/storage hydration has completed.
   */
  static isReady(): boolean {
    return this.isHydrated;
  }

  /**
   * Returns how many times reconcileWithCatalog() has executed (useful for performance diagnostics & tests).
   */
  static getReconciliationCount(): number {
    return this.reconciliationCount;
  }

  /**
   * Waits for all queued asynchronous IndexedDB writes to finish.
   */
  static async flush(): Promise<void> {
    await this.writeQueue;
  }

  /**
   * Resets in-memory caches and optionally clears IndexedDB/localStorage (primarily for unit tests).
   */
  static async resetForTesting(clearPersistence: boolean = true): Promise<void> {
    await this.writeQueue;
    this.cache = {
      songs: null,
      albums: null,
      commits: null,
      snapshot: null,
      backups: null
    };
    this.isHydrated = false;
    this.initPromise = null;
    this.reconciliationCount = 0;
    this.markdownCache = new WeakMap<Song, string>();

    if (clearPersistence) {
      if (IndexedDbStore.isAvailable()) {
        await IndexedDbStore.clearAll();
      }
      for (const key of LEGACY_DATA_KEYS) {
        safeRemoveLocalStorage(key);
      }
    }
  }

  /**
   * Initializes IndexedDB persistence, runs one-time transparent migration from legacy
   * localStorage keys, hydrates the in-memory cache, and reconciles with bundled
   * INITIAL_SONGS once at startup.
   */
  static init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInit().catch(err => {
      console.warn('StorageService.init() encountered an error, falling back gracefully:', err);
      this.isHydrated = true;
    });

    return this.initPromise;
  }

  private static async performInit(): Promise<void> {
    if (!IndexedDbStore.isAvailable()) {
      // Headless environment without IndexedDB (e.g., Node test runner with mocked localStorage)
      this.isHydrated = true;
      return;
    }

    await IndexedDbStore.open();

    // 1. Check existing IndexedDB state & migration flag
    const [
      migrationMeta,
      existingDbSongs,
      existingDbAlbums,
      existingDbCommits,
      existingDbSnapshot,
      existingDbBackups
    ] = await Promise.all([
      IndexedDbStore.getKV<{ completed: boolean; migratedAt: string; migratedKeys: string[] }>(KV_KEYS.MIGRATION_V1),
      IndexedDbStore.getAllSongs(),
      IndexedDbStore.getAllAlbums(),
      IndexedDbStore.getKV<GitCommit[]>(KV_KEYS.COMMITS),
      IndexedDbStore.getKV<Record<string, string>>(KV_KEYS.SNAPSHOT),
      IndexedDbStore.getKV<Array<StoredBackupEntry | SongBackupPoint>>(KV_KEYS.BACKUPS)
    ]);

    let dbSongs = existingDbSongs;
    let dbAlbums = existingDbAlbums;
    let dbCommits = existingDbCommits;
    let dbSnapshot = existingDbSnapshot;
    let dbBackups = existingDbBackups;

    // 2. Transparent one-time migration from legacy localStorage keys
    const legacySongs = safeReadLocalStorageJson<Song[]>(STORAGE_KEY_SONGS);
    const legacyAlbums = safeReadLocalStorageJson<Album[]>(STORAGE_KEY_ALBUMS);
    const legacyCommits = safeReadLocalStorageJson<GitCommit[]>(STORAGE_KEY_COMMITS);
    const legacySnapshot = safeReadLocalStorageJson<Record<string, string>>(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT);
    const legacyBackups = safeReadLocalStorageJson<Array<StoredBackupEntry | SongBackupPoint>>(STORAGE_KEY_BACKUPS);

    const hasLegacyKeys =
      legacySongs !== null ||
      legacyAlbums !== null ||
      legacyCommits !== null ||
      legacySnapshot !== null ||
      legacyBackups !== null;

    if (hasLegacyKeys || !migrationMeta?.completed) {
      const bundle: MigrationBundle = {};
      const migratedKeys: string[] = [];

      if (Array.isArray(legacySongs) && legacySongs.length > 0 && dbSongs.length === 0) {
        const sanitized = sanitizeSongsList(legacySongs);
        bundle.songs = sanitized;
        dbSongs = sanitized;
        migratedKeys.push(STORAGE_KEY_SONGS);
      }

      if (Array.isArray(legacyAlbums) && legacyAlbums.length > 0 && dbAlbums.length === 0) {
        bundle.albums = legacyAlbums;
        dbAlbums = legacyAlbums;
        migratedKeys.push(STORAGE_KEY_ALBUMS);
      }

      if (Array.isArray(legacyCommits) && legacyCommits.length > 0 && !dbCommits) {
        bundle.commits = legacyCommits;
        dbCommits = legacyCommits;
        migratedKeys.push(STORAGE_KEY_COMMITS);
      }

      if (legacySnapshot && typeof legacySnapshot === 'object' && !Array.isArray(legacySnapshot) && !dbSnapshot) {
        bundle.snapshot = legacySnapshot;
        dbSnapshot = legacySnapshot;
        migratedKeys.push(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT);
      }

      if (Array.isArray(legacyBackups) && legacyBackups.length > 0 && !dbBackups) {
        const decoded = decodeBackupArchive(legacyBackups).slice(0, MAX_BACKUP_POINTS);
        const compressedArchive = encodeBackupArchive(decoded);
        bundle.backups = compressedArchive;
        dbBackups = compressedArchive;
        migratedKeys.push(STORAGE_KEY_BACKUPS);
      }

      bundle.migrationMeta = {
        completed: true,
        migratedAt: new Date().toISOString(),
        migratedKeys
      };

      await IndexedDbStore.batchMigrate(bundle);

      // Remove heavy legacy keys from localStorage now that IndexedDB has safely committed them
      for (const key of LEGACY_DATA_KEYS) {
        safeRemoveLocalStorage(key);
      }
    }

    // 3. Hydrate in-memory cache (snapshot, commits, backups, albums BEFORE songs reconciliation)
    this.cache.snapshot = dbSnapshot && typeof dbSnapshot === 'object' ? dbSnapshot : {};

    if (Array.isArray(dbCommits) && dbCommits.length > 0) {
      this.cache.commits = dbCommits;
    } else {
      const initialCommits = createInitialCommits();
      this.cache.commits = initialCommits;
      await IndexedDbStore.setKV(KV_KEYS.COMMITS, initialCommits);
    }

    if (Array.isArray(dbBackups) && dbBackups.length > 0) {
      this.cache.backups = decodeBackupArchive(dbBackups).slice(0, MAX_BACKUP_POINTS);
    } else {
      this.cache.backups = [];
    }

    if (Array.isArray(dbAlbums) && dbAlbums.length > 0) {
      this.cache.albums = dbAlbums;
    } else {
      const initialAlbums = [...INITIAL_ALBUMS];
      this.cache.albums = initialAlbums;
      await IndexedDbStore.replaceAllAlbums(initialAlbums);
    }

    // 4. Hydrate songs and run reconcileWithCatalog() ONCE at startup
    if (Array.isArray(dbSongs) && dbSongs.length > 0) {
      const sanitizedSongs = sanitizeSongsList(dbSongs);
      this.cache.songs = sanitizedSongs;
      const { songs: reconciled } = this.reconcileWithCatalog(
        sanitizedSongs,
        INITIAL_SONGS,
        'repositorio empaquetado (INITIAL_SONGS)',
        { pruneDeleted: false }
      );
      this.cache.songs = reconciled;
    } else {
      const initialSongs = sanitizeSongsList(INITIAL_SONGS);
      this.cache.songs = initialSongs;
      await IndexedDbStore.replaceAllSongs(initialSongs);
      const initialSnapshot = this.buildSnapshotRecord(initialSongs);
      this.cache.snapshot = initialSnapshot;
      await IndexedDbStore.setKV(KV_KEYS.SNAPSHOT, initialSnapshot);
    }

    this.isHydrated = true;
    await this.writeQueue;
  }

  private static buildSnapshotRecord(songs: Song[]): Record<string, string> {
    const snapshot: Record<string, string> = {};
    songs.forEach(s => {
      snapshot[s.id] = this.getSongMarkdownCached(s);
    });
    return snapshot;
  }

  /**
   * Merge two song catalogs preferring the most recent updatedAt value for each song.
   * Kept for backwards compatibility and delegates to reconcileWithCatalog.
   */
  static mergeSongsByUpdatedAt(localSongs: Song[], remoteSongs: Song[]): Song[] {
    return this.reconcileWithCatalog(localSongs, remoteSongs, 'catálogo remoto').songs;
  }

  /**
   * Reconciles local stored songs with an incoming catalog of songs (from bundled .md files or remote catalog.json).
   * Executed ONLY on startup hydration or after a remote sync.
   */
  static reconcileWithCatalog(
    localSongs: Song[],
    incomingSongs: Song[],
    sourceName: string = 'remoto/empaquetado',
    options?: { pruneDeleted?: boolean }
  ): { songs: Song[]; hasChanges: boolean; preservedConflictIds?: string[] } {
    this.reconciliationCount += 1;
    const pruneDeleted = options?.pruneDeleted ?? true;

    if (!Array.isArray(incomingSongs) || incomingSongs.length === 0) {
      return { songs: localSongs, hasChanges: false };
    }

    const snapshot = this.getSnapshot();
    const localMap = new Map<string, Song>();
    (localSongs || []).forEach(s => localMap.set(s.id, s));

    const bundledMap = new Map<string, Song>();
    INITIAL_SONGS.forEach(s => bundledMap.set(s.id, s));

    const nextSnapshot: Record<string, string> = { ...snapshot };
    let hasChanges = false;
    const preservedConflictIds: string[] = [];

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
      const bundledSong = bundledMap.get(incomingSong.id);
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
        nextSnapshot[resolvedIncoming.id] = this.getSongMarkdownCached(resolvedIncoming);
        hasChanges = true;
        continue;
      }

      const committedMarkdown = snapshot[localSong.id];
      const localMarkdown = this.getSongMarkdownCached(localSong);
      const incomingMarkdown = this.getSongMarkdownCached(resolvedIncoming);

      // Check if user has uncommitted changes locally (modified vs snapshot OR locally created without snapshot)
      const isLocallyCreatedConflict =
        committedMarkdown === undefined && localMarkdown.trim() !== incomingMarkdown.trim();
      const isLocallyModified =
        (committedMarkdown !== undefined && localMarkdown.trim() !== committedMarkdown.trim()) ||
        isLocallyCreatedConflict;

      if (!isLocallyModified) {
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
        // If remote matches the last committed base snapshot, remote has NOT changed — never overwrite local edits.
        const remoteUnchangedSinceSnapshot =
          committedMarkdown !== undefined && incomingMarkdown.trim() === committedMarkdown.trim();

        if (remoteUnchangedSinceSnapshot) {
          reconciledSongs.push(localSong);
          preservedConflictIds.push(localSong.id);
          continue;
        }

        const localTs = Date.parse(localSong.updatedAt || '0');
        const incomingTs = Date.parse(resolvedIncoming.updatedAt || '0');

        if (Number.isFinite(incomingTs) && Number.isFinite(localTs) && incomingTs > localTs) {
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
          reconciledSongs.push(localSong);
          preservedConflictIds.push(localSong.id);
        }
      }
    }

    // 2. Process local songs that were NOT in incomingSongs
    for (const localSong of (localSongs || [])) {
      if (handledIds.has(localSong.id)) continue;

      if (legacyMockIds.has(localSong.id)) {
        delete nextSnapshot[localSong.id];
        hasChanges = true;
        continue;
      }

      const committedMarkdown = snapshot[localSong.id];
      const localMarkdown = this.getSongMarkdownCached(localSong);
      const isLocallyCreated = committedMarkdown === undefined;
      const isLocallyModified = committedMarkdown !== undefined && localMarkdown.trim() !== committedMarkdown.trim();

      if (isLocallyCreated || isLocallyModified || !pruneDeleted) {
        reconciledSongs.push(localSong);
      } else {
        delete nextSnapshot[localSong.id];
        hasChanges = true;
      }
    }

    // 3. Sort reconciled songs consistently
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
      this.saveRawSnapshot(nextSnapshot);
    }

    return {
      songs: reconciledSongs,
      hasChanges,
      ...(preservedConflictIds.length > 0 ? { preservedConflictIds } : {})
    };
  }

  /**
   * Load all songs from the hydrated in-memory IndexedDB cache (O(1) read, no per-read reconciliation).
   * Falls back cleanly in environments without IndexedDB.
   */
  static getSongs(): Song[] {
    if (IndexedDbStore.isAvailable()) {
      if (this.cache.songs !== null) {
        return this.cache.songs;
      }
      // Pre-hydration read: return bundled songs read-only without overwriting IndexedDB
      return sanitizeSongsList(INITIAL_SONGS);
    }

    // Headless fallback (no IndexedDB, e.g., Node test runner with localStorage mock)
    const stored = safeReadLocalStorageJson<Song[]>(STORAGE_KEY_SONGS);
    if (Array.isArray(stored) && stored.length > 0) {
      return sanitizeSongsList(stored);
    }

    const seeded = sanitizeSongsList(INITIAL_SONGS);
    this.saveSongs(seeded);
    this.saveSnapshot(seeded);
    return seeded;
  }

  /**
   * Find a song by its unique identifier
   */
  static getSongById(id: string): Song | undefined {
    return this.getSongs().find(s => s.id === id);
  }

  /**
   * Save full songs collection to cache + IndexedDB (or fallback storage)
   */
  static saveSongs(songs: Song[]): void {
    const sanitized = sanitizeSongsList(songs);
    this.cache.songs = sanitized;

    if (IndexedDbStore.isAvailable()) {
      this.enqueueDbWrite(() => IndexedDbStore.replaceAllSongs(sanitized));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_SONGS, sanitized);
    }
  }

  /**
   * Validates if the current runtime session has verified author rights.
   * Note: In browser environments, this delegates to runtime-verified session state
   * (never trusting unverified localStorage JSON flags) as a local UX/IndexedDB guard.
   * Authoritative enforcement happens server-side, via GitHub API, and via Google Drive OAuth.
   */
  static isAuthorAuthorized(): boolean {
    if (typeof window === 'undefined') return true;
    return isStoredSessionAuthorized();
  }

  /**
   * Asserts that verified runtime author privileges exist before mutating local persistent content.
   */
  static assertAuthorAuthorized(actionName: string): void {
    if (!this.isAuthorAuthorized()) {
      console.warn(`StorageService: intento no autorizado de "${actionName}".`);
      throw new Error(`Acceso no autorizado: Solo el autor (@${AUTHORIZED_GITHUB_USER}) tiene permisos para ${actionName}.`);
    }
  }

  /**
   * Save or update a single song (writes only the modified song record in IndexedDB)
   */
  static upsertSong(song: Song): Song[] {
    this.assertAuthorAuthorized('crear o modificar canciones');
    const songs = this.getSongs();
    const existingIndex = songs.findIndex(s => s.id === song.id);
    const [sanitizedSong] = sanitizeSongsList([{
      ...song,
      updatedAt: new Date().toISOString()
    }]);

    let updatedList: Song[];
    if (existingIndex >= 0) {
      updatedList = [...songs];
      updatedList[existingIndex] = sanitizedSong;
    } else {
      updatedList = [sanitizedSong, ...songs];
    }

    this.cache.songs = updatedList;
    if (IndexedDbStore.isAvailable()) {
      const orderIds = updatedList.map(s => s.id);
      this.enqueueDbWrite(() => IndexedDbStore.putSong(sanitizedSong, orderIds));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_SONGS, updatedList);
    }
    return updatedList;
  }

  /**
   * Delete a song by ID, cleaning up snapshot and recording local commit
   */
  static deleteSong(id: string, autoCommit: boolean = true): { success: boolean; songs: Song[]; deletedSong?: Song } {
    this.assertAuthorAuthorized('eliminar canciones');
    const songs = this.getSongs();
    const targetSong = songs.find(s => s.id === id);
    const filtered = songs.filter(s => s.id !== id);

    this.cache.songs = filtered;
    if (IndexedDbStore.isAvailable()) {
      const orderIds = filtered.map(s => s.id);
      this.enqueueDbWrite(() => IndexedDbStore.deleteSong(id, orderIds));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_SONGS, filtered);
    }

    // Clean up snapshot entry for this song
    const snapshot = this.getSnapshot();
    if (snapshot[id]) {
      const nextSnapshot = { ...snapshot };
      delete nextSnapshot[id];
      this.saveRawSnapshot(nextSnapshot);
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
   */
  static renameSongFile(
    oldId: string,
    newIdRaw: string,
    autoCommit: boolean = true
  ): { success: boolean; error?: string; songs: Song[]; renamedSong?: Song } {
    this.assertAuthorAuthorized('renombrar identificadores de canciones');
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
      const songs = this.getSongs();
      return {
        success: true,
        songs,
        renamedSong: songs.find(s => s.id === oldId)
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
      const nextSnapshot = { ...snapshot };
      nextSnapshot[cleanNewId] = this.getSongMarkdownCached(renamedSong);
      delete nextSnapshot[oldId];
      this.saveRawSnapshot(nextSnapshot);
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
    let lastPushed: string | null = null;
    try {
      if (typeof localStorage !== 'undefined') {
        lastPushed = localStorage.getItem('tony_cancionero_last_push_v1');
      }
    } catch {
      lastPushed = null;
    }
    if (!lastPushed) return commits.length;
    const lastPushedTime = new Date(lastPushed).getTime();
    return commits.filter(c => new Date(c.timestamp).getTime() > lastPushedTime).length;
  }

  /**
   * Collect all songs/*.md paths modified/created/deleted in unpushed local commits
   */
  static getUnpushedChangedFiles(lastPushTime?: string | null): string[] {
    const commits = this.getCommits();
    let lastPushed = lastPushTime;
    if (lastPushed === undefined) {
      try {
        if (typeof localStorage !== 'undefined') {
          lastPushed = localStorage.getItem('tony_cancionero_last_push_v1');
        }
      } catch {
        lastPushed = null;
      }
    }
    const seedHashes = new Set(['a108f92', 'b319e41', 'c4e819b', 'e1d93aa', 'init123']);
    const lastPushedMs = lastPushed ? Date.parse(lastPushed) : NaN;

    const files = new Set<string>();
    for (const commit of commits) {
      if (!lastPushed && seedHashes.has(commit.hash)) {
        continue;
      }
      const commitMs = Date.parse(commit.timestamp || '');
      if (lastPushed && Number.isFinite(lastPushedMs) && Number.isFinite(commitMs) && commitMs <= lastPushedMs) {
        continue;
      }
      (commit.filesChanged || []).forEach(f => {
        if (f.startsWith('songs/') && f.endsWith('.md')) {
          files.add(f);
        }
      });
    }
    return Array.from(files);
  }

  /**
   * Get Git commit history
   */
  static getCommits(): GitCommit[] {
    if (IndexedDbStore.isAvailable()) {
      if (this.cache.commits !== null) {
        return this.cache.commits;
      }
      return createInitialCommits();
    }

    const stored = safeReadLocalStorageJson<GitCommit[]>(STORAGE_KEY_COMMITS);
    if (Array.isArray(stored)) {
      return stored;
    }
    const initial = createInitialCommits();
    this.saveCommits(initial);
    return initial;
  }

  static saveCommits(commits: GitCommit[]): void {
    this.cache.commits = commits;
    if (IndexedDbStore.isAvailable()) {
      this.enqueueDbWrite(() => IndexedDbStore.setKV(KV_KEYS.COMMITS, commits));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_COMMITS, commits);
    }
  }

  /**
   * Snapshot dictionary of committed markdown content by song ID
   */
  static getSnapshot(): Record<string, string> {
    if (IndexedDbStore.isAvailable()) {
      return this.cache.snapshot ?? {};
    }

    const stored = safeReadLocalStorageJson<Record<string, string>>(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return stored;
    }
    return {};
  }

  static saveRawSnapshot(snapshot: Record<string, string>): void {
    this.cache.snapshot = snapshot;
    if (IndexedDbStore.isAvailable()) {
      this.enqueueDbWrite(() => IndexedDbStore.setKV(KV_KEYS.SNAPSHOT, snapshot));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT, snapshot);
    }
  }

  static saveSnapshot(songs: Song[]): void {
    const snapshot = this.buildSnapshotRecord(songs);
    this.saveRawSnapshot(snapshot);
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

    currentSongs.forEach(song => {
      const committedMarkdown = snapshot[song.id];
      if (!committedMarkdown) {
        created.push(`songs/${song.id}.md`);
      } else {
        const currentMarkdown = this.getSongMarkdownCached(song);
        if (currentMarkdown.trim() !== committedMarkdown.trim()) {
          modified.push(`songs/${song.id}.md`);
        }
      }
    });

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
    this.assertAuthorAuthorized('registrar commits en el repositorio');
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

    songs.forEach(s => {
      newCommit.snapshot[s.id] = this.getSongMarkdownCached(s);
    });

    const currentCommits = this.getCommits();
    const updatedCommits = [newCommit, ...currentCommits];
    this.saveCommits(updatedCommits);
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
    const currentMarkdown = currentSong ? this.getSongMarkdownCached(currentSong) : '';

    const records: SongVersionRecord[] = [];

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
    this.assertAuthorAuthorized('restaurar versiones históricas');
    const restored = markdownToSong(markdown, songId);
    this.upsertSong(restored);
    this.createGitCommit(`revert: restaurar versión [${commitHash}] de '${restored.title}'`);
    return restored;
  }

  /**
   * Reset data to initial demo state
   */
  static resetToDefault(): Song[] {
    this.assertAuthorAuthorized('restablecer catálogo a demostración');
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
    this.assertAuthorAuthorized('importar canciones desde JSON');
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data)) {
        throw new Error('El archivo JSON debe contener un arreglo de canciones.');
      }

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
    this.assertAuthorAuthorized('importar canciones desde Markdown');
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
   * Retrieve all saved backup points (decoded from compressed incremental archive, max 5)
   */
  static getBackupPoints(): SongBackupPoint[] {
    if (IndexedDbStore.isAvailable()) {
      return this.cache.backups ?? [];
    }

    const stored = safeReadLocalStorageJson<Array<StoredBackupEntry | SongBackupPoint>>(STORAGE_KEY_BACKUPS);
    if (Array.isArray(stored)) {
      return decodeBackupArchive(stored).slice(0, MAX_BACKUP_POINTS);
    }
    return [];
  }

  /**
   * Save backup points as compressed incremental diffs (retains up to MAX_BACKUP_POINTS = 5 points)
   */
  static saveBackupPoints(backups: SongBackupPoint[]): void {
    const trimmed = (backups || []).slice(0, MAX_BACKUP_POINTS);
    this.cache.backups = trimmed;
    const encodedArchive = encodeBackupArchive(trimmed);

    if (IndexedDbStore.isAvailable()) {
      this.enqueueDbWrite(() => IndexedDbStore.setKV(KV_KEYS.BACKUPS, encodedArchive));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_BACKUPS, encodedArchive);
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
    const currentSongs = songsToBackup ?? this.getSongs();
    const safeSongs = sanitizeSongsList(currentSongs || []);
    const songsJson = JSON.stringify(safeSongs);

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
    const updated = [backupPoint, ...currentBackups].slice(0, MAX_BACKUP_POINTS);
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
    this.assertAuthorAuthorized('restaurar copias de seguridad');
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

      this.saveSongs(parsedSongs);
      this.saveSnapshot(parsedSongs);

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
    this.assertAuthorAuthorized('eliminar puntos de restauración');
    const backups = this.getBackupPoints();
    const filtered = backups.filter(b => b.id !== backupId);
    this.saveBackupPoints(filtered);
    return true;
  }

  /**
   * Clear all backup points
   */
  static clearAllBackups(): void {
    this.assertAuthorAuthorized('purgar copias de seguridad');
    this.cache.backups = [];
    if (IndexedDbStore.isAvailable()) {
      this.enqueueDbWrite(() => IndexedDbStore.deleteKV(KV_KEYS.BACKUPS));
    } else {
      safeRemoveLocalStorage(STORAGE_KEY_BACKUPS);
    }
  }

  /**
   * Get all albums from IndexedDB cache with fallback to initial albums
   */
  static getAlbums(): Album[] {
    if (IndexedDbStore.isAvailable()) {
      if (this.cache.albums !== null) {
        return this.cache.albums;
      }
      return [...INITIAL_ALBUMS];
    }

    const stored = safeReadLocalStorageJson<Album[]>(STORAGE_KEY_ALBUMS);
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
    const seeded = [...INITIAL_ALBUMS];
    this.saveAlbums(seeded);
    return seeded;
  }

  /**
   * Save full albums list to IndexedDB (or fallback storage)
   */
  static saveAlbums(albums: Album[]): void {
    this.cache.albums = albums;
    if (IndexedDbStore.isAvailable()) {
      this.enqueueDbWrite(() => IndexedDbStore.replaceAllAlbums(albums));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_ALBUMS, albums);
    }
  }

  /**
   * Get a single album by its unique id
   */
  static getAlbumById(id: string): Album | undefined {
    const albums = this.getAlbums();
    return albums.find(a => a.id === id);
  }

  /**
   * Insert or update an album
   */
  static upsertAlbum(album: Album): Album[] {
    this.assertAuthorAuthorized('crear o modificar álbumes');
    const albums = this.getAlbums();
    const now = new Date().toISOString();
    const existingIndex = albums.findIndex(a => a.id === album.id);

    const updatedAlbum: Album = {
      ...album,
      updatedAt: now,
      createdAt: album.createdAt || (existingIndex >= 0 ? albums[existingIndex].createdAt : now)
    };

    let updatedList: Album[];
    if (existingIndex >= 0) {
      updatedList = [...albums];
      updatedList[existingIndex] = updatedAlbum;
    } else {
      updatedList = [updatedAlbum, ...albums];
    }

    this.cache.albums = updatedList;
    if (IndexedDbStore.isAvailable()) {
      const orderIds = updatedList.map(a => a.id);
      this.enqueueDbWrite(() => IndexedDbStore.putAlbum(updatedAlbum, orderIds));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_ALBUMS, updatedList);
    }
    return updatedList;
  }

  /**
   * Delete an album by id
   */
  static deleteAlbum(id: string): Album[] {
    this.assertAuthorAuthorized('eliminar álbumes');
    const albums = this.getAlbums();
    const filtered = albums.filter(a => a.id !== id);
    this.cache.albums = filtered;
    if (IndexedDbStore.isAvailable()) {
      const orderIds = filtered.map(a => a.id);
      this.enqueueDbWrite(() => IndexedDbStore.deleteAlbum(id, orderIds));
    } else {
      safeWriteLocalStorageJson(STORAGE_KEY_ALBUMS, filtered);
    }
    return filtered;
  }
}
