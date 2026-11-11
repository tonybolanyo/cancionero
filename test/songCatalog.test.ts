import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSongsList,
  calculateSongCounts,
  extractAvailableKeys,
  extractAvailableTags
} from '../src/hooks/useSongCatalog';
import { Song } from '../src/types/song';

const MOCK_SONGS: Song[] = [
  {
    id: 'cancion-1',
    title: 'Canción de la Lluvia',
    status: 'published',
    genre: 'Acústico Folk',
    key: 'Am',
    tempo: 95,
    year: 2023,
    tags: ['guitarra', 'melancolía', 'otoño'],
    lyrics: 'Cae la lluvia sobre los tejados\nsilencio en la ciudad',
    spotifyUrl: 'https://open.spotify.com/track/123',
    audioUrl: 'https://example.com/audio1.mp3',
    notes: 'Inspirada en las tardes de noviembre',
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01'
  },
  {
    id: 'cancion-2',
    title: 'Viento del Sur',
    status: 'draft',
    genre: 'Trova',
    key: 'G',
    tempo: 120,
    year: 2024,
    tags: ['guitarra', 'rápido'],
    lyrics: 'Sopla el viento del sur con fuerza',
    youtubeUrl: 'https://youtube.com/watch?v=456',
    notes: 'Borrador en desarrollo',
    createdAt: '2024-02-01',
    updatedAt: '2024-02-01'
  },
  {
    id: 'cancion-3',
    title: 'Secreto Nocturno',
    status: 'private',
    genre: 'Balada',
    key: 'C',
    tempo: 80,
    year: 2024,
    tags: ['piano', 'íntimo'],
    lyrics: 'Nadie sabe lo que callo por la noche',
    soundcloudUrl: 'https://soundcloud.com/user/789',
    notes: 'Confidencial para el nuevo álbum',
    createdAt: '2024-03-01',
    updatedAt: '2024-03-01'
  }
];

test('calculateSongCounts accurately computes counts for author vs public visitors', () => {
  const authorCounts = calculateSongCounts(MOCK_SONGS, true);
  assert.strictEqual(authorCounts.all, 3);
  assert.strictEqual(authorCounts.published, 1);
  assert.strictEqual(authorCounts.draft, 1);
  assert.strictEqual(authorCounts.private, 1);

  const publicCounts = calculateSongCounts(MOCK_SONGS, false);
  assert.strictEqual(publicCounts.all, 1);
  assert.strictEqual(publicCounts.published, 1);
  assert.strictEqual(publicCounts.draft, 1);
  assert.strictEqual(publicCounts.private, 1);
});

test('filterSongsList enforces author access: public users only receive published songs', () => {
  const publicResult = filterSongsList(MOCK_SONGS, false, {
    searchQuery: '',
    statusFilter: 'all',
    platformFilter: 'all',
    keyFilter: 'all',
    tagFilter: 'all'
  });

  assert.strictEqual(publicResult.length, 1);
  assert.strictEqual(publicResult[0].id, 'cancion-1');

  const authorResult = filterSongsList(MOCK_SONGS, true, {
    searchQuery: '',
    statusFilter: 'all',
    platformFilter: 'all',
    keyFilter: 'all',
    tagFilter: 'all'
  });

  assert.strictEqual(authorResult.length, 3);
});

test('filterSongsList filters correctly by status', () => {
  const drafts = filterSongsList(MOCK_SONGS, true, {
    searchQuery: '',
    statusFilter: 'draft',
    platformFilter: 'all',
    keyFilter: 'all',
    tagFilter: 'all'
  });

  assert.strictEqual(drafts.length, 1);
  assert.strictEqual(drafts[0].id, 'cancion-2');
});

test('filterSongsList supports accent-insensitive and case-insensitive search', () => {
  // Search 'cancion' matches 'Canción de la Lluvia'
  const searchResult = filterSongsList(MOCK_SONGS, true, {
    searchQuery: 'cancion',
    statusFilter: 'all',
    platformFilter: 'all',
    keyFilter: 'all',
    tagFilter: 'all'
  });
  assert.strictEqual(searchResult.length, 1);
  assert.strictEqual(searchResult[0].id, 'cancion-1');

  // Search inside lyrics
  const lyricSearch = filterSongsList(MOCK_SONGS, true, {
    searchQuery: 'tejados',
    statusFilter: 'all',
    platformFilter: 'all',
    keyFilter: 'all',
    tagFilter: 'all'
  });
  assert.strictEqual(lyricSearch.length, 1);
  assert.strictEqual(lyricSearch[0].id, 'cancion-1');

  // Search inside notes with accent
  const noteSearch = filterSongsList(MOCK_SONGS, true, {
    searchQuery: 'noviembre',
    statusFilter: 'all',
    platformFilter: 'all',
    keyFilter: 'all',
    tagFilter: 'all'
  });
  assert.strictEqual(noteSearch.length, 1);
  assert.strictEqual(noteSearch[0].id, 'cancion-1');
});

test('filterSongsList filters by streaming platform availability', () => {
  const spotifySongs = filterSongsList(MOCK_SONGS, true, {
    searchQuery: '',
    statusFilter: 'all',
    platformFilter: 'spotify',
    keyFilter: 'all',
    tagFilter: 'all'
  });
  assert.strictEqual(spotifySongs.length, 1);
  assert.strictEqual(spotifySongs[0].id, 'cancion-1');

  const youtubeSongs = filterSongsList(MOCK_SONGS, true, {
    searchQuery: '',
    statusFilter: 'all',
    platformFilter: 'youtube',
    keyFilter: 'all',
    tagFilter: 'all'
  });
  assert.strictEqual(youtubeSongs.length, 1);
  assert.strictEqual(youtubeSongs[0].id, 'cancion-2');
});

test('extractAvailableKeys and extractAvailableTags extract sorted distinct items', () => {
  const keysAuthor = extractAvailableKeys(MOCK_SONGS, true);
  assert.deepStrictEqual(keysAuthor, ['Am', 'C', 'G']);

  const keysPublic = extractAvailableKeys(MOCK_SONGS, false);
  assert.deepStrictEqual(keysPublic, ['Am']);

  const tagsAuthor = extractAvailableTags(MOCK_SONGS, true);
  const guitarTag = tagsAuthor.find(t => t.tag === 'guitarra');
  assert.ok(guitarTag);
  assert.strictEqual(guitarTag.count, 2);
});
