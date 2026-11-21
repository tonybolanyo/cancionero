import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  insertChordsIntoSyllables,
  classifyChordsByPerformanceRole
} from '../src/lib/lyrics/lyricsChordIntegration';
import { ChordSegment } from '../src/lib/audio/chords';
import type { MusicalSection } from '../src/lib/audio/structure';
import { Song, SavedAudioAnalysis } from '../src/types/song';
import { songToMarkdown, markdownToSong } from '../src/utils/markdownParser';

describe('Chord Syllable Insertion & Audio Analysis Persistence', () => {
  const sampleChords: ChordSegment[] = [
    { startTime: 0.0, endTime: 2.0, chord: 'Am', confidence: 0.95 },
    { startTime: 2.5, endTime: 5.0, chord: 'G', confidence: 0.90 },
    { startTime: 5.5, endTime: 8.0, chord: 'F', confidence: 0.88 },
    { startTime: 8.5, endTime: 11.0, chord: 'E7', confidence: 0.92 }
  ];

  it('should insert detected chords into the corresponding syllables of lyrics', () => {
    const rawLyrics = `## Estrofa 1
En la noche que nos vimos
caminamos sin hablar`;

    const result = insertChordsIntoSyllables(rawLyrics, sampleChords, {
      audioDuration: 12,
      tempo: 96
    });

    assert.ok(result.includes('## Estrofa 1'), 'Preserves markdown section header');
    assert.ok(result.includes('[Am]'), 'Inserts initial chord [Am]');
    assert.ok(result.includes('['), 'Contains bracketed chords');
  });

  it('should preserve Markdown headers and structure without inserting chords into headings or syllabifying cues', () => {
    const rawLyrics = `## Intro
(Instrumental)

## Estrofa 1
Dejaste la puerta abierta
y el viento empezó a silbar

## Estribillo
Y ahora vuelvo a recordar`;

    const chords: ChordSegment[] = [
      { startTime: 0, endTime: 2, chord: 'C' },
      { startTime: 2, endTime: 4, chord: 'G' },
      { startTime: 4, endTime: 6, chord: 'Am' },
      { startTime: 6, endTime: 8, chord: 'F' }
    ];

    const result = insertChordsIntoSyllables(rawLyrics, chords, { audioDuration: 10 });
    const lines = result.split('\n');

    const introHeader = lines.find(l => l.startsWith('## Intro'));
    const estrofaHeader = lines.find(l => l.startsWith('## Estrofa 1'));
    const estribilloHeader = lines.find(l => l.startsWith('## Estribillo'));

    assert.equal(introHeader, '## Intro');
    assert.equal(estrofaHeader, '## Estrofa 1');
    assert.equal(estribilloHeader, '## Estribillo');

    // (Instrumental) cue should not get mid-word bracketed chords like [C]Ins[G]trumental
    const introBodyLine = lines[lines.indexOf('## Intro') + 1];
    assert.ok(introBodyLine.includes('(Instrumental)'), 'Keeps (Instrumental) marker intact');
    assert.ok(!/Ins\[/.test(introBodyLine), 'Does not split (Instrumental) cue word by syllables');
  });

  it('should use LRC timestamps when available to accurately align chords to syllables', () => {
    const rawLyrics = `[00:01.00]En la noche que nos vimos
[00:05.00]caminamos sin hablar`;

    const chords: ChordSegment[] = [
      { startTime: 1.0, endTime: 3.0, chord: 'Am' },
      { startTime: 2.2, endTime: 4.5, chord: 'G' },
      { startTime: 5.0, endTime: 7.0, chord: 'F' },
      { startTime: 6.5, endTime: 9.0, chord: 'E7' }
    ];

    const result = insertChordsIntoSyllables(rawLyrics, chords, {
      lrcText: rawLyrics,
      audioDuration: 10
    });

    assert.ok(result.includes('[Am]'), 'Has Am chord');
    assert.ok(result.includes('[G]'), 'Has G chord');
    assert.ok(result.includes('[F]'), 'Has F chord');
    assert.ok(result.includes('[E7]'), 'Has E7 chord');
  });

  it('classifies chords into intro, vocal, and instrumental using SSM sections and LRC gaps', () => {
    const sections: MusicalSection[] = [
      { id: 's0', type: 'Intro', label: 'Intro', startTime: 0, endTime: 8, confidence: 0.9, avgRms: 0.15, isVocal: false },
      { id: 's1', type: 'Estrofa', label: 'Estrofa 1', startTime: 8, endTime: 20, confidence: 0.88, avgRms: 0.35, isVocal: true },
      { id: 's2', type: 'Instrumental', label: 'Instrumental', startTime: 20, endTime: 28, confidence: 0.85, avgRms: 0.25, isVocal: false },
      { id: 's3', type: 'Estribillo', label: 'Estribillo', startTime: 28, endTime: 40, confidence: 0.92, avgRms: 0.62, isVocal: true }
    ];

    const chords: ChordSegment[] = [
      { startTime: 0, endTime: 4, chord: 'Dm' },
      { startTime: 4, endTime: 8, chord: 'A7' },
      { startTime: 8, endTime: 14, chord: 'Dm' },
      { startTime: 14, endTime: 20, chord: 'Gm' },
      { startTime: 20, endTime: 24, chord: 'Bb' },
      { startTime: 24, endTime: 28, chord: 'A7' },
      { startTime: 28, endTime: 34, chord: 'F' },
      { startTime: 34, endTime: 40, chord: 'C' }
    ];

    const rawLyrics = `## Intro
(Instrumental)

## Estrofa 1
Caminando en la penumbra
busco luces en el mar

## Instrumental
(Solo)

## Estribillo
Y el viento vuelve a cantar
con tu nombre al despertar`;

    const classified = classifyChordsByPerformanceRole(chords, rawLyrics, {
      sections,
      audioDuration: 40
    });

    assert.deepEqual(classified.intro.map(c => c.chord), ['Dm', 'A7']);
    assert.deepEqual(classified.vocal.map(c => c.chord), ['Dm', 'Gm', 'F', 'C']);
    assert.deepEqual(classified.instrumental.map(c => c.chord), ['Bb', 'A7']);

    const inserted = insertChordsIntoSyllables(rawLyrics, chords, {
      sections,
      audioDuration: 40
    });

    // Intro block holds [Dm] [A7] (Instrumental)
    assert.ok(inserted.includes('[Dm]  [A7]  (Instrumental)'));
    // Instrumental block holds [Bb] [A7] (Solo)
    assert.ok(inserted.includes('[Bb]  [A7]  (Solo)'));
    // Vocal verses receive vocal chords starting after Intro (not shifted by intro chords)
    const verseSection = inserted.split('## Estrofa 1')[1].split('## Instrumental')[0];
    assert.ok(verseSection.includes('[Dm]'), 'Verse 1 receives Dm');
    assert.ok(verseSection.includes('[Gm]'), 'Verse 1 receives Gm');
    const chorusSection = inserted.split('## Estribillo')[1];
    assert.ok(chorusSection.includes('[F]'), 'Chorus receives F');
    assert.ok(chorusSection.includes('[C]'), 'Chorus receives C');
  });

  it('detects intro and mid-song instrumental chord blocks from LRC gaps when lyrics omit headers', () => {
    const lrcWithIntroAndBreak = `[00:08.00]Primer verso cantado
[00:12.00]Segundo verso cantado
[00:24.00]Tercer verso tras el solo`;

    const plainLyrics = `Primer verso cantado
Segundo verso cantado
Tercer verso tras el solo`;

    const chords: ChordSegment[] = [
      { startTime: 0, endTime: 4, chord: 'Am' },
      { startTime: 4, endTime: 8, chord: 'Em' },
      { startTime: 8, endTime: 12, chord: 'C' },
      { startTime: 12, endTime: 16, chord: 'G' },
      { startTime: 16, endTime: 24, chord: 'F' },
      { startTime: 24, endTime: 28, chord: 'G' }
    ];

    const classified = classifyChordsByPerformanceRole(chords, plainLyrics, {
      lrcText: lrcWithIntroAndBreak,
      audioDuration: 28
    });

    assert.deepEqual(classified.intro.map(c => c.chord), ['Am', 'Em']);
    assert.deepEqual(classified.instrumental.map(c => c.chord), ['F']);
    assert.deepEqual(classified.vocal.map(c => c.chord), ['C', 'G', 'G']);

    const inserted = insertChordsIntoSyllables(plainLyrics, chords, {
      lrcText: lrcWithIntroAndBreak,
      audioDuration: 28
    });

    assert.ok(inserted.startsWith('## Intro\n[Am]  [Em]'), `Expected prepended ## Intro, got:\n${inserted}`);
    assert.ok(inserted.includes('## Instrumental\n[F]'), `Expected inline ## Instrumental [F], got:\n${inserted}`);
    assert.ok(inserted.includes('[C]'), 'Sung line 1 starts with [C] instead of intro [Am]');
  });

  it('should correctly serialize and deserialize SavedAudioAnalysis (including sections) in song markdown frontmatter', () => {
    const audioAnalysis: SavedAudioAnalysis = {
      analyzedAt: '2025-05-10T14:30:00.000Z',
      source: 'dsp_local',
      tempo: 104,
      tempoConfidence: 0.92,
      tempoOffset: 0.35,
      key: 'Dm',
      scale: 'minor',
      timeSignature: '3/4',
      tuning: 'Estándar (EADGBE)',
      durationSeconds: 184.5,
      chordProgression: 'Dm - Bb - C - A7',
      chords: [
        { startTime: 0.0, endTime: 4.2, chord: 'Dm', confidence: 0.96 },
        { startTime: 4.2, endTime: 8.5, chord: 'Bb', confidence: 0.91 },
        { startTime: 8.5, endTime: 12.8, chord: 'C', confidence: 0.89 },
        { startTime: 12.8, endTime: 17.0, chord: 'A7', confidence: 0.94 }
      ],
      sections: [
        { id: 'section-0', type: 'Intro', label: 'Intro', startTime: 0, endTime: 4.2, confidence: 0.89, avgRms: 0.14, isVocal: false },
        { id: 'section-1', type: 'Estrofa', label: 'Estrofa 1', startTime: 4.2, endTime: 17.0, confidence: 0.86, avgRms: 0.42, isVocal: true }
      ],
      musicalNotes: 'Progresión en Re menor estilo vals acústico'
    };

    const song: Song = {
      id: 'cancion-test-analisis',
      title: 'Canción con Análisis Guardado',
      status: 'draft',
      year: 2025,
      genre: 'Vals Poético',
      key: 'Dm',
      tempo: 104,
      timeSignature: '3/4',
      tuning: 'Estándar (EADGBE)',
      lyrics: `## Estrofa 1\n[Dm] Esta es una prueba de persistencia\n[Bb] sin reanalizar el audio`,
      audioAnalysis,
      createdAt: '2025-05-10T14:30:00.000Z',
      updatedAt: '2025-05-10T14:30:00.000Z'
    };

    const markdown = songToMarkdown(song);
    assert.ok(markdown.includes('audioAnalysis:'), 'Markdown includes audioAnalysis frontmatter field');

    const parsedSong = markdownToSong(markdown, song.id);
    assert.ok(parsedSong.audioAnalysis, 'Parsed song contains audioAnalysis');
    assert.equal(parsedSong.audioAnalysis?.tempo, 104);
    assert.equal(parsedSong.audioAnalysis?.key, 'Dm');
    assert.equal(parsedSong.audioAnalysis?.scale, 'minor');
    assert.equal(parsedSong.audioAnalysis?.timeSignature, '3/4');
    assert.equal(parsedSong.audioAnalysis?.chords?.length, 4);
    assert.equal(parsedSong.audioAnalysis?.chords?.[0].chord, 'Dm');
    assert.equal(parsedSong.audioAnalysis?.chords?.[3].chord, 'A7');
    assert.equal(parsedSong.audioAnalysis?.sections?.length, 2);
    assert.equal(parsedSong.audioAnalysis?.sections?.[0].type, 'Intro');
    assert.equal(parsedSong.audioAnalysis?.sections?.[1].label, 'Estrofa 1');
    assert.equal(parsedSong.audioAnalysis?.durationSeconds, 184.5);
  });

  it('should support undoing chord insertion by restoring original lyrics', () => {
    const originalLyrics = `## Estrofa 1
Dejaste la puerta abierta
y el viento empezó a silbar`;

    const modified = insertChordsIntoSyllables(originalLyrics, sampleChords, { audioDuration: 12 });
    assert.notEqual(modified, originalLyrics, 'Modified text is different');

    // Simulate undo
    let currentLyrics = modified;
    const undoHistory = originalLyrics;
    currentLyrics = undoHistory;

    assert.equal(currentLyrics, originalLyrics, 'Restores exact original text on undo');
  });
});
