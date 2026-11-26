import React from 'react';
import {
  BookOpen,
  Download,
  Eraser,
  Feather,
  Music,
  Sparkles,
  Square,
  Undo2,
  Volume2
} from 'lucide-react';
import { SavedAudioAnalysis } from '../../types/song';
import { parseLyricLine } from '../../utils/markdownParser';
import { SONGWRITING_TEMPLATES } from '../../utils/songwriterHelper';
import {
  HarmonicChordEntry,
  MUSICAL_MODE_LABELS,
  MusicalMode,
  ChordSuggestion
} from '../../lib/music/harmonyEngine';
import { playChordPreview } from '../../lib/audio/chordSynth';
import { SectionProgression } from '../../lib/music/midiExporter';
import { PoeticAnalysisSummary } from '../../lib/lyrics/poeticAnalysis';

export interface LyricsChordEditorProps {
  keySignature: string;
  tempo: string;
  tuning: string;
  musicalMode: MusicalMode | 'auto';
  onMusicalModeChange: (mode: MusicalMode | 'auto') => void;
  chordPaletteTab: HarmonicChordEntry['category'];
  onChordPaletteTabChange: (tab: HarmonicChordEntry['category']) => void;
  activeCategoryChords: HarmonicChordEntry[];
  onInsertChordAtCursor: (chordName: string) => void;
  customChordInput: string;
  onCustomChordInputChange: (val: string) => void;
  onAddCustomChord: () => void;
  onInsertSection: (sectionName: string) => void;
  onApplyTemplate: (templateId: string) => void;
  hasDetectedChords: boolean;
  detectedChordsCount: number;
  onInsertDetectedChords: () => void;
  canUndoChordInsertion: boolean;
  onUndoChordInsertion: () => void;
  onStripChords: () => void;
  lastChordBeforeCursor: string | null;
  contextualNextChords: ChordSuggestion[];
  showStandPreview: boolean;
  onShowStandPreviewChange: (show: boolean) => void;
  savedAudioAnalysis: SavedAudioAnalysis | null;
  showPoeticAnalysis: boolean;
  onTogglePoeticAnalysis: (show: boolean) => void;
  poeticAnalysis: PoeticAnalysisSummary | null;
  linesCount: number;
  lyricsTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  lyrics: string;
  onLyricsChange: (val: string) => void;
  onUpdateCursorPosition: () => void;
  sectionProgressions: SectionProgression[];
  playingProgressionId: string | null;
  activeProgressionStep: { id: string; index: number } | null;
  onToggleProgression: (progId: string, chords: string[]) => void;
  onExportCurrentMidi: () => void;
}

