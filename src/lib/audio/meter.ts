/**
 * Music Meter & Time Signature Estimation
 *
 * Heuristic estimation of musical meter:
 * - Standard: '2/4' | '3/4' | '4/4' | '6/8'
 * - Odd / Additive / Compound: '5/4' | '7/4' | '5/8' | '7/8' | '9/8' | '12/8'
 *
 * Explanatory principles:
 * 1. Metric Hierarchy (Lerdahl & Jackendoff): Measure downbeats (beat 1) exhibit
 *    higher acoustic salience (RMS + low-band bass/kick energy, transient attack,
 *    onset proximity, and harmonic chord-change alignment).
 * 2. Multi-grouping metric templates: Asymmetric meters support their canonical
 *    subdivisions (e.g., 5/4 as 3+2 or 2+3; 7/8 as 2+2+3, 3+2+2, 2+3+2; 7/4 as 4+3 or 3+4;
 *    9/8 as 3+3+3 or 2+2+2+3).
 * 3. Unbiased overlap-normalized autocorrelation across lags 2..12 with parsimony
 *    checks so multiples (6/8, 9/8, 12/8) do not falsely override simple meters (3/4, 4/4).
 * 4. Multi-grid subdivision evaluation: Evaluates a 2x eighth-note grid when the beat
 *    tracker locks onto quarter notes, catching half-integer odd bars like 7/8 (3.5 beats)
 *    and 5/8 (2.5 beats) whose odd-bar downbeats fall on half-beats; and a 3x triplet
 *    grid when compound meters (6/8, 9/8, 12/8) are tracked at the dotted-quarter pulse.
 */

import { extractMonoChannelData } from './bufferUtils';

export type TimeSignature =
  | '2/4'
  | '3/4'
  | '4/4'
  | '5/4'
  | '7/4'
  | '5/8'
  | '6/8'
  | '7/8'
  | '9/8'
  | '12/8';

export const COMMON_TIME_SIGNATURES_LIST: TimeSignature[] = ['2/4', '3/4', '4/4', '6/8'];

export const UNCOMMON_TIME_SIGNATURES_LIST: TimeSignature[] = [
  '5/4',
  '7/4',
  '5/8',
  '7/8',
  '9/8',
  '12/8'
];

export const ALL_TIME_SIGNATURES: TimeSignature[] = [
  ...COMMON_TIME_SIGNATURES_LIST,
  ...UNCOMMON_TIME_SIGNATURES_LIST
];

