/**
 * Syllable-level analysis for lyrics synchronization
 * Supports Spanish and English lyrics with syllable-level timing and positioning
 */

export interface Syllable {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
}

export interface SyllableizedLine {
  text: string;
  syllables: Syllable[];
  syllableCount: number;
}

const SPANISH_INSEPARABLE_ONSETS = new Set([
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr',
  'ch', 'll', 'rr', 'qu', 'gu'
]);

const ENGLISH_INSEPARABLE_ONSETS_2 = new Set([
  'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'dw', 'fl', 'fr', 'gh', 'gl', 'gr',
  'kn', 'ph', 'pl', 'pr', 'qu', 'sc', 'sh', 'sk', 'sl', 'sm', 'sn', 'sp',
  'sq', 'st', 'sw', 'th', 'tr', 'tw', 'wh', 'wr'
]);

const ENGLISH_INSEPARABLE_ONSETS_3 = new Set([
  'scr', 'shr', 'spl', 'spr', 'str', 'squ', 'thr'
]);

/**
 * Nucleus-based Spanish syllabification.
 * Slices the original word directly so `syllables.join('') === word` always holds.
 */
function syllabifySpanish(word: string): string[] {
  if (!word) return [];

  const w = word.toLowerCase();
  const n = w.length;
  const isBaseVowel = (ch: string) => /[aeiouáéíóúü]/.test(ch);
  const isStrong = (ch: string) => /[aeoáéíóú]/.test(ch);
  const isWeak = (ch: string) => /[iuü]/.test(ch);

  // Determine which positions act as vowel nuclei characters
  const isVowelPos = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    const ch = w[i];
    if (isBaseVowel(ch)) {
      // Silent 'u' in qu + [e/i/é/í] or gu + [e/i/é/í] belongs to the consonant onset
      if (
        ch === 'u' &&
        i > 0 &&
        (w[i - 1] === 'q' || w[i - 1] === 'g') &&
        i + 1 < n &&
        /[eiéí]/.test(w[i + 1])
      ) {
        isVowelPos[i] = false;
      } else {
        isVowelPos[i] = true;
      }
    } else if (ch === 'y') {
      // 'y' acts as vowel when standalone, at end of diphthong, or not followed by a vowel
      const prevIsVowel = i > 0 && isVowelPos[i - 1];
      const nextIsBaseVowel = i + 1 < n && isBaseVowel(w[i + 1]);
      if (!nextIsBaseVowel && (prevIsVowel || n === 1 || (i > 0 && !isBaseVowel(w[i - 1])))) {
        isVowelPos[i] = true;
      }
    }
  }

  // Group vowel positions into syllable nuclei respecting Spanish diphthongs, triphthongs, and hiatus
  const nuclei: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < n) {
    if (!isVowelPos[i]) {
      i++;
      continue;
    }

    const start = i;
    let hasStrong = isStrong(w[i]);
    let hadWeakAfterStrong = false;
    i++;

    while (i < n && isVowelPos[i]) {
      const ch = w[i];
      const chStrong = isStrong(ch);
      const chWeak = isWeak(ch) || ch === 'y';

      if (chStrong) {
        if (hasStrong || hadWeakAfterStrong) {
          // Hiatus: two strong vowels or rising vowel after falling diphthong
          break;
        }
        hasStrong = true;
        i++;
      } else if (chWeak) {
        if (hasStrong) {
          hadWeakAfterStrong = true;
        }
        i++;
      } else {
        break;
      }
    }

    nuclei.push({ start, end: i });
  }

  if (nuclei.length <= 1) {
    return [word];
  }

  // Determine exact split indices between consecutive nuclei
  const splits: number[] = [0];
  for (let k = 0; k < nuclei.length - 1; k++) {
    const cStart = nuclei[k].end;
    const cEnd = nuclei[k + 1].start;
    const cluster = w.slice(cStart, cEnd);
    const cLen = cluster.length;

    let splitAt = cStart;
    if (cLen === 0 || cLen === 1) {
      splitAt = cStart;
    } else if (cLen === 2) {
      splitAt = SPANISH_INSEPARABLE_ONSETS.has(cluster) ? cStart : cStart + 1;
    } else if (cLen === 3) {
      splitAt = SPANISH_INSEPARABLE_ONSETS.has(cluster.slice(1)) ? cStart + 1 : cStart + 2;
    } else {
      splitAt = SPANISH_INSEPARABLE_ONSETS.has(cluster.slice(-2)) ? cStart + cLen - 2 : cStart + cLen - 1;
    }

    splits.push(splitAt);
  }
  splits.push(n);

  const syllables: string[] = [];
  for (let s = 0; s < splits.length - 1; s++) {
    const part = word.slice(splits[s], splits[s + 1]);
    if (part.length > 0) {
      syllables.push(part);
    }
  }

  return syllables.length > 0 ? syllables : [word];
}

