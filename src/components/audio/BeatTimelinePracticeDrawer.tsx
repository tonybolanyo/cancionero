import React from 'react';
import type { AudioEqMode } from '../../lib/audio/pitchShiftPlayer';

export interface BeatTimelinePracticeDrawerProps {
  pitchShiftSemitones: number;
  onPitchShiftChange?: (semitones: number) => void;
  preserveTempo?: boolean;
  onTogglePreserveTempo?: () => void;
  playbackRate: number;
  onPlaybackRateChange?: (rate: number) => void;
  eqMode: AudioEqMode;
  onEqModeChange?: (mode: AudioEqMode) => void;
}

export const BeatTimelinePracticeDrawer: React.FC<BeatTimelinePracticeDrawerProps> = ({
  pitchShiftSemitones,
  onPitchShiftChange,
  preserveTempo = true,
  onTogglePreserveTempo,
  playbackRate,
  onPlaybackRateChange,
  eqMode,
  onEqModeChange
}) => {
  return (
    <div className="px-3.5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
      {/* Pitch Shifting */}
      {onPitchShiftChange && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)]">Tono (Semitonos)</span>
            {onTogglePreserveTempo && (
              <button
                type="button"
                onClick={onTogglePreserveTempo}
                className={`text-[11px] font-mono font-semibold cursor-pointer ${
                  preserveTempo ? 'text-purple-600 dark:text-purple-300' : 'text-[var(--text-muted)]'
                }`}
              >
                {preserveTempo ? 'Tempo fijo' : 'Varipitch'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg p-1 font-mono">
            <button
              type="button"
              onClick={() => onPitchShiftChange(pitchShiftSemitones - 1)}
              className="min-h-[40px] sm:min-h-[32px] rounded-md font-semibold hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] cursor-pointer"
            >
              -1 st
            </button>
            <button
              type="button"
              onClick={() => onPitchShiftChange(0)}
              className={`min-h-[40px] sm:min-h-[32px] rounded-md font-bold cursor-pointer ${
                pitchShiftSemitones !== 0
                  ? 'bg-purple-600 text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Restablecer a 0"
            >
              {pitchShiftSemitones > 0 ? `+${pitchShiftSemitones}` : pitchShiftSemitones} st
            </button>
            <button
              type="button"
              onClick={() => onPitchShiftChange(pitchShiftSemitones + 1)}
              className="min-h-[40px] sm:min-h-[32px] rounded-md font-semibold hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] cursor-pointer"
            >
              +1 st
            </button>
          </div>
        </div>
      )}

      {/* Playback Speed */}
      {onPlaybackRateChange && (
        <div className="space-y-1.5">
          <span className="font-semibold text-[var(--text-secondary)] block">Velocidad</span>
          <div className="grid grid-cols-4 gap-1 bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg p-1 font-mono">
            {[0.75, 0.85, 1.0, 1.15].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onPlaybackRateChange(rate)}
                className={`min-h-[40px] sm:min-h-[32px] rounded-md font-semibold cursor-pointer transition-colors ${
                  Math.abs(playbackRate - rate) < 0.02
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* EQ / Instrument Isolation */}
      {onEqModeChange && (
        <div className="space-y-1.5">
          <span className="font-semibold text-[var(--text-secondary)] block">Filtro de mezcla</span>
          <div className="grid grid-cols-4 gap-1 bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg p-1 font-mono">
            {([
              { id: 'normal', label: 'Normal' },
              { id: 'vocal_cut', label: 'Sin voz' },
              { id: 'bass_isolate', label: 'Bajo' },
              { id: 'guitar_focus', label: 'Guitarra' }
            ] as const).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onEqModeChange(opt.id)}
                className={`min-h-[40px] sm:min-h-[32px] rounded-md font-semibold cursor-pointer transition-colors truncate px-1 ${
                  eqMode === opt.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
