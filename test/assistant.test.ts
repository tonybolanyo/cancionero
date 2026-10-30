import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, serializeToLrc } from '../src/lib/lyrics/parseLrc';
import { toVtt } from '../src/lib/lyrics/toVtt';
import { formatLrcTimestamp } from '../src/types/lyrics';

interface StampingLine {
  id: string;
  text: string;
  timestamp: number | null;
}

function prepareLinesFromText(lyricsText: string): StampingLine[] {
  if (!lyricsText) return [];
  const rawLines = lyricsText.split(/\r?\n/);
  const result: StampingLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    const cleanText = trimmed.replace(/^\[\d{1,2}:[0-5]?\d(?:\.\d{1,3})?\]\s*/, '');
    if (!cleanText) continue;

    result.push({
      id: `stamp-line-${result.length}`,
      text: cleanText,
      timestamp: null
    });
  }

  return result;
}

function stampLine(lines: StampingLine[], index: number, currentTime: number): { updated: StampingLine[]; nextIndex: number } {
  if (index >= lines.length) return { updated: lines, nextIndex: lines.length };
  const updated = [...lines];
  updated[index] = {
    ...updated[index],
    timestamp: Math.max(0, Math.round(currentTime * 100) / 100)
  };
  return { updated, nextIndex: Math.min(index + 1, lines.length) };
}

function undoStamp(lines: StampingLine[], index: number): { updated: StampingLine[]; nextIndex: number } {
  if (index <= 0 && (!lines[0] || lines[0].timestamp === null)) {
    return { updated: lines, nextIndex: 0 };
  }
  const targetIdx = index > 0 ? index - 1 : 0;
  const updated = [...lines];
  updated[targetIdx] = {
    ...updated[targetIdx],
    timestamp: null
  };
  return { updated, nextIndex: targetIdx };
}

function nudgeTimestamp(lines: StampingLine[], index: number, delta: number): StampingLine[] {
  const updated = [...lines];
  const cur = updated[index]?.timestamp;
  if (cur !== null && cur !== undefined) {
    updated[index] = {
      ...updated[index],
      timestamp: Math.max(0, Math.round((cur + delta) * 100) / 100)
    };
  }
  return updated;
}

test('prepareLinesFromText extracts clean verses and omits section headers', () => {
  const markdown = `
## Estrofa 1
[Am] Primer verso de prueba
[C] Segundo verso con acorde

## Estribillo
[G] Y este es el estribillo
  `;

  const prepared = prepareLinesFromText(markdown);
  assert.equal(prepared.length, 3);
  assert.equal(prepared[0].text, '[Am] Primer verso de prueba');
  assert.equal(prepared[1].text, '[C] Segundo verso con acorde');
  assert.equal(prepared[2].text, '[G] Y este es el estribillo');
  assert.equal(prepared[0].timestamp, null);
});

test('stampLine stamps currentTime to current verse and advances index', () => {
  const lines: StampingLine[] = [
    { id: '1', text: 'Verso 1', timestamp: null },
    { id: '2', text: 'Verso 2', timestamp: null }
  ];

  const step1 = stampLine(lines, 0, 4.238);
  assert.equal(step1.updated[0].timestamp, 4.24);
  assert.equal(step1.nextIndex, 1);

  const step2 = stampLine(step1.updated, 1, 8.512);
  assert.equal(step2.updated[1].timestamp, 8.51);
  assert.equal(step2.nextIndex, 2);
});

test('undoStamp clears the last stamp and moves index back', () => {
  let lines: StampingLine[] = [
    { id: '1', text: 'Verso 1', timestamp: 4.24 },
    { id: '2', text: 'Verso 2', timestamp: 8.51 }
  ];

  const undo = undoStamp(lines, 2);
  assert.equal(undo.nextIndex, 1);
  assert.equal(undo.updated[1].timestamp, null);
  assert.equal(undo.updated[0].timestamp, 4.24);
});

test('nudgeTimestamp accurately adjusts timestamps by +/- 100ms with centisecond rounding', () => {
  let lines: StampingLine[] = [
    { id: '1', text: 'Verso 1', timestamp: 5.00 }
  ];

  lines = nudgeTimestamp(lines, 0, 0.1); // +100ms
  assert.equal(lines[0].timestamp, 5.1);

  lines = nudgeTimestamp(lines, 0, -0.2); // -200ms
  assert.equal(lines[0].timestamp, 4.9);
});

test('complete stamping workflow produces valid LRC and WebVTT', () => {
  const lines: StampingLine[] = [
    { id: '1', text: '[Am] Primer verso', timestamp: 3.5 },
    { id: '2', text: '[G] Segundo verso', timestamp: 7.2 }
  ];

  const syncedLines = lines.map(l => ({ id: l.id, time: l.timestamp!, text: l.text }));
  const lrc = serializeToLrc(syncedLines, { title: 'Canción Test', artist: 'Tony' });

  assert.ok(lrc.includes('[ti:Canción Test]'));
  assert.ok(lrc.includes('[00:03.50] [Am] Primer verso'));
  assert.ok(lrc.includes('[00:07.20] [G] Segundo verso'));

  const parsedBack = parseLrc(lrc);
  assert.equal(parsedBack.lines.length, 2);
  assert.equal(parsedBack.lines[0].time, 3.5);
  assert.equal(parsedBack.lines[1].time, 7.2);

  const vtt = toVtt(syncedLines, { title: 'Canción Test' });
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.ok(vtt.includes('00:00:03.500 --> 00:00:07.200'));
});
