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

function synthesizePulseAudio(
  pulseTimes: number[],
  amplitudes: number[],
  sampleRate = 44100
): Float32Array {
  const maxTime = (pulseTimes[pulseTimes.length - 1] ?? 0) + 1.0;
  const totalSamples = Math.ceil(maxTime * sampleRate);
  const channelData = new Float32Array(totalSamples);

  for (let i = 0; i < pulseTimes.length; i++) {
    const centerSample = Math.round(pulseTimes[i] * sampleRate);
    const amp = amplitudes[i];
    for (let k = -200; k < 800; k++) {
      const idx = centerSample + k;
      if (idx >= 0 && idx < totalSamples) {
        channelData[idx] += amp * Math.sin(k * 0.05);
      }
    }
  }
  return channelData;
}

test('estimateMeter identifies 5/4 meter in both 3+2 and 2+3 groupings', () => {
  // 20 quarter-note beats at 120 BPM (0.5s apart) = 4 bars of 5/4
  const beats: number[] = [];
  const onsets: number[] = [];
  const amps32: number[] = [];
  const amps23: number[] = [];

  for (let i = 0; i < 20; i++) {
    const t = i * 0.5;
    beats.push(t);
    if (i % 5 === 0) onsets.push(t);

    const slot = i % 5;
    amps32.push(slot === 0 ? 1.0 : slot === 3 ? 0.72 : 0.2);
    amps23.push(slot === 0 ? 1.0 : slot === 2 ? 0.72 : 0.2);
  }

  const res32 = estimateMeter({
    beats,
    onsets,
    channelData: synthesizePulseAudio(beats, amps32),
    sampleRate: 44100,
    bpm: 120
  });
  assert.strictEqual(res32.meter, '5/4');
  assert.strictEqual(res32.grouping, '3+2');
  assert.strictEqual(res32.downbeats.length, 4);
  assert.strictEqual(res32.downbeats[1], 2.5);

  const res23 = estimateMeter({
    beats,
    onsets,
    channelData: synthesizePulseAudio(beats, amps23),
    sampleRate: 44100,
    bpm: 120
  });
  assert.strictEqual(res23.meter, '5/4');
  assert.strictEqual(res23.grouping, '2+3');
  assert.strictEqual(res23.downbeats.length, 4);
});

test('estimateMeter identifies 7/4 meter (4+3 and 3+4 groupings)', () => {
  // 28 quarter-note beats at 110 BPM (~0.545s apart) = 4 bars of 7/4
  const interval = 60 / 110;
  const beats: number[] = [];
  const onsets: number[] = [];
  const amps43: number[] = [];
  const amps34: number[] = [];

  for (let i = 0; i < 28; i++) {
    const t = Number((i * interval).toFixed(4));
    beats.push(t);
    if (i % 7 === 0) onsets.push(t);

    const slot = i % 7;
    amps43.push(slot === 0 ? 1.0 : slot === 4 ? 0.75 : slot === 2 ? 0.52 : 0.2);
    amps34.push(slot === 0 ? 1.0 : slot === 3 ? 0.75 : slot === 5 ? 0.52 : 0.2);
  }

  const res43 = estimateMeter({
    beats,
    onsets,
    channelData: synthesizePulseAudio(beats, amps43),
    sampleRate: 44100,
    bpm: 110
  });
  assert.strictEqual(res43.meter, '7/4');
  assert.strictEqual(res43.grouping, '4+3');
  assert.strictEqual(res43.downbeats.length, 4);

  const res34 = estimateMeter({
    beats,
    onsets,
    channelData: synthesizePulseAudio(beats, amps34),
    sampleRate: 44100,
    bpm: 110
  });
  assert.strictEqual(res34.meter, '7/4');
  assert.strictEqual(res34.grouping, '3+4');
  assert.strictEqual(res34.downbeats.length, 4);
});

