import test from 'node:test';
import assert from 'node:assert';
import {
  extractSectionProgressions,
  buildTimedChordEventsFromSong,
  buildTimedChordEventsFromSegments,
  exportChordsToMidiBytes
} from '../src/lib/music/midiExporter';
import {
  detectSpanishStress,
  extractSpanishRhymeTails,
  analyzePoeticMetrics
} from '../src/lib/lyrics/poeticAnalysis';
import {
  songToChordPro,
  chordProToSong
} from '../src/lib/music/chordPro';
import type { Song } from '../src/types/song';

// --- 1. MIDI Exporter & Section Progressions ---
test('midiExporter extracts section progressions and generates valid SMF Format 1 bytes', () => {
  const lyrics = [
    '## Intro',
    '[Am]  [G]  [F]  [E7]',
    '',
    '## Estrofa 1',
    '[Am] En la noche [G] clara',
    '[F] busco tu [E7] mirada'
  ].join('\n');

  const sections = extractSectionProgressions(lyrics);
  assert.strictEqual(sections.length, 2);
  assert.strictEqual(sections[0].title, 'Intro');
  assert.deepStrictEqual(sections[0].chords, ['Am', 'G', 'F', 'E7']);
  assert.strictEqual(sections[1].title, 'Estrofa 1');
  assert.deepStrictEqual(sections[1].chords, ['Am', 'G', 'F', 'E7']);

  const events = buildTimedChordEventsFromSong(
    { lyrics, tempo: 120, timeSignature: '4/4' }
  );
  assert.strictEqual(events.length, 8);
  assert.strictEqual(events[0].sectionLabel, 'Intro');
  assert.strictEqual(events[0].startTimeSec, 0);
  // 120 BPM in 4/4 -> 1 bar = 2.0s; Intro has chord-only line so 1 bar per chord
  assert.strictEqual(events[0].endTimeSec, 2);
  assert.strictEqual(events[4].sectionLabel, 'Estrofa 1');

  const midiBytes = exportChordsToMidiBytes(events, {
    title: 'Prueba MIDI',
    tempo: 120,
    timeSignature: '4/4',
    instrument: 'guitar'
  });

  // Verify MThd header: "MThd", length 6, format 1, 2 tracks, 480 PPQ
  assert.strictEqual(String.fromCharCode(...midiBytes.slice(0, 4)), 'MThd');
  assert.strictEqual(midiBytes[7], 6);
  assert.strictEqual(midiBytes[9], 1); // Format 1
  assert.strictEqual(midiBytes[11], 2); // 2 tracks
  assert.strictEqual((midiBytes[12] << 8) | midiBytes[13], 480);

  // Track 0 starts with "MTrk" at byte 14
  assert.strictEqual(String.fromCharCode(...midiBytes.slice(14, 18)), 'MTrk');

  // Verify tempo meta-event FF 51 03 (500,000 us = 0x07A120 for 120 BPM) exists
  let foundTempo = false;
  let foundNoteOn = false;
  let foundNoteOff = false;
  for (let i = 0; i < midiBytes.length - 5; i++) {
    if (
      midiBytes[i] === 0xff &&
      midiBytes[i + 1] === 0x51 &&
      midiBytes[i + 2] === 0x03 &&
      midiBytes[i + 3] === 0x07 &&
      midiBytes[i + 4] === 0xa1 &&
      midiBytes[i + 5] === 0x20
    ) {
      foundTempo = true;
    }
    if (midiBytes[i] === 0x90) foundNoteOn = true;
    if (midiBytes[i] === 0x80) foundNoteOff = true;
  }
  assert.ok(foundTempo, 'Expected 120 BPM tempo meta-event in conductor track');
  assert.ok(foundNoteOn, 'Expected Note On events in chord track');
  assert.ok(foundNoteOff, 'Expected Note Off events in chord track');
});

test('buildTimedChordEventsFromSegments filters N.C. segments and maps section labels', () => {
  const events = buildTimedChordEventsFromSegments(
    [
      { startTime: 0, endTime: 2.5, chord: 'N.C.', confidence: 0.4 },
      { startTime: 2.5, endTime: 6.0, chord: 'Am', confidence: 0.9 },
      { startTime: 6.0, endTime: 10.0, chord: 'G', confidence: 0.85 }
    ],
    [
      { label: 'Estrofa 1', startTime: 2.4, endTime: 10.0 }
    ]
  );
  assert.strictEqual(events.length, 2);
  assert.strictEqual(events[0].chord, 'Am');
  assert.strictEqual(events[0].sectionLabel, 'Estrofa 1');
  assert.strictEqual(events[1].chord, 'G');
});

// --- 2. Spanish Poetic Meter & Rhyme Analysis ---
test('poeticAnalysis applies RAE stress rules and Ley del Acento Final', () => {
  const aguda = detectSpanishStress('canción');
  assert.strictEqual(aguda.stressType, 'aguda');
  assert.strictEqual(aguda.adjustment, 1);

  const llana = detectSpanishStress('ventana');
  assert.strictEqual(llana.stressType, 'llana');
  assert.strictEqual(llana.adjustment, 0);

  const esdrujula = detectSpanishStress('música');
  assert.strictEqual(esdrujula.stressType, 'esdrujula');
  assert.strictEqual(esdrujula.adjustment, -1);
});

