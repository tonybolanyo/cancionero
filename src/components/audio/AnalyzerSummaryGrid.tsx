import React from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Gauge,
  KeyRound,
  Layers,
  Sparkles,
  Undo2
} from 'lucide-react';
import { SavedAudioAnalysis } from '../../types/song';
import { AudioAnalysisResult } from '../../utils/webAudioAnalyzer';
import { ChordSegment } from '../../lib/audio/chords';
import { MusicalSection } from '../../lib/audio/structure';
import {
  COMMON_TIME_SIGNATURES_LIST,
  getMeterDescription,
  MeterAnalysis,
  TimeSignature,
  UNCOMMON_TIME_SIGNATURES_LIST
} from '../../lib/audio/meter';
import { AccidentalPreference, respellChord } from '../../utils/markdownParser';
import { CHROMATIC_NOTES_FLATS, CHROMATIC_NOTES_SHARPS } from '../../hooks/useAudioAnalyzerWorkflow';

export interface AnalyzerSummaryGridProps {
  file: File | null;
  savedAudioAnalysis?: SavedAudioAnalysis;
  analysisResult: AudioAnalysisResult | null;
  progressionSummary?: string;
  effectiveChords: ChordSegment[];
  effectiveSections: MusicalSection[];
  activeChordNow?: ChordSegment;
  accidentalPreference: AccidentalPreference;
  showExportMenu: boolean;
  setShowExportMenu: React.Dispatch<React.SetStateAction<boolean>>;
  exportMenuRef: React.RefObject<HTMLDivElement | null>;
  onExportMIDI: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onInsertChordsIntoLyrics?: (chords: ChordSegment[], sections?: MusicalSection[]) => void;
  canUndoInsertChords?: boolean;
  onUndoInsertChords?: () => void;
  canApplyAll: boolean;
  applied: boolean;
  onApplyAll: () => void;
  displayTempo: number | null;
  isCalculatingTempo: boolean;
  appliedTempo: boolean;
  onApplyOnlyTempo: () => void;
  displayKey: string | null;
  displayScale: string | null;
  manualKeyOverride: string | null;
  setManualKeyOverride: React.Dispatch<React.SetStateAction<string | null>>;
  isAnalyzingKey: boolean;
  appliedKey: boolean;
  onApplyOnlyKey: () => void;
  onToggleAccidentalPreference: () => void;
  displayMeter: TimeSignature | null;
  meterAnalysis: MeterAnalysis | null;
  isAnalyzingBeats: boolean;
  appliedMeter: boolean;
  onApplyOnlyMeter: () => void;
  onManualMeterChange: (meter: TimeSignature) => void;
  isAnalyzingStructure: boolean;
  activeKpiEditor: 'key' | 'meter' | null;
  setActiveKpiEditor: React.Dispatch<React.SetStateAction<'key' | 'meter' | null>>;
}

