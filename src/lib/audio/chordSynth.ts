import { getChordVoicing, InstrumentType } from '../music/chordDiagrams';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export function midiToFrequency(midi: number, referenceA4Hz: number = 440): number {
  return referenceA4Hz * Math.pow(2, (midi - 69) / 12);
}

/**
 * Generates a Karplus-Strong plucked-string AudioBuffer at a target frequency.
 * Pure Web Audio DSP without external samples.
 */
function createKarplusStrongBuffer(
  ctx: AudioContext,
  frequencyHz: number,
  durationSec: number = 1.9,
  damping: number = 0.996
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.max(256, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const out = buffer.getChannelData(0);

  const period = Math.max(2, Math.round(sampleRate / Math.max(55, frequencyHz)));
  const delayLine = new Float32Array(period);

  // Initial pluck excitation: filtered white noise burst + soft low-end impulse
  let prevNoise = 0;
  for (let i = 0; i < period; i++) {
    const white = Math.random() * 2 - 1;
    // One-pole low-pass on burst so acoustic strings sound warm instead of harsh
    prevNoise = 0.6 * white + 0.4 * prevNoise;
    delayLine[i] = prevNoise;
  }

  let ptr = 0;
  let lastSample = 0;
  for (let n = 0; n < totalSamples; n++) {
    const current = delayLine[ptr];
    const nextPtr = (ptr + 1) % period;
    // Classic Karplus-Strong 2-point averaging filter + subtle decay
    const avg = damping * 0.5 * (current + delayLine[nextPtr]);
    // Gentle attack smoothing for first 2ms to avoid clicks
    const env = n < sampleRate * 0.002 ? n / (sampleRate * 0.002) : 1;
    delayLine[ptr] = avg;
    lastSample = avg * env;
    out[n] = lastSample;
    ptr = nextPtr;
  }

  return buffer;
}

function playPluckedNote(
  ctx: AudioContext,
  masterGain: GainNode,
  midi: number,
  startTime: number,
  durationSec: number,
  gainAmount: number,
  damping: number
): void {
  const freq = midiToFrequency(midi);
  const buf = createKarplusStrongBuffer(ctx, freq, durationSec, damping);
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(gainAmount, startTime);
  noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

  // Subtle body resonance lowpass
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(4800, freq * 6.5), startTime);
  filter.Q.setValueAtTime(0.7, startTime);

  src.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(masterGain);

  src.start(startTime);
  src.stop(startTime + durationSec + 0.05);
}

function playPianoNote(
  ctx: AudioContext,
  masterGain: GainNode,
  midi: number,
  startTime: number,
  durationSec: number,
  gainAmount: number
): void {
  const freq = midiToFrequency(midi);
  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0.0001, startTime);
  noteGain.gain.linearRampToValueAtTime(gainAmount, startTime + 0.015);
  noteGain.gain.exponentialRampToValueAtTime(gainAmount * 0.45, startTime + 0.35);
  noteGain.gain.exponentialRampToValueAtTime(0.0008, startTime + durationSec);

  // Warm additive electric/acoustic piano timbre (fundamental + 2nd + 3rd harmonic)
  const harmonics: Array<{ mult: number; amp: number; type: OscillatorType }> = [
    { mult: 1, amp: 0.72, type: 'triangle' },
    { mult: 2, amp: 0.22, type: 'sine' },
    { mult: 3, amp: 0.08, type: 'sine' }
  ];

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(4200, freq * 5), startTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2), startTime + durationSec);

  filter.connect(noteGain);
  noteGain.connect(masterGain);

  for (const h of harmonics) {
    const osc = ctx.createOscillator();
    osc.type = h.type;
    osc.frequency.setValueAtTime(freq * h.mult, startTime);
    const hGain = ctx.createGain();
    hGain.gain.setValueAtTime(h.amp, startTime);
    osc.connect(hGain);
    hGain.connect(filter);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.04);
  }
}

/**
 * Plays a chord in real time in the browser using Web Audio API:
 *  - Guitar / Ukulele: Karplus-Strong plucked strings with natural 26ms strum offset
 *  - Piano: Warm additive synthesis
 */
export function playChordPreview(
  chordSymbol: string,
  instrument: InstrumentType = 'guitar',
  tuning?: string,
  capoFret: number = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const voicing = getChordVoicing(chordSymbol, instrument, tuning);
  const now = ctx.currentTime + 0.01;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.45, now);
  masterGain.connect(ctx.destination);

  // When previewing a chord shape directly while capo is set, capo transposition can be passed via sounding chord
  const notes = voicing.midiNotes.map(n => n + (capoFret > 0 && instrument === 'guitar' ? 0 : 0));

  if (instrument === 'piano') {
    const perNoteGain = Math.min(0.24, 0.75 / Math.max(1, notes.length));
    notes.forEach((midi, idx) => {
      playPianoNote(ctx, masterGain, midi, now + idx * 0.012, 1.85, perNoteGain);
    });
  } else {
    const strumStep = instrument === 'ukulele' ? 0.022 : 0.028;
    const duration = instrument === 'ukulele' ? 1.5 : 2.1;
    const damping = instrument === 'ukulele' ? 0.9945 : 0.9965;
    const perNoteGain = Math.min(0.26, 0.85 / Math.max(1, notes.length));

    notes.forEach((midi, idx) => {
      playPluckedNote(ctx, masterGain, midi, now + idx * strumStep, duration, perNoteGain, damping);
    });
  }
}

/**
 * Plays a single reference tone (for tuner reference pitches).
 */
