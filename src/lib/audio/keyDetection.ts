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
 * Detects Musical Key & Scale using a 12-bin Pitch Class Profile (Chroma)
 */
export function detectKey(audioBuffer: AudioBuffer): { key: string; scale: string; harmonicChords: string[] } {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);

  // Analyze up to 45 seconds of audio around the body to capture harmonic center
  const duration = audioBuffer.duration;
  const startSec = duration > 40 ? Math.min(10, duration * 0.2) : 0;
  const endSec = Math.min(duration, startSec + 45);

  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.floor(endSec * sampleRate);
  const sliceLength = endSample - startSample;

  if (sliceLength <= 0) {
    return { key: 'Am', scale: 'Menor', harmonicChords: ['Am', 'Dm', 'E7', 'F', 'G', 'C'] };
  }

  const chroma = new Float64Array(12);
  const A4 = 440;
  const step = Math.max(1, Math.floor(sampleRate / 4000));

  for (let i = startSample; i < endSample - 1024; i += 1024 * step) {
    let crossings = 0;
    let energySum = 0;
    for (let j = 0; j < 1024; j++) {
      const s1 = data[i + j];
      const s2 = data[i + j + 1];
      if ((s1 >= 0 && s2 < 0) || (s1 < 0 && s2 >= 0)) {
        crossings++;
      }
      energySum += s1 * s1;
    }

    if (energySum > 0.001) {
      const approxFreq = (crossings * sampleRate) / (2 * 1024);
      if (approxFreq >= 65 && approxFreq <= 1500) {
        const semitonesFromA = 12 * (Math.log(approxFreq / A4) / Math.LN2);
        const noteIndex = Math.round(9 + semitonesFromA) % 12;
        const pitchClass = (noteIndex + 12) % 12;
        chroma[pitchClass] += energySum;
      }
    }
  }

  return detectKeyFromChroma(Array.from(chroma));
}
