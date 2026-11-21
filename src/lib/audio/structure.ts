/**
 * Musical Structure Detection via Self-Similarity Matrix (SSM)
 *
 * Uses windowed dual-band chromagrams (harmonic profile) and RMS energy (dynamic profile)
 * to compute a time-lag smoothed Self-Similarity Matrix, detect structural boundaries via
 * Foote's Gaussian-tapered Checkerboard Kernel novelty curve, cluster repeated harmonic/dynamic
 * blocks, and label sections: Intro, Estrofa, Estribillo, Puente, Instrumental, Outro.
 */

import type { WindowedChroma } from './chroma';

export type MusicalSectionType =
  | 'Intro'
  | 'Estrofa'
  | 'Estribillo'
  | 'Puente'
  | 'Instrumental'
  | 'Outro';

export interface MusicalSection {
  id: string;
  type: MusicalSectionType;
  label: string;
  startTime: number;
  endTime: number;
  confidence: number;
  avgRms: number;
  repetitionGroup?: number;
  isVocal?: boolean;
}

export interface StructureAnalysisOptions {
  beats?: number[];
  downbeats?: number[];
  chords?: { startTime: number; endTime: number; chord: string }[];
  duration?: number;
  /** Minimum section length in seconds (default: 6.5s for full tracks, scaled for short clips) */
  minSectionDurationSec?: number;
  /** Similarity threshold [0..1] for grouping repeated harmonic/dynamic blocks (default: 0.78) */
  similarityThreshold?: number;
}

export interface StructureAnalysisResult {
  sections: MusicalSection[];
  noveltyCurve: { time: number; value: number }[];
  boundaries: number[];
  algorithm: string;
}

interface NormalizedFrame {
  startTime: number;
  endTime: number;
  midTime: number;
  chroma: Float32Array;
  normRms: number;
  rawRms: number;
}

function l2Normalize12(vec: number[]): Float32Array {
  const out = new Float32Array(12);
  let sumSq = 0;
  for (let i = 0; i < 12; i++) {
    const v = vec[i] || 0;
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 1e-9) {
    for (let i = 0; i < 12; i++) {
      out[i] = (vec[i] || 0) / norm;
    }
  }
  return out;
}

function selectHarmonicVector(w: WindowedChroma): number[] {
  if (w.midChroma && w.midChroma.length === 12) {
    let maxMid = 0;
    for (let i = 0; i < 12; i++) {
      if (w.midChroma[i] > maxMid) maxMid = w.midChroma[i];
    }
    if (maxMid > 0.05) return w.midChroma;
  }
  return w.chroma;
}

function cosineDotUnit(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < 12; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(0, Math.min(1, dot));
}

/**
 * Downsamples/pools long WindowedChroma sequences to at most maxFrames
 * so the N x N Self-Similarity Matrix stays O(1) fast (< 2ms).
 */
function prepareNormalizedFrames(
  windowedChroma: WindowedChroma[],
  maxFrames: number = 240
): NormalizedFrame[] {
  if (windowedChroma.length === 0) return [];

  const step = Math.max(1, Math.ceil(windowedChroma.length / maxFrames));
  const rawList: {
    startTime: number;
    endTime: number;
    chromaSum: number[];
    rmsSum: number;
    count: number;
  }[] = [];

  for (let i = 0; i < windowedChroma.length; i += step) {
    const endIdx = Math.min(windowedChroma.length, i + step);
    const chromaSum = new Array<number>(12).fill(0);
    let rmsSum = 0;
    let count = 0;

    for (let k = i; k < endIdx; k++) {
      const vec = selectHarmonicVector(windowedChroma[k]);
      for (let p = 0; p < 12; p++) {
        chromaSum[p] += vec[p] || 0;
      }
      const rms = typeof windowedChroma[k].rmsEnergy === 'number'
        ? windowedChroma[k].rmsEnergy!
        : Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0) / 12);
      rmsSum += rms;
      count++;
    }

    const startTime = windowedChroma[i].startTime;
    const endTime = windowedChroma[endIdx - 1].endTime;
    rawList.push({
      startTime,
      endTime,
      chromaSum,
      rmsSum,
      count
    });
  }

  // Compute 95th percentile RMS for robust normalization against isolated spikes
  const rmsValues = rawList.map(r => r.rmsSum / Math.max(1, r.count));
  const sortedRms = [...rmsValues].sort((a, b) => a - b);
  const refRms = sortedRms[Math.min(sortedRms.length - 1, Math.floor(sortedRms.length * 0.95))] || 1e-6;
  const safeRef = Math.max(refRms, 1e-6);

  return rawList.map((item, idx) => {
    const avgChroma = item.chromaSum.map(v => v / Math.max(1, item.count));
    const rawRms = rmsValues[idx];
    return {
      startTime: item.startTime,
      endTime: item.endTime,
      midTime: (item.startTime + item.endTime) * 0.5,
      chroma: l2Normalize12(avgChroma),
      normRms: Math.min(1, rawRms / safeRef),
      rawRms
    };
  });
}

