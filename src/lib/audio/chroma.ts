/**
 * Unified Chromagram (Pitch Class Profile) Module for Web Audio.
 * Reusable for Musical Key, Scale, and Chord progression estimation.
 * Supports dual-band extraction:
 *   - Bass band (40–180 Hz) for lowest bass pitch detection (slash chords / inversions)
 *   - Mid band (180–1200 Hz) for harmonic triad / chord-quality detection
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

export interface BassPitchEstimate {
  /** Pitch class index 0..11 (C..B), or -1 if no clear pitched bass detected */
  pitchClass: number;
  /** Pitch class name (e.g. 'G', 'F#'), or null if none */
  pitchName: PitchClass | null;
  /** Confidence score 0..1 reflecting spectral tonality & peak prominence in 40–180 Hz */
  confidence: number;
  /** RMS/amplitude ratio of bass band relative to mid band */
  energyRatio: number;
  /** Estimated lowest prominent bass frequency in Hz */
  lowestFrequencyHz?: number;
}

export interface DualBandFrameChroma {
  /** Combined/full-band 12-bin chromagram (normalized 0..1) */
  chroma: number[];
  /** Low-frequency 12-bin chromagram (40–180 Hz, normalized 0..1) */
  bassChroma: number[];
  /** Mid-frequency 12-bin chromagram (180–1200 Hz, normalized 0..1) */
  midChroma: number[];
  /** Lowest prominent bass pitch estimate from 40–180 Hz */
  bassEstimate: BassPitchEstimate;
}

export interface TripleBandFrameChroma extends DualBandFrameChroma {
  /** High-frequency 12-bin chromagram (600–2000 Hz, normalized 0..1) for guitar harmonics */
  highChroma?: number[];
}

export interface WindowedChroma {
  startTime: number;
  endTime: number;
  chroma: number[];
  bassChroma?: number[];
  midChroma?: number[];
  highChroma?: number[];
  bassEstimate?: BassPitchEstimate;
  /** Root-mean-square acoustic energy of this audio window (0..1) */
  rmsEnergy?: number;
}

export interface ChromaOptions {
  windowDurationSec?: number; // 1.0 - 2.0s
  hopDurationSec?: number;    // default: windowDurationSec * 0.5 (50% overlap)
  minFrequency?: number;      // default: 65 Hz (approx C2)
  maxFrequency?: number;      // default: 1100 Hz (approx C6)
  dualBand?: boolean;         // default: true (compute 40-180Hz bass + 180-1200Hz mid)
  tripleBand?: boolean;       // NEW: default true (compute 600-2000Hz high for guitar harmonics)
  bassMinFrequency?: number;  // default: 40 Hz
  bassMaxFrequency?: number;  // default: 180 Hz
  midMinFrequency?: number;   // default: 180 Hz
  midMaxFrequency?: number;   // default: 1200 Hz
  highMinFrequency?: number;  // NEW: default: 600 Hz (guitar harmonics)
  highMaxFrequency?: number;  // NEW: default: 2000 Hz (guitar harmonics)
  referenceA4Hz?: number;     // default: 440 Hz (tuning calibration)
}

const DEFAULT_A4_HZ = 440.0;
const MIN_MIDI = 27; // ~38.89 Hz (covers 40 Hz bass fundamental)
const MAX_MIDI = 87; // ~1244.5 Hz (covers 1200 Hz upper mid)

function midiToFreq(midi: number, referenceA4Hz: number = DEFAULT_A4_HZ): number {
  return referenceA4Hz * Math.pow(2, (midi - 69) / 12);
}

/**
 * Computes per-MIDI-note normalized spectral power using Goertzel's algorithm
 * with a Hann window and Nyquist-safe subsampling.
 * Normalizing by (0.5 * M)^2 keeps power values directly comparable across
 * bands even when different subsampling steps are used.
 */
