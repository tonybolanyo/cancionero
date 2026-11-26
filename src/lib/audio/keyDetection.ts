import { extractMonoChannelData } from './bufferUtils';
import { computeWindowedChromagrams, WindowedChroma } from './chroma';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler Key Profiles for Major and Minor keys
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function normalize(v: number[]): number[] {
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / v.length;
  const std = Math.sqrt(variance) || 1;
  return v.map(x => (x - mean) / std);
}

function correlation(a: number[], b: number[]): number {
  const normA = normalize(a);
  const normB = normalize(b);
  let sum = 0;
  for (let i = 0; i < normA.length; i++) {
    sum += normA[i] * normB[i];
  }
  return sum / normA.length;
}

/**
 * Returns typical songwriter chords for a given key
 */
export function getDiatonicChords(key: string, scale: string): string[] {
  const rootName = key.replace(/m$/, '');
  const rootIndex = NOTE_NAMES.indexOf(rootName);
  if (rootIndex === -1) return ['Am', 'C', 'G', 'F', 'Dm', 'Em'];

  if (scale === 'Menor') {
    // i, III, iv, v, VI, VII, V7
    return [
      `${NOTE_NAMES[rootIndex]}m`,
      `${NOTE_NAMES[(rootIndex + 3) % 12]}`,
      `${NOTE_NAMES[(rootIndex + 5) % 12]}m`,
      `${NOTE_NAMES[(rootIndex + 7) % 12]}m`,
      `${NOTE_NAMES[(rootIndex + 8) % 12]}`,
      `${NOTE_NAMES[(rootIndex + 10) % 12]}`,
      `${NOTE_NAMES[(rootIndex + 7) % 12]}7`
    ];
  }

  // I, IV, V, vi, ii, iii, V7
  return [
    `${NOTE_NAMES[rootIndex]}`,
    `${NOTE_NAMES[(rootIndex + 5) % 12]}`,
    `${NOTE_NAMES[(rootIndex + 7) % 12]}`,
    `${NOTE_NAMES[(rootIndex + 9) % 12]}m`,
    `${NOTE_NAMES[(rootIndex + 2) % 12]}m`,
    `${NOTE_NAMES[(rootIndex + 4) % 12]}m`,
    `${NOTE_NAMES[(rootIndex + 7) % 12]}7`
  ];
}

/**
 * Detects Musical Key & Scale from a 12-bin chromagram using Krumhansl-Schmuckler profiles
 */
export function detectKeyFromChroma(chromaArray: number[]): { key: string; scale: string; harmonicChords: string[] } {
  if (!Array.isArray(chromaArray) || chromaArray.length !== 12 || chromaArray.every(v => v === 0)) {
    return { key: 'Am', scale: 'Menor', harmonicChords: getDiatonicChords('Am', 'Menor') };
  }

  let bestScore = -Infinity;
  let bestKey = 'Am';
  let bestScale = 'Menor';

  // Test all 12 major and 12 minor keys
  for (let root = 0; root < 12; root++) {
    const rotated = [...chromaArray.slice(root), ...chromaArray.slice(0, root)];

    const majorScore = correlation(rotated, MAJOR_PROFILE);
    if (majorScore > bestScore) {
      bestScore = majorScore;
      bestKey = NOTE_NAMES[root];
      bestScale = 'Mayor';
    }

    const minorScore = correlation(rotated, MINOR_PROFILE);
    if (minorScore > bestScore) {
      bestScore = minorScore;
      bestKey = `${NOTE_NAMES[root]}m`;
      bestScale = 'Menor';
    }
  }

  const harmonicChords = getDiatonicChords(bestKey, bestScale);
  return { key: bestKey, scale: bestScale, harmonicChords };
}

/**
 * Averages a sequence of windowed chromagrams (weighted by RMS energy when available)
 * into a normalized 12-bin pitch class profile.
 */
export function averageWindowedChroma(
  windows: Pick<WindowedChroma, 'chroma' | 'rmsEnergy'>[]
): number[] {
  const avgChroma = new Array<number>(12).fill(0);
  if (!Array.isArray(windows) || windows.length === 0) {
    return avgChroma;
  }

  let totalWeight = 0;
  for (const w of windows) {
    if (!Array.isArray(w.chroma) || w.chroma.length !== 12) continue;
    const hasRms = typeof w.rmsEnergy === 'number' && Number.isFinite(w.rmsEnergy);
    const weight = hasRms ? Math.max(0, w.rmsEnergy!) : 1;
    if (hasRms && weight <= 0) continue;

    for (let i = 0; i < 12; i++) {
      avgChroma[i] += (w.chroma[i] || 0) * weight;
    }
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return new Array<number>(12).fill(0);
  }

  let maxVal = 0;
  for (let i = 0; i < 12; i++) {
    avgChroma[i] /= totalWeight;
    if (avgChroma[i] > maxVal) maxVal = avgChroma[i];
  }

  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      avgChroma[i] = Number((avgChroma[i] / maxVal).toFixed(4));
    }
  }

  return avgChroma;
}

/**
 * Detects Musical Key & Scale directly from pre-computed windowed chromagrams.
 */
export function detectKeyFromWindowedChroma(
  windows: Pick<WindowedChroma, 'chroma' | 'rmsEnergy'>[]
): { key: string; scale: string; harmonicChords: string[] } {
  const avgChroma = averageWindowedChroma(windows);
  return detectKeyFromChroma(avgChroma);
}

/**
 * Detects Musical Key & Scale from an AudioBuffer using Goertzel windowed chromagrams
 * and Krumhansl-Schmuckler tonal profile correlation.
 */
export function detectKey(audioBuffer: AudioBuffer): { key: string; scale: string; harmonicChords: string[] } {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  if (!audioBuffer || audioBuffer.length === 0 || sampleRate <= 0 || duration <= 0) {
    return { key: 'Am', scale: 'Menor', harmonicChords: getDiatonicChords('Am', 'Menor') };
  }

  const mono = extractMonoChannelData(audioBuffer);

  // Analyze up to 45 seconds of audio around the body to capture harmonic center
  const startSec = duration > 40 ? Math.min(10, duration * 0.2) : 0;
  const endSec = Math.min(duration, startSec + 45);
  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.floor(endSec * sampleRate);

  if (endSample - startSample <= 0) {
    return { key: 'Am', scale: 'Menor', harmonicChords: getDiatonicChords('Am', 'Menor') };
  }

  const slice = startSample === 0 && endSample === mono.length
    ? mono
    : mono.subarray(startSample, endSample);

  const windows = computeWindowedChromagrams(slice, sampleRate, {
    windowDurationSec: 1.0,
    hopDurationSec: 0.5,
    dualBand: false,
    tripleBand: false
  });

  return detectKeyFromWindowedChroma(windows);
}
