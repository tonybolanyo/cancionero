import test from 'node:test';
import assert from 'node:assert';
import { extractMonoChannelData } from '../src/lib/audio/bufferUtils';

test('extractMonoChannelData correctly averages stereo channels', () => {
  const length = 4;
  const ch0 = new Float32Array([1.0, 0.5, -0.5, 0.0]);
  const ch1 = new Float32Array([0.0, 0.5, 0.5, -1.0]);

  // Mock AudioBuffer
  const mockAudioBuffer = {
    numberOfChannels: 2,
    length,
    sampleRate: 44100,
    duration: length / 44100,
    getChannelData: (ch: number) => (ch === 0 ? ch0 : ch1)
  } as unknown as AudioBuffer;

  const mono = extractMonoChannelData(mockAudioBuffer);
  assert.strictEqual(mono.length, length);
  assert.strictEqual(mono[0], 0.5);
  assert.strictEqual(mono[1], 0.5);
  assert.strictEqual(mono[2], 0.0);
  assert.strictEqual(mono[3], -0.5);
});

test('extractMonoChannelData handles mono directly without modification', () => {
  const length = 3;
  const ch0 = new Float32Array([0.2, -0.4, 0.8]);

  const mockAudioBuffer = {
    numberOfChannels: 1,
    length,
    sampleRate: 44100,
    duration: length / 44100,
    getChannelData: () => ch0
  } as unknown as AudioBuffer;

  const mono = extractMonoChannelData(mockAudioBuffer);
  assert.strictEqual(mono.length, length);
  assert.ok(Math.abs(mono[0] - 0.2) < 1e-6);
  assert.ok(Math.abs(mono[1] - (-0.4)) < 1e-6);
  assert.ok(Math.abs(mono[2] - 0.8) < 1e-6);
});

test('chord segment lookup returns the active chord matching current time', () => {
  const chords = [
    { chord: 'C', startTime: 0, endTime: 3.0, confidence: 0.8 },
    { chord: 'G', startTime: 3.0, endTime: 6.0, confidence: 0.75 },
    { chord: 'Am', startTime: 6.0, endTime: 9.0, confidence: 0.85 },
    { chord: 'F', startTime: 9.0, endTime: 12.0, confidence: 0.7 }
  ];

  const getActiveChord = (t: number) => chords.find(c => t >= c.startTime && t < c.endTime);

  assert.strictEqual(getActiveChord(0)?.chord, 'C');
  assert.strictEqual(getActiveChord(2.9)?.chord, 'C');
  assert.strictEqual(getActiveChord(3.0)?.chord, 'G');
  assert.strictEqual(getActiveChord(7.5)?.chord, 'Am');
  assert.strictEqual(getActiveChord(11.9)?.chord, 'F');
  assert.strictEqual(getActiveChord(12.5), undefined);
});

test('TemplateChordRecognizer correctly identifies major, minor, and 5th chords', async () => {
  const { TemplateChordRecognizer } = await import('../src/lib/audio/chords');
  const recognizer = new TemplateChordRecognizer();

  // Test C Major triad: C (index 0), E (index 4), G (index 7)
  const cMajorChroma = new Float32Array(12);
  cMajorChroma[0] = 1.0;
  cMajorChroma[4] = 0.9;
  cMajorChroma[7] = 0.8;
  const cResult = recognizer.recognize(cMajorChroma);
  assert.strictEqual(cResult.chord, 'C');
  assert.ok(cResult.confidence > 0.8);

  // Test A Minor triad: A (index 9), C (index 0), E (index 4)
  const aMinorChroma = new Float32Array(12);
  aMinorChroma[9] = 1.0;
  aMinorChroma[0] = 0.85;
  aMinorChroma[4] = 0.8;
  const amResult = recognizer.recognize(aMinorChroma);
  assert.strictEqual(amResult.chord, 'Am');
  assert.ok(amResult.confidence > 0.8);

  // Test G5 power chord: G (index 7), D (index 2) without 3rd
  const g5Chroma = new Float32Array(12);
  g5Chroma[7] = 1.0;
  g5Chroma[2] = 0.9;
  const g5Result = recognizer.recognize(g5Chroma);
  assert.strictEqual(g5Result.chord, 'G5');
  assert.ok(g5Result.confidence > 0.7);
});

