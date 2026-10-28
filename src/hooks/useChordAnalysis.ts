import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ChordSegment,
  analyzeChordsDSP,
  exportChordsToJSON,
  exportChordsToCSV,
  downloadChordExport
} from '../lib/audio/chords';

export interface UseChordAnalysisReturn {
  chords: ChordSegment[] | null;
  isAnalyzingChords: boolean;
  chordError: string | null;
  analyzeChords: (audioBuffer: AudioBuffer, beats?: number[]) => Promise<ChordSegment[] | null>;
  resetChords: () => void;
  exportJSON: (songTitle?: string) => void;
  exportCSV: (songTitle?: string) => void;
}

/**
 * Hook to execute and manage temporal chromagram chord detection,
 * beat alignment, temporal smoothing, and JSON/CSV exports.
 */
export function useChordAnalysis(): UseChordAnalysisReturn {
  const [chords, setChords] = useState<ChordSegment[] | null>(null);
  const [isAnalyzingChords, setIsAnalyzingChords] = useState<boolean>(false);
  const [chordError, setChordError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resetChords = useCallback(() => {
    setChords(null);
    setIsAnalyzingChords(false);
    setChordError(null);
  }, []);

  const analyzeChords = useCallback(
    async (audioBuffer: AudioBuffer, beats?: number[]): Promise<ChordSegment[] | null> => {
      setIsAnalyzingChords(true);
      setChordError(null);

      try {
        // Run windowed chromagram chord detection with 1.5s windows and beat alignment
        const result = analyzeChordsDSP(audioBuffer, { beats });
        if (isMountedRef.current) {
          setChords(result);
          setIsAnalyzingChords(false);
        }
        return result;
      } catch (err: any) {
        if (isMountedRef.current) {
          setChordError(err.message || 'Error al analizar progresión de acordes.');
          setIsAnalyzingChords(false);
        }
        return null;
      }
    },
    []
  );

  const exportJSON = useCallback(
    (songTitle?: string) => {
      if (!chords || chords.length === 0) return;
      const jsonContent = exportChordsToJSON(chords, songTitle);
      const safeName = (songTitle || 'acordes').toLowerCase().replace(/\s+/g, '-');
      downloadChordExport(jsonContent, `${safeName}-chords.json`, 'application/json');
    },
    [chords]
  );

  const exportCSV = useCallback(
    (songTitle?: string) => {
      if (!chords || chords.length === 0) return;
      const csvContent = exportChordsToCSV(chords);
      const safeName = (songTitle || 'acordes').toLowerCase().replace(/\s+/g, '-');
      downloadChordExport(csvContent, `${safeName}-chords.csv`, 'text/csv');
    },
    [chords]
  );

  return {
    chords,
    isAnalyzingChords,
    chordError,
    analyzeChords,
    resetChords,
    exportJSON,
    exportCSV
  };
}