/**
 * Nucleus-based English syllabification.
 * Slices the original word directly so `syllables.join('') === word` always holds.
 */
function syllabifyEnglish(word: string): string[] {
  if (!word) return [];

  const w = word.toLowerCase();
  const n = w.length;
  const isBaseVowel = (ch: string) => /[aeiou]/.test(ch);

  const isVowelPos = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    const ch = w[i];
    if (isBaseVowel(ch)) {
      // 'qu' before another vowel keeps 'u' as part of the onset glide
      if (ch === 'u' && i > 0 && w[i - 1] === 'q' && i + 1 < n && isBaseVowel(w[i + 1])) {
        isVowelPos[i] = false;
      } else {
        isVowelPos[i] = true;
      }
    } else if (ch === 'y') {
      // 'y' is a consonant at word start before a vowel, otherwise vowel when not followed by vowel
      const nextIsVowel = i + 1 < n && isBaseVowel(w[i + 1]);
      if (i > 0 && !nextIsVowel) {
        isVowelPos[i] = true;
      }
    }
  }

  const nuclei: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < n) {
    if (!isVowelPos[i]) {
      i++;
      continue;
    }
    const start = i;
    while (i < n && isVowelPos[i]) {
      i++;
    }
    nuclei.push({ start, end: i });
  }

  // Handle silent trailing '-e' (except syllabic C + 'le' endings like "simple", "table")
  if (nuclei.length > 1) {
    const last = nuclei[nuclei.length - 1];
    const prev = nuclei[nuclei.length - 2];
    if (last.end === n && last.end - last.start === 1 && w[last.start] === 'e') {
      const cLen = last.start - prev.end;
      const isSyllabicLe = cLen >= 2 && w[last.start - 1] === 'l';
      if (cLen >= 1 && !isSyllabicLe) {
        nuclei.pop();
      }
    }
  }

  if (nuclei.length <= 1) {
    return [word];
  }

  const splits: number[] = [0];
  for (let k = 0; k < nuclei.length - 1; k++) {
    const cStart = nuclei[k].end;
    const cEnd = nuclei[k + 1].start;
    const cluster = w.slice(cStart, cEnd);
    const cLen = cluster.length;

    let splitAt = cStart;
    if (cLen === 0 || cLen === 1) {
      splitAt = cStart;
    } else if (cLen === 2) {
      splitAt = ENGLISH_INSEPARABLE_ONSETS_2.has(cluster) ? cStart : cStart + 1;
    } else {
      if (ENGLISH_INSEPARABLE_ONSETS_3.has(cluster.slice(-3))) {
        splitAt = cStart + cLen - 3;
      } else if (ENGLISH_INSEPARABLE_ONSETS_2.has(cluster.slice(-2))) {
        splitAt = cStart + cLen - 2;
      } else {
        splitAt = cStart + cLen - 1;
      }
    }

    splits.push(splitAt);
  }
  splits.push(n);

  const syllables: string[] = [];
  for (let s = 0; s < splits.length - 1; s++) {
    const part = word.slice(splits[s], splits[s + 1]);
    if (part.length > 0) {
      syllables.push(part);
    }
  }

  return syllables.length > 0 ? syllables : [word];
}