test('smoothChordWindows removes isolated transient glitch windows and merges segments', async () => {
  const { smoothChordWindows } = await import('../src/lib/audio/chords');
  const rawWindows = [
    { startTime: 0, endTime: 1, chord: 'C', confidence: 0.9 },
    { startTime: 1, endTime: 2, chord: 'C', confidence: 0.88 },
    { startTime: 2, endTime: 3, chord: 'F#m', confidence: 0.4 }, // transient glitch
    { startTime: 3, endTime: 4, chord: 'C', confidence: 0.91 },
    { startTime: 4, endTime: 5, chord: 'G', confidence: 0.85 },
    { startTime: 5, endTime: 6, chord: 'G', confidence: 0.89 }
  ];

  const smoothed = smoothChordWindows(rawWindows, 0.75);
  // Glitch F#m should be replaced by C, resulting in 2 contiguous segments: C (0->4s) and G (4->6s)
  assert.strictEqual(smoothed.length, 2);
  assert.strictEqual(smoothed[0].chord, 'C');
  assert.strictEqual(smoothed[0].startTime, 0);
  assert.strictEqual(smoothed[0].endTime, 4);
  assert.strictEqual(smoothed[1].chord, 'G');
  assert.strictEqual(smoothed[1].startTime, 4);
  assert.strictEqual(smoothed[1].endTime, 6);
});

test('alignChordsToBeats snaps chord boundary to closest beat within tolerance', async () => {
  const { alignChordsToBeats } = await import('../src/lib/audio/chords');
  const segments = [
    { startTime: 0, endTime: 3.12, chord: 'C', confidence: 0.9 },
    { startTime: 3.12, endTime: 6.0, chord: 'Am', confidence: 0.85 }
  ];
  // Beat is at 3.0s (within 0.35s tolerance)
  const beats = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];

  const aligned = alignChordsToBeats(segments, beats, 0.35);
  assert.strictEqual(aligned.length, 2);
  assert.strictEqual(aligned[0].endTime, 3.0);
  assert.strictEqual(aligned[1].startTime, 3.0);
});

test('exportChordsToJSON produces valid JSON structure with metadata', async () => {
  const { exportChordsToJSON } = await import('../src/lib/audio/chords');
  const segments = [
    { startTime: 0, endTime: 2.5, chord: 'C', confidence: 0.89 },
    { startTime: 2.5, endTime: 5.0, chord: 'G', confidence: 0.82 }
  ];

  const jsonStr = exportChordsToJSON(segments, 'Demo Song');
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.title, 'Demo Song');
  assert.strictEqual(parsed.totalSegments, 2);
  assert.strictEqual(parsed.segments[0].chord, 'C');
  assert.strictEqual(parsed.segments[0].duration, 2.5);
  assert.strictEqual(parsed.segments[1].chord, 'G');
});

test('exportChordsToCSV produces standard CSV header and row format', async () => {
  const { exportChordsToCSV } = await import('../src/lib/audio/chords');
  const segments = [
    { startTime: 0, endTime: 2.5, chord: 'C', confidence: 0.89 },
    { startTime: 2.5, endTime: 5.0, chord: 'G', confidence: 0.82 }
  ];

  const csvStr = exportChordsToCSV(segments);
  const lines = csvStr.trim().split('\n');
  assert.strictEqual(lines[0], 'chord,start_time,end_time,duration_seconds,confidence');
  assert.strictEqual(lines[1], 'C,0.000,2.500,2.500,0.89');
  assert.strictEqual(lines[2], 'G,2.500,5.000,2.500,0.82');
});

test('TemplateChordRecognizer correctly identifies 7th, maj7, m7, and suspended chords', async () => {
  const { TemplateChordRecognizer } = await import('../src/lib/audio/chords');
  const recognizer = new TemplateChordRecognizer();

  // 1. Dominant 7th (C7 = C, E, G, Bb -> indices 0, 4, 7, 10)
  const c7Chroma = new Float32Array(12);
  c7Chroma[0] = 1.0;
  c7Chroma[4] = 0.85;
  c7Chroma[7] = 0.70;
  c7Chroma[10] = 0.80;
  const c7Result = recognizer.recognize(c7Chroma);
  assert.strictEqual(c7Result.chord, 'C7');
  assert.ok(c7Result.confidence > 0.85);

  // 2. Major 7th (Cmaj7 = C, E, G, B -> indices 0, 4, 7, 11)
  const cMaj7Chroma = new Float32Array(12);
  cMaj7Chroma[0] = 1.0;
  cMaj7Chroma[4] = 0.85;
  cMaj7Chroma[7] = 0.70;
  cMaj7Chroma[11] = 0.80;
  const cMaj7Result = recognizer.recognize(cMaj7Chroma);
  assert.strictEqual(cMaj7Result.chord, 'Cmaj7');
  assert.ok(cMaj7Result.confidence > 0.85);

  // 3. Minor 7th (Am7 = A, C, E, G -> indices 9, 0, 4, 7)
  const am7Chroma = new Float32Array(12);
  am7Chroma[9] = 1.0;
  am7Chroma[0] = 0.85;
  am7Chroma[4] = 0.70;
  am7Chroma[7] = 0.80;
  const am7Result = recognizer.recognize(am7Chroma);
  assert.strictEqual(am7Result.chord, 'Am7');
  assert.ok(am7Result.confidence > 0.85);

  // 4. Suspended 2nd (Dsus2 = D, E, A -> indices 2, 4, 9)
  const dsus2Chroma = new Float32Array(12);
  dsus2Chroma[2] = 1.0;
  dsus2Chroma[4] = 0.85;
  dsus2Chroma[9] = 0.75;
  const dsus2Result = recognizer.recognize(dsus2Chroma);
  assert.strictEqual(dsus2Result.chord, 'Dsus2');
  assert.ok(dsus2Result.confidence > 0.85);

  // 5. Suspended 4th (Dsus4 = D, G, A -> indices 2, 7, 9)
  const dsus4Chroma = new Float32Array(12);
  dsus4Chroma[2] = 1.0;
  dsus4Chroma[7] = 0.85;
  dsus4Chroma[9] = 0.75;
  const dsus4Result = recognizer.recognize(dsus4Chroma);
  assert.strictEqual(dsus4Result.chord, 'Dsus4');
  assert.ok(dsus4Result.confidence > 0.85);
});

