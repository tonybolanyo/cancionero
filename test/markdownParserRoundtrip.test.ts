import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  songToMarkdown,
  markdownToSong,
  parseLyricLine,
  transposeChord,
  transposeLyrics,
  respellChord,
  respellLyrics,
  getYouTubeEmbedUrl,
  getSpotifyEmbedUrl
} from '../src/utils/markdownParser';
import { Song } from '../src/types/song';

describe('CAL-03: markdownParser.ts roundtrip & helpers', () => {
  it('performs lossless roundtrip for a full Song with multiline notes, LRC, quotes, tags, and audioAnalysis', () => {
    const original: Song = {
      id: 'cancion-roundtrip-completa',
      title: 'La canción del "faro" y el otoño',
      status: 'published',
      year: 2025,
      genre: 'Canción de Autor',
      key: 'F#m',
      tempo: 94,
      timeSignature: '3/4',
      tuning: 'Drop D',
      duration: '03:42',
      albumId: 'cartas-sin-sello',
      albumTitle: 'Cartas "sin" sello',
      trackNumber: 0,
      spotifyUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      appleMusicUrl: 'https://music.apple.com/es/album/example',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      soundcloudUrl: 'https://soundcloud.com/tonygb/demo',
      audioUrl: 'https://cdn.example.com/audio/faro.mp3',
      driveFileId: 'drive-id-999',
      driveFileName: 'Maqueta "Faro" final.wav',
      isPrivateDemo: false,
      coverImage: '/assets/covers/faro.jpg',
      notes: 'Grabada en casa\nCon "micro" de cinta y guitarra\\acústica',
      lrc: '[00:05.20] Primera línea\n[00:12.40] Segunda "línea" con retorno',
      tags: ['acústico', 'en-vivo', 'balada'],
      audioAnalysis: {
        analyzedAt: '2026-11-01T10:00:00.000Z',
        source: 'essentia_wasm',
        tempo: 94,
        tempoConfidence: 0.92,
        key: 'F#m',
        scale: 'minor',
        timeSignature: '3/4',
        detuningCents: -5,
        referenceA4Hz: 438.7,
        durationSeconds: 222,
        chordProgression: 'F#m - D - A - E',
        chords: [
          { startTime: 0, endTime: 4.5, chord: 'F#m', confidence: 0.91 },
          { startTime: 4.5, endTime: 9.0, chord: 'D/F#', confidence: 0.87 }
        ],
        sections: [
          {
            id: 'sec-1',
            type: 'Estrofa',
            label: 'Estrofa 1',
            startTime: 0,
            endTime: 32,
            confidence: 0.85,
            avgRms: 0.24,
            repetitionGroup: 1,
            isVocal: true
          }
        ],
        musicalNotes: 'Línea 1 del análisis\nLínea 2 con "comillas" y \\barra'
      },
      lyrics: '## Estrofa 1\n[F#m] En la orilla del [D] mar\n[A] suena el viento sin [E] parar',
      createdAt: '2025-02-10T08:00:00.000Z',
      updatedAt: '2026-11-01T10:05:00.000Z',
      gitHash: 'abc1234'
    };

    const markdown = songToMarkdown(original);
    const parsed = markdownToSong(markdown);

    assert.equal(parsed.id, original.id);
    assert.equal(parsed.title, original.title);
    assert.equal(parsed.status, original.status);
    assert.equal(parsed.year, original.year);
    assert.equal(parsed.genre, original.genre);
    assert.equal(parsed.key, original.key);
    assert.equal(parsed.tempo, original.tempo);
    assert.equal(parsed.timeSignature, original.timeSignature);
    assert.equal(parsed.tuning, original.tuning);
    assert.equal(parsed.duration, original.duration);
    assert.equal(parsed.albumId, original.albumId);
    assert.equal(parsed.albumTitle, original.albumTitle);
    assert.equal(parsed.trackNumber, 0);
    assert.equal(parsed.spotifyUrl, original.spotifyUrl);
    assert.equal(parsed.appleMusicUrl, original.appleMusicUrl);
    assert.equal(parsed.youtubeUrl, original.youtubeUrl);
    assert.equal(parsed.soundcloudUrl, original.soundcloudUrl);
    assert.equal(parsed.audioUrl, original.audioUrl);
    assert.equal(parsed.driveFileId, original.driveFileId);
    assert.equal(parsed.driveFileName, original.driveFileName);
    assert.equal(parsed.isPrivateDemo, false);
    assert.equal(parsed.coverImage, original.coverImage);
    assert.equal(parsed.notes, original.notes);
    assert.equal(parsed.lrc, original.lrc);
    assert.deepEqual(parsed.tags, original.tags);
    assert.deepEqual(parsed.audioAnalysis, original.audioAnalysis);
    assert.equal(parsed.lyrics, original.lyrics);
    assert.equal(parsed.createdAt, original.createdAt);
    assert.equal(parsed.updatedAt, original.updatedAt);
    assert.equal(parsed.gitHash, original.gitHash);

    // Second serialization pass should remain idempotent
    assert.equal(songToMarkdown(parsed), markdown);
  });

  it('roundtrips songs with empty lyrics without corrupting YAML frontmatter', () => {
    const instrumentalSong: Song = {
      id: 'tema-instrumental-vacio',
      title: 'Preludio Instrumental',
      status: 'draft',
      year: 2026,
      genre: 'Instrumental',
      key: 'Dm',
      tempo: 108,
      lyrics: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    };

    const md = songToMarkdown(instrumentalSong);
    const parsed = markdownToSong(md);

    assert.equal(parsed.id, instrumentalSong.id);
    assert.equal(parsed.title, instrumentalSong.title);
    assert.equal(parsed.status, 'draft');
    assert.equal(parsed.key, 'Dm');
    assert.equal(parsed.tempo, 108);
    assert.equal(parsed.lyrics, '');
  });

  it('falls back cleanly when markdown lacks YAML frontmatter', () => {
    const plain = '## Estrofa\n[Am] Verso suelto sin cabecera';
    const parsed = markdownToSong(plain, 'verso-suelto');

    assert.equal(parsed.id, 'verso-suelto');
    assert.equal(parsed.title, 'verso suelto');
    assert.equal(parsed.status, 'draft');
    assert.equal(parsed.lyrics, plain);
  });

  it('parses lyric lines with consecutive chords, leading whitespace, and plain lines accurately', () => {
    assert.deepEqual(parseLyricLine(''), []);
    assert.deepEqual(parseLyricLine('Línea sin acordes'), [{ chord: null, text: 'Línea sin acordes' }]);

    const parsed = parseLyricLine('  [C][G]Caminando [Am7]junto al río');
    assert.deepEqual(parsed, [
      { chord: null, text: '  ' },
      { chord: 'C', text: '' },
      { chord: 'G', text: 'Caminando ' },
      { chord: 'Am7', text: 'junto ' },
      { chord: null, text: 'al ' },
      { chord: null, text: 'río' }
    ]);
  });

  it('transposes and respells slash chords and full lyrics across semitone boundaries', () => {
    assert.equal(transposeChord('D/F#', 2), 'E/G#');
    assert.equal(transposeChord('C/G', -1), 'B/F#');
    assert.equal(transposeChord('Bb/D', 2), 'C/E');
    assert.equal(respellChord('F#/C#', 'flats'), 'Gb/Db');
    assert.equal(respellLyrics('[F#m]Luz [C#7]clara', 'flats'), '[Gbm]Luz [Db7]clara');
    assert.equal(transposeLyrics('[Am]Sol [F]mar', 2), '[Bm]Sol [G]mar');
  });

  it('extracts YouTube and Spotify embed URLs safely', () => {
    assert.equal(
      getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0'
    );
    assert.equal(getYouTubeEmbedUrl('https://example.com/not-youtube'), null);

    assert.equal(
      getSpotifyEmbedUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=123'),
      'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?utm_source=generator&theme=0'
    );
    assert.equal(getSpotifyEmbedUrl('https://open.spotify.com/album/abc'), null);
  });
});
