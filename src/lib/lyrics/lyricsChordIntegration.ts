/**
 * Lyrics and Chord Integration Service
 * Coordinates syllable-level synchronization with chord positioning
 * Includes comprehensive validation and error handling
 */

import type { ChordSegment } from '../audio/chords';
import type { MusicalSection, MusicalSectionType } from '../audio/structure';
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

export type ChordPerformanceRole = 'intro' | 'vocal' | 'instrumental';

export interface ClassifiedChordSegment extends ChordSegment {
  role: ChordPerformanceRole;
  sectionType?: MusicalSectionType;
  sectionLabel?: string;
}

export interface ChordRoleClassificationResult {
  all: ClassifiedChordSegment[];
  intro: ClassifiedChordSegment[];
  vocal: ClassifiedChordSegment[];
  instrumental: ClassifiedChordSegment[];
  introEndTime: number;
  instrumentalWindows: Array<{
    startTime: number;
    endTime: number;
    label: string;
    type: 'Instrumental' | 'Outro';
    afterSungLineIndex?: number;
  }>;
}

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
  sections?: MusicalSection[];
  onsets?: number[];
}

type ParsedChordInput = ChordSegment & {
  section?: string;
};

type HeaderKind = 'intro' | 'instrumental' | 'outro' | 'vocal';

function classifyHeaderKind(headingText: string): HeaderKind {
  const lower = headingText.toLowerCase();
  if (/\b(intro|introducci[oó]n|preludio)\b/.test(lower)) return 'intro';
  if (/\b(instrumental|solo|interludio|intermezzo|punteo|break)\b/.test(lower)) return 'instrumental';
  if (/\b(outro|final|coda|desenlace)\b/.test(lower)) return 'outro';
  return 'vocal';
}

function isInstrumentalCueLine(line: string): boolean {
  const withoutChords = stripChordsFromText(line).trim();
  if (!withoutChords) return false;
  return /^\((?:instrumental|solo|interludio|intermezzo|punteo|guitarra|piano|m[uú]sica|intro|outro|coda|silencio|break)[^)]*\)$/i.test(
    withoutChords
  );
}

function isChordOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  if (!/\[([A-G][#b]?[^\]]*)\]/.test(trimmed)) return false;
  const remainder = trimmed
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[\s\-–—|/\\·.,:()]+/g, '')
    .trim();
  return remainder.length === 0;
}

function normalizeChordInputs(
  detectedChords: (ChordSegment | { timestamp?: string; seconds?: number; chord: string; section?: string } | string)[]
): { segments: ParsedChordInput[]; hasTimestamps: boolean; cleanChords: string[] } {
  const cleanChords = getCleanChordSequence(detectedChords);
  let normalizedSegments: ParsedChordInput[] = [];
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
        confidence: typeof item.confidence === 'number' ? item.confidence : 1,
        section: 'section' in item && typeof item.section === 'string' ? item.section : undefined
      });
    } else if ('seconds' in item && typeof item.seconds === 'number') {
      hasTimestamps = true;
      const nextItem = detectedChords[i + 1];
      const nextSeconds =
        nextItem && typeof nextItem !== 'string' && 'seconds' in nextItem && typeof nextItem.seconds === 'number'
          ? nextItem.seconds
          : undefined;
      normalizedSegments.push({
        startTime: item.seconds,
        endTime: nextSeconds && nextSeconds > item.seconds ? nextSeconds : item.seconds + 2.0,
        chord: item.chord.trim(),
        confidence: 1,
        section: typeof item.section === 'string' ? item.section : undefined
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
            confidence: 1,
            section: typeof item.section === 'string' ? item.section : undefined
          });
        }
      }
    }
  }

  normalizedSegments = normalizedSegments.filter(s => s.chord && s.chord !== 'N.C.');

  if (!hasTimestamps || normalizedSegments.length === 0) {
    normalizedSegments = cleanChords.map((chord, idx) => ({
      startTime: idx * 4.0,
      endTime: (idx + 1) * 4.0,
      chord,
      confidence: 1
    }));
  }

  return { segments: normalizedSegments, hasTimestamps, cleanChords };
}

