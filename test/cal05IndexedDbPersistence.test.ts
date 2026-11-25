import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { Song } from '../src/types/song';
import { Album } from '../src/types/album';
import {
  compressUtf8String,
  decompressUtf8String,
  encodeBackupArchive,
  decodeBackupArchive,
  MAX_BACKUP_POINTS,
  SongBackupPoint
} from '../src/utils/backupCompression';
import { IndexedDbStore, KV_KEYS } from '../src/services/indexedDbStore';
import {
  StorageService,
  STORAGE_KEY_SONGS,
  STORAGE_KEY_ALBUMS,
  STORAGE_KEY_COMMITS,
  STORAGE_KEY_LAST_COMMITTED_SNAPSHOT,
  STORAGE_KEY_BACKUPS
} from '../src/services/storageService';
import { GitHubSyncService } from '../src/services/githubSyncService';
import { exportDatabaseFromIndexedDB } from '../src/utils/databaseExportService';
import { songToMarkdown } from '../src/utils/markdownParser';

// ---------------------------------------------------------------------------
// Minimal spec-faithful in-memory IndexedDB mock for Node.js verification
// ---------------------------------------------------------------------------
function createInMemoryIndexedDB() {
  const databases = new Map<string, Map<string, Map<string, any>>>();

  function getOrCreateDb(name: string): Map<string, Map<string, any>> {
    let stores = databases.get(name);
    if (!stores) {
      stores = new Map();
      databases.set(name, stores);
    }
    return stores;
  }

  function makeRequest<T>(executor: () => T): IDBRequest<T> {
    const req: any = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
      readyState: 'pending'
    };
    queueMicrotask(() => {
      try {
        req.result = executor();
        req.readyState = 'done';
        req.onsuccess?.({ target: req });
      } catch (err) {
        req.error = err;
        req.readyState = 'done';
        req.onerror?.({ target: req });
      }
    });
    return req as IDBRequest<T>;
  }

  function createObjectStoreWrapper(
    storeMap: Map<string, any>,
    keyPath: string,
    txState: { pending: number; tx: any; completionScheduled: boolean }
  ) {
    const maybeScheduleComplete = () => {
      if (txState.pending === 0 && !txState.completionScheduled) {
        txState.completionScheduled = true;
        setTimeout(() => {
          txState.tx.oncomplete?.({ target: txState.tx });
        }, 0);
      }
    };

    const schedule = <T>(fn: () => T) => {
      txState.pending++;
      const req: any = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
        readyState: 'pending'
      };
      queueMicrotask(() => {
        try {
          req.result = fn();
          req.readyState = 'done';
          req.onsuccess?.({ target: req });
        } catch (err) {
          req.error = err;
          req.readyState = 'done';
          req.onerror?.({ target: req });
        } finally {
          txState.pending--;
          maybeScheduleComplete();
        }
      });
      return req as IDBRequest<T>;
    };

    return {
      get: (key: string) => schedule(() => {
        const val = storeMap.get(key);
        return val === undefined ? undefined : structuredClone(val);
      }),
      getAll: () => schedule(() => Array.from(storeMap.values()).map(v => structuredClone(v))),
      put: (value: any) => schedule(() => {
        const k = value[keyPath];
        storeMap.set(k, structuredClone(value));
        return k;
      }),
      delete: (key: string) => schedule(() => {
        storeMap.delete(key);
      }),
      clear: () => schedule(() => {
        storeMap.clear();
      })
    };
  }

  const keyPathByStore: Record<string, string> = {
    songs: 'id',
    albums: 'id',
    kv: 'key'
  };

  const factory: any = {
    open: (name: string) => {
      const dbStores = getOrCreateDb(name);
      const req: any = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
      };

      const dbObj: any = {
        name,
        onversionchange: null,
        objectStoreNames: {
          contains: (storeName: string) => dbStores.has(storeName)
        },
        createObjectStore: (storeName: string, opts?: { keyPath?: string }) => {
          if (opts?.keyPath) {
            keyPathByStore[storeName] = opts.keyPath;
          }
          if (!dbStores.has(storeName)) {
            dbStores.set(storeName, new Map());
          }
          return {};
        },
        transaction: (storeNames: string | string[]) => {
          const names = Array.isArray(storeNames) ? storeNames : [storeNames];
          const txState: { pending: number; tx: any; completionScheduled: boolean } = {
            pending: 0,
            tx: null,
            completionScheduled: false
          };
          const tx: any = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore: (storeName: string) => {
              if (!names.includes(storeName)) {
                throw new Error(`Store "${storeName}" not in transaction`);
              }
              let storeMap = dbStores.get(storeName);
              if (!storeMap) {
                storeMap = new Map();
                dbStores.set(storeName, storeMap);
              }
              return createObjectStoreWrapper(
                storeMap,
                keyPathByStore[storeName] || 'id',
                txState
              );
            }
          };
          txState.tx = tx;
          return tx;
        },
        close: () => {}
      };

      queueMicrotask(() => {
        req.result = dbObj;
        if (!dbStores.has('songs') || !dbStores.has('albums') || !dbStores.has('kv')) {
          req.onupgradeneeded?.({ target: req });
        }
        req.onsuccess?.({ target: req });
      });

      return req;
    },
    _databases: databases
  };

  return factory as IDBFactory;
}

