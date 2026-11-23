import { syllabifyWord } from './syllableAnalysis';

export type SpanishStressType = 'aguda' | 'llana' | 'esdrujula';
export type RhymeType = 'consonante' | 'asonante' | 'libre';

export interface VerseMetricResult {
  lineNumber: number;
  rawLine: string;
  cleanText: string;
  isSectionHeader: boolean;
  isEmpty: boolean;
  grammaticalSyllables: number;
  sinalefas: number;
  stressType: SpanishStressType;
  stressAdjustment: number;
  metricSyllables: number;
  verseName: string;
  rhymeLetter: string;
  rhymeType: RhymeType;
  rhymeTailConsonant: string;
  rhymeTailAssonant: string;
  stanzaIndex: number;
}

export interface StanzaRhymeSummary {
  stanzaIndex: number;
  title?: string;
  scheme: string;
  dominantVerseLength: number | null;
  lineCount: number;
}

export interface PoeticAnalysisSummary {
  lines: VerseMetricResult[];
  stanzas: StanzaRhymeSummary[];
  totalVerses: number;
  dominantMetricLength: number | null;
}

const ACCENT_MAP: Record<string, string> = {
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u',
  'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u'
};

function stripAccents(str: string): string {
  return str.replace(/[áéíóúüÁÉÍÓÚÜ]/g, ch => ACCENT_MAP[ch] ?? ch).toLowerCase();
}

function endsWithVowelSound(word: string): boolean {
  const clean = stripAccents(word.replace(/[^a-záéíóúüñ]/gi, ''));
  if (!clean) return false;
  const last = clean[clean.length - 1];
  if (/[aeiouy]/.test(last)) return true;
  return false;
}

function startsWithVowelSound(word: string): boolean {
  const clean = stripAccents(word.replace(/[^a-záéíóúüñ]/gi, ''));
  if (!clean) return false;
  if (/^[aeiou]/.test(clean)) return true;
  // Standalone conjunction 'y' is pronounced /i/ and forms sinalefa
  if (clean === 'y') return true;
  // Silent Spanish 'h' followed by vowel
  if (clean.startsWith('h') && clean.length > 1 && /[aeiou]/.test(clean[1])) {
    return true;
  }
  return false;
}

/**
 * Determines the stressed syllable index (0-based from start) and stress classification
 * for a Spanish word using official RAE accentuation rules.
 */
export function detectSpanishStress(word: string): {
  syllables: string[];
  stressedIndex: number;
  stressType: SpanishStressType;
  adjustment: number;
} {
  const clean = word.replace(/[^a-záéíóúüñ]/gi, '');
  if (!clean) {
    return { syllables: [], stressedIndex: 0, stressType: 'llana', adjustment: 0 };
  }

  const syllables = syllabifyWord(clean);
  const count = syllables.length;
  if (count <= 1) {
    return { syllables, stressedIndex: 0, stressType: 'aguda', adjustment: 1 };
  }

  // 1. Explicit written tilde (á, é, í, ó, ú)
  let stressedIndex = -1;
  for (let i = 0; i < count; i++) {
    if (/[áéíóúÁÉÍÓÚ]/.test(syllables[i])) {
      stressedIndex = i;
      break;
    }
  }

  // 2. Standard Spanish accentuation rules when no tilde is present
  if (stressedIndex === -1) {
    const lowerClean = clean.toLowerCase();
    const lastChar = lowerClean[lowerClean.length - 1];
    // Ends in vowel, 'n', or 's' -> penultimate syllable (llana)
    if (/[aeiouns]/.test(lastChar)) {
      stressedIndex = Math.max(0, count - 2);
    } else {
      // Ends in other consonant (r, l, d, z, etc.) -> last syllable (aguda)
      stressedIndex = count - 1;
    }
  }

  const fromEnd = count - 1 - stressedIndex;
  let stressType: SpanishStressType = 'llana';
  let adjustment = 0;
  if (fromEnd === 0) {
    stressType = 'aguda';
    adjustment = 1;
  } else if (fromEnd === 1) {
    stressType = 'llana';
    adjustment = 0;
  } else {
    stressType = 'esdrujula';
    adjustment = -1;
  }

  return { syllables, stressedIndex, stressType, adjustment };
}

