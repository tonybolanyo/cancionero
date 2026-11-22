import {
  PITCH_CLASSES,
  BassPitchEstimate,
  WindowedChroma,
  computeWindowedChromagrams
} from './chroma';
import { extractMonoChannelData } from './bufferUtils';
import { insertChordsIntoSyllables, InsertChordsOptions } from '../lyrics/lyricsChordIntegration';

export interface ChordSegment {
  startTime: number;
  endTime: number;
  chord: string;
  confidence?: number;
}

export type ChordType =
  | 'major'
  | 'minor'
  | 'power'
  | 'dom7'
  | 'maj7'
  | 'min7'
  | 'sus2'
  | 'sus4'
  | 'dim'
  | 'm7b5'
  | 'aug';

export interface ChordTemplate {
  chord: string;
  rootIndex: number;
  type: ChordType;
  vector: Float32Array;
}

export interface KeyContext {
  /** Key root name, e.g. 'C', 'Am', 'F#', 'Bb' */
  key: string;
  /** Scale mode */
  scale: 'major' | 'minor';
  /** Key detection confidence 0..1 */
  confidence?: number;
}

export interface ViterbiOptions {
  keyContext?: KeyContext;
  /** Transition penalty when switching between different chords */
  switchPenalty?: number;
  /** Temperature scaling for cosine similarity softmax emissions (default: 10.0) */
  emissionTemperature?: number;
  /** Weight of the detected key prior in log-probability space (default: 1.0) */
  keyWeight?: number;
  /** Minimum segment duration in seconds after decoding (default: 0.75) */
  minDurationSec?: number;
  /** Hop duration in seconds between consecutive frames (auto-detected if omitted) */
  hopDurationSec?: number;
  /** Whether to resolve 40–180 Hz bass inversions into slash chords (default: true) */
  enableSlashChords?: boolean;
  /** NEW: Detected BPM for tempo-adaptive templating (Mejora D) */
  detectedTempo?: number;
}

export interface RawChordFrame {
  startTime: number;
  endTime: number;
  chord: string;
  confidence: number;
  bassEstimate?: BassPitchEstimate;
  midChroma?: number[];
  highChroma?: number[]; // NEW: Triple-band high-frequency (600–2000 Hz) for guitar harmonics
}

/**
 * Decoupled interface for chord classification from a 12-bin chromagram vector.
 * Allows replacing this initial template heuristic with a machine learning model in the future.
 */
export interface ChordRecognizer {
  recognize(chroma: number[] | Float32Array): { chord: string; confidence: number };
}

const NOTE_TO_INDEX: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11
};

/**
 * Normalizes any note spelling (sharps or flats) to pitch class index 0..11, or -1 if invalid.
 */
