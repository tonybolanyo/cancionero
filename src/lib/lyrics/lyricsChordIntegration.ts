/**
 * Lyrics and Chord Integration Service
 * Coordinates syllable-level synchronization with chord positioning
 * Includes comprehensive validation and error handling
 */

import type { ChordSegment } from '../audio/chords';
import { ParsedLrc, SyncedLyricLine, LrcMetadata, formatLrcTimestamp } from '../../types/lyrics';
import { parseLrc, stripChordsFromText, stripLrcTimestamps } from './parseLrc';
import {
  generateLrcWithSyllableTiming,
  generateLrcFromPlainLyricsWithChords,
  upgradeLrcToSyllableLevel,
  calculateSyllableTiming,
  TimingDistributionStrategy
} from './lrcSyncGenerator';
import { syllabifyLine, SyllableizedLine, reconstructLineWithChords } from './syllableAnalysis';

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

export interface LyricsAndChordsSync {
  lrc: string;
  plainLyrics: string;
  lyricsWithChords: string;
  metadata: LrcMetadata;
  detectedChords: ChordSegment[];
  timingStrategy: TimingDistributionStrategy;
  warnings?: string[];
}

/**
 * Validates lyrics input and throws descriptive errors
 */
function validateLyricsInput(lyrics: string | null | undefined): string {
  if (!lyrics) {
    throw new Error('Lyrics input is empty or null');
  }

  const trimmed = lyrics.trim();
  if (trimmed.length === 0) {
    throw new Error('Lyrics contain only whitespace');
  }

  return trimmed;
}

/**
 * Validates chord segments and cleans invalid ones
 */
function validateChordSegments(chords: ChordSegment[]): ChordSegment[] {
  if (!Array.isArray(chords)) {
    return [];
  }

  return chords.filter(chord => {
    // Validate chord segment has required properties
    if (typeof chord.startTime !== 'number' || typeof chord.endTime !== 'number') {
      console.warn('Skipping chord with invalid timing', chord);
      return false;
    }

    // Validate timing is logical
    if (chord.startTime >= chord.endTime) {
      console.warn('Skipping chord with invalid duration', chord);
      return false;
    }

    // Validate chord name is not empty
    if (!chord.chord || typeof chord.chord !== 'string' || chord.chord.trim().length === 0) {
      console.warn('Skipping chord with empty name', chord);
      return false;
    }

    return true;
  });
}

/**
 * Converts plain lyrics and detected chords into a fully synchronized LRC format
 * with syllable-level timing and chord positioning
 *
 * Steps:
 * 1. Validate inputs
 * 2. Strip any existing chord notation from lyrics
 * 3. Estimate line timings if not provided
 * 4. Generate syllable-level LRC with positioned chords
 * 5. Return both the LRC format and the text with chords
 */
