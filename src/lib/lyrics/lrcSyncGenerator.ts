/**
 * LRC Synchronization Generator
 * Converts plain lyrics + detected chords into fully synced LRC format with syllable-level accuracy
 */

import { SyncedLyricLine, LrcMetadata, formatLrcTimestamp } from '../../types/lyrics';
import { ChordSegment } from '../audio/chords';
import {
  syllabifyLine,
  mapChordsToSyllables,
  reconstructLineWithChords,
  SyllableizedLine,
  Syllable
} from './syllableAnalysis';

export interface LrcLineWithChords {
  id: string;
  time: number;
  text: string;
  syllables: SyllableizedLine;
  chords: Map<number, string>;
  rawTime: string;
}

/**
 * Distribution strategy for timing across syllables in a line
 */
export type TimingDistributionStrategy = 'uniform' | 'exponential' | 'phonetic';

/**
 * Calculates syllable-level timing for a lyric line
 * Distributes the line duration across syllables based on the strategy
 */
export function calculateSyllableTiming(
  syllables: Syllable[],
  startTime: number,
  endTime: number,
  strategy: TimingDistributionStrategy = 'uniform'
): Map<number, number> {
  const timingMap = new Map<number, number>();

  if (syllables.length === 0) {
    return timingMap;
  }

  const lineDuration = endTime - startTime;
  const syllableCount = syllables.length;

  switch (strategy) {
    case 'uniform':
      // Equal duration for each syllable
      {
        const syllableDuration = lineDuration / syllableCount;
        for (let i = 0; i < syllableCount; i++) {
          const time = startTime + i * syllableDuration;
          timingMap.set(i, Number(time.toFixed(3)));
        }
      }
      break;

    case 'exponential':
      // Later syllables get slightly more time (natural speech pattern)
      {
        const timePoints = [];
        let cumulativeTime = startTime;

        for (let i = 0; i < syllableCount; i++) {
          // Weight increases toward the end (0.5 to 1.5)
          const weight = 0.5 + (i / syllableCount) * 1.0;
          const baseDuration = lineDuration / syllableCount;
          const syllableDuration = baseDuration * weight;
          timePoints.push(Number(cumulativeTime.toFixed(3)));
          cumulativeTime += syllableDuration;
        }

        timePoints.forEach((time, idx) => timingMap.set(idx, time));
      }
      break;

    case 'phonetic':
      // Approximate phonetic duration based on syllable structure
      {
        let cumulativeTime = startTime;
        let totalWeight = 0;

        // First pass: calculate weights based on consonant/vowel patterns
        const weights = syllables.map(syl => {
          const text = syl.text.toLowerCase();
          const vowels = (text.match(/[aeiouáéíóúü]/gi) || []).length;
          const consonants = text.length - vowels;

          // Consonant clusters before vowels add weight
          const hasStartCluster = /^[bcdfghjklmnñprstvwxyz]{2,}/.test(text);
          const weight = vowels + (consonants * 0.3) + (hasStartCluster ? 0.2 : 0);

          return Math.max(0.3, weight); // Minimum weight to avoid zero durations
        });

        totalWeight = weights.reduce((a, b) => a + b, 0);

        // Second pass: distribute duration proportionally to weights
        for (let i = 0; i < syllables.length; i++) {
          const proportion = weights[i] / totalWeight;
          const syllableDuration = lineDuration * proportion;
          timingMap.set(i, Number(cumulativeTime.toFixed(3)));
          cumulativeTime += syllableDuration;
        }
      }
      break;
  }

  return timingMap;
}

/**
 * Generates syllable-level LRC lines from a plain lyric line with chord detection
 * Combines timing distribution, syllabification, and chord positioning
 */
export function generateSyllableLrcLine(
  lineText: string,
  lineStartTime: number,
  lineEndTime: number,
  chordsInWindow: ChordSegment[] = [],
  timingStrategy: TimingDistributionStrategy = 'uniform',
  lineId?: string
): LrcLineWithChords {
  const syllabized = syllabifyLine(lineText);
  const lineDuration = lineEndTime - lineStartTime;

  // Calculate timing for each syllable
  const syllableTiming = calculateSyllableTiming(
    syllabized.syllables,
    lineStartTime,
    lineEndTime,
    timingStrategy
  );

  // Map chords to syllables based on timing
  const chordMap = mapChordsToSyllablesInWindow(
    syllabized,
    lineStartTime,
    lineEndTime,
    chordsInWindow
  );

  // Use the first syllable's time as the line's primary timestamp
  const lineTime = syllableTiming.get(0) ?? lineStartTime;

  return {
    id: lineId ?? `lrc-syllable-${Math.random().toString(36).substr(2, 9)}`,
    time: Number(lineTime.toFixed(3)),
    text: reconstructLineWithChords(syllabized, chordMap),
    syllables: syllabized,
    chords: chordMap,
    rawTime: formatLrcTimestamp(lineTime)
  };
}

/**
 * Maps chord segments to syllable positions within a time window
 * Finds the closest syllable for each chord transition
 */
