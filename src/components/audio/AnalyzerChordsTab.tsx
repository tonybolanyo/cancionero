import React from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { ChordSegment } from '../../lib/audio/chords';
import { MusicalSection } from '../../lib/audio/structure';
import { KeyAnalysis } from '../../lib/audio/keyAnalysis';
import { AccidentalPreference, respellChord } from '../../utils/markdownParser';
import {
  CHROMATIC_NOTES_FLATS,
  CHROMATIC_NOTES_SHARPS,
  formatAnalyzerClock
} from '../../hooks/useAudioAnalyzerWorkflow';

export interface GroupedChordSection {
  id: string;
  label: string | null;
  startTime: number;
  endTime: number;
  items: Array<{ chord: ChordSegment; globalIdx: number }>;
}

export interface AnalyzerChordsTabProps {
  effectiveSections: MusicalSection[];
  effectiveChords: ChordSegment[];
  groupedChordSections: GroupedChordSection[];
  currentTime: number;
  activeChordIndex: number;
  followActiveChord: boolean;
  onToggleFollowActiveChord: () => void;
  accidentalPreference: AccidentalPreference;
  onToggleAccidentalPreference: () => void;
  onSeek: (time: number) => void;
  chordButtonRefs: React.MutableRefObject<Map<number, HTMLButtonElement>>;
  isAnalyzingKey: boolean;
  musicalNotes?: string;
  keyAnalysis: KeyAnalysis | null;
  showChromaChart: boolean;
  onToggleChromaChart: () => void;
}

