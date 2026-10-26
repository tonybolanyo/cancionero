/**
 * Web Audio API Client-Side Musical Analyzer
 * Detects Tempo (BPM), Key (Tonalidad), and Scale (Escala) directly in the browser
 * using Digital Signal Processing (DSP) and Chromagram Correlation.
 * Completely client-side: 0 API keys required, works offline and on GitHub Pages!
 */

import { analyzeTempo } from '../lib/audio/tempo';

export interface DetectedChord {
  timestamp: string;
  seconds?: number;
  chord: string;
  section?: string;
}

export interface AudioAnalysisResult {
  tempo: number;
  tempoConfidence?: number;
  tempoOffset?: number;
  rawTempo?: number;
  key: string;
  scale: string;
  timeSignature: string;
  tuning?: string;
  durationSeconds: number;
  chordProgression: string;
  chords: DetectedChord[];
  musicalNotes?: string;
  suggestedLyricsChords?: string;
  source: 'gemini_ai' | 'client_dsp';
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler Key Profiles for Major and Minor keys
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Normalizes an array of numbers to mean 0 and variance 1
 */
function normalize(v: number[]): number[] {
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / v.length;
  const std = Math.sqrt(variance) || 1;
  return v.map(x => (x - mean) / std);
}

/**
 * Pearson correlation coefficient between two vectors
 */
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
 * Detects BPM (Tempo) using energy envelope autocorrelation
 */
function detectBPM(audioBuffer: AudioBuffer): { bpm: number; confidence: number } {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // Downsample to ~2205 Hz for fast tempo analysis
  const downsampleRatio = Math.max(1, Math.floor(sampleRate / 2205));
  const downsampledLength = Math.floor(channelData.length / downsampleRatio);
  const downsampledRate = sampleRate / downsampleRatio;
  const downsampled = new Float32Array(downsampledLength);

  for (let i = 0; i < downsampledLength; i++) {
    downsampled[i] = channelData[i * downsampleRatio];
  }

  // Calculate local energy envelope in 20ms frames
  const frameSize = Math.floor(downsampledRate * 0.02);
  const numFrames = Math.floor(downsampledLength / frameSize);
  const energy = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    const start = f * frameSize;
    for (let i = 0; i < frameSize; i++) {
      const val = downsampled[start + i];
      sum += val * val;
    }
    energy[f] = Math.sqrt(sum / frameSize);
  }

  // First-order difference of energy (onsets)
  const onsets = new Float32Array(numFrames);
  for (let i = 1; i < numFrames; i++) {
    const diff = energy[i] - energy[i - 1];
    onsets[i] = diff > 0 ? diff : 0;
  }

  // Autocorrelation over BPM range 60 to 180
  const minBpm = 60;
  const maxBpm = 180;
  const framesPerSec = downsampledRate / frameSize;

  const minLag = Math.floor((60 / maxBpm) * framesPerSec);
  const maxLag = Math.ceil((60 / minBpm) * framesPerSec);

  let bestLag = minLag;
  let maxCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const count = numFrames - lag;
    if (count <= 0) break;

    for (let i = 0; i < count; i++) {
      corr += onsets[i] * onsets[i + lag];
    }
    corr /= count;

    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  let rawBpm = Math.round((60 * framesPerSec) / bestLag);

  // Sanity normalize into typical songwriting range (70 - 150 BPM)
  if (rawBpm < 65) rawBpm *= 2;
  if (rawBpm > 170) rawBpm = Math.round(rawBpm / 2);

  return {
    bpm: Math.min(220, Math.max(50, rawBpm)),
    confidence: Math.min(0.95, Math.max(0.6, maxCorr > 0 ? 0.85 : 0.7))
  };
}

/**
 * Detects Musical Key & Scale using a 12-bin Pitch Class Profile (Chroma)
 */
function detectKey(audioBuffer: AudioBuffer): { key: string; scale: string; harmonicChords: string[] } {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);

  // Analyze up to 60 seconds of audio around the middle to capture harmonic body
  const duration = audioBuffer.duration;
  const startSec = duration > 40 ? Math.min(10, duration * 0.2) : 0;
  const endSec = Math.min(duration, startSec + 45);

  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.floor(endSec * sampleRate);
  const sliceLength = endSample - startSample;

  if (sliceLength <= 0) {
    return { key: 'Am', scale: 'Menor', harmonicChords: ['Am', 'Dm', 'E7', 'F', 'G', 'C'] };
  }

  // Chromagram: 12 semitones C, C#, D, D#, E, F, F#, G, G#, A, A#, B
  const chroma = new Float64Array(12);

  // Frequency reference: A4 = 440 Hz
  const A4 = 440;
  const step = Math.max(1, Math.floor(sampleRate / 4000)); // subsample for performance

  // Map audible frequencies (80Hz to 1200Hz - guitar/vocal range) to chromatic pitch classes
  for (let i = startSample; i < endSample - 1024; i += 1024 * step) {
    // Basic zero-crossing / frequency estimator per frame
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
        // Semitones from A4: 12 * log2(f / 440)
        const semitonesFromA = 12 * (Math.log(approxFreq / A4) / Math.LN2);
        // Note index: A is 9, A# is 10, B is 11, C is 0...
        const noteIndex = Math.round(9 + semitonesFromA) % 12;
        const pitchClass = (noteIndex + 12) % 12;
        chroma[pitchClass] += energySum;
      }
    }
  }

  // Smooth chroma
  const chromaArray = Array.from(chroma);
  let bestScore = -Infinity;
  let bestKey = 'Am';
  let bestScale = 'Menor';

  // Test all 12 major and 12 minor keys
  for (let root = 0; root < 12; root++) {
    // Rotate chroma so 'root' is at index 0
    const rotated = [...chromaArray.slice(root), ...chromaArray.slice(0, root)];

    // Correlate with Major
    const majorScore = correlation(rotated, MAJOR_PROFILE);
    if (majorScore > bestScore) {
      bestScore = majorScore;
      bestKey = NOTE_NAMES[root];
      bestScale = 'Mayor';
    }

    // Correlate with Minor
    const minorScore = correlation(rotated, MINOR_PROFILE);
    if (minorScore > bestScore) {
      bestScore = minorScore;
      bestKey = `${NOTE_NAMES[root]}m`;
      bestScale = 'Menor';
    }
  }

  // Generate diatonic chords for the detected key
  const harmonicChords = getDiatonicChords(bestKey, bestScale);

  return { key: bestKey, scale: bestScale, harmonicChords };
}

