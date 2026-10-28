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
