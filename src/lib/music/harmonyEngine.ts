import { AccidentalPreference, shiftNote } from '../../utils/markdownParser';

export type MusicalMode =
  | 'major'
  | 'minor'
  | 'harmonic_minor'
  | 'melodic_minor'
  | 'dorian'
  | 'mixolydian'
  | 'phrygian';

export const MUSICAL_MODE_LABELS: Record<MusicalMode, string> = {
  major: 'Mayor (Jónico)',
  minor: 'Menor Natural (Eólico)',
  harmonic_minor: 'Menor Armónica',
  melodic_minor: 'Menor Melódica',
  dorian: 'Dórico',
  mixolydian: 'Mixolidio',
  phrygian: 'Frigio'
};

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

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface HarmonicChordEntry {
  chord: string;
  roman: string;
  nashville: string;
  functionLabel: string;
  category: 'diatonic' | 'seventh' | 'secondary_dominant' | 'modal_interchange';
}

export interface HarmonicPalette {
  key: string;
  root: string;
  mode: MusicalMode;
  preference: AccidentalPreference;
  diatonicTriads: HarmonicChordEntry[];
  diatonicSevenths: HarmonicChordEntry[];
  secondaryDominants: HarmonicChordEntry[];
  modalInterchange: HarmonicChordEntry[];
}

export interface ChordSuggestion {
  chord: string;
  roman: string;
  reason: string;
  weight: number;
}

interface ScaleDegreeSpec {
  semitones: number;
  triadSuffix: string;
  seventhSuffix: string;
  romanTriad: string;
  romanSeventh: string;
  nashville: string;
  functionLabel: string;
}

