import { useCallback, useState } from 'react';
import { AudioAnalysisResult } from '../utils/webAudioAnalyzer';
import { suggestScalesForKey, suggestScalesForProgression } from '../services/scaleSuggestionService';

export interface AudioToScaleData {
  key: string | null;
  detectedChords: string[];
  suggestedScales: string[];
  confidence: number;
  baseNote: string | null;
}

/**
 * Hook to connect audio analysis results with scale suggestions
 * Automatically suggests scales based on detected key and chords
 */
export function useAudioScaleConnection() {
  const [audioScaleData, setAudioScaleData] = useState<AudioToScaleData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const connectAudioToScales = useCallback(async (audioAnalysis: AudioAnalysisResult) => {
    setIsProcessing(true);
    
    try {
      // Extract key and chords from audio analysis
      const key = audioAnalysis.key || null;
      const detectedChords = audioAnalysis.chords?.map(c => c.chord) || [];
      
      let suggestedScales: string[] = [];
      let confidence = 0;

      if (key) {
        // Get scale suggestions based on detected key
        const keySuggestions = suggestScalesForKey(key);
        suggestedScales = keySuggestions.map(s => s.scaleId);
        confidence = keySuggestions.length > 0 ? keySuggestions[0].confidence : 0;
      }

      if (detectedChords.length > 0) {
        // Get scale suggestions based on chord progression
        const chordSuggestions = suggestScalesForProgression(detectedChords);
        
        // If we already had key-based suggestions, merge them
        if (suggestedScales.length > 0) {
          // Weight the suggestions: 60% key-based, 40% chord-based
          const keyScales = suggestedScales;
          const chordScales = chordSuggestions.map(s => s.scaleId);
          
          // Combine and deduplicate, keeping the best suggestions
          const combined = new Map<string, number>();
          
          keyScales.forEach(s => combined.set(s, (combined.get(s) || 0) + 0.6));
          chordScales.forEach(s => combined.set(s, (combined.get(s) || 0) + 0.4));
          
          suggestedScales = Array.from(combined.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([scale]) => scale)
            .slice(0, 5);
          
          confidence = chordSuggestions.length > 0 ? chordSuggestions[0].confidence : confidence;
        } else {
          suggestedScales = chordSuggestions.map(s => s.scaleId).slice(0, 5);
          confidence = chordSuggestions.length > 0 ? chordSuggestions[0].confidence : 0;
        }
      }

      // Extract base note from key (e.g., "Am" -> "A", "C" -> "C")
      const baseNote = key ? key.match(/^[A-G]#?/)?.[0] || null : null;

      setAudioScaleData({
        key,
        detectedChords,
        suggestedScales,
        confidence,
        baseNote
      });

    } catch (error) {
      console.error('Error connecting audio to scales:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clearAudioScaleData = useCallback(() => {
    setAudioScaleData(null);
  }, []);

  return {
    audioScaleData,
    isProcessing,
    connectAudioToScales,
    clearAudioScaleData
  };
}
