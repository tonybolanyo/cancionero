export interface ScaleNote {
  string: number;
  fret: number | null;
  isRoot: boolean;
}

export interface ScalePosition {
  name: string;
  rootFret: number;
  notes: ScaleNote[];
  shape: string;
  startFret: number;
  endFret: number;
  description: string;
}

export interface ScaleEntry {
  name: string;
  description: string;
  intervals: number[];
  positions: ScalePosition[];
  difficulty: 'easy' | 'medium' | 'hard';
  keyNotes: string;
}

export interface ScaleDictionary {
  scales: Record<string, ScaleEntry>;
  metadata: {
    version: string;
    lastUpdated: string;
    instrument: string;
    tuning: string;
    strings: string[];
    description: string;
    fretsAvailable: number;
    categories: string[];
  };
}

import { resolveAppUrl } from '../utils/appUrl';

let scaleDictionary: ScaleDictionary | null = null;
let loadingPromise: Promise<ScaleDictionary> | null = null;

export function resetScaleDictionaryCache(): void {
  scaleDictionary = null;
  loadingPromise = null;
}

export async function loadScaleDictionary(): Promise<ScaleDictionary> {
  if (scaleDictionary) {
    return scaleDictionary;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const response = await fetch(resolveAppUrl('data/scale-dictionary.json'));
    if (!response.ok) {
      throw new Error(
        `No se pudo cargar el diccionario de escalas (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`
      );
    }

    const data: ScaleDictionary = await response.json();
    if (!data || typeof data !== 'object' || !data.scales || typeof data.scales !== 'object' || Array.isArray(data.scales)) {
      throw new Error('El diccionario de escalas tiene un formato inválido.');
    }

    scaleDictionary = data;
    return data;
  })().finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

export function getScaleEntry(scaleId: string): ScaleEntry | null {
  if (!scaleDictionary) {
    console.warn('Scale dictionary not loaded. Call loadScaleDictionary() first.');
    return null;
  }

  return scaleDictionary.scales[scaleId] || null;
}

export function getScalePositions(scaleId: string): ScalePosition[] {
  const entry = getScaleEntry(scaleId);
  return entry?.positions || [];
}

export function getScalePosition(scaleId: string, positionIndex: number): ScalePosition | null {
  const positions = getScalePositions(scaleId);
  if (positionIndex < 0 || positionIndex >= positions.length) {
    return null;
  }
  return positions[positionIndex];
}

export function getAllScales(): string[] {
  if (!scaleDictionary) {
    return [];
  }
  return Object.keys(scaleDictionary.scales);
}

export function getScalesByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): string[] {
  if (!scaleDictionary) {
    return [];
  }
  return Object.entries(scaleDictionary.scales)
    .filter(([_, entry]) => entry.difficulty === difficulty)
    .map(([scaleId, _]) => scaleId);
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

export function getStringNames(): string[] {
  return scaleDictionary?.metadata.strings || ['E', 'A', 'D', 'G', 'B', 'E'];
}

export function getNoteAtFret(stringNumber: number, fret: number): string {
  const stringNames = getStringNames();
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  if (stringNumber < 0 || stringNumber >= stringNames.length) {
    return '?';
  }
  
  const stringNote = stringNames[stringNumber];
  const stringIndex = notes.indexOf(stringNote);
  if (stringIndex === -1) {
    return '?';
  }
  
  const noteIndex = (stringIndex + fret) % 12;
  return notes[noteIndex];
}