function overlapDuration(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function formatChordBarLine(chords: ChordSegment[], cueText?: string): string {
  const deduped: string[] = [];
  for (const c of chords) {
    if (!c.chord || c.chord === 'N.C.') continue;
    if (deduped.length === 0 || deduped[deduped.length - 1] !== c.chord) {
      deduped.push(c.chord);
    }
  }
  const chordStr = deduped.map(ch => `[${ch}]`).join('  ');
  if (!chordStr) return cueText || '';
  if (cueText && cueText.trim()) {
    return `${chordStr}  ${cueText.trim()}`;
  }
  return chordStr;
}

/**
 * Classifies detected chord segments into musical performance roles:
 * - 'intro': chords occurring during the introduction (before first vocal phrase or inside SSM Intro)
 * - 'vocal': chords occurring over sung sections (Estrofa, Estribillo, Puente)
 * - 'instrumental': chords occurring during instrumental breaks, solos, or outro sections
 */
export function classifyChordsByPerformanceRole(
  detectedChords: (ChordSegment | { timestamp?: string; seconds?: number; chord: string; section?: string } | string)[],
  lyrics: string = '',
  options?: InsertChordsOptions
): ChordRoleClassificationResult {
  const { segments } = normalizeChordInputs(detectedChords);
  if (segments.length === 0) {
    return {
      all: [],
      intro: [],
      vocal: [],
      instrumental: [],
      introEndTime: 0,
      instrumentalWindows: []
    };
  }

  const lastChordEnd = Math.max(...segments.map(s => s.endTime));
  const totalDuration = Math.max(options?.audioDuration ?? 0, lastChordEnd);

  const sections = options?.sections && options.sections.length > 0 ? options.sections : undefined;
  const lrcSource = options?.lrcText || options?.lrc;
  const parsedLrc = lrcSource && lrcSource.trim() ? parseLrc(lrcSource) : null;
  const lrcLines = parsedLrc ? parsedLrc.lines.filter(l => l.text.trim().length > 0) : [];

  // Inspect existing lyrics headers/cues to see whether lyrics explicitly define Intro/Instrumental
  const rawLines = lyrics ? lyrics.split('\n') : [];
  let hasExplicitIntroBlock = false;
  let hasExplicitInstrumentalBlock = false;
  let currentHeaderKind: HeaderKind = 'vocal';
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      currentHeaderKind = classifyHeaderKind(trimmed.replace(/^#+\s*/, ''));
      if (currentHeaderKind === 'intro') hasExplicitIntroBlock = true;
      if (currentHeaderKind === 'instrumental' || currentHeaderKind === 'outro') {
        hasExplicitInstrumentalBlock = true;
      }
    } else if (isInstrumentalCueLine(trimmed)) {
      if (currentHeaderKind === 'intro') hasExplicitIntroBlock = true;
      else hasExplicitInstrumentalBlock = true;
    }
  }

  const introWindows: Array<{ startTime: number; endTime: number; label: string }> = [];
  const instrumentalWindows: Array<{
    startTime: number;
    endTime: number;
    label: string;
    type: 'Instrumental' | 'Outro';
    afterSungLineIndex?: number;
  }> = [];

  if (sections) {
    for (const s of sections) {
      if (s.type === 'Intro') {
        introWindows.push({ startTime: s.startTime, endTime: s.endTime, label: s.label || 'Intro' });
      } else if (s.type === 'Instrumental' || s.type === 'Outro' || s.isVocal === false) {
        const type = s.type === 'Outro' ? 'Outro' : 'Instrumental';
        instrumentalWindows.push({
          startTime: s.startTime,
          endTime: s.endTime,
          label: s.label || type,
          type
        });
      }
    }
  }

  // Refine or infer non-vocal regions from LRC timing gaps when available
  if (lrcLines.length > 0) {
    const firstLrcTime = lrcLines[0].time;
    // If singing begins >= 3.0s into the audio and there is no SSM Intro covering it, mark intro
    if (firstLrcTime >= 3.0 && introWindows.length === 0) {
      introWindows.push({ startTime: 0, endTime: firstLrcTime, label: 'Intro' });
    }

    // Detect inter-line instrumental breaks where gap between lines significantly exceeds sung duration
    for (let i = 0; i < lrcLines.length - 1; i++) {
      const curr = lrcLines[i];
      const next = lrcLines[i + 1];
      const sylCount = Math.max(1, syllabifyLine(stripChordsFromText(curr.text)).syllableCount);
      const estSungDuration = Math.min(8.5, Math.max(3.2, sylCount * 0.34 + 0.8));
      const gapStart = curr.time + estSungDuration;
      const gap = next.time - gapStart;

      if (gap >= 3.5) {
        // Avoid duplicating an SSM instrumental window covering the same region
        const alreadyCovered = instrumentalWindows.some(
          w => overlapDuration(gapStart, next.time, w.startTime, w.endTime) >= gap * 0.5
        );
        if (!alreadyCovered) {
          instrumentalWindows.push({
            startTime: gapStart,
            endTime: next.time,
            label: 'Instrumental',
            type: 'Instrumental',
            afterSungLineIndex: i
          });
        }
      }
    }

    // Check post-vocal outro region after final sung line
    const lastLine = lrcLines[lrcLines.length - 1];
    const lastSyl = Math.max(1, syllabifyLine(stripChordsFromText(lastLine.text)).syllableCount);
    const estLastEnd = lastLine.time + Math.min(8.5, Math.max(3.2, lastSyl * 0.34 + 0.8));
    if (totalDuration - estLastEnd >= 3.5) {
      const alreadyCovered = instrumentalWindows.some(
        w => overlapDuration(estLastEnd, totalDuration, w.startTime, w.endTime) >= 2.0
      );
      if (!alreadyCovered) {
        instrumentalWindows.push({
          startTime: estLastEnd,
          endTime: totalDuration,
          label: 'Outro',
          type: 'Outro',
          afterSungLineIndex: lrcLines.length - 1
        });
      }
    }
  } else if (!sections && hasExplicitIntroBlock && segments.length >= 2) {
    // No SSM sections and no LRC, but lyrics explicitly include `## Intro` + `(Instrumental)` / chord bar
    // Allocate the initial harmonic phrase (~20-25% or first up to 4 chords) to Intro
    const introChordCount = Math.min(4, Math.max(1, Math.floor(segments.length * 0.25)));
    const inferredIntroEnd = segments[introChordCount - 1].endTime;
    introWindows.push({ startTime: 0, endTime: inferredIntroEnd, label: 'Intro' });
  }

  // Map chords to roles
  const classified: ClassifiedChordSegment[] = segments.map(seg => {
    const segDur = Math.max(0.05, seg.endTime - seg.startTime);
    const segMid = (seg.startTime + seg.endTime) / 2;

    // 1. Check explicit SSM sections or LRC-inferred intro window
    for (const win of introWindows) {
      const ov = overlapDuration(seg.startTime, seg.endTime, win.startTime, win.endTime);
      if (ov / segDur >= 0.45 || (segMid >= win.startTime && segMid < win.endTime)) {
        return {
          ...seg,
          role: 'intro',
          sectionType: 'Intro',
          sectionLabel: win.label
        };
      }
    }

    // Chords that begin directly on a sung LRC line belong to that sung phrase unless an explicit SSM instrumental section overrides
    const anchorsVocalLrcLine = lrcLines.some(
      l => seg.startTime >= l.time - 0.35 && seg.startTime <= l.time + 0.85
    );

    // 2. Check explicit SSM Instrumental/Outro or LRC instrumental gap windows
    for (const win of instrumentalWindows) {
      const isLrcInferredGap = win.afterSungLineIndex !== undefined;
      if (isLrcInferredGap && anchorsVocalLrcLine) {
        continue;
      }
      const ov = overlapDuration(seg.startTime, seg.endTime, win.startTime, win.endTime);
      if (ov / segDur >= 0.5 || (segMid >= win.startTime && segMid <= win.endTime)) {
        return {
          ...seg,
          role: 'instrumental',
          sectionType: win.type,
          sectionLabel: win.label
        };
      }
    }

    // 3. Check if segment carries section tag metadata
    if (seg.section) {
      const tag = seg.section.toLowerCase();
      if (tag.includes('intro')) {
        return { ...seg, role: 'intro', sectionType: 'Intro', sectionLabel: seg.section };
      }
      if (tag.includes('instrumental') || tag.includes('outro') || tag.includes('solo')) {
        const type: MusicalSectionType = tag.includes('outro') ? 'Outro' : 'Instrumental';
        return { ...seg, role: 'instrumental', sectionType: type, sectionLabel: seg.section };
      }
    }

    // 4. Match active SSM vocal section for label metadata
    let matchedSection: MusicalSection | undefined;
    if (sections) {
      let bestOv = 0;
      for (const s of sections) {
        const ov = overlapDuration(seg.startTime, seg.endTime, s.startTime, s.endTime);
        if (ov > bestOv) {
          bestOv = ov;
          matchedSection = s;
        }
      }
    }

    // If lyrics explicitly had an Instrumental/Outro block without LRC/SSM, fallback handled during line mapping
    void hasExplicitInstrumentalBlock;

    return {
      ...seg,
      role: 'vocal',
      sectionType: matchedSection?.type,
      sectionLabel: matchedSection?.label || seg.section
    };
  });

  const intro = classified.filter(c => c.role === 'intro');
  const vocal = classified.filter(c => c.role === 'vocal');
  const instrumental = classified.filter(c => c.role === 'instrumental');
  const introEndTime =
    introWindows.length > 0
      ? Math.max(...introWindows.map(w => w.endTime))
      : intro.length > 0
      ? Math.max(...intro.map(c => c.endTime))
      : 0;

  return {
    all: classified,
    intro,
    vocal,
    instrumental,
    introEndTime,
    instrumentalWindows
  };
}

/**
 * Automatically inserts detected musical chords into the corresponding syllables of the lyrics.
 * Uses syllable-level timing from LRC timestamps or audio analysis duration / BPM estimation,
 * and distinguishes between Introduction chords, Sung (Vocal) chords, and Instrumental/Outro chords
 * so instrumental phrases never desync sung syllables.
 * Preserves Markdown headers (## Estrofa, ## Coro, etc.), empty lines, and original punctuation/spacing.
 */
export function insertChordsIntoSyllables(
  lyrics: string,
  detectedChords: (ChordSegment | { timestamp?: string; seconds?: number; chord: string; section?: string } | string)[],
  options?: InsertChordsOptions
): string {
  if (!detectedChords || detectedChords.length === 0) {
    return lyrics;
  }

  // 1. Normalize detected chords and classify into intro / vocal / instrumental roles
  const { segments: normalizedSegments, cleanChords } = normalizeChordInputs(detectedChords);
  if (cleanChords.length === 0) {
    return lyrics;
  }

  const classification = classifyChordsByPerformanceRole(normalizedSegments, lyrics, options);

  // 2. If lyrics are blank or default placeholder, generate initial skeleton
  const isDefaultOrEmpty =
    !lyrics ||
    !lyrics.trim() ||
    lyrics.includes('Escribe el primer verso aquí') ||
    lyrics.includes('Segundo verso con acordes');

  if (isDefaultOrEmpty) {
    const vocalPool = classification.vocal.length > 0 ? classification.vocal : classification.all;
    const vocalSeq = getCleanChordSequence(vocalPool);
    const activeSeq = vocalSeq.length > 0 ? vocalSeq : cleanChords;

    const c1 = activeSeq[0] || 'C';
    const c2 = activeSeq[1] || activeSeq[0] || 'G';
    const c3 = activeSeq[2] || activeSeq[0] || 'Am';
    const c4 = activeSeq[3] || activeSeq[1] || 'F';

    const blocks: string[] = [];
    if (classification.intro.length > 0) {
      blocks.push('## Intro', formatChordBarLine(classification.intro), '');
    }

    blocks.push(
      '## Estrofa 1',
      `[${c1}] Primer verso de la estrofa`,
      `[${c2}] Segundo verso con melodía`,
      `[${c3}] Tercer verso en desarrollo`,
      `[${c4}] Cuarto verso hacia la transición`,
      '',
      '## Estribillo',
      `[${activeSeq[activeSeq.length > 4 ? 4 : 0] || c1}] Línea principal del estribillo`,
      `[${activeSeq[activeSeq.length > 5 ? 5 : 1] || c2}] Elevación melódica`,
      `[${activeSeq[activeSeq.length > 6 ? 6 : 2] || c3}] Fuerza armónica`,
      `[${activeSeq[activeSeq.length > 7 ? 7 : 3] || c4}] Cierre de la sección`,
      ''
    );

    if (classification.instrumental.length > 0) {
      const lastInst = classification.instrumental[classification.instrumental.length - 1];
      const header = lastInst?.sectionType === 'Outro' ? '## Outro' : '## Instrumental';
      blocks.push(header, formatChordBarLine(classification.instrumental), '');
    }

    return blocks.join('\n');
  }

  // 3. Inspect raw lines and classify each line (header, intro block, instrumental cue/chord bar, sung line)
  const rawLines = lyrics.split('\n');
  interface LineMeta {
    raw: string;
    trimmed: string;
    isHeader: boolean;
    headerKind: HeaderKind;
    isBlank: boolean;
    isInstrumentalLine: boolean;
    isSung: boolean;
    cueText?: string;
  }

  let runningKind: HeaderKind = 'vocal';
  let hasIntroHeaderOrBlock = false;
  let hasInstrumentalHeaderOrBlock = false;
  let hasOutroHeaderOrBlock = false;

  const lineMetas: LineMeta[] = rawLines.map(raw => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {
        raw,
        trimmed,
        isHeader: false,
        headerKind: runningKind,
        isBlank: true,
        isInstrumentalLine: false,
        isSung: false
      };
    }

    if (trimmed.startsWith('#')) {
      runningKind = classifyHeaderKind(trimmed.replace(/^#+\s*/, ''));
      if (runningKind === 'intro') hasIntroHeaderOrBlock = true;
      if (runningKind === 'instrumental') hasInstrumentalHeaderOrBlock = true;
      if (runningKind === 'outro') hasOutroHeaderOrBlock = true;
      return {
        raw,
        trimmed,
        isHeader: true,
        headerKind: runningKind,
        isBlank: false,
        isInstrumentalLine: false,
        isSung: false
      };
    }

    const cue = isInstrumentalCueLine(trimmed);
    const chordBar = isChordOnlyLine(trimmed);
    const inNonVocalHeader =
      runningKind === 'intro' || runningKind === 'instrumental' || runningKind === 'outro';

    if (cue || chordBar || inNonVocalHeader) {
      if (runningKind === 'intro') hasIntroHeaderOrBlock = true;
      if (runningKind === 'instrumental') hasInstrumentalHeaderOrBlock = true;
      if (runningKind === 'outro') hasOutroHeaderOrBlock = true;
      const cueText = cue ? stripChordsFromText(trimmed) : undefined;
      return {
        raw,
        trimmed,
        isHeader: false,
        headerKind: runningKind,
        isBlank: false,
        isInstrumentalLine: true,
        isSung: false,
        cueText
      };
    }

    return {
      raw,
      trimmed,
      isHeader: false,
      headerKind: runningKind,
      isBlank: false,
      isInstrumentalLine: false,
      isSung: true
    };
  });

  // Extract parsed LRC line timings if available (only mapped onto sung lines!)
  const lrcLineMap = new Map<number, { startTime: number; endTime: number; lrcIndex: number }>();
  const lrcSource = options?.lrcText || options?.lrc;
  if (lrcSource && lrcSource.trim()) {
    try {
      const parsedLrcData = parseLrc(lrcSource);
      const validLrcLines = parsedLrcData.lines.filter(l => l.text.trim().length > 0);
      if (validLrcLines.length > 0) {
        let lrcIdx = 0;
        for (let i = 0; i < lineMetas.length; i++) {
          if (!lineMetas[i].isSung) continue;
          if (lrcIdx < validLrcLines.length) {
            const currentLrc = validLrcLines[lrcIdx];
            const nextLrc = validLrcLines[lrcIdx + 1];
            const dur = nextLrc ? Math.max(1.5, Math.min(8.5, nextLrc.time - currentLrc.time)) : 4.0;
            lrcLineMap.set(i, {
              startTime: currentLrc.time,
              endTime: currentLrc.time + dur,
              lrcIndex: lrcIdx
            });
            lrcIdx++;
          }
        }
      }
    } catch (e) {
      console.warn('Could not extract line timing from LRC', e);
    }
  }

  const sungLineIndices: number[] = [];
  lineMetas.forEach((m, idx) => {
    if (m.isSung) sungLineIndices.push(idx);
  });

  // Vocal segments pool (falls back to all segments if none labeled vocal)
  const vocalSegments =
    classification.vocal.length > 0 ? classification.vocal : classification.all;
  const vocalCleanChords = getCleanChordSequence(vocalSegments);
  const effectiveVocalPool = vocalCleanChords.length > 0 ? vocalCleanChords : cleanChords;

  const totalSung = sungLineIndices.length;
  const audioDur =
    options?.audioDuration && options.audioDuration > 5
      ? options.audioDuration
      : normalizedSegments[normalizedSegments.length - 1].endTime || totalSung * 4.0;

  // Start vocal line estimation AFTER introEndTime (when no LRC is given) so intro chords don't shift verse 1
  const vocalStartBase = Math.max(options?.tempoOffset || 0, classification.introEndTime);
  const vocalEndTarget =
    classification.vocal.length > 0
      ? Math.max(
          vocalStartBase + 4.0,
          classification.vocal[classification.vocal.length - 1].endTime
        )
      : audioDur;
  const availableSingingDuration = Math.max(10, Math.min(audioDur, vocalEndTarget) - vocalStartBase);
  const estimatedSecondsPerLine =
    totalSung > 0
      ? Math.max(2.5, Math.min(10.0, availableSingingDuration / totalSung))
      : 4.0;

  const timingStrategy = options?.timingStrategy || 'phonetic';

  // Build ordered instrumental/outro chord buckets for any instrumental lines in the lyrics
  const midInstrumentalChords = classification.instrumental.filter(c => c.sectionType !== 'Outro');
  const outroInstrumentalChords = classification.instrumental.filter(c => c.sectionType === 'Outro');
  const introChordPool =
    classification.intro.length > 0 ? classification.intro : normalizedSegments.slice(0, Math.min(4, normalizedSegments.length));

  let sungCount = 0;
  let lastPlacedChord: string | null = null;
  let fallbackChordIdx = 0;
  let usedIntroBlock = false;
  let usedMidInstBlock = false;
  let usedOutroBlock = false;

  // Track which LRC gap windows can be injected between sung lines if lyrics lacked ## Instrumental
  const midLrcGaps = classification.instrumentalWindows.filter(
    w => w.type === 'Instrumental' && w.afterSungLineIndex !== undefined
  );
  const insertedGapIndices = new Set<number>();

  const outputLines: string[] = [];

  for (let lineIndex = 0; lineIndex < lineMetas.length; lineIndex++) {
    const meta = lineMetas[lineIndex];

    // Preserve Markdown headers and blank lines verbatim
    if (meta.isBlank || meta.isHeader) {
      outputLines.push(meta.raw);
      continue;
    }

    // Handle instrumental / intro / outro placeholder or chord-only lines without syllabifying cue words
    if (meta.isInstrumentalLine) {
      if (meta.headerKind === 'intro') {
        usedIntroBlock = true;
        outputLines.push(formatChordBarLine(introChordPool, meta.cueText));
      } else if (meta.headerKind === 'outro') {
        usedOutroBlock = true;
        const pool =
          outroInstrumentalChords.length > 0
            ? outroInstrumentalChords
            : classification.instrumental.length > 0
            ? classification.instrumental
            : normalizedSegments.slice(-Math.min(4, normalizedSegments.length));
        outputLines.push(formatChordBarLine(pool, meta.cueText));
      } else {
        usedMidInstBlock = true;
        const pool =
          midInstrumentalChords.length > 0
            ? midInstrumentalChords
            : classification.instrumental.length > 0
            ? classification.instrumental
            : vocalSegments.slice(0, Math.min(4, vocalSegments.length));
        outputLines.push(formatChordBarLine(pool, meta.cueText));
      }
      continue;
    }

    // Determine sung line timing window
    let lineStart: number;
    let lineEnd: number;

    const fromLrc = lrcLineMap.get(lineIndex);
    if (fromLrc) {
      lineStart = fromLrc.startTime;
      lineEnd = fromLrc.endTime;
    } else {
      lineStart = vocalStartBase + sungCount * estimatedSecondsPerLine;
      lineEnd = lineStart + estimatedSecondsPerLine;
    }
    sungCount++;

    // Clean any existing chords in brackets from the line to re-position on exact syllables
    const cleanLine = stripChordsFromText(meta.raw);
    const syllabized = syllabifyLine(cleanLine);

    if (syllabized.syllableCount === 0) {
      outputLines.push(meta.raw);
      continue;
    }

    const syllableTimingMap = calculateSyllableTiming(
      syllabized.syllables,
      lineStart,
      lineEnd,
      timingStrategy
    );

    const chordMap = new Map<number, string>();

    // Prefer vocal-classified chords overlapping this sung line window
    let chordsInWindow: ParsedChordInput[] = vocalSegments.filter(
      c => c.endTime > lineStart && c.startTime < lineEnd
    );
    if (chordsInWindow.length === 0) {
      chordsInWindow = normalizedSegments.filter(
        c => c.endTime > lineStart && c.startTime < lineEnd
      );
    }

    if (chordsInWindow.length > 0) {
      const initialChord = chordsInWindow[0].chord;
      chordMap.set(0, initialChord);
      lastPlacedChord = initialChord;

      for (const chordSeg of chordsInWindow) {
        if (chordSeg.startTime > lineStart + 0.3 && chordSeg.chord !== lastPlacedChord) {
          let closestSyllableIndex = 0;
          let minTimeDiff = Infinity;

          for (let sylIdx = 0; sylIdx < syllabized.syllables.length; sylIdx++) {
            const sylTime =
              syllableTimingMap.get(sylIdx) ??
              lineStart + (sylIdx / syllabized.syllables.length) * (lineEnd - lineStart);
            const diff = Math.abs(sylTime - chordSeg.startTime);
            if (diff < minTimeDiff) {
              minTimeDiff = diff;
              closestSyllableIndex = sylIdx;
            }
          }

          if (closestSyllableIndex > 0 && !chordMap.has(closestSyllableIndex)) {
            chordMap.set(closestSyllableIndex, chordSeg.chord);
            lastPlacedChord = chordSeg.chord;
          }
        }
      }
    } else {
      const chordToPlace = effectiveVocalPool[fallbackChordIdx % effectiveVocalPool.length];
      chordMap.set(0, chordToPlace);
      fallbackChordIdx++;

      if (syllabized.syllableCount >= 7 && effectiveVocalPool.length > 1) {
        const midChord = effectiveVocalPool[fallbackChordIdx % effectiveVocalPool.length];
        const midSyl = Math.floor(syllabized.syllableCount / 2);
        if (midChord !== chordToPlace) {
          chordMap.set(midSyl, midChord);
          fallbackChordIdx++;
        }
      }
    }

    outputLines.push(reconstructLineWithChords(syllabized, chordMap));

    // If an LRC mid-song instrumental gap immediately follows this sung line and lyrics didn't have an Instrumental block, insert it inline
    if (fromLrc && !hasInstrumentalHeaderOrBlock) {
      const matchingGap = midLrcGaps.find(
        g => g.afterSungLineIndex === fromLrc.lrcIndex && !insertedGapIndices.has(fromLrc.lrcIndex)
      );
      if (matchingGap) {
        const gapChords = classification.instrumental.filter(
          c => overlapDuration(c.startTime, c.endTime, matchingGap.startTime, matchingGap.endTime) > 0
        );
        if (gapChords.length > 0) {
          insertedGapIndices.add(fromLrc.lrcIndex);
          usedMidInstBlock = true;
          outputLines.push('', '## Instrumental', formatChordBarLine(gapChords));
        }
      }
    }
  }

  // If intro chords were detected (from SSM sections or LRC pre-vocal delay) and lyrics had no ## Intro block, prepend ## Intro
  if (classification.intro.length > 0 && !hasIntroHeaderOrBlock && !usedIntroBlock) {
    outputLines.unshift('## Intro', formatChordBarLine(classification.intro), '');
  }

  // If mid-song instrumental chords were detected (from SSM Instrumental) and not yet placed in lyrics, append ## Instrumental
  if (midInstrumentalChords.length > 0 && !hasInstrumentalHeaderOrBlock && !usedMidInstBlock) {
    outputLines.push('', '## Instrumental', formatChordBarLine(midInstrumentalChords));
  }

  // If outro chords were detected (from SSM Outro or post-LRC tail) and not yet placed in lyrics, append ## Outro
  if (outroInstrumentalChords.length > 0 && !hasOutroHeaderOrBlock && !usedOutroBlock) {
    outputLines.push('', '## Outro', formatChordBarLine(outroInstrumentalChords));
  }

  return outputLines.join('\n');
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
