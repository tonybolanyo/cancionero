/**
 * Music Meter & Time Signature Estimation
 * 
 * Heuristic estimation of musical meter ('2/4' | '3/4' | '4/4' | '6/8')
 * reusing pre-calculated beats, onsets, and acoustic energy.
 * 
 * Explanatory principles:
 * 1. Metric Hierarchy (Lerdahl & Jackendoff): In Western music, measure downbeats (beat 1)
 *    exhibit higher acoustic salience (bass/kick energy, onset presence, harmonic chord change).
 * 2. Canonical metric templates:
 *    - 4/4: Strong - Weak - Medium - Weak [1.0, 0.25, 0.65, 0.25]
 *    - 3/4: Strong - Weak - Weak          [1.0, 0.25, 0.25]
 *    - 6/8: Strong - Weak - Weak - Medium - Weak - Weak [1.0, 0.25, 0.25, 0.70, 0.25, 0.25]
 *    - 2/4: Strong - Weak                 [1.0, 0.25]
 * 3. Auto-correlation of beat salience at lags 2, 3, 4, 6 to detect fundamental periodicity.
 * 4. Harmonic Rhythm correlation: Chord changes overwhelmingly occur on downbeats.
 * 
 * Limitations:
 * - Rubato / Free-time: Tempo variations degrade fixed-interval periodicities.
 * - Changing / Mixed meters: Songs alternating between 3/4 and 4/4 are estimated by dominant meter.
 * - Heavy syncopation: Latin / Funk / Reggae with silent downbeats may shift phase.
 * - Live recordings without click tracks.
 */

import { extractMonoChannelData } from './bufferUtils';

export type TimeSignature = '2/4' | '3/4' | '4/4' | '6/8';

export interface MeterAnalysis {
  meter: TimeSignature;
  confidence: number;
  downbeats: number[];
  phase?: number;
  barCount?: number;
  candidates?: Record<TimeSignature, number>;
}

export interface MeterEstimationOptions {
  beats: number[];
  onsets?: number[];
  audioBuffer?: AudioBuffer | null;
  channelData?: Float32Array;
  sampleRate?: number;
  bpm?: number;
  chords?: { startTime: number; endTime: number; chord: string }[];
}

/**
 * Metric templates for correlation and distance matching.
 * Values reflect normalized acoustic accent expectation for each beat within a measure.
 */
const METRIC_TEMPLATES: Record<TimeSignature, number[]> = {
  '2/4': [1.0, 0.25],
  '3/4': [1.0, 0.25, 0.25],
  '4/4': [1.0, 0.25, 0.65, 0.25],
  '6/8': [1.0, 0.25, 0.25, 0.70, 0.25, 0.25]
};

/**
 * Calculates local acoustic energy around a beat timestamp.
 */
function getLocalBeatEnergy(
  timestamp: number,
  channelData: Float32Array,
  sampleRate: number
): { energy: number; attack: number } {
  const centerSample = Math.round(timestamp * sampleRate);
  const winHalf = Math.round(0.04 * sampleRate); // 40ms window
  const preWin = Math.round(0.06 * sampleRate);

  const start = Math.max(0, centerSample - winHalf);
  const end = Math.min(channelData.length, centerSample + winHalf);

  let sumSq = 0;
  let count = 0;
  for (let i = start; i < end; i += 2) {
    const s = channelData[i];
    sumSq += s * s;
    count++;
  }
  const energy = count > 0 ? Math.sqrt(sumSq / count) : 0;

  // Previous window to detect attack contrast
  const preStart = Math.max(0, start - preWin);
  let preSumSq = 0;
  let preCount = 0;
  for (let i = preStart; i < start; i += 2) {
    const s = channelData[i];
    preSumSq += s * s;
    preCount++;
  }
  const preEnergy = preCount > 0 ? Math.sqrt(preSumSq / preCount) : 0;
  const attack = Math.max(0, energy - preEnergy);

  return { energy, attack };
}

/**
 * Computes Pearson auto-correlation of a vector at a given lag.
 */
function computeAutocorrelation(values: number[], lag: number): number {
  const n = values.length;
  if (n <= lag) return 0;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += values[i];
  mean /= n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    den += diff * diff;
    if (i + lag < n) {
      num += diff * (values[i + lag] - mean);
    }
  }

  if (den === 0) return 0;
  return num / den;
}

