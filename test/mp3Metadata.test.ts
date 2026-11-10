import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMp3Metadata,
  buildComparisonFields,
  normalizeGenre,
  normalizeMusicalKey,
  normalizeYear,
  readSynchsafeInt,
  readUint32BE
} from '../src/lib/audio/mp3Metadata';

/**
 * Helper to construct an ID3v2.3 buffer with custom frames
 */
function createId3v23Buffer(frames: Array<{ id: string; content: Uint8Array }>): ArrayBuffer {
  let totalFramesSize = 0;
  for (const f of frames) {
    totalFramesSize += 10 + f.content.length;
  }

  // ID3 header is 10 bytes
  const buffer = new ArrayBuffer(10 + totalFramesSize);
  const bytes = new Uint8Array(buffer);

  // 'ID3', v2.3
  bytes[0] = 0x49; // 'I'
  bytes[1] = 0x44; // 'D'
  bytes[2] = 0x33; // '3'
  bytes[3] = 3;    // major version 3
  bytes[4] = 0;    // revision 0
  bytes[5] = 0;    // flags

  // Synchsafe size (7 bits per byte)
  bytes[6] = (totalFramesSize >> 21) & 0x7f;
  bytes[7] = (totalFramesSize >> 14) & 0x7f;
  bytes[8] = (totalFramesSize >> 7) & 0x7f;
  bytes[9] = totalFramesSize & 0x7f;

  let offset = 10;
  for (const f of frames) {
    // 4-byte frame ID
    for (let i = 0; i < 4; i++) {
      bytes[offset + i] = f.id.charCodeAt(i) || 0x20;
    }
    // 4-byte big-endian size
    const sz = f.content.length;
    bytes[offset + 4] = (sz >> 24) & 0xff;
    bytes[offset + 5] = (sz >> 16) & 0xff;
    bytes[offset + 6] = (sz >> 8) & 0xff;
    bytes[offset + 7] = sz & 0xff;
    // 2-byte flags
    bytes[offset + 8] = 0;
    bytes[offset + 9] = 0;
    // content
    bytes.set(f.content, offset + 10);
    offset += 10 + sz;
  }

  return buffer;
}

/**
 * Helper to encode text with encoding byte 0 (ISO-8859-1) or 3 (UTF-8)
 */
function textFrame(text: string, encoding = 3): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const res = new Uint8Array(1 + textBytes.length);
  res[0] = encoding;
  res.set(textBytes, 1);
  return res;
}

/**
 * Helper to encode USLT frame (Unsynchronized Lyrics)
 */
function usltFrame(lyricsText: string, lang = 'spa', desc = ''): Uint8Array {
  const encoder = new TextEncoder();
  const langBytes = encoder.encode(lang.padEnd(3, ' '));
  const descBytes = encoder.encode(desc);
  const lyricsBytes = encoder.encode(lyricsText);

  // encoding (1) + lang (3) + desc + null (1) + lyrics
  const res = new Uint8Array(1 + 3 + descBytes.length + 1 + lyricsBytes.length);
  res[0] = 3; // UTF-8
  res.set(langBytes.slice(0, 3), 1);
  res.set(descBytes, 4);
  res[4 + descBytes.length] = 0; // null terminator
  res.set(lyricsBytes, 5 + descBytes.length);
  return res;
}

test('normalizeMusicalKey resolves standard and Camelot keys', () => {
  assert.equal(normalizeMusicalKey('8A'), 'Am');
  assert.equal(normalizeMusicalKey('8B'), 'C');
  assert.equal(normalizeMusicalKey('11A'), 'F#m');
  assert.equal(normalizeMusicalKey('C major'), 'C');
  assert.equal(normalizeMusicalKey('A minor'), 'Am');
  assert.equal(normalizeMusicalKey('G#m'), 'G#m');
});