test('estimateMeter identifies 7/8 when beats are already at eighth-note resolution', () => {
  // 28 eighth-notes spaced by 0.25s (240 eighth-notes/min) = 4 bars of 7/8 (2+2+3)
  const beats: number[] = [];
  const onsets: number[] = [];
  const amps: number[] = [];

  for (let i = 0; i < 28; i++) {
    const t = i * 0.25;
    beats.push(t);
    const slot = i % 7;
    if (slot === 0 || slot === 2 || slot === 4) {
      onsets.push(t);
    }
    amps.push(slot === 0 ? 1.0 : slot === 4 ? 0.72 : slot === 2 ? 0.65 : 0.18);
  }

  const res = estimateMeter({
    beats,
    onsets,
    channelData: synthesizePulseAudio(beats, amps),
    sampleRate: 44100,
    bpm: 120
  });

  assert.strictEqual(res.meter, '7/8');
  assert.strictEqual(res.grouping, '2+2+3');
  assert.strictEqual(res.downbeats.length, 4);
  assert.strictEqual(res.downbeats[1], 1.75);
});

test('estimateMeter identifies 7/8 via 2x subdivision when beat tracker locks onto quarter notes', () => {
  // Audio is 7/8 (2+2+3, eighth note = 0.25s -> bars at 0, 1.75, 3.50, 5.25, 7.00)
  // Beat tracker locked onto 120 BPM quarter-note grid (0, 0.5, 1.0, 1.5, ...)
  const quarterBeats: number[] = [];
  for (let i = 0; i < 18; i++) {
    quarterBeats.push(i * 0.5);
  }

  const eighthPulses: number[] = [];
  const eighthAmps: number[] = [];
  const onsets: number[] = [];
  for (let i = 0; i < 35; i++) {
    const t = i * 0.25;
    eighthPulses.push(t);
    const slot = i % 7;
    if (slot === 0 || slot === 2 || slot === 4) {
      onsets.push(t);
    }
    eighthAmps.push(slot === 0 ? 1.0 : slot === 4 ? 0.72 : slot === 2 ? 0.65 : 0.18);
  }

  const res = estimateMeter({
    beats: quarterBeats,
    onsets,
    channelData: synthesizePulseAudio(eighthPulses, eighthAmps),
    sampleRate: 44100,
    bpm: 120
  });

  assert.strictEqual(res.meter, '7/8');
  assert.strictEqual(res.gridMode, 'subdivision2x');
  assert.strictEqual(res.grouping, '2+2+3');
  // Every bar's downbeat (including odd bars at 1.75s, 5.25s) must be captured!
  assert.deepStrictEqual(res.downbeats, [0, 1.75, 3.5, 5.25, 7.0]);
});

test('estimateMeter identifies 5/8 via 2x subdivision when beat tracker locks onto quarter notes', () => {
  // Audio is 5/8 (3+2, eighth note = 0.25s -> bars at 0, 1.25, 2.50, 3.75, 5.00)
  const quarterBeats: number[] = [];
  for (let i = 0; i < 14; i++) {
    quarterBeats.push(i * 0.5);
  }

  const eighthPulses: number[] = [];
  const eighthAmps: number[] = [];
  const onsets: number[] = [];
  for (let i = 0; i < 26; i++) {
    const t = i * 0.25;
    eighthPulses.push(t);
    const slot = i % 5;
    if (slot === 0 || slot === 3) {
      onsets.push(t);
    }
    eighthAmps.push(slot === 0 ? 1.0 : slot === 3 ? 0.72 : 0.18);
  }

  const res = estimateMeter({
    beats: quarterBeats,
    onsets,
    channelData: synthesizePulseAudio(eighthPulses, eighthAmps),
    sampleRate: 44100,
    bpm: 120
  });

  assert.strictEqual(res.meter, '5/8');
  assert.strictEqual(res.gridMode, 'subdivision2x');
  assert.deepStrictEqual(res.downbeats.slice(0, 5), [0, 1.25, 2.5, 3.75, 5.0]);
});

