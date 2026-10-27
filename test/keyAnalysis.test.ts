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
    { chord: 'C', startTime: 0, endTime: 3.0, strength: 0.8 },
    { chord: 'G', startTime: 3.0, endTime: 6.0, strength: 0.75 },
    { chord: 'Am', startTime: 6.0, endTime: 9.0, strength: 0.85 },
    { chord: 'F', startTime: 9.0, endTime: 12.0, strength: 0.7 }
  ];

  const getActiveChord = (t: number) => chords.find(c => t >= c.startTime && t < c.endTime);

  assert.strictEqual(getActiveChord(0)?.chord, 'C');
  assert.strictEqual(getActiveChord(2.9)?.chord, 'C');
  assert.strictEqual(getActiveChord(3.0)?.chord, 'G');
  assert.strictEqual(getActiveChord(7.5)?.chord, 'Am');
  assert.strictEqual(getActiveChord(11.9)?.chord, 'F');
  assert.strictEqual(getActiveChord(12.5), undefined);
});
