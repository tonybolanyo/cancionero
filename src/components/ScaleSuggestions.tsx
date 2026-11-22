import React, { useMemo } from 'react';
import { Lightbulb, Zap, TrendingUp } from 'lucide-react';
import { ScaleSuggestion, suggestScalesForKey, suggestScalesForProgression, suggestScalesForChord } from '../services/scaleSuggestionService';

interface ScaleSuggestionsProps {
  sourceType: 'key' | 'progression' | 'chord';
  sourceValue: string | string[];
  onSelectScale?: (scaleId: string) => void;
  maxSuggestions?: number;
}

export const ScaleSuggestions: React.FC<ScaleSuggestionsProps> = ({
  sourceType,
  sourceValue,
  onSelectScale,
  maxSuggestions = 5
}) => {
  const suggestions = useMemo(() => {
    let results: ScaleSuggestion[] = [];
    
    if (sourceType === 'key' && typeof sourceValue === 'string') {
      results = suggestScalesForKey(sourceValue);
    } else if (sourceType === 'progression' && Array.isArray(sourceValue)) {
      results = suggestScalesForProgression(sourceValue);
    } else if (sourceType === 'chord' && typeof sourceValue === 'string') {
      results = suggestScalesForChord(sourceValue);
    }
    
    return results.slice(0, maxSuggestions);
  }, [sourceType, sourceValue, maxSuggestions]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Escalas Sugeridas
        </h3>
      </div>

      <p className="text-sm text-[var(--text-secondary)] mb-4">
        {sourceType === 'key' && `Para la tonalidad de ${sourceValue}`}
        {sourceType === 'progression' && `Para la progresión: ${Array.isArray(sourceValue) ? sourceValue.join(' - ') : sourceValue}`}
        {sourceType === 'chord' && `Para el acorde ${sourceValue}`}
      </p>

      <div className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
              suggestion.compatibility === 'perfect'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                : suggestion.compatibility === 'good'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
            }`}
            onClick={() => onSelectScale?.(suggestion.scaleId)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-semibold text-[var(--text-primary)]">
                  {suggestion.scaleName}
                </h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  {suggestion.reason}
                </p>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-bold text-sm">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                  <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-opacity-20 bg-current">
                    {suggestion.compatibility === 'perfect' && '⭐ Perfecta'}
                    {suggestion.compatibility === 'good' && '✓ Buena'}
                    {suggestion.compatibility === 'fair' && '~ Regular'}
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  suggestion.compatibility === 'perfect'
                    ? 'bg-green-500'
                    : suggestion.compatibility === 'good'
                    ? 'bg-blue-500'
                    : 'bg-yellow-500'
                }`}
                style={{ width: `${suggestion.confidence * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/40 rounded border border-blue-300 dark:border-blue-700">
        <p className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
          <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Haz clic en una escala para verla en el diapasón
        </p>
      </div>
    </div>
  );
};
