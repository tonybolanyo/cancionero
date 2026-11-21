import test from 'node:test';
import assert from 'node:assert';
import {
  buildHarmonicPalette,
  chordToFunctionalSymbol,
  convertLyricsToFunctionalNotation,
  suggestNextChords,
  findLastChordBeforeCursor
} from '../src/lib/music/harmonyEngine';
import {
  getGuitarVoicing,
  getUkuleleVoicing,
  getPianoVoicing,
  suggestOptimalCapo,
  extractUniqueChordsFromLyrics
} from '../src/lib/music/chordDiagrams';
import { estimateDetuningCents, detectPitchYIN } from '../src/lib/audio/tuning';
import { TapTempoTracker, getBeatsPerBar } from '../src/lib/audio/metronome';

// --- 1. Harmony Engine ---
test('harmonyEngine dynamically generates diatonic triads, 7ths, secondary dominants, and modal interchange for any key/mode', () => {
  const fSharpMinor = buildHarmonicPalette('F#m', 'minor');
  assert.strictEqual(fSharpMinor.key, 'F#m');
  assert.deepStrictEqual(
    fSharpMinor.diatonicTriads.map(d => d.chord),
    ['F#m', 'G#dim', 'A', 'Bm', 'C#m', 'D', 'E']
  );
  assert.ok(fSharpMinor.secondaryDominants.some(d => d.chord === 'C#7'));
  assert.ok(fSharpMinor.modalInterchange.some(d => d.roman === 'IV' && d.chord === 'B'));

  const abMajor = buildHarmonicPalette('Ab', 'major');
  assert.strictEqual(abMajor.preference, 'flats');
  assert.deepStrictEqual(
    abMajor.diatonicTriads.map(d => d.chord),
    ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim']
  );

  const dorian = buildHarmonicPalette('Dm', 'dorian');
  // Dorian IV is major (G), ii is minor (Em)
  assert.strictEqual(dorian.diatonicTriads[1].chord, 'Em');
  assert.strictEqual(dorian.diatonicTriads[3].chord, 'G');

  const phrygian = buildHarmonicPalette('Em', 'phrygian');
  // Phrygian bII is F
  assert.strictEqual(phrygian.diatonicTriads[1].chord, 'F');

  const harmonicMinor = buildHarmonicPalette('Am', 'harmonic_minor');
  assert.strictEqual(harmonicMinor.diatonicTriads[4].chord, 'E');
  assert.strictEqual(harmonicMinor.diatonicSevenths[4].chord, 'E7');

  const mixolydian = buildHarmonicPalette('G', 'mixolydian');
  assert.strictEqual(mixolydian.diatonicTriads[6].chord, 'F');
});

test('harmonyEngine converts chords to Roman numerals and Nashville numbers and suggests next chords', () => {
  assert.strictEqual(chordToFunctionalSymbol('G7', 'C', 'roman'), 'V7');
  assert.strictEqual(chordToFunctionalSymbol('Am', 'C', 'roman'), 'vi');
  assert.strictEqual(chordToFunctionalSymbol('Am', 'C', 'nashville'), '6m');
  assert.strictEqual(chordToFunctionalSymbol('D/F#', 'G', 'nashville'), '5/7');

  const converted = convertLyricsToFunctionalNotation('[C]Hola [G]mundo [Am]en [F]luz', 'C', 'roman');
  assert.strictEqual(converted, '[I]Hola [V]mundo [vi]en [IV]luz');

  const cursorLyrics = '[Am]Verso uno [Dm]dos [E7]tres';
  assert.strictEqual(findLastChordBeforeCursor(cursorLyrics, cursorLyrics.length), 'E7');
  assert.strictEqual(findLastChordBeforeCursor(cursorLyrics, 15), 'Am');

  const afterE7 = suggestNextChords('E7', 'Am');
  assert.strictEqual(afterE7[0].chord, 'Am');
});