/**
 * Calculates beat salience vector (acoustic accent strength for each detected beat).
 */
export function computeBeatSaliences(options: MeterEstimationOptions): number[] {
  const { beats, onsets = [], audioBuffer, chords = [] } = options;
  if (!beats || beats.length === 0) return [];

  let channelData = options.channelData;
  let sampleRate = options.sampleRate || 44100;

  if (!channelData && audioBuffer) {
    channelData = extractMonoChannelData(audioBuffer);
    sampleRate = audioBuffer.sampleRate;
  }

  const saliences: number[] = new Array(beats.length).fill(0.3);

  // 1. Audio Energy & Transient Attack
  if (channelData && channelData.length > 0) {
    for (let i = 0; i < beats.length; i++) {
      const { energy, attack } = getLocalBeatEnergy(beats[i], channelData, sampleRate);
      saliences[i] = energy * 0.7 + attack * 0.3;
    }
  }

  // 2. Onset Proximity Boost
  if (onsets && onsets.length > 0) {
    const tolerance = 0.045; // 45ms window
    for (let i = 0; i < beats.length; i++) {
      const bTime = beats[i];
      let closestDist = Infinity;
      for (let j = 0; j < onsets.length; j++) {
        const dist = Math.abs(onsets[j] - bTime);
        if (dist < closestDist) {
          closestDist = dist;
        }
        if (onsets[j] > bTime + tolerance) break;
      }
      if (closestDist <= tolerance) {
        const bonus = 1.0 - (closestDist / tolerance);
        saliences[i] += bonus * 0.35;
      }
    }
  }

  // 3. Harmonic Rhythm (Chord Change) Boost
  if (chords && chords.length > 0) {
    const chordChangeTimes: number[] = [];
    for (let c = 1; c < chords.length; c++) {
      if (chords[c].chord !== chords[c - 1].chord) {
        chordChangeTimes.push(chords[c].startTime);
      }
    }

    if (chordChangeTimes.length > 0) {
      const chordTol = 0.12; // 120ms window for chord transitions
      for (let i = 0; i < beats.length; i++) {
        const bTime = beats[i];
        const isNearChordChange = chordChangeTimes.some(ct => Math.abs(ct - bTime) <= chordTol);
        if (isNearChordChange) {
          saliences[i] += 0.60;
        }
      }
    }
  }

  // Normalize saliences to [0.1, 1.0]
  const maxVal = Math.max(...saliences, 0.001);
  return saliences.map(v => Math.max(0.1, v / maxVal));
}

/**
 * Estimates the musical meter from pre-calculated beats and acoustic signals.
 */
