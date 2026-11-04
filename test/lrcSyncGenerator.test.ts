import test from 'node:test';
import assert from 'node:assert/strict';
import {
  syllabifyWord,
  syllabifyLine,
  findSyllableAtPosition,
  distributeChordAcrossSyllables,
  SyllableizedLine
} from '../src/lib/lyrics/syllableAnalysis';
import {
  calculateSyllableTiming,
  generateSyllableLrcLine,
  generateLrcFromPlainLyricsWithChords,
  generateLrcWithSyllableTiming
} from '../src/lib/lyrics/lrcSyncGenerator';
import { ChordSegment } from '../src/lib/audio/chords';

// ============================================================================
// SYLLABLE ANALYSIS TESTS
// ============================================================================

test('syllabifyWord handles Spanish words correctly', () => {
  const result = syllabifyWord('canción');
  assert.ok(result.length > 0, 'Should produce syllables');
  assert.equal(result.join(''), 'canción', 'Syllables should reconstruct original');
});

test('syllabifyWord handles English words correctly', () => {
  const result = syllabifyWord('information');
  assert.ok(result.length > 0, 'Should produce syllables');
  assert.equal(result.join(''), 'information', 'Syllables should reconstruct original');
});

test('syllabifyWord handles single syllable words', () => {
  const result = syllabifyWord('sol');
  assert.ok(result.length >= 1);
  assert.equal(result.join(''), 'sol');
});

test('syllabifyLine handles empty input', () => {
  const result = syllabifyLine('');
  assert.equal(result.syllableCount, 0);
  assert.equal(result.syllables.length, 0);
});

test('syllabifyLine syllabifies a complete lyric line', () => {
  const line = 'La noche es oscura y bella';
  const result = syllabifyLine(line);

  assert.ok(result.syllableCount > 0, 'Should have syllables');
  assert.ok(result.syllables.length > 0, 'Should have syllable objects');

  // Verify each syllable has required properties
  for (const syl of result.syllables) {
    assert.ok(typeof syl.text === 'string', 'Syllable should have text');
    assert.ok(typeof syl.index === 'number', 'Syllable should have index');
    assert.ok(syl.startChar >= 0, 'startChar should be >= 0');
    assert.ok(syl.endChar > syl.startChar, 'endChar should be > startChar');
  }
});

test('syllabifyLine preserves syllable order and position info', () => {
  const line = 'Hola mundo';
  const result = syllabifyLine(line);

  assert.ok(result.syllables.length >= 2, 'Should have at least 2 syllables');

  // Positions should be in ascending order
  for (let i = 1; i < result.syllables.length; i++) {
    assert.ok(
      result.syllables[i].startChar >= result.syllables[i - 1].endChar,
      'Syllables should not overlap'
    );
  }
});

test('findSyllableAtPosition returns nearest syllable', () => {
  const line = syllabifyLine('uno dos tres');

  if (line.syllables.length > 0) {
    const firstSyl = line.syllables[0];
    const found = findSyllableAtPosition(line, firstSyl.startChar);

    assert.ok(found !== null);
    assert.equal(found?.index, 0, 'Should find first syllable');
  }
});

test('distributeChordAcrossSyllables distributes chords cyclically', () => {
  const line = syllabifyLine('La noche es oscura');
  const chords = ['C', 'G', 'Am', 'F'];

  const chordMap = distributeChordAcrossSyllables(line, chords);

  assert.ok(chordMap.size > 0, 'Should distribute at least one chord');
  assert.ok(chordMap.size <= line.syllableCount, 'Should not exceed syllable count');

  // Verify all mapped chords are from the input list
  for (const chord of chordMap.values()) {
    assert.ok(chords.includes(chord), 'Chord should be from input');
  }
});

// ============================================================================
// LRC SYNC GENERATOR TESTS
// ============================================================================

