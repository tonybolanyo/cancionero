import test from 'node:test';
import assert from 'node:assert/strict';
import { insertSectionHeaderAtCursor } from '../src/utils/songwriterHelper';

test('inserts section header into empty lyrics and places cursor on next line', () => {
  const res = insertSectionHeaderAtCursor('', 'Estrofa 1', 0, 0);
  assert.equal(res.text, '## Estrofa 1\n');
  assert.equal(res.cursorOffset, '## Estrofa 1\n'.length);
});

test('inserts section header at the beginning before existing section header with blank line separator', () => {
  const lyrics = '## Estrofa 1\n[Am] Primer verso';
  const res = insertSectionHeaderAtCursor(lyrics, 'Intro', 0, 0);
  assert.equal(res.text, '## Intro\n\n## Estrofa 1\n[Am] Primer verso');
  assert.equal(res.cursorOffset, '## Intro\n'.length);
});

test('inserts section header at the beginning before a lyric line', () => {
  const lyrics = '[Am] Primer verso';
  const res = insertSectionHeaderAtCursor(lyrics, 'Estrofa 1', 0, 0);
  assert.equal(res.text, '## Estrofa 1\n[Am] Primer verso');
  assert.equal(res.cursorOffset, '## Estrofa 1\n'.length);
});

test('inserts section header at cursor before an existing verse in the middle of lyrics', () => {
  const lyrics = '## Intro\n[Am]  [G]\n\n[Am] Primer verso\n[G] Segundo verso';
  const cursor = lyrics.indexOf('[Am] Primer verso');
  const res = insertSectionHeaderAtCursor(lyrics, 'Estrofa 1', cursor, cursor);

  assert.equal(
    res.text,
    '## Intro\n[Am]  [G]\n\n## Estrofa 1\n[Am] Primer verso\n[G] Segundo verso'
  );
  assert.equal(res.text.slice(res.cursorOffset), '[Am] Primer verso\n[G] Segundo verso');
});

test('inserts section header on a blank line between two verses', () => {
  const lyrics = '[Am] Verso 1\n\n[G] Verso 2';
  // Cursor sits on the blank line (index right after the first \n)
  const cursor = '[Am] Verso 1\n'.length;
  const res = insertSectionHeaderAtCursor(lyrics, 'Estribillo', cursor, cursor);

  assert.equal(res.text, '[Am] Verso 1\n\n## Estribillo\n\n[G] Verso 2');
  assert.equal(res.text.slice(res.cursorOffset), '\n[G] Verso 2');
});

test('inserts section header when cursor is in the middle of a line', () => {
  const lyrics = '[Am] Verso 1 [G] Verso 2';
  const cursor = lyrics.indexOf('[G] Verso 2');
  const res = insertSectionHeaderAtCursor(lyrics, 'Puente', cursor, cursor);

  assert.equal(res.text, '[Am] Verso 1 \n\n## Puente\n[G] Verso 2');
  assert.equal(res.text.slice(res.cursorOffset), '[G] Verso 2');
});

test('inserts section header at the end of lyrics', () => {
  const lyrics = '## Estrofa 1\n[Am] Verso final';
  const cursor = lyrics.length;
  const res = insertSectionHeaderAtCursor(lyrics, 'Coda', cursor, cursor);

  assert.equal(res.text, '## Estrofa 1\n[Am] Verso final\n\n## Coda\n');
  assert.equal(res.cursorOffset, res.text.length);
});

test('replaces selected text when inserting section header', () => {
  const lyrics = '## Intro\nREEMPLAZAR\n[Am] Verso';
  const start = lyrics.indexOf('REEMPLAZAR');
  const end = start + 'REEMPLAZAR'.length;
  const res = insertSectionHeaderAtCursor(lyrics, 'Estrofa 1', start, end);

  assert.equal(res.text, '## Intro\n\n## Estrofa 1\n\n[Am] Verso');
});
