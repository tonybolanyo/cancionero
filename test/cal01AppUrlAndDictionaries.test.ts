import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAppBaseUrl, resolveAppUrl } from '../src/utils/appUrl';
import {
  loadScaleDictionary,
  getAllScales,
  getScaleEntry,
  resetScaleDictionaryCache
} from '../src/services/scaleDictionaryService';
import {
  loadChordDictionary,
  getAllChords,
  getChordPositions,
  resetChordDictionaryCache
} from '../src/services/chordDictionaryService';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  resetScaleDictionaryCache();
  resetChordDictionaryCache();
});

describe('CAL-01: resolveAppUrl & getAppBaseUrl', () => {
  it('normalizes base URLs with leading and trailing slashes', () => {
    assert.equal(getAppBaseUrl('/'), '/');
    assert.equal(getAppBaseUrl('/cancionero/'), '/cancionero/');
    assert.equal(getAppBaseUrl('/cancionero'), '/cancionero/');
    assert.equal(getAppBaseUrl('cancionero'), '/cancionero/');
    assert.equal(getAppBaseUrl(''), '/');
  });

  it('resolves relative, root-relative, data, WASM, and API paths using base URL', () => {
    assert.equal(resolveAppUrl('/data/scale-dictionary.json', '/cancionero/'), '/cancionero/data/scale-dictionary.json');
    assert.equal(resolveAppUrl('data/chord-dictionary.json', '/cancionero/'), '/cancionero/data/chord-dictionary.json');
    assert.equal(resolveAppUrl('./essentia-wasm.web.wasm', '/cancionero'), '/cancionero/essentia-wasm.web.wasm');
    assert.equal(resolveAppUrl('/api/health', '/cancionero/'), '/cancionero/api/health');
    assert.equal(resolveAppUrl('/api/analyze-audio', '/'), '/api/analyze-audio');
  });

  it('leaves external, protocol-relative, data, and blob URLs untouched', () => {
    assert.equal(resolveAppUrl('https://cdn.example.com/file.wasm', '/cancionero/'), 'https://cdn.example.com/file.wasm');
    assert.equal(resolveAppUrl('http://localhost:3000/api/health', '/cancionero/'), 'http://localhost:3000/api/health');
    assert.equal(resolveAppUrl('//cdn.example.com/a.json', '/cancionero/'), '//cdn.example.com/a.json');
    assert.equal(resolveAppUrl('data:audio/mp3;base64,AAAA', '/cancionero/'), 'data:audio/mp3;base64,AAAA');
    assert.equal(resolveAppUrl('blob:https://example.com/123', '/cancionero/'), 'blob:https://example.com/123');
  });
});

describe('CAL-01: Dictionary loading & error propagation', () => {
  it('propagates scale dictionary HTTP failure instead of caching an empty fallback and allows retry', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found'
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          scales: {
            'C-major': {
              name: 'Do Mayor',
              description: 'Escala mayor',
              intervals: [0, 2, 4, 5, 7, 9, 11],
              positions: [],
              difficulty: 'easy',
              keyNotes: 'C D E F G A B'
            }
          },
          metadata: {
            version: '1.0.0',
            lastUpdated: '2026-01-01',
            instrument: 'guitar',
            tuning: 'standard',
            strings: ['E', 'A', 'D', 'G', 'B', 'E'],
            description: 'Test',
            fretsAvailable: 24,
            categories: []
          }
        })
      } as Response;
    }) as typeof fetch;

    await assert.rejects(() => loadScaleDictionary(), /404/);
    assert.deepEqual(getAllScales(), []);

    const loaded = await loadScaleDictionary();
    assert.equal(calls, 2);
    assert.deepEqual(getAllScales(), ['C-major']);
    assert.equal(getScaleEntry('C-major')?.name, 'Do Mayor');
    assert.equal(loaded.scales['C-major'].name, 'Do Mayor');

    // Subsequent call uses cache
    await loadScaleDictionary();
    assert.equal(calls, 2);
  });

  it('rejects malformed scale dictionary payloads without caching', async () => {
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ invalid: true })
    })) as unknown as typeof fetch;

    await assert.rejects(() => loadScaleDictionary(), /formato inválido/i);
    assert.deepEqual(getAllScales(), []);
  });

  it('propagates chord dictionary HTTP failure instead of caching an empty fallback and allows retry', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          chords: {
            Am: {
              positions: [
                {
                  name: 'Abierto',
                  frets: [-1, 0, 2, 2, 1, 0],
                  baseFret: 1,
                  barre: null,
                  difficulty: 'easy',
                  description: 'Posición abierta'
                }
              ]
            }
          },
          metadata: {
            version: '1.0.0',
            lastUpdated: '2026-01-01',
            instrument: 'guitar',
            tuning: 'standard',
            description: 'Test'
          }
        })
      } as Response;
    }) as typeof fetch;

    await assert.rejects(() => loadChordDictionary(), /500/);
    assert.deepEqual(getAllChords(), []);

    const loaded = await loadChordDictionary();
    assert.equal(calls, 2);
    assert.deepEqual(getAllChords(), ['Am']);
    assert.equal(getChordPositions('Am').length, 1);
    assert.equal(loaded.chords.Am.positions[0].name, 'Abierto');

    // Subsequent call uses cache
    await loadChordDictionary();
    assert.equal(calls, 2);
  });

  it('rejects malformed chord dictionary payloads without caching', async () => {
    global.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ chords: [] })
    })) as unknown as typeof fetch;

    await assert.rejects(() => loadChordDictionary(), /formato inválido/i);
    assert.deepEqual(getAllChords(), []);
  });
});
