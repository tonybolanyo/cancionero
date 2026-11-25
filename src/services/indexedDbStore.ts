import { Song, GitCommit } from '../types/song';
import { Album } from '../types/album';
import { StoredBackupEntry } from '../utils/backupCompression';

const DB_NAME = 'tony_cancionero_db';
const DB_VERSION = 1;

export const STORE_SONGS = 'songs';
export const STORE_ALBUMS = 'albums';
export const STORE_KV = 'kv';

export const KV_KEYS = {
  SONG_ORDER: 'song_order',
  ALBUM_ORDER: 'album_order',
  COMMITS: 'commits',
  SNAPSHOT: 'snapshot',
  BACKUPS: 'backups',
  MIGRATION_V1: 'migration_v1'
} as const;

interface KVRecord<T = unknown> {
  key: string;
  value: T;
}

export interface MigrationBundle {
  songs?: Song[];
  albums?: Album[];
  commits?: GitCommit[];
  snapshot?: Record<string, string>;
  backups?: StoredBackupEntry[];
  migrationMeta?: {
    completed: boolean;
    migratedAt: string;
    migratedKeys: string[];
  };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export class IndexedDbStore {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  static isAvailable(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  static async open(): Promise<IDBDatabase> {
    if (!this.isAvailable()) {
      throw new Error('IndexedDB is not available in this environment.');
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_SONGS)) {
          db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_ALBUMS)) {
          db.createObjectStore(STORE_ALBUMS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error || new Error('Failed to open IndexedDB database.'));
      };
    });

    return this.dbPromise;
  }

  static close(): void {
    if (this.dbPromise) {
      const current = this.dbPromise;
      this.dbPromise = null;
      void current.then(db => {
        try {
          db.close();
        } catch {
          // ignore
        }
      }).catch(() => {});
    }
  }

  static async getKV<T>(key: string): Promise<T | undefined> {
    const db = await this.open();
    const tx = db.transaction(STORE_KV, 'readonly');
    const txDone = transactionToPromise(tx);
    const store = tx.objectStore(STORE_KV);
    const record = await requestToPromise<KVRecord<T> | undefined>(store.get(key));
    await txDone;
    return record ? record.value : undefined;
  }

  static async setKV<T>(key: string, value: T): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_KV, 'readwrite');
    const txDone = transactionToPromise(tx);
    tx.objectStore(STORE_KV).put({ key, value });
    await txDone;
  }

  static async deleteKV(key: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_KV, 'readwrite');
    const txDone = transactionToPromise(tx);
    tx.objectStore(STORE_KV).delete(key);
    await txDone;
  }

  static async getAllSongs(): Promise<Song[]> {
    const db = await this.open();
    const tx = db.transaction([STORE_SONGS, STORE_KV], 'readonly');
    const txDone = transactionToPromise(tx);
    const songsReq = tx.objectStore(STORE_SONGS).getAll() as IDBRequest<Song[]>;
    const orderReq = tx.objectStore(STORE_KV).get(KV_KEYS.SONG_ORDER) as IDBRequest<KVRecord<string[]> | undefined>;
    const [songs, orderRecord] = await Promise.all([
      requestToPromise(songsReq),
      requestToPromise(orderReq)
    ]);
    await txDone;

    if (!orderRecord || !Array.isArray(orderRecord.value)) {
      return songs || [];
    }

    const byId = new Map((songs || []).map(s => [s.id, s]));
    const ordered: Song[] = [];
    for (const id of orderRecord.value) {
      const item = byId.get(id);
      if (item) {
        ordered.push(item);
        byId.delete(id);
      }
    }
    for (const leftover of byId.values()) {
      ordered.push(leftover);
    }
    return ordered;
  }

  static async replaceAllSongs(songs: Song[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STORE_SONGS, STORE_KV], 'readwrite');
    const txDone = transactionToPromise(tx);
    const songsStore = tx.objectStore(STORE_SONGS);
    const kvStore = tx.objectStore(STORE_KV);

    songsStore.clear();
    for (const song of songs) {
      songsStore.put(song);
    }
    kvStore.put({ key: KV_KEYS.SONG_ORDER, value: songs.map(s => s.id) });
    await txDone;
  }

  static async putSong(song: Song, orderIds: string[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STORE_SONGS, STORE_KV], 'readwrite');
    const txDone = transactionToPromise(tx);
    tx.objectStore(STORE_SONGS).put(song);
    tx.objectStore(STORE_KV).put({ key: KV_KEYS.SONG_ORDER, value: orderIds });
    await txDone;
  }

  static async deleteSong(id: string, orderIds: string[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STORE_SONGS, STORE_KV], 'readwrite');
    const txDone = transactionToPromise(tx);
    tx.objectStore(STORE_SONGS).delete(id);
    tx.objectStore(STORE_KV).put({ key: KV_KEYS.SONG_ORDER, value: orderIds });
    await txDone;
  }

  static async getAllAlbums(): Promise<Album[]> {
    const db = await this.open();
    const tx = db.transaction([STORE_ALBUMS, STORE_KV], 'readonly');
    const txDone = transactionToPromise(tx);
    const albumsReq = tx.objectStore(STORE_ALBUMS).getAll() as IDBRequest<Album[]>;
    const orderReq = tx.objectStore(STORE_KV).get(KV_KEYS.ALBUM_ORDER) as IDBRequest<KVRecord<string[]> | undefined>;
    const [albums, orderRecord] = await Promise.all([
      requestToPromise(albumsReq),
      requestToPromise(orderReq)
    ]);
    await txDone;

    if (!orderRecord || !Array.isArray(orderRecord.value)) {
      return albums || [];
    }

    const byId = new Map((albums || []).map(a => [a.id, a]));
    const ordered: Album[] = [];
    for (const id of orderRecord.value) {
      const item = byId.get(id);
      if (item) {
        ordered.push(item);
        byId.delete(id);
      }
    }
    for (const leftover of byId.values()) {
      ordered.push(leftover);
    }
    return ordered;
  }

  static async replaceAllAlbums(albums: Album[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STORE_ALBUMS, STORE_KV], 'readwrite');
    const txDone = transactionToPromise(tx);
    const albumsStore = tx.objectStore(STORE_ALBUMS);
    const kvStore = tx.objectStore(STORE_KV);

    albumsStore.clear();
    for (const album of albums) {
      albumsStore.put(album);
    }
    kvStore.put({ key: KV_KEYS.ALBUM_ORDER, value: albums.map(a => a.id) });
    await txDone;
  }

  static async putAlbum(album: Album, orderIds: string[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STORE_ALBUMS, STORE_KV], 'readwrite');
    const txDone = transactionToPromise(tx);
    tx.objectStore(STORE_ALBUMS).put(album);
    tx.objectStore(STORE_KV).put({ key: KV_KEYS.ALBUM_ORDER, value: orderIds });
    await txDone;
  }

  static async deleteAlbum(id: string, orderIds: string[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STORE_ALBUMS, STORE_KV], 'readwrite');
    const txDone = transactionToPromise(tx);
    tx.objectStore(STORE_ALBUMS).delete(id);
    tx.objectStore(STORE_KV).put({ key: KV_KEYS.ALBUM_ORDER, value: orderIds });
    await txDone;
  }

  static async batchMigrate(bundle: MigrationBundle): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STORE_SONGS, STORE_ALBUMS, STORE_KV], 'readwrite');
    const txDone = transactionToPromise(tx);
    const songsStore = tx.objectStore(STORE_SONGS);
    const albumsStore = tx.objectStore(STORE_ALBUMS);
    const kvStore = tx.objectStore(STORE_KV);

    if (bundle.songs) {
      songsStore.clear();
      for (const song of bundle.songs) {
        songsStore.put(song);
      }
      kvStore.put({ key: KV_KEYS.SONG_ORDER, value: bundle.songs.map(s => s.id) });
    }

    if (bundle.albums) {
      albumsStore.clear();
      for (const album of bundle.albums) {
        albumsStore.put(album);
      }
      kvStore.put({ key: KV_KEYS.ALBUM_ORDER, value: bundle.albums.map(a => a.id) });
    }

    if (bundle.commits !== undefined) {
      kvStore.put({ key: KV_KEYS.COMMITS, value: bundle.commits });
    }

    if (bundle.snapshot !== undefined) {
      kvStore.put({ key: KV_KEYS.SNAPSHOT, value: bundle.snapshot });
    }

    if (bundle.backups !== undefined) {
      kvStore.put({ key: KV_KEYS.BACKUPS, value: bundle.backups });
    }

    if (bundle.migrationMeta !== undefined) {
      kvStore.put({ key: KV_KEYS.MIGRATION_V1, value: bundle.migrationMeta });
    }

    await txDone;
  }

  static async clearAll(): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.open();
    const tx = db.transaction([STORE_SONGS, STORE_ALBUMS, STORE_KV], 'readwrite');
    const txDone = transactionToPromise(tx);
    tx.objectStore(STORE_SONGS).clear();
    tx.objectStore(STORE_ALBUMS).clear();
    tx.objectStore(STORE_KV).clear();
    await txDone;
  }
}
