import { AccidentalPreference, transposeChord } from '../../utils/markdownParser';

export type InstrumentType = 'guitar' | 'ukulele' | 'piano';

export interface FrettedVoicing {
  chord: string;
  instrument: 'guitar' | 'ukulele';
  /** Fret number per string (-1 = muted X, 0 = open O, >0 = fret number) */
  frets: number[];
  /** Base fret shown at top of diagram (1 for open chords) */
  baseFret: number;
  /** Optional barre fret indicator */
  barre?: number;
  /** Exact MIDI note numbers for audio synthesis */
  midiNotes: number[];
  /** String labels from lowest to highest */
  stringNames: string[];
}

export interface PianoVoicing {
  chord: string;
  instrument: 'piano';
  /** Exact MIDI notes (e.g. C4=60, E4=64, G4=67) */
  midiNotes: number[];
  /** Pitch classes 0..11 present in chord */
  pitchClasses: number[];
  /** Optional bass pitch class */
  bassPitchClass: number;
  noteNames: string[];
}

export type ChordVoicing = FrettedVoicing | PianoVoicing;

export interface CapoSuggestion {
  capoFret: number;
  playedKey: string;
  openChordCount: number;
  totalUniqueChords: number;
  openChordRatio: number;
  chordMapping: Array<{ sounding: string; shape: string }>;
  summary: string;
}

const NOTE_TO_PC: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface GuitarTuningSpec {
  id: string;
  label: string;
  openMidi: number[]; // 6 strings low-to-high
  stringNames: string[];
}