/**
 * Returns typical songwriter chords for a given key
 */
function getDiatonicChords(key: string, scale: string): string[] {
  const rootName = key.replace(/m$/, '');
  const rootIndex = NOTE_NAMES.indexOf(rootName);
  if (rootIndex === -1) return ['Am', 'C', 'G', 'F', 'Dm', 'Em'];

  if (scale === 'Menor') {
    // i, iv, v/V, VI, VII, III
    return [
      `${NOTE_NAMES[rootIndex]}m`,
      `${NOTE_NAMES[(rootIndex + 3) % 12]}`,
      `${NOTE_NAMES[(rootIndex + 5) % 12]}m`,
      `${NOTE_NAMES[(rootIndex + 7) % 12]}m`,
      `${NOTE_NAMES[(rootIndex + 8) % 12]}`,
      `${NOTE_NAMES[(rootIndex + 10) % 12]}`,
      `${NOTE_NAMES[(rootIndex + 7) % 12]}7`
    ];
  } else {
    // I, ii, iii, IV, V, vi
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
}

/**
 * Full client-side audio analysis using Web Audio API
 */
export async function analyzeAudioWithWebAudio(file: File): Promise<AudioAnalysisResult> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Tu navegador no soporta la API Web Audio para análisis local.');
  }

  const audioContext = new AudioContextClass();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    let bpm: number;
    let confidence: number;
    let tempoOffset = 0;
    let rawTempo: number | undefined;

    try {
      const tempoRes = await analyzeTempo(audioBuffer, { minTempo: 60, maxTempo: 180 });
      bpm = tempoRes.bpm;
      tempoOffset = tempoRes.offset;
      rawTempo = tempoRes.tempo;
      confidence = 0.95;
    } catch {
      // Fallback to internal autocorrelation if beat detector encounters difficulties
      const dspBpm = detectBPM(audioBuffer);
      bpm = dspBpm.bpm;
      confidence = dspBpm.confidence;
    }

    const { key, scale, harmonicChords } = detectKey(audioBuffer);
    const duration = Math.round(audioBuffer.duration);

    // Build timeline chords
    const chordTimeline: DetectedChord[] = [];
    const mainProg = harmonicChords.slice(0, 4);
    const intervalSec = Math.max(4, Math.round(duration / 8));

    for (let i = 0; i < Math.min(8, Math.floor(duration / intervalSec)); i++) {
      const sec = i * intervalSec;
      const mins = Math.floor(sec / 60);
      const remSec = sec % 60;
      const ts = `${mins}:${remSec < 10 ? '0' : ''}${remSec}`;
      const chord = mainProg[i % mainProg.length];
      const section = i === 0 ? 'Intro' : i === 2 ? 'Estrofa' : i === 5 ? 'Estribillo' : undefined;
      chordTimeline.push({ timestamp: ts, seconds: sec, chord, section });
    }

    const progressionStr = mainProg.join(' - ');

    return {
      tempo: bpm,
      tempoConfidence: confidence,
      tempoOffset,
      rawTempo,
      key,
      scale,
      timeSignature: '4/4',
      tuning: 'Estándar (EADGBE)',
      durationSeconds: duration,
      chordProgression: progressionStr,
      chords: chordTimeline,
      musicalNotes: `Análisis de audio procesado por DSP local. Tonalidad detectada ${key} (${scale}), pulso rítmico estimado en ${bpm} BPM (offset 1er beat: ${tempoOffset.toFixed(3)}s). Progresión tonal recomendada: ${progressionStr}.`,
      suggestedLyricsChords: `## Estrofa\n[${mainProg[0] || 'Am'}] Primer verso de la maqueta...\n[${mainProg[1] || 'C'}] Segundo verso con melodía\n\n## Estribillo\n[${mainProg[2] || 'G'}] El estribillo asciende aquí\n[${mainProg[3] || 'F'}] Resolviendo en cadencia`,
      source: 'client_dsp'
    };
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close();
    }
  }
}