function computeMidiBandPowers(
  frameData: Float32Array,
  sampleRate: number,
  minFreq: number,
  maxFreq: number,
  targetEffectiveSamples: number = 2048,
  referenceA4Hz: number = DEFAULT_A4_HZ
): { midiNotes: number[]; powers: Float64Array; maxPower: number } {
  const N = frameData.length;
  if (N === 0 || sampleRate <= 0) {
    return { midiNotes: [], powers: new Float64Array(0), maxPower: 0 };
  }

  // Ensure effective sample rate stays safely above Nyquist (>= 2.5 * maxFreq)
  const maxSafeStep = Math.max(1, Math.floor(sampleRate / Math.max(1, 2.5 * maxFreq)));
  const desiredStep = Math.max(1, Math.floor(N / targetEffectiveSamples));
  const step = Math.min(maxSafeStep, desiredStep);

  const effectiveSampleRate = sampleRate / step;
  const M = Math.floor((N + step - 1) / step);
  if (M < 4) {
    return { midiNotes: [], powers: new Float64Array(0), maxPower: 0 };
  }

  // Pre-window subsampled signal once per band call
  const windowed = new Float64Array(M);
  const twoPiOverMMinus1 = (2 * Math.PI) / Math.max(1, M - 1);
  for (let m = 0, n = 0; m < M; m++, n += step) {
    const hann = 0.5 * (1 - Math.cos(twoPiOverMMinus1 * m));
    windowed[m] = frameData[n] * hann;
  }

  // Normalization factor: coherent gain of Hann window is 0.5 * M
  const normDenom = Math.pow(0.5 * M, 2) || 1;

  const midiNotes: number[] = [];
  for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
    const f = midiToFreq(midi, referenceA4Hz);
    if (f >= minFreq && f <= maxFreq && f < effectiveSampleRate * 0.48) {
      midiNotes.push(midi);
    }
  }

  const powers = new Float64Array(midiNotes.length);
  let maxPower = 0;

  for (let idx = 0; idx < midiNotes.length; idx++) {
    const f = midiToFreq(midiNotes[idx], referenceA4Hz);
    const omega = (2 * Math.PI * f) / effectiveSampleRate;
    const coeff = 2 * Math.cos(omega);

    let s1 = 0;
    let s2 = 0;
    for (let m = 0; m < M; m++) {
      const s0 = windowed[m] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }

    const rawPower = s1 * s1 + s2 * s2 - coeff * s1 * s2;
    const normPower = Math.max(0, rawPower / normDenom);
    powers[idx] = normPower;
    if (normPower > maxPower) {
      maxPower = normPower;
    }
  }

  return { midiNotes, powers, maxPower };
}

function normalizeChromaVector(raw: Float64Array): number[] {
  let max = 0;
  for (let i = 0; i < 12; i++) {
    if (raw[i] > max) max = raw[i];
  }
  const result = new Array<number>(12);
  for (let i = 0; i < 12; i++) {
    result[i] = max > 0 ? Number((raw[i] / max).toFixed(4)) : 0;
  }
  return result;
}

/**
 * Computes a 12-bin normalized Pitch Class Profile for an audio frame.
 */
export function computeFrameChroma(
  frameData: Float32Array,
  sampleRate: number,
  minFreq: number = 65,
  maxFreq: number = 1100,
  referenceA4Hz: number = DEFAULT_A4_HZ
): number[] {
  if (frameData.length === 0) return new Array(12).fill(0);

  const { midiNotes, powers } = computeMidiBandPowers(frameData, sampleRate, minFreq, maxFreq, 2048, referenceA4Hz);
  const chroma = new Float64Array(12);

  for (let i = 0; i < midiNotes.length; i++) {
    const pc = ((midiNotes[i] % 12) + 12) % 12;
    chroma[pc] += powers[i];
  }

  return normalizeChromaVector(chroma);
}

/**
 * Computes a dual-band Pitch Class Profile separating:
 *  - Bass band (40–180 Hz): detects the lowest prominent bass fundamental for slash chords (C/G, D/F#, Am/G)
 *  - Mid band (180–1200 Hz): isolates the upper harmonic triad without low-end mud
 */
