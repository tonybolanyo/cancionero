import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Song } from '../src/types/song';
import { songToMarkdown } from '../src/utils/markdownParser';

// Isolated localStorage mock for headless Node environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, String(value)); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  get length() { return storageMap.size; }
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  });
}

import { StorageService } from '../src/services/storageService';

const makeSong = (overrides: Partial<Song> = {}): Song => ({
  id: 'cancion-demo',
  title: 'Canción Demo',
  status: 'published',
  year: 2025,
  genre: 'Cantautor',
  key: 'Am',
  tempo: 100,
  lyrics: '## Estrofa\n[Am] Verso inicial',
  tags: ['acústico'],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-06-01T12:00:00.000Z',
  ...overrides
});

describe('CAL-03: StorageService reconciliation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds newly incoming repository songs and updates the committed snapshot', () => {
    const existing = makeSong({ id: 'tema-1', title: 'Tema 1' });
    StorageService.saveSongs([existing]);
    StorageService.saveSnapshot([existing]);

    const incomingNew = makeSong({
      id: 'tema-2-nuevo',
      title: 'Tema 2 Nuevo',
      status: 'published',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    const result = StorageService.reconcileWithCatalog([existing], [existing, incomingNew], 'catálogo test');

    assert.equal(result.hasChanges, true);
    assert.equal(result.songs.length, 2);
    assert.ok(result.songs.some(s => s.id === 'tema-2-nuevo'));
    assert.ok(StorageService.getSnapshot()['tema-2-nuevo']);
  });

  it('adopts incoming updates for locally unmodified songs', () => {
    const original = makeSong({
      id: 'tema-sin-cambios',
      title: 'Versión 1',
      tempo: 90,
      lyrics: '[Am] Letra original',
      updatedAt: '2025-05-01T00:00:00.000Z'
    });
    StorageService.saveSongs([original]);
    StorageService.saveSnapshot([original]);

    const updatedIncoming = makeSong({
      id: 'tema-sin-cambios',
      title: 'Versión 2',
      tempo: 98,
      key: 'Bm',
      lyrics: '[Bm] Letra actualizada desde repo',
      updatedAt: '2026-02-01T00:00:00.000Z'
    });

    const result = StorageService.reconcileWithCatalog([original], [updatedIncoming], 'repo');

    assert.equal(result.hasChanges, true);
    assert.equal(result.songs.length, 1);
    assert.equal(result.songs[0].title, 'Versión 2');
    assert.equal(result.songs[0].tempo, 98);
    assert.equal(result.songs[0].key, 'Bm');
    assert.equal(result.songs[0].lyrics, '[Bm] Letra actualizada desde repo');
  });

  it('preserves local uncommitted author edits when local timestamp is newer or equal', () => {
    const baseSnapshot = makeSong({
      id: 'tema-editado-local',
      title: 'Título base',
      lyrics: '[Am] Letra base',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    const localDraft = makeSong({
      id: 'tema-editado-local',
      title: 'Borrador local del autor',
      lyrics: '[Am] Letra editada localmente sin commit',
      updatedAt: '2026-03-10T15:00:00.000Z'
    });
    const olderIncoming = makeSong({
      id: 'tema-editado-local',
      title: 'Versión remota anterior',
      lyrics: '[Am] Letra remota vieja',
      updatedAt: '2026-02-01T00:00:00.000Z'
    });

    StorageService.saveSongs([localDraft]);
    StorageService.saveSnapshot([baseSnapshot]);

    const result = StorageService.reconcileWithCatalog([localDraft], [olderIncoming], 'repo');

    assert.equal(result.hasChanges, false);
    assert.equal(result.songs[0].title, 'Borrador local del autor');
    assert.equal(result.songs[0].lyrics, '[Am] Letra editada localmente sin commit');
  });

  it('creates an automatic pre_sync backup before overwriting local edits when incoming version is strictly newer', () => {
    const baseSnapshot = makeSong({
      id: 'tema-conflicto-remoto-gana',
      lyrics: '[C] Base',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    const localEdited = makeSong({
      id: 'tema-conflicto-remoto-gana',
      title: 'Edición local antigua',
      lyrics: '[C] Cambio local anterior',
      updatedAt: '2026-02-01T10:00:00.000Z'
    });
    const newerIncoming = makeSong({
      id: 'tema-conflicto-remoto-gana',
      title: 'Edición remota más reciente',
      lyrics: '[C] Cambio remoto posterior',
      updatedAt: '2026-04-01T10:00:00.000Z'
    });

    StorageService.saveSongs([localEdited]);
    StorageService.saveSnapshot([baseSnapshot]);

    const result = StorageService.reconcileWithCatalog([localEdited], [newerIncoming], 'GitHub');

    assert.equal(result.hasChanges, true);
    assert.equal(result.songs[0].title, 'Edición remota más reciente');
    assert.equal(result.songs[0].lyrics, '[C] Cambio remoto posterior');

    const backups = StorageService.getBackupPoints();
    assert.equal(backups.length, 1);
    assert.equal(backups[0].reason, 'pre_sync');
    assert.ok(backups[0].songsJson.includes('Edición local antigua'));
  });

  it('preserves locally created songs, removes untouched deleted songs, and purges legacy mock IDs', () => {
    const committedDeleted = makeSong({ id: 'tema-eliminado-en-repo', title: 'Eliminado en Repo' });
    const committedKept = makeSong({ id: 'tema-vigente', title: 'Vigente' });
    const localNew = makeSong({ id: 'nuevo-borrador-local', title: 'Nuevo Borrador', status: 'draft' });
    const legacyMock = makeSong({ id: 'noches-de-cristal', title: 'Mock Obsoleto' });

    StorageService.saveSongs([committedDeleted, committedKept, localNew, legacyMock]);
    // Snapshot only tracks previously committed songs, NOT localNew
    localStorage.setItem(
      'tony_cancionero_git_snapshot_v1',
      JSON.stringify({
        [committedDeleted.id]: songToMarkdown(committedDeleted),
        [committedKept.id]: songToMarkdown(committedKept),
        [legacyMock.id]: songToMarkdown(legacyMock)
      })
    );

    const result = StorageService.reconcileWithCatalog(
      [committedDeleted, committedKept, localNew, legacyMock],
      [committedKept],
      'repo'
    );

    assert.equal(result.hasChanges, true);
    const ids = result.songs.map(s => s.id);
    assert.ok(ids.includes('tema-vigente'));
    assert.ok(ids.includes('nuevo-borrador-local'));
    assert.equal(ids.includes('tema-eliminado-en-repo'), false);
    assert.equal(ids.includes('noches-de-cristal'), false);
  });

  it('never erases local lyrics when incoming catalog entry only includes metadata', () => {
    const localSong = makeSong({
      id: 'tema-con-letra',
      lyrics: '## Estrofa\n[G] Letra preservada en local',
      tempo: 80
    });
    StorageService.saveSongs([localSong]);
    StorageService.saveSnapshot([localSong]);

    const metadataOnlyIncoming = makeSong({
      id: 'tema-con-letra',
      lyrics: '',
      tempo: 84,
      updatedAt: '2026-05-01T00:00:00.000Z'
    });

    const result = StorageService.reconcileWithCatalog([localSong], [metadataOnlyIncoming], 'catalog.json');

    assert.equal(result.hasChanges, true);
    assert.equal(result.songs[0].tempo, 84);
    assert.equal(result.songs[0].lyrics, '## Estrofa\n[G] Letra preservada en local');
  });

  it('returns unchanged local catalog when incoming list is empty and sorts reconciled songs by status and recency', () => {
    const draftNew = makeSong({ id: 'd1', status: 'draft', updatedAt: '2026-04-01T00:00:00.000Z' });
    const pubOld = makeSong({ id: 'p1', status: 'published', updatedAt: '2025-01-01T00:00:00.000Z' });
    const pubNew = makeSong({ id: 'p2', status: 'published', updatedAt: '2026-06-01T00:00:00.000Z' });
    const priv = makeSong({ id: 'x1', status: 'private', updatedAt: '2026-07-01T00:00:00.000Z' });

    const emptyRes = StorageService.reconcileWithCatalog([draftNew], [], 'empty');
    assert.equal(emptyRes.hasChanges, false);
    assert.deepEqual(emptyRes.songs, [draftNew]);

    const sorted = StorageService.mergeSongsByUpdatedAt([], [draftNew, priv, pubOld, pubNew]);
    assert.deepEqual(
      sorted.map(s => s.id),
      ['p2', 'p1', 'd1', 'x1']
    );
  });
});
