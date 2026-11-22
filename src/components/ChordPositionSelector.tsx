import React from 'react';
import { ChartDown, ChartUp } from 'lucide-react';
import { ChordPosition, getDifficultyColor, getDifficultyLabel } from '../services/chordDictionaryService';

interface ChordPositionSelectorProps {
  positions: ChordPosition[];
  selectedPosition: number;
  onSelectPosition: (index: number) => void;
  compact?: boolean;
}

export const ChordPositionSelector: React.FC<ChordPositionSelectorProps> = ({
  positions,
  selectedPosition,
  onSelectPosition,
  compact = false
}) => {
  if (positions.length <= 1) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
      {positions.map((position, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelectPosition(index)}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all text-xs font-mono ${
            selectedPosition === index
              ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white shadow-sm'
              : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface)]'
          }`}
          title={position.description}
        >
          <span className="font-semibold">{position.name}</span>
          <span className={`text-[10px] font-normal ${selectedPosition === index ? 'text-white' : getDifficultyColor(position.difficulty)}`}>
            ({getDifficultyLabel(position.difficulty)})
          </span>
        </button>
      ))}
    </div>
  );
};

interface ChordPositionInfoProps {
  position: ChordPosition;
  compact?: boolean;
}

export const ChordPositionInfo: React.FC<ChordPositionInfoProps> = ({
  position,
  compact = false
}) => {
  const hasOpenStrings = position.frets.some(f => f === 0);
  const hasMutedStrings = position.frets.some(f => f === -1);
  const frettedStrings = position.frets.filter(f => f > 0);
  const minFret = frettedStrings.length > 0 ? Math.min(...frettedStrings) : 0;
  const maxFret = frettedStrings.length > 0 ? Math.max(...frettedStrings) : 0;
  const fretSpan = maxFret - minFret;

  return (
    <div className={`space-y-1.5 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-muted)]">Traste base:</span>
        <span className="font-mono font-bold text-[var(--accent-primary)]">
          {position.baseFret === 1 ? 'Abierto' : `Traste ${position.baseFret}`}
        </span>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-muted)]">Dificultad:</span>
        <span className={`font-semibold ${getDifficultyColor(position.difficulty)}`}>
          {getDifficultyLabel(position.difficulty)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[var(--text-muted)]">Span de trastes:</span>
        <span className="font-mono font-bold">{fretSpan} trastes</span>
      </div>

      {position.barre && (
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-muted)]">Cejilla:</span>
          <span className="font-mono font-bold text-[var(--accent-primary)]">
            Traste {position.barre}
          </span>
        </div>
      )}

      {hasOpenStrings && (
        <div className="text-[var(--text-secondary)]">
          ✓ Incluye cuerdas abiertas
        </div>
      )}

      {hasMutedStrings && (
        <div className="text-[var(--text-secondary)]">
          ✓ Incluye cuerdas silenciadas
        </div>
      )}

      <p className="text-[var(--text-secondary)] italic">{position.description}</p>
    </div>
  );
};
