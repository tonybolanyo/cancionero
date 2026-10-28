/**
 * Unified Chromagram (Pitch Class Profile) Module for Web Audio.
 * Reusable for Musical Key, Scale, and Chord progression estimation.
 */

export const PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
] as const;

export type PitchClass = typeof PITCH_CLASSES[number];

export interface WindowedChroma {
  startTime: number;
  endTime: number;
  chroma: number[];
}

export interface ChromaOptions {
  windowDurationSec?: number; // 1.0 - 2.0s
  hopDurationSec?: number;    // default: windowDurationSec * 0.5 (50% overlap)
  minFrequency?: number;      // default: 65 Hz (approx C2)
  maxFrequency?: number;      // default: 1100 Hz (approx C6)
}

/**
 * Computes a 12-bin normalized Pitch Class Profile for an audio frame.
 */
export function computeFrameChroma(
  frameData: Float32Array,
  sampleRate: number,
  minFreq: number = 65,
  maxFreq: number = 1100
): number[] {
  const chroma = new Float64Array(12);
  const A4 = 440.0;
  const N = frameData.length;
  if (N === 0) return new Array(12).fill(0);

  // Subsample step for efficiency if frame is very large
  const step = Math.max(1, Math.floor(N / 1024));

  // Discrete pitch classes across audible octaves (MIDI 36/C2 ~ 65.4Hz to MIDI 84/C6 ~ 1046.5Hz)
  const bins: { omega: number; pc: number }[] = [];
  for (let midi = 36; midi <= 84; midi++) {
    const f = A4 * Math.pow(2, (midi - 69) / 12);
    if (f >= minFreq && f <= maxFreq) {
      const pc = (midi % 12 + 12) % 12;
      const k = (f * N) / sampleRate;
      bins.push({ omega: (2 * Math.PI * k) / N, pc });
    }
  }

  // Correlate with harmonic sine and cosine basis
  for (const { omega, pc } of bins) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < N; n += step) {
      const sample = frameData[n];
      real += sample * Math.cos(omega * n);
      imag -= sample * Math.sin(omega * n);
    }
    const energy = real * real + imag * imag;
    chroma[pc] += energy;
  }

  // Normalize chromagram between 0 and 1
  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > max) max = chroma[i];
  }

  const result = new Array(12);
  for (let i = 0; i < 12; i++) {
    result[i] = max > 0 ? Number((chroma[i] / max).toFixed(4)) : 0;
  }
  return result;
}

/**
 * Slices an audio signal into windows of 1-2 seconds with overlap and computes
 * a temporal chromagram sequence.
 */
export function computeWindowedChromagrams(
  channelData: Float32Array,
  sampleRate: number,
  options: ChromaOptions = {}
): WindowedChroma[] {
  const windowDurationSec = options.windowDurationSec ?? 1.5; // 1.5 seconds window
  const hopDurationSec = options.hopDurationSec ?? (windowDurationSec * 0.5); // 50% overlap

  const windowSamples = Math.floor(windowDurationSec * sampleRate);
  const hopSamples = Math.floor(hopDurationSec * sampleRate);

  if (channelData.length < windowSamples || hopSamples <= 0) {
    // If audio is shorter than a single window, analyze the full segment
    const chroma = computeFrameChroma(channelData, sampleRate, options.minFrequency, options.maxFrequency);
    return [{
      startTime: 0,
      endTime: Number((channelData.length / sampleRate).toFixed(3)),
      chroma
    }];
  }

  const results: WindowedChroma[] = [];
  const totalSamples = channelData.length;

  for (let start = 0; start <= totalSamples - (windowSamples / 2); start += hopSamples) {
    const end = Math.min(start + windowSamples, totalSamples);
    const slice = channelData.subarray(start, end);
    const startTime = Number((start / sampleRate).toFixed(3));
    const endTime = Number((end / sampleRate).toFixed(3));

    const chroma = computeFrameChroma(slice, sampleRate, options.minFrequency, options.maxFrequency);
    results.push({ startTime, endTime, chroma });
  }

  return results;
}