test('estimateMeter identifies 9/8 (3+3+3 and 2+2+2+3 aksak) and 12/8', () => {
  // 9/8 (3+3+3) at eighth-note resolution (0.25s)
  const beats98: number[] = [];
  const onsets98: number[] = [];
  const amps98: number[] = [];
  for (let i = 0; i < 27; i++) {
    const t = i * 0.25;
    beats98.push(t);
    const slot = i % 9;
    if (slot === 0) onsets98.push(t);
    amps98.push(slot === 0 ? 1.0 : slot === 3 || slot === 6 ? 0.68 : 0.18);
  }

  const res98 = estimateMeter({
    beats: beats98,
    onsets: onsets98,
    channelData: synthesizePulseAudio(beats98, amps98),
    sampleRate: 44100
  });
  assert.strictEqual(res98.meter, '9/8');
  assert.strictEqual(res98.downbeats.length, 3);

  // 9/8 aksak (2+2+2+3)
  const ampsAksak: number[] = [];
  for (let i = 0; i < 27; i++) {
    const slot = i % 9;
    ampsAksak.push(slot === 0 ? 1.0 : slot === 6 ? 0.72 : slot === 2 || slot === 4 ? 0.62 : 0.18);
  }
  const resAksak = estimateMeter({
    beats: beats98,
    onsets: onsets98,
    channelData: synthesizePulseAudio(beats98, ampsAksak),
    sampleRate: 44100
  });
  assert.strictEqual(resAksak.meter, '9/8');
  assert.strictEqual(resAksak.grouping, '2+2+2+3');

  // 12/8 (3+3+3+3)
  const beats128: number[] = [];
  const onsets128: number[] = [];
  const amps128: number[] = [];
  for (let i = 0; i < 36; i++) {
    const t = i * 0.25;
    beats128.push(t);
    const slot = i % 12;
    if (slot === 0) onsets128.push(t);
    amps128.push(slot === 0 ? 1.0 : slot === 6 ? 0.76 : slot === 3 || slot === 9 ? 0.56 : 0.18);
  }

  const res128 = estimateMeter({
    beats: beats128,
    onsets: onsets128,
    channelData: synthesizePulseAudio(beats128, amps128),
    sampleRate: 44100
  });
  assert.strictEqual(res128.meter, '12/8');
  assert.strictEqual(res128.downbeats.length, 3);
});

test('estimateMeter preserves parsimony on long 4/4 and 3/4 sequences (no false 9/8 or 12/8)', () => {
  // 48 beats of pure 3/4 at 120 BPM (0.5s)
  const beats34: number[] = [];
  const amps34: number[] = [];
  for (let i = 0; i < 48; i++) {
    beats34.push(i * 0.5);
    amps34.push(i % 3 === 0 ? 1.0 : 0.22);
  }
  const res34 = estimateMeter({
    beats: beats34,
    channelData: synthesizePulseAudio(beats34, amps34),
    sampleRate: 44100,
    bpm: 120
  });
  assert.strictEqual(res34.meter, '3/4');

  // 48 beats of pure 4/4 at 120 BPM (0.5s)
  const beats44: number[] = [];
  const amps44: number[] = [];
  for (let i = 0; i < 48; i++) {
    beats44.push(i * 0.5);
    const slot = i % 4;
    amps44.push(slot === 0 ? 1.0 : slot === 2 ? 0.65 : 0.25);
  }
  const res44 = estimateMeter({
    beats: beats44,
    channelData: synthesizePulseAudio(beats44, amps44),
    sampleRate: 44100,
    bpm: 120
  });
  assert.strictEqual(res44.meter, '4/4');
});

test('recalculateDownbeats supports uncommon meters and subdivision2x mode', () => {
  const beats = Array.from({ length: 15 }, (_, i) => i * 0.5);

  assert.deepStrictEqual(recalculateDownbeats(beats, '5/4', 0), [0, 2.5, 5.0]);
  assert.deepStrictEqual(recalculateDownbeats(beats, '7/4', 0), [0, 3.5, 7.0]);
  assert.deepStrictEqual(
    recalculateDownbeats(beats.slice(0, 10), '7/8', 0, { gridMode: 'subdivision2x' }),
    [0, 1.75, 3.5]
  );
  assert.deepStrictEqual(
    recalculateDownbeats(beats.slice(0, 7), '5/8', 0, { gridMode: 'subdivision2x' }),
    [0, 1.25, 2.5]
  );
});