/**
 * Extracts consonant and assonant rhyme tails starting from the stressed vowel
 * of the final word in a Spanish verse.
 */
export function extractSpanishRhymeTails(lastWord: string): {
  consonant: string;
  assonant: string;
} {
  const clean = lastWord.replace(/[^a-záéíóúüñ]/gi, '').toLowerCase();
  if (!clean) return { consonant: '', assonant: '' };

  const { syllables, stressedIndex } = detectSpanishStress(clean);
  if (syllables.length === 0) return { consonant: '', assonant: '' };

  // Reconstruct suffix starting from the stressed syllable
  const stressedAndAfter = syllables.slice(stressedIndex).join('');
  const firstSyl = syllables[stressedIndex];

  // Find the main vowel inside the stressed syllable (prefer strong vowel a/e/o or accented vowel)
  let vowelOffset = -1;
  for (let i = 0; i < firstSyl.length; i++) {
    if (/[áéíóú]/.test(firstSyl[i])) {
      vowelOffset = i;
      break;
    }
  }
  if (vowelOffset === -1) {
    for (let i = 0; i < firstSyl.length; i++) {
      if (/[aeo]/.test(firstSyl[i])) {
        vowelOffset = i;
        break;
      }
    }
  }
  if (vowelOffset === -1) {
    for (let i = 0; i < firstSyl.length; i++) {
      if (/[iuü]/.test(firstSyl[i])) {
        vowelOffset = i;
        break;
      }
    }
  }

  const rawTail = vowelOffset >= 0 ? stressedAndAfter.slice(vowelOffset) : stressedAndAfter;
  let normalizedTail = stripAccents(rawTail);

  // Phonetic Spanish normalization for consonant rhyme (v==b, y$==i, silent h)
  normalizedTail = normalizedTail
    .replace(/h/g, '')
    .replace(/v/g, 'b')
    .replace(/qu([ei])/g, 'k$1')
    .replace(/c([ei])/g, 'z$1')
    .replace(/c/g, 'k')
    .replace(/g([ei])/g, 'j$1')
    .replace(/y$/g, 'i');

  // Assonant rhyme: only vowels in order from the stressed vowel onwards
  // (ignore weak semivowel i/u inside unstressed/post-tonic diphthongs when strong vowel exists in the same syllable)
  const assonantParts: string[] = [];
  for (let idx = stressedIndex; idx < syllables.length; idx++) {
    const sylNorm = stripAccents(syllables[idx]).replace(/y$/g, 'i');
    const sylVowels = sylNorm.match(/[aeiou]/g);
    if (!sylVowels || sylVowels.length === 0) continue;

    if (idx === stressedIndex) {
      // Pick stressed nucleus vowel in stressed syllable
      const accented = syllables[idx].match(/[áéíóú]/i);
      if (accented) {
        assonantParts.push(stripAccents(accented[0]));
      } else {
        const strong = sylVowels.find(v => /[aeo]/.test(v));
        assonantParts.push(strong || sylVowels[sylVowels.length - 1]);
      }
    } else {
      // Unstressed post-tonic syllable: pick dominant vowel (strong over weak)
      const strong = sylVowels.find(v => /[aeo]/.test(v));
      assonantParts.push(strong || sylVowels[0]);
    }
  }

  return {
    consonant: normalizedTail,
    assonant: assonantParts.join('-')
  };
}

function getSpanishVerseName(metricSyllables: number): string {
  switch (metricSyllables) {
    case 2: return 'Bisílabo';
    case 3: return 'Trisílabo';
    case 4: return 'Tetrasílabo';
    case 5: return 'Pentasílabo';
    case 6: return 'Hexasílabo';
    case 7: return 'Heptasílabo';
    case 8: return 'Octosílabo';
    case 9: return 'Eneasílabo';
    case 10: return 'Decasílabo';
    case 11: return 'Endecasílabo';
    case 12: return 'Dodecasílabo';
    case 13: return 'Tridecasílabo';
    case 14: return 'Alejandrino';
    default: return metricSyllables > 14 ? `${metricSyllables} síl.` : `${metricSyllables} síl.`;
  }
}

