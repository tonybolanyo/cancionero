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

/**
 * Spanish syllabification rules using common patterns
 * Conservative approach: uses vowel groups and common consonant clusters
 */
function syllabifySpanish(word: string): string[] {
  if (!word || word.length === 0) return [];

  const syllables: string[] = [];
  let current = '';
  const vowels = /[aeiouáéíóúü]/i;
  const consonants = /[bcdfghjklmnñprstvwxyz]/i;

  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const nextChar = word[i + 1];
    const nextnextChar = word[i + 2];

    current += char;

    // Check if we're at a vowel
    if (vowels.test(char)) {
      // Look ahead for syllable break patterns
      if (nextChar) {
        const isNextConsonant = consonants.test(nextChar);
        const isNextVowel = vowels.test(nextChar);
        const isNextnextConsonant = nextnextChar ? consonants.test(nextnextChar) : false;

        // Break after vowel if:
        // 1. Next char is a consonant followed by a vowel (CV pattern)
        if (isNextConsonant && isNextnextConsonant === false) {
          // But not for certain consonant clusters
          const cluster = nextChar + (nextnextChar || '');
          const singleConsonantClusters = ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr', 'ch', 'll', 'rr', 'ñ'];
          if (!singleConsonantClusters.includes(cluster.toLowerCase())) {
            syllables.push(current);
            current = '';
          }
        }
      }
    }
  }

  if (current) {
    syllables.push(current);
  }

  return syllables.filter(s => s.length > 0);
}

/**
 * English syllabification using vowel group detection
 * Simpler heuristic: primarily counts vowel groups
 */
function syllabifyEnglish(word: string): string[] {
  if (!word || word.length === 0) return [];

  const vowels = /[aeiouy]/i;
  const syllables: string[] = [];
  let current = '';
  let inVowelGroup = false;

  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const isVowel = vowels.test(char);
    const nextChar = word[i + 1];
    const nextIsVowel = nextChar ? vowels.test(nextChar) : false;

    current += char;

    // Transition from vowel to consonant: possible break point
    if (inVowelGroup && !isVowel) {
      // Unless next char is a vowel (would continue in a consonant cluster)
      if (!nextIsVowel && current.length > 1) {
        syllables.push(current);
        current = '';
        inVowelGroup = false;
      }
    }

    if (isVowel) {
      inVowelGroup = true;
    }
  }

  if (current) {
    syllables.push(current);
  }

  return syllables.filter(s => s.length > 0);
}

/**
 * Detects language (Spanish/English) from word patterns
 * Uses common Spanish patterns (á, é, í, ó, ú, ñ) and common letter distributions
 */
function detectLanguage(text: string): 'es' | 'en' {
  const spanishIndicators = /[áéíóúñü]/i;
  if (spanishIndicators.test(text)) {
    return 'es';
  }

  // Count common Spanish/English patterns
  const spanishWords = /\b(el|la|un|una|de|que|y|o|está|son|como|si|bien)\b/gi;
  const englishWords = /\b(the|is|are|a|and|or|is|was|been|have|that|this)\b/gi;

  const spanishMatches = (text.match(spanishWords) || []).length;
  const englishMatches = (text.match(englishWords) || []).length;

  return englishMatches > spanishMatches ? 'en' : 'es';
}

/**
 * Syllabifies a single word using language-specific rules
 */
export function syllabifyWord(word: string): string[] {
  const cleanWord = word.toLowerCase().replace(/[^a-záéíóúñü]/gi, '');
  if (!cleanWord) return [word];

  const language = detectLanguage(cleanWord);
  const syllables = language === 'es' ? syllabifySpanish(cleanWord) : syllabifyEnglish(cleanWord);

  if (syllables.length === 0) {
    return [word];
  }

  return syllables;
}

/**
 * Syllabifies a complete line of lyrics
 * Splits by words, syllabifies each word, and tracks character positions
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

  const syllables: Syllable[] = [];
  let syllableIndex = 0;
  let charIndex = 0;

  // Split by whitespace and punctuation boundaries
  const tokens = text.split(/(\s+|[-–—,.:;!?¿¡])/);

  for (const token of tokens) {
    if (!token || /^\s+$/.test(token)) {
      // Track whitespace for position mapping
      charIndex += token.length;
      continue;
    }

    // Check if token is punctuation
    if (/^[-–—,.:;!?¿¡]+$/.test(token)) {
      charIndex += token.length;
      continue;
    }

    // Syllabify the word
    const wordSyllables = syllabifyWord(token);

    for (const syl of wordSyllables) {
      syllables.push({
        text: syl,
        index: syllableIndex,
        startChar: charIndex,
        endChar: charIndex + syl.length
      });
      charIndex += syl.length;
      syllableIndex++;
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
 * Format: [Chord]syllable[Chord]syllable...
 * Preserves whitespace and punctuation from original text
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
    
    // Add any whitespace/punctuation between last syllable and this one
    if (syl.startChar > lastEndChar) {
      const gap = originalText.substring(lastEndChar, syl.startChar);
      result.push(gap);
    }

    // Add chord if present
    const chord = chordMap.get(i);
    if (chord) {
      result.push(`[${chord}]`);
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
