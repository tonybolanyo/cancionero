import { PITCH_CLASSES, WindowedChroma, computeWindowedChromagrams } from './chroma';
import { extractMonoChannelData } from './bufferUtils';

export interface ChordSegment {
  startTime: number;
  endTime: number;
  chord: string;
  confidence: number;
}

export type ChordType = 'major' | 'minor' | 'power';

export interface ChordTemplate {
  chord: string;
  rootIndex: number;
  type: ChordType;
  vector: Float32Array;
}

/**
 * Decoupled interface for chord classification from a 12-bin chromagram vector.
 * Allows replacing this initial template heuristic with a machine learning model in the future.
 */
export interface ChordRecognizer {
  recognize(chroma: number[] | Float32Array): { chord: string; confidence: number };
}

/**
 * Builds standard 12-semitone pitch-class templates for:
 * 1. Major Triads: Root (1.0), Major 3rd (0.85), Perfect 5th (0.75)
 * 2. Minor Triads: Root (1.0), Minor 3rd (0.85), Perfect 5th (0.75)
 * 3. Power Chords (5): Root (1.0), Perfect 5th (0.85)
 *
 * (No 7ths, inversions, or tensions as per current scope)
 */
export function buildTriadAndPowerTemplates(): ChordTemplate[] {
  const templates: ChordTemplate[] = [];

  for (let r = 0; r < 12; r++) {
    const rootName = PITCH_CLASSES[r];

    // 1. Major Triad (e.g. C = C, E, G)
    const maj = new Float32Array(12);
    maj[r] = 1.0;
    maj[(r + 4) % 12] = 0.85;
    maj[(r + 7) % 12] = 0.75;
    templates.push({
      chord: rootName,
      rootIndex: r,
      type: 'major',
      vector: maj
    });

    // 2. Minor Triad (e.g. Cm = C, Eb/D#, G)
    const min = new Float32Array(12);
    min[r] = 1.0;
    min[(r + 3) % 12] = 0.85;
    min[(r + 7) % 12] = 0.75;
    templates.push({
      chord: `${rootName}m`,
      rootIndex: r,
      type: 'minor',
      vector: min
    });

    // 3. Power Chord (Fifth chord, e.g. C5 = C, G)
    const p5 = new Float32Array(12);
    p5[r] = 1.0;
    p5[(r + 7) % 12] = 0.85;
    templates.push({
      chord: `${rootName}5`,
      rootIndex: r,
      type: 'power',
      vector: p5
    });
  }

  return templates;
}