export function estimateMeter(options: MeterEstimationOptions): MeterAnalysis {
  const { beats } = options;

  // Edge case: not enough beats
  if (!beats || beats.length < 4) {
    return {
      meter: '4/4',
      confidence: 0.5,
      downbeats: beats || []
    };
  }

  const saliences = computeBeatSaliences(options);
  const candidateMeters: TimeSignature[] = ['2/4', '3/4', '4/4', '6/8'];

  // Compute autocorrelations for period detection
  const autocorr: Record<number, number> = {
    2: computeAutocorrelation(saliences, 2),
    3: computeAutocorrelation(saliences, 3),
    4: computeAutocorrelation(saliences, 4),
    6: computeAutocorrelation(saliences, 6)
  };

  const candidatesScores: Record<TimeSignature, number> = {
    '2/4': 0,
    '3/4': 0,
    '4/4': 0,
    '6/8': 0
  };

  const bestPhases: Record<TimeSignature, number> = {
    '2/4': 0,
    '3/4': 0,
    '4/4': 0,
    '6/8': 0
  };

  for (const meter of candidateMeters) {
    const template = METRIC_TEMPLATES[meter];
    const K = template.length;
    let bestScoreForMeter = -Infinity;
    let bestPhaseForMeter = 0;

    for (let phase = 0; phase < K; phase++) {
      // 1. Average profile for this (K, phase) grouping
      const profile = new Array(K).fill(0);
      const counts = new Array(K).fill(0);

      for (let i = phase; i < saliences.length; i++) {
        const slot = (i - phase) % K;
        profile[slot] += saliences[i];
        counts[slot]++;
      }

      for (let s = 0; s < K; s++) {
        profile[s] = counts[s] > 0 ? profile[s] / counts[s] : 0;
      }

      // Max-normalize profile
      const profMax = Math.max(...profile, 0.001);
      const normProfile = profile.map(v => v / profMax);

      // 2. Mean absolute error against canonical template
      let totalError = 0;
      for (let j = 0; j < K; j++) {
        totalError += Math.abs(normProfile[j] - template[j]);
      }
      const meanError = totalError / K;
      const templateMatch = Math.max(0, 1.0 - meanError * 1.5);

      // 3. Downbeat vs Off-beat contrast
      const downbeatMean = profile[0];
      const otherBeatsMean = K > 1
        ? profile.slice(1).reduce((a, b) => a + b, 0) / (K - 1)
        : 1;
      const contrast = (downbeatMean + 0.05) / (otherBeatsMean + 0.05);

      // 4. Combined score
      const totalScore = templateMatch * 0.55 + Math.min(2.5, contrast) * 0.45;

      if (totalScore > bestScoreForMeter) {
        bestScoreForMeter = totalScore;
        bestPhaseForMeter = phase;
      }
    }

    // Combine with autocorrelation at lag K
    const ac = Math.max(0, autocorr[K] || 0);
    let finalMeterScore = bestScoreForMeter * (1.0 + ac * 0.6);

    // Heuristic differentiation rules:
    if (meter === '2/4') {
      // In 2/4, if beat 0 and beat 2 in 4-beat chunks are equal, 2/4 is preferred.
      // If autocorr(2) >= autocorr(4), 2/4 dominates.
      if (autocorr[2] > autocorr[4] + 0.1) {
        finalMeterScore *= 1.25;
      }
    } else if (meter === '4/4') {
      // If autocorr(4) is substantially higher than autocorr(2), 4/4 dominates
      if (autocorr[4] > autocorr[2]) {
        finalMeterScore *= 1.15;
      }
    } else if (meter === '6/8') {
      // 6/8 has strong correlation at lag 6; if lag 6 >= lag 3, 6/8 dominates over 3/4
      if (autocorr[6] >= autocorr[3] - 0.05) {
        finalMeterScore *= 1.20;
      }
    } else if (meter === '3/4') {
      // If lag 3 is high and lag 6 is not higher, 3/4 dominates
      if (autocorr[3] > autocorr[6] + 0.1) {
        finalMeterScore *= 1.15;
      }
    }

    candidatesScores[meter] = finalMeterScore;
    bestPhases[meter] = bestPhaseForMeter;
  }

  // Find winning meter
  let bestMeter: TimeSignature = '4/4';
  let highestScore = -Infinity;

  for (const meter of candidateMeters) {
    if (candidatesScores[meter] > highestScore) {
      highestScore = candidatesScores[meter];
      bestMeter = meter;
    }
  }

  const bestPhase = bestPhases[bestMeter];
  const K = METRIC_TEMPLATES[bestMeter].length;

  // Extract downbeat timestamps
  const downbeats: number[] = [];
  for (let i = bestPhase; i < beats.length; i += K) {
    downbeats.push(beats[i]);
  }

  // Calculate confidence from relative score margin
  const sortedScores = Object.values(candidatesScores).sort((a, b) => b - a);
  const top1 = sortedScores[0];
  const top2 = sortedScores[1] || 0.5;
  const margin = top1 > 0 ? (top1 - top2) / top1 : 0.2;
  const confidence = Math.min(0.95, Math.max(0.50, 0.55 + margin * 0.70));

  return {
    meter: bestMeter,
    confidence: Number(confidence.toFixed(2)),
    downbeats,
    phase: bestPhase,
    barCount: downbeats.length,
    candidates: candidatesScores
  };
}

/**
 * Recalculates downbeats when the user manually changes or overrides the meter.
 */
export function recalculateDownbeats(
  beats: number[],
  meter: TimeSignature,
  phase: number = 0
): number[] {
  if (!beats || beats.length === 0) return [];
  const K = METRIC_TEMPLATES[meter]?.length || 4;
  const effectivePhase = Math.max(0, Math.min(K - 1, phase));

  const downbeats: number[] = [];
  for (let i = effectivePhase; i < beats.length; i += K) {
    downbeats.push(beats[i]);
  }
  return downbeats;
}
