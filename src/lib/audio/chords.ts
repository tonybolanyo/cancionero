import { PITCH_CLASSES, WindowedChroma, computeWindowedChromagrams } from './chroma';
import { extractMonoChannelData } from './bufferUtils';

export interface ChordSegment {
  startTime: number;
  endTime: number;
  chord: string;
  confidence: number;
}

export type ChordType =
  | 'major'
  | 'minor'
  | 'power'
  | 'dom7'
  | 'maj7'
  | 'min7'
  | 'sus2'
  | 'sus4';

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
 * 4. Dominant 7th (7): Root (1.0), Major 3rd (0.85), Perfect 5th (0.70), Minor 7th (0.80)
 * 5. Major 7th (maj7): Root (1.0), Major 3rd (0.85), Perfect 5th (0.70), Major 7th (0.80)
 * 6. Minor 7th (m7): Root (1.0), Minor 3rd (0.85), Perfect 5th (0.70), Minor 7th (0.80)
 * 7. Suspended 2nd (sus2): Root (1.0), Major 2nd (0.85), Perfect 5th (0.75)
 * 8. Suspended 4th (sus4): Root (1.0), Perfect 4th (0.85), Perfect 5th (0.75)
 */
export function buildAllChordTemplates(): ChordTemplate[] {
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

    // 4. Dominant 7th (e.g. C7 = C, E, G, Bb/A#)
    const d7 = new Float32Array(12);
    d7[r] = 1.0;
    d7[(r + 4) % 12] = 0.85;
    d7[(r + 7) % 12] = 0.70;
    d7[(r + 10) % 12] = 0.80;
    templates.push({
      chord: `${rootName}7`,
      rootIndex: r,
      type: 'dom7',
      vector: d7
    });

    // 5. Major 7th (e.g. Cmaj7 = C, E, G, B)
    const maj7 = new Float32Array(12);
    maj7[r] = 1.0;
    maj7[(r + 4) % 12] = 0.85;
    maj7[(r + 7) % 12] = 0.70;
    maj7[(r + 11) % 12] = 0.80;
    templates.push({
      chord: `${rootName}maj7`,
      rootIndex: r,
      type: 'maj7',
      vector: maj7
    });

    // 6. Minor 7th (e.g. Cm7 = C, Eb, G, Bb/A#)
    const m7 = new Float32Array(12);
    m7[r] = 1.0;
    m7[(r + 3) % 12] = 0.85;
    m7[(r + 7) % 12] = 0.70;
    m7[(r + 10) % 12] = 0.80;
    templates.push({
      chord: `${rootName}m7`,
      rootIndex: r,
      type: 'min7',
      vector: m7
    });

    // 7. Suspended 2nd (e.g. Csus2 = C, D, G)
    const sus2 = new Float32Array(12);
    sus2[r] = 1.0;
    sus2[(r + 2) % 12] = 0.85;
    sus2[(r + 7) % 12] = 0.75;
    templates.push({
      chord: `${rootName}sus2`,
      rootIndex: r,
      type: 'sus2',
      vector: sus2
    });

    // 8. Suspended 4th (e.g. Csus4 = C, F, G)
    const sus4 = new Float32Array(12);
    sus4[r] = 1.0;
    sus4[(r + 5) % 12] = 0.85;
    sus4[(r + 7) % 12] = 0.75;
    templates.push({
      chord: `${rootName}sus4`,
      rootIndex: r,
      type: 'sus4',
      vector: sus4
    });
  }

  return templates;
}

/**
 * Backward compatibility alias for template generation.
 */
export function buildTriadAndPowerTemplates(): ChordTemplate[] {
  return buildAllChordTemplates();
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

/**
 * Extracts a deduplicated and sanitized chord sequence (ignoring consecutive duplicates and 'N.C.').
 */
export function getCleanChordSequence(chords: (ChordSegment | string)[]): string[] {
  const seq: string[] = [];
  for (const item of chords) {
    const chordName = typeof item === 'string' ? item.trim() : item.chord?.trim();
    if (!chordName || chordName === 'N.C.') continue;
    if (seq.length === 0 || seq[seq.length - 1] !== chordName) {
      seq.push(chordName);
    }
  }
  return seq;
}

/**
 * Automatically integrates detected musical chords into the song's lyrics editor text.
 * 
 * Behavior:
 * 1. If lyrics are blank or default placeholder: generates a structured song skeleton with verses & chorus.
 * 2. If lyrics already contain lines of text without chords: prepends the cyclical chord progression
 *    at the beginning of each non-empty lyric line (skipping Markdown headers like ## Estrofa).
 * 3. If lyrics already have chords in brackets ([Am], etc.): smoothly replaces existing bracketed chords
 *    with the newly detected progression while preserving the lyrics.
 */
export function insertChordsIntoLyrics(
  currentLyrics: string,
  detectedChords: (ChordSegment | string)[]
): string {
  const cleanChords = getCleanChordSequence(detectedChords);
  if (cleanChords.length === 0) {
    return currentLyrics;
  }

  const isDefaultOrEmpty =
    !currentLyrics ||
    !currentLyrics.trim() ||
    currentLyrics.includes('Escribe el primer verso aquí') ||
    currentLyrics.includes('Segundo verso con acordes');

  if (isDefaultOrEmpty) {
    const c1 = cleanChords[0] || 'C';
    const c2 = cleanChords[1] || cleanChords[0] || 'G';
    const c3 = cleanChords[2] || cleanChords[0] || 'Am';
    const c4 = cleanChords[3] || cleanChords[1] || 'F';

    return [
      '## Estrofa 1',
      `[${c1}] Primer verso de la estrofa`,
      `[${c2}] Segundo verso con melodía`,
      `[${c3}] Tercer verso en desarrollo`,
      `[${c4}] Cuarto verso hacia la transición`,
      '',
      '## Estribillo',
      `[${cleanChords[cleanChords.length > 4 ? 4 : 0] || c1}] Línea principal del estribillo`,
      `[${cleanChords[cleanChords.length > 5 ? 5 : 1] || c2}] Elevación melódica`,
      `[${cleanChords[cleanChords.length > 6 ? 6 : 2] || c3}] Fuerza armónica`,
      `[${cleanChords[cleanChords.length > 7 ? 7 : 3] || c4}] Cierre de la sección`,
      ''
    ].join('\n');
  }

  const lines = currentLyrics.split('\n');
  let chordIndex = 0;

  const updatedLines = lines.map(line => {
    const trimmed = line.trim();

    // Preserve blank lines and Markdown headers (##, #, etc.)
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }

    const chordToInsert = cleanChords[chordIndex % cleanChords.length];
    chordIndex++;

    // If the line begins with an existing bracketed chord: [Am] Text...
    if (/^\s*\[[A-G][#b]?[^\]]*\]\s*/.test(line)) {
      return line.replace(/^\s*\[[A-G][#b]?[^\]]*\]\s*/, `[${chordToInsert}] `);
    }

    // If the line doesn't have chords, prepend [Chord]
    const leadingWhitespace = line.match(/^\s*/)?.[0] || '';
    const cleanText = line.trim();
    return `${leadingWhitespace}[${chordToInsert}] ${cleanText}`;
  });

  return updatedLines.join('\n');
}