function cosineSimilarity(a: number[] | Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < 12; i++) {
    const valA = a[i] || 0;
    const valB = b[i];
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Initial template-based heuristic chord recognizer
 */
export class TemplateChordRecognizer implements ChordRecognizer {
  private templates: ChordTemplate[];

  constructor(customTemplates?: ChordTemplate[]) {
    this.templates = customTemplates || buildTriadAndPowerTemplates();
  }

  recognize(chroma: number[] | Float32Array): { chord: string; confidence: number } {
    let bestChord = 'C';
    let bestScore = -1;

    for (const t of this.templates) {
      const score = cosineSimilarity(chroma, t.vector);
      if (score > bestScore) {
        bestScore = score;
        bestChord = t.chord;
      }
    }

    return {
      chord: bestChord,
      confidence: Number(Math.max(0, Math.min(1, bestScore)).toFixed(2))
    };
  }
}

// Global default recognizer instance
export const defaultChordRecognizer = new TemplateChordRecognizer();

/**
 * Applies temporal smoothing across consecutive window predictions:
 * 1. 3-window majority vote to eliminate isolated 1-frame transient noise.
 * 2. Merging consecutive identical chords.
 * 3. Merging segments shorter than minDurationSec into adjacent harmonies.
 */
export function smoothChordWindows(
  rawWindows: { startTime: number; endTime: number; chord: string; confidence: number }[],
  minDurationSec: number = 0.8
): ChordSegment[] {
  if (rawWindows.length === 0) return [];

  // Step 1: 3-window majority filter for isolated glitches
  const filtered = [];
  for (let i = 0; i < rawWindows.length; i++) {
    const prev = rawWindows[i - 1]?.chord;
    const curr = rawWindows[i].chord;
    const next = rawWindows[i + 1]?.chord;

    if (prev && next && prev === next && curr !== prev) {
      filtered.push({
        ...rawWindows[i],
        chord: prev,
        confidence: Number(((rawWindows[i - 1].confidence + rawWindows[i + 1].confidence) * 0.5).toFixed(2))
      });
    } else {
      filtered.push(rawWindows[i]);
    }
  }

  // Step 2: Aggregate consecutive identical chords into continuous segments
  const segments: { startTime: number; endTime: number; chord: string; confSum: number; count: number }[] = [];
  let current: { startTime: number; endTime: number; chord: string; confSum: number; count: number } | null = null;

  for (const win of filtered) {
    if (!current || current.chord !== win.chord) {
      if (current) {
        segments.push(current);
      }
      current = {
        startTime: win.startTime,
        endTime: win.endTime,
        chord: win.chord,
        confSum: win.confidence,
        count: 1
      };
    } else {
      current.endTime = win.endTime;
      current.confSum += win.confidence;
      current.count++;
    }
  }

  if (current) {
    segments.push(current);
  }

  const initialSegments: ChordSegment[] = segments.map(s => ({
    startTime: Number(s.startTime.toFixed(3)),
    endTime: Number(s.endTime.toFixed(3)),
    chord: s.chord,
    confidence: Number((s.confSum / s.count).toFixed(2))
  }));

  // Step 3: Merge micro-segments shorter than minDurationSec
  const finalSegments: ChordSegment[] = [];
  for (const seg of initialSegments) {
    const dur = seg.endTime - seg.startTime;
    if (dur < minDurationSec && finalSegments.length > 0) {
      finalSegments[finalSegments.length - 1].endTime = seg.endTime;
    } else {
      if (finalSegments.length > 0 && finalSegments[finalSegments.length - 1].chord === seg.chord) {
        finalSegments[finalSegments.length - 1].endTime = seg.endTime;
      } else {
        finalSegments.push({ ...seg });
      }
    }
  }

  return finalSegments;
}

/**
 * Aligns chord segment transitions to the beat timeline if beats are available.
 * Snaps chord change boundaries to the nearest beat within tolerance.
 */
export function alignChordsToBeats(
  segments: ChordSegment[],
  beats?: number[],
  toleranceSec: number = 0.35
): ChordSegment[] {
  if (!beats || beats.length === 0 || segments.length === 0) {
    return segments;
  }

  const findClosestBeat = (targetTime: number): number => {
    let closest = targetTime;
    let minDiff = toleranceSec;
    for (const b of beats) {
      const diff = Math.abs(b - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = b;
      }
    }
    return closest;
  };

  const aligned = segments.map(s => ({ ...s }));
  for (let i = 0; i < aligned.length; i++) {
    if (i === 0) {
      aligned[i].startTime = 0;
    } else {
      aligned[i].startTime = aligned[i - 1].endTime;
    }

    if (i < aligned.length - 1) {
      const snapped = findClosestBeat(aligned[i].endTime);
      aligned[i].endTime = Number(snapped.toFixed(3));
    }
  }

  return aligned;
}

/**
 * Detects chord progression from a temporal sequence of windowed chromagrams.
 */
export function detectChordsFromChromagram(
  windowedChroma: WindowedChroma[],
  recognizer: ChordRecognizer = defaultChordRecognizer,
  beats?: number[]
): ChordSegment[] {
  const windowPredictions = windowedChroma.map(w => {
    const res = recognizer.recognize(w.chroma);
    return {
      startTime: w.startTime,
      endTime: w.endTime,
      chord: res.chord,
      confidence: res.confidence
    };
  });

  const smoothed = smoothChordWindows(windowPredictions, 0.75);
  return alignChordsToBeats(smoothed, beats);
}

/**
 * Analyzes chords for an AudioBuffer by slicing into 1-2s windows with overlap,
 * computing chromagrams, classifying triads/5ths, smoothing, and aligning with beats.
 */
export function analyzeChordsDSP(
  audioBuffer: AudioBuffer,
  options: {
    beats?: number[];
    windowDurationSec?: number;
    hopDurationSec?: number;
    recognizer?: ChordRecognizer;
  } = {}
): ChordSegment[] {
  const channelData = extractMonoChannelData(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;

  // Windowing: 1.5s with 50% overlap (0.75s hop)
  const windowedChroma = computeWindowedChromagrams(channelData, sampleRate, {
    windowDurationSec: options.windowDurationSec ?? 1.5,
    hopDurationSec: options.hopDurationSec ?? 0.75
  });

  return detectChordsFromChromagram(
    windowedChroma,
    options.recognizer || defaultChordRecognizer,
    options.beats
  );
}

/**
 * Exports chord progression sequence to clean, formatted JSON.
 */
export function exportChordsToJSON(chords: ChordSegment[], songTitle?: string): string {
  const exportPayload = {
    title: songTitle || 'Progresión de Acordes',
    totalSegments: chords.length,
    exportedAt: new Date().toISOString(),
    segments: chords.map(c => ({
      chord: c.chord,
      startTime: Number(c.startTime.toFixed(3)),
      endTime: Number(c.endTime.toFixed(3)),
      duration: Number((c.endTime - c.startTime).toFixed(3)),
      confidence: Number(c.confidence.toFixed(2))
    }))
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Exports chord progression sequence to CSV format.
 */
export function exportChordsToCSV(chords: ChordSegment[]): string {
  const headers = 'chord,start_time,end_time,duration_seconds,confidence\n';
  const rows = chords.map(c => {
    const dur = (c.endTime - c.startTime).toFixed(3);
    return `${c.chord},${c.startTime.toFixed(3)},${c.endTime.toFixed(3)},${dur},${c.confidence.toFixed(2)}`;
  }).join('\n');
  return headers + rows;
}

/**
 * Triggers a browser file download of the exported chord progression.
 */
export function downloadChordExport(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