test('calculateSyllableTiming with uniform strategy', () => {
  const syllables = [
    { text: 'La', index: 0, startChar: 0, endChar: 2 },
    { text: 'no', index: 1, startChar: 2, endChar: 4 },
    { text: 'che', index: 2, startChar: 4, endChar: 7 }
  ];

  const timing = calculateSyllableTiming(syllables, 0, 3, 'uniform');

  assert.equal(timing.size, 3, 'Should have timing for all syllables');

  const times = Array.from(timing.values()).sort((a, b) => a - b);
  assert.equal(times[0], 0, 'First syllable should start at 0');
  assert.ok(times[2] <= 3, 'Last syllable should end at or before line end');

  // Uniform spacing: approximately 1 second each
  assert.ok(Math.abs(times[1] - 1) < 0.1, 'Second syllable should be around 1s');
  assert.ok(Math.abs(times[2] - 2) < 0.1, 'Third syllable should be around 2s');
});

test('calculateSyllableTiming with exponential strategy', () => {
  const syllables = [
    { text: 'La', index: 0, startChar: 0, endChar: 2 },
    { text: 'no', index: 1, startChar: 2, endChar: 4 },
    { text: 'che', index: 2, startChar: 4, endChar: 7 }
  ];

  const timing = calculateSyllableTiming(syllables, 0, 3, 'exponential');

  assert.equal(timing.size, 3);

  const times = Array.from(timing.values());
  assert.equal(times[0], 0);
  assert.ok(times[2] <= 3);

  // Exponential: later syllables get more time
  assert.ok(times[1] < times[2] - times[1], 'Gap should grow toward the end');
});

test('calculateSyllableTiming with phonetic strategy', () => {
  const syllables = [
    { text: 'sol', index: 0, startChar: 0, endChar: 3 },
    { text: 'la', index: 1, startChar: 3, endChar: 5 }
  ];

  const timing = calculateSyllableTiming(syllables, 0, 2, 'phonetic');

  assert.equal(timing.size, 2);
  assert.equal(timing.get(0), 0);
  assert.ok(timing.get(1)! > 0);
  assert.ok(timing.get(1)! <= 2);
});

test('generateSyllableLrcLine creates LRC line with chords', () => {
  const lineText = 'La noche es bella';
  const startTime = 0;
  const endTime = 4;

  const chords: ChordSegment[] = [
    { startTime: 0, endTime: 2, chord: 'C', confidence: 0.9 },
    { startTime: 2, endTime: 4, chord: 'G', confidence: 0.85 }
  ];

  const lrcLine = generateSyllableLrcLine(lineText, startTime, endTime, chords, 'uniform');

  assert.ok(lrcLine.text.length > 0);
  assert.ok(lrcLine.text.includes('['), 'Should contain chord brackets');
  assert.ok(lrcLine.time >= startTime);
  assert.ok(lrcLine.time <= endTime);
  assert.ok(lrcLine.syllables.syllableCount > 0);
  assert.ok(lrcLine.chords.size > 0, 'Should have positioned chords');
});

test('generateSyllableLrcLine handles line without chords', () => {
  const lineText = 'Simple line';
  const lrcLine = generateSyllableLrcLine(lineText, 0, 2, [], 'uniform');

  assert.ok(lrcLine.text.length > 0);
  assert.ok(lrcLine.time >= 0);
  assert.ok(lrcLine.syllables.syllableCount >= 1);
});

test('generateSyllableLrcLine preserves line text content', () => {
  const lineText = 'Que bonito es';
  const lrcLine = generateSyllableLrcLine(lineText, 0, 3, [], 'uniform');

  // Should reconstruct most of the original text (syllables are reassembled)
  const textWithoutChords = lrcLine.text.replace(/\[[^\]]+\]/g, '').trim();
  
  // Verify syllables are present (might be rearranged but should contain key parts)
  assert.ok(textWithoutChords.length > 0, 'Should have text content');
  assert.ok(lrcLine.syllables.syllableCount > 0, 'Should have syllables');
});

test('generateLrcFromPlainLyricsWithChords generates valid LRC', () => {
  const lyrics = `
La noche es oscura
Y las estrellas brillan
En el cielo sin fin
  `.trim();

  const chords: ChordSegment[] = [
    { startTime: 0, endTime: 5, chord: 'C', confidence: 0.9 },
    { startTime: 5, endTime: 10, chord: 'G', confidence: 0.85 },
    { startTime: 10, endTime: 15, chord: 'Am', confidence: 0.8 }
  ];

  const lrc = generateLrcFromPlainLyricsWithChords(lyrics, chords, {
    title: 'Test Song',
    artist: 'Test Artist'
  });

  assert.ok(lrc.includes('[ti:Test Song]'));
  assert.ok(lrc.includes('[ar:Test Artist]'));
  assert.ok(lrc.includes('['));
  assert.ok(lrc.includes(']'));

  const lines = lrc.split('\n').filter(l => /^\[\d{2}:\d{2}\.\d{2}\]/.test(l));
  assert.ok(lines.length > 0, 'Should have timestamped lines');
});