test('poeticAnalysis detects sinalefas, consonant/assonant rhymes, and stanza schemes', () => {
  const tails1 = extractSpanishRhymeTails('cantaba');
  const tails2 = extractSpanishRhymeTails('estaba');
  const tails3 = extractSpanishRhymeTails('palabras');
  assert.strictEqual(tails1.consonant, 'aba');
  assert.strictEqual(tails2.consonant, 'aba');
  assert.strictEqual(tails1.assonant, 'a-a');
  assert.strictEqual(tails3.assonant, 'a-a');
  assert.notStrictEqual(tails1.consonant, tails3.consonant);

  // Classic octosyllable ABAB / abab test with sinalefa and final aguda (+1)
  const lyrics = [
    '## Estrofa 1',
    '[Am] En la noche oscura y fría',   // En-la-no-che_os-cu-ray-frí-a -> check sinalefa
    '[G] busco tu dulce canción',        // bus-co-tu-dul-ce-can-ción (7 + 1 aguda = 8)
    '[F] mientras muere el nuevo día',
    '[E7] dentro de mi corazón'         // den-tro-de-mi-co-ra-zón (7 + 1 aguda = 8)
  ].join('\n');

  const summary = analyzePoeticMetrics(lyrics);
  const verses = summary.lines.filter(l => !l.isEmpty && !l.isSectionHeader);
  assert.strictEqual(verses.length, 4);

  // Line 2: "busco tu dulce canción" -> 7 grammatical + 1 aguda = 8 (Octosílabo)
  assert.strictEqual(verses[1].metricSyllables, 8);
  assert.strictEqual(verses[1].stressType, 'aguda');
  assert.strictEqual(verses[1].verseName, 'Octosílabo');

  // Line 4: "dentro de mi corazón" -> 7 grammatical + 1 aguda = 8
  assert.strictEqual(verses[3].metricSyllables, 8);

  // Line 1 & 3 share consonant rhyme (-ía); Line 2 & 4 share consonant rhyme (-ón)
  assert.strictEqual(verses[0].rhymeType, 'consonante');
  assert.strictEqual(verses[2].rhymeType, 'consonante');
  assert.strictEqual(verses[0].rhymeLetter, verses[2].rhymeLetter);
  assert.strictEqual(verses[1].rhymeType, 'consonante');
  assert.strictEqual(verses[3].rhymeType, 'consonante');
  assert.strictEqual(verses[1].rhymeLetter, verses[3].rhymeLetter);

  assert.strictEqual(summary.stanzas.length, 1);
  assert.strictEqual(summary.stanzas[0].scheme.toLowerCase(), 'abab');
});

// --- 3. ChordPro Bidirectional Interop ---
test('chordPro serializes and parses songs including metadata, sections, and transposition', () => {
  const sampleSong: Song = {
    id: 'faros-del-norte',
    title: 'Faros del Norte',
    status: 'published',
    year: 2025,
    genre: 'Canción de Autor',
    key: 'Am',
    tempo: 92,
    timeSignature: '3/4',
    tuning: 'Drop D (DADGBE)',
    notes: 'Tocar con arpegio suave',
    lyrics: [
      '## Estrofa 1',
      '[Am] Sobre el muelle [G] frío',
      '[F] canta el viento [E7] sur',
      '',
      '## Estribillo',
      '[C] Llévame [G] lejos de aquí',
      '[Am] donde [F] nazca la luz'
    ].join('\n'),
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  };

  const choText = songToChordPro(sampleSong, {
    semitones: 2,
    capoFret: 2,
    artist: 'Autor Demo'
  });

  assert.ok(choText.includes('{title: Faros del Norte}'));
  assert.ok(choText.includes('{artist: Autor Demo}'));
  assert.ok(choText.includes('{key: Bm}')); // Am + 2 semitones = Bm
  assert.ok(choText.includes('{tempo: 92}'));
  assert.ok(choText.includes('{time: 3/4}'));
  assert.ok(choText.includes('{capo: 2}'));
  assert.ok(choText.includes('{start_of_verse: Estrofa 1}'));
  assert.ok(choText.includes('{end_of_verse}'));
  assert.ok(choText.includes('{start_of_chorus: Estribillo}'));
  assert.ok(choText.includes('{end_of_chorus}'));
  assert.ok(choText.includes('[Bm] Sobre el muelle [A] frío'));

  const parsed = chordProToSong(`# Comentario ignorado\n${choText}`, 'Fallback');
  assert.strictEqual(parsed.title, 'Faros del Norte');
  assert.strictEqual(parsed.artist, 'Autor Demo');
  assert.strictEqual(parsed.key, 'Bm');
  assert.strictEqual(parsed.tempo, 92);
  assert.strictEqual(parsed.timeSignature, '3/4');
  assert.strictEqual(parsed.tuning, 'Drop D (DADGBE)');
  assert.strictEqual(parsed.year, 2025);
  assert.ok(parsed.lyrics.includes('## Estrofa 1'));
  assert.ok(parsed.lyrics.includes('## Estribillo'));
  assert.ok(parsed.lyrics.includes('[Bm] Sobre el muelle [A] frío'));
  assert.ok(parsed.notes?.includes('Cejilla en traste 2'));
});