export const AnalyzerChordsTab: React.FC<AnalyzerChordsTabProps> = ({
  effectiveSections,
  effectiveChords,
  groupedChordSections,
  currentTime,
  activeChordIndex,
  followActiveChord,
  onToggleFollowActiveChord,
  accidentalPreference,
  onToggleAccidentalPreference,
  onSeek,
  chordButtonRefs,
  isAnalyzingKey,
  musicalNotes,
  keyAnalysis,
  showChromaChart,
  onToggleChromaChart
}) => {
  return (
    <div className="space-y-4">
      {/* Musical Sections */}
      {effectiveSections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              Estructura de la canción
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
              {effectiveSections.length} partes · Pulsa para saltar
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {effectiveSections.map((sec) => {
              const isActive = currentTime >= sec.startTime && currentTime < sec.endTime;
              const badgeTone =
                sec.type === 'Intro'
                  ? 'border-indigo-400/50 text-indigo-600 dark:text-indigo-300'
                  : sec.type === 'Estribillo'
                  ? 'border-amber-400/60 text-amber-600 dark:text-amber-300'
                  : sec.type === 'Puente'
                  ? 'border-pink-400/60 text-pink-600 dark:text-pink-300'
                  : sec.type === 'Instrumental' || sec.type === 'Outro'
                  ? 'border-slate-400/60 text-slate-600 dark:text-slate-300'
                  : 'border-teal-400/50 text-teal-600 dark:text-teal-300';

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onSeek(sec.startTime)}
                  className={`min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-2 border whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-600 text-white border-teal-500'
                      : `bg-[var(--bg-surface-subtle)] ${badgeTone} hover:bg-[var(--bg-surface)]`
                  }`}
                >
                  <span className="text-[10px] opacity-75 tabular-nums">
                    {formatAnalyzerClock(sec.startTime)}
                  </span>
                  <span>{sec.label}</span>
                  {sec.isVocal === false && (
                    <span className="text-[10px] opacity-75 font-normal">Inst.</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unified Chords Sequence */}
      {effectiveChords.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-semibold text-xs text-[var(--text-primary)]">
              Secuencia de acordes ({effectiveChords.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleFollowActiveChord}
                aria-pressed={followActiveChord}
                className={`min-h-[40px] sm:min-h-[28px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  followActiveChord
                    ? 'bg-purple-600/15 border-purple-500/40 text-purple-700 dark:text-purple-300'
                    : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Desplazar automáticamente al acorde que suena"
              >
                {followActiveChord ? 'Seguir: Sí' : 'Seguir: No'}
              </button>
              <button
                type="button"
                onClick={onToggleAccidentalPreference}
                className="min-h-[40px] sm:min-h-[28px] px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer whitespace-nowrap"
              >
                {accidentalPreference === 'flats' ? '♭ Bemoles' : '♯ Sostenidos'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {groupedChordSections.map((group) => {
              const isSectionActive =
                group.label !== null &&
                currentTime >= group.startTime &&
                currentTime < group.endTime;

              return (
                <div key={group.id} className="space-y-1.5">
                  {group.label && (
                    <button
                      type="button"
                      onClick={() => onSeek(group.startTime)}
                      className={`inline-flex items-center gap-2 text-[11px] font-semibold cursor-pointer transition-colors ${
                        isSectionActive
                          ? 'text-teal-600 dark:text-teal-300'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span>{group.label}</span>
                      <span className="font-mono tabular-nums opacity-75">
                        {formatAnalyzerClock(group.startTime)}
                      </span>
                    </button>
                  )}

                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                    {group.items.map(({ chord: chordSeg, globalIdx }) => {
                      const isActive = activeChordIndex === globalIdx;
                      const displayedChord = respellChord(chordSeg.chord, accidentalPreference);
                      return (
                        <button
                          key={globalIdx}
                          ref={(el) => {
                            if (el) chordButtonRefs.current.set(globalIdx, el);
                            else chordButtonRefs.current.delete(globalIdx);
                          }}
                          type="button"
                          onClick={() => onSeek(chordSeg.startTime)}
                          className={`min-h-[44px] sm:min-h-[38px] px-2 py-1.5 rounded-lg font-mono transition-colors cursor-pointer flex flex-col items-center justify-center border ${
                            isActive
                              ? 'bg-purple-600 text-white border-purple-500'
                              : 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-purple-400/60'
                          }`}
                          title={`Saltar a ${displayedChord} (${chordSeg.startTime.toFixed(1)}s)`}
                        >
                          <strong className="text-xs sm:text-sm leading-tight">{displayedChord}</strong>
                          <span className="text-[10px] opacity-70 tabular-nums">
                            {formatAnalyzerClock(chordSeg.startTime)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-[var(--text-muted)]">
          {isAnalyzingKey
            ? 'Detectando progresión armónica…'
            : 'No hay segmentos de acordes detectados todavía.'}
        </div>
      )}

      {musicalNotes && (
        <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
          {musicalNotes}
        </div>
      )}

      {/* Optional Collapsible Chromagram */}
      {keyAnalysis?.chroma && keyAnalysis.chroma.length === 12 && (
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onToggleChromaChart}
            className="flex items-center justify-between w-full text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer py-1"
          >
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Perfil armónico por nota (12 tonos)</span>
            </span>
            {showChromaChart ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showChromaChart && (
            <div className="grid grid-cols-12 gap-1 mt-2 items-end h-20 bg-[var(--bg-surface-subtle)] p-2 rounded-lg border border-[var(--border-subtle)]">
              {(accidentalPreference === 'flats' ? CHROMATIC_NOTES_FLATS : CHROMATIC_NOTES_SHARPS).map((note, idx) => {
                const value = keyAnalysis.chroma[idx] ?? 0;
                const heightPercent = Math.max(6, Math.round(value * 100));
                const rootPitch = respellChord(keyAnalysis.key.replace(/m$/, ''), accidentalPreference);
                const isRoot = note === rootPitch;

                return (
                  <div key={note} className="flex flex-col items-center justify-end h-full" title={`${note}: ${(value * 100).toFixed(1)}%`}>
                    <div className="w-full flex items-end justify-center h-12">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[14px] rounded-t ${
                          isRoot ? 'bg-[var(--accent-primary)]' : 'bg-[var(--accent-primary)]/30'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-mono mt-1 font-semibold ${
                        isRoot ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {note}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