export function generateSyncedLrcFromPlainLyrics(
  plainLyrics: string,
  detectedChords: ChordSegment[] = [],
  metadata?: LrcMetadata,
  options?: {
    timingStrategy?: TimingDistributionStrategy;
    linesPerMinute?: number;
  }
): LyricsAndChordsSync {
  const warnings: string[] = [];

  try {
    // Validate inputs
    const validatedLyrics = validateLyricsInput(plainLyrics);
    const validatedChords = validateChordSegments(detectedChords);

    // Warn if chords were filtered
    if (validatedChords.length < detectedChords.length) {
      warnings.push(
        `Filtered ${detectedChords.length - validatedChords.length} invalid chord segments`
      );
    }

    // Strip any existing chords to get clean lyrics
    const cleanLyrics = stripChordsFromText(validatedLyrics);

    if (!cleanLyrics || cleanLyrics.trim().length === 0) {
      warnings.push('Lyrics became empty after removing chords');
    }

    // Generate LRC with syllable timing
    const lrc = generateLrcFromPlainLyricsWithChords(
      cleanLyrics,
      validatedChords,
      metadata,
      {
        linesPerMinute: options?.linesPerMinute ?? 3,
        timingStrategy: options?.timingStrategy ?? 'uniform'
      }
    );

    // Parse the generated LRC to get structured data
    const parsed = parseLrc(lrc);

    // Add any parser warnings to our warnings
    if (parsed.warnings && parsed.warnings.length > 0) {
      warnings.push(...parsed.warnings);
    }

    // Generate text with chords positioned at syllables
    const lyricsWithChords = generateLyricsWithPositionedChords(
      cleanLyrics,
      parsed.lines,
      validatedChords
    );

    return {
      lrc,
      plainLyrics: cleanLyrics,
      lyricsWithChords,
      metadata: parsed.metadata,
      detectedChords: validatedChords,
      timingStrategy: options?.timingStrategy ?? 'uniform',
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    throw new Error(
      `Failed to generate synced LRC: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
  const warnings: string[] = [];

  try {
    // Validate inputs
    const validatedLyrics = validateLyricsInput(lrcContent);
    const validatedChords = validateChordSegments(detectedChords);

    if (validatedChords.length < detectedChords.length) {
      warnings.push(
        `Filtered ${detectedChords.length - validatedChords.length} invalid chord segments`
      );
    }

    // Parse existing LRC
    const parsed = parseLrc(validatedLyrics);

    if (parsed.warnings && parsed.warnings.length > 0) {
      warnings.push(...parsed.warnings);
    }

    // Upgrade to syllable level
    const upgradedLines = upgradeLrcToSyllableLevel(
      parsed.lines,
      validatedChords,
      timingStrategy
    );

    // Serialize back to LRC format
    const upgradedLrc = serializeUpgradedLrc(upgradedLines, parsed.metadata);

    // Get plain lyrics
    const plainLyrics = stripLrcTimestamps(validatedLyrics);

    // Generate lyrics with chords
    const lyricsWithChords = generateLyricsWithPositionedChords(
      plainLyrics,
      upgradedLines,
      validatedChords
    );

    return {
      lrc: upgradedLrc,
      plainLyrics,
      lyricsWithChords,
      metadata: parsed.metadata,
      detectedChords: validatedChords,
      timingStrategy,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    throw new Error(
      `Failed to upgrade existing LRC: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
  const warnings: string[] = [];

  try {
    // Validate inputs
    const validatedLyrics = validateLyricsInput(lyricsWithExistingChords);
    const validatedChords = validateChordSegments(newDetectedChords);

    if (validatedChords.length < newDetectedChords.length) {
      warnings.push(
        `Filtered ${newDetectedChords.length - validatedChords.length} invalid chord segments`
      );
    }

    // Extract clean lyrics
    const cleanLyrics = stripChordsFromText(validatedLyrics);

    // Combine detected chords (they override any existing)
    const allChords = [...validatedChords];

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

    if (parsed.warnings && parsed.warnings.length > 0) {
      warnings.push(...parsed.warnings);
    }

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
      timingStrategy,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    throw new Error(
      `Failed to merge chords: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface InsertChordsOptions {
  lrc?: string;
  lrcText?: string;
  audioDuration?: number;
  bpm?: number;
  tempo?: number;
  tempoOffset?: number;
  timingStrategy?: TimingDistributionStrategy;
}

/**
 * Automatically inserts detected musical chords into the corresponding syllables of the lyrics.
 * Uses syllable-level timing from LRC timestamps or audio analysis duration / BPM estimation.
 * Preserves Markdown headers (## Estrofa, ## Coro, etc.), empty lines, and original punctuation/spacing.
 */
export function insertChordsIntoSyllables(
  lyrics: string,
  detectedChords: (ChordSegment | { timestamp?: string; seconds?: number; chord: string } | string)[],
  options?: InsertChordsOptions
): string {
  if (!detectedChords || detectedChords.length === 0) {
    return lyrics;
  }

  // 1. Normalize detected chords into clean chord array and segment array with timestamps
  const cleanChords = getCleanChordSequence(detectedChords);
  if (cleanChords.length === 0) {
    return lyrics;
  }

  let normalizedSegments: ChordSegment[] = [];
  let hasTimestamps = false;

  for (let i = 0; i < detectedChords.length; i++) {
    const item = detectedChords[i];
    if (typeof item === 'string') {
      normalizedSegments.push({
        startTime: 0,
        endTime: 0,
        chord: item.trim(),
        confidence: 1
      });
    } else if ('startTime' in item && typeof item.startTime === 'number') {
      hasTimestamps = true;
      normalizedSegments.push({
        startTime: item.startTime,
        endTime: typeof item.endTime === 'number' ? item.endTime : item.startTime + 2.0,
        chord: item.chord.trim(),
        confidence: typeof item.confidence === 'number' ? item.confidence : 1
      });
    } else if ('seconds' in item && typeof item.seconds === 'number') {
      hasTimestamps = true;
      normalizedSegments.push({
        startTime: item.seconds,
        endTime: item.seconds + 2.0,
        chord: item.chord.trim(),
        confidence: 1
      });
    } else if ('timestamp' in item && typeof item.timestamp === 'string') {
      const parts = item.timestamp.split(':');
      if (parts.length === 2) {
        const sec = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        if (!isNaN(sec)) {
          hasTimestamps = true;
          normalizedSegments.push({
            startTime: sec,
            endTime: sec + 2.0,
            chord: item.chord.trim(),
            confidence: 1
          });
        }
      }
    }
  }

  // Filter out any empty chord names
  normalizedSegments = normalizedSegments.filter(s => s.chord && s.chord !== 'N.C.');

  // If no valid segments with timing, create synthetic timing from cleanChords
  if (!hasTimestamps || normalizedSegments.length === 0) {
    normalizedSegments = cleanChords.map((chord, idx) => ({
      startTime: idx * 4.0,
      endTime: (idx + 1) * 4.0,
      chord,
      confidence: 1
    }));
  }

  // 2. If lyrics are blank or default placeholder, generate initial skeleton
  const isDefaultOrEmpty =
    !lyrics ||
    !lyrics.trim() ||
    lyrics.includes('Escribe el primer verso aquí') ||
    lyrics.includes('Segundo verso con acordes');

  if (isDefaultOrEmpty) {
    const c1 = cleanChords[0] || 'C';
    const c2 = cleanChords[1] || cleanChords[0] || 'G';
    const c3 = cleanChords[2] || cleanChords[0] || 'Am';
    const c4 = cleanChords[3] || cleanChords[1] || 'F';

    return [
      '## Estrofa 1',
      `[${c1}] Primer verso de la estrofa`,
      `[${c2}] Segundo verso con melodía`,
      `[${c3}] Tercer verso en desarrollo`,
      `[${c4}] Cuarto verso hacia la transición`,
      '',
      '## Estribillo',
      `[${cleanChords[cleanChords.length > 4 ? 4 : 0] || c1}] Línea principal del estribillo`,
      `[${cleanChords[cleanChords.length > 5 ? 5 : 1] || c2}] Elevación melódica`,
      `[${cleanChords[cleanChords.length > 6 ? 6 : 2] || c3}] Fuerza armónica`,
      `[${cleanChords[cleanChords.length > 7 ? 7 : 3] || c4}] Cierre de la sección`,
      ''
    ].join('\n');
  }

  // 3. Process lines and determine timing for each lyric line
  const rawLines = lyrics.split('\n');
  
  // Extract parsed LRC line timings if available
  const lrcLineMap = new Map<number, { startTime: number; endTime: number }>();
  const lrcSource = options?.lrcText || options?.lrc;
  if (lrcSource && lrcSource.trim()) {
    try {
      const parsedLrcData = parseLrc(lrcSource);
      if (parsedLrcData.lines.length > 0) {
        let lrcIdx = 0;
        for (let i = 0; i < rawLines.length; i++) {
          const trimmed = rawLines[i].trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          if (lrcIdx < parsedLrcData.lines.length) {
            const currentLrc = parsedLrcData.lines[lrcIdx];
            const nextLrc = parsedLrcData.lines[lrcIdx + 1];
            const dur = nextLrc ? Math.max(1.5, nextLrc.time - currentLrc.time) : 4.0;
            lrcLineMap.set(i, {
              startTime: currentLrc.time,
              endTime: currentLrc.time + dur
            });
            lrcIdx++;
          }
        }
      }
    } catch (e) {
      console.warn('Could not extract line timing from LRC', e);
    }
  }

  // Count sung lines to estimate spacing if LRC wasn't present
  const sungLineIndices: number[] = [];
  rawLines.forEach((l, idx) => {
    const t = l.trim();
    if (t && !t.startsWith('#')) {
      sungLineIndices.push(idx);
    }
  });

  const totalSung = sungLineIndices.length;
  const audioDur = options?.audioDuration && options.audioDuration > 5
    ? options.audioDuration
    : normalizedSegments[normalizedSegments.length - 1].endTime || (totalSung * 4.0);

  const tempoOffset = options?.tempoOffset || 0;
  const availableSingingDuration = Math.max(10, audioDur - tempoOffset);
  const estimatedSecondsPerLine = totalSung > 0
    ? Math.max(2.5, Math.min(10.0, availableSingingDuration / totalSung))
    : 4.0;

  const timingStrategy = options?.timingStrategy || 'phonetic';

  // 4. Transform each line by positioning chords on syllables
  let sungCount = 0;
  let lastPlacedChord: string | null = null;
  let fallbackChordIdx = 0;

  const resultLines = rawLines.map((line, lineIndex) => {
    const trimmed = line.trim();

    // Preserve Markdown headers (##, #) and blank lines
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }

    // Determine line timing window
    let lineStart: number;
    let lineEnd: number;

    const fromLrc = lrcLineMap.get(lineIndex);
    if (fromLrc) {
      lineStart = fromLrc.startTime;
      lineEnd = fromLrc.endTime;
    } else {
      lineStart = tempoOffset + sungCount * estimatedSecondsPerLine;
      lineEnd = lineStart + estimatedSecondsPerLine;
    }
    sungCount++;

    // Clean any existing chords in brackets from the line to re-position on exact syllables
    const cleanLine = stripChordsFromText(line);
    const syllabized = syllabifyLine(cleanLine);

    if (syllabized.syllableCount === 0) {
      return line;
    }

    // Calculate exact timing for each syllable within the line's window
    const syllableTimingMap = calculateSyllableTiming(
      syllabized.syllables,
      lineStart,
      lineEnd,
      timingStrategy
    );

    const chordMap = new Map<number, string>();

    // Chords active or transitioning within this line window
    const chordsInWindow = normalizedSegments.filter(
      c => c.endTime > lineStart && c.startTime < lineEnd
    );

    if (chordsInWindow.length > 0) {
      // 1. Initial chord at the start of the line (syllable 0)
      const initialChord = chordsInWindow[0].chord;
      chordMap.set(0, initialChord);
      lastPlacedChord = initialChord;

      // 2. Transitions occurring during the line
      for (const chordSeg of chordsInWindow) {
        // If this chord starts after lineStart, map it to the closest syllable
        if (chordSeg.startTime > lineStart + 0.3 && chordSeg.chord !== lastPlacedChord) {
          let closestSyllableIndex = 0;
          let minTimeDiff = Infinity;

          for (let sylIdx = 0; sylIdx < syllabized.syllables.length; sylIdx++) {
            const sylTime = syllableTimingMap.get(sylIdx) ?? (lineStart + (sylIdx / syllabized.syllables.length) * (lineEnd - lineStart));
            const diff = Math.abs(sylTime - chordSeg.startTime);
            if (diff < minTimeDiff) {
              minTimeDiff = diff;
              closestSyllableIndex = sylIdx;
            }
          }

          // Do not overwrite syllable 0 if it was placed
          if (closestSyllableIndex > 0 && !chordMap.has(closestSyllableIndex)) {
            chordMap.set(closestSyllableIndex, chordSeg.chord);
            lastPlacedChord = chordSeg.chord;
          }
        }
      }
    } else {
      // Fallback: distribute progression cyclically across lines
      const chordToPlace = cleanChords[fallbackChordIdx % cleanChords.length];
      chordMap.set(0, chordToPlace);
      fallbackChordIdx++;

      // If the line is long (>= 7 syllables) and more chords exist, place harmonic mid-phrase chord
      if (syllabized.syllableCount >= 7 && cleanChords.length > 1) {
        const midChord = cleanChords[fallbackChordIdx % cleanChords.length];
        const midSyl = Math.floor(syllabized.syllableCount / 2);
        if (midChord !== chordToPlace) {
          chordMap.set(midSyl, midChord);
          fallbackChordIdx++;
        }
      }
    }

    // Reconstruct line with chords positioned at syllables, preserving whitespace and punctuation
    return reconstructLineWithChords(syllabized, chordMap);
  });

  return resultLines.join('\n');
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
  try {
    const validated = validateLyricsInput(lyrics);
    const lines = validated
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
  } catch (error) {
    console.error('Error analyzing lyrics structure:', error);
    return [];
  }
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
  try {
    const validated = validateLyricsInput(lyrics);
    const lines = validated
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'));

    const secondsPerLine = 60 / (options?.linesPerMinute ?? 3);

    return lines.map((text, idx) => ({
      text,
      startTime: idx * secondsPerLine,
      endTime: (idx + 1) * secondsPerLine
    }));
  } catch (error) {
    console.error('Error estimating lyrics timings:', error);
    return [];
  }
}
