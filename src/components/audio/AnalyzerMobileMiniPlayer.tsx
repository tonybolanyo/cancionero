import React from 'react';
import { ArrowRight, Pause, Play, Repeat } from 'lucide-react';
import { ChordSegment } from '../../lib/audio/chords';
import { MusicalSection } from '../../lib/audio/structure';
import { AccidentalPreference, respellChord } from '../../utils/markdownParser';
import { formatAnalyzerClock } from '../../hooks/useAudioAnalyzerWorkflow';

export interface AnalyzerMobileMiniPlayerProps {
  isPlaying: boolean;
  onTogglePlayback: () => void;
  activeChordNow?: ChordSegment;
  nextChordNow?: ChordSegment;
  activeSectionNow?: MusicalSection;
  accidentalPreference: AccidentalPreference;
  currentTime: number;
  duration: number;
  hasBufferLoopControls: boolean;
  loopStart: number | null;
  loopEnd: number | null;
  onSetLoopA: () => void;
  onSetLoopB: () => void;
  onClearLoop: () => void;
}

export const AnalyzerMobileMiniPlayer: React.FC<AnalyzerMobileMiniPlayerProps> = ({
  isPlaying,
  onTogglePlayback,
  activeChordNow,
  nextChordNow,
  activeSectionNow,
  accidentalPreference,
  currentTime,
  duration,
  hasBufferLoopControls,
  loopStart,
  loopEnd,
  onSetLoopA,
  onSetLoopB,
  onClearLoop
}) => {
  return (
    <div
      role="region"
      aria-label="Controles rápidos de reproducción"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-header)] backdrop-blur-md border-t border-[var(--border-medium)] shadow-lg px-3 py-1.5 flex items-center justify-between gap-2"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          onClick={onTogglePlayback}
          aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-sm font-bold text-purple-600 dark:text-purple-300 tabular-nums shrink-0">
              {activeChordNow
                ? respellChord(activeChordNow.chord, accidentalPreference)
                : '—'}
            </span>
            {nextChordNow && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold text-[var(--text-muted)] tabular-nums shrink-0">
                <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
                <span>{respellChord(nextChordNow.chord, accidentalPreference)}</span>
              </span>
            )}
            {activeSectionNow && (
              <>
                <span className="text-[var(--text-muted)] shrink-0" aria-hidden="true">·</span>
                <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
                  {activeSectionNow.label}
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] leading-tight">
            <span className="text-[var(--text-primary)] font-semibold">{formatAnalyzerClock(currentTime)}</span>
            {duration > 0 && <span> / {formatAnalyzerClock(duration)}</span>}
          </div>
        </div>
      </div>

      {hasBufferLoopControls && (
        <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-0.5 shrink-0 font-mono text-xs">
          <span className="px-1.5 text-[var(--text-muted)] flex items-center" aria-hidden="true">
            <Repeat className="w-3.5 h-3.5 text-emerald-500" />
          </span>
          <button
            type="button"
            onClick={onSetLoopA}
            aria-label="Marcar punto A de bucle"
            className={`min-h-[44px] min-w-[40px] px-2 rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              loopStart !== null
                ? 'bg-emerald-600 text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)]'
            }`}
          >
            A
          </button>
          <button
            type="button"
            onClick={onSetLoopB}
            aria-label="Marcar punto B de bucle"
            className={`min-h-[44px] min-w-[40px] px-2 rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              loopEnd !== null
                ? 'bg-emerald-600 text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)]'
            }`}
          >
            B
          </button>
          {(loopStart !== null || loopEnd !== null) && (
            <button
              type="button"
              onClick={onClearLoop}
              aria-label="Quitar bucle A-B"
              className="min-h-[44px] min-w-[36px] px-1.5 rounded-lg font-bold text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
};