export function mapChordsToSyllablesInWindow(
  syllabized: SyllableizedLine,
  windowStart: number,
  windowEnd: number,
  chords: ChordSegment[]
): Map<number, string> {
  const chordMap = new Map<number, string>();

  if (syllabized.syllables.length === 0 || chords.length === 0) {
    return chordMap;
  }

  const windowDuration = windowEnd - windowStart;

  for (const chordSegment of chords) {
    // Use the start time of the chord segment
    const chordTime = Math.max(windowStart, Math.min(windowEnd, chordSegment.startTime));

    if (chordTime < windowStart || chordTime > windowEnd) {
      continue;
    }

    // Map time to proportion within the line
    const proportion = (chordTime - windowStart) / windowDuration;

    // Find the syllable at this proportion
    const targetSyllable = Math.floor(proportion * syllabized.syllables.length);
    const syllableIndex = Math.min(targetSyllable, syllabized.syllables.length - 1);

    // Only override if this is a new chord (no chord yet at this position)
    if (!chordMap.has(syllableIndex)) {
      chordMap.set(syllableIndex, chordSegment.chord);
    }
  }

  return chordMap;
}

/**
 * Reconstructs the lyric line with chords positioned at syllable boundaries
 * Uses the imported function from syllableAnalysis which preserves whitespace
 */
function reconstructLineWithChords(
  syllabized: SyllableizedLine,
  chordMap: Map<number, string>
): string {
  if (syllabized.syllables.length === 0) {
    return syllabized.text;
  }

  // Use the imported function which preserves whitespace
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

/**
 * Converts plain lyrics to LRC format with syllable timing and chord positioning
 *
 * Input:
 * - plainLyrics: lyrics without timestamps or chords
 * - lineTiming: array of { text, startTime, endTime } for each line
 * - detectedChords: chord segments with timing from audio analysis
 * - metadata: optional song metadata
 *
 * Output:
 * - LRC string with syllable-level timing and positioned chords
 */
export function generateLrcWithSyllableTiming(
  plainLyrics: string,
  lineTiming: Array<{ text: string; startTime: number; endTime: number }>,
  detectedChords: ChordSegment[] = [],
  metadata?: LrcMetadata,
  timingStrategy: TimingDistributionStrategy = 'uniform'
): string {
  const outputLines: string[] = [];

  // Add metadata
  if (metadata) {
    if (metadata.title) outputLines.push(`[ti:${metadata.title}]`);
    if (metadata.artist) outputLines.push(`[ar:${metadata.artist}]`);
    if (metadata.album) outputLines.push(`[al:${metadata.album}]`);
    if (metadata.by) outputLines.push(`[by:${metadata.by}]`);
    if (metadata.offset) outputLines.push(`[offset:${metadata.offset}]`);
    if (metadata.length) outputLines.push(`[length:${metadata.length}]`);
    if (metadata.re) outputLines.push(`[re:${metadata.re}]`);

    if (outputLines.length > 0) {
      outputLines.push('');
    }
  }

  // Generate syllable-level LRC lines
  for (const line of lineTiming) {
    // Find chords that fall within this line's time window
    const chordsInWindow = detectedChords.filter(
      c => c.startTime < line.endTime && c.endTime > line.startTime
    );

    const lrcLine = generateSyllableLrcLine(
      line.text,
      line.startTime,
      line.endTime,
      chordsInWindow,
      timingStrategy
    );

    outputLines.push(`[${lrcLine.rawTime}] ${lrcLine.text}`);
  }

  return outputLines.join('\n');
}

/**
 * Converts an existing LRC format (with line-level timing) to syllable-level timing
 * Uses the detected chords to position them at syllable boundaries
 */
export function upgradeLrcToSyllableLevel(
  existingLrcLines: SyncedLyricLine[],
  detectedChords: ChordSegment[] = [],
  timingStrategy: TimingDistributionStrategy = 'uniform'
): SyncedLyricLine[] {
  const upgradedLines: SyncedLyricLine[] = [];

  for (let i = 0; i < existingLrcLines.length; i++) {
    const currentLine = existingLrcLines[i];
    const nextLine = existingLrcLines[i + 1];

    // Calculate line duration
    const lineDuration = nextLine ? nextLine.time - currentLine.time : 4.0; // Default 4s if last line

    // Generate syllable-level line
    const lrcLine = generateSyllableLrcLine(
      currentLine.text,
      currentLine.time,
      currentLine.time + lineDuration,
      detectedChords,
      timingStrategy,
      currentLine.id
    );

    // Create synced lyric line
    upgradedLines.push({
      id: lrcLine.id,
      time: lrcLine.time,
      text: lrcLine.text,
      rawTime: lrcLine.rawTime
    });
  }

  return upgradedLines;
}

/**
 * Batch process multiple lines with automatic line timing estimation
 * Useful when you only have plain lyrics and detected chords
 */
export function generateLrcFromPlainLyricsWithChords(
  plainLyrics: string,
  detectedChords: ChordSegment[] = [],
  metadata?: LrcMetadata,
  options?: {
    linesPerMinute?: number;
    timingStrategy?: TimingDistributionStrategy;
  }
): string {
  // Parse plain lyrics into lines
  const lyricLines = plainLyrics
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#')); // Skip headers

  if (lyricLines.length === 0) {
    return '';
  }

  // Estimate timing: default 3 lines per minute = 20 seconds per line
  const secondsPerLine = 60 / (options?.linesPerMinute ?? 3);
  const timingStrategy = options?.timingStrategy ?? 'uniform';

  // Create line timing from plain lyrics
  const lineTiming = lyricLines.map((text, idx) => ({
    text,
    startTime: idx * secondsPerLine,
    endTime: (idx + 1) * secondsPerLine
  }));

  return generateLrcWithSyllableTiming(
    plainLyrics,
    lineTiming,
    detectedChords,
    metadata,
    timingStrategy
  );
}
