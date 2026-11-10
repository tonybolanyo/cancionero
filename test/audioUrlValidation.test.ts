import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isValidPlayableAudioUrl, markdownToSong, songToMarkdown } from '../src/utils/markdownParser';
import { Song } from '../src/types/song';

describe('Audio URL Validation & Media Source Safeguards', () => {
  test('isValidPlayableAudioUrl correctly identifies valid web audio URLs', () => {
    assert.equal(isValidPlayableAudioUrl('https://example.com/audio.mp3'), true);
    assert.equal(isValidPlayableAudioUrl('http://example.com/audio.wav'), true);
    assert.equal(isValidPlayableAudioUrl('/assets/audio.mp3'), true);
    assert.equal(isValidPlayableAudioUrl('./audio.ogg'), true);
    assert.equal(isValidPlayableAudioUrl('data:audio/mp3;base64,AAAA'), true);
  });

  test('isValidPlayableAudioUrl rejects empty, null, or undefined values', () => {
    assert.equal(isValidPlayableAudioUrl(''), false);
    assert.equal(isValidPlayableAudioUrl('   '), false);
    assert.equal(isValidPlayableAudioUrl(null), false);
    assert.equal(isValidPlayableAudioUrl(undefined), false);
  });

  test('isValidPlayableAudioUrl rejects pseudo-protocols like gdrive://', () => {
    assert.equal(isValidPlayableAudioUrl('gdrive://file-id-12345'), false);
    assert.equal(isValidPlayableAudioUrl('gdrive://abc'), false);
  });

  test('isValidPlayableAudioUrl rejects expired or cross-origin blob URLs', () => {
    // In Node.js environment where window is undefined or different origin
    assert.equal(isValidPlayableAudioUrl('blob:https://tonygb.com/e65fd7ef-3b75-43b6-a20b-1195caec9af1'), false);
    assert.equal(isValidPlayableAudioUrl('blob:http://localhost:3000/123-456'), false);
  });

  test('markdownToSong filters out expired blob and pseudo-protocol audio URLs', () => {
    const rawMd = `---
id: "test-song"
title: "Canción de Prueba"
status: "published"
audioUrl: "blob:https://tonygb.com/e65fd7ef-3b75-43b6-a20b-1195caec9af1"
year: 2025
---
Letra de prueba`;

    const song = markdownToSong(rawMd);
    assert.equal(song.audioUrl, undefined, 'Expired blob audioUrl should be filtered out to prevent media source error');
  });

  test('markdownToSong preserves valid HTTPS audio URLs', () => {
    const rawMd = `---
id: "test-song-valid"
title: "Canción de Prueba"
status: "published"
audioUrl: "https://example.com/song.mp3"
year: 2025
---
Letra de prueba`;

    const song = markdownToSong(rawMd);
    assert.equal(song.audioUrl, 'https://example.com/song.mp3');
  });

  test('songToMarkdown does not write blob audioUrl to Markdown files', () => {
    const song: Song = {
      id: 'test-song-serialize',
      title: 'Canción a serializar',
      status: 'draft',
      year: 2025,
      genre: 'Acústica',
      key: 'C',
      lyrics: 'Verso 1',
      audioUrl: 'blob:https://tonygb.com/e65fd7ef-3b75-43b6-a20b-1195caec9af1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z'
    };

    const md = songToMarkdown(song);
    assert.ok(!md.includes('blob:https://tonygb.com'), 'Markdown frontmatter should never serialize transient blob audioUrl');
    assert.ok(!md.includes('audioUrl:'), 'audioUrl field should be omitted when url is blob:');
  });
});
