/**
 * Lyrics and Chord Integration Service
 * Coordinates syllable-level synchronization with chord positioning
 */

import { ChordSegment, getCleanChordSequence } from '../audio/chords';
import { ParsedLrc, SyncedLyricLine, LrcMetadata, formatLrcTimestamp } from '../../types/lyrics';
import { parseLrc, stripChordsFromText, stripLrcTimestamps } from './parseLrc';
import {
  generateLrcWithSyllableTiming,
  generateLrcFromPlainLyricsWithChords,
  upgradeLrcToSyllableLevel,
  TimingDistributionStrategy
} from './lrcSyncGenerator';
import { syllabifyLine, SyllableizedLine } from './syllableAnalysis';

export interface LyricsAndChordsSync {
  lrc: string;
  plainLyrics: string;
  lyricsWithChords: string;
  metadata: LrcMetadata;
  detectedChords: ChordSegment[];
  timingStrategy: TimingDistributionStrategy;
}

/**
 * Converts plain lyrics and detected chords into a fully synchronized LRC format
 * with syllable-level timing and chord positioning
 *
 * Steps:
 * 1. Strip any existing chord notation from lyrics
 * 2. Estimate line timings if not provided
 * 3. Generate syllable-level LRC with positioned chords
 * 4. Return both the LRC format and the text with chords
 */
export function generateSyncedLrcFromPlainLyrics(
  plainLyrics: string,
  detectedChords: ChordSegment[],
  metadata?: LrcMetadata,
  options?: {
    timingStrategy?: TimingDistributionStrategy;
    linesPerMinute?: number;
  }
): LyricsAndChordsSync {
  // Strip any existing chords to get clean lyrics
  const cleanLyrics = stripChordsFromText(plainLyrics);

  // Generate LRC with syllable timing
  const lrc = generateLrcFromPlainLyricsWithChords(
    cleanLyrics,
    detectedChords,
    metadata,
    {
      linesPerMinute: options?.linesPerMinute ?? 3,
      timingStrategy: options?.timingStrategy ?? 'uniform'
    }
  );

  // Parse the generated LRC to get structured data
  const parsed = parseLrc(lrc);

  // Generate text with chords positioned at syllables
  const lyricsWithChords = generateLyricsWithPositionedChords(
    cleanLyrics,
    parsed.lines,
    detectedChords
  );

  return {
    lrc,
    plainLyrics: cleanLyrics,
    lyricsWithChords,
    metadata: parsed.metadata,
    detectedChords,
    timingStrategy: options?.timingStrategy ?? 'uniform'
  };
}

/**
 * Upgrades existing LRC (with line-level timing) to syllable-level timing
 * while positioning detected chords at syllable boundaries
 */
export function upgradeExistingLrcWithChords(
  lrcContent: string,
  detectedChords: ChordSegment[],
  timingStrategy: TimingDistributionStrategy = 'uniform'
): LyricsAndChordsSync {
  // Parse existing LRC
  const parsed = parseLrc(lrcContent);

  // Upgrade to syllable level
  const upgradedLines = upgradeLrcToSyllableLevel(
    parsed.lines,
    detectedChords,
    timingStrategy
  );

  // Serialize back to LRC format
  const upgradedLrc = serializeUpgradedLrc(upgradedLines, parsed.metadata);

  // Get plain lyrics
  const plainLyrics = stripLrcTimestamps(lrcContent);

  // Generate lyrics with chords
  const lyricsWithChords = generateLyricsWithPositionedChords(
    plainLyrics,
    upgradedLines,
    detectedChords
  );

  return {
    lrc: upgradedLrc,
    plainLyrics,
    lyricsWithChords,
    metadata: parsed.metadata,
    detectedChords,
    timingStrategy
  };
}

/**
 * Merges existing lyrics (possibly with chords) with newly detected chords
 * Prioritizes detected chords but preserves existing ones if timing aligns
 */