const SPANISH_WORD_PATTERN = /\b(el|la|los|las|un|una|unos|unas|de|del|al|que|y|o|está|están|estoy|son|es|era|fue|como|cuando|donde|quien|si|no|ni|bien|mal|en|me|te|se|le|lo|nos|os|les|mi|tu|su|mis|tus|sus|con|sin|para|por|sobre|entre|hasta|desde|hacia|más|menos|muy|pero|aunque|porque|también|este|esta|esto|ese|esa|eso|aquel|aquella|aquello|todo|toda|todos|todas|nada|algo|siempre|nunca|ya|hoy|ayer|mañana|yo|tú|él|ella|ellos|ellas|hay|tengo|tiene|guarda|perdón|bolsillo|así|noche|día|luz|sol|mar|cielo|voz|alma|vida|amor|tiempo|verdad|silencio|corazón)\b/gi;
const ENGLISH_WORD_PATTERN = /\b(the|a|an|and|or|is|are|was|were|been|be|have|has|had|do|does|did|will|would|could|should|can|may|might|must|shall|if|but|what|which|who|where|when|why|how|as|at|by|for|from|in|of|on|to|with|without|about|above|after|before|between|during|through|until|under|over|some|any|all|each|every|both|either|neither|few|many|much|several|such|same|other|more|most|less|least|another|you|your|my|our|their|his|her|its|this|that|these|those|they|we|she|he|it|not|never|always|love|night|time|life|heart|world|light|day|way|here|there|now|then)\b/gi;

/**
 * Detects language (Spanish/English) from text patterns
 */
