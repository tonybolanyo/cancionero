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
 * Improved with better handling of Spanish-specific patterns
 */
function syllabifySpanish(word: string): string[] {
  if (!word || word.length === 0) return [];

  const syllables: string[] = [];
  const vowels = /[aeiouáéíóúü]/i;
  const consonants = /[bcdfghjklmnñprstvwxyz]/i;
  
  // Spanish consonant clusters that stay with the following vowel
  const inseparableClusterStarts = new Set([
    'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr',
    'ch', 'll', 'rr', 'ñ', // Already single char (ñ)
  ]);

  let current = '';
  let i = 0;

  while (i < word.length) {
    const char = word[i];
    const nextChar = word[i + 1];
    const nextnextChar = word[i + 2];

    current += char;

    // Syllable break detection at vowel boundaries
    if (vowels.test(char) && nextChar) {
      const isNextConsonant = consonants.test(nextChar);
      const isNextVowel = vowels.test(nextChar);

      if (isNextConsonant) {
        // Check for inseparable clusters (should stay with next vowel)
        const cluster = (nextChar + (nextnextChar || '')).toLowerCase();
        const isInseparable = inseparableClusterStarts.has(cluster.slice(0, 2));

        if (!isInseparable) {
          // Break after single consonant
          if (word[i + 2] && !vowels.test(word[i + 2])) {
            // Next position is also consonant, so current consonant closes this syllable
            current += word[i + 1];
            syllables.push(current);
            current = '';
            i += 2;
            continue;
          } else {
            // Single consonant before vowel - break here
            syllables.push(current);
            current = '';
          }
        }
      } else if (isNextVowel && word[i + 2] && consonants.test(word[i + 2])) {
        // Vowel + vowel + consonant pattern: break between vowels
        syllables.push(current);
        current = '';
      }
    }

    i++;
  }

  if (current) {
    syllables.push(current);
  }

  return syllables.filter(s => s.length > 0);
}

/**
 * English syllabification using vowel group detection
 * Improved algorithm that handles common English syllable patterns
 * Based on consonant-vowel transitions and common syllable endings
 */
function syllabifyEnglish(word: string): string[] {
  if (!word || word.length === 0) return [];

  const vowels = /[aeiouy]/i;
  const consonants = /[bcdfghjklmnpqrstvwxz]/i;
  const syllables: string[] = [];
  let current = '';

  let i = 0;
  while (i < word.length) {
    const char = word[i];
    const nextChar = word[i + 1];
    const nextnextChar = word[i + 2];
    const nextthirdChar = word[i + 3];

    current += char;

    // When we encounter a consonant after a vowel (potential break point)
    if (i > 0 && vowels.test(word[i - 1]) && consonants.test(char)) {
      // Look ahead to decide if we break here
      if (nextChar) {
        const nextIsVowel = vowels.test(nextChar);
        const nextIsConsonant = consonants.test(nextChar);

        if (nextIsVowel) {
          // CV pattern: if double consonant, keep both with next syllable
          if (consonants.test(nextChar)) {
            // Single consonant before vowel - might break here
            syllables.push(current);
            current = '';
          } else if (
            nextthirdChar &&
            consonants.test(nextnextChar) &&
            vowels.test(nextthirdChar)
          ) {
            // CCV pattern: break before the cluster
            syllables.push(current);
            current = '';
          }
        } else if (nextIsConsonant && !nextChar) {
          // End of word with consonant cluster
          current += nextChar;
          i++;
        }
      }
    }

    i++;
  }

  if (current) {
    syllables.push(current);
  }

  return syllables.filter(s => s.length > 0);
}

/**
 * Detects language (Spanish/English) from text patterns
 * Uses multiple heuristics:
 * 1. Direct character indicators (accents, special letters)
 * 2. Common word patterns
 * 3. Phonetic patterns
 */
function detectLanguage(text: string): 'es' | 'en' {
  const lowerText = text.toLowerCase();

  // Definitive Spanish indicators
  const spanishIndicators = /[áéíóúñü]/;
  if (spanishIndicators.test(lowerText)) {
    return 'es';
  }

  // Common word patterns weighted
  const spanishPattern = /\b(el|la|un|una|de|que|y|o|está|son|como|si|bien|es|en|no|me|te|se|le|nos|os|con|para|por|más|muy|pero|también|ese|ese|eso|este|esto|ese|aquel|aquello)\b/gi;
  const englishPattern = /\b(the|a|an|and|or|is|are|was|were|been|be|have|has|had|do|does|did|will|would|could|should|can|may|might|must|shall|if|but|what|which|who|where|when|why|how|as|at|by|for|from|in|of|on|to|with|without|about|above|after|before|between|during|through|until|under|over|some|any|all|each|every|both|either|neither|few|many|much|several|such|same|other|more|most|less|least|same|other|another)\b/gi;

  const spanishMatches = (lowerText.match(spanishPattern) || []).length;
  const englishMatches = (lowerText.match(englishPattern) || []).length;

  // If we have significant matches, use ratio
  if (spanishMatches > 0 || englishMatches > 0) {
    return englishMatches >= spanishMatches ? 'en' : 'es';
  }

  // Fallback: check for 'u' before consonant (Spanish tendency) vs other patterns
  const spanishUPattern = /u[bcdfghjklmnpqrstvwxz]/gi;
  const spanishUMatches = (lowerText.match(spanishUPattern) || []).length;

  return spanishUMatches > 2 ? 'es' : 'en';
}

/**
 * Syllabifies a single word using language-specific rules
 * Handles mixed case, accents, and special characters
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
    let tokenOffset = 0;

    for (const syl of wordSyllables) {
      const originalCasedSyl = token.substring(tokenOffset, tokenOffset + syl.length) || syl;
      syllables.push({
        text: originalCasedSyl,
        index: syllableIndex,
        startChar: charIndex,
        endChar: charIndex + originalCasedSyl.length
      });
      charIndex += originalCasedSyl.length;
      tokenOffset += originalCasedSyl.length;
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