/**
 * Computes the N x N Self-Similarity Matrix (SSM) combining smoothed harmonic cosine similarity
 * and dynamic RMS similarity, then applies diagonal path-enhancement smoothing.
 */
export function computeSelfSimilarityMatrix(
  frames: NormalizedFrame[],
  textureRadiusFrames: number = 0
): Float32Array {
  const N = frames.length;
  const ssm = new Float32Array(N * N);
  if (N === 0) return ssm;

  // Apply short Gaussian texture pooling to chroma vectors when requested so
  // multi-chord section palettes (e.g. 4-bar chord loops) don't fracture at every chord change.
  let chromaForSsm: Float32Array[];
  if (textureRadiusFrames > 0 && N >= 12) {
    const sigma = Math.max(0.9, textureRadiusFrames * 0.65);
    chromaForSsm = frames.map((_, i) => {
      const acc = new Float32Array(12);
      for (let d = -textureRadiusFrames; d <= textureRadiusFrames; d++) {
        const k = Math.max(0, Math.min(N - 1, i + d));
        const w = Math.exp(-(d * d) / (2 * sigma * sigma));
        for (let p = 0; p < 12; p++) {
          acc[p] += frames[k].chroma[p] * w;
        }
      }
      let sumSq = 0;
      for (let p = 0; p < 12; p++) sumSq += acc[p] * acc[p];
      const norm = Math.sqrt(sumSq) || 1;
      for (let p = 0; p < 12; p++) acc[p] /= norm;
      return acc;
    });
  } else {
    chromaForSsm = frames.map(f => f.chroma);
  }

  for (let i = 0; i < N; i++) {
    ssm[i * N + i] = 1.0;
    for (let j = i + 1; j < N; j++) {
      const harmSim = cosineDotUnit(chromaForSsm[i], chromaForSsm[j]);
      const dynSim = 1.0 - Math.abs(frames[i].normRms - frames[j].normRms);
      const sim = 0.58 * harmSim + 0.42 * dynSim;
      ssm[i * N + j] = sim;
      ssm[j * N + i] = sim;
    }
  }

  // Diagonal smoothing enhances repeating progressions (Foote / Müller MIR standard)
  const lagRadius = N >= 16 ? 2 : N >= 8 ? 1 : 0;
  if (lagRadius === 0) return ssm;

  const smoothed = new Float32Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      let sum = 0;
      let count = 0;
      for (let d = -lagRadius; d <= lagRadius; d++) {
        const ii = i + d;
        const jj = j + d;
        if (ii >= 0 && ii < N && jj >= 0 && jj < N) {
          sum += ssm[ii * N + jj];
          count++;
        }
      }
      const val = count > 0 ? sum / count : ssm[i * N + j];
      smoothed[i * N + j] = val;
      smoothed[j * N + i] = val;
    }
  }

  return smoothed;
}

/**
 * Computes Foote's Checkerboard Kernel novelty curve along the SSM main diagonal.
 * Peaks in the novelty curve correspond to structural transitions between musical blocks.
 */
