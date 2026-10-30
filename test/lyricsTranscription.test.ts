import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranscriptionSegments, segmentsToSyncedLyricLines } from '../src/lib/lyrics/transcription';

test('normalizeTranscriptionSegments sorts by start time and removes empty text', () => {
  const normalized = normalizeTranscriptionSegments([
    { start: 12.2, end: 15.9, text: '  segunda frase  ' },
    { start: -2, end: 1.5, text: '  intro ' },
    { start: 8.3, end: 9.1, text: '   ' }
  ]);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].start, 0);
  assert.equal(normalized[0].text, 'intro');
  assert.equal(normalized[1].start, 12.2);
  assert.equal(normalized[1].text, 'segunda frase');
});

test('segmentsToSyncedLyricLines maps sanitized segments to SyncedLyricLine[]', () => {
  const lines = segmentsToSyncedLyricLines([
    { start: 1.234, end: 2.3, text: 'Hola' },
    { start: 3.456, end: 5.2, text: 'mundo' }
  ]);

  assert.equal(lines.length, 2);
  assert.equal(lines[0].time, 1.23);
  assert.equal(lines[0].text, 'Hola');
  assert.equal(lines[1].time, 3.46);
});