export const AnalyzerSummaryGrid: React.FC<AnalyzerSummaryGridProps> = ({
  file,
  savedAudioAnalysis,
  analysisResult,
  progressionSummary,
  effectiveChords,
  effectiveSections,
  activeChordNow,
  accidentalPreference,
  showExportMenu,
  setShowExportMenu,
  exportMenuRef,
  onExportMIDI,
  onExportCSV,
  onExportJSON,
  onInsertChordsIntoLyrics,
  canUndoInsertChords,
  onUndoInsertChords,
  canApplyAll,
  applied,
  onApplyAll,
  displayTempo,
  isCalculatingTempo,
  appliedTempo,
  onApplyOnlyTempo,
  displayKey,
  displayScale,
  manualKeyOverride,
  setManualKeyOverride,
  isAnalyzingKey,
  appliedKey,
  onApplyOnlyKey,
  onToggleAccidentalPreference,
  displayMeter,
  meterAnalysis,
  isAnalyzingBeats,
  appliedMeter,
  onApplyOnlyMeter,
  onManualMeterChange,
  isAnalyzingStructure,
  activeKpiEditor,
  setActiveKpiEditor
}) => {
  return (
    <>
      {/* Summary Header & Primary CTAs */}
      <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="font-serif font-bold text-sm text-[var(--text-primary)]">
              Resumen musical
            </h5>
            <span className="text-[11px] text-[var(--text-muted)]">
              {!file && savedAudioAnalysis
                ? `Guardado en la canción${savedAudioAnalysis.analyzedAt ? ` · ${new Date(savedAudioAnalysis.analyzedAt).toLocaleDateString('es-ES')}` : ''}`
                : analysisResult?.source === 'gemini_ai'
                ? 'Análisis completo IA'
                : 'Detección automática'}
            </span>
          </div>
          {progressionSummary && (
            <p className="text-[11px] font-mono text-[var(--text-secondary)] truncate mt-0.5">
              Progresión: <strong className="text-[var(--text-primary)]">{progressionSummary}</strong>
            </p>
          )}
        </div>

        {/* Primary Action Cluster */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {effectiveChords.length > 0 && (
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Exportar</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>

              {showExportMenu && (
                <>
                  {/* Desktop Popover */}
                  <div className="hidden sm:block absolute right-0 mt-1.5 w-44 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-medium)] shadow-lg py-1 z-30">
                    <button
                      type="button"
                      onClick={onExportMIDI}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                    >
                      <span>Archivo MIDI</span>
                      <span className="font-mono text-[10px] text-emerald-500">.mid</span>
                    </button>
                    <button
                      type="button"
                      onClick={onExportCSV}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                    >
                      <span>Tabla CSV</span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">.csv</span>
                    </button>
                    <button
                      type="button"
                      onClick={onExportJSON}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                    >
                      <span>Datos JSON</span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">.json</span>
                    </button>
                  </div>

                  {/* Mobile Bottom Sheet */}
                  <div
                    className="sm:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setShowExportMenu(false)}
                  >
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-label="Exportar acordes"
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded-t-3xl bg-[var(--bg-modal)] border-t border-[var(--border-medium)] shadow-2xl px-4 pt-2.5 pb-6 space-y-2"
                    >
                      <div className="w-10 h-1.5 rounded-full bg-[var(--border-strong)] mx-auto mb-2" />
                      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
                        <span className="font-serif font-bold text-sm text-[var(--text-primary)]">
                          Exportar acordes
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowExportMenu(false)}
                          className="min-h-[36px] px-2.5 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>

                      <div className="divide-y divide-[var(--border-subtle)] text-sm">
                        <button
                          type="button"
                          onClick={onExportMIDI}
                          className="w-full min-h-[48px] px-1 flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
                        >
                          <span>Archivo MIDI</span>
                          <span className="font-mono text-xs text-emerald-500 font-semibold">.mid</span>
                        </button>
                        <button
                          type="button"
                          onClick={onExportCSV}
                          className="w-full min-h-[48px] px-1 flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
                        >
                          <span>Tabla CSV</span>
                          <span className="font-mono text-xs text-[var(--text-muted)]">.csv</span>
                        </button>
                        <button
                          type="button"
                          onClick={onExportJSON}
                          className="w-full min-h-[48px] px-1 flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
                        >
                          <span>Datos JSON</span>
                          <span className="font-mono text-xs text-[var(--text-muted)]">.json</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {onInsertChordsIntoLyrics && effectiveChords.length > 0 && (
            <button
              type="button"
              onClick={() => onInsertChordsIntoLyrics(effectiveChords, effectiveSections)}
              className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              title="Insertar los acordes detectados en las sílabas de la letra"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Insertar acordes ({effectiveChords.length})</span>
            </button>
          )}

          {canUndoInsertChords && onUndoInsertChords && (
            <button
              type="button"
              onClick={onUndoInsertChords}
              className="min-h-[40px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/35 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
              title="Deshacer inserción de acordes"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Deshacer</span>
            </button>
          )}

          {canApplyAll && (
            <button
              type="button"
              onClick={onApplyAll}
              className={`min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                applied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]'
              }`}
            >
              {applied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>¡Aplicado!</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar a la canción</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 4-Metric Hairline Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)]">
        {/* KPI 1: Tempo */}
        <div className="p-3.5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Tempo</span>
            </span>
            {displayTempo !== null && (
              <button
                type="button"
                onClick={onApplyOnlyTempo}
                className={`min-h-[44px] sm:min-h-[28px] px-2.5 -my-2 sm:my-0 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap flex items-center ${
                  appliedTempo
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                    : 'text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)]'
                }`}
              >
                {appliedTempo ? '¡Usado!' : 'Usar'}
              </button>
            )}
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                {displayTempo ?? '—'}
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">BPM</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
              {isCalculatingTempo
                ? 'Calculando pulso…'
                : displayTempo !== null
                ? 'Pulso automático'
                : 'Sin datos'}
            </p>
          </div>
        </div>

        {/* KPI 2: Key & Scale */}
        <div className="p-3.5 flex flex-col justify-between gap-2 border-l border-[var(--border-subtle)] lg:border-l-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Tonalidad</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleAccidentalPreference}
                className="min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-[28px] px-2 -my-2 sm:my-0 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs sm:text-[11px] font-mono font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer whitespace-nowrap flex items-center justify-center"
                title="Alternar entre sostenidos (♯) y bemoles (♭)"
                aria-label="Alternar sostenidos y bemoles"
              >
                {accidentalPreference === 'flats' ? '♭' : '♯'}
              </button>
              {displayKey && (
                <button
                  type="button"
                  onClick={onApplyOnlyKey}
                  className={`min-h-[44px] sm:min-h-[28px] px-2.5 -my-2 sm:my-0 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap flex items-center ${
                    appliedKey
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      : 'text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)]'
                  }`}
                >
                  {appliedKey ? '¡Usado!' : 'Usar'}
                </button>
              )}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setActiveKpiEditor((prev) => (prev === 'key' ? null : 'key'))}
              aria-expanded={activeKpiEditor === 'key'}
              title="Toca para ajustar la tonalidad manualmente"
              className="min-h-[44px] sm:min-h-[32px] -ml-1.5 px-1.5 rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors flex items-baseline gap-1.5 flex-wrap text-left cursor-pointer w-full"
            >
              <span className="text-xl sm:text-2xl font-bold font-mono text-[var(--accent-primary)]">
                {displayKey ?? '—'}
              </span>
              {displayScale && (
                <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
                  {displayScale}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-[var(--text-muted)] ml-auto self-center transition-transform ${
                  activeKpiEditor === 'key' ? 'rotate-180 text-[var(--accent-primary)]' : ''
                }`}
              />
            </button>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
              {manualKeyOverride
                ? 'Ajustada manualmente'
                : isAnalyzingKey
                ? 'Analizando armonía…'
                : 'Toca para corregir'}
            </p>
          </div>
        </div>

        {/* KPI 3: Meter */}
        <div className="p-3.5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Compás</span>
            </span>
            {displayMeter && (
              <button
                type="button"
                onClick={onApplyOnlyMeter}
                className={`min-h-[44px] sm:min-h-[28px] px-2.5 -my-2 sm:my-0 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap flex items-center ${
                  appliedMeter
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                    : 'text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)]'
                }`}
              >
                {appliedMeter ? '¡Usado!' : 'Usar'}
              </button>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setActiveKpiEditor((prev) => (prev === 'meter' ? null : 'meter'))}
              aria-expanded={activeKpiEditor === 'meter'}
              title="Toca para corregir el compás manualmente"
              className="min-h-[44px] sm:min-h-[32px] -ml-1.5 px-1.5 rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors flex items-baseline gap-1.5 flex-wrap text-left cursor-pointer w-full"
            >
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                {displayMeter ?? '—'}
              </span>
              {displayMeter && (
                <span className="text-[11px] text-[var(--text-secondary)] truncate">
                  {getMeterDescription(displayMeter)}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-[var(--text-muted)] ml-auto self-center transition-transform ${
                  activeKpiEditor === 'meter' ? 'rotate-180 text-[var(--accent-primary)]' : ''
                }`}
              />
            </button>
            <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5 truncate">
              {meterAnalysis
                ? meterAnalysis.confidence === 1.0
                  ? `Manual${meterAnalysis.barCount || meterAnalysis.downbeats.length ? ` · ${meterAnalysis.barCount || meterAnalysis.downbeats.length} compases` : ''}`
                  : `${meterAnalysis.barCount || meterAnalysis.downbeats.length} compases`
                : isAnalyzingBeats
                ? 'Estimando…'
                : 'Toca para corregir'}
            </p>
          </div>
        </div>

        {/* KPI 4: Chords & Structure */}
        <div className="p-3.5 flex flex-col justify-between gap-2 border-l border-[var(--border-subtle)] lg:border-l-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span>Armonía</span>
            </span>
            {activeChordNow && (
              <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-300">
                {respellChord(activeChordNow.chord, accidentalPreference)}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                {effectiveChords.length}
              </span>
              <span className="text-xs text-[var(--text-muted)]">acordes</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
              {effectiveSections.length > 0
                ? `${effectiveSections.length} secciones detectadas`
                : isAnalyzingStructure
                ? 'Detectando secciones…'
                : 'Segmentos armónicos'}
            </p>
          </div>
        </div>
      </div>

      {/* Inline Quick-Editor Strip for Key or Meter */}
      {activeKpiEditor === 'key' && (
        <div className="p-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Ajustar tonalidad manualmente
            </span>
            <div className="flex items-center gap-1.5">
              {(['major', 'minor'] as const).map((mode) => {
                const currentIsMinor = (displayKey || 'Am').endsWith('m');
                const isSelected = mode === 'minor' ? currentIsMinor : !currentIsMinor;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      const root = (displayKey || 'A').replace(/m$/, '');
                      setManualKeyOverride(mode === 'minor' ? `${root}m` : root);
                    }}
                    className={`min-h-[40px] sm:min-h-[30px] px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-modal)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {mode === 'major' ? 'Mayor' : 'Menor'}
                  </button>
                );
              })}
              {manualKeyOverride && (
                <button
                  type="button"
                  onClick={() => setManualKeyOverride(null)}
                  className="min-h-[40px] sm:min-h-[30px] px-2.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-modal)] cursor-pointer whitespace-nowrap"
                >
                  Auto
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
            {(accidentalPreference === 'flats' ? CHROMATIC_NOTES_FLATS : CHROMATIC_NOTES_SHARPS).map((note) => {
              const isMinor = (displayKey || 'Am').endsWith('m');
              const candidate = isMinor ? `${note}m` : note;
              const isSelected = displayKey === candidate;
              return (
                <button
                  key={note}
                  type="button"
                  onClick={() => {
                    setManualKeyOverride(candidate);
                    setActiveKpiEditor(null);
                  }}
                  className={`min-h-[44px] sm:min-h-[34px] rounded-lg font-mono text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-modal)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-border)]'
                  }`}
                >
                  {candidate}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeKpiEditor === 'meter' && (
        <div className="p-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Seleccionar compás
            </span>
            <button
              type="button"
              onClick={() => setActiveKpiEditor(null)}
              className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {COMMON_TIME_SIGNATURES_LIST.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onManualMeterChange(m);
                  setActiveKpiEditor(null);
                }}
                className={`min-h-[44px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg font-mono text-xs font-semibold cursor-pointer transition-colors border whitespace-nowrap ${
                  displayMeter === m
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-[var(--bg-modal)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-border)]'
                }`}
              >
                {m}
              </button>
            ))}
            <select
              aria-label="Seleccionar compás irregular o compuesto"
              value={
                displayMeter && UNCOMMON_TIME_SIGNATURES_LIST.includes(displayMeter)
                  ? displayMeter
                  : ''
              }
              onChange={(e) => {
                if (e.target.value) {
                  onManualMeterChange(e.target.value as TimeSignature);
                  setActiveKpiEditor(null);
                }
              }}
              className={`min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg font-mono text-xs font-semibold cursor-pointer border focus:outline-none ${
                displayMeter && UNCOMMON_TIME_SIGNATURES_LIST.includes(displayMeter)
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-[var(--bg-modal)] text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              <option value="" disabled>
                Irregular…
              </option>
              {UNCOMMON_TIME_SIGNATURES_LIST.map((m) => (
                <option key={m} value={m} className="bg-[var(--bg-modal)] text-[var(--text-primary)]">
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  );
};