function detectLanguage(text: string): 'es' | 'en' {
  const lowerText = text.toLowerCase();

  // Definitive Spanish indicators
  if (/[áéíóúñü¿¡]/.test(lowerText)) {
    return 'es';
  }

  let esScore = (lowerText.match(SPANISH_WORD_PATTERN) || []).length * 2;
  let enScore = (lowerText.match(ENGLISH_WORD_PATTERN) || []).length * 2;

  // Orthographic heuristics
  esScore += (lowerText.match(/(?:ll|rr|qu[ei]|gu[ei]|ci[oó]n|si[oó]n|ando|iendo|mente|illo|illa)/g) || []).length;
  enScore += (lowerText.match(/(?:th|sh|wh|ck|igh|ough|oo|ee|tion|sion|ing\b|ness\b|ment\b|[wk]|'t\b|'re\b|'ve\b|'ll\b|'m\b)/g) || []).length;

  if (enScore > esScore) {
    return 'en';
  }

  return 'es';
}

function detectWordLanguage(word: string, lineLanguage: 'es' | 'en'): 'es' | 'en' {
  const lower = word.toLowerCase();
  if (/[áéíóúñü]/.test(lower)) {
    return 'es';
  }
  if (/(?:th|sh|wh|ck|igh|ough|oo|ee|tion|sion|ing$|ness$|'t$|'re$|'ve$|'ll$|'m$|[wk])/.test(lower)) {
    return 'en';
  }
  return lineLanguage;
}

/**
 * Syllabifies a single word using language-specific rules.
 * Preserves original casing and guarantees `syllables.join('') === word` for letter tokens.
 */
export function syllabifyWord(word: string): string[] {
  if (!word) return [];
  const trimmed = word.trim();
  if (!trimmed) return [word];

  // If word contains surrounding punctuation, strip only for analysis if pure word
  const cleanWord = trimmed.replace(/[^a-záéíóúñü'’]/gi, '');
  if (!cleanWord) return [word];

  const language = detectLanguage(cleanWord);
  const syllables = language === 'es' ? syllabifySpanish(cleanWord) : syllabifyEnglish(cleanWord);

  if (syllables.length === 0) {
    return [cleanWord];
  }

  return syllables;
}

/**
 * Syllabifies a complete line of lyrics.
 * Matches word tokens directly by exact character offsets so all whitespace, quotes,
 * and punctuation are preserved verbatim without character index drift.
 */
export function syllabifyLine(line: string): SyllableizedLine {
  const text = line.trim();
  if (!text) {
    return {
      text,
      syllables: [],
      syllableCount: 0
    };
  }

  const lineLanguage = detectLanguage(text);
  const syllables: Syllable[] = [];
  let syllableIndex = 0;

  // Match contiguous letter/number words (including internal apostrophes like "don't")
  const wordRegex = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

  for (const match of text.matchAll(wordRegex)) {
    const token = match[0];
    const tokenStart = match.index ?? 0;

    // Pure numeric tokens stay as a single syllable
    const wordSyllables = /^\p{N}+$/u.test(token)
      ? [token]
      : (detectWordLanguage(token, lineLanguage) === 'es'
          ? syllabifySpanish(token)
          : syllabifyEnglish(token));

    let tokenOffset = 0;
    for (const syl of wordSyllables) {
      if (!syl) continue;
      const startChar = tokenStart + tokenOffset;
      const endChar = startChar + syl.length;
      syllables.push({
        text: syl,
        index: syllableIndex++,
        startChar,
        endChar
      });
      tokenOffset += syl.length;
    }
  }

  return {
    text,
    syllables,
    syllableCount: syllables.length
  };
}

/**
 * Finds the closest syllable to a given character position
 * Used for positioning chords at syllable boundaries
 */
export function findSyllableAtPosition(
  syllabized: SyllableizedLine,
  charPosition: number
): Syllable | null {
  let closest: Syllable | null = null;
  let minDistance = Infinity;

  for (const syl of syllabized.syllables) {
    const midPoint = (syl.startChar + syl.endChar) / 2;
    const distance = Math.abs(midPoint - charPosition);

    if (distance < minDistance) {
      minDistance = distance;
      closest = syl;
    }
  }

  return closest;
}

/**
 * Distributes a chord sequence cyclically across syllables in a line
 * Used when mapping detected chords to specific syllables
 */
export function distributeChordAcrossSyllables(
  syllabized: SyllableizedLine,
  chordSequence: string[],
  startChordIndex: number = 0
): Map<number, string> {
  const chordMap = new Map<number, string>();

  if (syllabized.syllableCount === 0 || chordSequence.length === 0) {
    return chordMap;
  }

  // Simple cyclical distribution: one chord per syllable
  for (let i = 0; i < syllabized.syllableCount; i++) {
    const chordIndex = (startChordIndex + i) % chordSequence.length;
    chordMap.set(i, chordSequence[chordIndex]);
  }

  return chordMap;
}

/**
 * Maps chord timing to syllable positions within a line
 * Given chord segments that occur during a lyric line's duration,
 * positions each chord at the closest syllable boundary
 */
export function mapChordsToSyllables(
  syllabized: SyllableizedLine,
  lineDurationSec: number,
  chordsInWindow: Array<{ chord: string; timeOffset: number }>
): Map<number, string> {
  const chordMap = new Map<number, string>();

  if (syllabized.syllableCount === 0) {
    return chordMap;
  }

  for (const { chord, timeOffset } of chordsInWindow) {
    // Map time offset (0 to lineDurationSec) to character position within the line
    const proportion = lineDurationSec > 0 ? Math.min(1, timeOffset / lineDurationSec) : 0;
    const charPosition = proportion * syllabized.text.length;

    // Find closest syllable
    const syl = findSyllableAtPosition(syllabized, charPosition);
    if (syl) {
      chordMap.set(syl.index, chord);
    }
  }

  return chordMap;
}

/**
 * Rebuilds a lyric line with chords positioned at syllables
 * Format: [Chord] syllable ... [Chord]syllable...
 * Preserves whitespace and punctuation from original text verbatim
 */
export function reconstructLineWithChords(
  syllabized: SyllableizedLine,
  chordMap: Map<number, string>
): string {
  if (syllabized.syllables.length === 0) {
    return syllabized.text;
  }

  const originalText = syllabized.text;
  const syllables = syllabized.syllables;
  const result: string[] = [];

  let lastEndChar = 0;

  for (let i = 0; i < syllables.length; i++) {
    const syl = syllables[i];
    const chord = chordMap.get(i);

    // Handle leading whitespace/opening punctuation before the first syllable
    if (i === 0 && syl.startChar > lastEndChar) {
      const leading = originalText.substring(lastEndChar, syl.startChar);
      if (chord) {
        const leadingSpaces = leading.match(/^\s*/)?.[0] ?? '';
        const leadingPunct = leading.slice(leadingSpaces.length);
        result.push(`${leadingSpaces}[${chord}] ${leadingPunct}`);
      } else {
        result.push(leading);
      }
      result.push(syl.text);
      lastEndChar = syl.endChar;
      continue;
    }

    // Add any whitespace/punctuation between last syllable and this one
    if (syl.startChar > lastEndChar) {
      const gap = originalText.substring(lastEndChar, syl.startChar);
      result.push(gap);
    }

    // Add chord if present
    if (chord) {
      if (i === 0 && lastEndChar === 0) {
        result.push(`[${chord}] `);
      } else {
        result.push(`[${chord}]`);
      }
    }

    // Add syllable text
    result.push(syl.text);
    lastEndChar = syl.endChar;
  }

  // Add any remaining text after last syllable
  if (lastEndChar < originalText.length) {
    result.push(originalText.substring(lastEndChar));
  }

  return result.join('');
}