const MODE_SPECS: Record<MusicalMode, ScaleDegreeSpec[]> = {
  major: [
    { semitones: 0, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'I', romanSeventh: 'Imaj7', nashville: '1', functionLabel: 'Tónica' },
    { semitones: 2, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'ii', romanSeventh: 'ii7', nashville: '2m', functionLabel: 'Predominante' },
    { semitones: 4, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'iii', romanSeventh: 'iii7', nashville: '3m', functionLabel: 'Mediante' },
    { semitones: 5, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'IV', romanSeventh: 'IVmaj7', nashville: '4', functionLabel: 'Subdominante' },
    { semitones: 7, triadSuffix: '', seventhSuffix: '7', romanTriad: 'V', romanSeventh: 'V7', nashville: '5', functionLabel: 'Dominante' },
    { semitones: 9, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'vi', romanSeventh: 'vi7', nashville: '6m', functionLabel: 'Relativo menor' },
    { semitones: 11, triadSuffix: 'dim', seventhSuffix: 'm7b5', romanTriad: 'vii°', romanSeventh: 'viiø7', nashville: '7°', functionLabel: 'Sensible' }
  ],
  minor: [
    { semitones: 0, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'i', romanSeventh: 'i7', nashville: '1m', functionLabel: 'Tónica' },
    { semitones: 2, triadSuffix: 'dim', seventhSuffix: 'm7b5', romanTriad: 'ii°', romanSeventh: 'iiø7', nashville: '2°', functionLabel: 'Predominante' },
    { semitones: 3, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'bIII', romanSeventh: 'bIIImaj7', nashville: 'b3', functionLabel: 'Relativo mayor' },
    { semitones: 5, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'iv', romanSeventh: 'iv7', nashville: '4m', functionLabel: 'Subdominante' },
    { semitones: 7, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'v', romanSeventh: 'v7', nashville: '5m', functionLabel: 'Dominante menor' },
    { semitones: 8, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'bVI', romanSeventh: 'bVImaj7', nashville: 'b6', functionLabel: 'Submediante' },
    { semitones: 10, triadSuffix: '', seventhSuffix: '7', romanTriad: 'bVII', romanSeventh: 'bVII7', nashville: 'b7', functionLabel: 'Subtónica' }
  ],
  harmonic_minor: [
    { semitones: 0, triadSuffix: 'm', seventhSuffix: 'mMaj7', romanTriad: 'i', romanSeventh: 'imMaj7', nashville: '1m', functionLabel: 'Tónica' },
    { semitones: 2, triadSuffix: 'dim', seventhSuffix: 'm7b5', romanTriad: 'ii°', romanSeventh: 'iiø7', nashville: '2°', functionLabel: 'Predominante' },
    { semitones: 3, triadSuffix: 'aug', seventhSuffix: 'maj7', romanTriad: 'bIII+', romanSeventh: 'bIIImaj7', nashville: 'b3+', functionLabel: 'Mediante' },
    { semitones: 5, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'iv', romanSeventh: 'iv7', nashville: '4m', functionLabel: 'Subdominante' },
    { semitones: 7, triadSuffix: '', seventhSuffix: '7', romanTriad: 'V', romanSeventh: 'V7', nashville: '5', functionLabel: 'Dominante armónica' },
    { semitones: 8, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'bVI', romanSeventh: 'bVImaj7', nashville: 'b6', functionLabel: 'Submediante' },
    { semitones: 11, triadSuffix: 'dim', seventhSuffix: 'dim7', romanTriad: 'vii°', romanSeventh: 'vii°7', nashville: '7°', functionLabel: 'Sensible' }
  ],
  melodic_minor: [
    { semitones: 0, triadSuffix: 'm', seventhSuffix: 'mMaj7', romanTriad: 'i', romanSeventh: 'imMaj7', nashville: '1m', functionLabel: 'Tónica' },
    { semitones: 2, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'ii', romanSeventh: 'ii7', nashville: '2m', functionLabel: 'Predominante' },
    { semitones: 3, triadSuffix: 'aug', seventhSuffix: 'maj7', romanTriad: 'bIII+', romanSeventh: 'bIIImaj7', nashville: 'b3+', functionLabel: 'Mediante' },
    { semitones: 5, triadSuffix: '', seventhSuffix: '7', romanTriad: 'IV', romanSeventh: 'IV7', nashville: '4', functionLabel: 'Subdominante' },
    { semitones: 7, triadSuffix: '', seventhSuffix: '7', romanTriad: 'V', romanSeventh: 'V7', nashville: '5', functionLabel: 'Dominante' },
    { semitones: 9, triadSuffix: 'dim', seventhSuffix: 'm7b5', romanTriad: 'vi°', romanSeventh: 'viø7', nashville: '6°', functionLabel: 'Submediante' },
    { semitones: 11, triadSuffix: 'dim', seventhSuffix: 'm7b5', romanTriad: 'vii°', romanSeventh: 'viiø7', nashville: '7°', functionLabel: 'Sensible' }
  ],
  dorian: [
    { semitones: 0, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'i', romanSeventh: 'i7', nashville: '1m', functionLabel: 'Tónica dórica' },
    { semitones: 2, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'ii', romanSeventh: 'ii7', nashville: '2m', functionLabel: 'Supertónica' },
    { semitones: 3, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'bIII', romanSeventh: 'bIIImaj7', nashville: 'b3', functionLabel: 'Mediante' },
    { semitones: 5, triadSuffix: '', seventhSuffix: '7', romanTriad: 'IV', romanSeventh: 'IV7', nashville: '4', functionLabel: 'Color dórico (IV)' },
    { semitones: 7, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'v', romanSeventh: 'v7', nashville: '5m', functionLabel: 'Dominante modal' },
    { semitones: 9, triadSuffix: 'dim', seventhSuffix: 'm7b5', romanTriad: 'vi°', romanSeventh: 'viø7', nashville: '6°', functionLabel: 'Sexta mayor' },
    { semitones: 10, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'bVII', romanSeventh: 'bVIImaj7', nashville: 'b7', functionLabel: 'Subtónica' }
  ],
  mixolydian: [
    { semitones: 0, triadSuffix: '', seventhSuffix: '7', romanTriad: 'I', romanSeventh: 'I7', nashville: '1', functionLabel: 'Tónica mixolidia' },
    { semitones: 2, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'ii', romanSeventh: 'ii7', nashville: '2m', functionLabel: 'Predominante' },
    { semitones: 4, triadSuffix: 'dim', seventhSuffix: 'm7b5', romanTriad: 'iii°', romanSeventh: 'iiiø7', nashville: '3°', functionLabel: 'Mediante' },
    { semitones: 5, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'IV', romanSeventh: 'IVmaj7', nashville: '4', functionLabel: 'Subdominante' },
    { semitones: 7, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'v', romanSeventh: 'v7', nashville: '5m', functionLabel: 'Dominante menor' },
    { semitones: 9, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'vi', romanSeventh: 'vi7', nashville: '6m', functionLabel: 'Relativo menor' },
    { semitones: 10, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'bVII', romanSeventh: 'bVIImaj7', nashville: 'b7', functionLabel: 'Cadencia bVII' }
  ],
  phrygian: [
    { semitones: 0, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'i', romanSeventh: 'i7', nashville: '1m', functionLabel: 'Tónica frigia' },
    { semitones: 1, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'bII', romanSeventh: 'bIImaj7', nashville: 'b2', functionLabel: 'Napolitana (bII)' },
    { semitones: 3, triadSuffix: '', seventhSuffix: '7', romanTriad: 'bIII', romanSeventh: 'bIII7', nashville: 'b3', functionLabel: 'Mediante' },
    { semitones: 5, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'iv', romanSeventh: 'iv7', nashville: '4m', functionLabel: 'Subdominante' },
    { semitones: 7, triadSuffix: 'dim', seventhSuffix: 'm7b5', romanTriad: 'v°', romanSeventh: 'vø7', nashville: '5°', functionLabel: 'Dominante' },
    { semitones: 8, triadSuffix: '', seventhSuffix: 'maj7', romanTriad: 'bVI', romanSeventh: 'bVImaj7', nashville: 'b6', functionLabel: 'Submediante' },
    { semitones: 10, triadSuffix: 'm', seventhSuffix: 'm7', romanTriad: 'bvii', romanSeventh: 'bvii7', nashville: 'b7m', functionLabel: 'Subtónica' }
  ]
};