export function computeDualBandFrameChroma(
  frameData: Float32Array,
  sampleRate: number,
  options: {
    bassMinFrequency?: number;
    bassMaxFrequency?: number;
    midMinFrequency?: number;
    midMaxFrequency?: number;
    referenceA4Hz?: number;
  } = {}
): DualBandFrameChroma {
  const bassMin = options.bassMinFrequency ?? 40;
  const bassMax = options.bassMaxFrequency ?? 180;
  const midMin = options.midMinFrequency ?? 180;
  const midMax = options.midMaxFrequency ?? 1200;
  const refA4 = options.referenceA4Hz ?? DEFAULT_A4_HZ;

  if (frameData.length === 0 || sampleRate <= 0) {
    return {
      chroma: new Array(12).fill(0),
      bassChroma: new Array(12).fill(0),
      midChroma: new Array(12).fill(0),
      bassEstimate: {
        pitchClass: -1,
        pitchName: null,
        confidence: 0,
        energyRatio: 0
      }
    };
  }

  const bassRes = computeMidiBandPowers(frameData, sampleRate, bassMin, bassMax, 1024, refA4);
  const midRes = computeMidiBandPowers(frameData, sampleRate, midMin, midMax, 2400, refA4);

  const bassRaw = new Float64Array(12);
  const midRaw = new Float64Array(12);
  const combinedRaw = new Float64Array(12);

  let totalBassPower = 0;
  for (let i = 0; i < bassRes.midiNotes.length; i++) {
    const pc = ((bassRes.midiNotes[i] % 12) + 12) % 12;
    const p = bassRes.powers[i];
    bassRaw[pc] += p;
    combinedRaw[pc] += p;
    totalBassPower += p;
  }

  let totalMidPower = 0;
  for (let i = 0; i < midRes.midiNotes.length; i++) {
    const pc = ((midRes.midiNotes[i] % 12) + 12) % 12;
    const p = midRes.powers[i];
    midRaw[pc] += p;
    combinedRaw[pc] += p;
    totalMidPower += p;
  }

  const bassChroma = normalizeChromaVector(bassRaw);
  const midChroma = normalizeChromaVector(midRaw);
  const chroma = normalizeChromaVector(combinedRaw);

  // Compute amplitude ratio between bass (40–180 Hz) and mid (180–1200 Hz)
  const bassAmp = Math.sqrt(bassRes.maxPower);
  const midAmp = Math.sqrt(midRes.maxPower);
  const energyRatio = midAmp > 1e-9
    ? Number(Math.min(1, bassAmp / (bassAmp + midAmp)).toFixed(3))
    : (bassAmp > 1e-7 ? 1 : 0);

  // Detect lowest prominent bass note in 40–180 Hz
  let bassEstimate: BassPitchEstimate = {
    pitchClass: -1,
    pitchName: null,
    confidence: 0,
    energyRatio
  };

  if (bassRes.maxPower > 1e-10 && bassAmp >= 0.08 * midAmp) {
    const numBassBins = bassRes.midiNotes.length;
    const meanBassPower = totalBassPower / Math.max(1, numBassBins);
    const peakToMean = bassRes.maxPower / Math.max(1e-12, meanBassPower);

    // Tonality check: broadband percussive thuds have flat energy across semitones (peakToMean < 2.5)
    const tonality = Math.max(0, Math.min(1, (peakToMean - 2.0) / 7.5));

    // Scan from lowest MIDI upward to locate the lowest prominent local peak (>= 42% of max bass peak)
    const lowestPeakThreshold = bassRes.maxPower * 0.42;
    let chosenIdx = -1;

    for (let i = 0; i < numBassBins; i++) {
      const p = bassRes.powers[i];
      if (p < lowestPeakThreshold) continue;
      const left = i > 0 ? bassRes.powers[i - 1] : 0;
      const right = i < numBassBins - 1 ? bassRes.powers[i + 1] : 0;
      if (p >= left && p >= right) {
        chosenIdx = i;
        break;
      }
    }

    // Fallback to global bass max if no strict local peak was found
    if (chosenIdx === -1) {
      let bestP = -1;
      for (let i = 0; i < numBassBins; i++) {
        if (bassRes.powers[i] > bestP) {
          bestP = bassRes.powers[i];
          chosenIdx = i;
        }
      }
    }

    if (chosenIdx >= 0) {
      const chosenMidi = bassRes.midiNotes[chosenIdx];
      const chosenPc = ((chosenMidi % 12) + 12) % 12;
      const chosenPower = bassRes.powers[chosenIdx];
      const relStrength = Math.min(1, chosenPower / (bassRes.maxPower + 1e-12));
      const confidence = Number(Math.max(0, Math.min(1, 0.6 * tonality + 0.4 * relStrength)).toFixed(3));

      bassEstimate = {
        pitchClass: chosenPc,
        pitchName: PITCH_CLASSES[chosenPc],
        confidence,
        energyRatio,
        lowestFrequencyHz: Number(midiToFreq(chosenMidi, refA4).toFixed(2))
      };
    }
  }

  return {
    chroma,
    bassChroma,
    midChroma,
    bassEstimate
  };
}

/**
 * Computes triple-band chromagram (bass, mid, high) for a frame.
 * Extends dual-band with high-frequency (600–2000 Hz) for guitar harmonics.
 */
