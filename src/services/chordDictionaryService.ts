export interface ChordPosition {
  name: string;
  frets: number[];
  baseFret: number;
  barre: number | null;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
}

export interface ChordEntry {
  positions: ChordPosition[];
}

export interface ChordDictionary {
  chords: Record<string, ChordEntry>;
  metadata: {
    version: string;
    lastUpdated: string;
    instrument: string;
    tuning: string;
    description: string;
  };
}

let chordDictionary: ChordDictionary | null = null;

export async function loadChordDictionary(): Promise<ChordDictionary> {
  if (chordDictionary) {
    return chordDictionary;
  }

  try {
    const response = await fetch('/data/chord-dictionary.json');
    if (!response.ok) {
      throw new Error(`Failed to load chord dictionary: ${response.statusText}`);
    }
    chordDictionary = await response.json();
    return chordDictionary;
  } catch (error) {
    console.error('Error loading chord dictionary:', error);
    // Return empty dictionary as fallback
    return {
      chords: {},
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        instrument: 'guitar',
        tuning: 'standard',
        description: 'Chord dictionary (fallback - empty)'
      }
    };
  }
}

export function getChordPositions(chordName: string): ChordPosition[] {
  if (!chordDictionary) {
    console.warn('Chord dictionary not loaded. Call loadChordDictionary() first.');
    return [];
  }

  const entry = chordDictionary.chords[chordName];
  if (!entry) {
    return [];
  }

  return entry.positions;
}

export function getChordPosition(chordName: string, positionIndex: number): ChordPosition | null {
  const positions = getChordPositions(chordName);
  if (positionIndex < 0 || positionIndex >= positions.length) {
    return null;
  }
  return positions[positionIndex];
}

export function hasMultiplePositions(chordName: string): boolean {
  const positions = getChordPositions(chordName);
  return positions.length > 1;
}

export function getAllChords(): string[] {
  if (!chordDictionary) {
    return [];
  }
  return Object.keys(chordDictionary.chords);
}

export function getDifficultyColor(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy':
      return 'text-green-500';
    case 'medium':
      return 'text-yellow-500';
    case 'hard':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

export function getDifficultyLabel(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy':
      return 'Fácil';
    case 'medium':
      return 'Medio';
    case 'hard':
      return 'Difícil';
    default:
      return 'Desconocido';
  }
}
