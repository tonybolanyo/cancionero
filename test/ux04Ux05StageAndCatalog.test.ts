import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  filterSongsList,
  sortSongsList,
  songHasAudioSource,
  songHasSyncedLyrics
} from '../src/hooks/useSongCatalog';
import { Song } from '../src/types/song';

const readSrc = (relPath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf-8');

const SAMPLE_SONGS: Song[] = [
  {
    id: 'balada-lenta',
    title: 'Balada Lenta',
    status: 'published',
    year: 2021,
    genre: 'Balada',
    key: 'Am',
    tempo: 72,
    tags: ['acústico', 'guitarra', 'íntimo'],
    lyrics: 'Verso uno\nVerso dos',
    spotifyUrl: 'https://open.spotify.com/track/1',
    createdAt: '2021-05-01T10:00:00Z',
    updatedAt: '2023-02-10T10:00:00Z'
  },
  {
    id: 'pulso-medio',
    title: 'Pulso Medio',
    status: 'published',
    year: 2024,
    genre: 'Folk',
    key: 'G',
    tempo: 108,
    tags: ['acústico', 'directo'],
    lyrics: '[Am]Letra con acordes',
    lrc: '[00:05.00]Letra sincronizada',
    audioUrl: 'https://example.com/demo.mp3',
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z'
  },
  {
    id: 'ritmo-rapido',
    title: 'Ritmo Rápido',
    status: 'draft',
    year: 2025,
    genre: 'Rock',
    key: 'E',
    tempo: 142,
    tags: ['eléctrico', 'directo'],
    lyrics: '[00:10.00]Con lrc embebido',
    driveFileId: 'drive-123',
    audioUrl: 'gdrive://drive-123',
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-03-01T10:00:00Z'
  },
  {
    id: 'solo-texto',
    title: 'Alba Sin Tempo',
    status: 'published',
    year: 2020,
    genre: 'Trova',
    key: 'C',
    tags: ['poema'],
    lyrics: 'Solo letra y acordes [C]aquí',
    createdAt: '2020-01-01T10:00:00Z',
    updatedAt: '2022-06-01T10:00:00Z'
  }
];

describe('UX-04: StageModeOverlay live Capo, Transpose & Touch Usability', () => {
  it('provides Capo 0-7 and semitone transposition controls with >=44px touch targets and swipe navigation', () => {
    const stageSrc = readSrc('src/components/StageModeOverlay.tsx');

    // Live Capo 0-7 selector & quick +/- buttons
    assert.ok(stageSrc.includes('CAPO_FRETS = [0, 1, 2, 3, 4, 5, 6, 7]'));
    assert.ok(stageSrc.includes('aria-label="Cejilla (Capo)"'));
    assert.ok(stageSrc.includes('aria-label="Transposición en semitonos"'));

    // Touch targets >= 44px
    assert.ok(stageSrc.includes('min-h-[44px]'));

    // Horizontal swipe gesture handlers
    assert.ok(stageSrc.includes('onTouchStart={handleTouchStart}'));
    assert.ok(stageSrc.includes('onTouchEnd={handleTouchEnd}'));
    assert.ok(stageSrc.includes('touch-pan-y'));

    // Live sync callbacks back to SongDetailPage
    const detailSrc = readSrc('src/pages/SongDetailPage.tsx');
    assert.ok(detailSrc.includes('onCapoChange='));
    assert.ok(detailSrc.includes('onSemitonesChange='));
  });
});

describe('UX-05: Catalog Sorting, BPM & Media Filters, Multi-Tag & Interactive Links', () => {
  it('sorts songs by updated date, year, title A-Z/Z-A, and BPM', () => {
    const byUpdatedDesc = sortSongsList(SAMPLE_SONGS, 'updated-desc');
    assert.deepEqual(
      byUpdatedDesc.map(s => s.id),
      ['ritmo-rapido', 'pulso-medio', 'balada-lenta', 'solo-texto']
    );

    const byYearAsc = sortSongsList(SAMPLE_SONGS, 'year-asc');
    assert.deepEqual(
      byYearAsc.map(s => s.id),
      ['solo-texto', 'balada-lenta', 'pulso-medio', 'ritmo-rapido']
    );

    const byTitleAsc = sortSongsList(SAMPLE_SONGS, 'title-asc');
    assert.deepEqual(
      byTitleAsc.map(s => s.id),
      ['solo-texto', 'balada-lenta', 'pulso-medio', 'ritmo-rapido']
    );

    const byTempoAsc = sortSongsList(SAMPLE_SONGS, 'tempo-asc');
    assert.deepEqual(
      byTempoAsc.map(s => s.id),
      ['balada-lenta', 'pulso-medio', 'ritmo-rapido', 'solo-texto']
    );

    const byTempoDesc = sortSongsList(SAMPLE_SONGS, 'tempo-desc');
    assert.deepEqual(
      byTempoDesc.map(s => s.id),
      ['ritmo-rapido', 'pulso-medio', 'balada-lenta', 'solo-texto']
    );
  });

  it('filters songs by BPM range', () => {
    const base = {
      searchQuery: '',
      statusFilter: 'all' as const,
      platformFilter: 'all' as const,
      keyFilter: 'all',
      tagFilter: 'all'
    };

    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, bpmRange: 'slow' }).map(s => s.id),
      ['balada-lenta']
    );
    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, bpmRange: 'medium' }).map(s => s.id),
      ['pulso-medio']
    );
    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, bpmRange: 'fast' }).map(s => s.id),
      ['ritmo-rapido']
    );
    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, bpmRange: 'unspecified' }).map(s => s.id),
      ['solo-texto']
    );
  });

  it('filters songs by audio and LRC presence while guarding author Drive audio', () => {
    const base = {
      searchQuery: '',
      statusFilter: 'all' as const,
      platformFilter: 'all' as const,
      keyFilter: 'all',
      tagFilter: 'all'
    };

    assert.equal(songHasAudioSource(SAMPLE_SONGS[2], true), true);
    assert.equal(songHasAudioSource(SAMPLE_SONGS[2], false), false);
    assert.equal(songHasSyncedLyrics(SAMPLE_SONGS[1]), true);
    assert.equal(songHasSyncedLyrics(SAMPLE_SONGS[2]), true);
    assert.equal(songHasSyncedLyrics(SAMPLE_SONGS[0]), false);

    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, mediaFilter: 'has-lrc' }).map(s => s.id),
      ['pulso-medio', 'ritmo-rapido']
    );
    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, mediaFilter: 'audio-and-lrc' }).map(s => s.id),
      ['pulso-medio', 'ritmo-rapido']
    );
    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, mediaFilter: 'lyrics-only' }).map(s => s.id),
      ['solo-texto']
    );
  });

  it('supports multi-tag AND combination', () => {
    const base = {
      searchQuery: '',
      statusFilter: 'all' as const,
      platformFilter: 'all' as const,
      keyFilter: 'all',
      tagFilter: 'all'
    };

    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, selectedTags: ['acústico', 'directo'] }).map(s => s.id),
      ['pulso-medio']
    );
    assert.deepEqual(
      filterSongsList(SAMPLE_SONGS, true, { ...base, selectedTags: ['acústico', 'guitarra'] }).map(s => s.id),
      ['balada-lenta']
    );
  });

  it('uses real external links with rel="noopener noreferrer" in SongCard and SongExpandedRow instead of dead cursor-pointer spans', () => {
    for (const relPath of ['src/components/SongCard.tsx', 'src/components/SongExpandedRow.tsx']) {
      const src = readSrc(relPath);
      assert.ok(src.includes('rel="noopener noreferrer"'), `${relPath} should use rel="noopener noreferrer"`);
      assert.ok(src.includes('isSafeExternalUrl('), `${relPath} should validate external URLs`);
      assert.equal(
        /<span[^>]*cursor-pointer[^>]*>\s*(Spotify|YouTube|SoundCloud)/s.test(src),
        false,
        `${relPath} must not render non-interactive <span> elements with cursor-pointer for platforms`
      );
    }
  });
});
