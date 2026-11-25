import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectKey, detectKeyFromChroma, getDiatonicChords } from '../src/lib/audio/keyDetection';
import { parseKeyContext, smoothChordsWithViterbi } from '../src/lib/audio/chords';
import { suggestScalesForKey } from '../src/services/scaleSuggestionService';

/**
 * Synthesizes a sequential monophonic melody/arpeggio AudioBuffer at 44100 Hz
 * so zero-crossing frequency detection maps each note cleanly to its pitch class.
 */
function synthesizeNoteSequenceAudioBuffer(
  notes: Array<{ freqHz: number; durationSec: number }>,
  sampleRate: number = 44100
): AudioBuffer {
  const totalSamples = Math.floor(
    notes.reduce((sum, n) => sum + n.durationSec, 0) * sampleRate
  );
  const data = new Float32Array(totalSamples);

  let offset = 0;
  for (const note of notes) {
    const count = Math.floor(note.durationSec * sampleRate);
    for (let i = 0; i < count && offset + i < totalSamples; i++) {
      const t = i / sampleRate;
      data[offset + i] = 0.5 * Math.sin(2 * Math.PI * note.freqHz * t);
    }
    offset += count;
  }

  return {
    numberOfChannels: 1,
    length: totalSamples,
    sampleRate,
    duration: totalSamples / sampleRate,
    getChannelData: () => data
  } as unknown as AudioBuffer;
}