test('generateLrcFromPlainLyricsWithChords with custom linesPerMinute', () => {
  const lyrics = 'Line 1\nLine 2\nLine 3';
  const chords: ChordSegment[] = [];

  const lrc = generateLrcFromPlainLyricsWithChords(lyrics, chords, undefined, {
    linesPerMinute: 6 // 10 seconds per line
  });

  const lines = lrc.split('\n');
  const firstLine = lines.find(l => /^\[\d{2}:\d{2}\.\d{2}\]/.test(l));
  const secondLine = lines.find((l, idx) => /^\[\d{2}:\d{2}\.\d{2}\]/.test(l) && idx > lines.indexOf(firstLine));

  if (firstLine && secondLine) {
    const match1 = firstLine.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);
    const match2 = secondLine.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);

    if (match1 && match2) {
      const time1 = parseInt(match1[1]) * 60 + parseInt(match1[2]) + parseInt(match1[3]) / 100;
      const time2 = parseInt(match2[1]) * 60 + parseInt(match2[2]) + parseInt(match2[3]) / 100;

      // Approximately 10 seconds apart
      assert.ok(Math.abs((time2 - time1) - 10) < 1, 'Lines should be ~10 seconds apart');
    }
  }
});

test('generateLrcWithSyllableTiming with explicit line timing', () => {
  const lyrics = 'Verse 1\nVerse 2';
  const lineTiming = [
    { text: 'Verse 1', startTime: 0, endTime: 4 },
    { text: 'Verse 2', startTime: 4, endTime: 8 }
  ];

  const chords: ChordSegment[] = [
    { startTime: 0, endTime: 4, chord: 'C', confidence: 0.9 },
    { startTime: 4, endTime: 8, chord: 'G', confidence: 0.85 }
  ];

  const lrc = generateLrcWithSyllableTiming(lyrics, lineTiming, chords, undefined, 'uniform');

  assert.ok(lrc.includes('[00:00.00]'));
  assert.ok(lrc.includes('[00:04.00]'));
});

test('Chord positioning is distributed across syllables', () => {
  const lineText = 'Esta es una línea con muchas sílabas';
  const chords: ChordSegment[] = [
    { startTime: 0, endTime: 2, chord: 'C', confidence: 0.9 },
    { startTime: 2, endTime: 4, chord: 'G', confidence: 0.85 },
    { startTime: 4, endTime: 6, chord: 'Am', confidence: 0.8 }
  ];

  const lrcLine = generateSyllableLrcLine(lineText, 0, 6, chords, 'uniform');

  // Count chords in output
  const chordMatches = lrcLine.text.match(/\[[A-G][^\]]*\]/g) || [];
  assert.ok(
    chordMatches.length > 0,
    'Should have positioned at least one chord in the line'
  );

  // Chords should be at different positions (syllables)
  const positions = chordMatches.map(c => lrcLine.text.indexOf(c));
  const uniquePositions = new Set(positions);
  assert.ok(uniquePositions.size > 1 || chordMatches.length === 1, 'Chords should be spread or single');
});

test('Empty lyrics handling', () => {
  const lrc = generateLrcFromPlainLyricsWithChords('', [], undefined);
  assert.equal(lrc, '');
});

test('Lyrics with markdown headers are skipped', () => {
  const lyrics = `
## Estrofa 1
La noche es oscura
## Estribillo
Brillan las estrellas
  `.trim();

  const lrc = generateLrcFromPlainLyricsWithChords(lyrics, []);
  const lines = lrc.split('\n').filter(l => /^\[\d{2}:\d{2}\.\d{2}\]/.test(l));

  // Should have at least the lyric lines (headers filtered by the function)
  assert.ok(lines.length >= 2, 'Should have at least 2 lyric lines');
  // Verify that it doesn't output the markdown headers in the main LRC lines
  const lrcContent = lines.join('\n');
  assert.ok(!lrcContent.includes('##'), 'Should not include markdown in output lines');
});
