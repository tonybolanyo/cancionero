import test from 'node:test';
import assert from 'node:assert/strict';
import { Song } from '../src/types/song';

// Mock localStorage for headless Node test environment
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

test('deleteSong removes the song and cleans snapshot and registers git commit', () => {
  storageMap.clear();

  const testSong1: Song = {
    id: 'cancion-a-eliminar',
    title: 'Canción a Eliminar',
    status: 'draft',
    year: 2024,
    genre: 'Folk',
    key: 'G',
    lyrics: 'Verso de prueba\n[G] Acorde de prueba',
    audioUrl: 'blob:http://localhost:3000/test-blob-uuid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const testSong2: Song = {
    id: 'cancion-a-conservar',
    title: 'Canción que se Queda',
    status: 'published',
    year: 2023,
    genre: 'Rock',
    key: 'Am',
    lyrics: 'Verso a conservar',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  StorageService.saveSongs([testSong1, testSong2]);

  // Set initial snapshot
  const initialSnapshot = {
    [testSong1.id]: 'markdown 1',
    [testSong2.id]: 'markdown 2'
  };
  localStorage.setItem('tony_cancionero_git_snapshot_v1', JSON.stringify(initialSnapshot));

  // Perform deletion
  const result = StorageService.deleteSong('cancion-a-eliminar', true);

  assert.equal(result.success, true);
  assert.equal(result.deletedSong?.id, 'cancion-a-eliminar');
  assert.equal(result.deletedSong?.title, 'Canción a Eliminar');
  assert.equal(result.songs.length, 1);
  assert.equal(result.songs[0].id, 'cancion-a-conservar');

  // Verify snapshot was cleaned
  const updatedSnapshot = StorageService.getSnapshot();
  assert.equal(updatedSnapshot['cancion-a-eliminar'], undefined);
  assert.equal(updatedSnapshot['cancion-a-conservar'], 'markdown 2');

  // Verify Git commit was recorded
  const commits = StorageService.getCommits();
  assert.ok(commits.length > 0);
  assert.ok(commits[0].message.includes('delete: eliminar canción "Canción a Eliminar"'));
  assert.ok(commits[0].filesChanged.includes('songs/cancion-a-eliminar.md'));
});

test('deleteSong handles non-existing id gracefully', () => {
  const songsBefore = StorageService.getSongs();
  const result = StorageService.deleteSong('id-inexistente', true);

  assert.equal(result.success, true);
  assert.equal(result.deletedSong, undefined);
  assert.equal(result.songs.length, songsBefore.length);
});

test('removing audioUrl leaves metadata, lyrics, and chords completely intact', () => {
  const originalSong: Song = {
    id: 'tema-con-audio',
    title: 'Tema Acústico',
    status: 'published',
    year: 2024,
    genre: 'Indie',
    key: 'Em',
    tempo: 110,
    timeSignature: '3/4',
    tuning: 'Drop D',
    notes: 'Grabado con micro de condensador',
    lyrics: '## Estrofa 1\n[Em] Melodía suave [D] al atardecer',
    lrc: '[00:04.20] [Em] Melodía suave [D] al atardecer',
    tags: ['acústico', 'guitarra'],
    audioUrl: 'blob:http://localhost:3000/audio-uuid-1234',
    spotifyUrl: 'https://spotify.com/example',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  StorageService.upsertSong(originalSong);

  // Author removes local audio
  const songWithoutAudio: Song = {
    ...originalSong,
    audioUrl: undefined,
    updatedAt: new Date().toISOString()
  };

  StorageService.upsertSong(songWithoutAudio);

  const retrieved = StorageService.getSongById('tema-con-audio');
  assert.ok(retrieved);
  assert.equal(retrieved.audioUrl, undefined);
  assert.equal(retrieved.title, 'Tema Acústico');
  assert.equal(retrieved.lyrics, '## Estrofa 1\n[Em] Melodía suave [D] al atardecer');
  assert.equal(retrieved.lrc, '[00:04.20] [Em] Melodía suave [D] al atardecer');
  assert.equal(retrieved.key, 'Em');
  assert.equal(retrieved.tempo, 110);
  assert.equal(retrieved.timeSignature, '3/4');
  assert.equal(retrieved.tuning, 'Drop D');
  assert.equal(retrieved.notes, 'Grabado con micro de condensador');
  assert.deepEqual(retrieved.tags, ['acústico', 'guitarra']);
  assert.equal(retrieved.spotifyUrl, 'https://spotify.com/example');
});