export function parseKeyAndMode(keyStr: string, explicitMode?: MusicalMode): {
  root: string;
  rootIndex: number;
  mode: MusicalMode;
  preference: AccidentalPreference;
} {
  const cleaned = (keyStr || 'Am').trim();
  const match = cleaned.match(/^([A-G][#b]?)(m)?/i);
  const rawRoot = match
    ? match[1].charAt(0).toUpperCase() + match[1].slice(1)
    : 'A';
  const isMinorSuffix = Boolean(match?.[2]) || (cleaned.endsWith('m') && !cleaned.endsWith('maj7'));
  const rootIndex = NOTE_TO_PC[rawRoot] ?? 9;

  const mode: MusicalMode = explicitMode || (isMinorSuffix ? 'minor' : 'major');
  const keyLookup = `${rawRoot}${isMinorSuffix ? 'm' : ''}`;
  const preference: AccidentalPreference =
    rawRoot.includes('b') || FLAT_KEYS.has(keyLookup) ? 'flats' : 'sharps';

  const canonicalRoot = preference === 'flats' ? FLATS[rootIndex] : SHARPS[rootIndex];
  return { root: canonicalRoot, rootIndex, mode, preference };
}

function noteAtInterval(rootIndex: number, semitones: number, preference: AccidentalPreference): string {
  const pc = ((rootIndex + semitones) % 12 + 12) % 12;
  return preference === 'flats' ? FLATS[pc] : SHARPS[pc];
}

/**
 * Dynamically builds a complete harmonic palette for ANY musical key & mode:
 * - Diatonic triads
 * - Diatonic 7th chords
 * - Secondary dominants
 * - Modal interchange (borrowed chords)
 */
export function buildHarmonicPalette(keyStr: string, explicitMode?: MusicalMode): HarmonicPalette {
  const { root, rootIndex, mode, preference } = parseKeyAndMode(keyStr, explicitMode);
  const specs = MODE_SPECS[mode] || MODE_SPECS.major;

  const diatonicTriads: HarmonicChordEntry[] = specs.map(spec => {
    const note = noteAtInterval(rootIndex, spec.semitones, preference);
    return {
      chord: `${note}${spec.triadSuffix}`,
      roman: spec.romanTriad,
      nashville: spec.nashville,
      functionLabel: spec.functionLabel,
      category: 'diatonic'
    };
  });

  const diatonicSevenths: HarmonicChordEntry[] = specs.map(spec => {
    const note = noteAtInterval(rootIndex, spec.semitones, preference);
    return {
      chord: `${note}${spec.seventhSuffix}`,
      roman: spec.romanSeventh,
      nashville: `${spec.nashville}7`,
      functionLabel: spec.functionLabel,
      category: 'seventh'
    };
  });

  const isMinorFamily = mode === 'minor' || mode === 'harmonic_minor' || mode === 'melodic_minor' || mode === 'dorian' || mode === 'phrygian';

  const secondaryDominants: HarmonicChordEntry[] = isMinorFamily
    ? [
        {
          chord: `${noteAtInterval(rootIndex, 7, preference)}7`,
          roman: 'V7',
          nashville: '5(7)',
          functionLabel: 'Dominante principal',
          category: 'secondary_dominant'
        },
        {
          chord: `${noteAtInterval(rootIndex, 0, preference)}7`,
          roman: 'V7/iv',
          nashville: '1(7)',
          functionLabel: 'Resuelve a iv',
          category: 'secondary_dominant'
        },
        {
          chord: `${noteAtInterval(rootIndex, 2, preference)}7`,
          roman: 'V7/V',
          nashville: '2(7)',
          functionLabel: 'Resuelve a V',
          category: 'secondary_dominant'
        },
        {
          chord: `${noteAtInterval(rootIndex, 10, preference)}7`,
          roman: 'V7/bIII',
          nashville: 'b7(7)',
          functionLabel: 'Resuelve a bIII',
          category: 'secondary_dominant'
        },
        {
          chord: `${noteAtInterval(rootIndex, 3, preference)}7`,
          roman: 'V7/bVI',
          nashville: 'b3(7)',
          functionLabel: 'Resuelve a bVI',
          category: 'secondary_dominant'
        }
      ]
    : [
        {
          chord: `${noteAtInterval(rootIndex, 2, preference)}7`,
          roman: 'V7/V',
          nashville: '2(7)',
          functionLabel: 'Resuelve a V',
          category: 'secondary_dominant'
        },
        {
          chord: `${noteAtInterval(rootIndex, 4, preference)}7`,
          roman: 'V7/vi',
          nashville: '3(7)',
          functionLabel: 'Resuelve a vi',
          category: 'secondary_dominant'
        },
        {
          chord: `${noteAtInterval(rootIndex, 9, preference)}7`,
          roman: 'V7/ii',
          nashville: '6(7)',
          functionLabel: 'Resuelve a ii',
          category: 'secondary_dominant'
        },
        {
          chord: `${noteAtInterval(rootIndex, 0, preference)}7`,
          roman: 'V7/IV',
          nashville: '1(7)',
          functionLabel: 'Resuelve a IV',
          category: 'secondary_dominant'
        },
        {
          chord: `${noteAtInterval(rootIndex, 11, preference)}7`,
          roman: 'V7/iii',
          nashville: '7(7)',
          functionLabel: 'Resuelve a iii',
          category: 'secondary_dominant'
        }
      ];

  const modalInterchange: HarmonicChordEntry[] = isMinorFamily
    ? [
        {
          chord: `${noteAtInterval(rootIndex, 5, preference)}`,
          roman: 'IV',
          nashville: '4',
          functionLabel: 'Préstamo Dórico',
          category: 'modal_interchange'
        },
        {
          chord: `${noteAtInterval(rootIndex, 1, preference)}`,
          roman: 'bII',
          nashville: 'b2',
          functionLabel: 'Napolitana / Frigio',
          category: 'modal_interchange'
        },
        {
          chord: `${noteAtInterval(rootIndex, 0, preference)}`,
          roman: 'I',
          nashville: '1',
          functionLabel: 'Tercera de Picardia',
          category: 'modal_interchange'
        },
        {
          chord: `${noteAtInterval(rootIndex, 9, preference)}m7b5`,
          roman: 'viø7',
          nashville: '6ø',
          functionLabel: 'Préstamo Dórico',
          category: 'modal_interchange'
        }
      ]
    : [
        {
          chord: `${noteAtInterval(rootIndex, 5, preference)}m`,
          roman: 'iv',
          nashville: '4m',
          functionLabel: 'Subdominante menor',
          category: 'modal_interchange'
        },
        {
          chord: `${noteAtInterval(rootIndex, 10, preference)}`,
          roman: 'bVII',
          nashville: 'b7',
          functionLabel: 'Cadencia Mixolidia',
          category: 'modal_interchange'
        },
        {
          chord: `${noteAtInterval(rootIndex, 8, preference)}`,
          roman: 'bVI',
          nashville: 'b6',
          functionLabel: 'Préstamo Eólico',
          category: 'modal_interchange'
        },
        {
          chord: `${noteAtInterval(rootIndex, 3, preference)}`,
          roman: 'bIII',
          nashville: 'b3',
          functionLabel: 'Mediante cromática',
          category: 'modal_interchange'
        },
        {
          chord: `${noteAtInterval(rootIndex, 2, preference)}m7b5`,
          roman: 'iiø7',
          nashville: '2ø',
          functionLabel: 'Predominante menor',
          category: 'modal_interchange'
        }
      ];

  return {
    key: isMinorFamily ? `${root}m` : root,
    root,
    mode,
    preference,
    diatonicTriads,
    diatonicSevenths,
    secondaryDominants,
    modalInterchange
  };
}

/**
 * Converts a chord symbol to its Roman numeral or Nashville representation relative to a key.
 */
export function chordToFunctionalSymbol(
  chord: string,
  keyStr: string,
  notation: 'roman' | 'nashville' = 'roman'
): string {
  const trimmed = (chord || '').trim();
  const match = trimmed.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return trimmed;

  const rootPart = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  let suffixPart = match[2];
  let bassDisplay = '';

  if (suffixPart.includes('/')) {
    const [mainSuf, bassNote] = suffixPart.split('/');
    suffixPart = mainSuf;
    const bassPc = NOTE_TO_PC[bassNote.trim()];
    if (bassPc !== undefined) {
      const { rootIndex } = parseKeyAndMode(keyStr);
      const bassDeg = ((bassPc - rootIndex) % 12 + 12) % 12;
      const nashBass = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'][bassDeg];
      bassDisplay = `/${nashBass}`;
    }
  }

  const chordPc = NOTE_TO_PC[rootPart];
  if (chordPc === undefined) return trimmed;

  const { rootIndex } = parseKeyAndMode(keyStr);
  const degree = ((chordPc - rootIndex) % 12 + 12) % 12;

  const isMinor = suffixPart === 'm' || suffixPart.startsWith('m7') || suffixPart.startsWith('min');
  const isDim = suffixPart.includes('dim') || suffixPart.includes('°') || suffixPart.includes('m7b5');
  const isAug = suffixPart.includes('aug') || suffixPart.includes('+');

  if (notation === 'nashville') {
    const baseNum = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'][degree];
    const cleanQuality = suffixPart
      .replace(/^maj7/, 'M7')
      .replace(/^min/, 'm');
    return `${baseNum}${cleanQuality}${bassDisplay}`;
  }

  const romanUpper = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'][degree];
  const romanLower = ['i', 'bii', 'ii', 'biii', 'iii', 'iv', '#iv', 'v', 'bvi', 'vi', 'bvii', 'vii'][degree];

  const baseRoman = (isMinor || isDim) ? romanLower : romanUpper;
  let ext = suffixPart;
  if (suffixPart === 'm') ext = '';
  else if (suffixPart.startsWith('m') && !suffixPart.startsWith('maj')) {
    ext = suffixPart.slice(1);
  }
  if (isDim && suffixPart === 'dim') ext = '°';
  if (isAug && suffixPart === 'aug') ext = '+';

  return `${baseRoman}${ext}${bassDisplay}`;
}

/**
 * Converts all [Chord] markers in lyrics to Roman numerals or Nashville numbers.
 */
export function convertLyricsToFunctionalNotation(
  lyrics: string,
  keyStr: string,
  notation: 'roman' | 'nashville'
): string {
  return lyrics.replace(/\[([A-G][#b]?[^\]]*)\]/g, (_, chord) => {
    return `[${chordToFunctionalSymbol(chord, keyStr, notation)}]`;
  });
}

/**
 * Suggests the most musically natural next chords based on the last chord written
 * and the song's key & mode.
 */
export function suggestNextChords(
  lastChord: string | null | undefined,
  keyStr: string,
  explicitMode?: MusicalMode
): ChordSuggestion[] {
  const palette = buildHarmonicPalette(keyStr, explicitMode);
  const triads = palette.diatonicTriads;
  const isMinor = palette.mode === 'minor' || palette.mode === 'harmonic_minor' || palette.mode === 'dorian' || palette.mode === 'phrygian';

  if (!lastChord || !lastChord.trim()) {
    return [
      { chord: triads[0].chord, roman: triads[0].roman, reason: 'Inicio en tónica', weight: 1.0 },
      { chord: triads[isMinor ? 5 : 3].chord, roman: triads[isMinor ? 5 : 3].roman, reason: 'Apertura emotiva', weight: 0.85 },
      { chord: triads[isMinor ? 3 : 5].chord, roman: triads[isMinor ? 3 : 5].roman, reason: 'Movimiento suave', weight: 0.75 },
      { chord: triads[4].chord, roman: triads[4].roman, reason: 'Tensión dominante', weight: 0.65 }
    ];
  }

  const parsedMatch = lastChord.trim().match(/^([A-G][#b]?)(.*)$/);
  if (!parsedMatch) {
    return triads.slice(0, 4).map((t, i) => ({
      chord: t.chord,
      roman: t.roman,
      reason: t.functionLabel,
      weight: 1 - i * 0.1
    }));
  }

  const { rootIndex, preference } = parseKeyAndMode(keyStr, explicitMode);
  const chordRootPc = NOTE_TO_PC[parsedMatch[1].charAt(0).toUpperCase() + parsedMatch[1].slice(1)] ?? rootIndex;
  const suffix = parsedMatch[2].split('/')[0];
  const degree = ((chordRootPc - rootIndex) % 12 + 12) % 12;

  // Check if lastChord is a dominant 7th (resolves down a 5th = +5 semitones)
  if (suffix === '7' && degree !== 7) {
    const targetPc = (chordRootPc + 5) % 12;
    const targetMatch = [...triads, ...palette.modalInterchange].find(entry => {
      const m = entry.chord.match(/^([A-G][#b]?)/);
      return m && NOTE_TO_PC[m[1]] === targetPc;
    });
    const targetChord = targetMatch?.chord || shiftNote(parsedMatch[1], 5, preference);
    return [
      { chord: targetChord, roman: targetMatch?.roman || 'Resolución', reason: 'Resolución V7 → I', weight: 1.0 },
      { chord: triads[0].chord, roman: triads[0].roman, reason: 'Regreso a tónica', weight: 0.78 },
      { chord: triads[isMinor ? 5 : 3].chord, roman: triads[isMinor ? 5 : 3].roman, reason: 'Cadencia rota', weight: 0.65 },
      { chord: triads[4].chord, roman: triads[4].roman, reason: 'Dominante principal', weight: 0.55 }
    ];
  }

  if (isMinor) {
    // Minor key harmonic transitions (degrees: 0=i, 2=ii°, 3=bIII, 5=iv, 7=v/V, 8=bVI, 10=bVII)
    const domV7 = palette.secondaryDominants[0]?.chord || `${noteAtInterval(rootIndex, 7, preference)}7`;
    switch (degree) {
      case 0: // i
        return [
          { chord: triads[5].chord, roman: triads[5].roman, reason: 'Progresión andaluza / folk', weight: 0.95 },
          { chord: triads[3].chord, roman: triads[3].roman, reason: 'Subdominante', weight: 0.90 },
          { chord: triads[6].chord, roman: triads[6].roman, reason: 'Descenso modal', weight: 0.85 },
          { chord: domV7, roman: 'V7', reason: 'Tensión armónica', weight: 0.78 }
        ];
      case 5: // iv
        return [
          { chord: domV7, roman: 'V7', reason: 'Cadencia clásica iv → V7', weight: 0.98 },
          { chord: triads[0].chord, roman: triads[0].roman, reason: 'Cadencia plagal iv → i', weight: 0.86 },
          { chord: triads[6].chord, roman: triads[6].roman, reason: 'Hacia bVII', weight: 0.80 },
          { chord: triads[2].chord, roman: triads[2].roman, reason: 'Hacia relativo mayor', weight: 0.72 }
        ];
      case 7: // V / v
        return [
          { chord: triads[0].chord, roman: triads[0].roman, reason: 'Resolución a tónica (i)', weight: 1.0 },
          { chord: triads[5].chord, roman: triads[5].roman, reason: 'Cadencia rota (bVI)', weight: 0.82 },
          { chord: triads[3].chord, roman: triads[3].roman, reason: 'Retorno suave (iv)', weight: 0.65 },
          { chord: palette.modalInterchange[2]?.chord || triads[0].chord, roman: 'I', reason: 'Picardia luminosa', weight: 0.55 }
        ];
      case 8: // bVI
        return [
          { chord: triads[6].chord, roman: triads[6].roman, reason: 'Ascenso bVI → bVII', weight: 0.94 },
          { chord: domV7, roman: 'V7', reason: 'Cadencia andaluza bVI → V7', weight: 0.92 },
          { chord: triads[2].chord, roman: triads[2].roman, reason: 'Hacia relativo bIII', weight: 0.82 },
          { chord: triads[3].chord, roman: triads[3].roman, reason: 'Predominante iv', weight: 0.74 }
        ];
      case 10: // bVII
        return [
          { chord: triads[0].chord, roman: triads[0].roman, reason: 'Resolución modal bVII → i', weight: 0.95 },
          { chord: triads[2].chord, roman: triads[2].roman, reason: 'Dominante del relativo bIII', weight: 0.88 },
          { chord: triads[5].chord, roman: triads[5].roman, reason: 'Descenso i-bVII-bVI', weight: 0.84 },
          { chord: domV7, roman: 'V7', reason: 'Tensión final', weight: 0.72 }
        ];
      default:
        return [
          { chord: triads[6].chord, roman: triads[6].roman, reason: 'Movimiento diatónico', weight: 0.9 },
          { chord: domV7, roman: 'V7', reason: 'Hacia dominante', weight: 0.85 },
          { chord: triads[3].chord, roman: triads[3].roman, reason: 'Subdominante', weight: 0.8 },
          { chord: triads[0].chord, roman: triads[0].roman, reason: 'Tónica', weight: 0.75 }
        ];
    }
  }

  // Major key transitions (0=I, 2=ii, 4=iii, 5=IV, 7=V, 9=vi, 11=vii°)
  const v7Chord = palette.diatonicSevenths[4]?.chord || triads[4].chord;
  switch (degree) {
    case 0: // I
      return [
        { chord: triads[4].chord, roman: triads[4].roman, reason: 'Hacia dominante (V)', weight: 0.95 },
        { chord: triads[3].chord, roman: triads[3].roman, reason: 'Hacia subdominante (IV)', weight: 0.92 },
        { chord: triads[5].chord, roman: triads[5].roman, reason: 'Relativo menor (vi)', weight: 0.88 },
        { chord: triads[1].chord, roman: triads[1].roman, reason: 'Preparación jazz/pop (ii)', weight: 0.76 }
      ];
    case 2: // ii
      return [
        { chord: v7Chord, roman: 'V7', reason: 'Cadencia ii → V7', weight: 0.98 },
        { chord: triads[4].chord, roman: triads[4].roman, reason: 'Dominante V', weight: 0.92 },
        { chord: triads[3].chord, roman: triads[3].roman, reason: 'Subdominante IV', weight: 0.72 },
        { chord: triads[0].chord, roman: triads[0].roman, reason: 'Retorno directo a I', weight: 0.65 }
      ];
    case 5: // IV
      return [
        { chord: triads[4].chord, roman: triads[4].roman, reason: 'Cadencia auténtica IV → V', weight: 0.96 },
        { chord: triads[0].chord, roman: triads[0].roman, reason: 'Cadencia plagal IV → I', weight: 0.88 },
        { chord: palette.modalInterchange[0]?.chord || `${noteAtInterval(rootIndex, 5, preference)}m`, roman: 'iv', reason: 'Nostalgia IV → iv', weight: 0.82 },
        { chord: triads[1].chord, roman: triads[1].roman, reason: 'Prolongación ii', weight: 0.74 }
      ];
    case 7: // V
      return [
        { chord: triads[0].chord, roman: triads[0].roman, reason: 'Resolución auténtica V → I', weight: 1.0 },
        { chord: triads[5].chord, roman: triads[5].roman, reason: 'Cadencia rota V → vi', weight: 0.86 },
        { chord: triads[3].chord, roman: triads[3].roman, reason: 'V → IV (rock/folk)', weight: 0.72 },
        { chord: palette.modalInterchange[1]?.chord || triads[3].chord, roman: 'bVII', reason: 'Giro modal', weight: 0.58 }
      ];
    case 9: // vi
      return [
        { chord: triads[3].chord, roman: triads[3].roman, reason: 'Progresión pop vi → IV', weight: 0.96 },
        { chord: triads[1].chord, roman: triads[1].roman, reason: 'Círculo de quintas vi → ii', weight: 0.88 },
        { chord: triads[4].chord, roman: triads[4].roman, reason: 'Hacia dominante V', weight: 0.82 },
        { chord: triads[0].chord, roman: triads[0].roman, reason: 'Retorno a I', weight: 0.72 }
      ];
    default:
      return [
        { chord: triads[3].chord, roman: triads[3].roman, reason: 'Subdominante IV', weight: 0.9 },
        { chord: triads[4].chord, roman: triads[4].roman, reason: 'Dominante V', weight: 0.85 },
        { chord: triads[5].chord, roman: triads[5].roman, reason: 'Relativo vi', weight: 0.8 },
        { chord: triads[0].chord, roman: triads[0].roman, reason: 'Tónica I', weight: 0.75 }
      ];
  }
}

/**
 * Extracts the last bracketed [Chord] appearing before a given cursor offset in lyrics text.
 */
export function findLastChordBeforeCursor(lyrics: string, cursorOffset?: number): string | null {
  const slice = typeof cursorOffset === 'number' ? lyrics.slice(0, cursorOffset) : lyrics;
  const matches = slice.match(/\[([A-G][#b]?[^\]]*)\]/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return last.slice(1, -1).trim();
}