export interface MeterAnalysis {
  meter: TimeSignature;
  confidence: number;
  downbeats: number[];
  phase?: number;
  barCount?: number;
  grouping?: string;
  gridMode?: 'beat' | 'subdivision2x' | 'subdivision3x';
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

interface MetricTemplateVariant {
  grouping: string;
  weights: number[];
}

/**
 * Multi-variant metric templates for correlation and distance matching.
 * Each meter includes its primary accent hierarchy and common additive groupings.
 */
const METRIC_TEMPLATE_VARIANTS: Record<TimeSignature, MetricTemplateVariant[]> = {
  '2/4': [{ grouping: '2', weights: [1.0, 0.25] }],
  '3/4': [{ grouping: '3', weights: [1.0, 0.22, 0.22] }],
  '4/4': [{ grouping: '4', weights: [1.0, 0.25, 0.65, 0.25] }],
  '5/4': [
    { grouping: '3+2', weights: [1.0, 0.20, 0.20, 0.65, 0.20] },
    { grouping: '2+3', weights: [1.0, 0.20, 0.65, 0.20, 0.20] }
  ],
  '5/8': [
    { grouping: '3+2', weights: [1.0, 0.20, 0.20, 0.72, 0.20] },
    { grouping: '2+3', weights: [1.0, 0.20, 0.72, 0.20, 0.20] }
  ],
  '6/8': [{ grouping: '3+3', weights: [1.0, 0.20, 0.20, 0.72, 0.20, 0.20] }],
  '7/4': [
    { grouping: '4+3', weights: [1.0, 0.22, 0.55, 0.22, 0.75, 0.22, 0.22] },
    { grouping: '3+4', weights: [1.0, 0.22, 0.22, 0.75, 0.22, 0.55, 0.22] },
    { grouping: '2+2+3', weights: [1.0, 0.22, 0.65, 0.22, 0.72, 0.22, 0.22] },
    { grouping: '3+2+2', weights: [1.0, 0.22, 0.22, 0.72, 0.22, 0.65, 0.22] },
    { grouping: '2+3+2', weights: [1.0, 0.22, 0.65, 0.22, 0.22, 0.70, 0.22] }
  ],
  '7/8': [
    { grouping: '2+2+3', weights: [1.0, 0.20, 0.65, 0.20, 0.72, 0.20, 0.20] },
    { grouping: '3+2+2', weights: [1.0, 0.20, 0.20, 0.72, 0.20, 0.65, 0.20] },
    { grouping: '2+3+2', weights: [1.0, 0.20, 0.65, 0.20, 0.20, 0.70, 0.20] },
    { grouping: '4+3', weights: [1.0, 0.20, 0.52, 0.20, 0.75, 0.20, 0.20] },
    { grouping: '3+4', weights: [1.0, 0.20, 0.20, 0.75, 0.20, 0.52, 0.20] }
  ],
  '9/8': [
    { grouping: '3+3+3', weights: [1.0, 0.20, 0.20, 0.68, 0.20, 0.20, 0.68, 0.20, 0.20] },
    { grouping: '2+2+2+3', weights: [1.0, 0.20, 0.62, 0.20, 0.62, 0.20, 0.72, 0.20, 0.20] }
  ],
  '12/8': [
    { grouping: '3+3+3+3', weights: [1.0, 0.20, 0.20, 0.58, 0.20, 0.20, 0.78, 0.20, 0.20, 0.58, 0.20, 0.20] }
  ]
};

export function getMeterBeatCount(meter: string): number {
  const num = parseInt((meter || '4/4').split('/')[0], 10);
  return Number.isFinite(num) && num > 0 ? num : 4;
}

export function getMeterDescription(meter: string): string {
  switch (meter) {
    case '4/4':
      return 'Cuaternario (Común)';
    case '3/4':
      return 'Ternario (Vals/Zamba)';
    case '6/8':
      return 'Compuesto Binario (6/8)';
    case '2/4':
      return 'Binario (2/4)';
    case '5/4':
      return 'Amalgama Quinario (5/4)';
    case '5/8':
      return 'Irregular Quinario (5/8)';
    case '7/4':
      return 'Amalgama Septenario (7/4)';
    case '7/8':
      return 'Irregular Septenario (7/8)';
    case '9/8':
      return 'Compuesto Ternario (9/8)';
    case '12/8':
      return 'Compuesto Cuaternario (12/8)';
    default:
      return `Compás (${meter})`;
  }
}

/**
 * Computes median inter-onset/inter-beat interval in seconds.
 */
export function computeMedianBeatInterval(beats: number[], fallbackBpm?: number): number {
  if (beats && beats.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < beats.length; i++) {
      const d = beats[i] - beats[i - 1];
      if (d > 0.08 && d < 2.5) {
        diffs.push(d);
      }
    }
    if (diffs.length > 0) {
      diffs.sort((a, b) => a - b);
      return diffs[Math.floor(diffs.length / 2)];
    }
  }
  if (fallbackBpm && fallbackBpm > 0) {
    return 60 / fallbackBpm;
  }
  return 0.5;
}

/**
 * Calculates local acoustic energy (broadband RMS, low-band bass/kick RMS, and transient attack)
 * around a beat timestamp.
 */
function getLocalBeatEnergy(
  timestamp: number,
  channelData: Float32Array,
  sampleRate: number
): { energy: number; lowEnergy: number; attack: number } {
  const centerSample = Math.round(timestamp * sampleRate);
  const winHalf = Math.round(0.04 * sampleRate); // 40ms half-window
  const preWin = Math.round(0.06 * sampleRate);

  const start = Math.max(0, centerSample - winHalf);
  const end = Math.min(channelData.length, centerSample + winHalf);

  let sumSq = 0;
  let lowSumSq = 0;
  let count = 0;

  // Lightweight 1-pole low-pass (~220 Hz at 44.1kHz, stepping by 2) to highlight kick/bass downbeats
  const effectiveSr = sampleRate / 2;
  const rc = 1 / (2 * Math.PI * 220);
  const dt = 1 / Math.max(1000, effectiveSr);
  const alpha = dt / (rc + dt);
  let lp = 0;

  for (let i = start; i < end; i += 2) {
    const s = channelData[i];
    sumSq += s * s;
    lp += alpha * (s - lp);
    lowSumSq += lp * lp;
    count++;
  }
  const energy = count > 0 ? Math.sqrt(sumSq / count) : 0;
  const lowEnergy = count > 0 ? Math.sqrt(lowSumSq / count) : 0;

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

  return { energy, lowEnergy, attack };
}

