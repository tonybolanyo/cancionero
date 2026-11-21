import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRmsEnergy, computeWindowedChromagrams, WindowedChroma } from '../src/lib/audio/chroma';
import {
  computeSelfSimilarityMatrix,
  computeCheckerboardNovelty,
  analyzeStructureFromChroma
} from '../src/lib/audio/structure';
import { analyzeStructureWithWorker } from '../src/lib/audio/structureWorkerClient';

function makeTriadChroma(pcs: number[], amplitudes?: number[]): number[] {
  const v = new Array<number>(12).fill(0.02);
  pcs.forEach((pc, idx) => {
    v[((pc % 12) + 12) % 12] = amplitudes ? (amplitudes[idx] ?? 0.9) : 0.9;
  });
  return v;
}

function buildSectionWindows(
  startSec: number,
  durationSec: number,
  hopSec: number,
  chordSequence: number[][],
  rmsBase: number
): WindowedChroma[] {
  const count = Math.round(durationSec / hopSec);
  const windows: WindowedChroma[] = [];
  for (let i = 0; i < count; i++) {
    const chordPcs = chordSequence[Math.floor((i / count) * chordSequence.length) % chordSequence.length];
    const s = startSec + i * hopSec;
    windows.push({
      startTime: s,
      endTime: s + hopSec * 2,
      chroma: makeTriadChroma(chordPcs),
      midChroma: makeTriadChroma(chordPcs),
      rmsEnergy: rmsBase * (0.96 + 0.08 * Math.sin(i * 1.1))
    });
  }
  return windows;
}

function synthChordWave(freqs: number[], durationSec: number, sampleRate: number, amp: number): Float32Array {
  const len = Math.floor(durationSec * sampleRate);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    let sum = 0;
    for (const f of freqs) {
      sum += Math.sin(2 * Math.PI * f * t);
    }
    buf[i] = (amp / Math.max(1, freqs.length)) * sum;
  }
  return buf;
}

