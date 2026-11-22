import { describe, it, expect, beforeAll } from 'vitest';
import { 
  loadScaleDictionary, 
  getAllScales, 
  getScaleEntry,
  getScalesByDifficulty,
  getNoteAtFret
} from '../src/services/scaleDictionaryService';

describe('Scale Dictionary Service', () => {
  beforeAll(async () => {
    // Mock fetch for testing
    global.fetch = async (url: string) => {
      if (url.includes('scale-dictionary.json')) {
        return {
          ok: true,
          json: async () => ({
            scales: {
              "pentatonic-minor": {
                name: "Pentatónica Menor",
                description: "Test scale",
                intervals: [0, 3, 5, 7, 10],
                positions: [],
                difficulty: "easy",
                keyNotes: "Test"
              }
            },
            metadata: {
              version: "1.0.0",
              lastUpdated: "2024-01-01T00:00:00Z",
              instrument: "guitar",
              tuning: "standard",
              strings: ["E", "A", "D", "G", "B", "E"],
              description: "Test dictionary",
              fretsAvailable: 24,
              categories: []
            }
          })
        } as any;
      }
      return { ok: false } as any;
    };
  });

  it('should load scale dictionary', async () => {
    const dict = await loadScaleDictionary();
    expect(dict).toBeDefined();
    expect(dict.scales).toBeDefined();
    expect(dict.metadata).toBeDefined();
  });

  it('should get all scales', async () => {
    await loadScaleDictionary();
    const scales = getAllScales();
    expect(Array.isArray(scales)).toBe(true);
  });

  it('should get scale entry by ID', async () => {
    await loadScaleDictionary();
    const scale = getScaleEntry('pentatonic-minor');
    expect(scale).toBeDefined();
    if (scale) {
      expect(scale.name).toBe('Pentatónica Menor');
      expect(scale.intervals).toEqual([0, 3, 5, 7, 10]);
    }
  });

  it('should get scales by difficulty', async () => {
    await loadScaleDictionary();
    const easyScales = getScalesByDifficulty('easy');
    expect(Array.isArray(easyScales)).toBe(true);
  });

  it('should calculate note at fret', () => {
    // E string, 5th fret should be A
    const note = getNoteAtFret(5, 5); // 6th string, 5th fret
    expect(note).toBe('A');
  });
});