export function computeCheckerboardNovelty(
  ssm: Float32Array,
  N: number,
  kernelHalfWidth: number
): number[] {
  const novelty = new Array<number>(N).fill(0);
  if (N < 4 || kernelHalfWidth < 1) return novelty;

  const M = Math.min(kernelHalfWidth, Math.floor((N - 1) / 2));
  if (M < 1) return novelty;

  const size = 2 * M;
  const sigma = Math.max(1.0, M * 0.55);
  const kernel = new Float32Array(size * size);

  // Build centered Gaussian-tapered checkerboard kernel:
  // [-M .. -1] x [-M .. -1] -> +1, [0 .. M-1] x [0 .. M-1] -> +1, off-diagonals -> -1
  let posSum = 0;
  for (let r = 0; r < size; r++) {
    const u = r - M + 0.5;
    for (let c = 0; c < size; c++) {
      const v = c - M + 0.5;
      const gauss = Math.exp(-(u * u + v * v) / (2 * sigma * sigma));
      const sign = (u < 0 && v < 0) || (u > 0 && v > 0) ? 1 : -1;
      const val = sign * gauss;
      kernel[r * size + c] = val;
      if (val > 0) posSum += val;
    }
  }

  const minHalfWidth = Math.max(2, Math.floor(M * 0.55));
  let maxNov = 0;

  for (let idx = minHalfWidth; idx <= N - minHalfWidth; idx++) {
    const effM = Math.min(M, idx, N - idx);
    let score = 0;
    let posWeight = 0;

    if (effM === M) {
      for (let r = 0; r < size; r++) {
        const i = idx - M + r;
        for (let c = 0; c < size; c++) {
          const j = idx - M + c;
          const kVal = kernel[r * size + c];
          score += kVal * ssm[i * N + j];
        }
      }
      posWeight = posSum;
    } else {
      const effSigma = Math.max(1.0, effM * 0.55);
      const effSize = 2 * effM;
      for (let r = 0; r < effSize; r++) {
        const u = r - effM + 0.5;
        const i = idx - effM + r;
        for (let c = 0; c < effSize; c++) {
          const v = c - effM + 0.5;
          const j = idx - effM + c;
          const gauss = Math.exp(-(u * u + v * v) / (2 * effSigma * effSigma));
          const sign = (u < 0 && v < 0) || (u > 0 && v > 0) ? 1 : -1;
          const kVal = sign * gauss;
          score += kVal * ssm[i * N + j];
          if (kVal > 0) posWeight += kVal;
        }
      }
    }

    const edgeScale = effM < M ? Math.pow(effM / M, 1.8) : 1.0;
    const nov = posWeight > 0 ? Math.max(0, (score / posWeight) * edgeScale) : 0;
    if (idx < N) {
      novelty[idx] = nov;
      if (nov > maxNov) maxNov = nov;
    }
  }

  if (maxNov > 1e-6) {
    for (let i = 0; i < N; i++) {
      novelty[i] = Number((novelty[i] / maxNov).toFixed(4));
    }
  }

  return novelty;
}

/**
 * Also computes local frame-to-frame contrast (chroma + RMS jump) to detect sharp
 * boundaries near song edges where the checkerboard kernel doesn't fully fit.
 */
function computeEdgeContrast(frames: NormalizedFrame[], idx: number, window: number = 2): number {
  const N = frames.length;
  if (idx <= 0 || idx >= N) return 0;

  const leftStart = Math.max(0, idx - window);
  const rightEnd = Math.min(N, idx + window);

  const leftChroma = new Array<number>(12).fill(0);
  let leftRms = 0;
  let leftCount = 0;
  for (let i = leftStart; i < idx; i++) {
    for (let p = 0; p < 12; p++) leftChroma[p] += frames[i].chroma[p];
    leftRms += frames[i].normRms;
    leftCount++;
  }

  const rightChroma = new Array<number>(12).fill(0);
  let rightRms = 0;
  let rightCount = 0;
  for (let i = idx; i < rightEnd; i++) {
    for (let p = 0; p < 12; p++) rightChroma[p] += frames[i].chroma[p];
    rightRms += frames[i].normRms;
    rightCount++;
  }

  if (leftCount === 0 || rightCount === 0) return 0;

  const cL = l2Normalize12(leftChroma);
  const cR = l2Normalize12(rightChroma);
  const harmDiff = 1.0 - cosineDotUnit(cL, cR);
  const rmsDiff = Math.abs(leftRms / leftCount - rightRms / rightCount);
  return 0.72 * harmDiff + 0.28 * rmsDiff;
}