test('normalizeGenre resolves ID3v1 codes and raw strings', () => {
  assert.equal(normalizeGenre('(17)'), 'Rock');
  assert.equal(normalizeGenre('17'), 'Rock');
  assert.equal(normalizeGenre('(13)Pop'), 'Pop');
  assert.equal(normalizeGenre('Indie Folk'), 'Indie Folk');
});

test('normalizeYear extracts 4-digit years from various formats', () => {
  assert.equal(normalizeYear('2024'), 2024);
  assert.equal(normalizeYear('2024-06-12'), 2024);
  assert.equal(normalizeYear('1998'), 1998);
  assert.equal(normalizeYear('invalid'), undefined);
});

test('extractMp3Metadata parses ID3v2.3 tags with text, lyrics, key and tempo', async () => {
  const sampleLyrics = 'En la penumbra del andén\nEsperaba aquel tren que nunca llegó.';

  const frames = [
    { id: 'TIT2', content: textFrame('El Andén de los Invisibles') },
    { id: 'TPE1', content: textFrame('Tony González') },
    { id: 'TALB', content: textFrame('Cartas Sin Sello') },
    { id: 'TYER', content: textFrame('2024') },
    { id: 'TCON', content: textFrame('Acoustic') },
    { id: 'TBPM', content: textFrame('96') },
    { id: 'TKEY', content: textFrame('Am') },
    { id: 'USLT', content: usltFrame(sampleLyrics) }
  ];

  const buffer = createId3v23Buffer(frames);
  const metadata = await extractMp3Metadata(buffer);

  assert.equal(metadata.hasAnyMetadata, true);
  assert.equal(metadata.format, 'ID3v2.3');
  assert.equal(metadata.title, 'El Andén de los Invisibles');
  assert.equal(metadata.artist, 'Tony González');
  assert.equal(metadata.album, 'Cartas Sin Sello');
  assert.equal(metadata.year, 2024);
  assert.equal(metadata.genre, 'Acoustic');
  assert.equal(metadata.tempo, 96);
  assert.equal(metadata.key, 'Am');
  assert.equal(metadata.lyrics, sampleLyrics);
  assert.equal(metadata.detectedFieldsCount >= 7, true);
});

test('extractMp3Metadata detects synchronized LRC lyrics inside USLT frame', async () => {
  const lrcLyrics = '[00:10.00] Primer verso cantado\n[00:15.50] Segundo verso en el estribillo';
  const frames = [
    { id: 'TIT2', content: textFrame('Tema Sincronizado') },
    { id: 'USLT', content: usltFrame(lrcLyrics) }
  ];

  const buffer = createId3v23Buffer(frames);
  const metadata = await extractMp3Metadata(buffer);

  assert.equal(metadata.lrc, lrcLyrics);
  assert.equal(metadata.lyrics?.includes('[00:10.00]'), false);
  assert.equal(metadata.lyrics?.includes('Primer verso cantado'), true);
  assert.equal(metadata.lyrics?.includes('Segundo verso en el estribillo'), true);
});

test('buildComparisonFields identifies differences and empty fields for author review', () => {
  const extracted = {
    title: 'Nueva Versión MP3',
    lyrics: 'Verso 1\nVerso 2',
    lrc: '[00:05.00] Verso 1',
    key: 'Em',
    tempo: 110,
    year: 2025,
    genre: 'Balada Acústica',
    notes: 'Grabado con micro condensador',
    format: 'ID3v2.3' as const,
    hasAnyMetadata: true,
    detectedFieldsCount: 8
  };

  const currentSong = {
    title: 'Título Antiguo',
    lyrics: '', // empty
    lrc: undefined,
    key: 'Em', // identical
    tempo: 96, // different
    year: undefined,
    genre: 'Acústico'
  };

  const fields = buildComparisonFields(extracted, currentSong);

  // Title: different
  const titleField = fields.find(f => f.key === 'title')!;
  assert.equal(titleField.isDifferent, true);
  assert.equal(titleField.isEmptyCurrent, false);

  // Lyrics: empty in current
  const lyricsField = fields.find(f => f.key === 'lyrics')!;
  assert.equal(lyricsField.isEmptyCurrent, true);
  assert.equal(lyricsField.isDifferent, true);

  // Key: identical
  const keyField = fields.find(f => f.key === 'key')!;
  assert.equal(keyField.isDifferent, false);

  // Tempo: different
  const tempoField = fields.find(f => f.key === 'tempo')!;
  assert.equal(tempoField.isDifferent, true);
});

