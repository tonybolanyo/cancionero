import { getChordVoicing, InstrumentType } from './chordDiagrams';
import type { ChordSegment } from '../audio/chords';
import type { Song } from '../../types/song';

export interface MidiChordEvent {
  chord: string;
  startTimeSec: number;
  endTimeSec: number;
  sectionLabel?: string;
}

export interface SectionProgression {
  id: string;
  title: string;
  chords: string[];
  lineCount: number;
}

export interface MidiExportOptions {
  title?: string;
  tempo?: number;
  timeSignature?: string;
  instrument?: InstrumentType;
  tuning?: string;
  velocity?: number;
  strumTicks?: number;
}

const TICKS_PER_QUARTER = 480;

function writeUint32BE(val: number): number[] {
  return [(val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff];
}

function writeUint16BE(val: number): number[] {
  return [(val >>> 8) & 0xff, val & 0xff];
}

function writeVarLen(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const bytes: number[] = [v & 0x7f];
  v >>>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  return bytes;
}

function encodeAscii(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push(code < 128 ? code : 63); // replace non-ASCII with '?' for standard MIDI compatibility
  }
  return bytes;
}

function parseTimeSignatureValues(ts?: string): { numerator: number; denominator: number; denomPow: number } {
  if (!ts) return { numerator: 4, denominator: 4, denomPow: 2 };
  const parts = ts.split('/').map(Number);
  const num = Number.isFinite(parts[0]) && parts[0] > 0 ? Math.min(16, parts[0]) : 4;
  const den = Number.isFinite(parts[1]) && parts[1] > 0 ? parts[1] : 4;
  let denomPow = 2;
  if (den === 2) denomPow = 1;
  else if (den === 4) denomPow = 2;
  else if (den === 8) denomPow = 3;
  else if (den === 16) denomPow = 4;
  return { numerator: num, denominator: den, denomPow };
}

/**
 * Extracts structured sections and chord progressions from Markdown lyrics `[Chord]`.
 */