/**
 * Analyzes Spanish poetic meter (grammatical syllables, sinalefas, Ley del Acento Final)
 * and stanza rhyme schemes (consonant & assonant) for song lyrics.
 */
export function analyzePoeticMetrics(rawLyrics: string): PoeticAnalysisSummary {
  const rawLines = (rawLyrics || '').split('\n');
  const results: VerseMetricResult[] = [];
  const stanzaMeta: Map<number, { title?: string; indices: number[] }> = new Map();

  let currentStanza = 0;
  let currentTitle: string | undefined;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (/^#{1,3}\s+/.test(trimmed)) {
      if (stanzaMeta.has(currentStanza) && (stanzaMeta.get(currentStanza)?.indices.length ?? 0) > 0) {
        currentStanza++;
      }
      currentTitle = trimmed.replace(/^#+\s*/, '').trim();
      results.push({
        lineNumber: i + 1,
        rawLine,
        cleanText: currentTitle,
        isSectionHeader: true,
        isEmpty: false,
        grammaticalSyllables: 0,
        sinalefas: 0,
        stressType: 'llana',
        stressAdjustment: 0,
        metricSyllables: 0,
        verseName: '',
        rhymeLetter: '',
        rhymeType: 'libre',
        rhymeTailConsonant: '',
        rhymeTailAssonant: '',
        stanzaIndex: currentStanza
      });
      continue;
    }

    // Strip [Chords]
    const cleanText = trimmed.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
    if (!cleanText) {
      if (stanzaMeta.has(currentStanza) && (stanzaMeta.get(currentStanza)?.indices.length ?? 0) > 0) {
        currentStanza++;
        currentTitle = undefined;
      }
      results.push({
        lineNumber: i + 1,
        rawLine,
        cleanText: '',
        isSectionHeader: false,
        isEmpty: true,
        grammaticalSyllables: 0,
        sinalefas: 0,
        stressType: 'llana',
        stressAdjustment: 0,
        metricSyllables: 0,
        verseName: '',
        rhymeLetter: '',
        rhymeType: 'libre',
        rhymeTailConsonant: '',
        rhymeTailAssonant: '',
        stanzaIndex: currentStanza
      });
      continue;
    }

    // Tokenize words with trailing punctuation check for sinalefa blocking
    const tokens = Array.from(cleanText.matchAll(/([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+)([,;:.!?…]*)/g));
    const words = tokens.map(m => ({ word: m[1], punctAfter: m[2] || '' }));

    if (words.length === 0) {
      results.push({
        lineNumber: i + 1,
        rawLine,
        cleanText,
        isSectionHeader: false,
        isEmpty: true,
        grammaticalSyllables: 0,
        sinalefas: 0,
        stressType: 'llana',
        stressAdjustment: 0,
        metricSyllables: 0,
        verseName: '',
        rhymeLetter: '',
        rhymeType: 'libre',
        rhymeTailConsonant: '',
        rhymeTailAssonant: '',
        stanzaIndex: currentStanza
      });
      continue;
    }

    let grammaticalSyllables = 0;
    for (const w of words) {
      grammaticalSyllables += Math.max(1, syllabifyWord(w.word).length);
    }

    let sinalefas = 0;
    for (let wIdx = 0; wIdx < words.length - 1; wIdx++) {
      const curr = words[wIdx];
      const next = words[wIdx + 1];
      // Strong pause punctuation usually breaks sinalefa
      if (/[;:.!?]/.test(curr.punctAfter)) continue;
      if (endsWithVowelSound(curr.word) && startsWithVowelSound(next.word)) {
        sinalefas++;
      }
    }

    const lastWord = words[words.length - 1].word;
    const stress = detectSpanishStress(lastWord);
    const metricSyllables = Math.max(1, grammaticalSyllables - sinalefas + stress.adjustment);
    const tails = extractSpanishRhymeTails(lastWord);

    const entryIdx = results.length;
    results.push({
      lineNumber: i + 1,
      rawLine,
      cleanText,
      isSectionHeader: false,
      isEmpty: false,
      grammaticalSyllables,
      sinalefas,
      stressType: stress.stressType,
      stressAdjustment: stress.adjustment,
      metricSyllables,
      verseName: getSpanishVerseName(metricSyllables),
      rhymeLetter: '-',
      rhymeType: 'libre',
      rhymeTailConsonant: tails.consonant,
      rhymeTailAssonant: tails.assonant,
      stanzaIndex: currentStanza
    });

    if (!stanzaMeta.has(currentStanza)) {
      stanzaMeta.set(currentStanza, { title: currentTitle, indices: [] });
    }
    stanzaMeta.get(currentStanza)!.indices.push(entryIdx);
  }

  // Assign Rhyme Letters per Stanza (prefer consonant match, fallback to assonant match)
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const stanzas: StanzaRhymeSummary[] = [];
  const globalLengthCounts = new Map<number, number>();

  for (const [stanzaIndex, meta] of stanzaMeta.entries()) {
    const idxs = meta.indices;
    if (idxs.length === 0) continue;

    // Group matching tails within the stanza
    const groupByConsonant = new Map<string, number[]>();
    const groupByAssonant = new Map<string, number[]>();

    for (const rIdx of idxs) {
      const r = results[rIdx];
      globalLengthCounts.set(r.metricSyllables, (globalLengthCounts.get(r.metricSyllables) || 0) + 1);
      if (r.rhymeTailConsonant) {
        const list = groupByConsonant.get(r.rhymeTailConsonant) || [];
        list.push(rIdx);
        groupByConsonant.set(r.rhymeTailConsonant, list);
      }
      if (r.rhymeTailAssonant) {
        const list = groupByAssonant.get(r.rhymeTailAssonant) || [];
        list.push(rIdx);
        groupByAssonant.set(r.rhymeTailAssonant, list);
      }
    }

    let nextLetterIdx = 0;
    const assigned = new Set<number>();

    // Pass 1: Consonant rhymes (>= 2 verses share exact consonant tail)
    for (const rIdx of idxs) {
      if (assigned.has(rIdx)) continue;
      const tail = results[rIdx].rhymeTailConsonant;
      const peers = tail ? groupByConsonant.get(tail) : undefined;
      if (peers && peers.length >= 2) {
        const letter = LETTERS[nextLetterIdx % LETTERS.length];
        nextLetterIdx++;
        for (const p of peers) {
          const isMayor = results[p].metricSyllables >= 9;
          results[p].rhymeLetter = isMayor ? letter : letter.toLowerCase();
          results[p].rhymeType = 'consonante';
          assigned.add(p);
        }
      }
    }

    // Pass 2: Assonant rhymes (>= 2 unassigned verses share assonant tail, or match existing assonant group)
    for (const rIdx of idxs) {
      if (assigned.has(rIdx)) continue;
      const aTail = results[rIdx].rhymeTailAssonant;
      const peers = aTail ? (groupByAssonant.get(aTail) || []).filter(p => !assigned.has(p)) : [];
      if (peers.length >= 2) {
        const letter = LETTERS[nextLetterIdx % LETTERS.length];
        nextLetterIdx++;
        for (const p of peers) {
          const isMayor = results[p].metricSyllables >= 9;
          results[p].rhymeLetter = isMayor ? letter : letter.toLowerCase();
          results[p].rhymeType = 'asonante';
          assigned.add(p);
        }
      }
    }

    const lenCounts = new Map<number, number>();
    for (const rIdx of idxs) {
      const m = results[rIdx].metricSyllables;
      lenCounts.set(m, (lenCounts.get(m) || 0) + 1);
    }
    let domLen: number | null = null;
    let maxC = 0;
    for (const [len, c] of lenCounts.entries()) {
      if (c > maxC) {
        maxC = c;
        domLen = len;
      }
    }

    stanzas.push({
      stanzaIndex,
      title: meta.title,
      scheme: idxs.map(rIdx => results[rIdx].rhymeLetter).join(''),
      dominantVerseLength: domLen,
      lineCount: idxs.length
    });
  }

  let dominantMetricLength: number | null = null;
  let maxGlobal = 0;
  for (const [len, c] of globalLengthCounts.entries()) {
    if (c > maxGlobal) {
      maxGlobal = c;
      dominantMetricLength = len;
    }
  }

  return {
    lines: results,
    stanzas,
    totalVerses: results.filter(r => !r.isEmpty && !r.isSectionHeader).length,
    dominantMetricLength
  };
}
