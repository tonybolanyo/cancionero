import React from 'react';
import { Check } from 'lucide-react';

export interface BeatTimelineLayersMenuProps {
  sectionsCount: number;
  chordsCount: number;
  showSections: boolean;
  onToggleSections: () => void;
  showChords: boolean;
  onToggleChords: () => void;
  showBeats: boolean;
  onToggleBeats: () => void;
  showOnsets: boolean;
  onToggleOnsets: () => void;
  isTallWaveform: boolean;
  onToggleTallWaveform: () => void;
  onClose: () => void;
}

export const BeatTimelineLayersMenu: React.FC<BeatTimelineLayersMenuProps> = ({
  sectionsCount,
  chordsCount,
  showSections,
  onToggleSections,
  showChords,
  onToggleChords,
  showBeats,
  onToggleBeats,
  showOnsets,
  onToggleOnsets,
  isTallWaveform,
  onToggleTallWaveform,
  onClose
}) => {
  return (
    <>
      {/* Desktop Popover */}
      <div className="hidden sm:block absolute right-0 mt-1.5 w-52 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-medium)] shadow-lg py-1.5 z-30 text-xs">
        {sectionsCount > 0 && (
          <button
            type="button"
            onClick={onToggleSections}
            className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
          >
            <span>Estructura ({sectionsCount})</span>
            {showSections && <Check className="w-3.5 h-3.5 text-sky-500" />}
          </button>
        )}
        {chordsCount > 0 && (
          <button
            type="button"
            onClick={onToggleChords}
            className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
          >
            <span>Acordes ({chordsCount})</span>
            {showChords && <Check className="w-3.5 h-3.5 text-purple-500" />}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleBeats}
          className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
        >
          <span>Rejilla de pulsos</span>
          {showBeats && <Check className="w-3.5 h-3.5 text-emerald-500" />}
        </button>
        <button
          type="button"
          onClick={onToggleOnsets}
          className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
        >
          <span>Ataques (Onsets)</span>
          {showOnsets && <Check className="w-3.5 h-3.5 text-cyan-500" />}
        </button>
        <div className="my-1 border-t border-[var(--border-subtle)]" />
        <button
          type="button"
          onClick={onToggleTallWaveform}
          className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
        >
          <span>Onda expandida</span>
          {isTallWaveform && <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
        </button>
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className="sm:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Capas de la línea de tiempo"
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-t-3xl bg-[var(--bg-modal)] border-t border-[var(--border-medium)] shadow-2xl px-4 pt-2.5 pb-6 space-y-2"
        >
          <div className="w-10 h-1.5 rounded-full bg-[var(--border-strong)] mx-auto mb-2" />
          <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
            <span className="font-serif font-bold text-sm text-[var(--text-primary)]">
              Capas visibles
            </span>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] px-2.5 text-xs font-semibold text-[var(--accent-primary)] cursor-pointer"
            >
              Listo
            </button>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] text-sm">
            {sectionsCount > 0 && (
              <button
                type="button"
                onClick={onToggleSections}
                className="w-full min-h-[48px] px-1 flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
              >
                <span>Estructura ({sectionsCount})</span>
                {showSections && <Check className="w-4 h-4 text-sky-500" />}
              </button>
            )}
            {chordsCount > 0 && (
              <button
                type="button"
                onClick={onToggleChords}
                className="w-full min-h-[48px] px-1 flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
              >
                <span>Acordes ({chordsCount})</span>
                {showChords && <Check className="w-4 h-4 text-purple-500" />}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleBeats}
              className="w-full min-h-[48px] px-1 flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
            >
              <span>Rejilla de pulsos</span>
              {showBeats && <Check className="w-4 h-4 text-emerald-500" />}
            </button>
            <button
              type="button"
              onClick={onToggleOnsets}
              className="w-full min-h-[48px] px-1 flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
            >
              <span>Ataques (Onsets)</span>
              {showOnsets && <Check className="w-4 h-4 text-cyan-500" />}
            </button>
            <button
              type="button"
              onClick={onToggleTallWaveform}
              className="w-full min-h-[48px] px-1 flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
            >
              <span>Onda expandida</span>
              {isTallWaveform && <Check className="w-4 h-4 text-[var(--accent-primary)]" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