// LocalStorage mock
const lsMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => lsMap.get(key) ?? null,
  setItem: (key: string, value: string) => { lsMap.set(key, String(value)); },
  removeItem: (key: string) => { lsMap.delete(key); },
  clear: () => { lsMap.clear(); },
  key: (index: number) => Array.from(lsMap.keys())[index] ?? null,
  get length() { return lsMap.size; }
};

const prevLocalStorage = globalThis.localStorage;
const prevIndexedDB = (globalThis as any).indexedDB;
const prevFetch = global.fetch;

const makeSong = (overrides: Partial<Song> = {}): Song => ({
  id: 'tema-idb-1',
  title: 'Canción en IndexedDB',
  status: 'published',
  year: 2026,
  genre: 'Cantautor',
  key: 'Am',
  tempo: 102,
  lyrics: '## Estrofa 1\n[Am] Verso de prueba con ñ y acentós áéíóú\n[G] Segundo verso\n\n## Estribillo\n[F] Coro emotivo [E7] final',
  lrc: '[00:05.00] Verso de prueba\n[00:12.00] Segundo verso',
  tags: ['acústico', 'maqueta'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-01T12:00:00.000Z',
  ...overrides
});

describe('CAL-05: IndexedDB persistence, localStorage migration, startup-only reconciliation & compressed incremental backups', () => {
  beforeEach(async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createInMemoryIndexedDB(),
      writable: true,
      configurable: true
    });
    lsMap.clear();
    IndexedDbStore.close();
    await StorageService.resetForTesting(true);
  });

  after(async () => {
    IndexedDbStore.close();
    await StorageService.resetForTesting(false);
    global.fetch = prevFetch;
    if (prevIndexedDB === undefined) {
      delete (globalThis as any).indexedDB;
    } else {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: prevIndexedDB,
        writable: true,
        configurable: true
      });
    }
    if (prevLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      Object.defineProperty(globalThis, 'localStorage', {
        value: prevLocalStorage,
        writable: true,
        configurable: true
      });
    }
  });

  it('compresses and decompresses UTF-8 strings losslessly and encodes max 5 backups as incremental diffs', () => {
    const sampleSongs: Song[] = Array.from({ length: 20 }, (_, i) =>
      makeSong({
        id: `song-${i}`,
        title: `Canción Número ${i} — Ñandú`,
        lyrics: `## Estrofa ${i}\n[Am] Letra repetida para probar compresión LZW con acentos áéíóú y símbolos 🎸\n`.repeat(6)
      })
    );

    const rawJson = JSON.stringify(sampleSongs, null, 2);
    const compressed = compressUtf8String(rawJson);
    assert.ok(compressed.startsWith('LZ1:'));
    assert.ok(compressed.length < rawJson.length * 0.65, `Expected strong compression ratio, got ${compressed.length} vs ${rawJson.length}`);
    assert.equal(decompressUtf8String(compressed), rawJson);

    // Create 8 backup points where only 1 song changes per backup
    const backups: SongBackupPoint[] = [];
    for (let step = 0; step < 8; step++) {
      const snapshotSongs = sampleSongs.map((s, idx) =>
        idx === 0 ? { ...s, title: `Título paso ${step}` } : s
      );
      backups.unshift({
        id: `bp-${step}`,
        timestamp: `2026-06-0${step + 1}T10:00:00.000Z`,
        name: `Backup paso ${step}`,
        reason: 'manual',
        songCount: snapshotSongs.length,
        songsJson: JSON.stringify(snapshotSongs),
        songsSummary: snapshotSongs.map(s => ({ id: s.id, title: s.title, key: s.key, status: s.status }))
      });
    }

    const archived = encodeBackupArchive(backups);
    assert.equal(archived.length, MAX_BACKUP_POINTS);
    assert.equal(archived[0].mode, 'full');
    assert.equal(archived[1].mode, 'diff');
    assert.ok(archived[1].payload.length < archived[0].payload.length * 0.25);

    const decoded = decodeBackupArchive(archived);
    assert.equal(decoded.length, MAX_BACKUP_POINTS);
    assert.equal(JSON.parse(decoded[0].songsJson)[0].title, 'Título paso 7');
    assert.equal(JSON.parse(decoded[4].songsJson)[0].title, 'Título paso 3');
  });

  it('transparently migrates legacy localStorage keys to IndexedDB on first boot and keeps only lightweight preferences in localStorage', async () => {
    const legacySong = makeSong({
      id: 'tema-migrado-localstorage',
      title: 'Tema Migrado Desde LocalStorage',
      updatedAt: '2026-08-01T00:00:00.000Z'
    });
    const legacyAlbum: Album = {
      id: 'album-migrado',
      title: 'Álbum Migrado',
      tracks: [{ id: 't1', songId: legacySong.id, title: legacySong.title, order: 1 }]
    };
    const legacyCommits = [
      {
        hash: 'abc1234',
        message: 'feat: tema migrado',
        author: 'Tony',
        timestamp: '2026-08-01T00:00:00.000Z',
        filesChanged: [`songs/${legacySong.id}.md`],
        snapshot: { [legacySong.id]: songToMarkdown(legacySong) }
      }
    ];
    const legacySnapshot = { [legacySong.id]: songToMarkdown(legacySong) };
    const legacyBackups: SongBackupPoint[] = Array.from({ length: 7 }, (_, i) => ({
      id: `legacy-bp-${i}`,
      timestamp: `2026-07-0${i + 1}T10:00:00.000Z`,
      name: `Legacy Backup ${i}`,
      reason: 'manual',
      songCount: 1,
      songsJson: JSON.stringify([{ ...legacySong, notes: `nota-${i}` }]),
      songsSummary: [{ id: legacySong.id, title: legacySong.title, key: legacySong.key, status: legacySong.status }]
    }));

    // Seed heavy legacy keys AND lightweight preferences in localStorage
    localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify([legacySong]));
    localStorage.setItem(STORAGE_KEY_ALBUMS, JSON.stringify([legacyAlbum]));
    localStorage.setItem(STORAGE_KEY_COMMITS, JSON.stringify(legacyCommits));
    localStorage.setItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT, JSON.stringify(legacySnapshot));
    localStorage.setItem(STORAGE_KEY_BACKUPS, JSON.stringify(legacyBackups));

    localStorage.setItem('tony_cancionero_theme', 'dark');
    localStorage.setItem('cancionero_view_mode', 'compact');

    await StorageService.init();

    // Heavy keys must be removed from localStorage
    assert.equal(localStorage.getItem(STORAGE_KEY_SONGS), null);
    assert.equal(localStorage.getItem(STORAGE_KEY_ALBUMS), null);
    assert.equal(localStorage.getItem(STORAGE_KEY_COMMITS), null);
    assert.equal(localStorage.getItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT), null);
    assert.equal(localStorage.getItem(STORAGE_KEY_BACKUPS), null);

    // Lightweight preferences must remain intact
    assert.equal(localStorage.getItem('tony_cancionero_theme'), 'dark');
    assert.equal(localStorage.getItem('cancionero_view_mode'), 'compact');

    // Migrated data must be available from StorageService & IndexedDB
    const songs = StorageService.getSongs();
    assert.ok(songs.some(s => s.id === 'tema-migrado-localstorage' && s.title === 'Tema Migrado Desde LocalStorage'));
    const albums = StorageService.getAlbums();
    assert.ok(albums.some(a => a.id === 'album-migrado'));
    const commits = StorageService.getCommits();
    assert.equal(commits[0].hash, 'abc1234');
    const backups = StorageService.getBackupPoints();
    assert.equal(backups.length, MAX_BACKUP_POINTS);
    assert.equal(backups[0].id, 'legacy-bp-0');

    const migrationMeta = await IndexedDbStore.getKV<{ completed: boolean; migratedKeys: string[] }>(KV_KEYS.MIGRATION_V1);
    assert.equal(migrationMeta?.completed, true);
    assert.equal(migrationMeta?.migratedKeys.length, 5);
  });

  it('executes reconcileWithCatalog() only at startup and after remote sync, NOT on getSongs() reads', async () => {
    const localSong = makeSong({ id: 'tema-estable', title: 'Tema Estable' });
    localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify([localSong]));

    await StorageService.init();
    const afterBootCount = StorageService.getReconciliationCount();
    assert.equal(afterBootCount, 1);

    // Perform many synchronous reads
    for (let i = 0; i < 25; i++) {
      const songs = StorageService.getSongs();
      assert.ok(songs.length > 0);
      StorageService.getSongById('tema-estable');
      StorageService.getGitStatus();
    }

    assert.equal(StorageService.getReconciliationCount(), 1, 'getSongs() must not run reconcileWithCatalog()');

    // Remote sync triggers one reconciliation
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"etag-cal05"' }),
      json: async () => [makeSong({ id: 'tema-remoto-cal05', title: 'Remoto CAL-05' })]
    })) as unknown as typeof fetch;

    const syncResult = await GitHubSyncService.syncCatalogFromRemote(null, {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });
    assert.equal(syncResult.success, true);
    assert.equal(StorageService.getReconciliationCount(), 2);
  });

  it('persists songs, albums, commits, snapshots, and bounded backups to IndexedDB across simulated reloads and exports ZIP', async () => {
    await StorageService.init();

    const customSong = makeSong({
      id: 'cancion-persistida-idb',
      title: 'Canción Persistida en IDB',
      lyrics: '## Estrofa\n[D] Persistiendo fuera de localStorage'
    });
    StorageService.upsertSong(customSong);
    StorageService.createGitCommit('feat: guardar canción en IndexedDB');

    const customAlbum: Album = {
      id: 'disco-idb',
      title: 'Disco en IndexedDB',
      tracks: [{ id: 'tr-1', songId: customSong.id, title: customSong.title, order: 1 }]
    };
    StorageService.upsertAlbum(customAlbum);

    for (let i = 0; i < 7; i++) {
      StorageService.createBackupPoint(`Backup IDB #${i}`, 'manual');
    }

    await StorageService.flush();

    // Nothing written to heavy localStorage keys
    assert.equal(localStorage.getItem(STORAGE_KEY_SONGS), null);
    assert.equal(localStorage.getItem(STORAGE_KEY_BACKUPS), null);

    // Simulate full page reload by wiping in-memory caches while keeping IndexedDB intact
    IndexedDbStore.close();
    await StorageService.resetForTesting(false);
    await StorageService.init();

    const reloadedSong = StorageService.getSongById('cancion-persistida-idb');
    assert.ok(reloadedSong);
    assert.equal(reloadedSong.title, 'Canción Persistida en IDB');

    const reloadedAlbum = StorageService.getAlbumById('disco-idb');
    assert.ok(reloadedAlbum);
    assert.equal(reloadedAlbum.title, 'Disco en IndexedDB');

    const reloadedBackups = StorageService.getBackupPoints();
    assert.equal(reloadedBackups.length, MAX_BACKUP_POINTS);
    assert.equal(reloadedBackups[0].name, 'Backup IDB #6');

    const reloadedCommits = StorageService.getCommits();
    assert.ok(reloadedCommits.some(c => c.message.includes('guardar canción en IndexedDB')));

    // Verify ZIP export from IndexedDB includes songs, albums, and db-metadata
    const exportResult = await exportDatabaseFromIndexedDB();
    assert.ok(exportResult.totalSongs > 0);
    const zip = await JSZip.loadAsync(exportResult.blob);
    const metadataStr = await zip.file('db-metadata.json')?.async('string');
    assert.ok(metadataStr);
    const metadata = JSON.parse(metadataStr);
    assert.equal(metadata.storageBackend, 'indexeddb');
    assert.ok(zip.file('albums.json'));
    assert.ok(zip.file('songs.json'));
  });
});