export const LyricsChordEditor: React.FC<LyricsChordEditorProps> = ({
  keySignature,
  tempo,
  tuning,
  musicalMode,
  onMusicalModeChange,
  chordPaletteTab,
  onChordPaletteTabChange,
  activeCategoryChords,
  onInsertChordAtCursor,
  customChordInput,
  onCustomChordInputChange,
  onAddCustomChord,
  onInsertSection,
  onApplyTemplate,
  hasDetectedChords,
  detectedChordsCount,
  onInsertDetectedChords,
  canUndoChordInsertion,
  onUndoChordInsertion,
  onStripChords,
  lastChordBeforeCursor,
  contextualNextChords,
  showStandPreview,
  onShowStandPreviewChange,
  savedAudioAnalysis,
  showPoeticAnalysis,
  onTogglePoeticAnalysis,
  poeticAnalysis,
  linesCount,
  lyricsTextareaRef,
  lyrics,
  onLyricsChange,
  onUpdateCursorPosition,
  sectionProgressions,
  playingProgressionId,
  activeProgressionStep,
  onToggleProgression,
  onExportCurrentMidi
}) => {
  const renderLyricsStandPreview = () => {
    const lines = lyrics.split('\n');
    let currentSecId = 'section-0';
    let chordIndexInSec = 0;

    return lines.map((line, idx) => {
      if (line.startsWith('##') || line.startsWith('#')) {
        const heading = line.replace(/^#+\s*/, '').trim();
        const matchedSec = sectionProgressions.find(
          (s) => s.title.toLowerCase() === heading.toLowerCase()
        );
        currentSecId = matchedSec?.id || `heading-${idx}`;
        chordIndexInSec = 0;
        const isPlayingThisSec = matchedSec && playingProgressionId === matchedSec.id;

        return (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 mt-5 mb-1.5 border-b border-[var(--border-subtle)] pb-0.5"
          >
            <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-bold">
              {heading}
            </h4>
            {matchedSec && matchedSec.chords.length > 0 && (
              <button
                type="button"
                onClick={() => onToggleProgression(matchedSec.id, matchedSec.chords)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  isPlayingThisSec
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                }`}
                title={
                  isPlayingThisSec
                    ? 'Detener progresión'
                    : `Escuchar progresión (${matchedSec.chords.join(' - ')})`
                }
              >
                {isPlayingThisSec ? (
                  <Square className="w-2.5 h-2.5 fill-current" />
                ) : (
                  <Volume2 className="w-2.5 h-2.5" />
                )}
                <span>{isPlayingThisSec ? 'Detener' : 'Oír'}</span>
              </button>
            )}
          </div>
        );
      }
      if (!line.trim()) return <div key={idx} className="h-3" />;

      const metricInfo = poeticAnalysis?.lines[idx];
      const renderMetricTag = () => {
        if (!showPoeticAnalysis || !metricInfo || metricInfo.isEmpty || metricInfo.isSectionHeader) {
          return null;
        }
        const stressTooltip =
          metricInfo.stressType === 'aguda'
            ? 'Aguda (+1)'
            : metricInfo.stressType === 'esdrujula'
            ? 'Esdrújula (-1)'
            : 'Llana (0)';
        const detailTitle = `${metricInfo.verseName}: ${metricInfo.grammaticalSyllables} gram.${
          metricInfo.sinalefas > 0 ? ` - ${metricInfo.sinalefas} sinalefa(s)` : ''
        } · Final ${stressTooltip} = ${metricInfo.metricSyllables} síl. métricas`;

        return (
          <div
            className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] tabular-nums select-none self-end pb-0.5"
            title={detailTitle}
          >
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              {metricInfo.metricSyllables} síl.
              {metricInfo.sinalefas > 0 && (
                <span className="ml-1 text-[var(--accent-primary)]">({metricInfo.sinalefas} sin.)</span>
              )}
            </span>
            {metricInfo.rhymeLetter !== '-' ? (
              <span
                className={`px-1.5 py-0.5 rounded font-bold border ${
                  metricInfo.rhymeType === 'consonante'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
                title={`Rima ${metricInfo.rhymeType}`}
              >
                {metricInfo.rhymeLetter} {metricInfo.rhymeType === 'consonante' ? 'cons' : 'ason'}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[var(--text-muted)] border border-transparent">-</span>
            )}
          </div>
        );
      };

      if (/\[([A-G][#b]?[^\]]*)\]/.test(line)) {
        const segments = parseLyricLine(line);
        return (
          <div key={idx} className="flex items-end justify-between gap-3 my-0.5">
            <div className="flex flex-wrap items-end font-mono leading-none min-w-0">
              {segments.map((segment, sIdx) => {
                let isStepActive = false;
                if (segment.chord) {
                  const thisChordIdx = chordIndexInSec;
                  chordIndexInSec++;
                  isStepActive =
                    activeProgressionStep !== null &&
                    activeProgressionStep.id === currentSecId &&
                    activeProgressionStep.index === thisChordIdx;
                }
                return (
                  <span key={sIdx} className="inline-flex flex-col mr-1">
                    <span
                      className={`text-[11px] font-bold select-none h-3.5 rounded px-0.5 transition-colors ${
                        isStepActive
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                          : 'text-[var(--accent-primary)]'
                      }`}
                    >
                      {segment.chord || '\u00A0'}
                    </span>
                    <span className="font-serif text-sm text-[var(--text-primary)] leading-normal">
                      {segment.text || '\u00A0'}
                    </span>
                  </span>
                );
              })}
            </div>
            {renderMetricTag()}
          </div>
        );
      }

      return (
        <div key={idx} className="flex items-baseline justify-between gap-3 my-0.5">
          <p className="font-serif text-sm text-[var(--text-secondary)] leading-relaxed min-w-0">
            {line.replace(/\[[^\]]+\]/g, '')}
          </p>
          {renderMetricTag()}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Dynamic Harmonic Palette + Contextual Next-Chord Suggestions + Section Anchors */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 py-2.5 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-[var(--text-primary)] mr-1 flex items-center gap-1">
              <Music className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Armonía [{keySignature}]:</span>
            </span>

            <select
              value={musicalMode}
              onChange={(e) => onMusicalModeChange(e.target.value as MusicalMode | 'auto')}
              className="px-2 py-1 text-[11px] font-medium rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer"
              title="Seleccionar modo o escala armónica"
            >
              <option value="auto">Modo automático</option>
              {(Object.keys(MUSICAL_MODE_LABELS) as MusicalMode[]).map((m) => (
                <option key={m} value={m}>
                  {MUSICAL_MODE_LABELS[m]}
                </option>
              ))}
            </select>

            <div className="flex items-center bg-[var(--bg-surface-subtle)] p-0.5 rounded border border-[var(--border-subtle)]">
              {(
                [
                  { id: 'diatonic', label: 'Diatónicos' },
                  { id: 'seventh', label: '7ª' },
                  { id: 'secondary_dominant', label: 'Dom. Sec.' },
                  { id: 'modal_interchange', label: 'Int. Modal' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChordPaletteTabChange(tab.id)}
                  className={`px-2 py-0.5 rounded text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                    chordPaletteTab === tab.id
                      ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] font-semibold shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeCategoryChords.map((entry) => (
              <div
                key={`${entry.category}-${entry.chord}`}
                className="inline-flex items-center rounded bg-[var(--accent-subtle)] border border-[var(--accent-border)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onInsertChordAtCursor(entry.chord)}
                  className="px-2 py-1 text-xs font-mono font-bold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                  title={`Insertar [${entry.chord}] (${entry.roman} · ${entry.functionLabel})`}
                >
                  {entry.chord}
                  <span className="ml-1 text-[9px] font-normal opacity-75">{entry.roman}</span>
                </button>
                <button
                  type="button"
                  onClick={() => playChordPreview(entry.chord, 'guitar', tuning)}
                  className="px-1.5 py-1 text-[var(--text-muted)] hover:text-[var(--accent-primary)] border-l border-[var(--accent-border)]/50 cursor-pointer"
                  title={`Escuchar ${entry.chord}`}
                >
                  <Volume2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-1 pl-1">
              <input
                type="text"
                value={customChordInput}
                onChange={(e) => onCustomChordInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddCustomChord();
                  }
                }}
                placeholder="ej. B7, D/F#"
                className="w-20 px-1.5 py-0.5 text-xs font-mono rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={onAddCustomChord}
                disabled={!customChordInput.trim()}
                className="px-1.5 py-0.5 text-xs font-semibold rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:text-[var(--accent-primary)] cursor-pointer disabled:opacity-40"
                title="Insertar acorde personalizado"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[var(--text-muted)] font-medium mr-1">Sección:</span>
            {(['Intro', 'Estrofa 1', 'Estrofa 2', 'Estribillo', 'Puente', 'Coda'] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onInsertSection(sec)}
                className="px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:text-[var(--accent-primary)] text-[11px] text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                + {sec}
              </button>
            ))}

            <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

            <select
              onChange={(e) => {
                if (e.target.value) {
                  onApplyTemplate(e.target.value);
                  e.target.value = '';
                }
              }}
              className="text-[11px] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded px-2 py-0.5 text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              defaultValue=""
            >
              <option value="" disabled>
                Plantillas...
              </option>
              {SONGWRITING_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>

            {hasDetectedChords && (
              <button
                type="button"
                onClick={onInsertDetectedChords}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Insertar acordes detectados automáticamente en las sílabas exactas de la letra"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Insertar acordes ({detectedChordsCount})</span>
              </button>
            )}

            {canUndoChordInsertion && (
              <button
                type="button"
                onClick={onUndoChordInsertion}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Deshacer la inserción de acordes y restaurar la letra anterior"
              >
                <Undo2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Deshacer</span>
              </button>
            )}

            <button
              type="button"
              onClick={onStripChords}
              className="p-1 rounded text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
              title="Eliminar todos los acordes [C] para dejar solo la poesía"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Contextual Next-Chord Suggestions Bar */}
        <div className="pt-1.5 border-t border-[var(--border-subtle)]/70 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-[var(--text-muted)] font-medium">
            {lastChordBeforeCursor
              ? `Tras [${lastChordBeforeCursor}], próximo acorde probable:`
              : 'Sugerencia armónica inicial:'}
          </span>
          {contextualNextChords.map((sug) => (
            <button
              key={`sug-${sug.chord}-${sug.reason}`}
              type="button"
              onClick={() => onInsertChordAtCursor(sug.chord)}
              onContextMenu={(e) => {
                e.preventDefault();
                playChordPreview(sug.chord, 'guitar', tuning);
              }}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] transition-colors cursor-pointer"
              title={`Insertar [${sug.chord}] · ${sug.reason} (clic derecho para escuchar)`}
            >
              <strong className="font-mono text-[var(--accent-primary)]">{sug.chord}</strong>
              <span className="text-[10px] text-[var(--text-muted)]">{sug.reason}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Workbench: Left Code/Lyrics + Right Live Atril Preview */}
      <div
        className={`flex-1 grid ${
          showStandPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        } divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)] min-h-[460px]`}
      >
        {/* Left: Code/Lyrics Editor */}
        <div className="flex flex-col relative bg-[var(--bg-surface)]">
          <div className="px-4 py-2 bg-[var(--bg-surface-subtle)]/50 border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] font-mono flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>Editor de Versos y Armonía</span>
              {savedAudioAnalysis && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-sans">
                  Análisis guardado ({savedAudioAnalysis.key || keySignature} ·{' '}
                  {savedAudioAnalysis.tempo || tempo} BPM)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !showPoeticAnalysis;
                  onTogglePoeticAnalysis(next);
                  if (next && !showStandPreview) {
                    onShowStandPreviewChange(true);
                  }
                }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors cursor-pointer ${
                  showPoeticAnalysis
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)] font-semibold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
                title="Analizar métrica poética (sílabas, sinalefas, ley del acento final) y esquema de rimas por estrofa"
              >
                <Feather className="w-3 h-3" />
                <span>Métrica y Rima</span>
              </button>
              <span className="hidden sm:inline">
                Inserta <code>[Acorde]</code> justo antes de la sílaba acentuada
              </span>
            </div>
          </div>

          <div className="flex-1 flex relative">
            <div className="w-10 py-3 bg-[var(--bg-surface-subtle)]/30 border-r border-[var(--border-subtle)] select-none text-right pr-2 font-mono text-[11px] text-[var(--text-muted)]/60 leading-relaxed overflow-hidden">
              {Array.from({ length: Math.max(linesCount, 18) }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>

            <textarea
              ref={lyricsTextareaRef}
              value={lyrics}
              onChange={(e) => {
                onLyricsChange(e.target.value);
                onUpdateCursorPosition();
              }}
              onKeyUp={onUpdateCursorPosition}
              onClick={onUpdateCursorPosition}
              onSelect={onUpdateCursorPosition}
              placeholder="Escribe aquí los versos. Ejemplo: [Am] En la noche que nos [G] vimos..."
              className="flex-1 p-3 font-mono text-xs sm:text-sm bg-transparent text-[var(--text-primary)] leading-relaxed resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right: Live Stand Preview */}
        {showStandPreview && (
          <div className="flex flex-col bg-[var(--bg-surface-subtle)]/30">
            <div className="px-4 py-2 bg-[var(--bg-surface-subtle)]/70 border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] font-mono flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Atril en Vivo</span>
              </span>
              <div className="flex items-center gap-2">
                {sectionProgressions.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const allChords = sectionProgressions.flatMap((s) => s.chords);
                        onToggleProgression('__full_song__', allChords);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] transition-colors cursor-pointer ${
                        playingProgressionId === '__full_song__'
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)] font-semibold'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--accent-primary)]'
                      }`}
                      title="Reproducir progresión armónica completa al tempo configurado"
                    >
                      {playingProgressionId === '__full_song__' ? (
                        <Square className="w-2.5 h-2.5 fill-current" />
                      ) : (
                        <Volume2 className="w-3 h-3 text-[var(--accent-primary)]" />
                      )}
                      <span>{playingProgressionId === '__full_song__' ? 'Detener' : 'Oír progresión'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onExportCurrentMidi}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer"
                      title="Exportar progresión armónica a archivo MIDI (.mid)"
                    >
                      <Download className="w-2.5 h-2.5" />
                      <span>MIDI</span>
                    </button>
                  </>
                )}
                <span className="font-bold text-[var(--accent-primary)]">Tono: {keySignature}</span>
              </div>
            </div>

            {showPoeticAnalysis && poeticAnalysis && poeticAnalysis.totalVerses > 0 && (
              <div className="px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 font-mono tabular-nums text-[var(--text-secondary)]">
                  <Feather className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{poeticAnalysis.totalVerses} versos</span>
                  {poeticAnalysis.dominantMetricLength && (
                    <span>
                      · Dominante:{' '}
                      <strong className="text-[var(--text-primary)]">
                        {poeticAnalysis.dominantMetricLength} síl.
                      </strong>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                  {poeticAnalysis.stanzas.map((st, sIdx) => (
                    <span
                      key={st.stanzaIndex}
                      className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                      title={st.title || `Estrofa ${sIdx + 1}`}
                    >
                      {st.title ? `${st.title}: ` : `E${sIdx + 1}: `}
                      <strong className="text-[var(--accent-primary)]">{st.scheme}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 p-5 overflow-y-auto max-h-[580px] space-y-1">
              {renderLyricsStandPreview()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
