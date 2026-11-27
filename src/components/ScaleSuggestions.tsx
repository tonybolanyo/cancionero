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
    <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-[var(--accent-primary)]" />
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
          <button
            key={index}
            type="button"
            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md ${
              suggestion.compatibility === 'perfect'
                ? 'bg-[var(--state-success-bg)]/40 border-[var(--state-success-border)]'
                : suggestion.compatibility === 'good'
                ? 'bg-[var(--state-info-bg)]/40 border-[var(--state-info-border)]'
                : 'bg-[var(--state-warning-bg)]/40 border-[var(--state-warning-border)]'
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
                  <div className="flex items-center gap-1 justify-end mb-1 text-[var(--text-primary)]">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-bold text-sm">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${
                    suggestion.compatibility === 'perfect'
                      ? 'bg-[var(--state-success-bg)] text-[var(--state-success-text)] border-[var(--state-success-border)]'
                      : suggestion.compatibility === 'good'
                      ? 'bg-[var(--state-info-bg)] text-[var(--state-info-text)] border-[var(--state-info-border)]'
                      : 'bg-[var(--state-warning-bg)] text-[var(--state-warning-text)] border-[var(--state-warning-border)]'
                  }`}>
                    {suggestion.compatibility === 'perfect' && '⭐ Perfecta'}
                    {suggestion.compatibility === 'good' && '✓ Buena'}
                    {suggestion.compatibility === 'fair' && '~ Regular'}
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="w-full bg-[var(--bg-surface-muted)] rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${
                  suggestion.compatibility === 'perfect'
                    ? 'bg-[var(--state-success-border)]'
                    : suggestion.compatibility === 'good'
                    ? 'bg-[var(--state-info-border)]'
                    : 'bg-[var(--state-warning-border)]'
                }`}
                style={{ width: `${suggestion.confidence * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 p-3 bg-[var(--state-info-bg)] rounded-lg border border-[var(--state-info-border)]">
        <p className="text-xs text-[var(--state-info-text)] flex items-start gap-2">
          <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Haz clic en una escala para verla en el diapasón
        </p>
      </div>
    </div>
  );
};