export const GUITAR_TUNINGS: GuitarTuningSpec[] = [
  { id: 'standard', label: 'Estándar (EADGBE)', openMidi: [40, 45, 50, 55, 59, 64], stringNames: ['E', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'drop_d', label: 'Drop D (DADGBE)', openMidi: [38, 45, 50, 55, 59, 64], stringNames: ['D', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'dadgad', label: 'DADGAD', openMidi: [38, 45, 50, 55, 57, 62], stringNames: ['D', 'A', 'D', 'G', 'A', 'd'] },
  { id: 'half_down', label: 'Medio tono abajo (Eb)', openMidi: [39, 44, 49, 54, 58, 63], stringNames: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'eb'] },
  { id: 'open_g', label: 'Open G (DGDGBD)', openMidi: [38, 43, 50, 55, 59, 62], stringNames: ['D', 'G', 'D', 'G', 'B', 'd'] },
  { id: 'open_d', label: 'Open D (DADF#AD)', openMidi: [38, 45, 50, 54, 57, 62], stringNames: ['D', 'A', 'D', 'F#', 'A', 'd'] }
];

export const UKULELE_OPEN_MIDI = [67, 60, 64, 69]; // G4, C4, E4, A4
export const UKULELE_STRING_NAMES = ['G', 'C', 'E', 'A'];

export function resolveGuitarTuning(tuningStr?: string): GuitarTuningSpec {
  const lower = (tuningStr || '').toLowerCase();
  if (lower.includes('drop d')) return GUITAR_TUNINGS[1];
  if (lower.includes('dadgad')) return GUITAR_TUNINGS[2];
  if (lower.includes('medio tono') || lower.includes('eb ab') || lower.includes('half')) return GUITAR_TUNINGS[3];
  if (lower.includes('open g')) return GUITAR_TUNINGS[4];
  if (lower.includes('open d')) return GUITAR_TUNINGS[5];
  return GUITAR_TUNINGS[0];
}

export function parseChordIntervals(chordSymbol: string): {
  rootPc: number;
  bassPc: number;
  hasExplicitBass: boolean;
  intervals: number[];
  canonicalName: string;
} {
  const cleaned = (chordSymbol || 'C').trim();
  const slashIdx = cleaned.indexOf('/');
  const mainPart = slashIdx >= 0 ? cleaned.slice(0, slashIdx).trim() : cleaned;
  const bassPart = slashIdx >= 0 ? cleaned.slice(slashIdx + 1).trim() : '';

  const match = mainPart.match(/^([A-G][#b]?)(.*)$/i);
  if (!match) {
    return { rootPc: 0, bassPc: 0, hasExplicitBass: false, intervals: [0, 4, 7], canonicalName: cleaned };
  }

  const rootName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const rootPc = NOTE_TO_PC[rootName] ?? 0;
  const suffix = match[2].trim();

  let bassPc = rootPc;
  let hasExplicitBass = false;
  if (bassPart) {
    const bassMatch = bassPart.match(/^([A-G][#b]?)$/i);
    if (bassMatch) {
      const bassName = bassMatch[1].charAt(0).toUpperCase() + bassMatch[1].slice(1);
      if (NOTE_TO_PC[bassName] !== undefined) {
        bassPc = NOTE_TO_PC[bassName];
        hasExplicitBass = bassPc !== rootPc;
      }
    }
  }

  let intervals = [0, 4, 7];
  if (suffix === '' || suffix === 'maj') intervals = [0, 4, 7];
  else if (suffix === 'm' || suffix === 'min') intervals = [0, 3, 7];
  else if (suffix === '5') intervals = [0, 7];
  else if (suffix === '7') intervals = [0, 4, 7, 10];
  else if (suffix === 'maj7' || suffix === 'M7') intervals = [0, 4, 7, 11];
  else if (suffix === 'm7' || suffix === 'min7') intervals = [0, 3, 7, 10];
  else if (suffix === 'mMaj7' || suffix === 'm(maj7)') intervals = [0, 3, 7, 11];
  else if (suffix === 'sus2') intervals = [0, 2, 7];
  else if (suffix === 'sus4' || suffix === 'sus') intervals = [0, 5, 7];
  else if (suffix === '7sus4') intervals = [0, 5, 7, 10];
  else if (suffix === '7sus2') intervals = [0, 2, 7, 10];
  else if (suffix === 'dim' || suffix === '°') intervals = [0, 3, 6];
  else if (suffix === 'dim7' || suffix === '°7') intervals = [0, 3, 6, 9];
  else if (suffix === 'm7b5' || suffix === 'ø' || suffix === 'ø7') intervals = [0, 3, 6, 10];
  else if (suffix === 'aug' || suffix === '+') intervals = [0, 4, 8];
  else if (suffix === 'add9' || suffix === 'add2') intervals = [0, 4, 7, 14];
  else if (suffix === 'madd9' || suffix === 'madd2') intervals = [0, 3, 7, 14];
  else if (suffix === '6') intervals = [0, 4, 7, 9];
  else if (suffix === 'm6') intervals = [0, 3, 7, 9];
  else if (suffix === '6/9') intervals = [0, 4, 7, 9, 14];
  else if (suffix === '9') intervals = [0, 4, 7, 10, 14];
  else if (suffix === 'm9') intervals = [0, 3, 7, 10, 14];
  else if (suffix === 'maj9' || suffix === 'M9') intervals = [0, 4, 7, 11, 14];
  else if (suffix === '7b9') intervals = [0, 4, 7, 10, 13];
  else if (suffix === '7#9') intervals = [0, 4, 7, 10, 15];
  else if (suffix === '7b5') intervals = [0, 4, 6, 10];
  else if (suffix === '7#5') intervals = [0, 4, 8, 10];
  else if (suffix === '11') intervals = [0, 4, 7, 10, 17];
  else if (suffix.startsWith('m')) intervals = [0, 3, 7];

  return { rootPc, bassPc, hasExplicitBass, intervals, canonicalName: cleaned };
}

/**
 * Curated canonical open & common guitar chord shapes in Standard EADGBE tuning
 * for best idiomatic fingerings.
 */
const STANDARD_GUITAR_VOICINGS: Record<string, { frets: number[]; barre?: number }> = {
  'C': { frets: [-1, 3, 2, 0, 1, 0] },
  'C7': { frets: [-1, 3, 2, 3, 1, 0] },
  'Cmaj7': { frets: [-1, 3, 2, 0, 0, 0] },
  'Cadd9': { frets: [-1, 3, 2, 0, 3, 0] },
  'C/E': { frets: [0, 3, 2, 0, 1, 0] },
  'C/G': { frets: [3, 3, 2, 0, 1, 0] },
  'C/B': { frets: [-1, 2, 2, 0, 1, 0] },
  'C/D': { frets: [-1, -1, 0, 0, 1, 0] },
  'C/A': { frets: [-1, 0, 2, 0, 1, 0] },
  'Cm': { frets: [-1, 3, 5, 5, 4, 3], barre: 3 },
  'Cm7': { frets: [-1, 3, 5, 3, 4, 3], barre: 3 },
  'D': { frets: [-1, -1, 0, 2, 3, 2] },
  'D7': { frets: [-1, -1, 0, 2, 1, 2] },
  'Dmaj7': { frets: [-1, -1, 0, 2, 2, 2] },
  'Dsus2': { frets: [-1, -1, 0, 2, 3, 0] },
  'Dsus4': { frets: [-1, -1, 0, 2, 3, 3] },
  'D/A': { frets: [-1, 0, 0, 2, 3, 2] },
  'D/B': { frets: [-1, 2, 0, 2, 3, 2] },
  'D/E': { frets: [0, 0, 0, 2, 3, 2] },
  'D/F#': { frets: [2, -1, 0, 2, 3, 2] },
  'Dm': { frets: [-1, -1, 0, 2, 3, 1] },
  'Dm7': { frets: [-1, -1, 0, 2, 1, 1] },
  'E': { frets: [0, 2, 2, 1, 0, 0] },
  'E7': { frets: [0, 2, 0, 1, 0, 0] },
  'Emaj7': { frets: [0, 2, 1, 1, 0, 0] },
  'Em': { frets: [0, 2, 2, 0, 0, 0] },
  'Em7': { frets: [0, 2, 2, 0, 3, 0] },
  'Em/G': { frets: [3, 2, 2, 0, 0, 0] },
  'Em/B': { frets: [-1, 2, 2, 0, 0, 0] },
  'Em/C': { frets: [-1, 3, 2, 0, 0, 0] },
  'Em/F#': { frets: [2, 2, 2, 0, 0, 0] },
  'F': { frets: [1, 3, 3, 2, 1, 1], barre: 1 },
  'Fmaj7': { frets: [-1, -1, 3, 2, 1, 0] },
  'F/A': { frets: [-1, 0, 3, 2, 1, 1] },
  'F/C': { frets: [-1, 3, 3, 2, 1, 1] },
  'F/D': { frets: [-1, -1, 0, 2, 1, 1] },
  'F/G': { frets: [3, -1, 3, 2, 1, 1] },
  'Fm': { frets: [1, 3, 3, 1, 1, 1], barre: 1 },
  'F#': { frets: [2, 4, 4, 3, 2, 2], barre: 2 },
  'F#m': { frets: [2, 4, 4, 2, 2, 2], barre: 2 },
  'F#7': { frets: [2, 4, 2, 3, 2, 2], barre: 2 },
  'G': { frets: [3, 2, 0, 0, 0, 3] },
  'G7': { frets: [3, 2, 0, 0, 0, 1] },
  'Gmaj7': { frets: [3, 2, 0, 0, 0, 2] },
  'Gsus4': { frets: [3, 3, 0, 0, 1, 3] },
  'G/A': { frets: [-1, 0, 0, 0, 0, 3] },
  'G/B': { frets: [-1, 2, 0, 0, 3, 3] },
  'G/C': { frets: [-1, 3, 0, 0, 0, 3] },
  'G/D': { frets: [-1, -1, 0, 0, 0, 3] },
  'G/E': { frets: [0, 2, 0, 0, 0, 3] },
  'G/F#': { frets: [2, 2, 0, 0, 0, 3] },
  'Gm': { frets: [3, 5, 5, 3, 3, 3], barre: 3 },
  'A': { frets: [-1, 0, 2, 2, 2, 0] },
  'A7': { frets: [-1, 0, 2, 0, 2, 0] },
  'Amaj7': { frets: [-1, 0, 2, 1, 2, 0] },
  'Asus2': { frets: [-1, 0, 2, 2, 0, 0] },
  'Asus4': { frets: [-1, 0, 2, 2, 3, 0] },
  'A/E': { frets: [0, 0, 2, 2, 2, 0] },
  'Am': { frets: [-1, 0, 2, 2, 1, 0] },
  'Am7': { frets: [-1, 0, 2, 0, 1, 0] },
  'Am/C': { frets: [-1, 3, 2, 2, 1, 0] },
  'Am/E': { frets: [0, 0, 2, 2, 1, 0] },
  'Am/F#': { frets: [2, 0, 2, 2, 1, 0] },
  'Am/G': { frets: [3, 0, 2, 2, 1, 0] },
  'B': { frets: [-1, 2, 4, 4, 4, 2], barre: 2 },
  'B7': { frets: [-1, 2, 1, 2, 0, 2] },
  'Bm': { frets: [-1, 2, 4, 4, 3, 2], barre: 2 },
  'Bm7': { frets: [-1, 2, 4, 2, 3, 2], barre: 2 },
  'Bm7b5': { frets: [-1, 2, 3, 2, 3, -1] },
  'Bm/D': { frets: [-1, -1, 0, 4, 3, 2] },
  'Bm/E': { frets: [0, 2, 4, 4, 3, 2], barre: 2 },
  'Bb': { frets: [-1, 1, 3, 3, 3, 1], barre: 1 },
  'Bbm': { frets: [-1, 1, 3, 3, 2, 1], barre: 1 },
  'Eb': { frets: [-1, -1, 1, 3, 4, 3] },
  'Ab': { frets: [4, 6, 6, 5, 4, 4], barre: 4 },
  'C#m': { frets: [-1, 4, 6, 6, 5, 4], barre: 4 },
  'G#m': { frets: [4, 6, 6, 4, 4, 4], barre: 4 }
};

const UKULELE_VOICINGS: Record<string, number[]> = {
  'C': [0, 0, 0, 3],
  'Cm': [0, 3, 3, 3],
  'C7': [0, 0, 0, 1],
  'Cmaj7': [0, 0, 0, 2],
  'D': [2, 2, 2, 0],
  'Dm': [2, 2, 1, 0],
  'D7': [2, 2, 2, 3],
  'E': [1, 4, 0, 2],
  'Em': [0, 4, 3, 2],
  'E7': [1, 2, 0, 2],
  'F': [2, 0, 1, 0],
  'Fm': [1, 0, 1, 3],
  'F7': [2, 3, 1, 0],
  'G': [0, 2, 3, 2],
  'Gm': [0, 2, 3, 1],
  'G7': [0, 2, 1, 2],
  'A': [2, 1, 0, 0],
  'Am': [2, 0, 0, 0],
  'A7': [0, 1, 0, 0],
  'Am7': [0, 0, 0, 0],
  'B': [4, 3, 2, 2],
  'Bm': [4, 2, 2, 2],
  'B7': [2, 3, 2, 2],
  'Bb': [3, 2, 1, 1]
};

interface PlayabilityEvaluation {
  playable: boolean;
  fingersNeeded: number;
  barreFret?: number;
}

/**
 * Checks physical playability of a fretted voicing (<= 4 fingers, valid barre geometry, <= 3 fret span).
 */
function evaluatePlayability(frets: number[]): PlayabilityEvaluation {
  const numStrings = frets.length;
  const pos = frets.filter(f => f > 0);
  if (pos.length === 0) {
    return { playable: true, fingersNeeded: 0 };
  }

  const minF = Math.min(...pos);
  const maxF = Math.max(...pos);
  if (maxF - minF > 3) {
    return { playable: false, fingersNeeded: 99 };
  }

  // Check if a barre at minF is physically possible
  const minIndices: number[] = [];
  for (let s = 0; s < numStrings; s++) {
    if (frets[s] === minF) minIndices.push(s);
  }
  const firstMin = minIndices[0];
  const lastMin = minIndices[minIndices.length - 1];
  const hasOpenAboveOrInBarre = frets.slice(firstMin).some(f => f === 0);
  const hasMuteInsideBarre = frets.slice(firstMin, lastMin + 1).some(f => f === -1);
  const canBarreAtMin = minIndices.length >= 2 && !hasOpenAboveOrInBarre && !hasMuteInsideBarre;

  if (pos.length <= 4) {
    // Only show a barre bar for <=4 fretted notes if it spans 4+ strings cleanly (e.g. partial 4-string barre)
    const shouldShowBarre = canBarreAtMin && lastMin - firstMin >= 3;

    return {
      playable: true,
      fingersNeeded: shouldShowBarre ? 1 + pos.filter(f => f > minF).length : pos.length,
      barreFret: shouldShowBarre ? minF : undefined
    };
  }

  // More than 4 fretted strings requires a barre at minF
  if (!canBarreAtMin) {
    return { playable: false, fingersNeeded: 99 };
  }

  const fingersAboveMin = pos.filter(f => f > minF).length;
  const totalFingers = 1 + fingersAboveMin;
  if (totalFingers > 4) {
    return { playable: false, fingersNeeded: totalFingers };
  }

  // Disallow awkward inverted barres where 2+ bass strings are fretted higher below a mid-neck barre
  if (firstMin >= 2 && firstMin < numStrings - 2) {
    const frettedBeforeBarre = frets.slice(0, firstMin).filter(f => f > minF).length;
    if (frettedBeforeBarre >= 2 && pos.length > 4) {
      return { playable: false, fingersNeeded: 99 };
    }
  }

  return {
    playable: true,
    fingersNeeded: totalFingers,
    barreFret: minF
  };
}

/**
 * Exact backtracking fretted voicing solver that works for ANY tuning (Drop D, DADGAD, Open G, etc.)
 * and ANY chord symbol (including slash chords with non-chord-tone basses such as G/E or F/D).
 */
function solveFrettedVoicing(
  chordSymbol: string,
  openMidi: number[],
  stringNames: string[],
  instrument: 'guitar' | 'ukulele'
): FrettedVoicing {
  const { rootPc, bassPc, hasExplicitBass, intervals } = parseChordIntervals(chordSymbol);
  const targetPcs = new Set(intervals.map(iv => (rootPc + iv) % 12));
  const thirdPc = intervals.length >= 2 ? (rootPc + intervals[1]) % 12 : null;
  const fifthPc = intervals.length >= 3 ? (rootPc + intervals[2]) % 12 : null;
  const extensionPc = intervals.length >= 4 ? (rootPc + intervals[3]) % 12 : null;
  const numStrings = openMidi.length;
  const minRequiredStrings = numStrings >= 6 ? 4 : 3;

  const runSearch = (enforceBassAsLowest: boolean): { frets: number[]; barre?: number; score: number } | null => {
    let bestFrets: number[] | null = null;
    let bestBarre: number | undefined;
    let bestScore = -Infinity;
    const seenKeys = new Set<string>();

    const evaluateCandidate = (frets: number[]) => {
      const key = frets.join(',');
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const play = evaluatePlayability(frets);
      if (!play.playable) return;

      const soundedMidi: number[] = [];
      const soundedStrings: number[] = [];
      for (let s = 0; s < numStrings; s++) {
        if (frets[s] >= 0) {
          soundedMidi.push(openMidi[s] + frets[s]);
          soundedStrings.push(s);
        }
      }
      if (soundedStrings.length < minRequiredStrings) return;

      const firstSounded = soundedStrings[0];
      const lastSounded = soundedStrings[soundedStrings.length - 1];
      const firstMidi = openMidi[firstSounded] + frets[firstSounded];
      const lowestMidi = Math.min(...soundedMidi);

      // Avoid pitch-crossover where a higher string sounds lower than the first sounded string on guitar
      if (instrument === 'guitar' && firstMidi > lowestMidi) return;

      const lowestPc = lowestMidi % 12;
      if (enforceBassAsLowest && lowestPc !== bassPc) return;

      // Count interior & trailing mutes
      let interiorMutes = 0;
      for (let s = firstSounded + 1; s < lastSounded; s++) {
        if (frets[s] === -1) {
          // On guitar, allow at most 1 damped A-string mute when low E string is fretted/sounded
          if (instrument === 'guitar' && s === 1 && firstSounded === 0 && interiorMutes === 0) {
            interiorMutes++;
          } else {
            return;
          }
        }
      }
      const trailingMutes = numStrings - 1 - lastSounded;
      if (trailingMutes > 1) return;

      // Evaluate covered chord tones
      const coveredChordPcs = new Set<number>();
      let includesBass = false;
      for (let s = 0; s < numStrings; s++) {
        if (frets[s] < 0) continue;
        const pc = (openMidi[s] + frets[s]) % 12;
        if (pc === bassPc) includesBass = true;
        if (targetPcs.has(pc)) {
          // If this is a slash chord whose bass is not a chord tone, don't count bass string toward chord tones
          if (!(s === firstSounded && hasExplicitBass && !targetPcs.has(bassPc))) {
            coveredChordPcs.add(pc);
          }
        }
      }

      const pos = frets.filter(f => f > 0);
      const minF = pos.length > 0 ? Math.min(...pos) : 0;
      const maxF = pos.length > 0 ? Math.max(...pos) : 0;
      const openCount = frets.filter(f => f === 0).length;

      let score = 0;
      score += coveredChordPcs.size * 26;
      if (!coveredChordPcs.has(rootPc)) score -= 65;
      if (thirdPc !== null && !coveredChordPcs.has(thirdPc)) score -= 42;
      if (extensionPc !== null && !coveredChordPcs.has(extensionPc)) score -= 32;
      if (fifthPc !== null && !coveredChordPcs.has(fifthPc)) score -= 12;

      if (hasExplicitBass && lowestPc === bassPc) score += 50;
      else if (includesBass) score += 12;

      score += soundedStrings.length * 6;
      score += openCount * 4.5;
      score -= interiorMutes * 14;
      score -= trailingMutes * 10;
      score -= minF * 3.0;
      score -= (maxF - minF) * 0.8;
      score -= play.fingersNeeded * 1.2;
      if (play.barreFret !== undefined) score -= 3;

      // Low-register clarity penalty for adjacent minor/major 2nd or unison on the lowest two strings
      if (instrument === 'guitar' && frets[0] >= 0 && frets[1] >= 0) {
        const lowGap = (openMidi[1] + frets[1]) - (openMidi[0] + frets[0]);
        if (lowGap === 0) score -= 16;
        else if (lowGap === 1) score -= 20;
        else if (lowGap === 2) score -= 8;
      }

      if (score > bestScore) {
        bestScore = score;
        bestFrets = [...frets];
        bestBarre = play.barreFret;
      }
    };

    const searchWindow = (minPos: number, maxPos: number) => {
      const frets = new Array<number>(numStrings).fill(-1);

      const backtrack = (
        s: number,
        hasSounded: boolean,
        hasBassNote: boolean,
        minFSoFar: number,
        maxFSoFar: number,
        interiorMutes: number
      ) => {
        if (s === numStrings) {
          if (hasSounded && (!enforceBassAsLowest || hasBassNote)) {
            evaluateCandidate(frets);
          }
          return;
        }

        const openPc = openMidi[s] % 12;
        const candidateFrets: number[] = [];
        if (minPos <= 3) candidateFrets.push(0);
        const startF = minPos === 0 ? 1 : minPos;
        for (let f = startF; f <= maxPos; f++) {
          candidateFrets.push(f);
        }

        // Option 1: sounded frets on string s
        for (const f of candidateFrets) {
          const pc = (openPc + f) % 12;
          if (!hasSounded) {
            if (enforceBassAsLowest && instrument === 'guitar' && pc !== bassPc) continue;
            if (!targetPcs.has(pc) && pc !== bassPc) continue;
          } else {
            if (!targetPcs.has(pc)) continue;
          }

          const nextMinF = f > 0 ? Math.min(minFSoFar, f) : minFSoFar;
          const nextMaxF = f > 0 ? Math.max(maxFSoFar, f) : maxFSoFar;
          if (nextMaxF > 0 && nextMinF < 99 && nextMaxF - nextMinF > 3) continue;

          frets[s] = f;
          backtrack(
            s + 1,
            true,
            hasBassNote || pc === bassPc,
            nextMinF,
            nextMaxF,
            interiorMutes
          );
          frets[s] = -1;
        }

        // Option 2: muted string (-1)
        const canMuteLeading = !hasSounded && (numStrings - 1 - s) >= minRequiredStrings;
        const canMuteInteriorA = hasSounded && instrument === 'guitar' && s === 1 && interiorMutes === 0;
        const canMuteTrailingLast = hasSounded && s === numStrings - 1;
        if (canMuteLeading || canMuteInteriorA || canMuteTrailingLast) {
          frets[s] = -1;
          backtrack(
            s + 1,
            hasSounded,
            hasBassNote,
            minFSoFar,
            maxFSoFar,
            hasSounded && s < numStrings - 1 ? interiorMutes + 1 : interiorMutes
          );
        }
      };

      backtrack(0, false, false, 99, 0, 0);
    };

    searchWindow(0, 4);
    for (let startFret = 1; startFret <= 9; startFret++) {
      searchWindow(startFret, startFret + 3);
    }

    return bestFrets ? { frets: bestFrets, barre: bestBarre, score: bestScore } : null;
  };

  // On guitar always enforce exact bass; on re-entrant ukulele enforce exact lowest-note bass for slash chords with graceful fallback
  const strictBass = instrument === 'guitar' || hasExplicitBass;
  const result = runSearch(strictBass) ?? (strictBass ? runSearch(false) : null);
  const chosenFrets = result?.frets ?? new Array(numStrings).fill(-1);

  const positiveFrets = chosenFrets.filter(f => f > 0);
  const minPos = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const maxPos = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 1;
  const baseFret = maxPos <= 4 ? 1 : minPos;

  const midiNotes: number[] = [];
  for (let s = 0; s < numStrings; s++) {
    if (chosenFrets[s] >= 0) {
      midiNotes.push(openMidi[s] + chosenFrets[s]);
    }
  }

  return {
    chord: chordSymbol,
    instrument,
    frets: chosenFrets,
    baseFret,
    barre: result?.barre,
    midiNotes,
    stringNames
  };
}

const ENHARMONIC_PAIRS: Record<string, string> = {
  'Db': 'C#', 'C#': 'Db',
  'Eb': 'D#', 'D#': 'Eb',
  'Gb': 'F#', 'F#': 'Gb',
  'Ab': 'G#', 'G#': 'Ab',
  'Bb': 'A#', 'A#': 'Bb'
};

function findCuratedVoicing<T>(
  table: Record<string, T>,
  chord: string
): T | undefined {
  const clean = chord.trim();
  if (table[clean]) return table[clean];

  const slashIdx = clean.indexOf('/');
  const mainPart = slashIdx >= 0 ? clean.slice(0, slashIdx).trim() : clean;
  const bassPart = slashIdx >= 0 ? clean.slice(slashIdx + 1).trim() : '';

  const m = mainPart.match(/^([A-G][#b]?)(.*)$/i);
  if (!m) return undefined;

  const root = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  const suffix = m[2];
  const rootVariants = ENHARMONIC_PAIRS[root] ? [root, ENHARMONIC_PAIRS[root]] : [root];

  let bassVariants = [''];
  if (bassPart) {
    const normBass = bassPart.charAt(0).toUpperCase() + bassPart.slice(1);
    bassVariants = ENHARMONIC_PAIRS[normBass] ? [normBass, ENHARMONIC_PAIRS[normBass]] : [normBass];
  }

  for (const r of rootVariants) {
    for (const b of bassVariants) {
      const candidate = b ? `${r}${suffix}/${b}` : `${r}${suffix}`;
      if (table[candidate]) return table[candidate];
    }
  }
  return undefined;
}

export function getGuitarVoicing(chordSymbol: string, tuningStr?: string): FrettedVoicing {
  const tuning = resolveGuitarTuning(tuningStr);
  const clean = chordSymbol.trim();

  if (tuning.id === 'standard') {
    const direct = findCuratedVoicing(STANDARD_GUITAR_VOICINGS, clean);
    if (direct) {
      const positive = direct.frets.filter(f => f > 0);
      const maxF = positive.length > 0 ? Math.max(...positive) : 1;
      const minF = positive.length > 0 ? Math.min(...positive) : 1;
      const baseFret = maxF <= 4 ? 1 : minF;
      const midiNotes = direct.frets
        .map((f, s) => (f >= 0 ? tuning.openMidi[s] + f : -1))
        .filter(n => n >= 0);

      return {
        chord: clean,
        instrument: 'guitar',
        frets: direct.frets,
        baseFret,
        barre: direct.barre,
        midiNotes,
        stringNames: tuning.stringNames
      };
    }
  }

  return solveFrettedVoicing(clean, tuning.openMidi, tuning.stringNames, 'guitar');
}

export function getUkuleleVoicing(chordSymbol: string): FrettedVoicing {
  const clean = chordSymbol.trim();
  const direct = findCuratedVoicing(UKULELE_VOICINGS, clean);
  if (direct) {
    const maxF = Math.max(...direct);
    const minF = Math.min(...direct.filter(f => f > 0), 1);
    const baseFret = maxF <= 4 ? 1 : minF;
    const midiNotes = direct.map((f, s) => UKULELE_OPEN_MIDI[s] + f);
    return {
      chord: clean,
      instrument: 'ukulele',
      frets: direct,
      baseFret,
      midiNotes,
      stringNames: UKULELE_STRING_NAMES
    };
  }
  return solveFrettedVoicing(clean, UKULELE_OPEN_MIDI, UKULELE_STRING_NAMES, 'ukulele');
}

export function getPianoVoicing(chordSymbol: string): PianoVoicing {
  const { rootPc, bassPc, intervals } = parseChordIntervals(chordSymbol);
  const baseOctave = 60; // C4
  const chordMidi = intervals.map(iv => baseOctave + rootPc + iv);
  const bassMidi = 48 + bassPc; // C3 bass octave
  const midiNotes = [bassMidi, ...chordMidi];

  const pitchClasses = Array.from(new Set(intervals.map(iv => (rootPc + iv) % 12)));
  const noteNames = pitchClasses.map(pc => PC_NAMES[pc]);

  return {
    chord: chordSymbol.trim(),
    instrument: 'piano',
    midiNotes,
    pitchClasses,
    bassPitchClass: bassPc,
    noteNames
  };
}

export function getChordVoicing(
  chordSymbol: string,
  instrument: InstrumentType,
  tuning?: string
): ChordVoicing {
  if (instrument === 'piano') return getPianoVoicing(chordSymbol);
  if (instrument === 'ukulele') return getUkuleleVoicing(chordSymbol);
  return getGuitarVoicing(chordSymbol, tuning);
}

/**
 * Extracts unique ordered chord symbols from lyrics markdown [Am] [G7]...
 */
export function extractUniqueChordsFromLyrics(lyrics: string): string[] {
  if (!lyrics) return [];
  const matches = lyrics.match(/\[([A-G][#b]?[^\]]*)\]/g);
  if (!matches) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const token of matches) {
    const chord = token.slice(1, -1).trim();
    if (chord && !seen.has(chord)) {
      seen.add(chord);
      ordered.push(chord);
    }
  }
  return ordered;
}

const OPEN_FRIENDLY_CHORDS = new Set([
  'C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm',
  'C7', 'G7', 'D7', 'A7', 'E7', 'Am7', 'Em7', 'Dm7',
  'Cmaj7', 'Fmaj7', 'G6', 'Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Cadd9', 'C/G', 'Am/G'
]);

/**
 * Computes the played chord shape when a capo is placed at `capoFret` (1..9).
 */
export function chordShapeWithCapo(
  soundingChord: string,
  capoFret: number,
  preference: AccidentalPreference = 'sharps'
): string {
  if (capoFret <= 0) return soundingChord;
  return transposeChord(soundingChord, -capoFret, preference);
}

/**
 * Suggests the optimal guitar capo fret (0..9) that maximizes comfortable open chord shapes
 * for a given song's chord set and sounding key.
 */
export function suggestOptimalCapo(
  chordsInSong: string[],
  soundingKey: string = 'Am',
  preference: AccidentalPreference = 'sharps'
): CapoSuggestion[] {
  const uniqueChords = Array.from(new Set(chordsInSong.filter(Boolean)));
  if (uniqueChords.length === 0) {
    return [
      {
        capoFret: 0,
        playedKey: soundingKey,
        openChordCount: 0,
        totalUniqueChords: 0,
        openChordRatio: 1,
        chordMapping: [],
        summary: `Sin cejilla · Tocar en ${soundingKey}`
      }
    ];
  }

  const results: CapoSuggestion[] = [];

  for (let fret = 0; fret <= 9; fret++) {
    const chordMapping = uniqueChords.map(sounding => ({
      sounding,
      shape: chordShapeWithCapo(sounding, fret, preference)
    }));

    let score = 0;
    let openCount = 0;

    for (const item of chordMapping) {
      const baseNoBass = item.shape.split('/')[0];
      if (OPEN_FRIENDLY_CHORDS.has(item.shape) || OPEN_FRIENDLY_CHORDS.has(baseNoBass)) {
        openCount++;
        score += 10;
      } else if (baseNoBass === 'F' || baseNoBass === 'Bm' || baseNoBass === 'F#m') {
        score += 3; // common single barre
      } else if (!baseNoBass.includes('#') && !baseNoBass.includes('b')) {
        score += 4;
      } else {
        score -= 3; // sharp/flat barre chords penalized
      }
    }

    // Gentle preference for lower capo positions (0..5) when tied
    score -= fret * 0.35;
    if (fret === 0) score += 1.5;

    const playedKey = transposeChord(soundingKey, -fret, preference);
    const ratio = Number((openCount / uniqueChords.length).toFixed(2));
    const summary =
      fret === 0
        ? `Sin cejilla · Tocar en ${playedKey}`
        : `Tono real: ${soundingKey} → Cejilla en ${fret}.º traste, tocar en ${playedKey}`;

    results.push({
      capoFret: fret,
      playedKey,
      openChordCount: openCount,
      totalUniqueChords: uniqueChords.length,
      openChordRatio: ratio,
      chordMapping,
      summary,
      _score: score
    } as CapoSuggestion & { _score: number });
  }

  results.sort((a: any, b: any) => b._score - a._score);
  return results.map(({ _score, ...rest }: any) => rest);
}
