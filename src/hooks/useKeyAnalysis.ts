import { useState, useCallback, useRef, useEffect } from 'react';
import { KeyAnalysis, analyzeKeyWithEssentia } from '../lib/audio/keyAnalysis';

export interface UseKeyAnalysisReturn {
  keyAnalysis: KeyAnalysis | null;
  isAnalyzingKey: boolean;
  keyError: string | null;
  analyzeKey: (audioBuffer: AudioBuffer) => Promise<KeyAnalysis | null>;
  resetKeyAnalysis: () => void;
}

/**
 * Hook to execute and manage musical key, scale, and chromagram detection
 * powered by Essentia.js WASM running in a Web Worker.
 */
export function useKeyAnalysis(): UseKeyAnalysisReturn {
  const [keyAnalysis, setKeyAnalysis] = useState<KeyAnalysis | null>(null);
  const [isAnalyzingKey, setIsAnalyzingKey] = useState<boolean>(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resetKeyAnalysis = useCallback(() => {
    setKeyAnalysis(null);
    setIsAnalyzingKey(false);
    setKeyError(null);
  }, []);

  const analyzeKey = useCallback(async (audioBuffer: AudioBuffer): Promise<KeyAnalysis | null> => {
    setIsAnalyzingKey(true);
    setKeyError(null);

    try {
      const result = await analyzeKeyWithEssentia(audioBuffer);
      if (isMountedRef.current) {
        setKeyAnalysis(result);
        setIsAnalyzingKey(false);
      }
      return result;
    } catch (err: any) {
      if (isMountedRef.current) {
        setKeyError(err.message || 'Error al analizar tonalidad y escala con Essentia.');
        setIsAnalyzingKey(false);
      }
      return null;
    }
  }, []);

  return {
    keyAnalysis,
    isAnalyzingKey,
    keyError,
    analyzeKey,
    resetKeyAnalysis
  };
}
