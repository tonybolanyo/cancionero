import { useEffect, useState } from 'react';
import { ChordPosition, loadChordDictionary, getChordPositions } from '../services/chordDictionaryService';

export interface UseChordPositionsOptions {
  chord: string;
}

export interface UseChordPositionsResult {
  positions: ChordPosition[];
  selectedPosition: number;
  setSelectedPosition: (index: number) => void;
  isLoading: boolean;
  error: string | null;
  hasMultiplePositions: boolean;
}

export function useChordPositions({ chord }: UseChordPositionsOptions): UseChordPositionsResult {
  const [positions, setPositions] = useState<ChordPosition[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPositions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await loadChordDictionary();
        const chordPositions = getChordPositions(chord);
        setPositions(chordPositions);
        setSelectedPosition(0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error loading chord positions';
        setError(message);
        setPositions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPositions();
  }, [chord]);

  return {
    positions,
    selectedPosition,
    setSelectedPosition,
    isLoading,
    error,
    hasMultiplePositions: positions.length > 1
  };
}
