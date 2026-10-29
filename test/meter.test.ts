import test from 'node:test';
import assert from 'node:assert';
import {
  estimateMeter,
  computeBeatSaliences,
  recalculateDownbeats,
  TimeSignature
} from '../src/lib/audio/meter';

test('estimateMeter correctly identifies synthetic 4/4 meter with strong-weak-medium-weak accents', () => {
  // 16 beats spaced by 0.5s (120 BPM)
  const beats: number[] = [];
  const onsets: number[] = [];
  for (let i = 0; i < 16; i++) {
    const t = i * 0.5;
    beats.push(t);
    // Onsets on downbeats
    if (i % 4 === 0) {
      onsets.push(t);
    }
  }

  // Create synthetic audio channel data with 4/4 accent profile
  const sampleRate = 44100;
  const totalSamples = Math.ceil(8.5 * sampleRate);
  const channelData = new Float32Array(totalSamples);

  for (let i = 0; i < 16; i++) {
    const centerSample = Math.round(beats[i] * sampleRate);
    // 4/4 profile: beat 0 is strongest (1.0), beat 2 is medium (0.65), beats 1 and 3 are weak (0.25)
    let amp = 0.25;
    if (i % 4 === 0) amp = 1.0;
    else if (i % 4 === 2) amp = 0.65;

    for (let k = -200; k < 800; k++) {
      const idx = centerSample + k;
      if (idx >= 0 && idx < totalSamples) {
        channelData[idx] = amp * Math.sin(k * 0.05);
      }
    }
  }

  const result = estimateMeter({
    beats,
    onsets,
    channelData,
    sampleRate,
    bpm: 120
  });

  assert.strictEqual(result.meter, '4/4');
  assert.ok(result.confidence >= 0.65);
  assert.strictEqual(result.downbeats.length, 4); // 16 beats / 4 = 4 measures
  assert.strictEqual(result.downbeats[0], 0);
  assert.strictEqual(result.downbeats[1], 2.0);
  assert.strictEqual(result.downbeats[2], 4.0);
  assert.strictEqual(result.downbeats[3], 6.0);
});

test('estimateMeter correctly identifies synthetic 3/4 waltz meter', () => {
  // 18 beats spaced by 0.4s (150 BPM)
  const beats: number[] = [];
  const onsets: number[] = [];
  for (let i = 0; i < 18; i++) {
    const t = i * 0.4;
    beats.push(t);
    if (i % 3 === 0) {
      onsets.push(t);
    }
  }

  const sampleRate = 44100;
  const totalSamples = Math.ceil(8 * sampleRate);
  const channelData = new Float32Array(totalSamples);

  for (let i = 0; i < 18; i++) {
    const centerSample = Math.round(beats[i] * sampleRate);
    // 3/4 profile: beat 0 is strong (1.0), beats 1 and 2 are weak (0.20)
    const amp = (i % 3 === 0) ? 1.0 : 0.20;

    for (let k = -200; k < 800; k++) {
      const idx = centerSample + k;
      if (idx >= 0 && idx < totalSamples) {
        channelData[idx] = amp * Math.sin(k * 0.05);
      }
    }
  }

  const result = estimateMeter({
    beats,
    onsets,
    channelData,
    sampleRate,
    bpm: 150
  });

  assert.strictEqual(result.meter, '3/4');
  assert.ok(result.confidence >= 0.60);
  assert.strictEqual(result.downbeats.length, 6); // 18 / 3 = 6 measures
});

test('estimateMeter correctly identifies synthetic 6/8 compound duple meter', () => {
  // 24 eighth-notes spaced by 0.25s
  const beats: number[] = [];
  const onsets: number[] = [];
  for (let i = 0; i < 24; i++) {
    const t = i * 0.25;
    beats.push(t);
    if (i % 6 === 0) {
      onsets.push(t);
    }
  }

  const sampleRate = 44100;
  const totalSamples = Math.ceil(7 * sampleRate);
  const channelData = new Float32Array(totalSamples);

  for (let i = 0; i < 24; i++) {
    const centerSample = Math.round(beats[i] * sampleRate);
    // 6/8 profile: beat 0 is strong (1.0), beat 3 is medium (0.75), others are soft (0.2)
    let amp = 0.2;
    if (i % 6 === 0) amp = 1.0;
    else if (i % 6 === 3) amp = 0.75;

    for (let k = -200; k < 800; k++) {
      const idx = centerSample + k;
      if (idx >= 0 && idx < totalSamples) {
        channelData[idx] = amp * Math.sin(k * 0.05);
      }
    }
  }

  const result = estimateMeter({
    beats,
    onsets,
    channelData,
    sampleRate,
    bpm: 120
  });

  assert.strictEqual(result.meter, '6/8');
  assert.ok(result.confidence >= 0.60);
  assert.strictEqual(result.downbeats.length, 4); // 24 / 6 = 4 measures
});

test('estimateMeter correctly identifies synthetic 2/4 march meter', () => {
  // 16 beats spaced by 0.5s
  const beats: number[] = [];
  for (let i = 0; i < 16; i++) {
    beats.push(i * 0.5);
  }

  const sampleRate = 44100;
  const totalSamples = Math.ceil(9 * sampleRate);
  const channelData = new Float32Array(totalSamples);

  for (let i = 0; i < 16; i++) {
    const centerSample = Math.round(beats[i] * sampleRate);
    // 2/4 profile: strong on even beats, weak on odd beats
    const amp = (i % 2 === 0) ? 1.0 : 0.2;

    for (let k = -200; k < 800; k++) {
      const idx = centerSample + k;
      if (idx >= 0 && idx < totalSamples) {
        channelData[idx] = amp * Math.sin(k * 0.05);
      }
    }
  }

  const result = estimateMeter({
    beats,
    channelData,
    sampleRate,
    bpm: 120
  });

  assert.strictEqual(result.meter, '2/4');
  assert.strictEqual(result.downbeats.length, 8); // 16 / 2 = 8 measures
});

test('recalculateDownbeats handles manual meter correction instantly', () => {
  const beats = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5];

  // In 4/4
  const downbeats44 = recalculateDownbeats(beats, '4/4', 0);
  assert.deepStrictEqual(downbeats44, [0.0, 2.0, 4.0]);

  // In 3/4
  const downbeats34 = recalculateDownbeats(beats, '3/4', 0);
  assert.deepStrictEqual(downbeats34, [0.0, 1.5, 3.0, 4.5]);

  // In 6/8
  const downbeats68 = recalculateDownbeats(beats, '6/8', 0);
  assert.deepStrictEqual(downbeats68, [0.0, 3.0]);

  // In 2/4
  const downbeats24 = recalculateDownbeats(beats, '2/4', 0);
  assert.deepStrictEqual(downbeats24, [0.0, 1.0, 2.0, 3.0, 4.0, 5.0]);
});

test('estimateMeter returns safe default on edge cases without throwing', () => {
  const emptyRes = estimateMeter({ beats: [] });
  assert.strictEqual(emptyRes.meter, '4/4');
  assert.strictEqual(emptyRes.downbeats.length, 0);

  const fewRes = estimateMeter({ beats: [0.1, 0.6] });
  assert.strictEqual(fewRes.meter, '4/4');
  assert.strictEqual(fewRes.downbeats.length, 2);
});