export function playReferenceNote(frequencyHz: number, durationSec: number = 1.6): void {
  const ctx = getAudioContext();
  if (!ctx || frequencyHz <= 0) return;
  const now = ctx.currentTime + 0.01;

  const buf = createKarplusStrongBuffer(ctx, frequencyHz, durationSec, 0.997);
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.32, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(now);
  src.stop(now + durationSec + 0.05);
}

export interface ProgressionChordStep {
  chord: string;
  /** Duration in beats (defaults to beatsPerBar if omitted) */
  beats?: number;
}

export interface ProgressionPlayOptions {
  tempo?: number;
  timeSignature?: string;
  instrument?: InstrumentType;
  tuning?: string;
  /** Default beats per chord when step.beats is omitted (defaults to 1 bar) */
  beatsPerChord?: number;
  loop?: boolean;
  onChordChange?: (index: number, chord: string) => void;
  onEnded?: () => void;
}

export interface ProgressionPlaybackHandle {
  stop: () => void;
}

function parseBeatsPerBar(timeSignature?: string): number {
  if (!timeSignature) return 4;
  const parts = timeSignature.split('/').map(Number);
  if (parts.length === 2 && Number.isFinite(parts[0]) && parts[0] > 0) {
    if (parts[0] === 6 && parts[1] === 8) return 2; // 6/8 felt in 2 dotted-quarter beats (or 3s)
    if (parts[0] === 12 && parts[1] === 8) return 4;
    return Math.min(8, Math.max(2, parts[0]));
  }
  return 4;
}

/**
 * Plays a chord progression in real time synced to BPM and time signature
 * using Web Audio Karplus-Strong / additive synthesis with strummed voicing.
 */
export function playChordProgression(
  steps: Array<string | ProgressionChordStep>,
  options: ProgressionPlayOptions = {}
): ProgressionPlaybackHandle {
  const normalized: ProgressionChordStep[] = steps
    .map(s => (typeof s === 'string' ? { chord: s } : s))
    .filter(s => s.chord && s.chord !== 'N.C.');

  if (normalized.length === 0) {
    options.onEnded?.();
    return { stop: () => {} };
  }

  const ctx = getAudioContext();
  if (!ctx) {
    options.onEnded?.();
    return { stop: () => {} };
  }

  const tempo = Math.max(40, Math.min(240, options.tempo || 96));
  const beatSec = 60 / tempo;
  const defaultBeats = options.beatsPerChord ?? parseBeatsPerBar(options.timeSignature);
  const instrument: InstrumentType = options.instrument || 'guitar';

  let stopped = false;
  const activeTimers: number[] = [];
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.42, ctx.currentTime);
  masterGain.connect(ctx.destination);

  const schedulePass = (passStartTime: number) => {
    if (stopped) return;

    let offsetSec = 0;
    normalized.forEach((step, idx) => {
      const chordBeats = Math.max(0.5, step.beats ?? defaultBeats);
      const stepDurationSec = chordBeats * beatSec;
      const startTime = passStartTime + offsetSec;
      const delayMs = Math.max(0, (startTime - ctx.currentTime) * 1000);

      const timer = window.setTimeout(() => {
        if (stopped) return;
        options.onChordChange?.(idx, step.chord);
      }, delayMs);
      activeTimers.push(timer);

      const voicing = getChordVoicing(step.chord, instrument, options.tuning);
      const notes = voicing.midiNotes;
      const ringDuration = Math.min(2.6, Math.max(0.45, stepDurationSec * 0.96));

      if (instrument === 'piano') {
        const perNoteGain = Math.min(0.22, 0.72 / Math.max(1, notes.length));
        notes.forEach((midi, nIdx) => {
          playPianoNote(ctx, masterGain, midi, startTime + nIdx * 0.01, ringDuration, perNoteGain);
        });
      } else {
        const strumStep = instrument === 'ukulele' ? 0.018 : 0.022;
        const damping = instrument === 'ukulele' ? 0.994 : 0.996;
        const perNoteGain = Math.min(0.24, 0.82 / Math.max(1, notes.length));

        // Downstroke on chord start
        notes.forEach((midi, nIdx) => {
          playPluckedNote(ctx, masterGain, midi, startTime + nIdx * strumStep, ringDuration, perNoteGain, damping);
        });

        // Subtle mid-bar acoustic brush on longer bars (>= 3 beats)
        if (chordBeats >= 3 && stepDurationSec >= 1.2) {
          const halfTime = startTime + stepDurationSec * 0.5;
          const upperNotes = notes.slice(-3);
          upperNotes.forEach((midi, nIdx) => {
            playPluckedNote(
              ctx,
              masterGain,
              midi,
              halfTime + nIdx * 0.016,
              Math.max(0.35, stepDurationSec * 0.45),
              perNoteGain * 0.55,
              damping
            );
          });
        }
      }

      offsetSec += stepDurationSec;
    });

    const endMs = Math.max(0, (passStartTime + offsetSec - ctx.currentTime) * 1000);
    const endTimer = window.setTimeout(() => {
      if (stopped) return;
      if (options.loop) {
        schedulePass(ctx.currentTime + 0.04);
      } else {
        options.onEnded?.();
      }
    }, endMs);
    activeTimers.push(endTimer);
  };

  schedulePass(ctx.currentTime + 0.03);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      activeTimers.forEach(id => clearTimeout(id));
      activeTimers.length = 0;
      try {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      } catch {
        // ignore audio context teardown errors
      }
      options.onEnded?.();
    }
  };
}

