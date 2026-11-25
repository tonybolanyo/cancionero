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

import { resolveAppUrl } from '../utils/appUrl';

let chordDictionary: ChordDictionary | null = null;
let loadingPromise: Promise<ChordDictionary> | null = null;

export function resetChordDictionaryCache(): void {
  chordDictionary = null;
  loadingPromise = null;
}

export async function loadChordDictionary(): Promise<ChordDictionary> {
  if (chordDictionary) {
    return chordDictionary;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const response = await fetch(resolveAppUrl('data/chord-dictionary.json'));
    if (!response.ok) {
      throw new Error(
        `No se pudo cargar el diccionario de acordes (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`
      );
    }

    const data: ChordDictionary = await response.json();
    if (!data || typeof data !== 'object' || !data.chords || typeof data.chords !== 'object' || Array.isArray(data.chords)) {
      throw new Error('El diccionario de acordes tiene un formato inválido.');
    }

    chordDictionary = data;
    return data;
  })().finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
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