export function computeTripleBandFrameChroma(
  frameData: Float32Array,
  sampleRate: number,
  options: {
    bassMinFrequency?: number;
    bassMaxFrequency?: number;
    midMinFrequency?: number;
    midMaxFrequency?: number;
    highMinFrequency?: number;
    highMaxFrequency?: number;
    referenceA4Hz?: number;
  } = {}
): TripleBandFrameChroma {
  const highMin = options.highMinFrequency ?? 600;
  const highMax = options.highMaxFrequency ?? 2000;

  // First, get dual-band chroma
  const dual = computeDualBandFrameChroma(frameData, sampleRate, {
    bassMinFrequency: options.bassMinFrequency,
    bassMaxFrequency: options.bassMaxFrequency,
    midMinFrequency: options.midMinFrequency,
    midMaxFrequency: options.midMaxFrequency,
    referenceA4Hz: options.referenceA4Hz
  });

  if (frameData.length === 0 || sampleRate <= 0) {
    return {
      ...dual,
      highChroma: new Array(12).fill(0)
    };
  }

  // Compute high-frequency band (600–2000 Hz) for guitar harmonics
  const highRes = computeMidiBandPowers(frameData, sampleRate, highMin, highMax, 2048, options.referenceA4Hz ?? DEFAULT_A4_HZ);
  const highRaw = new Float64Array(12);

  for (let i = 0; i < highRes.midiNotes.length; i++) {
    const pc = ((highRes.midiNotes[i] % 12) + 12) % 12;
    const p = highRes.powers[i];
    highRaw[pc] += p;
  }

  const highChroma = normalizeChromaVector(highRaw);

  return {
    chroma: dual.chroma,
    bassChroma: dual.bassChroma,
    midChroma: dual.midChroma,
    highChroma,
    bassEstimate: dual.bassEstimate
  };
}

/**
 * Computes root-mean-square (RMS) acoustic energy for a signal slice.
 */
export function computeRmsEnergy(frameData: Float32Array): number {
  if (!frameData || frameData.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < frameData.length; i++) {
    const s = frameData[i];
    sumSq += s * s;
  }
  return Number(Math.sqrt(sumSq / frameData.length).toFixed(6));
}

/**
 * Slices an audio signal into windows of 1-2 seconds with overlap and computes
 * a temporal chromagram sequence (including dual-band bass/mid profiles and RMS energy by default).
 */
export function computeWindowedChromagrams(
  channelData: Float32Array,
  sampleRate: number,
  options: ChromaOptions = {}
): WindowedChroma[] {
  const windowDurationSec = options.windowDurationSec ?? 1.5; // 1.5 seconds window
  const hopDurationSec = options.hopDurationSec ?? (windowDurationSec * 0.5); // 50% overlap
  const useDualBand = options.dualBand ?? true;
  const useTripleBand = options.tripleBand ?? true; // NEW: default true

  const windowSamples = Math.floor(windowDurationSec * sampleRate);
  const hopSamples = Math.floor(hopDurationSec * sampleRate);

  const computeWindow = (slice: Float32Array, startTime: number, endTime: number): WindowedChroma => {
    const rmsEnergy = computeRmsEnergy(slice);

    // NEW: Try triple-band first (if enabled)
    if (useTripleBand && useDualBand) {
      const triple = computeTripleBandFrameChroma(slice, sampleRate, {
        bassMinFrequency: options.bassMinFrequency,
        bassMaxFrequency: options.bassMaxFrequency,
        midMinFrequency: options.midMinFrequency,
        midMaxFrequency: options.midMaxFrequency,
        highMinFrequency: options.highMinFrequency,
        highMaxFrequency: options.highMaxFrequency,
        referenceA4Hz: options.referenceA4Hz
      });
      return {
        startTime,
        endTime,
        chroma: triple.chroma,
        bassChroma: triple.bassChroma,
        midChroma: triple.midChroma,
        highChroma: triple.highChroma,
        bassEstimate: triple.bassEstimate,
        rmsEnergy
      };
    }

    if (useDualBand) {
      const dual = computeDualBandFrameChroma(slice, sampleRate, {
        bassMinFrequency: options.bassMinFrequency,
        bassMaxFrequency: options.bassMaxFrequency,
        midMinFrequency: options.midMinFrequency,
        midMaxFrequency: options.midMaxFrequency,
        referenceA4Hz: options.referenceA4Hz
      });
      return {
        startTime,
        endTime,
        chroma: dual.chroma,
        bassChroma: dual.bassChroma,
        midChroma: dual.midChroma,
        bassEstimate: dual.bassEstimate,
        rmsEnergy
      };
    }

    const chroma = computeFrameChroma(
      slice,
      sampleRate,
      options.minFrequency,
      options.maxFrequency,
      options.referenceA4Hz
    );
    return { startTime, endTime, chroma, rmsEnergy };
  };

  if (channelData.length < windowSamples || hopSamples <= 0) {
    // If audio is shorter than a single window, analyze the full segment
    return [
      computeWindow(channelData, 0, Number((channelData.length / sampleRate).toFixed(3)))
    ];
  }

  const results: WindowedChroma[] = [];
  const totalSamples = channelData.length;

  for (let start = 0; start <= totalSamples - (windowSamples / 2); start += hopSamples) {
    const end = Math.min(start + windowSamples, totalSamples);
    const slice = channelData.subarray(start, end);
    const startTime = Number((start / sampleRate).toFixed(3));
    const endTime = Number((end / sampleRate).toFixed(3));

    results.push(computeWindow(slice, startTime, endTime));
  }

  return results;
}