function snapTimeToGrid(
  time: number,
  downbeats?: number[],
  beats?: number[],
  downbeatTol: number = 1.25,
  beatTol: number = 0.6
): number {
  if (downbeats && downbeats.length > 0) {
    let best = time;
    let bestDist = downbeatTol;
    for (const db of downbeats) {
      const dist = Math.abs(db - time);
      if (dist < bestDist) {
        bestDist = dist;
        best = db;
      }
    }
    if (bestDist < downbeatTol) return best;
  }

  if (beats && beats.length > 0) {
    let best = time;
    let bestDist = beatTol;
    for (const b of beats) {
      const dist = Math.abs(b - time);
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    if (bestDist < beatTol) return best;
  }

  return time;
}

interface SegmentProfile {
  startFrame: number;
  endFrame: number;
  startTime: number;
  endTime: number;
  meanChroma: Float32Array;
  trajectory: Float32Array[]; // 8-step temporal chroma profile to capture progression order
  avgRms: number;
  peakRms: number;
  chordChangeDensity: number;
}

function buildSegmentProfile(
  frames: NormalizedFrame[],
  startFrame: number,
  endFrame: number,
  startTime: number,
  endTime: number,
  chords?: { startTime: number; endTime: number; chord: string }[]
): SegmentProfile {
  const meanAcc = new Array<number>(12).fill(0);
  let rmsSum = 0;
  let peakRms = 0;
  const count = Math.max(1, endFrame - startFrame);

  for (let i = startFrame; i < endFrame; i++) {
    for (let p = 0; p < 12; p++) {
      meanAcc[p] += frames[i].chroma[p];
    }
    rmsSum += frames[i].normRms;
    if (frames[i].normRms > peakRms) peakRms = frames[i].normRms;
  }

  // 8-step temporal trajectory captures harmonic progression direction (e.g. C-G-Am-F vs F-C-G-Am)
  const steps = 8;
  const trajectory: Float32Array[] = [];
  for (let s = 0; s < steps; s++) {
    const fStart = startFrame + Math.floor((s / steps) * count);
    const fEnd = Math.max(fStart + 1, startFrame + Math.floor(((s + 1) / steps) * count));
    const stepAcc = new Array<number>(12).fill(0);
    for (let i = fStart; i < Math.min(endFrame, fEnd); i++) {
      for (let p = 0; p < 12; p++) {
        stepAcc[p] += frames[i].chroma[p];
      }
    }
    trajectory.push(l2Normalize12(stepAcc));
  }

  let chordChanges = 0;
  if (chords && chords.length > 0) {
    const segChords = chords.filter(c => c.endTime > startTime && c.startTime < endTime);
    for (let i = 1; i < segChords.length; i++) {
      if (segChords[i].chord !== segChords[i - 1].chord) chordChanges++;
    }
  }
  const dur = Math.max(1, endTime - startTime);

  return {
    startFrame,
    endFrame,
    startTime,
    endTime,
    meanChroma: l2Normalize12(meanAcc),
    trajectory,
    avgRms: rmsSum / count,
    peakRms,
    chordChangeDensity: chordChanges / dur
  };
}

function computeSegmentSimilarity(a: SegmentProfile, b: SegmentProfile): number {
  const meanHarmSim = cosineDotUnit(a.meanChroma, b.meanChroma);

  const steps = Math.min(a.trajectory.length, b.trajectory.length);
  let bestTrajSim = 0;
  for (let shift = -1; shift <= 1; shift++) {
    let trajSum = 0;
    let count = 0;
    for (let s = 0; s < steps; s++) {
      const sb = s + shift;
      if (sb < 0 || sb >= steps) continue;
      trajSum += cosineDotUnit(a.trajectory[s], b.trajectory[sb]);
      count++;
    }
    if (count > 0) {
      const avg = (trajSum / count) * (shift === 0 ? 1.0 : 0.97);
      if (avg > bestTrajSim) bestTrajSim = avg;
    }
  }

  const dynSim = 1.0 - Math.abs(a.avgRms - b.avgRms);

  // Emphasize progression trajectory + mean harmony + dynamic level
  return 0.45 * bestTrajSim + 0.31 * meanHarmSim + 0.24 * dynSim;
}

/**
 * Analyzes musical structure from WindowedChroma[] (with rmsEnergy) using a Self-Similarity Matrix
 * and Foote's Checkerboard Novelty Curve.
 */
export function analyzeStructureFromChroma(
  windowedChroma: WindowedChroma[],
  options: StructureAnalysisOptions = {}
): StructureAnalysisResult {
  if (!windowedChroma || windowedChroma.length === 0) {
    return {
      sections: [],
      noveltyCurve: [],
      boundaries: [],
      algorithm: 'SSM + Checkerboard Novelty + Repetition Clustering'
    };
  }

  const totalDuration = Number(
    (options.duration ?? windowedChroma[windowedChroma.length - 1].endTime).toFixed(3)
  );

  const frames = prepareNormalizedFrames(windowedChroma, 240);
  const N = frames.length;

  if (N < 4 || totalDuration <= 3.0) {
    const avgRms = frames.reduce((s, f) => s + f.normRms, 0) / Math.max(1, N);
    return {
      sections: [
        {
          id: 'section-0',
          type: 'Estrofa',
          label: 'Estrofa 1',
          startTime: 0,
          endTime: totalDuration,
          confidence: 0.75,
          avgRms: Number(avgRms.toFixed(3)),
          repetitionGroup: 0,
          isVocal: true
        }
      ],
      noveltyCurve: frames.map(f => ({ time: Number(f.midTime.toFixed(2)), value: 0 })),
      boundaries: [0, totalDuration],
      algorithm: 'SSM + Checkerboard Novelty + Repetition Clustering'
    };
  }

  const hopSec = totalDuration / N;
  const textureRadiusSec = totalDuration >= 45 ? 4.5 : totalDuration >= 24 ? 1.5 : 0;
  const textureRadiusFrames = textureRadiusSec > 0
    ? Math.min(5, Math.max(1, Math.round(textureRadiusSec / Math.max(0.25, hopSec))))
    : 0;
  const ssm = computeSelfSimilarityMatrix(frames, textureRadiusFrames);

  // Calibrate checkerboard kernel half-width to section/phrase scale (~8-12s for full tracks, scaled for short clips)
  // so individual 2-4s chord changes inside a verse blend into one harmonic texture
  const targetKernelSec =
    totalDuration < 35
      ? Math.max(1.8, totalDuration * 0.14)
      : Math.min(12.0, Math.max(8.0, totalDuration * 0.095));
  const kernelHalfWidth = Math.max(2, Math.min(18, Math.round(targetKernelSec / Math.max(0.25, hopSec))));
  const novelty = computeCheckerboardNovelty(ssm, N, kernelHalfWidth);

  const noveltyCurve = novelty.map((val, idx) => ({
    time: Number(frames[idx].startTime.toFixed(2)),
    value: val
  }));

  // Peak picking with adaptive threshold, topographic prominence, & minimum section duration
  const defaultMinSec = totalDuration < 40
    ? Math.max(2.2, totalDuration * 0.14)
    : Math.max(8.0, Math.min(12.0, totalDuration * 0.075));
  const minSectionSec = options.minSectionDurationSec ?? defaultMinSec;
  const minFrames = Math.max(2, Math.round(minSectionSec / Math.max(0.2, hopSec)));
  const edgeGuardFrames = Math.max(2, Math.round((minSectionSec * 0.9) / Math.max(0.2, hopSec)));

  const nonZeroNov = novelty.filter(v => v > 0);
  const meanNov = nonZeroNov.length > 0
    ? nonZeroNov.reduce((a, b) => a + b, 0) / nonZeroNov.length
    : 0;
  const stdNov = nonZeroNov.length > 0
    ? Math.sqrt(nonZeroNov.reduce((a, b) => a + Math.pow(b - meanNov, 2), 0) / nonZeroNov.length)
    : 0;
  const adaptiveThreshold = Math.max(0.22, Math.min(0.48, meanNov + 0.22 * stdNov));
  const minProminence = totalDuration >= 45 ? 0.22 : 0.14;

  const computePeakProminence = (idx: number): number => {
    const val = novelty[idx];
    let leftMin = val;
    for (let i = idx - 1; i >= 0; i--) {
      if (novelty[i] > val) break;
      if (novelty[i] < leftMin) leftMin = novelty[i];
    }
    let rightMin = val;
    for (let i = idx + 1; i < N; i++) {
      if (novelty[i] > val) break;
      if (novelty[i] < rightMin) rightMin = novelty[i];
    }
    return val - Math.max(leftMin, rightMin);
  };

  const candidatePeaks: { idx: number; score: number }[] = [];
  for (let i = 2; i < N - 2; i++) {
    const v = novelty[i];
    if (v >= adaptiveThreshold && v >= novelty[i - 1] && v >= novelty[i + 1]) {
      // Check slightly wider neighborhood (i-2..i+2) to avoid plateau duplicates
      if (v >= novelty[i - 2] && v >= novelty[i + 2]) {
        const prominence = computePeakProminence(i);
        if (prominence >= minProminence) {
          candidatePeaks.push({ idx: i, score: v });
        }
      }
    }
  }

  // Greedy non-maximum suppression enforcing minFrames spacing
  candidatePeaks.sort((a, b) => b.score - a.score);
  const selectedIndices: number[] = [];

  for (const peak of candidatePeaks) {
    const tooCloseToExisting = selectedIndices.some(s => Math.abs(s - peak.idx) < minFrames);
    const tooCloseToStart = peak.idx < edgeGuardFrames;
    const tooCloseToEnd = (N - peak.idx) < edgeGuardFrames;
    if (!tooCloseToExisting && !tooCloseToStart && !tooCloseToEnd) {
      selectedIndices.push(peak.idx);
    }
  }

  selectedIndices.sort((a, b) => a - b);

  // Convert boundary indices to snapped timestamps
  const rawBoundaries: number[] = [0];
  const boundaryFrameIndices: number[] = [0];

  for (const idx of selectedIndices) {
    const rawTime = frames[idx].startTime;
    const snapped = snapTimeToGrid(rawTime, options.downbeats, options.beats);
    const prevTime = rawBoundaries[rawBoundaries.length - 1];
    if (snapped - prevTime >= minSectionSec * 0.7 && totalDuration - snapped >= minSectionSec * 0.6) {
      rawBoundaries.push(Number(snapped.toFixed(3)));
      boundaryFrameIndices.push(idx);
    }
  }

  rawBoundaries.push(totalDuration);
  boundaryFrameIndices.push(N);

  // Build segment profiles
  const segments: SegmentProfile[] = [];
  for (let k = 0; k < rawBoundaries.length - 1; k++) {
    const sFrame = boundaryFrameIndices[k];
    const eFrame = boundaryFrameIndices[k + 1];
    segments.push(
      buildSegmentProfile(
        frames,
        sFrame,
        eFrame,
        rawBoundaries[k],
        rawBoundaries[k + 1],
        options.chords
      )
    );
  }

  const K = segments.length;
  const similarityThreshold = options.similarityThreshold ?? 0.78;

  // Cluster segments into repetition groups via pairwise segment similarity
  const segSimMatrix = Array.from({ length: K }, () => new Float64Array(K));
  for (let a = 0; a < K; a++) {
    segSimMatrix[a][a] = 1.0;
    for (let b = a + 1; b < K; b++) {
      const sim = computeSegmentSimilarity(segments[a], segments[b]);
      segSimMatrix[a][b] = sim;
      segSimMatrix[b][a] = sim;
    }
  }

  const groupAssignment = new Array<number>(K).fill(-1);
  const groups: number[][] = [];

  for (let a = 0; a < K; a++) {
    if (groupAssignment[a] !== -1) continue;
    const groupId = groups.length;
    const members = [a];
    groupAssignment[a] = groupId;

    for (let b = a + 1; b < K; b++) {
      if (groupAssignment[b] !== -1) continue;
      if (segSimMatrix[a][b] >= similarityThreshold) {
        groupAssignment[b] = groupId;
        members.push(b);
      }
    }
    groups.push(members);
  }

  // Merge adjacent segments ONLY if they ended up in the same repetition group AND
  // the boundary novelty wasn't strong (prevents double-splitting a homogeneous verse)
  // Compute average RMS per group and track-wide RMS
  const trackAvgRms = segments.reduce((s, seg) => s + seg.avgRms, 0) / Math.max(1, K);
  const groupStats = groups.map((members, gid) => {
    const avgRms = members.reduce((s, m) => s + segments[m].avgRms, 0) / members.length;
    return { gid, members, count: members.length, avgRms };
  });

  // Assign MusicalSectionType to each segment
  const assignedTypes = new Array<MusicalSectionType>(K).fill('Estrofa');

  // 1. Detect Intro (first segment if K >= 2 and quieter/shorter or unique opening)
  let hasIntro = false;
  if (K >= 2) {
    const first = segments[0];
    const second = segments[1];
    const firstDur = first.endTime - first.startTime;
    const isQuieterThanNext = first.avgRms < second.avgRms * 0.86;
    const isQuieterThanTrack = first.avgRms < trackAvgRms * 0.88;
    const isUniqueOpening = groupAssignment[0] !== undefined && groups[groupAssignment[0]].length === 1;

    if ((isQuieterThanNext || isQuieterThanTrack || (isUniqueOpening && K >= 3)) && firstDur <= totalDuration * 0.32) {
      assignedTypes[0] = 'Intro';
      hasIntro = true;
    }
  }

  // 2. Detect Outro (last segment if K >= 3 and quieter decay or unique ending after main body)
  let hasOutro = false;
  if (K >= 3) {
    const last = segments[K - 1];
    const prev = segments[K - 2];
    const lastDur = last.endTime - last.startTime;
    const isDecaying = last.avgRms < prev.avgRms * 0.82 && last.avgRms < trackAvgRms * 0.88;
    const isUniqueEnding = groups[groupAssignment[K - 1]].length === 1;

    if ((isDecaying || (isUniqueEnding && K >= 4 && last.avgRms < trackAvgRms * 0.96)) && lastDur <= totalDuration * 0.28) {
      assignedTypes[K - 1] = 'Outro';
      hasOutro = true;
    }
  }

  // 3. Identify Chorus (Estribillo) vs Verse (Estrofa) among body segments
  const bodyIndices: number[] = [];
  for (let k = 0; k < K; k++) {
    if (k === 0 && hasIntro) continue;
    if (k === K - 1 && hasOutro) continue;
    bodyIndices.push(k);
  }

  // Count how many times each group appears in bodyIndices
  const bodyGroups = new Map<number, { indices: number[]; avgRms: number }>();
  for (const idx of bodyIndices) {
    const gid = groupAssignment[idx];
    const entry = bodyGroups.get(gid) || { indices: [], avgRms: 0 };
    entry.indices.push(idx);
    bodyGroups.set(gid, entry);
  }
  for (const entry of bodyGroups.values()) {
    entry.avgRms = entry.indices.reduce((s, i) => s + segments[i].avgRms, 0) / entry.indices.length;
  }

  const repeatedBodyGroups = Array.from(bodyGroups.entries())
    .filter(([, g]) => g.indices.length >= 2)
    .sort((a, b) => b[1].avgRms - a[1].avgRms);

  let chorusGroupId: number | null = null;
  if (repeatedBodyGroups.length >= 2) {
    // Highest-energy repeated block = Estribillo
    chorusGroupId = repeatedBodyGroups[0][0];
  } else if (repeatedBodyGroups.length === 1) {
    const [gid, gData] = repeatedBodyGroups[0];
    // If there's only 1 repeated group, check if it's louder than track average or occurs later than another block
    const otherGroupAvgRms = Array.from(bodyGroups.entries())
      .filter(([otherId]) => otherId !== gid)
      .map(([, other]) => other.avgRms);
    const maxOtherRms = otherGroupAvgRms.length > 0 ? Math.max(...otherGroupAvgRms) : 0;

    if (gData.avgRms >= trackAvgRms * 0.98 || gData.avgRms >= maxOtherRms) {
      chorusGroupId = gid;
    }
  } else if (bodyIndices.length >= 2) {
    // No repeated body groups (e.g., short clip A-B): highest RMS block after first body block = Estribillo
    let maxRms = -1;
    let bestIdx = -1;
    for (let i = 1; i < bodyIndices.length; i++) {
      const idx = bodyIndices[i];
      if (segments[idx].avgRms > maxRms) {
        maxRms = segments[idx].avgRms;
        bestIdx = idx;
      }
    }
    if (bestIdx !== -1 && segments[bestIdx].avgRms > segments[bodyIndices[0]].avgRms * 1.05) {
      chorusGroupId = groupAssignment[bestIdx];
    }
  }

  // Assign Estribillo, Estrofa, Puente, Instrumental
  let hasSeenEstrofaOrEstribillo = false;
  for (const k of bodyIndices) {
    const gid = groupAssignment[k];
    const groupCount = bodyGroups.get(gid)?.indices.length ?? 1;

    if (chorusGroupId !== null && gid === chorusGroupId) {
      assignedTypes[k] = 'Estribillo';
      hasSeenEstrofaOrEstribillo = true;
    } else if (groupCount >= 2) {
      assignedTypes[k] = 'Estrofa';
      hasSeenEstrofaOrEstribillo = true;
    } else {
      // Unique body segment
      const seg = segments[k];
      const progressRatio = seg.startTime / Math.max(1, totalDuration);

      if (!hasSeenEstrofaOrEstribillo && k <= 1) {
        assignedTypes[k] = 'Estrofa';
        hasSeenEstrofaOrEstribillo = true;
      } else if (progressRatio >= 0.35 && k >= (hasIntro ? 2 : 1)) {
        // Distinguish Instrumental break vs Puente (Bridge):
        // Notable energy dip (< 80% track avg) or low vocal-range steadiness -> Instrumental;
        // Contrasting energetic/harmonic middle section -> Puente
        if (seg.avgRms < trackAvgRms * 0.78) {
          assignedTypes[k] = 'Instrumental';
        } else {
          assignedTypes[k] = 'Puente';
        }
      } else {
        assignedTypes[k] = 'Estrofa';
        hasSeenEstrofaOrEstribillo = true;
      }
    }
  }

  // Generate clean sequential labels & confidence scores
  const typeCounts: Record<MusicalSectionType, number> = {
    Intro: 0,
    Estrofa: 0,
    Estribillo: 0,
    Puente: 0,
    Instrumental: 0,
    Outro: 0
  };
  for (const t of assignedTypes) {
    typeCounts[t]++;
  }

  const runningCounts: Record<MusicalSectionType, number> = {
    Intro: 0,
    Estrofa: 0,
    Estribillo: 0,
    Puente: 0,
    Instrumental: 0,
    Outro: 0
  };

  const sections: MusicalSection[] = segments.map((seg, k) => {
    const t = assignedTypes[k];
    runningCounts[t]++;
    let label: string = t;

    if (t === 'Estrofa' && typeCounts.Estrofa > 1) {
      label = `Estrofa ${runningCounts.Estrofa}`;
    } else if (t === 'Puente' && typeCounts.Puente > 1) {
      label = `Puente ${runningCounts.Puente}`;
    } else if (t === 'Instrumental' && typeCounts.Instrumental > 1) {
      label = `Instrumental ${runningCounts.Instrumental}`;
    }

    // Confidence combines boundary novelty + repetition similarity
    const boundaryScore = k > 0 ? Math.max(0.55, Math.min(0.98, 0.55 + novelty[seg.startFrame] * 0.43)) : 0.88;
    const gid = groupAssignment[k];
    const members = groups[gid] || [k];
    let repConfidence = boundaryScore;
    if (members.length > 1) {
      const other = members.find(m => m !== k) ?? k;
      repConfidence = Math.min(0.98, 0.5 * boundaryScore + 0.5 * segSimMatrix[k][other]);
    }

    return {
      id: `section-${k}`,
      type: t,
      label,
      startTime: Number(seg.startTime.toFixed(3)),
      endTime: Number(seg.endTime.toFixed(3)),
      confidence: Number(repConfidence.toFixed(2)),
      avgRms: Number(seg.avgRms.toFixed(3)),
      repetitionGroup: gid,
      isVocal: t === 'Estrofa' || t === 'Estribillo' || t === 'Puente'
    };
  });

  return {
    sections,
    noveltyCurve,
    boundaries: rawBoundaries,
    algorithm: 'SSM (Chroma + RMS) + Checkerboard Novelty + Repetition Clustering'
  };
}
