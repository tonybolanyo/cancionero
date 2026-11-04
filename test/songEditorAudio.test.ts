import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertChordsIntoLyrics, getCleanChordSequence, ChordSegment } from '../src/lib/audio/chords';
import { serializeToLrc, parseLrc } from '../src/lib/lyrics/parseLrc';
import { SyncedLyricLine } from '../src/types/lyrics';
import { songToMarkdown, markdownToSong } from '../src/utils/markdownParser';

test('insertChordsIntoLyrics correctly combines transcribed lyric lines with detected chords', () => {
  const transcribedText = `Caminando por la calle vieja
Buscando una respuesta en el silencio
Las campanas suenan a lo lejos
Y el viento trae recuerdos de ayer`;

  const detectedChords: ChordSegment[] = [
    { startTime: 0, endTime: 2, chord: 'Am', confidence: 0.95 },
    { startTime: 2, endTime: 4, chord: 'G', confidence: 0.92 },
    { startTime: 4, endTime: 6, chord: 'F', confidence: 0.88 },
    { startTime: 6, endTime: 8, chord: 'E7', confidence: 0.90 }
  ];

  const result = insertChordsIntoLyrics(transcribedText, detectedChords);

  assert.ok(result.includes('[Am] Caminando por la calle vieja'));
  assert.ok(result.includes('[G] Buscando una respuesta en el silencio'));
  assert.ok(result.includes('[F] Las campanas suenan a lo lejos'));
  assert.ok(result.includes('[E7] Y el viento trae recuerdos de ayer'));
});

test('getCleanChordSequence removes consecutive duplicates and N.C. tokens', () => {
  const rawChords = [
    { startTime: 0, endTime: 1, chord: 'N.C.', confidence: 0.5 },
    { startTime: 1, endTime: 2, chord: 'Am', confidence: 0.9 },
    { startTime: 2, endTime: 3, chord: 'Am', confidence: 0.85 },
    { startTime: 3, endTime: 4, chord: 'G', confidence: 0.9 },
    { startTime: 4, endTime: 5, chord: 'G', confidence: 0.92 },
    { startTime: 5, endTime: 6, chord: 'C', confidence: 0.88 }
  ];

  const cleaned = getCleanChordSequence(rawChords);
  assert.deepEqual(cleaned, ['Am', 'G', 'C']);
});

test('serializeToLrc and parseLrc round-trip transcribed lines accurately', () => {
  const lines: SyncedLyricLine[] = [
    { id: '1', time: 12.34, text: 'Primer verso detectado' },
    { id: '2', time: 16.78, text: 'Segundo verso cantado' }
  ];

  const serialized = serializeToLrc(lines, { title: 'Canción Test', artist: 'Tony' });
  assert.ok(serialized.includes('[00:12.34]Primer verso detectado') || serialized.includes('[00:12.34] Primer verso detectado'));
  assert.ok(serialized.includes('[ti:Canción Test]'));

  const parsed = parseLrc(serialized);
  assert.equal(parsed.lines.length, 2);
  assert.equal(parsed.lines[0].text, 'Primer verso detectado');
  assert.equal(parsed.lines[0].time, 12.34);
});

test('song markdown conversion preserves detected tempo, tuning, key, and album assignment', () => {
  const song = {
    id: 'cancion-analizada',
    title: 'Canción Analizada',
    status: 'published' as const,
    albumId: 'album-1',
    albumTitle: 'Cartas sin sello',
    trackNumber: 3,
    year: 2024,
    genre: 'Canción de Autor',
    key: 'Dm',
    tempo: 104,
    timeSignature: '3/4',
    tuning: 'Drop D (DADGBE)',
    lyrics: '## Estrofa\n[Dm] Noche sin luna\n[A7] Silencio en la sombra',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const md = songToMarkdown(song);
  assert.ok(md.includes('key: "Dm"'));
  assert.ok(md.includes('tempo: 104'));
  assert.ok(md.includes('timeSignature: "3/4"'));
  assert.ok(md.includes('tuning: "Drop D (DADGBE)"'));
  assert.ok(md.includes('albumId: "album-1"'));

  const parsed = markdownToSong(md, 'cancion-analizada');
  assert.equal(parsed.key, 'Dm');
  assert.equal(parsed.tempo, 104);
  assert.equal(parsed.timeSignature, '3/4');
  assert.equal(parsed.tuning, 'Drop D (DADGBE)');
  assert.equal(parsed.albumId, 'album-1');
});

test('song markdown conversion preserves driveFileId, driveFileName, and isPrivateDemo privacy flags', () => {
  const songWithDrive = {
    id: 'cancion-maqueta-drive',
    title: 'Maqueta Secreta en Drive',
    status: 'draft' as const,
    year: 2025,
    genre: 'Acústico',
    key: 'Am',
    lyrics: 'Verso secreto',
    driveFileId: '1AbCDeF_gh1234567890',
    driveFileName: 'Maqueta_Secreta_Demo_v1.mp3',
    isPrivateDemo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const md = songToMarkdown(songWithDrive);
  assert.ok(md.includes('driveFileId: "1AbCDeF_gh1234567890"'));
  assert.ok(md.includes('driveFileName: "Maqueta_Secreta_Demo_v1.mp3"'));
  assert.ok(md.includes('isPrivateDemo: true'));

  const parsed = markdownToSong(md, 'cancion-maqueta-drive');
  assert.equal(parsed.driveFileId, '1AbCDeF_gh1234567890');
  assert.equal(parsed.driveFileName, 'Maqueta_Secreta_Demo_v1.mp3');
  assert.equal(parsed.isPrivateDemo, true);

  // Test public demo flag as well
  const publicSong = { ...songWithDrive, isPrivateDemo: false };
  const publicMd = songToMarkdown(publicSong);
  assert.ok(publicMd.includes('isPrivateDemo: false'));
  const parsedPublic = markdownToSong(publicMd, 'cancion-maqueta-drive');
  assert.equal(parsedPublic.isPrivateDemo, false);
});
