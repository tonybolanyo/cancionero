import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadScaleDictionary,
  getAllScales,
  getScaleEntry,
  getScalesByDifficulty,
  getScalePositions,
  getScalePosition,
  getDifficultyLabel,
  getStringNames,
  getNoteAtFret,
  resetScaleDictionaryCache
} from '../src/services/scaleDictionaryService';

const originalFetch = global.fetch;

describe('Scale Dictionary Service', () => {
  before(() => {
    resetScaleDictionaryCache();
    global.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('scale-dictionary.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            scales: {
              'pentatonic-minor': {
                name: 'Pentatónica Menor',
                description: 'Test scale',
                intervals: [0, 3, 5, 7, 10],
                positions: [
                  {
                    name: 'Posición 1',
                    rootFret: 5,
                    notes: [{ string: 5, fret: 5, isRoot: true }],
                    shape: 'Am',
                    startFret: 5,
                    endFret: 8,
                    description: 'Caja principal'
                  }
                ],
                difficulty: 'easy',
                keyNotes: 'Test'
              }
            },
            metadata: {
              version: '1.0.0',
              lastUpdated: '2024-01-01T00:00:00Z',
              instrument: 'guitar',
              tuning: 'standard',
              strings: ['E', 'A', 'D', 'G', 'B', 'E'],
              description: 'Test dictionary',
              fretsAvailable: 24,
              categories: []
            }
          })
        } as Response;
      }
      return { ok: false, status: 404, statusText: 'Not Found' } as Response;
    }) as typeof fetch;
  });

  after(() => {
    global.fetch = originalFetch;
    resetScaleDictionaryCache();
  });

  it('should load scale dictionary', async () => {
    const dict = await loadScaleDictionary();
    assert.ok(dict);
    assert.ok(dict.scales);
    assert.ok(dict.metadata);
    assert.equal(dict.metadata.instrument, 'guitar');
  });

  it('should get all scales', async () => {
    await loadScaleDictionary();
    const scales = getAllScales();
    assert.equal(Array.isArray(scales), true);
    assert.deepEqual(scales, ['pentatonic-minor']);
  });

  it('should get scale entry by ID and positions', async () => {
    await loadScaleDictionary();
    const scale = getScaleEntry('pentatonic-minor');
    assert.ok(scale);
    assert.equal(scale.name, 'Pentatónica Menor');
    assert.deepEqual(scale.intervals, [0, 3, 5, 7, 10]);

    const positions = getScalePositions('pentatonic-minor');
    assert.equal(positions.length, 1);
    assert.equal(getScalePosition('pentatonic-minor', 0)?.name, 'Posición 1');
    assert.equal(getScalePosition('pentatonic-minor', 5), null);
    assert.equal(getScaleEntry('non-existent'), null);
  });

  it('should get scales by difficulty and labels', async () => {
    await loadScaleDictionary();
    const easyScales = getScalesByDifficulty('easy');
    assert.equal(Array.isArray(easyScales), true);
    assert.deepEqual(easyScales, ['pentatonic-minor']);
    assert.deepEqual(getScalesByDifficulty('hard'), []);
    assert.equal(getDifficultyLabel('easy'), 'Fácil');
    assert.equal(getDifficultyLabel('medium'), 'Medio');
    assert.equal(getDifficultyLabel('hard'), 'Difícil');
  });

  it('should calculate note at fret across standard strings', async () => {
    await loadScaleDictionary();
    assert.deepEqual(getStringNames(), ['E', 'A', 'D', 'G', 'B', 'E']);
    // 6th string (E), 5th fret -> A
    assert.equal(getNoteAtFret(5, 5), 'A');
    // 1st string (E), open -> E
    assert.equal(getNoteAtFret(0, 0), 'E');
    // 2nd string (A), 3rd fret -> C
    assert.equal(getNoteAtFret(1, 3), 'C');
    // Out-of-bounds string -> '?'
    assert.equal(getNoteAtFret(99, 0), '?');
  });
});