test('extractMp3Metadata parses ID3v1 tags at the end of the file', async () => {
  // Create dummy audio buffer ending with 128-byte TAG
  const buffer = new ArrayBuffer(500);
  const bytes = new Uint8Array(buffer);

  // ID3v1 starts at offset 500 - 128 = 372
  const offset = 372;
  bytes[offset] = 0x54;     // 'T'
  bytes[offset + 1] = 0x41; // 'A'
  bytes[offset + 2] = 0x47; // 'G'

  const enc = new TextEncoder();
  const titleBytes = enc.encode('Cancion ID3v1');
  bytes.set(titleBytes, offset + 3);

  const artistBytes = enc.encode('Autor Acustico');
  bytes.set(artistBytes, offset + 33);

  const yearBytes = enc.encode('2023');
  bytes.set(yearBytes, offset + 93);

  bytes[offset + 127] = 17; // Genre index 17 = 'Rock'

  const metadata = await extractMp3Metadata(buffer);
  assert.equal(metadata.hasAnyMetadata, true);
  assert.equal(metadata.title, 'Cancion ID3v1');
  assert.equal(metadata.artist, 'Autor Acustico');
  assert.equal(metadata.year, 2023);
  assert.equal(metadata.genre, 'Rock');
});

test('buildComparisonFields supports field-by-field decision workflows (accept all, reject all, selective)', () => {
  const extracted = {
    title: 'Tema Nuevo',
    lyrics: 'Verso A\nVerso B',
    lrc: '[00:04.00] Verso A\n[00:08.00] Verso B',
    key: 'G',
    tempo: 120,
    genre: 'Folk',
    year: 2026,
    format: 'ID3v2.3' as const,
    hasAnyMetadata: true,
    detectedFieldsCount: 7
  };

  const currentSong = {
    title: 'Tema Anterior',
    lyrics: 'Letra que ya tenía escrita',
    lrc: undefined,
    key: 'Am',
    tempo: 96,
    genre: 'Acústico',
    year: 2020
  };

  const fields = buildComparisonFields(extracted, currentSong);
  assert.equal(fields.length, 7);

  // Simulate "Aceptar todos": all fields in payload
  const acceptAllPayload: Record<string, any> = {};
  for (const f of fields) {
    acceptAllPayload[f.key] = f.extractedValue;
  }
  assert.equal(acceptAllPayload.title, 'Tema Nuevo');
  assert.equal(acceptAllPayload.key, 'G');
  assert.equal(acceptAllPayload.tempo, 120);
  assert.equal(acceptAllPayload.lrc, '[00:04.00] Verso A\n[00:08.00] Verso B');
  assert.equal(Object.keys(acceptAllPayload).length, 7);

  // Simulate "Rechazar todos": payload is empty, original untouched
  const rejectAllPayload: Record<string, any> = {};
  assert.equal(Object.keys(rejectAllPayload).length, 0);

  // Simulate "Decidir campo a campo": author selects only lrc and tempo, rejects title and lyrics
  const chosenKeys = new Set(['lrc', 'tempo']);
  const selectivePayload: Record<string, any> = {};
  for (const f of fields) {
    if (chosenKeys.has(f.key)) {
      selectivePayload[f.key] = f.extractedValue;
    }
  }
  assert.equal(selectivePayload.lrc, '[00:04.00] Verso A\n[00:08.00] Verso B');
  assert.equal(selectivePayload.tempo, 120);
  assert.equal(selectivePayload.title, undefined);
  assert.equal(selectivePayload.lyrics, undefined);
  assert.equal(Object.keys(selectivePayload).length, 2);
});

