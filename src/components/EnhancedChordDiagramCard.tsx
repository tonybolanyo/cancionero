import React, { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import {
  ChordVoicing,
  FrettedVoicing,
  PianoVoicing,
  getChordVoicing
} from '../lib/music/chordDiagrams';
import { playChordPreview } from '../lib/audio/chordSynth';
import { useChordPositions } from '../hooks/useChordPositions';
import { ChordPositionSelector, ChordPositionInfo } from './ChordPositionSelector';

// Import the original FrettedDiagramSvg and PianoDiagramSvg from ChordDiagramCard
// We'll need to export those components first, so let's create local copies for now
import {
  ChordDiagramCard as OriginalChordDiagramCard,
  ChordDiagramCardProps
} from './ChordDiagramCard';

interface EnhancedChordDiagramCardProps extends ChordDiagramCardProps {
  showMultiplePositions?: boolean;
  showPositionInfo?: boolean;
}

/**
 * Enhanced Chord Diagram Card that supports multiple positions from the chord dictionary
 * Falls back to the original single-position diagram if no dictionary data is available
 */
export const EnhancedChordDiagramCard: React.FC<EnhancedChordDiagramCardProps> = ({
  chord,
  instrument,
  tuning,
  soundingChord,
  functionalLabel,
  highlighted = false,
  compact = false,
  onSelect,
  showMultiplePositions = true,
  showPositionInfo = false
}) => {
  const { positions, selectedPosition, setSelectedPosition, hasMultiplePositions } =
    useChordPositions({ chord });
  
  const [showInfo, setShowInfo] = useState(showPositionInfo);

  // If no dictionary data or only one instrument type, use original component
  if (instrument !== 'guitar' || !showMultiplePositions || !hasMultiplePositions) {
    return (
      <OriginalChordDiagramCard
        chord={chord}
        instrument={instrument}
        tuning={tuning}
        soundingChord={soundingChord}
        functionalLabel={functionalLabel}
        highlighted={highlighted}
        compact={compact}
        onSelect={onSelect}
      />
    );
  }

  const currentPosition = positions[selectedPosition];

  return (
    <div className={`flex flex-col space-y-2 ${compact ? 'gap-1' : 'gap-2'}`}>
      {/* Main chord diagram card */}
      <div
        className={`group flex flex-col items-center rounded-xl border transition-all cursor-pointer shrink-0 ${
          compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5'
        } ${
          highlighted
            ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)] shadow-sm'
            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface-subtle)]'
        }`}
        onClick={() => {
          playChordPreview(soundingChord || chord, instrument, tuning);
          onSelect?.(chord);
        }}
      >
        <div className="w-full flex items-center justify-between gap-1.5 mb-1">
          <span className="font-mono font-bold text-xs text-[var(--accent-primary)]">
            {chord}
          </span>
          <Volume2 className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
        </div>

        {functionalLabel && (
          <span className="text-[10px] font-mono text-[var(--text-muted)] mb-1">
            {functionalLabel}
          </span>
        )}

        {/* Show current position from dictionary */}
        {currentPosition && (
          <div className={`font-mono text-[9px] text-[var(--text-muted)] mb-1.5 font-semibold`}>
            {currentPosition.name}
          </div>
        )}

        {/* Use original diagram component (we'll render the SVG inline) */}
        {instrument === 'guitar' && currentPosition && (
          <svg
            viewBox="0 0 114 110"
            className={`${compact ? 'w-[84px] h-[86px]' : 'w-[108px] h-[106px]'}`}
            aria-label={`Diagrama de ${chord} - ${currentPosition.name}`}
          >
            {renderFrettedDiagram(currentPosition, 6)}
          </svg>
        )}

        {soundingChord && soundingChord !== chord && (
          <span className="mt-1 text-[10px] font-mono text-[var(--text-muted)]">
            Suena: {soundingChord}
          </span>
        )}
      </div>

      {/* Position selector */}
      <ChordPositionSelector
        positions={positions}
        selectedPosition={selectedPosition}
        onSelectPosition={setSelectedPosition}
        compact={compact}
      />

      {/* Optional position info */}
      {showInfo && currentPosition && (
        <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg p-2.5">
          <ChordPositionInfo position={currentPosition} compact={compact} />
        </div>
      )}
    </div>
  );
};

/**
 * Helper function to render a fretted diagram SVG using position data
 */
function renderFrettedDiagram(position: any, numStrings: number) {
  const numFrets = 4;
  const width = 114;
  const height = 110;
  const padLeft = 18;
  const padRight = 10;
  const padTop = 20;
  const padBottom = 16;

  const gridW = width - padLeft - padRight;
  const gridH = height - padTop - padBottom;
  const stringStep = gridW / Math.max(1, numStrings - 1);
  const fretStep = gridH / numFrets;

  const elements = [];

  // Nut or base fret label
  if (position.baseFret <= 1) {
    elements.push(
      <line
        key="nut"
        x1={padLeft}
        y1={padTop}
        x2={padLeft + gridW}
        y2={padTop}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  } else {
    elements.push(
      <text
        key="fret-label"
        x={padLeft - 6}
        y={padTop + fretStep * 0.7}
        fontSize="9"
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="end"
        fill="var(--accent-primary)"
      >
        {position.baseFret}fr
      </text>
    );
  }

  // Horizontal fret wires
  for (let f = 0; f <= numFrets; f++) {
    elements.push(
      <line
        key={`fret-${f}`}
        x1={padLeft}
        y1={padTop + f * fretStep}
        x2={padLeft + gridW}
        y2={padTop + f * fretStep}
        stroke="var(--border-medium)"
        strokeWidth={f === 0 && position.baseFret > 1 ? 1.5 : 1}
      />
    );
  }

  // Vertical strings
  for (let s = 0; s < numStrings; s++) {
    elements.push(
      <line
        key={`str-${s}`}
        x1={padLeft + s * stringStep}
        y1={padTop}
        x2={padLeft + s * stringStep}
        y2={padTop + gridH}
        stroke="var(--text-muted)"
        strokeWidth={1 + (numStrings - s) * 0.14}
        opacity={0.75}
      />
    );
  }

  // Barre indicator
  if (position.barre && position.barre >= position.baseFret) {
    const relFret = position.barre - position.baseFret + 1;
    if (relFret >= 1 && relFret <= numFrets) {
      const firstIdx = position.frets.findIndex((f: number) => f === position.barre);
      let lastIdx = -1;
      for (let i = position.frets.length - 1; i >= 0; i--) {
        if (position.frets[i] === position.barre) {
          lastIdx = i;
          break;
        }
      }
      if (firstIdx >= 0 && lastIdx > firstIdx) {
        const y = padTop + (relFret - 0.5) * fretStep;
        elements.push(
          <line
            key="barre"
            x1={padLeft + firstIdx * stringStep}
            y1={y}
            x2={padLeft + lastIdx * stringStep}
            y2={y}
            stroke="var(--accent-primary)"
            strokeWidth={7}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      }
    }
  }

  // Finger dots and O/X markers
  position.frets.forEach((fret: number, s: number) => {
    const x = padLeft + s * stringStep;
    if (fret === -1) {
      elements.push(
        <text
          key={`x-${s}`}
          x={x}
          y={padTop - 6}
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
          fill="var(--text-muted)"
        >
          ×
        </text>
      );
    } else if (fret === 0) {
      elements.push(
        <circle
          key={`o-${s}`}
          cx={x}
          cy={padTop - 9}
          r={3.2}
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth={1.3}
        />
      );
    } else {
      const relFret = fret - position.baseFret + 1;
      if (relFret >= 1 && relFret <= numFrets) {
        const y = padTop + (relFret - 0.5) * fretStep;
        elements.push(
          <circle
            key={`dot-${s}`}
            cx={x}
            cy={y}
            r={4.6}
            fill="var(--accent-primary)"
          />
        );
      }
    }
  });

  // String tuning labels (placeholder - would need string names)
  const stringNames = ['E', 'A', 'D', 'G', 'B', 'e'];
  stringNames.slice(0, numStrings).forEach((name, s) => {
    elements.push(
      <text
        key={`lbl-${s}`}
        x={padLeft + s * stringStep}
        y={height - 3}
        fontSize="7.5"
        fontFamily="monospace"
        textAnchor="middle"
        fill="var(--text-muted)"
      >
        {name}
      </text>
    );
  });

  return elements;
}