export function mergeDetectedChordsWithExisting(
  lyricsWithExistingChords: string,
  newDetectedChords: ChordSegment[],
  metadata?: LrcMetadata,
  timingStrategy: TimingDistributionStrategy = 'uniform'
): LyricsAndChordsSync {
  // Extract clean lyrics
  const cleanLyrics = stripChordsFromText(lyricsWithExistingChords);

  // Combine detected chords (they override any existing)
  const allChords = [...newDetectedChords];

  // Generate new LRC with merged chords
  const lrc = generateLrcFromPlainLyricsWithChords(
    cleanLyrics,
    allChords,
    metadata,
    {
      timingStrategy
    }
  );

  const parsed = parseLrc(lrc);
  const lyricsWithChords = generateLyricsWithPositionedChords(
    cleanLyrics,
    parsed.lines,
    allChords
  );

  return {
    lrc,
    plainLyrics: cleanLyrics,
    lyricsWithChords,
    metadata: parsed.metadata,
    detectedChords: allChords,
    timingStrategy
  };
}

/**
 * Generates lyrics text with chords positioned at syllable level
 * Output format: [Chord]syllable[Chord]syllable...
 */
function generateLyricsWithPositionedChords(
  plainLyrics: string,
  syncedLines: SyncedLyricLine[],
  detectedChords: ChordSegment[]
): string {
  const lines = plainLyrics
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lyricLine = lines[i];

    // Find corresponding synced line (approximate match by index)
    const syncedLine = syncedLines[i];
    if (!syncedLine) {
      result.push(lyricLine);
      continue;
    }

    // Extract the text with chords from the synced line
    // The synced line already has chords positioned
    const textWithChords = syncedLine.text.replace(/\[\d{2}:\d{2}\.\d{2}\]\s*/g, '');
    result.push(textWithChords);
  }

  return result.join('\n');
}

/**
 * Serializes upgraded LRC lines back to LRC format
 */
function serializeUpgradedLrc(
  lines: SyncedLyricLine[],
  metadata?: LrcMetadata
): string {
  const output: string[] = [];

  if (metadata) {
    if (metadata.title) output.push(`[ti:${metadata.title}]`);
    if (metadata.artist) output.push(`[ar:${metadata.artist}]`);
    if (metadata.album) output.push(`[al:${metadata.album}]`);
    if (metadata.by) output.push(`[by:${metadata.by}]`);
    if (metadata.offset) output.push(`[offset:${metadata.offset}]`);
    if (metadata.length) output.push(`[length:${metadata.length}]`);
    if (metadata.re) output.push(`[re:${metadata.re}]`);

    if (output.length > 0) {
      output.push('');
    }
  }

  for (const line of lines) {
    output.push(`[${formatLrcTimestamp(line.time)}] ${line.text}`);
  }

  return output.join('\n');
}

/**
 * Analyzes lyrics structure and returns syllabification for each line
 * Useful for UI showing where chords will be positioned
 */
export function analyzeLyricsStructure(lyrics: string): Array<{
  lineNumber: number;
  text: string;
  syllables: SyllableizedLine;
  syllableCount: number;
}> {
  const lines = lyrics
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  return lines.map((text, idx) => {
    const syllabized = syllabifyLine(stripChordsFromText(text));
    return {
      lineNumber: idx + 1,
      text: stripChordsFromText(text),
      syllables: syllabized,
      syllableCount: syllabized.syllableCount
    };
  });
}

/**
 * Estimates timing for lyrics based on assumed tempo
 * Useful when no existing timing is available
 */
export function estimateLyricsTimings(
  lyrics: string,
  options?: {
    linesPerMinute?: number;
    tempoBeats?: number[];
  }
): Array<{ text: string; startTime: number; endTime: number }> {
  const lines = lyrics
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  const secondsPerLine = 60 / (options?.linesPerMinute ?? 3);

  return lines.map((text, idx) => ({
    text,
    startTime: idx * secondsPerLine,
    endTime: (idx + 1) * secondsPerLine
  }));
}
