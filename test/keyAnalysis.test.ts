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
