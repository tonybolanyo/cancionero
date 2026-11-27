import React from 'react';
import { ScalePosition } from '../services/scaleDictionaryService';

interface ScaleFretboardProps {
  position: ScalePosition;
  scaleId: string;
  rootNote?: string;
  showFretNumbers?: boolean;
}

export const ScaleFretboard: React.FC<ScaleFretboardProps> = ({
  position,
  scaleId,
  rootNote = 'C',
  showFretNumbers = true
}) => {
  const strings = 6;
  const fretWidth = 50;
  const fretHeight = 60;
  const stringSpacing = fretHeight;
  const totalWidth = (position.endFret - position.startFret + 1) * fretWidth + 60;
  const totalHeight = strings * stringSpacing + 40;

  const getNoteCircleColor = (string: number, fret: number | null): string => {
    if (fret === null) return 'transparent';
    
    const note = position.notes.find(n => n.string === string && n.fret === fret);
    if (!note) return 'transparent';
    
    return note.isRoot ? '#ef4444' : '#3b82f6';
  };

  const getNoteCircleText = (string: number, fret: number | null): string => {
    if (fret === null) return '';
    
    const note = position.notes.find(n => n.string === string && n.fret === fret);
    if (!note) return '';
    
    // Calcular la nota
    const stringNames = ['E', 'A', 'D', 'G', 'B', 'E'];
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const stringNote = stringNames[string];
    const stringIndex = notes.indexOf(stringNote);
    const noteIndex = (stringIndex + fret) % 12;
    const noteName = notes[noteIndex];
    
    return note.isRoot ? 'R' : noteName;
  };

  return (
    <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-medium)] rounded-xl p-4 overflow-x-auto">
      <svg width={totalWidth} height={totalHeight} className="mx-auto">
        {/* Frets */}
        {Array.from({ length: position.endFret - position.startFret + 2 }).map((_, i) => {
          const fretNum = position.startFret + i;
          const x = i * fretWidth + 60;
          
          return (
            <g key={`fret-${fretNum}`}>
              {/* Fret line */}
              <line
                x1={x}
                y1={20}
                x2={x}
                y2={20 + strings * stringSpacing}
                stroke={fretNum === 0 ? 'var(--text-primary)' : 'var(--border-strong)'}
                strokeWidth={fretNum === 0 ? 3 : 1}
              />
              
              {/* Fret number */}
              {showFretNumbers && fretNum > 0 && (
                <text
                  x={x}
                  y={15}
                  textAnchor="middle"
                  className="text-xs font-bold text-[var(--text-secondary)]"
                  fill="currentColor"
                >
                  {fretNum}
                </text>
              )}
            </g>
          );
        })}

        {/* Strings */}
        {Array.from({ length: strings }).map((_, stringIdx) => {
          const y = 20 + stringIdx * stringSpacing + stringSpacing / 2;
          
          return (
            <g key={`string-${stringIdx}`}>
              {/* String line */}
              <line
                x1={60}
                y1={y}
                x2={totalWidth - 20}
                y2={y}
                stroke="var(--border-strong)"
                strokeWidth={stringIdx === 0 || stringIdx === 5 ? 2 : 1}
              />
              
              {/* String label */}
              <text
                x={25}
                y={y}
                textAnchor="middle"
                dy="0.3em"
                className="text-xs font-bold text-[var(--text-secondary)]"
                fill="currentColor"
              >
                {['E', 'A', 'D', 'G', 'B', 'E'][stringIdx]}
              </text>
            </g>
          );
        })}

        {/* Notes */}
        {Array.from({ length: strings }).map((_, stringIdx) => {
          return Array.from({ length: position.endFret - position.startFret + 1 }).map((_, fretIdx) => {
            const fret = position.startFret + fretIdx;
            const note = position.notes.find(n => n.string === stringIdx && n.fret === fret);
            
            if (!note) return null;
            
            const x = fretIdx * fretWidth + 60 + fretWidth / 2;
            const y = 20 + stringIdx * stringSpacing + stringSpacing / 2;
            const circleRadius = 15;
            const isRoot = note.isRoot;
            
            return (
              <g key={`note-${stringIdx}-${fret}`}>
                {/* Circle background */}
                <circle
                  cx={x}
                  cy={y}
                  r={circleRadius}
                  fill={isRoot ? 'var(--accent-primary)' : 'var(--text-primary)'}
                  opacity="0.92"
                />
                
                {/* Circle border */}
                <circle
                  cx={x}
                  cy={y}
                  r={circleRadius}
                  fill="none"
                  stroke={isRoot ? 'var(--accent-active)' : 'var(--border-strong)'}
                  strokeWidth="2"
                />
                
                {/* Text */}
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dy="0.3em"
                  className="text-xs font-bold select-none"
                  fill={isRoot ? 'var(--accent-text)' : 'var(--text-inverse)'}
                  pointerEvents="none"
                >
                  {getNoteCircleText(stringIdx, fret)}
                </text>
              </g>
            );
          });
        })}
      </svg>
      
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[var(--accent-primary)]"></div>
          <span className="text-[var(--text-secondary)]">Raíz (Root)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[var(--text-primary)]"></div>
          <span className="text-[var(--text-secondary)]">Notas de la escala</span>
        </div>
      </div>
    </div>
  );
};