describe('CAL-03: Key detection & tonal context', () => {
  it('detectKeyFromChroma identifies major and minor keys from Krumhansl-Schmuckler pitch distributions', () => {
    // Pitch classes: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
    // C Major: strong C, E, G, plus F, D, B, A
    const cMajorChroma = [10, 0, 4, 0, 8, 5, 0, 9, 0, 3, 0, 4];
    const cMajor = detectKeyFromChroma(cMajorChroma);
    assert.equal(cMajor.key, 'C');
    assert.equal(cMajor.scale, 'Mayor');

    // G Major: strong G, B, D, plus C, A, F#, E
    const gMajorChroma = [5, 0, 8, 0, 3, 0, 4, 10, 0, 4, 0, 8];
    const gMajor = detectKeyFromChroma(gMajorChroma);
    assert.equal(gMajor.key, 'G');
    assert.equal(gMajor.scale, 'Mayor');

    // A Minor: strong A, C, E, plus D, F, B, G
    const aMinorChroma = [8, 0, 5, 0, 7, 5, 0, 4, 1, 10, 0, 3];
    const aMinor = detectKeyFromChroma(aMinorChroma);
    assert.equal(aMinor.key, 'Am');
    assert.equal(aMinor.scale, 'Menor');

    // F# Minor: strong F#, A, C#, plus B, D, G#, E
    const fSharpMinorChroma = [0, 7, 4, 0, 3, 0, 10, 0, 3, 8, 0, 5];
    const fSharpMinor = detectKeyFromChroma(fSharpMinorChroma);
    assert.equal(fSharpMinor.key, 'F#m');
    assert.equal(fSharpMinor.scale, 'Menor');
  });

  it('detectKey detects C Major and A Minor accurately from synthesized AudioBuffers', () => {
    // C Major arpeggio + cadence: C4, E4, G4, F4, G4, C5, E4, C4
    const cMajorBuffer = synthesizeNoteSequenceAudioBuffer([
      { freqHz: 261.63, durationSec: 0.7 }, // C4
      { freqHz: 329.63, durationSec: 0.5 }, // E4
      { freqHz: 392.0, durationSec: 0.6 },  // G4
      { freqHz: 349.23, durationSec: 0.4 }, // F4
      { freqHz: 392.0, durationSec: 0.5 },  // G4
      { freqHz: 523.25, durationSec: 0.7 }, // C5
      { freqHz: 293.66, durationSec: 0.4 }, // D4
      { freqHz: 261.63, durationSec: 0.7 }  // C4
    ]);

    const cDetected = detectKey(cMajorBuffer);
    assert.equal(cDetected.key, 'C');
    assert.equal(cDetected.scale, 'Mayor');
    assert.ok(cDetected.harmonicChords.includes('C'));
    assert.ok(cDetected.harmonicChords.includes('G'));

    // A Minor arpeggio + cadence: A3, C4, E4, D4, F4, E4, A3
    const aMinorBuffer = synthesizeNoteSequenceAudioBuffer([
      { freqHz: 220.0, durationSec: 0.8 },  // A3
      { freqHz: 261.63, durationSec: 0.6 }, // C4
      { freqHz: 329.63, durationSec: 0.6 }, // E4
      { freqHz: 293.66, durationSec: 0.4 }, // D4
      { freqHz: 349.23, durationSec: 0.5 }, // F4
      { freqHz: 329.63, durationSec: 0.5 }, // E4
      { freqHz: 440.0, durationSec: 0.7 },  // A4
      { freqHz: 220.0, durationSec: 0.8 }   // A3
    ]);

    const amDetected = detectKey(aMinorBuffer);
    assert.equal(amDetected.key, 'Am');
    assert.equal(amDetected.scale, 'Menor');
    assert.ok(amDetected.harmonicChords.includes('Am'));
    assert.ok(amDetected.harmonicChords.includes('Dm'));
  });

  it('handles empty or silent AudioBuffer and chroma gracefully with Am fallback', () => {
    const emptyBuffer = {
      numberOfChannels: 1,
      length: 0,
      sampleRate: 44100,
      duration: 0,
      getChannelData: () => new Float32Array(0)
    } as unknown as AudioBuffer;

    assert.equal(detectKey(emptyBuffer).key, 'Am');
    assert.equal(detectKeyFromChroma(new Array(12).fill(0)).key, 'Am');
    assert.equal(detectKeyFromChroma([]).key, 'Am');
  });

  it('getDiatonicChords returns accurate diatonic progressions for major and minor keys', () => {
    assert.deepEqual(getDiatonicChords('D', 'Mayor'), ['D', 'G', 'A', 'Bm', 'Em', 'F#m', 'A7']);
    assert.deepEqual(getDiatonicChords('Em', 'Menor'), ['Em', 'G', 'Am', 'Bm', 'C', 'D', 'B7']);
  });

  it('parseKeyContext and Viterbi smoothing reinforce diatonic chords matching the detected key', () => {
    assert.deepEqual(parseKeyContext({ key: 'F#m', scale: 'minor', confidence: 0.9 }), {
      tonicIndex: 6,
      scale: 'minor',
      confidence: 0.9
    });
    assert.deepEqual(parseKeyContext({ key: 'Bb', scale: 'major' }), {
      tonicIndex: 10,
      scale: 'major',
      confidence: 0.75
    });
    assert.equal(parseKeyContext({ key: '', scale: 'major' }), null);

    // Out-of-key transient chord inside Am progression is smoothed away using KeyContext
    const frames = [
      ...Array.from({ length: 10 }, (_, i) => ({
        startTime: i * 0.1,
        endTime: (i + 1) * 0.1,
        chord: i === 5 ? 'Eb' : 'Am',
        confidence: i === 5 ? 0.45 : 0.85
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        startTime: (10 + i) * 0.1,
        endTime: (11 + i) * 0.1,
        chord: 'Dm',
        confidence: 0.86
      }))
    ];

    const smoothed = smoothChordsWithViterbi(frames, {
      keyContext: { key: 'Am', scale: 'minor', confidence: 0.9 },
      hopDurationSec: 0.1,
      minDurationSec: 0.4
    });

    assert.deepEqual(
      smoothed.map(s => s.chord),
      ['Am', 'Dm']
    );
  });

  it('suggestScalesForKey selects appropriate major vs minor scales for detected keys', () => {
    const minorSuggestions = suggestScalesForKey('F#m');
    assert.equal(minorSuggestions[0].scaleId, 'minor');
    assert.ok(minorSuggestions.some(s => s.scaleId === 'minorPentatonic'));

    const majorSuggestions = suggestScalesForKey('D');
    assert.equal(majorSuggestions[0].scaleId, 'major');
    assert.ok(majorSuggestions.some(s => s.scaleId === 'majorPentatonic'));
  });
});