test('insertChordsIntoLyrics correctly formats lyrics and preserves structure', async () => {
  const { insertChordsIntoLyrics } = await import('../src/lib/audio/chords');
  const detectedChords = [
    { startTime: 0, endTime: 2, chord: 'C', confidence: 0.9 },
    { startTime: 2, endTime: 4, chord: 'G7', confidence: 0.88 },
    { startTime: 4, endTime: 6, chord: 'Am7', confidence: 0.85 },
    { startTime: 6, endTime: 8, chord: 'Fsus2', confidence: 0.87 }
  ];

  // Case 1: Empty or default placeholder lyrics
  const generated = insertChordsIntoLyrics('', detectedChords);
  assert.ok(generated.includes('## Estrofa 1'));
  assert.ok(generated.includes('[C] Primer verso'));
  assert.ok(generated.includes('[G7] Segundo verso'));
  assert.ok(generated.includes('## Estribillo'));

  // Case 2: Custom text verses without chords
  const customLyrics = [
    '## Estrofa',
    'Caminando bajo el cielo',
    'sintiendo la brisa llegar',
    'todo vuelve a comenzar',
    'y la noche se va'
  ].join('\n');

  const withChords = insertChordsIntoLyrics(customLyrics, detectedChords);
  assert.ok(withChords.includes('## Estrofa'));
  assert.ok(withChords.includes('[C] Caminando bajo el cielo'));
  assert.ok(withChords.includes('[G7] sintiendo la brisa llegar'));
  assert.ok(withChords.includes('[Am7] todo vuelve a comenzar'));
  assert.ok(withChords.includes('[Fsus2] y la noche se va'));

  // Case 3: Custom verses with existing outdated bracketed chords
  const oldChordsLyrics = [
    '## Estrofa',
    '[Em] Caminando bajo el cielo',
    '[D] sintiendo la brisa llegar'
  ].join('\n');

  const replaced = insertChordsIntoLyrics(oldChordsLyrics, detectedChords);
  assert.ok(replaced.includes('[C] Caminando bajo el cielo'));
  assert.ok(replaced.includes('[G7] sintiendo la brisa llegar'));
  assert.ok(!replaced.includes('[Em]'));
  assert.ok(!replaced.includes('[D]'));
});

test('TemplateChordRecognizer correctly identifies diminished, m7b5, and augmented chords', async () => {
  const { TemplateChordRecognizer } = await import('../src/lib/audio/chords');
  const recognizer = new TemplateChordRecognizer();

  // 1. Diminished Triad (Cdim = C, Eb, F#/Gb -> indices 0, 3, 6)
  const cdimChroma = new Float32Array(12);
  cdimChroma[0] = 1.0;
  cdimChroma[3] = 0.85;
  cdimChroma[6] = 0.80;
  const cdimResult = recognizer.recognize(cdimChroma);
  assert.strictEqual(cdimResult.chord, 'Cdim');
  assert.ok(cdimResult.confidence > 0.85);

  // 2. Half-Diminished 7th (Bm7b5 = B, D, F, A -> indices 11, 2, 5, 9)
  const bm7b5Chroma = new Float32Array(12);
  bm7b5Chroma[11] = 1.0;
  bm7b5Chroma[2] = 0.85;
  bm7b5Chroma[5] = 0.75;
  bm7b5Chroma[9] = 0.80;
  const bm7b5Result = recognizer.recognize(bm7b5Chroma);
  assert.strictEqual(bm7b5Result.chord, 'Bm7b5');
  assert.ok(bm7b5Result.confidence > 0.85);

  // 3. Augmented Triad (Caug = C, E, G#/Ab -> indices 0, 4, 8)
  const caugChroma = new Float32Array(12);
  caugChroma[0] = 1.0;
  caugChroma[4] = 0.85;
  caugChroma[8] = 0.80;
  const caugResult = recognizer.recognize(caugChroma);
  assert.strictEqual(caugResult.chord, 'Caug');
  assert.ok(caugResult.confidence > 0.85);
});

