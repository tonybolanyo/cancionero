import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLrc,
  parseLrcTimeToSeconds,
  cleanRawText,
  isLrcContent,
  serializeToLrc
} from '../src/lib/lyrics/parseLrc';
import { toVtt, formatVttTimestamp } from '../src/lib/lyrics/toVtt';
import { formatLrcTimestamp } from '../src/types/lyrics';

test('cleanRawText removes BOM and normalizes CRLF and CR to LF', () => {
  const withBomAndCrlf = '\uFEFF[ti:Test]\r\n[00:10.00]Línea 1\r\n[00:15.00]Línea 2\r[00:20.00]Línea 3';
  const cleaned = cleanRawText(withBomAndCrlf);

  assert.equal(cleaned.startsWith('\uFEFF'), false);
  assert.equal(cleaned.includes('\r'), false);
  assert.equal(cleaned.split('\n').length, 4);
});

test('parseLrc extracts metadata [ti:], [ar:], [al:], [offset:], [by:]', () => {
  const lrc = `
[ti:Noches de Cristal]
[ar:Tony González]
[al:Cancionero 2026]
[by:Acoustic Studio]
[offset:500]
[00:10.00] Primera estrofa
  `;

  const result = parseLrc(lrc);
  assert.equal(result.metadata.title, 'Noches de Cristal');
  assert.equal(result.metadata.artist, 'Tony González');
  assert.equal(result.metadata.album, 'Cancionero 2026');
  assert.equal(result.metadata.by, 'Acoustic Studio');
  assert.equal(result.metadata.offset, 500);

  // Time was 10.00s, with offset +500ms (+0.5s) it becomes 10.50s
  assert.equal(result.lines[0].time, 10.5);
});

test('parseLrc supports multiple timestamps on a single line', () => {
  const lrc = `
[00:05.00][00:25.00] Estribillo que se repite
[00:15.00] Estrofa intermedia
  `;

  const result = parseLrc(lrc);
  assert.equal(result.lines.length, 3);
  // Lines should be chronologically ordered
  assert.equal(result.lines[0].time, 5.0);
  assert.equal(result.lines[0].text, 'Estribillo que se repite');

  assert.equal(result.lines[1].time, 15.0);
  assert.equal(result.lines[1].text, 'Estrofa intermedia');

  assert.equal(result.lines[2].time, 25.0);
  assert.equal(result.lines[2].text, 'Estribillo que se repite');
});

test('parseLrc handles disordered timestamps and sorts them with clear warning', () => {
  const disorderedLrc = `
[00:30.00] Tercera línea
[00:10.00] Primera línea
[00:20.00] Segunda línea
  `;

  const result = parseLrc(disorderedLrc);
  assert.equal(result.lines.length, 3);
  assert.equal(result.lines[0].time, 10.0);
  assert.equal(result.lines[0].text, 'Primera línea');
  assert.equal(result.lines[1].time, 20.0);
  assert.equal(result.lines[1].text, 'Segunda línea');
  assert.equal(result.lines[2].time, 30.0);
  assert.equal(result.lines[2].text, 'Tercera línea');

  assert.ok(result.warnings.some(w => w.includes('reordenadas')));
});

test('parseLrc handles negative timestamps and clamps to 0 with warning', () => {
  const lrcWithNegative = `
[-00:02.50] Entrada prematura
[00:05.00] Voz principal
  `;

  const result = parseLrc(lrcWithNegative);
  assert.equal(result.lines[0].time, 0);
  assert.equal(result.lines[0].text, 'Entrada prematura');
  assert.equal(result.lines[1].time, 5.0);
  assert.ok(result.warnings.some(w => w.includes('negativas')));
});

test('serializeToLrc converts lines back to valid LRC string format', () => {
  const lines = [
    { id: '1', time: 5.5, text: 'Hola mundo' },
    { id: '2', time: 12.25, text: 'Segunda línea' }
  ];
  const metadata = { title: 'Mi Canción', artist: 'Tony' };

  const serialized = serializeToLrc(lines, metadata);
  assert.ok(serialized.includes('[ti:Mi Canción]'));
  assert.ok(serialized.includes('[ar:Tony]'));
  assert.ok(serialized.includes('[00:05.50] Hola mundo'));
  assert.ok(serialized.includes('[00:12.25] Segunda línea'));
});

test('toVtt generates standard WebVTT cues with proper header and timings', () => {
  const lines = [
    { id: '1', time: 10.0, text: 'Primera línea' },
    { id: '2', time: 14.5, text: 'Segunda línea' },
    { id: '3', time: 20.0, text: 'Fin de canción' }
  ];
  const metadata = { title: 'Demo VTT' };

  const vtt = toVtt(lines, metadata);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('NOTE Title: Demo VTT'));
  // Cue 1 starts at 10.000s and ends at next line 14.500s
  assert.ok(vtt.includes('00:00:10.000 --> 00:00:14.500'));
  assert.ok(vtt.includes('Primera línea'));
  // Cue 2 starts at 14.500s and ends at 20.000s
  assert.ok(vtt.includes('00:00:14.500 --> 00:00:20.000'));
  // Last cue has standard fallback duration
  assert.ok(vtt.includes('00:00:20.000 --> 00:00:23.500'));
});

test('formatLrcTimestamp and formatVttTimestamp format times accurately', () => {
  assert.equal(formatLrcTimestamp(0), '00:00.00');
  assert.equal(formatLrcTimestamp(65.4), '01:05.40');
  assert.equal(formatLrcTimestamp(125.05), '02:05.05');

  assert.equal(formatVttTimestamp(0), '00:00:00.000');
  assert.equal(formatVttTimestamp(74.25), '00:01:14.250');
  assert.equal(formatVttTimestamp(3661.5), '01:01:01.500');
});

test('isLrcContent correctly identifies LRC timestamped text', () => {
  assert.equal(isLrcContent('[00:12.34] Letra'), true);
  assert.equal(isLrcContent('[01:05] Letra sin centésimas'), true);
  assert.equal(isLrcContent('[Estribillo] No es LRC'), false);
  assert.equal(isLrcContent('[Am] Letra con acorde'), false);
});