describe('Musical Structure Detection via Self-Similarity Matrix (SSM)', () => {
  it('computeRmsEnergy and computeWindowedChromagrams populate per-window rmsEnergy', () => {
    const sampleRate = 22050;
    const quiet = synthChordWave([220, 261.63, 329.63], 2.0, sampleRate, 0.12);
    const loud = synthChordWave([261.63, 329.63, 392.0], 2.0, sampleRate, 0.72);
    const combined = new Float32Array(quiet.length + loud.length);
    combined.set(quiet, 0);
    combined.set(loud, quiet.length);

    assert.ok(computeRmsEnergy(loud) > computeRmsEnergy(quiet) * 4);

    const windows = computeWindowedChromagrams(combined, sampleRate, {
      windowDurationSec: 1.0,
      hopDurationSec: 0.5,
      dualBand: true
    });

    assert.ok(windows.length >= 4);
    for (const w of windows) {
      assert.equal(typeof w.rmsEnergy, 'number');
      assert.ok((w.rmsEnergy ?? 0) > 0);
    }

    const firstRms = windows[0].rmsEnergy ?? 0;
    const lastRms = windows[windows.length - 1].rmsEnergy ?? 0;
    assert.ok(lastRms > firstRms * 3, `Expected louder end RMS (${lastRms}) > quiet start (${firstRms})`);
  });

  it('computeSelfSimilarityMatrix and computeCheckerboardNovelty detect structural transitions and repetitions', () => {
    const hopSec = 1.0;
    // Block A (0-12s): Am -> G, Block B (12-24s): F#m -> D -> E, Block A repeat (24-36s)
    const am = [9, 0, 4];
    const g = [7, 11, 2];
    const fSharpM = [6, 9, 1];
    const d = [2, 6, 9];
    const e = [4, 8, 11];

    const windows: WindowedChroma[] = [
      ...buildSectionWindows(0, 12, hopSec, [am, g], 0.18),
      ...buildSectionWindows(12, 12, hopSec, [fSharpM, d, e], 0.48),
      ...buildSectionWindows(24, 12, hopSec, [am, g], 0.18)
    ];

    const result = analyzeStructureFromChroma(windows, {
      duration: 36,
      minSectionDurationSec: 6.0
    });

    assert.ok(result.noveltyCurve.length > 10);
    assert.ok(result.boundaries.length >= 3, `Expected >= 3 boundaries, got ${result.boundaries.join(', ')}`);

    // Novelty should peak near t = 12s and t = 24s
    const near12 = result.noveltyCurve.filter(p => p.time >= 9 && p.time <= 15);
    const maxNear12 = Math.max(...near12.map(p => p.value));
    assert.ok(maxNear12 > 0.3, `Expected novelty spike near 12s, got ${maxNear12}`);

    const ssm = computeSelfSimilarityMatrix(
      windows.map(w => ({
        startTime: w.startTime,
        endTime: w.endTime,
        midTime: (w.startTime + w.endTime) / 2,
        chroma: Float32Array.from(w.chroma),
        normRms: w.rmsEnergy ?? 0.2,
        rawRms: w.rmsEnergy ?? 0.2
      }))
    );
    const nov = computeCheckerboardNovelty(ssm, windows.length, 3);
    assert.equal(nov.length, windows.length);
  });

  it('identifies Intro, repeated Estrofa, repeated Estribillo, Puente, and Outro on full song form', () => {
    const hopSec = 1.0;
    // Harmonic vocabularies
    const am = [9, 0, 4];
    const dm = [2, 5, 9];
    const c = [0, 4, 7];
    const g = [7, 11, 2];
    const f = [5, 9, 0];
    const e = [4, 8, 11];
    const bb = [10, 2, 5];
    const eb = [3, 7, 10];

    // Form: Intro (0-12s, quiet) -> Estrofa 1 (12-28s) -> Estribillo 1 (28-44s, loud) ->
    // Estrofa 2 (44-60s, repeats Estrofa 1) -> Puente (60-74s, contrasting Bb-Eb) ->
    // Estribillo 2 (74-90s, repeats Estribillo 1) -> Outro (90-102s, quiet decay)
    const windows: WindowedChroma[] = [
      ...buildSectionWindows(0, 12, hopSec, [am, dm], 0.10),
      ...buildSectionWindows(12, 16, hopSec, [am, g, f, e], 0.28),
      ...buildSectionWindows(28, 16, hopSec, [c, g, am, f], 0.62),
      ...buildSectionWindows(44, 16, hopSec, [am, g, f, e], 0.28),
      ...buildSectionWindows(60, 14, hopSec, [bb, eb, g], 0.36),
      ...buildSectionWindows(74, 16, hopSec, [c, g, am, f], 0.62),
      ...buildSectionWindows(90, 12, hopSec, [am, dm], 0.09)
    ];

    const result = analyzeStructureFromChroma(windows, {
      duration: 102,
      minSectionDurationSec: 6.5
    });

    const types = result.sections.map(s => s.type);
    assert.equal(types[0], 'Intro', `Expected Intro first, got ${types.join(' -> ')}`);
    assert.equal(types[types.length - 1], 'Outro', `Expected Outro last, got ${types.join(' -> ')}`);
    assert.ok(types.includes('Estrofa'), `Expected Estrofa in ${types.join(' -> ')}`);
    assert.ok(types.includes('Estribillo'), `Expected Estribillo in ${types.join(' -> ')}`);
    assert.ok(
      types.includes('Puente') || types.includes('Instrumental'),
      `Expected Puente/Instrumental bridge in ${types.join(' -> ')}`
    );

    const estribillos = result.sections.filter(s => s.type === 'Estribillo');
    assert.equal(estribillos.length, 2, `Expected 2 Estribillo occurrences, got ${estribillos.length}`);
    assert.equal(
      estribillos[0].repetitionGroup,
      estribillos[1].repetitionGroup,
      'Repeated Estribillos should share the same repetitionGroup'
    );

    const estrofas = result.sections.filter(s => s.type === 'Estrofa');
    assert.ok(estrofas.length >= 2, `Expected >= 2 Estrofa sections, got ${estrofas.length}`);
    assert.equal(
      estrofas[0].repetitionGroup,
      estrofas[1].repetitionGroup,
      'Repeated Estrofas should share the same repetitionGroup'
    );
  });

  it('analyzeStructureWithWorker runs cleanly with synchronous fallback in Node environment', async () => {
    const sampleRate = 22050;
    const partA = synthChordWave([220, 261.63, 329.63], 6.0, sampleRate, 0.15);
    const partB = synthChordWave([293.66, 369.99, 440.0], 6.0, sampleRate, 0.65);
    const full = new Float32Array(partA.length + partB.length);
    full.set(partA, 0);
    full.set(partB, partA.length);

    const mockBuffer = {
      numberOfChannels: 1,
      length: full.length,
      sampleRate,
      duration: full.length / sampleRate,
      getChannelData: () => full
    } as unknown as AudioBuffer;

    const result = await analyzeStructureWithWorker({
      audioBuffer: mockBuffer,
      options: { minSectionDurationSec: 3.5 }
    });

    assert.ok(result.sections.length >= 2, `Expected >= 2 sections, got ${result.sections.length}`);
    assert.equal(result.sections[0].startTime, 0);
    assert.ok(Math.abs(result.sections[result.sections.length - 1].endTime - mockBuffer.duration) < 0.05);
  });
});