export function extractSectionProgressions(lyrics: string): SectionProgression[] {
  if (!lyrics || !lyrics.trim()) return [];

  const lines = lyrics.split('\n');
  const sections: SectionProgression[] = [];
  let current: SectionProgression = {
    id: 'section-0',
    title: 'Tema completo',
    chords: [],
    lineCount: 0
  };

  const pushCurrentIfNotEmpty = () => {
    if (current.chords.length > 0 || current.lineCount > 0) {
      sections.push(current);
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^#{1,3}\s+/.test(trimmed)) {
      pushCurrentIfNotEmpty();
      const heading = trimmed.replace(/^#+\s*/, '').trim();
      current = {
        id: `section-${sections.length}`,
        title: heading || `Sección ${sections.length + 1}`,
        chords: [],
        lineCount: 0
      };
      return;
    }

    if (!trimmed) return;
    current.lineCount++;

    const matches = trimmed.match(/\[([A-G][#b]?[^\]]*)\]/g);
    if (matches) {
      for (const m of matches) {
        const symbol = m.slice(1, -1).trim();
        if (symbol) {
          current.chords.push(symbol);
        }
      }
    }
  });

  pushCurrentIfNotEmpty();
  return sections.filter(s => s.chords.length > 0);
}

/**
 * Builds timed chord events from a Song's lyrics `[Chord]` markers using its tempo & meter.
 * Allocates 1 bar per line when multiple chords share a line, or 1 bar per chord on chord-only lines.
 */
export function buildTimedChordEventsFromSong(
  song: Pick<Song, 'lyrics' | 'tempo' | 'timeSignature'>,
  options?: { tempoOverride?: number; timeSignatureOverride?: string }
): MidiChordEvent[] {
  const bpm = Math.max(40, Math.min(240, options?.tempoOverride || song.tempo || 96));
  const ts = parseTimeSignatureValues(options?.timeSignatureOverride || song.timeSignature);
  // Quarter-note beats per bar (for 6/8, 6 eighth notes = 3 quarter notes)
  const quarterBeatsPerBar = ts.numerator * (4 / ts.denominator);
  const barDurationSec = (quarterBeatsPerBar * 60) / bpm;

  const events: MidiChordEvent[] = [];
  const lines = (song.lyrics || '').split('\n');
  let cursorSec = 0;
  let currentSection = '';
  let pendingSectionForNextEvent = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#{1,3}\s+/.test(line)) {
      currentSection = line.replace(/^#+\s*/, '').trim();
      pendingSectionForNextEvent = currentSection;
      continue;
    }

    const chordMatches = Array.from(line.matchAll(/\[([A-G][#b]?[^\]]*)\]/g)).map(m => m[1].trim());
    if (chordMatches.length === 0) continue;

    // Check if the line has mostly chords (like "## Intro\n[Am] [G] [F] [E7]") or lyric text
    const strippedText = line.replace(/\[[^\]]+\]/g, '').trim();
    const isChordOnlyLine = strippedText.length === 0;

    if (isChordOnlyLine) {
      // 1 bar per chord on chord-only instrumental lines
      for (const chord of chordMatches) {
        events.push({
          chord,
          startTimeSec: cursorSec,
          endTimeSec: cursorSec + barDurationSec,
          sectionLabel: pendingSectionForNextEvent || undefined
        });
        pendingSectionForNextEvent = '';
        cursorSec += barDurationSec;
      }
    } else {
      // Split 1 bar (or 2 bars if >= 3 chords) across the chords in this lyric line
      const barsForLine = chordMatches.length >= 3 ? 2 : 1;
      const totalLineSec = barsForLine * barDurationSec;
      const sliceSec = totalLineSec / chordMatches.length;

      for (const chord of chordMatches) {
        events.push({
          chord,
          startTimeSec: cursorSec,
          endTimeSec: cursorSec + sliceSec,
          sectionLabel: pendingSectionForNextEvent || undefined
        });
        pendingSectionForNextEvent = '';
        cursorSec += sliceSec;
      }
    }
  }

  return events;
}

/**
 * Converts detected DSP ChordSegment[] directly to MidiChordEvent[] preserving exact timestamps.
 */
export function buildTimedChordEventsFromSegments(
  segments: ChordSegment[],
  sections?: Array<{ label: string; startTime: number; endTime: number }>
): MidiChordEvent[] {
  const valid = segments.filter(s => s.chord && s.chord !== 'N.C.' && s.endTime > s.startTime);
  return valid.map((seg, idx) => {
    let sectionLabel: string | undefined;
    if (sections && sections.length > 0) {
      const matched = sections.find(
        sec => Math.abs(sec.startTime - seg.startTime) < 0.75 || (idx === 0 && sec.startTime === 0)
      );
      if (matched) sectionLabel = matched.label;
    }
    return {
      chord: seg.chord,
      startTimeSec: seg.startTime,
      endTimeSec: seg.endTime,
      sectionLabel
    };
  });
}

interface RawMidiMessage {
  tick: number;
  order: number;
  bytes: number[];
}

function encodeTrackChunk(messages: RawMidiMessage[]): number[] {
  const sorted = [...messages].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const trackBytes: number[] = [];
  let lastTick = 0;

  for (const msg of sorted) {
    const delta = Math.max(0, Math.round(msg.tick) - lastTick);
    lastTick = Math.max(lastTick, Math.round(msg.tick));
    trackBytes.push(...writeVarLen(delta), ...msg.bytes);
  }

  // End of track meta-event (FF 2F 00)
  trackBytes.push(0x00, 0xff, 0x2f, 0x00);

  return [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    ...writeUint32BE(trackBytes.length),
    ...trackBytes
  ];
}

/**
 * Generates a Standard MIDI File (SMF Format 1) binary byte array (`Uint8Array`)
 * containing tempo, time signature, section markers, and polyphonic chord voicings.
 */
export function exportChordsToMidiBytes(
  events: MidiChordEvent[],
  options: MidiExportOptions = {}
): Uint8Array {
  const tempo = Math.max(40, Math.min(240, options.tempo || 96));
  const ts = parseTimeSignatureValues(options.timeSignature);
  const instrument: InstrumentType = options.instrument || 'guitar';
  const velocity = Math.max(20, Math.min(127, options.velocity ?? 86));
  const strumTicks = Math.max(0, options.strumTicks ?? (instrument === 'piano' ? 6 : 18));
  const trackTitle = (options.title || 'Cancionero Chords').slice(0, 80);

  // Microseconds per quarter note
  const mpqn = Math.round(60_000_000 / tempo);
  const secondsToTicks = (sec: number): number =>
    Math.max(0, Math.round((sec * tempo * TICKS_PER_QUARTER) / 60));

  // Track 0: Conductor track (Title, Tempo, Time Signature, Section Markers)
  const titleAscii = encodeAscii(trackTitle);
  const conductorMsgs: RawMidiMessage[] = [
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x03, titleAscii.length, ...titleAscii]
    },
    {
      tick: 0,
      order: 1,
      bytes: [0xff, 0x51, 0x03, (mpqn >>> 16) & 0xff, (mpqn >>> 8) & 0xff, mpqn & 0xff]
    },
    {
      tick: 0,
      order: 2,
      bytes: [0xff, 0x58, 0x04, ts.numerator, ts.denomPow, 24, 8]
    }
  ];

  // Track 1: Chord harmony track
  const chordTrackName = encodeAscii(`Acordes (${instrument})`);
  const chordMsgs: RawMidiMessage[] = [
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x03, chordTrackName.length, ...chordTrackName]
    },
    // Program Change on channel 0: 25 = Steel Acoustic Guitar, 0 = Acoustic Grand Piano
    {
      tick: 0,
      order: 1,
      bytes: [0xc0, instrument === 'piano' ? 0 : 25]
    }
  ];

  for (const ev of events) {
    const startTick = secondsToTicks(ev.startTimeSec);
    const endTick = Math.max(startTick + 60, secondsToTicks(ev.endTimeSec) - 12);

    if (ev.sectionLabel) {
      const markerBytes = encodeAscii(ev.sectionLabel.slice(0, 60));
      conductorMsgs.push({
        tick: startTick,
        order: 3,
        bytes: [0xff, 0x06, markerBytes.length, ...markerBytes]
      });
    }

    // Also add chord text event in Track 1 for DAWs that display chord markers
    const chordText = encodeAscii(ev.chord);
    chordMsgs.push({
      tick: startTick,
      order: 2,
      bytes: [0xff, 0x01, chordText.length, ...chordText]
    });

    const voicing = getChordVoicing(ev.chord, instrument, options.tuning);
    voicing.midiNotes.forEach((midi, idx) => {
      const clampedNote = Math.max(0, Math.min(127, Math.round(midi)));
      const noteOnTick = Math.min(endTick - 20, startTick + idx * strumTicks);
      const noteVel = Math.max(30, Math.min(127, velocity - idx * 2));
      chordMsgs.push({
        tick: noteOnTick,
        order: 4,
        bytes: [0x90, clampedNote, noteVel]
      });
      chordMsgs.push({
        tick: endTick,
        order: 3,
        bytes: [0x80, clampedNote, 0x00]
      });
    });
  }

  // MThd header: Format 1, 2 tracks, TICKS_PER_QUARTER
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    ...writeUint32BE(6),
    ...writeUint16BE(1),
    ...writeUint16BE(2),
    ...writeUint16BE(TICKS_PER_QUARTER)
  ];

  const track0 = encodeTrackChunk(conductorMsgs);
  const track1 = encodeTrackChunk(chordMsgs);

  return new Uint8Array([...header, ...track0, ...track1]);
}

/**
 * Triggers a browser download for a generated `.mid` file.
 */
export function downloadMidiFile(midiBytes: Uint8Array, filename: string): void {
  const safeName = filename.endsWith('.mid') ? filename : `${filename}.mid`;
  const copy = new Uint8Array(midiBytes.byteLength);
  copy.set(midiBytes);
  const blob = new Blob([copy.buffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