test('transposeLyrics and transposeChord correctly handle dim, m7b5, aug with -1 and +1 semitones', async () => {
  const { transposeChord, transposeLyrics } = await import('../src/utils/markdownParser');

  // Single chord transpositions
  assert.strictEqual(transposeChord('Cdim', 1), 'C#dim');
  assert.strictEqual(transposeChord('Cdim', -1), 'Bdim');

  assert.strictEqual(transposeChord('Bm7b5', 1), 'Cm7b5');
  assert.strictEqual(transposeChord('Bm7b5', -1), 'A#m7b5');

  assert.strictEqual(transposeChord('Gaug', 2), 'Aaug');
  assert.strictEqual(transposeChord('Gaug', -1), 'F#aug');

  // Full lyrics transposition
  const lyricsSample = '[Cdim] Primer verso con acordes\n[Bm7b5] Segundo verso\n[Caug] Tercer verso';
  const transposedUp = transposeLyrics(lyricsSample, 1);
  assert.ok(transposedUp.includes('[C#dim] Primer verso'));
  assert.ok(transposedUp.includes('[Cm7b5] Segundo verso'));
  assert.ok(transposedUp.includes('[C#aug] Tercer verso'));

  const transposedDown = transposeLyrics(lyricsSample, -1);
  assert.ok(transposedDown.includes('[Bdim] Primer verso'));
  assert.ok(transposedDown.includes('[A#m7b5] Segundo verso'));
  assert.ok(transposedDown.includes('[Baug] Tercer verso'));
});

test('respellChord and respellLyrics correctly convert between sharps (#) and flats (b)', async () => {
  const { respellChord, respellLyrics, transposeChord } = await import('../src/utils/markdownParser');

  // 1. Respell individual chord roots with flats preference
  assert.strictEqual(respellChord('F#', 'flats'), 'Gb');
  assert.strictEqual(respellChord('C#m', 'flats'), 'Dbm');
  assert.strictEqual(respellChord('D#7', 'flats'), 'Eb7');
  assert.strictEqual(respellChord('G#maj7', 'flats'), 'Abmaj7');
  assert.strictEqual(respellChord('A#m7b5', 'flats'), 'Bbm7b5');
  assert.strictEqual(respellChord('F#dim', 'flats'), 'Gbdim');
  assert.strictEqual(respellChord('A#sus4', 'flats'), 'Bbsus4');

  // 2. Respell individual chord roots with sharps preference
  assert.strictEqual(respellChord('Gb', 'sharps'), 'F#');
  assert.strictEqual(respellChord('Dbm', 'sharps'), 'C#m');
  assert.strictEqual(respellChord('Eb7', 'sharps'), 'D#7');
  assert.strictEqual(respellChord('Abmaj7', 'sharps'), 'G#maj7');
  assert.strictEqual(respellChord('Bbm7b5', 'sharps'), 'A#m7b5');
  assert.strictEqual(respellChord('Gbdim', 'sharps'), 'F#dim');
  assert.strictEqual(respellChord('Bbsus4', 'sharps'), 'A#sus4');

  // 3. Natural roots unaffected
  assert.strictEqual(respellChord('C', 'flats'), 'C');
  assert.strictEqual(respellChord('Am', 'flats'), 'Am');
  assert.strictEqual(respellChord('G7', 'sharps'), 'G7');

  // 4. Transpose with flat preference (e.g. F + 1 st = Gb in flat mode, F# in sharp mode)
  assert.strictEqual(transposeChord('F', 1, 'flats'), 'Gb');
  assert.strictEqual(transposeChord('F', 1, 'sharps'), 'F#');

  // 5. Full song lyrics respelling
  const sharpLyrics = '## Estribillo\n[F#] Y en las noches de [C#m] soledad\n[D#7] sigo buscando tu [A#m7b5] voz';
  const flatLyrics = respellLyrics(sharpLyrics, 'flats');
  assert.ok(flatLyrics.includes('[Gb] Y en las noches'));
  assert.ok(flatLyrics.includes('[Dbm] soledad'));
  assert.ok(flatLyrics.includes('[Eb7] sigo buscando'));
  assert.ok(flatLyrics.includes('[Bbm7b5] voz'));

  // Roundtrip back to sharps
  const roundtrip = respellLyrics(flatLyrics, 'sharps');
  assert.ok(roundtrip.includes('[F#] Y en las noches'));
  assert.ok(roundtrip.includes('[C#m] soledad'));
  assert.ok(roundtrip.includes('[D#7] sigo buscando'));
  assert.ok(roundtrip.includes('[A#m7b5] voz'));
});

