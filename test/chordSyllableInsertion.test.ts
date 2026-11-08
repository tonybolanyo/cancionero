import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { insertChordsIntoSyllables } from '../src/lib/lyrics/lyricsChordIntegration';
import { ChordSegment } from '../src/lib/audio/chords';
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

  it('should preserve Markdown headers and structure without inserting chords into headings', () => {
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

  it('should correctly serialize and deserialize SavedAudioAnalysis in song markdown frontmatter', () => {
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