export function normalizePitchClassIndex(note: string): number {
  if (!note) return -1;
  const cleaned = note.trim();
  if (NOTE_TO_INDEX[cleaned] !== undefined) {
    return NOTE_TO_INDEX[cleaned];
  }
  const match = cleaned.match(/^([A-Ga-g][#b]?)/);
  if (!match) return -1;
  const normalized = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return NOTE_TO_INDEX[normalized] ?? -1;
}

/**
 * Parses a KeyContext into canonical tonic index (0..11), scale, and confidence.
 */
export function parseKeyContext(keyContext?: KeyContext): {
  tonicIndex: number;
  scale: 'major' | 'minor';
  confidence: number;
} | null {
  if (!keyContext || !keyContext.key) return null;
  const raw = keyContext.key.trim();
  const isMinorSuffix = raw.endsWith('m') && !raw.endsWith('dim');
  const rootPart = isMinorSuffix ? raw.slice(0, -1) : raw;
  const tonicIndex = normalizePitchClassIndex(rootPart);
  if (tonicIndex < 0) return null;

  const scale: 'major' | 'minor' =
    keyContext.scale === 'minor' || isMinorSuffix ? 'minor' : 'major';
  const confidence = Math.max(0, Math.min(1, keyContext.confidence ?? 0.75));
  return { tonicIndex, scale, confidence };
}

/**
 * Parses a chord symbol (including slash chords like "D/F#", "Am/G", "C#m7")
 * into its structural components and pitch-class bitmask.
 */
export function parseChordSymbol(chord: string): {
  baseChord: string;
  rootIndex: number;
  type: ChordType;
  bassIndex: number;
  pitchMask: number;
  isNoChord: boolean;
} {
  const trimmed = (chord || '').trim();
  if (!trimmed || trimmed === 'N.C.' || trimmed === 'N' || trimmed === 'NC') {
    return {
      baseChord: 'N.C.',
      rootIndex: -1,
      type: 'major',
      bassIndex: -1,
      pitchMask: 0,
      isNoChord: true
    };
  }

  const [mainPart, bassPart] = trimmed.split('/');
  const bassIndex = bassPart ? normalizePitchClassIndex(bassPart) : -1;

  const match = mainPart.match(/^([A-Ga-g][#b]?)(.*)$/);
  if (!match) {
    return {
      baseChord: trimmed,
      rootIndex: -1,
      type: 'major',
      bassIndex,
      pitchMask: 0,
      isNoChord: true
    };
  }

  const rootIndex = normalizePitchClassIndex(match[1]);
  const suffix = match[2].trim();

  let type: ChordType = 'major';
  let intervals: number[] = [0, 4, 7];

  if (suffix === '' || suffix === 'maj') {
    type = 'major';
    intervals = [0, 4, 7];
  } else if (suffix === 'm' || suffix === 'min') {
    type = 'minor';
    intervals = [0, 3, 7];
  } else if (suffix === '5') {
    type = 'power';
    intervals = [0, 7];
  } else if (suffix === '7') {
    type = 'dom7';
    intervals = [0, 4, 7, 10];
  } else if (suffix === 'maj7' || suffix === 'M7') {
    type = 'maj7';
    intervals = [0, 4, 7, 11];
  } else if (suffix === 'm7' || suffix === 'min7') {
    type = 'min7';
    intervals = [0, 3, 7, 10];
  } else if (suffix === 'sus2') {
    type = 'sus2';
    intervals = [0, 2, 7];
  } else if (suffix === 'sus4' || suffix === 'sus') {
    type = 'sus4';
    intervals = [0, 5, 7];
  } else if (suffix === 'dim') {
    type = 'dim';
    intervals = [0, 3, 6];
  } else if (suffix === 'm7b5' || suffix === 'ø') {
    type = 'm7b5';
    intervals = [0, 3, 6, 10];
  } else if (suffix === 'aug' || suffix === '+') {
    type = 'aug';
    intervals = [0, 4, 8];
  } else if (suffix.startsWith('m')) {
    type = 'minor';
    intervals = [0, 3, 7];
  }

  let pitchMask = 0;
  if (rootIndex >= 0) {
    for (const iv of intervals) {
      pitchMask |= 1 << ((rootIndex + iv) % 12);
    }
  }

  return {
    baseChord: mainPart,
    rootIndex,
    type,
    bassIndex,
    pitchMask,
    isNoChord: rootIndex < 0
  };
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
 * 9. Diminished Triad (dim): Root (1.0), Minor 3rd (0.85), Diminished 5th (0.80)
 * 10. Half-Diminished 7th (m7b5): Root (1.0), Minor 3rd (0.85), Diminished 5th (0.75), Minor 7th (0.80)
 * 11. Augmented Triad (aug): Root (1.0), Major 3rd (0.85), Augmented 5th (0.80)
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

    // 9. Diminished Triad (e.g. Cdim = C, Eb, Gb/F#)
    const dim = new Float32Array(12);
    dim[r] = 1.0;
    dim[(r + 3) % 12] = 0.85;
    dim[(r + 6) % 12] = 0.80;
    templates.push({
      chord: `${rootName}dim`,
      rootIndex: r,
      type: 'dim',
      vector: dim
    });

    // 10. Half-Diminished 7th / m7b5 (e.g. Cm7b5 = C, Eb, Gb, Bb)
    const m7b5 = new Float32Array(12);
    m7b5[r] = 1.0;
    m7b5[(r + 3) % 12] = 0.85;
    m7b5[(r + 6) % 12] = 0.75;
    m7b5[(r + 10) % 12] = 0.80;
    templates.push({
      chord: `${rootName}m7b5`,
      rootIndex: r,
      type: 'm7b5',
      vector: m7b5
    });

    // 11. Augmented Triad (e.g. Caug = C, E, G#/Ab)
    const aug = new Float32Array(12);
    aug[r] = 1.0;
    aug[(r + 4) % 12] = 0.85;
    aug[(r + 8) % 12] = 0.80;
    templates.push({
      chord: `${rootName}aug`,
      rootIndex: r,
      type: 'aug',
      vector: aug
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
 * Computes log-prior harmonic weights for a candidate chord given a detected musical key.
 * Favors diatonic degrees (I, IV, V, vi, ii, iii in major; i, III, iv, v/V, VI, VII in minor),
 * gently accommodates common borrowed/secondary dominants, and penalizes chromatic outliers
 * caused by passing vocal notes or percussive transients.
 */
export function getKeyPriorLogProb(
  chord: string,
  keyContext?: KeyContext,
  keyWeight: number = 1.0
): number {
  const parsedKey = parseKeyContext(keyContext);
  if (!parsedKey || keyWeight <= 0) return 0;

  const parsedChord = parseChordSymbol(chord);
  if (parsedChord.isNoChord || parsedChord.rootIndex < 0) return -0.8 * keyWeight;

  const degree = (parsedChord.rootIndex - parsedKey.tonicIndex + 12) % 12;
  const type = parsedChord.type;
  const strength = keyWeight * (0.45 + 0.75 * parsedKey.confidence);

  const isMajorFamily = type === 'major' || type === 'maj7' || type === 'dom7' || type === 'sus2' || type === 'sus4' || type === 'power';
  const isMinorFamily = type === 'minor' || type === 'min7' || type === 'sus2' || type === 'sus4' || type === 'power';

  if (parsedKey.scale === 'major') {
    // I (Tonic)
    if (degree === 0 && (type === 'major' || type === 'maj7' || type === 'sus2' || type === 'sus4' || type === 'power')) {
      return 0.85 * strength;
    }
    // IV, V (Primary subdominant/dominant)
    if ((degree === 5 || degree === 7) && isMajorFamily) {
      return 0.65 * strength;
    }
    // vi (Relative minor)
    if (degree === 9 && isMinorFamily) {
      return 0.60 * strength;
    }
    // ii, iii (Secondary diatonic)
    if ((degree === 2 || degree === 4) && isMinorFamily) {
      return 0.35 * strength;
    }
    // vii° (Leading tone)
    if (degree === 11 && (type === 'dim' || type === 'm7b5')) {
      return 0.15 * strength;
    }
    // Common songwriter borrowed / secondary dominants in Major:
    // bVII (10), iv (5 minor), II7 (2 dom7), III7 (4 dom7), VI7 (9 dom7), bVI (8 major), bIII (3 major)
    if (
      (degree === 10 && isMajorFamily) ||
      (degree === 5 && isMinorFamily) ||
      ((degree === 2 || degree === 4 || degree === 9) && type === 'dom7') ||
      ((degree === 8 || degree === 3) && isMajorFamily)
    ) {
      return -0.25 * strength;
    }
    return -1.25 * strength;
  } else {
    // Minor key (Natural + Harmonic V/V7)
    // i (Tonic)
    if (degree === 0 && isMinorFamily) {
      return 0.85 * strength;
    }
    // VI, VII, III (Primary major chords in minor)
    if ((degree === 8 || degree === 10 || degree === 3) && isMajorFamily) {
      return 0.60 * strength;
    }
    // iv (Subdominant)
    if (degree === 5 && isMinorFamily) {
      return 0.60 * strength;
    }
    // v / V / V7 (Dominant minor or harmonic major/dom7)
    if (degree === 7 && (isMinorFamily || isMajorFamily)) {
      return 0.60 * strength;
    }
    // ii° (Supertonic diminished / minor)
    if (degree === 2 && (type === 'dim' || type === 'm7b5' || isMinorFamily)) {
      return 0.25 * strength;
    }
    // Common borrowed chords in Minor: IV (5 major - Dorian), I (0 major - Picardy/secondary), bII (1 major - Neapolitan)
    if (
      (degree === 5 && isMajorFamily) ||
      (degree === 0 && type === 'major') ||
      (degree === 1 && isMajorFamily)
    ) {
      return -0.25 * strength;
    }
    return -1.25 * strength;
  }
}

function countBits(n: number): number {
  let count = 0;
  let x = n;
  while (x > 0) {
    count += x & 1;
    x >>= 1;
  }
  return count;
}

/**
 * Computes harmonic transition affinity bonus between two distinct chords
 * based on circle-of-fifths proximity, shared pitch classes, and relative major/minor closeness.
 */
function computeHarmonicAffinity(
  rootA: number,
  maskA: number,
  rootB: number,
  maskB: number
): number {
  if (rootA < 0 || rootB < 0) return 0;

  let bonus = 0;
  const interval = (rootB - rootA + 12) % 12;

  // Circle of fifths neighbors (P5 / P4, e.g. G -> C, C -> F, Am -> Dm)
  if (interval === 5 || interval === 7) {
    bonus += 0.35;
  } else if (interval === 3 || interval === 9) {
    // Relative major/minor root movement (e.g. C <-> Am)
    bonus += 0.25;
  } else if (interval === 0) {
    // Same root quality refinement (e.g. G -> G7 or Am -> Am7)
    bonus += 0.30;
  }

  // Shared pitch classes bonus
  const sharedNotes = countBits(maskA & maskB);
  bonus += Math.min(0.25, sharedNotes * 0.08);

  return bonus;
}

/**
 * Resolves a chord + 40–180 Hz bass estimate into a slash chord (e.g. C/G, D/F#, Am/G)
 * when the lowest bass pitch is clear, musically valid, and differs from the chord root.
 */
export function resolveSlashChord(
  baseChord: string,
  bassEstimate?: BassPitchEstimate,
  keyContext?: KeyContext
): string {
  if (!bassEstimate || bassEstimate.pitchClass < 0 || !bassEstimate.pitchName) {
    return baseChord;
  }

  const parsed = parseChordSymbol(baseChord);
  if (parsed.isNoChord || parsed.rootIndex < 0) {
    return baseChord;
  }

  // Mejora C: Validate bass with temporal information
  if (!isValidBassPitch(bassEstimate, parsed.rootIndex, parsed.pitchMask)) {
    return baseChord;
  }

  // Root-position bass matches the chord root -> no slash suffix needed
  if (bassEstimate.pitchClass === parsed.rootIndex) {
    return parsed.baseChord;
  }

  // Require real bass presence in 40–180 Hz
  if (bassEstimate.energyRatio < 0.08 && bassEstimate.confidence < 0.55) {
    return parsed.baseChord;
  }

  const bassPc = bassEstimate.pitchClass;
  const intervalFromRoot = (bassPc - parsed.rootIndex + 12) % 12;

  // 1. Chord tone in the bass (1st inversion 3rd, 2nd inversion 5th, or 7th)
  const isChordTone = (parsed.pitchMask & (1 << bassPc)) !== 0;

  // 2. Common songwriter pedal / descending walking bass intervals (e.g. Am/G -> m7, C/B -> M7, G/A -> M2, D/G -> P4)
  const isCommonWalkingBass =
    intervalFromRoot === 10 || // minor 7th in bass (Am/G, D/C, G/F, Em/D)
    intervalFromRoot === 11 || // major 7th in bass (C/B, Am/G#)
    intervalFromRoot === 2 ||  // 2nd/9th in bass (G/A, F/G)
    intervalFromRoot === 5;    // 4th pedal bass (G/C, A/D)

  // 3. Diatonic bass note in the detected musical key
  let isDiatonicBass = false;
  const parsedKey = parseKeyContext(keyContext);
  if (parsedKey) {
    const keyDegree = (bassPc - parsedKey.tonicIndex + 12) % 12;
    const majorDegrees = [0, 2, 4, 5, 7, 9, 11];
    const minorDegrees = [0, 2, 3, 5, 7, 8, 10, 11];
    const scaleSet = parsedKey.scale === 'major' ? majorDegrees : minorDegrees;
    isDiatonicBass = scaleSet.includes(keyDegree);
  }

  let requiredConfidence = 0.68; // chromatic non-chord bass requires strong certainty
  if (isChordTone) {
    requiredConfidence = 0.36;
  } else if (isCommonWalkingBass) {
    requiredConfidence = 0.42;
  } else if (isDiatonicBass) {
    requiredConfidence = 0.48;
  }

  if (bassEstimate.confidence >= requiredConfidence) {
    return `${parsed.baseChord}/${bassEstimate.pitchName}`;
  }

  return parsed.baseChord;
}

/**
 * Validates whether a bass note is a real chord note or a passing tone.
 * Used for Mejora C: distinguishes held bass notes from rapid passing notes.
 * @param bassEstimate The bass pitch estimate (should include temporal info)
 * @param chordRootIndex The root pitch class of the chord (0–11)
 * @param chordPitchMask Bitmask of pitch classes in this chord (12 bits)
 * @return true if the bass note is musically valid for this chord context
 */
export function isValidBassPitch(
  bassEstimate: BassPitchEstimate | undefined,
  chordRootIndex: number,
  chordPitchMask: number
): boolean {
  if (!bassEstimate || bassEstimate.pitchClass < 0) {
    return false;
  }

  const bassPc = bassEstimate.pitchClass;

  // 1. Bass must be present (energy ratio > threshold)
  if (bassEstimate.energyRatio < 0.08 && bassEstimate.confidence < 0.5) {
    return false;
  }

  // 2. Bass must be part of chord OR a valid extension
  const isChordTone = (chordPitchMask & (1 << bassPc)) !== 0;
  if (!isChordTone) {
    // Allow very weak confidence for non-chord tones (likely passing notes)
    if (bassEstimate.confidence < 0.65) {
      return false;
    }
  }

  // 3. If this is an EnhancedBassPitchEstimate with temporal info, check duration
  const enhanced = bassEstimate as any;
  if (enhanced.isTransient && enhanced.estimatedDurationMs < 100) {
    // Very short notes (< 100ms) are likely passing tones, not chord bass
    return false;
  }

  return true;
}

/**
 * Applies lightweight temporal stabilization to per-window bass estimates so isolated
 * single-frame kick/thud glitches do not trigger spurious slash chords, while real
 * walking basslines (Am -> Am/G) and sustained inversions (C/G, D/F#) are preserved.
 */
function smoothBassEstimates(
  estimates: (BassPitchEstimate | undefined)[],
  hopDurationSec: number
): (BassPitchEstimate | undefined)[] {
  const n = estimates.length;
  if (n <= 2) return estimates;

  // At fast frame rates (< 0.35s hop), examine a +/-2 frame neighborhood (~0.4s);
  // at slower window hops (>= 0.35s), examine +/-1 window.
  const radius = hopDurationSec < 0.35 ? 2 : 1;
  const smoothed: (BassPitchEstimate | undefined)[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const curr = estimates[i];
    if (!curr || curr.pitchClass < 0) {
      smoothed[i] = curr;
      continue;
    }

    // Count neighbor votes for pitch classes weighted by confidence
    const votes = new Float64Array(12);
    let totalWeight = 0;

    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
      const est = estimates[j];
      if (!est || est.pitchClass < 0) continue;
      const distWeight = j === i ? 1.0 : 0.7;
      const w = est.confidence * distWeight;
      votes[est.pitchClass] += w;
      totalWeight += w;
    }

    let bestPc = curr.pitchClass;
    let bestVote = -1;
    for (let pc = 0; pc < 12; pc++) {
      if (votes[pc] > bestVote) {
        bestVote = votes[pc];
        bestPc = pc;
      }
    }

    // If neighbors strongly disagree with an isolated low-to-moderate spike, adopt neighbor consensus
    if (bestPc !== curr.pitchClass && curr.confidence < 0.72) {
      smoothed[i] = {
        ...curr,
        pitchClass: bestPc,
        pitchName: PITCH_CLASSES[bestPc],
        confidence: Number(Math.min(1, bestVote / Math.max(1e-6, totalWeight)).toFixed(3))
      };
    } else {
      smoothed[i] = curr;
    }
  }

  return smoothed;
}

/**
 * Merges consecutive identical chord segments and absorbs micro-segments shorter
 * than minDurationSec into adjacent chords.
 */
function aggregateAndMergeSegments(
  frames: { startTime: number; endTime: number; chord: string; confidence: number }[],
  minDurationSec: number
): ChordSegment[] {
  if (frames.length === 0) return [];

  const grouped: { startTime: number; endTime: number; chord: string; confSum: number; count: number }[] = [];
  let current: { startTime: number; endTime: number; chord: string; confSum: number; count: number } | null = null;

  for (const frame of frames) {
    if (!current || current.chord !== frame.chord) {
      if (current) grouped.push(current);
      current = {
        startTime: frame.startTime,
        endTime: frame.endTime,
        chord: frame.chord,
        confSum: frame.confidence,
        count: 1
      };
    } else {
      current.endTime = frame.endTime;
      current.confSum += frame.confidence;
      current.count++;
    }
  }
  if (current) grouped.push(current);

  const initialSegments: ChordSegment[] = grouped.map(s => ({
    startTime: Number(s.startTime.toFixed(3)),
    endTime: Number(s.endTime.toFixed(3)),
    chord: s.chord,
    confidence: Number((s.confSum / s.count).toFixed(2))
  }));

  if (minDurationSec <= 0) return initialSegments;

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
 * Contextual Harmonic Smoothing using a lightweight Key-Weighted Viterbi Decoder
 * for frame-by-frame chord predictions (such as Essentia TonalExtractor output).
 * Eliminates isolated and multi-frame passing-note / percussion glitches while
 * optionally resolving 40–180 Hz bass inversions into slash chords (C/G, D/F#, Am/G).
 */
export function smoothChordsWithViterbi(
  rawFrames: RawChordFrame[],
  options: ViterbiOptions = {}
): ChordSegment[] {
  if (rawFrames.length === 0) return [];

  const keyWeight = options.keyWeight ?? 1.0;
  const enableSlashChords = options.enableSlashChords ?? true;

  // Estimate hop duration from frames
  let hopDurationSec = options.hopDurationSec ?? 0;
  if (hopDurationSec <= 0) {
    if (rawFrames.length > 1) {
      hopDurationSec = Math.max(0.02, rawFrames[1].startTime - rawFrames[0].startTime);
    } else {
      hopDurationSec = Math.max(0.05, rawFrames[0].endTime - rawFrames[0].startTime);
    }
  }

  // NEW: Tempo-adaptive templating (Mejora D)
  // Auto-adjust Viterbi parameters (minDurationSec, switchPenalty) based on detected BPM
  let minDurationSec = options.minDurationSec ?? 0.5;
  let switchPenalty: number;

  if (options.detectedTempo && options.detectedTempo > 0) {
    const bpm = options.detectedTempo;
    // Slow (BPM < 70): Longer segments, higher switch penalty (resist chord changes)
    if (bpm < 70) {
      minDurationSec = 1.0; // Expect longer chord segments in slow music
      switchPenalty = options.switchPenalty ?? 4.5; // Higher penalty to resist changes
    }
    // Fast (BPM > 130): Shorter segments, lower switch penalty (allow rapid changes)
    else if (bpm > 130) {
      minDurationSec = 0.3; // Allow shorter chord segments in fast music
      switchPenalty = options.switchPenalty ?? 1.8; // Lower penalty to allow changes
    }
    // Normal (70 ≤ BPM ≤ 130): default behavior
    else {
      minDurationSec = options.minDurationSec ?? 0.5;
      switchPenalty =
        options.switchPenalty ??
        Math.max(1.8, Math.min(5.8, 2.2 * Math.pow(0.5 / Math.max(0.03, hopDurationSec), 0.35)));
    }
  } else {
    // Default behavior if no tempo provided
    minDurationSec = options.minDurationSec ?? 0.5;
    switchPenalty =
      options.switchPenalty ??
      Math.max(1.8, Math.min(5.8, 2.2 * Math.pow(0.5 / Math.max(0.03, hopDurationSec), 0.35)));
  }

  // Build state vocabulary: 24 standard Major & Minor triads + any extra observed chords
  const stateSet = new Set<string>();
  for (let pc = 0; pc < 12; pc++) {
    stateSet.add(PITCH_CLASSES[pc]);
    stateSet.add(`${PITCH_CLASSES[pc]}m`);
  }
  for (const f of rawFrames) {
    const parsed = parseChordSymbol(f.chord);
    if (!parsed.isNoChord) {
      stateSet.add(parsed.baseChord);
    }
  }

  const states = Array.from(stateSet);
  const N = states.length;
  const T = rawFrames.length;

  const stateIndexMap = new Map<string, number>();
  const stateMeta = states.map((s, idx) => {
    stateIndexMap.set(s, idx);
    const parsed = parseChordSymbol(s);
    const tmplVec = new Float32Array(12);
    if (parsed.rootIndex >= 0) {
      for (let pc = 0; pc < 12; pc++) {
        if ((parsed.pitchMask & (1 << pc)) !== 0) {
          tmplVec[pc] = pc === parsed.rootIndex ? 1.0 : 0.82;
        }
      }
    }
    return {
      chord: s,
      rootIndex: parsed.rootIndex,
      pitchMask: parsed.pitchMask,
      vector: tmplVec,
      keyPrior: getKeyPriorLogProb(s, options.keyContext, keyWeight)
    };
  });

  // Precompute transition matrix trans[i * N + j]
  const trans = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        trans[i * N + j] = 0;
      } else {
        const affinity = computeHarmonicAffinity(
          stateMeta[i].rootIndex,
          stateMeta[i].pitchMask,
          stateMeta[j].rootIndex,
          stateMeta[j].pitchMask
        );
        trans[i * N + j] = -switchPenalty + affinity;
      }
    }
  }

  // Viterbi DP tables
  let prevDp = new Float64Array(N);
  let currDp = new Float64Array(N);
  const backptr = new Int16Array(T * N);
  const frameEmission = new Float64Array(N);

  const computeFrameLogEmission = (frame: RawChordFrame, out: Float64Array) => {
    const obsParsed = parseChordSymbol(frame.chord);
    const conf = Math.max(0.05, Math.min(1, frame.confidence || 0.65));

    // Check if dual-band midChroma (180–1200 Hz) is available to help disambiguate inversions
    const hasMidChroma =
      Array.isArray(frame.midChroma) &&
      frame.midChroma.length === 12 &&
      frame.midChroma.some(v => v > 0.05);

    // NEW: Check for high-frequency chroma (600–2000 Hz) for guitar harmonics validation
    const hasHighChroma =
      Array.isArray(frame.highChroma) &&
      frame.highChroma.length === 12 &&
      frame.highChroma.some(v => v > 0.05);

    if (obsParsed.isNoChord) {
      // Unpitched / silence frame: flat emission so Viterbi holds current chord
      out.fill(0);
      if (hasMidChroma && frame.midChroma) {
        for (let s = 0; s < N; s++) {
          out[s] = 4.0 * cosineSimilarity(frame.midChroma, stateMeta[s].vector);
        }
      }
      return;
    }

    const obsIdx = stateIndexMap.get(obsParsed.baseChord) ?? -1;
    const matchScore = 2.6 + 2.4 * conf;

    for (let s = 0; s < N; s++) {
      let score = 0;
      if (s === obsIdx) {
        score = matchScore;
      } else {
        // Partial credit if candidate shares pitch classes with observed chord (e.g. C vs Am)
        const shared = countBits(obsParsed.pitchMask & stateMeta[s].pitchMask);
        if (shared >= 2) {
          score = 0.85 * conf;
        } else if (shared === 1) {
          score = 0.25 * conf;
        }
      }

      if (hasMidChroma && frame.midChroma) {
        const midSim = cosineSimilarity(frame.midChroma, stateMeta[s].vector);
        score = 0.62 * score + 0.38 * (6.5 * midSim);
      }

      // NEW: High-chroma weighting (Mejora B)
      // If high-chroma is available, use it as secondary validator:
      // 60% mid-band + 40% high-band weighting for guitar harmonic confirmation
      if (hasHighChroma && frame.highChroma) {
        const highSim = cosineSimilarity(frame.highChroma, stateMeta[s].vector);
        if (hasMidChroma && frame.midChroma) {
          const midSim = cosineSimilarity(frame.midChroma, stateMeta[s].vector);
          score = 0.6 * score + 0.4 * (6.5 * highSim);
        } else {
          score = 0.5 * score + 0.5 * (6.5 * highSim);
        }
      }

      out[s] = score;
    }
  };

  // Initialization (t = 0)
  computeFrameLogEmission(rawFrames[0], frameEmission);
  for (let s = 0; s < N; s++) {
    prevDp[s] = frameEmission[s] + stateMeta[s].keyPrior;
    backptr[s] = 0;
  }

  // Forward pass
  for (let t = 1; t < T; t++) {
    computeFrameLogEmission(rawFrames[t], frameEmission);
    const rowOffset = t * N;

    for (let j = 0; j < N; j++) {
      let bestVal = -Infinity;
      let bestPrev = 0;
      const transOffset = j; // trans[i * N + j]
      for (let i = 0; i < N; i++) {
        const candidate = prevDp[i] + trans[i * N + transOffset];
        if (candidate > bestVal) {
          bestVal = candidate;
          bestPrev = i;
        }
      }
      currDp[j] = bestVal + frameEmission[j] + stateMeta[j].keyPrior;
      backptr[rowOffset + j] = bestPrev;
    }

    // Normalize DP scores to prevent numerical drift on long audio
    let maxDp = -Infinity;
    for (let j = 0; j < N; j++) {
      if (currDp[j] > maxDp) maxDp = currDp[j];
    }
    for (let j = 0; j < N; j++) {
      currDp[j] -= maxDp;
    }

    const tmp = prevDp;
    prevDp = currDp;
    currDp = tmp;
  }

  // Backtrace optimal state sequence
  const bestPath = new Int16Array(T);
  let bestLastState = 0;
  let bestLastScore = -Infinity;
  for (let s = 0; s < N; s++) {
    if (prevDp[s] > bestLastScore) {
      bestLastScore = prevDp[s];
      bestLastState = s;
    }
  }
  bestPath[T - 1] = bestLastState;
  for (let t = T - 2; t >= 0; t--) {
    bestPath[t] = backptr[(t + 1) * N + bestPath[t + 1]];
  }

  // Stabilize bass estimates across neighboring frames before attaching slash chords
  const smoothedBass = enableSlashChords
    ? smoothBassEstimates(rawFrames.map(f => f.bassEstimate), hopDurationSec)
    : new Array(T).fill(undefined);

  const decodedFrames = rawFrames.map((f, t) => {
    const baseChord = stateMeta[bestPath[t]].chord;
    const finalChord = enableSlashChords
      ? resolveSlashChord(baseChord, smoothedBass[t], options.keyContext)
      : baseChord;
    return {
      startTime: f.startTime,
      endTime: f.endTime,
      chord: finalChord,
      confidence: Number(Math.max(0, Math.min(1, f.confidence || 0.75)).toFixed(2))
    };
  });

  return aggregateAndMergeSegments(decodedFrames, minDurationSec);
}

/**
 * Full Chromagram-Matrix Viterbi Decoder + Dual-Band Slash Chord Resolution.
 * Scores every chord template via cosine similarity (preferring midChroma 180–1200 Hz
 * when available), weights probabilities by detected key, decodes the globally optimal
 * harmonic sequence, and attaches 40–180 Hz bass inversions (C/G, D/F#, Am/G).
 */
export function recognizeChordsWithViterbi(
  windowedChroma: WindowedChroma[],
  options: ViterbiOptions = {},
  customTemplates?: ChordTemplate[]
): ChordSegment[] {
  if (windowedChroma.length === 0) return [];

  const templates = customTemplates || buildAllChordTemplates();
  const N = templates.length;
  const T = windowedChroma.length;

  const baseTemp = options.emissionTemperature ?? 10.0;
  const keyWeight = options.keyWeight ?? 1.0;
  const enableSlashChords = options.enableSlashChords ?? true;

  let hopDurationSec = options.hopDurationSec ?? 0;
  if (hopDurationSec <= 0) {
    hopDurationSec =
      T > 1
        ? Math.max(0.05, windowedChroma[1].startTime - windowedChroma[0].startTime)
        : Math.max(0.5, windowedChroma[0].endTime - windowedChroma[0].startTime);
  }

  // NEW: Tempo-adaptive templating (Mejora D)
  let minDurationSec = options.minDurationSec ?? 0.75;
  let switchPenalty: number;

  if (options.detectedTempo && options.detectedTempo > 0) {
    const bpm = options.detectedTempo;
    if (bpm < 70) {
      minDurationSec = 1.0;
      switchPenalty = options.switchPenalty ?? 3.5;
    } else if (bpm > 130) {
      minDurationSec = 0.4;
      switchPenalty = options.switchPenalty ?? 1.4;
    } else {
      minDurationSec = options.minDurationSec ?? 0.75;
      switchPenalty =
        options.switchPenalty ??
        Math.max(1.4, Math.min(4.5, 1.85 * Math.pow(0.75 / Math.max(0.05, hopDurationSec), 0.35)));
    }
  } else {
    minDurationSec = options.minDurationSec ?? 0.75;
    switchPenalty =
      options.switchPenalty ??
      Math.max(1.4, Math.min(4.5, 1.85 * Math.pow(0.75 / Math.max(0.05, hopDurationSec), 0.35)));
  }

  const stateMeta = templates.map(tmpl => {
    const parsed = parseChordSymbol(tmpl.chord);
    return {
      chord: tmpl.chord,
      rootIndex: tmpl.rootIndex,
      pitchMask: parsed.pitchMask,
      keyPrior: getKeyPriorLogProb(tmpl.chord, options.keyContext, keyWeight)
    };
  });

  // Precompute transition matrix
  const trans = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        trans[i * N + j] = 0;
      } else {
        const affinity = computeHarmonicAffinity(
          stateMeta[i].rootIndex,
          stateMeta[i].pitchMask,
          stateMeta[j].rootIndex,
          stateMeta[j].pitchMask
        );
        trans[i * N + j] = -switchPenalty + affinity;
      }
    }
  }

  const selectTriadVector = (w: WindowedChroma): number[] => {
    if (w.midChroma && w.midChroma.length === 12) {
      let maxMid = 0;
      for (let i = 0; i < 12; i++) {
        if (w.midChroma[i] > maxMid) maxMid = w.midChroma[i];
      }
      if (maxMid > 0.05) {
        return w.midChroma;
      }
    }
    return w.chroma;
  };

  let prevDp = new Float64Array(N);
  let currDp = new Float64Array(N);
  const backptr = new Int16Array(T * N);
  const simScores = new Float64Array(N);
  const logEmission = new Float64Array(N);
  const frameConfidences = new Float64Array(T);

  const computeEmissions = (t: number) => {
    const vec = selectTriadVector(windowedChroma[t]);
    let maxSim = 0;
    for (let s = 0; s < N; s++) {
      const sim = cosineSimilarity(vec, templates[s].vector);
      simScores[s] = sim;
      if (sim > maxSim) maxSim = sim;
    }

    frameConfidences[t] = Math.max(0, Math.min(1, maxSim));

    // Modulate emission sharpness by harmonic clarity so noisy/percussive frames flatten naturally
    const clarity = Math.max(0.25, Math.min(1.0, (maxSim - 0.35) / 0.5));
    const temp = baseTemp * clarity;

    // Log-softmax over chord templates
    let maxLogit = -Infinity;
    for (let s = 0; s < N; s++) {
      const logit = temp * simScores[s];
      logEmission[s] = logit;
      if (logit > maxLogit) maxLogit = logit;
    }

    let sumExp = 0;
    for (let s = 0; s < N; s++) {
      sumExp += Math.exp(logEmission[s] - maxLogit);
    }
    const logZ = maxLogit + Math.log(sumExp || 1);
    for (let s = 0; s < N; s++) {
      logEmission[s] -= logZ;
    }
  };

  // Initialization (t = 0)
  computeEmissions(0);
  for (let s = 0; s < N; s++) {
    prevDp[s] = logEmission[s] + stateMeta[s].keyPrior;
    backptr[s] = 0;
  }

  // Forward pass
  for (let t = 1; t < T; t++) {
    computeEmissions(t);
    const rowOffset = t * N;

    for (let j = 0; j < N; j++) {
      let bestVal = -Infinity;
      let bestPrev = 0;
      for (let i = 0; i < N; i++) {
        const candidate = prevDp[i] + trans[i * N + j];
        if (candidate > bestVal) {
          bestVal = candidate;
          bestPrev = i;
        }
      }
      currDp[j] = bestVal + logEmission[j] + stateMeta[j].keyPrior;
      backptr[rowOffset + j] = bestPrev;
    }

    let maxDp = -Infinity;
    for (let j = 0; j < N; j++) {
      if (currDp[j] > maxDp) maxDp = currDp[j];
    }
    for (let j = 0; j < N; j++) {
      currDp[j] -= maxDp;
    }

    const tmp = prevDp;
    prevDp = currDp;
    currDp = tmp;
  }

  // Backtrace
  const bestPath = new Int16Array(T);
  let bestLastState = 0;
  let bestLastScore = -Infinity;
  for (let s = 0; s < N; s++) {
    if (prevDp[s] > bestLastScore) {
      bestLastScore = prevDp[s];
      bestLastState = s;
    }
  }
  bestPath[T - 1] = bestLastState;
  for (let t = T - 2; t >= 0; t--) {
    bestPath[t] = backptr[(t + 1) * N + bestPath[t + 1]];
  }

  // Smooth bass estimates & resolve slash chords
  const smoothedBass = enableSlashChords
    ? smoothBassEstimates(windowedChroma.map(w => w.bassEstimate), hopDurationSec)
    : new Array(T).fill(undefined);

  const decodedFrames = windowedChroma.map((w, t) => {
    const baseChord = templates[bestPath[t]].chord;
    const finalChord = enableSlashChords
      ? resolveSlashChord(baseChord, smoothedBass[t], options.keyContext)
      : baseChord;
    return {
      startTime: w.startTime,
      endTime: w.endTime,
      chord: finalChord,
      confidence: Number(frameConfidences[t].toFixed(2))
    };
  });

  return aggregateAndMergeSegments(decodedFrames, minDurationSec);
}

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

  return aggregateAndMergeSegments(filtered, minDurationSec);
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
 * Uses Key-Weighted Viterbi smoothing and dual-band slash-chord detection by default
 * when using the built-in recognizer.
 */
export function detectChordsFromChromagram(
  windowedChroma: WindowedChroma[],
  recognizer: ChordRecognizer = defaultChordRecognizer,
  beats?: number[],
  options: {
    keyContext?: KeyContext;
    enableViterbi?: boolean;
    enableSlashChords?: boolean;
    minDurationSec?: number;
    detectedTempo?: number; // NEW: Tempo for adaptive templating
  } = {}
): ChordSegment[] {
  if (windowedChroma.length === 0) return [];

  const useViterbi = options.enableViterbi ?? (recognizer === defaultChordRecognizer);

  let smoothed: ChordSegment[];
  if (useViterbi && recognizer === defaultChordRecognizer) {
    smoothed = recognizeChordsWithViterbi(windowedChroma, {
      keyContext: options.keyContext,
      enableSlashChords: options.enableSlashChords ?? true,
      minDurationSec: options.minDurationSec ?? 0.75,
      detectedTempo: options.detectedTempo // NEW: Pass tempo
    });
  } else if (useViterbi) {
    const rawFrames: RawChordFrame[] = windowedChroma.map(w => {
      const vec = w.midChroma && w.midChroma.some(v => v > 0.05) ? w.midChroma : w.chroma;
      const res = recognizer.recognize(vec);
      return {
        startTime: w.startTime,
        endTime: w.endTime,
        chord: res.chord,
        confidence: res.confidence,
        bassEstimate: w.bassEstimate,
        midChroma: w.midChroma,
        highChroma: w.highChroma // NEW: Include triple-band high chroma
      };
    });
    smoothed = smoothChordsWithViterbi(rawFrames, {
      keyContext: options.keyContext,
      enableSlashChords: options.enableSlashChords ?? true,
      minDurationSec: options.minDurationSec ?? 0.75,
      detectedTempo: options.detectedTempo // NEW: Pass tempo
    });
  } else {
    const windowPredictions = windowedChroma.map(w => {
      const res = recognizer.recognize(w.chroma);
      return {
        startTime: w.startTime,
        endTime: w.endTime,
        chord: res.chord,
        confidence: res.confidence
      };
    });
    smoothed = smoothChordWindows(windowPredictions, options.minDurationSec ?? 0.75);
  }

  return alignChordsToBeats(smoothed, beats);
}

/**
 * Analyzes chords for an AudioBuffer by slicing into 1-2s windows with overlap,
 * computing dual-band chromagrams (40–180 Hz bass & 180–1200 Hz mid),
 * applying Key-Weighted Viterbi smoothing + slash chord detection, and aligning with beats.
 */
export function analyzeChordsDSP(
  audioBuffer: AudioBuffer,
  options: {
    beats?: number[];
    windowDurationSec?: number;
    hopDurationSec?: number;
    recognizer?: ChordRecognizer;
    keyContext?: KeyContext;
    enableViterbi?: boolean;
    enableSlashChords?: boolean;
    minDurationSec?: number;
  } = {}
): ChordSegment[] {
  const channelData = extractMonoChannelData(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;

  // Windowing: 1.5s with 50% overlap (0.75s hop) & dual-band extraction
  const windowedChroma = computeWindowedChromagrams(channelData, sampleRate, {
    windowDurationSec: options.windowDurationSec ?? 1.5,
    hopDurationSec: options.hopDurationSec ?? 0.75,
    dualBand: true
  });

  return detectChordsFromChromagram(
    windowedChroma,
    options.recognizer || defaultChordRecognizer,
    options.beats,
    {
      keyContext: options.keyContext,
      enableViterbi: options.enableViterbi,
      enableSlashChords: options.enableSlashChords,
      minDurationSec: options.minDurationSec
    }
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
      confidence: Number((c.confidence ?? 1).toFixed(2))
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
    return `${c.chord},${c.startTime.toFixed(3)},${c.endTime.toFixed(3)},${dur},${(c.confidence ?? 1).toFixed(2)}`;
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
export function getCleanChordSequence(
  chords: (ChordSegment | { timestamp?: string; seconds?: number; chord?: string; [key: string]: unknown } | string)[]
): string[] {
  const seq: string[] = [];
  for (const item of chords) {
    const chordName = typeof item === 'string' ? item.trim() : (item.chord ? String(item.chord).trim() : '');
    if (!chordName || chordName === 'N.C.') continue;
    if (seq.length === 0 || seq[seq.length - 1] !== chordName) {
      seq.push(chordName);
    }
  }
  return seq;
}

export { insertChordsIntoSyllables };
export type { InsertChordsOptions };

/**
 * Automatically integrates detected musical chords into the song's lyrics editor text
 * positioned at the corresponding syllables according to audio analysis.
 */
export function insertChordsIntoLyrics(
  currentLyrics: string,
  detectedChords: (ChordSegment | string)[],
  options?: InsertChordsOptions
): string {
  return insertChordsIntoSyllables(currentLyrics, detectedChords, options);
}
