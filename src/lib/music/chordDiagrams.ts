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
  intervals: number[];
  canonicalName: string;
} {
  const cleaned = (chordSymbol || 'C').trim();
  const [mainPart, bassPart] = cleaned.split('/');
  const match = mainPart.match(/^([A-G][#b]?)(.*)$/);
  if (!match) {
    return { rootPc: 0, bassPc: 0, intervals: [0, 4, 7], canonicalName: cleaned };
  }

  const rootName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const rootPc = NOTE_TO_PC[rootName] ?? 0;
  const suffix = match[2].trim();
  const bassPc = bassPart ? (NOTE_TO_PC[bassPart.trim()] ?? rootPc) : rootPc;

  let intervals = [0, 4, 7];
  if (suffix === '' || suffix === 'maj') intervals = [0, 4, 7];
  else if (suffix === 'm' || suffix === 'min') intervals = [0, 3, 7];
  else if (suffix === '5') intervals = [0, 7];
  else if (suffix === '7') intervals = [0, 4, 7, 10];
  else if (suffix === 'maj7' || suffix === 'M7') intervals = [0, 4, 7, 11];
  else if (suffix === 'm7' || suffix === 'min7') intervals = [0, 3, 7, 10];
  else if (suffix === 'mMaj7') intervals = [0, 3, 7, 11];
  else if (suffix === 'sus2') intervals = [0, 2, 7];
  else if (suffix === 'sus4' || suffix === 'sus') intervals = [0, 5, 7];
  else if (suffix === '7sus4') intervals = [0, 5, 7, 10];
  else if (suffix === 'dim' || suffix === '°') intervals = [0, 3, 6];
  else if (suffix === 'dim7' || suffix === '°7') intervals = [0, 3, 6, 9];
  else if (suffix === 'm7b5' || suffix === 'ø' || suffix === 'ø7') intervals = [0, 3, 6, 10];
  else if (suffix === 'aug' || suffix === '+') intervals = [0, 4, 8];
  else if (suffix === 'add9') intervals = [0, 4, 7, 14];
  else if (suffix === 'madd9') intervals = [0, 3, 7, 14];
  else if (suffix === '6') intervals = [0, 4, 7, 9];
  else if (suffix === 'm6') intervals = [0, 3, 7, 9];
  else if (suffix === '9') intervals = [0, 4, 7, 10, 14];
  else if (suffix === 'm9') intervals = [0, 3, 7, 10, 14];
  else if (suffix.startsWith('m')) intervals = [0, 3, 7];

  return { rootPc, bassPc, intervals, canonicalName: cleaned };
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
  'C/G': { frets: [3, 3, 2, 0, 1, 0] },
  'Cm': { frets: [-1, 3, 5, 5, 4, 3], barre: 3 },
  'Cm7': { frets: [-1, 3, 5, 3, 4, 3], barre: 3 },
  'D': { frets: [-1, -1, 0, 2, 3, 2] },
  'D7': { frets: [-1, -1, 0, 2, 1, 2] },
  'Dmaj7': { frets: [-1, -1, 0, 2, 2, 2] },
  'Dsus2': { frets: [-1, -1, 0, 2, 3, 0] },
  'Dsus4': { frets: [-1, -1, 0, 2, 3, 3] },
  'D/F#': { frets: [2, -1, 0, 2, 3, 2] },
  'Dm': { frets: [-1, -1, 0, 2, 3, 1] },
  'Dm7': { frets: [-1, -1, 0, 2, 1, 1] },
  'E': { frets: [0, 2, 2, 1, 0, 0] },
  'E7': { frets: [0, 2, 0, 1, 0, 0] },
  'Emaj7': { frets: [0, 2, 1, 1, 0, 0] },
  'Em': { frets: [0, 2, 2, 0, 0, 0] },
  'Em7': { frets: [0, 2, 2, 0, 3, 0] },
  'F': { frets: [1, 3, 3, 2, 1, 1], barre: 1 },
  'Fmaj7': { frets: [-1, -1, 3, 2, 1, 0] },
  'Fm': { frets: [1, 3, 3, 1, 1, 1], barre: 1 },
  'F#m': { frets: [2, 4, 4, 2, 2, 2], barre: 2 },
  'F#7': { frets: [2, 4, 2, 3, 2, 2], barre: 2 },
  'G': { frets: [3, 2, 0, 0, 0, 3] },
  'G7': { frets: [3, 2, 0, 0, 0, 1] },
  'Gmaj7': { frets: [3, 2, 0, 0, 0, 2] },
  'Gsus4': { frets: [3, 3, 0, 0, 1, 3] },
  'G/B': { frets: [-1, 2, 0, 0, 3, 3] },
  'Gm': { frets: [3, 5, 5, 3, 3, 3], barre: 3 },
  'A': { frets: [-1, 0, 2, 2, 2, 0] },
  'A7': { frets: [-1, 0, 2, 0, 2, 0] },
  'Amaj7': { frets: [-1, 0, 2, 1, 2, 0] },
  'Asus2': { frets: [-1, 0, 2, 2, 0, 0] },
  'Asus4': { frets: [-1, 0, 2, 2, 3, 0] },
  'Am': { frets: [-1, 0, 2, 2, 1, 0] },
  'Am7': { frets: [-1, 0, 2, 0, 1, 0] },
  'Am/G': { frets: [3, 0, 2, 2, 1, 0] },
  'B': { frets: [-1, 2, 4, 4, 4, 2], barre: 2 },
  'B7': { frets: [-1, 2, 1, 2, 0, 2] },
  'Bm': { frets: [-1, 2, 4, 4, 3, 2], barre: 2 },
  'Bm7': { frets: [-1, 2, 4, 2, 3, 2], barre: 2 },
  'Bm7b5': { frets: [-1, 2, 3, 2, 3, -1] },
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

/**
 * Algorithmic fretted voicing solver that works for ANY tuning (Drop D, DADGAD, Open G, etc.)
 * and ANY chord symbol (including slash chords).
 */
function solveFrettedVoicing(
  chordSymbol: string,
  openMidi: number[],
  stringNames: string[],
  instrument: 'guitar' | 'ukulele'
): FrettedVoicing {
  const { rootPc, bassPc, intervals } = parseChordIntervals(chordSymbol);
  const targetPcs = new Set(intervals.map(iv => (rootPc + iv) % 12));
  const numStrings = openMidi.length;

  // Try candidate fret windows (0..4, then movable positions 1..10)
  let bestFrets: number[] = new Array(numStrings).fill(-1);
  let bestScore = -Infinity;

  const tryWindow = (minPos: number, maxPos: number) => {
    const frets = new Array<number>(numStrings).fill(-1);
    let bassAssigned = false;

    for (let s = 0; s < numStrings; s++) {
      const openPc = openMidi[s] % 12;
      let bestFretForString = -1;
      let bestStringScore = -Infinity;

      // Consider open string (fret 0) if valid chord tone
      const candidateFrets = minPos === 0 ? [0, 1, 2, 3, 4] : Array.from({ length: maxPos - minPos + 1 }, (_, k) => minPos + k);

      for (const fret of candidateFrets) {
        const pc = (openPc + fret) % 12;
        if (!targetPcs.has(pc)) continue;

        let score = 0;
        if (!bassAssigned) {
          if (pc === bassPc) {
            score += 45;
          } else if (pc === rootPc) {
            score += 20;
          } else {
            continue; // lowest sounded string must match bass or root
          }
        } else {
          if (pc === rootPc) score += 10;
          else score += 8;
        }

        if (fret === 0) score += 8; // open strings ring warmly
        score -= Math.abs(fret - minPos) * 1.5;

        if (score > bestStringScore) {
          bestStringScore = score;
          bestFretForString = fret;
        }
      }

      if (bestFretForString !== -1) {
        frets[s] = bestFretForString;
        if (!bassAssigned) bassAssigned = true;
      } else if (s === 0 && !bassAssigned) {
        frets[s] = -1; // mute lowest string if bass doesn't fit cleanly
      }
    }

    // Check span of non-zero frets <= 4
    const fretted = frets.filter(f => f > 0);
    const minF = fretted.length > 0 ? Math.min(...fretted) : 0;
    const maxF = fretted.length > 0 ? Math.max(...fretted) : 0;
    if (fretted.length > 0 && maxF - minF > 3) return;

    // Score completeness of pitch classes
    const coveredPcs = new Set<number>();
    let soundedCount = 0;
    for (let s = 0; s < numStrings; s++) {
      if (frets[s] >= 0) {
        coveredPcs.add((openMidi[s] + frets[s]) % 12);
        soundedCount++;
      }
    }

    const minRequiredStrings = numStrings >= 6 ? 4 : 3;
    if (soundedCount < minRequiredStrings) return;

    const coverageRatio = coveredPcs.size / Math.min(targetPcs.size, numStrings);
    const openBonus = frets.filter(f => f === 0).length * 2.5;
    const positionPenalty = minF * 0.8;
    const hasBass = coveredPcs.has(bassPc) ? 20 : -20;

    const totalScore = coverageRatio * 50 + soundedCount * 4 + openBonus + hasBass - positionPenalty;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestFrets = frets;
    }
  };

  tryWindow(0, 4);
  for (let startFret = 1; startFret <= 9; startFret++) {
    tryWindow(startFret, startFret + 3);
  }

  const positiveFrets = bestFrets.filter(f => f > 0);
  const minPos = positiveFrets.length > 0 ? Math.min(...positiveFrets) : 1;
  const maxPos = positiveFrets.length > 0 ? Math.max(...positiveFrets) : 1;
  const baseFret = maxPos <= 4 ? 1 : minPos;

  const midiNotes: number[] = [];
  for (let s = 0; s < numStrings; s++) {
    if (bestFrets[s] >= 0) {
      midiNotes.push(openMidi[s] + bestFrets[s]);
    }
  }

  return {
    chord: chordSymbol,
    instrument,
    frets: bestFrets,
    baseFret,
    midiNotes,
    stringNames
  };
}

function normalizeLookupChord(chord: string): string {
  const flatToSharp: Record<string, string> = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
  };
  const m = chord.trim().match(/^([A-G][#b]?)(.*)$/);
  if (!m) return chord.trim();
  const root = flatToSharp[m[1]] || m[1];
  return `${root}${m[2]}`;
}

export function getGuitarVoicing(chordSymbol: string, tuningStr?: string): FrettedVoicing {
  const tuning = resolveGuitarTuning(tuningStr);
  const clean = chordSymbol.trim();

  if (tuning.id === 'standard') {
    const direct = STANDARD_GUITAR_VOICINGS[clean] || STANDARD_GUITAR_VOICINGS[normalizeLookupChord(clean)];
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
  const direct = UKULELE_VOICINGS[clean] || UKULELE_VOICINGS[normalizeLookupChord(clean)];
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
  const bassMidi = bassPc !== rootPc ? 48 + bassPc : 48 + rootPc; // C3 bass octave
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