// --- 2. Chord Diagrams & Capo ---
test('chordDiagrams supports guitar tunings, slash chords, ukulele, piano, and optimal capo suggestions', () => {
  const stdG = getGuitarVoicing('G', 'Estándar (EADGBE)');
  assert.deepStrictEqual(stdG.frets, [3, 2, 0, 0, 0, 3]);

  const dSlashFSharp = getGuitarVoicing('D/F#', 'Estándar (EADGBE)');
  assert.strictEqual(dSlashFSharp.frets[0], 2); // low F# on 6th string

  const dropDC = getGuitarVoicing('D', 'Drop D (DADGBE)');
  assert.strictEqual(dropDC.stringNames[0], 'D');
  assert.ok(dropDC.midiNotes.length >= 4);

  const dadgadG = getGuitarVoicing('G', 'DADGAD');
  assert.strictEqual(dadgadG.stringNames.join(''), 'DADGAd');

  const ukeC = getUkuleleVoicing('C');
  assert.deepStrictEqual(ukeC.frets, [0, 0, 0, 3]);

  const pianoAm = getPianoVoicing('Am');
  assert.deepStrictEqual(pianoAm.pitchClasses, [9, 0, 4]); // A, C, E

  const unique = extractUniqueChordsFromLyrics('[F#m]Uno [D]dos [A]tres [E]cuatro [F#m]cinco');
  assert.deepStrictEqual(unique, ['F#m', 'D', 'A', 'E']);

  const capoOptions = suggestOptimalCapo(['F#m', 'D', 'A', 'E'], 'F#m', 'sharps');
  assert.strictEqual(capoOptions[0].capoFret, 2);
  assert.deepStrictEqual(
    capoOptions[0].chordMapping.map(m => m.shape),
    ['Em', 'C', 'G', 'D']
  );
});

// --- 3. Tuning Calibration & YIN Microphone Pitch Detection ---
test('estimateDetuningCents detects A4=432Hz detuning (~ -31.8 cents) vs A4=440Hz', () => {
  const sampleRate = 22050;
  const durationSec = 4;
  const signal = new Float32Array(sampleRate * durationSec);
  // A3=216Hz & E4=323.63Hz (calibrated to A4=432Hz, which is -31.77 cents flat vs 440Hz)
  const ratio432 = 432 / 440;
  const f1 = 220 * ratio432;
  const f2 = 329.6276 * ratio432;

  for (let i = 0; i < signal.length; i++) {
    const t = i / sampleRate;
    signal[i] = 0.45 * Math.sin(2 * Math.PI * f1 * t) + 0.35 * Math.sin(2 * Math.PI * f2 * t);
  }

  const estimate = estimateDetuningCents(signal, sampleRate);
  assert.ok(
    Math.abs(estimate.cents - (-31.8)) <= 6,
    `Expected detuning around -31.8 cents, got ${estimate.cents}`
  );
  assert.ok(estimate.referenceA4Hz < 436 && estimate.referenceA4Hz > 428);
});

test('detectPitchYIN accurately detects 110Hz (A2), 329.63Hz (E4), and 440Hz (A4)', () => {
  const sampleRate = 44100;
  const frameLen = 2048;

  const checkFreq = (targetHz: number, expectedNote: string, expectedOctave: number) => {
    const buf = new Float32Array(frameLen);
    for (let i = 0; i < frameLen; i++) {
      buf[i] = 0.6 * Math.sin((2 * Math.PI * targetHz * i) / sampleRate);
    }
    const res = detectPitchYIN(buf, sampleRate, 440);
    assert.ok(res !== null, `Expected pitch detection for ${targetHz}Hz`);
    assert.strictEqual(res.noteName, expectedNote);
    assert.strictEqual(res.octave, expectedOctave);
    assert.ok(Math.abs(res.cents) <= 3, `Expected cents within ±3, got ${res.cents}`);
  };

  checkFreq(110.0, 'A', 2);
  checkFreq(329.63, 'E', 4);
  checkFreq(440.0, 'A', 4);
});

// --- 4. TapTempoTracker & Metronome Meter ---
test('TapTempoTracker measures 120 BPM from 500ms tap intervals', () => {
  const tracker = new TapTempoTracker();
  assert.strictEqual(tracker.tap(1000).bpm, null);
  assert.strictEqual(tracker.tap(1500).bpm, 120);
  assert.strictEqual(tracker.tap(2000).bpm, 120);
  assert.strictEqual(tracker.tap(2500).bpm, 120);

  assert.strictEqual(getBeatsPerBar('3/4'), 3);
  assert.strictEqual(getBeatsPerBar('6/8'), 6);
  assert.strictEqual(getBeatsPerBar('4/4'), 4);
});