/**
 * Computes overlap-normalized Pearson auto-correlation of a vector at a given lag,
 * weighted by pair reliability so longer periods (5, 7, 9, 12) are not artificially penalized.
 */
function computeAutocorrelation(values: number[], lag: number): number {
  const n = values.length;
  const pairs = n - lag;
  if (pairs < 3 || lag <= 0) return 0;

  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < pairs; i++) {
    meanA += values[i];
    meanB += values[i + lag];
  }
  meanA /= pairs;
  meanB /= pairs;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < pairs; i++) {
    const da = values[i] - meanA;
    const db = values[i + lag] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  if (den <= 1e-9) return 0;

  const rawCorr = num / den;
  const reliability = Math.min(1, pairs / Math.max(4, lag));
  return rawCorr * reliability;
}

/**
 * Pearson correlation between two equal-length vectors.
 */
function computePearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;

  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  if (den <= 1e-9) return 0;
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

  // 1. Audio Energy, Low-Band Bass/Kick Energy & Transient Attack (volume-invariant)
  if (channelData && channelData.length > 0) {
    const rawAcoustic = new Array<number>(beats.length).fill(0);
    let maxAcoustic = 0;
    for (let i = 0; i < beats.length; i++) {
      const { energy, lowEnergy, attack } = getLocalBeatEnergy(beats[i], channelData, sampleRate);
      const val = energy * 0.55 + attack * 0.28 + lowEnergy * 0.17;
      rawAcoustic[i] = val;
      if (val > maxAcoustic) maxAcoustic = val;
    }
    if (maxAcoustic > 1e-6) {
      for (let i = 0; i < beats.length; i++) {
        saliences[i] = rawAcoustic[i] / maxAcoustic;
      }
    }
  }

  // 2. Onset Proximity Boost (binary search / linear scan friendly for sorted or unsorted onsets)
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
        if (onsets[j] > bTime + tolerance && j > 0 && onsets[j] >= onsets[j - 1]) {
          break;
        }
      }
      if (closestDist <= tolerance) {
        const bonus = 1.0 - closestDist / tolerance;
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

interface GridEvaluation {
  bestMeter: TimeSignature;
  bestScore: number;
  bestPhase: number;
  bestGrouping: string;
  bestAutocorr: number;
  candidatesScores: Record<TimeSignature, number>;
  bestPhases: Record<TimeSignature, number>;
  bestGroupings: Record<TimeSignature, string>;
  autocorr: Record<number, number>;
  isFlat: boolean;
}

function evaluateGrid(
  gridBeats: number[],
  saliences: number[],
  candidateMeters: TimeSignature[],
  pulseIOI: number,
  gridMode: 'beat' | 'subdivision2x' | 'subdivision3x'
): GridEvaluation {
  const n = saliences.length;
  let meanSal = 0;
  for (let i = 0; i < n; i++) meanSal += saliences[i];
  meanSal /= Math.max(1, n);

  let varSal = 0;
  for (let i = 0; i < n; i++) {
    const d = saliences[i] - meanSal;
    varSal += d * d;
  }
  const stdSal = Math.sqrt(varSal / Math.max(1, n));
  const isFlat = stdSal < 0.04;

  const autocorr: Record<number, number> = {
    2: computeAutocorrelation(saliences, 2),
    3: computeAutocorrelation(saliences, 3),
    4: computeAutocorrelation(saliences, 4),
    5: computeAutocorrelation(saliences, 5),
    6: computeAutocorrelation(saliences, 6),
    7: computeAutocorrelation(saliences, 7),
    9: computeAutocorrelation(saliences, 9),
    12: computeAutocorrelation(saliences, 12)
  };

  const candidatesScores: Record<TimeSignature, number> = {
    '2/4': 0,
    '3/4': 0,
    '4/4': 0,
    '5/4': 0,
    '7/4': 0,
    '5/8': 0,
    '6/8': 0,
    '7/8': 0,
    '9/8': 0,
    '12/8': 0
  };

  const bestPhases: Record<TimeSignature, number> = {
    '2/4': 0,
    '3/4': 0,
    '4/4': 0,
    '5/4': 0,
    '7/4': 0,
    '5/8': 0,
    '6/8': 0,
    '7/8': 0,
    '9/8': 0,
    '12/8': 0
  };

  const bestGroupings: Record<TimeSignature, string> = {
    '2/4': '2',
    '3/4': '3',
    '4/4': '4',
    '5/4': '3+2',
    '7/4': '4+3',
    '5/8': '3+2',
    '6/8': '3+3',
    '7/8': '2+2+3',
    '9/8': '3+3+3',
    '12/8': '3+3+3+3'
  };

  const minBeatsRequired = (k: number): number => {
    if (k <= 4) return 4;
    if (k === 5) return 7;
    if (k === 6) return 8;
    if (k === 7) return 9;
    if (k === 9) return 12;
    return 16; // k === 12
  };

  for (const meter of candidateMeters) {
    const variants = METRIC_TEMPLATE_VARIANTS[meter];
    const K = variants[0].weights.length;

    if (saliences.length < minBeatsRequired(K)) {
      candidatesScores[meter] = 0;
      continue;
    }

    let bestScoreForMeter = -Infinity;
    let bestPhaseForMeter = 0;
    let bestGroupingForMeter = variants[0].grouping;
    let bestProfileForMeter: number[] = new Array(K).fill(0);
    let bestContrastForMeter = 1;

    for (const variant of variants) {
      const template = variant.weights;

      for (let phase = 0; phase < K; phase++) {
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

        const profMax = Math.max(...profile, 0.001);
        const normProfile = profile.map(v => v / profMax);

        let totalError = 0;
        for (let j = 0; j < K; j++) {
          totalError += Math.abs(normProfile[j] - template[j]);
        }
        const meanError = totalError / K;
        const maeMatch = Math.max(0, 1.0 - meanError * 1.45);
        const corrMatch = Math.max(0, computePearson(normProfile, template));
        const templateMatch = maeMatch * 0.55 + corrMatch * 0.45;

        const downbeatMean = profile[0];
        const otherSlots = profile.slice(1);
        const otherBeatsMean =
          K > 1 ? otherSlots.reduce((a, b) => a + b, 0) / (K - 1) : 1;
        const contrast = (downbeatMean + 0.05) / (otherBeatsMean + 0.05);

        const maxOther = otherSlots.length > 0 ? Math.max(...otherSlots) : 0;
        const downbeatMargin = Math.max(0, (downbeatMean - maxOther) / (downbeatMean + 0.05));

        const totalScore =
          templateMatch * 0.50 +
          Math.min(2.5, contrast) * 0.35 +
          downbeatMargin * 0.35;

        if (totalScore > bestScoreForMeter) {
          bestScoreForMeter = totalScore;
          bestPhaseForMeter = phase;
          bestGroupingForMeter = variant.grouping;
          bestProfileForMeter = profile;
          bestContrastForMeter = contrast;
        }
      }
    }

    const ac = Math.max(0, autocorr[K] || 0);
    let finalMeterScore = bestScoreForMeter * (1.0 + ac * 0.65);

    // Heuristic differentiation & parsimony rules
    if (meter === '2/4') {
      if (autocorr[2] > autocorr[4] + 0.08) {
        finalMeterScore *= 1.25;
      }
    } else if (meter === '4/4') {
      if (autocorr[4] > autocorr[2] + 0.02) {
        finalMeterScore *= 1.15;
      }
    } else if (meter === '3/4') {
      if (autocorr[3] > autocorr[6] + 0.06) {
        finalMeterScore *= 1.15;
      }
    } else if (meter === '6/8') {
      const hasCompoundHierarchy =
        bestProfileForMeter[0] > (bestProfileForMeter[3] ?? 0) * 1.08 &&
        (bestProfileForMeter[3] ?? 0) >
          Math.max(
            bestProfileForMeter[1] ?? 0,
            bestProfileForMeter[2] ?? 0,
            bestProfileForMeter[4] ?? 0,
            bestProfileForMeter[5] ?? 0
          ) *
            1.12;

      if (
        (autocorr[6] >= autocorr[3] - 0.05 && (hasCompoundHierarchy || pulseIOI < 0.36)) ||
        gridMode === 'subdivision3x'
      ) {
        finalMeterScore *= 1.20;
      } else if (
        autocorr[3] > 0.35 &&
        (bestProfileForMeter[3] ?? 0) >= bestProfileForMeter[0] * 0.90 &&
        pulseIOI >= 0.36
      ) {
        // Pure 3/4 repeated twice — let 3/4 win by parsimony
        finalMeterScore *= 0.78;
      }
    } else if (meter === '9/8') {
      if (autocorr[9] < 0.25 || bestContrastForMeter < 1.22) {
        finalMeterScore *= 0.65;
      } else if (bestGroupingForMeter === '3+3+3') {
        const subDownbeatMax = Math.max(
          bestProfileForMeter[3] ?? 0,
          bestProfileForMeter[6] ?? 0
        );
        const hasTripleCompoundHierarchy = bestProfileForMeter[0] > subDownbeatMax * 1.10;
        if (
          gridMode !== 'subdivision3x' &&
          (!hasTripleCompoundHierarchy || autocorr[9] < autocorr[3] - 0.08)
        ) {
          finalMeterScore *= 0.65;
        } else if (hasTripleCompoundHierarchy && autocorr[9] >= autocorr[3] - 0.05) {
          finalMeterScore *= 1.12;
        }
      } else if (bestGroupingForMeter === '2+2+2+3') {
        // Aksak 9/8 has low lag-3 and high lag-9
        if (autocorr[9] > autocorr[3] + 0.10) {
          finalMeterScore *= 1.15;
        }
      }
    } else if (meter === '12/8') {
      const midSub = bestProfileForMeter[6] ?? 0;
      const quarterSubMax = Math.max(
        bestProfileForMeter[3] ?? 0,
        bestProfileForMeter[9] ?? 0
      );
      const hasQuadCompoundHierarchy =
        bestProfileForMeter[0] > quarterSubMax * 1.12 &&
        (bestProfileForMeter[0] > midSub * 1.06 || midSub > quarterSubMax * 1.08);

      if (
        autocorr[12] < 0.25 ||
        bestContrastForMeter < 1.22 ||
        (gridMode !== 'subdivision3x' &&
          (!hasQuadCompoundHierarchy ||
            autocorr[12] < Math.max(autocorr[4], autocorr[6]) - 0.08))
      ) {
        finalMeterScore *= 0.65;
      } else if (hasQuadCompoundHierarchy && autocorr[12] >= autocorr[3] - 0.05) {
        finalMeterScore *= 1.12;
      }
    } else if (meter === '5/4' || meter === '5/8') {
      if (autocorr[5] < 0.18 || bestContrastForMeter < 1.22) {
        finalMeterScore *= 0.65;
      } else {
        const maxSimpleAc = Math.max(autocorr[2], autocorr[3], autocorr[4], autocorr[6]);
        if (autocorr[5] >= 0.30 && autocorr[5] > maxSimpleAc + 0.08) {
          finalMeterScore *= 1.16;
        }
      }

      if (gridMode === 'subdivision2x' || pulseIOI < 0.35) {
        finalMeterScore *= meter === '5/8' ? 1.18 : 0.85;
      } else {
        finalMeterScore *= meter === '5/4' ? 1.18 : 0.85;
      }
    } else if (meter === '7/4' || meter === '7/8') {
      if (autocorr[7] < 0.18 || bestContrastForMeter < 1.22) {
        finalMeterScore *= 0.65;
      } else {
        const maxSimpleAc = Math.max(autocorr[2], autocorr[3], autocorr[4], autocorr[6]);
        if (autocorr[7] >= 0.30 && autocorr[7] > maxSimpleAc + 0.08) {
          finalMeterScore *= 1.16;
        }
      }

      if (gridMode === 'subdivision2x' || pulseIOI < 0.36) {
        finalMeterScore *= meter === '7/8' ? 1.20 : 0.82;
      } else if (pulseIOI >= 0.40) {
        finalMeterScore *= meter === '7/4' ? 1.20 : 0.82;
      } else {
        const isEighthStyleGrouping =
          bestGroupingForMeter === '2+2+3' ||
          bestGroupingForMeter === '3+2+2' ||
          bestGroupingForMeter === '2+3+2';
        if (meter === '7/8') {
          finalMeterScore *= isEighthStyleGrouping ? 1.08 : 0.94;
        } else {
          finalMeterScore *= isEighthStyleGrouping ? 0.94 : 1.08;
        }
      }
    }

    candidatesScores[meter] = finalMeterScore;
    bestPhases[meter] = bestPhaseForMeter;
    bestGroupings[meter] = bestGroupingForMeter;
  }

  let bestMeter: TimeSignature = candidateMeters.includes('4/4') ? '4/4' : candidateMeters[0];
  let highestScore = -Infinity;

  for (const meter of candidateMeters) {
    if (candidatesScores[meter] > highestScore) {
      highestScore = candidatesScores[meter];
      bestMeter = meter;
    }
  }

  const bestK = getMeterBeatCount(bestMeter);
  return {
    bestMeter,
    bestScore: highestScore,
    bestPhase: bestPhases[bestMeter],
    bestGrouping: bestGroupings[bestMeter],
    bestAutocorr: Math.max(0, autocorr[bestK] || 0),
    candidatesScores,
    bestPhases,
    bestGroupings,
    autocorr,
    isFlat
  };
}

/**
 * Builds a 2x eighth-note subdivision grid by inserting midpoints between consecutive beats.
 */
export function buildSubdivisionGrid2x(beats: number[]): number[] {
  if (!beats || beats.length < 2) return beats || [];
  const subBeats: number[] = [];
  for (let i = 0; i < beats.length - 1; i++) {
    subBeats.push(beats[i]);
    subBeats.push((beats[i] + beats[i + 1]) / 2);
  }
  subBeats.push(beats[beats.length - 1]);
  return subBeats;
}

/**
 * Builds a 3x triplet eighth-note subdivision grid by inserting 1/3 and 2/3 points between beats.
 */
export function buildSubdivisionGrid3x(beats: number[]): number[] {
  if (!beats || beats.length < 2) return beats || [];
  const subBeats: number[] = [];
  for (let i = 0; i < beats.length - 1; i++) {
    const dt = beats[i + 1] - beats[i];
    subBeats.push(beats[i]);
    subBeats.push(beats[i] + dt / 3);
    subBeats.push(beats[i] + (2 * dt) / 3);
  }
  subBeats.push(beats[beats.length - 1]);
  return subBeats;
}

/**
 * Estimates the musical meter from pre-calculated beats and acoustic signals.
 */
export function estimateMeter(options: MeterEstimationOptions): MeterAnalysis {
  const { beats, onsets = [], chords = [] } = options;

  // Edge case: not enough beats
  if (!beats || beats.length < 4) {
    return {
      meter: '4/4',
      confidence: 0.5,
      downbeats: beats || []
    };
  }

  // Extract channelData once so subdivision passes don't re-extract from AudioBuffer
  let channelData = options.channelData;
  let sampleRate = options.sampleRate || 44100;
  if (!channelData && options.audioBuffer) {
    channelData = extractMonoChannelData(options.audioBuffer);
    sampleRate = options.audioBuffer.sampleRate;
  }
  const sharedOptions: MeterEstimationOptions = {
    ...options,
    channelData,
    sampleRate
  };

  const beatIOI = computeMedianBeatInterval(beats, options.bpm);
  const saliences1x = computeBeatSaliences(sharedOptions);

  const primaryEval = evaluateGrid(
    beats,
    saliences1x,
    ALL_TIME_SIGNATURES,
    beatIOI,
    'beat'
  );

  // Guard: if acoustic salience is completely flat across beats, safely return 4/4
  if (primaryEval.isFlat) {
    const downbeats: number[] = [];
    for (let i = 0; i < beats.length; i += 4) {
      downbeats.push(beats[i]);
    }
    return {
      meter: '4/4',
      confidence: 0.5,
      downbeats,
      phase: 0,
      barCount: downbeats.length,
      grouping: '4',
      gridMode: 'beat',
      candidates: primaryEval.candidatesScores
    };
  }

  let winningEval = primaryEval;
  let winningBeats = beats;
  let winningGridMode: 'beat' | 'subdivision2x' | 'subdivision3x' = 'beat';

  const hasSubdivisionEvidence =
    Boolean(channelData && channelData.length > 0) ||
    onsets.length >= 4 ||
    chords.length >= 2;

  // 2x Eighth-note subdivision check:
  // Catches half-integer odd bars like 7/8 (3.5 quarter notes), 5/8 (2.5 quarter notes),
  // and 9/8 aksak (4.5 quarter notes) when the beat tracker locked onto quarter notes.
  if (hasSubdivisionEvidence && beats.length >= 6 && beatIOI >= 0.34) {
    const subBeats2x = buildSubdivisionGrid2x(beats);
    const subSaliences2x = computeBeatSaliences({
      ...sharedOptions,
      beats: subBeats2x
    });

    // Evaluate irregular eighth-note meters that cannot fit as integer multiples of quarter beats
    const oddEighthCandidates: TimeSignature[] = ['5/8', '7/8', '9/8'];
    const subEval2x = evaluateGrid(
      subBeats2x,
      subSaliences2x,
      oddEighthCandidates,
      beatIOI / 2,
      'subdivision2x'
    );

    const bestSubMeter = subEval2x.bestMeter;
    const subK = getMeterBeatCount(bestSubMeter);
    const subPhase = subEval2x.bestPhase;

    // Verify genuine half-beat downbeats (odd indices in subBeats2x) exist
    let evenDbSum = 0;
    let evenDbCount = 0;
    let oddDbSum = 0;
    let oddDbCount = 0;
    let nonDbSum = 0;
    let nonDbCount = 0;

    for (let i = subPhase; i < subSaliences2x.length; i++) {
      const slot = (i - subPhase) % subK;
      if (slot === 0) {
        if (i % 2 === 0) {
          evenDbSum += subSaliences2x[i];
          evenDbCount++;
        } else {
          oddDbSum += subSaliences2x[i];
          oddDbCount++;
        }
      } else {
        nonDbSum += subSaliences2x[i];
        nonDbCount++;
      }
    }

    const evenDbMean = evenDbCount > 0 ? evenDbSum / evenDbCount : 0;
    const oddDbMean = oddDbCount > 0 ? oddDbSum / oddDbCount : 0;
    const nonDbMean = nonDbCount > 0 ? nonDbSum / nonDbCount : 0.2;

    const hasStrongOffbeatDownbeats =
      oddDbCount >= 1 &&
      oddDbMean > nonDbMean * 1.25 &&
      oddDbMean >= evenDbMean * 0.50;

    // Also allow if 2x periodicity clearly outperforms 1x (e.g. primary 1x periodicity broke on odd bars)
    const beatsPrimaryCleanly =
      subEval2x.bestAutocorr >= 0.30 &&
      hasStrongOffbeatDownbeats &&
      (subEval2x.bestScore > primaryEval.bestScore * 0.94 ||
        (primaryEval.bestAutocorr < 0.35 && subEval2x.bestAutocorr > primaryEval.bestAutocorr + 0.15));

    if (beatsPrimaryCleanly && !subEval2x.isFlat) {
      // Merge 2x scores into candidates map for visibility
      const mergedCandidates = { ...primaryEval.candidatesScores };
      for (const m of oddEighthCandidates) {
        mergedCandidates[m] = Math.max(mergedCandidates[m], subEval2x.candidatesScores[m]);
      }
      winningEval = {
        ...subEval2x,
        candidatesScores: mergedCandidates
      };
      winningBeats = subBeats2x;
      winningGridMode = 'subdivision2x';
    }
  }

  // 3x Triplet eighth-note subdivision check:
  // Catches compound meters (6/8, 9/8, 12/8) when the beat tracker locked onto dotted-quarter beats.
  if (
    winningGridMode === 'beat' &&
    hasSubdivisionEvidence &&
    beats.length >= 6 &&
    beatIOI >= 0.48 &&
    (primaryEval.bestMeter === '2/4' ||
      primaryEval.bestMeter === '3/4' ||
      primaryEval.bestMeter === '4/4')
  ) {
    const tripletPoints: number[] = [];
    const dupleOffbeats: number[] = [];
    for (let i = 0; i < beats.length - 1; i++) {
      const dt = beats[i + 1] - beats[i];
      tripletPoints.push(beats[i] + dt / 3, beats[i] + (2 * dt) / 3);
      dupleOffbeats.push(beats[i] + dt / 2);
    }

    const tripletSaliences = computeBeatSaliences({
      ...sharedOptions,
      beats: tripletPoints
    });
    const dupleSaliences = computeBeatSaliences({
      ...sharedOptions,
      beats: dupleOffbeats
    });

    // Compare un-normalized or local acoustic energy ratios directly via channelData / onsets
    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // Note: computeBeatSaliences normalizes each call independently to [0.1, 1.0].
    // Measure raw triplet vs duple energy + onset hits to prevent independent normalization bias.
    let tripletRaw = 0;
    let dupleRaw = 0;
    let beatRaw = 0;

    if (channelData && channelData.length > 0) {
      beatRaw = avg(beats.map(t => getLocalBeatEnergy(t, channelData!, sampleRate).energy));
      tripletRaw = avg(tripletPoints.map(t => getLocalBeatEnergy(t, channelData!, sampleRate).energy));
      dupleRaw = avg(dupleOffbeats.map(t => getLocalBeatEnergy(t, channelData!, sampleRate).energy));
    } else if (onsets.length >= 4) {
      const countNear = (pts: number[]) =>
        pts.filter(p => onsets.some(o => Math.abs(o - p) <= 0.04)).length / Math.max(1, pts.length);
      beatRaw = countNear(beats);
      tripletRaw = countNear(tripletPoints);
      dupleRaw = countNear(dupleOffbeats);
    }

    // Silence-safe guard: only activate 3x if triplet offbeats actually have meaningful energy
    const hasTripletFeel =
      beatRaw > 0 &&
      tripletRaw > beatRaw * 0.25 &&
      tripletRaw > dupleRaw * 1.18 &&
      avg(tripletSaliences) >= avg(dupleSaliences) * 0.85;

    if (hasTripletFeel) {
      const subBeats3x = buildSubdivisionGrid3x(beats);
      const subSaliences3x = computeBeatSaliences({
        ...sharedOptions,
        beats: subBeats3x
      });
      const compoundCandidates: TimeSignature[] = ['6/8', '9/8', '12/8'];
      const subEval3x = evaluateGrid(
        subBeats3x,
        subSaliences3x,
        compoundCandidates,
        beatIOI / 3,
        'subdivision3x'
      );

      if (!subEval3x.isFlat && subEval3x.bestAutocorr >= 0.25) {
        const mergedCandidates = { ...primaryEval.candidatesScores };
        for (const m of compoundCandidates) {
          mergedCandidates[m] = Math.max(mergedCandidates[m], subEval3x.candidatesScores[m]);
        }
        winningEval = {
          ...subEval3x,
          candidatesScores: mergedCandidates
        };
        winningBeats = subBeats3x;
        winningGridMode = 'subdivision3x';
      }
    }
  }

  const bestMeter = winningEval.bestMeter;
  const bestPhase = winningEval.bestPhase;
  const K = getMeterBeatCount(bestMeter);

  const downbeats: number[] = [];
  for (let i = bestPhase; i < winningBeats.length; i += K) {
    downbeats.push(winningBeats[i]);
  }

  // Calculate confidence from relative score margin
  const sortedScores = Object.values(winningEval.candidatesScores).sort((a, b) => b - a);
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
    grouping: winningEval.bestGrouping,
    gridMode: winningGridMode,
    candidates: winningEval.candidatesScores
  };
}

/**
 * Recalculates downbeats when the user manually changes or overrides the meter.
 */
export function recalculateDownbeats(
  beats: number[],
  meter: TimeSignature,
  phase: number = 0,
  options?: { gridMode?: 'beat' | 'subdivision2x' | 'subdivision3x' }
): number[] {
  if (!beats || beats.length === 0) return [];
  let effectiveBeats = beats;
  if (options?.gridMode === 'subdivision2x') {
    effectiveBeats = buildSubdivisionGrid2x(beats);
  } else if (options?.gridMode === 'subdivision3x') {
    effectiveBeats = buildSubdivisionGrid3x(beats);
  }

  const K = getMeterBeatCount(meter);
  const effectivePhase = Math.max(0, Math.min(K - 1, phase));

  const downbeats: number[] = [];
  for (let i = effectivePhase; i < effectiveBeats.length; i += K) {
    downbeats.push(effectiveBeats[i]);
  }
  return downbeats;
}
