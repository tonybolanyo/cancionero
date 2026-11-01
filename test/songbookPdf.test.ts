import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSongbookHtml } from '../src/utils/songbookPdf';
import { Song } from '../src/types/song';

const MOCK_SONGS: Song[] = [
  {
    id: 'noches-de-cristal',
    title: 'Noches de Cristal',
    genre: 'Balada Folk',
    year: 2024,
    status: 'published',
    key: 'Am',
    timeSignature: '4/4',
    tuning: 'Estándar',
    tempo: 96,
    lyrics: `## Estrofa 1
[Am]Camino por las calles de esta [C]vieja ciudad
[G]Buscando entre las sombras la [F]verdad

## Estribillo
[Dm]Noches de cristal, [Am]sueños de papel
[E7]Todo lo que fuimos se marchó con [Am]él`,
    notes: 'Tocar con arpegio suave en las estrofas y rasgueo dinámico en el estribillo.',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02'
  },
  {
    id: 'si-me-pierdo',
    title: 'Si Me Pierdo',
    genre: 'Acústico',
    year: 2025,
    status: 'published',
    key: 'G',
    timeSignature: '3/4',
    tempo: 120,
    lyrics: `## Estrofa 1
[G]Si me pierdo en el [C]camino
[D]Búscame cerca del [G]mar`,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-02'
  }
];

test('generateSongbookHtml produces complete HTML with A4 print styles and metadata', () => {
  const html = generateSongbookHtml(MOCK_SONGS, {
    title: 'Cancionero de Prueba',
    author: 'Tony',
    includeCover: true,
    includeIndex: true,
    showChords: true,
    chordPosition: 'above'
  });

  // Verify doctype and title
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('Cancionero de Prueba - Edición Atril'));

  // Verify fonts and CSS variables
  assert.ok(html.includes('Fraunces'));
  assert.ok(html.includes('JetBrains Mono'));
  assert.ok(html.includes('@page {'));
  assert.ok(html.includes('size: A4 portrait;'));

  // Verify cover page
  assert.ok(html.includes('musician-cover-page'));
  assert.ok(html.includes('Cancionero de Prueba'));
  assert.ok(html.includes('Tony'));

  // Verify Table of Contents
  assert.ok(html.includes('musician-toc-page'));
  assert.ok(html.includes('Índice del Cancionero'));
  assert.ok(html.includes('Noches de Cristal'));
  assert.ok(html.includes('Si Me Pierdo'));

  // Verify individual song sheets
  assert.ok(html.includes('data-song-id="noches-de-cristal"'));
  assert.ok(html.includes('data-song-id="si-me-pierdo"'));
  assert.ok(html.includes('TONO'));
  assert.ok(html.includes('AFINACIÓN'));
  assert.ok(html.includes('COMPÁS'));
  assert.ok(html.includes('TEMPO'));
});

test('generateSongbookHtml supports chordPosition above and inline', () => {
  const htmlAbove = generateSongbookHtml(MOCK_SONGS, {
    chordPosition: 'above',
    includeCover: false,
    includeIndex: false
  });
  assert.ok(htmlAbove.includes('musician-chord-segment'));
  assert.ok(htmlAbove.includes('musician-chord-text'));

  const htmlInline = generateSongbookHtml(MOCK_SONGS, {
    chordPosition: 'inline',
    includeCover: false,
    includeIndex: false
  });
  assert.ok(htmlInline.includes('musician-chord-inline'));
  assert.ok(htmlInline.includes('musician-line-inline'));
});

test('generateSongbookHtml handles per-song transposition correctly', () => {
  // Transpose 'Noches de Cristal' (Am) +2 semitones -> Bm
  const html = generateSongbookHtml(MOCK_SONGS, {
    semitonesMap: {
      'noches-de-cristal': 2
    },
    includeCover: false,
    includeIndex: false
  });

  assert.ok(html.includes('Bm (+2)'));
  assert.ok(html.includes('Bm')); // transposed chord
});

test('generateSongbookHtml respects section headers and chorus styling', () => {
  const html = generateSongbookHtml([MOCK_SONGS[0]], {
    includeCover: false,
    includeIndex: false
  });

  assert.ok(html.includes('musician-print-section'));
  assert.ok(html.includes('musician-print-section-header'));
  assert.ok(html.includes('is-chorus')); // [ ESTRIBILLO ]
  assert.ok(html.includes('musician-notes-box'));
  assert.ok(html.includes('Tocar con arpegio suave'));
});

test('generateSongbookHtml escapes special characters safely', () => {
  const unsafeSong: Song = {
    id: 'unsafe-1',
    title: '<script>alert("xss")</script> & Canción',
    genre: 'Folk <Rock>',
    year: 2026,
    status: 'published',
    key: 'C',
    lyrics: 'Letra con <etiqueta> y & ampersand',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  };

  const html = generateSongbookHtml([unsafeSong], {
    includeCover: true,
    includeIndex: true
  });

  assert.ok(!html.includes('<script>alert("xss")</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('&amp; Canción'));
});
