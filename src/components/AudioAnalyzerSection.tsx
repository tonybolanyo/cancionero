import React, { Suspense, lazy } from 'react';
import {
  Activity,
  AlertCircle,
  FileAudio,
  Music,
  SlidersHorizontal,
  Sparkles,
  Upload
} from 'lucide-react';
import { SavedAudioAnalysis } from '../types/song';
import { BeatTimeline } from './BeatTimeline';
import { ChordSegment } from '../lib/audio/chords';
import type { MusicalSection } from '../lib/audio/structure';
import { isValidPlayableAudioUrl } from '../utils/markdownParser';
import {
  formatAnalyzerClock,
  useAudioAnalyzerWorkflow
} from '../hooks/useAudioAnalyzerWorkflow';
import { AnalyzerSummaryGrid } from './audio/AnalyzerSummaryGrid';
import { AnalyzerChordsTab } from './audio/AnalyzerChordsTab';
import { AnalyzerRhythmTab } from './audio/AnalyzerRhythmTab';
import { AnalyzerAdvancedTab } from './audio/AnalyzerAdvancedTab';
import { AnalyzerMobileMiniPlayer } from './audio/AnalyzerMobileMiniPlayer';

const ChromaticTunerModal = lazy(() =>
  import('./ChromaticTunerModal').then((m) => ({ default: m.ChromaticTunerModal }))
);

export interface AudioAnalyzerSectionProps {
  onApplyDetection: (data: {
    tempo: number;
    key: string;
    timeSignature: string;
    tuning?: string;
    audioUrl?: string;
    chordProgression?: string;
    suggestedLyricsChords?: string;
    tempoOffset?: number;
    chords?: ChordSegment[];
    audioAnalysis?: SavedAudioAnalysis;
  }) => void;
  onInsertChordsIntoLyrics?: (chords: ChordSegment[], sections?: MusicalSection[]) => void;
  canUndoInsertChords?: boolean;
  onUndoInsertChords?: () => void;
  savedAudioAnalysis?: SavedAudioAnalysis;
  currentKey?: string;
  currentTempo?: string;
  currentAudioUrl?: string;
  driveFileId?: string;
  driveFileName?: string;
  onAudioFileSelected?: (file: File) => void;
  onReanalyzeDriveAudio?: () => Promise<void>;
  isDriveLoading?: boolean;
  externalAudioFile?: File | null;
  embedded?: boolean;
  onRequestAudioUpload?: () => void;
}

export const AudioAnalyzerSection: React.FC<AudioAnalyzerSectionProps> = ({
  onApplyDetection,
  onInsertChordsIntoLyrics,
  canUndoInsertChords,
  onUndoInsertChords,
  savedAudioAnalysis,
  currentKey,
  currentTempo,
  currentAudioUrl,
  driveFileId,
  driveFileName,
  onAudioFileSelected,
  onReanalyzeDriveAudio,
  isDriveLoading,
  externalAudioFile,
  embedded = false,
  onRequestAudioUpload
}) => {
  const wf = useAudioAnalyzerWorkflow({
    onApplyDetection,
    savedAudioAnalysis,
    currentKey,
    currentTempo,
    currentAudioUrl,
    onAudioFileSelected,
    externalAudioFile,
    embedded
  });

  return (
    <div
      className={`space-y-4 text-xs transition-colors duration-200 ${
        wf.showMobileMiniPlayer ? 'pb-20 sm:pb-0' : ''
      }`}
    >
      {/* Compact Header (hidden when embedded in SongEditorPage to avoid duplicate titles) */}
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-subtle)]">
          <div className="min-w-0">
            <h4 className="font-serif font-bold text-sm sm:text-base text-[var(--text-primary)]">
              Análisis musical del audio
            </h4>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">
              Tempo, compás, tonalidad y progresión armónica en un solo panel
            </p>
          </div>

          <button
            type="button"
            onClick={() => wf.setIsTunerOpen(true)}
            className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Afinador
          </button>
        </div>
      )}

      {/* Unified Error States */}
      {(wf.error || wf.tempoError || wf.keyError) && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300 space-y-1.5 text-xs">
          {wf.error && (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span className="flex-1">{wf.error}</span>
            </div>
          )}
          {wf.tempoError && !wf.isCalculatingTempo && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>Ritmo: {wf.tempoError}</span>
              </span>
              <button
                type="button"
                onClick={() => wf.handleCalculateTempo()}
                className="underline font-semibold cursor-pointer shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}
          {wf.keyError && !wf.isAnalyzingKey && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>Tonalidad: {wf.keyError}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (wf.decodedAudioBuffer) void wf.analyzeKey(wf.decodedAudioBuffer);
                  else if (wf.file) void wf.handleCalculateTempo(wf.file);
                }}
                className="underline font-semibold cursor-pointer shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Unified Audio Source / Dropzone (standalone) OR Compact Action Bar (embedded) */}
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
          {wf.file ? (
            <>
              <span className="text-xs text-[var(--text-secondary)]">
                {wf.analysisResult
                  ? 'Análisis IA aplicado (afinación y notas musicales)'
                  : 'Detección rápida lista · Opcional: refina afinación y notas con IA'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => wf.setIsTunerOpen(true)}
                  className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Afinador
                </button>
                <button
                  type="button"
                  onClick={wf.handleRunAnalysis}
                  disabled={wf.isAnalyzing}
                  title="Opcional: analiza afinación, notas musicales y letra/acordes sugeridos con IA"
                  className="min-h-[44px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--accent-border)] text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {wf.isAnalyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                      <span>Refinando…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{wf.analysisResult ? 'Reanalizar con IA' : 'Refinar con IA'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : driveFileId ? (
            <>
              <span className="text-xs text-[var(--text-secondary)] truncate">
                Maqueta en Drive:{' '}
                <strong className="text-[var(--text-primary)]">
                  {driveFileName || 'Audio privado'}
                </strong>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => wf.setIsTunerOpen(true)}
                  className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Afinador
                </button>
                {onReanalyzeDriveAudio && (
                  <button
                    type="button"
                    onClick={() => void onReanalyzeDriveAudio()}
                    disabled={isDriveLoading}
                    className="min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isDriveLoading ? 'Cargando…' : 'Reanalizar de Drive'}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-[var(--text-secondary)]">
                Sube una maqueta en el panel superior para analizar tempo, tonalidad y acordes.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => wf.setIsTunerOpen(true)}
                  className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Afinador
                </button>
                {onRequestAudioUpload && (
                  <button
                    type="button"
                    onClick={onRequestAudioUpload}
                    className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir audio</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={wf.handleDrop}
          onClick={() => !wf.file && !driveFileId && wf.fileInputRef.current?.click()}
          className={`p-3.5 sm:p-4 rounded-xl border transition-colors ${
            wf.file || driveFileId
              ? 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)]'
              : 'border-2 border-dashed bg-[var(--bg-modal)]/60 border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface)] cursor-pointer text-center flex flex-col items-center justify-center gap-2 py-6'
          }`}
        >
          <input
            type="file"
            ref={wf.fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                wf.handleFileSelected(e.target.files[0]);
              }
            }}
            accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*"
            className="hidden"
          />

          {wf.file ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] flex items-center justify-center shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                    {wf.file.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                    <span>{(wf.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase text-[var(--accent-primary)] font-semibold">
                      {wf.file.name.split('.').pop()}
                    </span>
                    {wf.duration > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatAnalyzerClock(wf.duration)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    wf.handleRunAnalysis();
                  }}
                  disabled={wf.isAnalyzing}
                  title="Opcional: refina afinación de guitarra, notas musicales y sugerencias con IA"
                  className="min-h-[44px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--accent-border)] text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {wf.isAnalyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                      <span>Refinando…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{wf.analysisResult ? 'Reanalizar con IA' : 'Refinar con IA'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    wf.handleClearFile();
                  }}
                  className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer font-medium whitespace-nowrap"
                  title="Quitar archivo"
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : driveFileId ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                    {driveFileName || 'Maqueta guardada en Google Drive'}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Google Drive privado · Lista para reanalizar sin volver a subirla
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onReanalyzeDriveAudio && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onReanalyzeDriveAudio();
                    }}
                    disabled={isDriveLoading}
                    className="min-h-[44px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {isDriveLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                        <span>Cargando…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Reanalizar de Drive</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    wf.fileInputRef.current?.click();
                  }}
                  className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                >
                  Subir otra
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)]">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-xs sm:text-sm text-[var(--text-primary)]">
                  Arrastra o pulsa para subir tu maqueta (.mp3, .wav, .m4a)
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Detección rápida al instante (tempo, tono, acordes y estructura)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden audio element for playback preview */}
      {isValidPlayableAudioUrl(wf.audioUrl) && (
        <audio
          ref={wf.audioRef}
          src={wf.audioUrl}
          onTimeUpdate={() => wf.audioRef.current && wf.setCurrentTime(wf.audioRef.current.currentTime)}
          onLoadedMetadata={() => wf.audioRef.current && wf.setDuration(wf.audioRef.current.duration)}
          onEnded={() => wf.setIsPlaying(false)}
          onError={(e) => {
            console.warn('Error en el elemento de audio de AudioAnalyzerSection:', e);
            wf.setIsPlaying(false);
          }}
          className="hidden"
        />
      )}

      {/* Single Unified Progress Banner */}
      {(wf.isAnalyzing || wf.isAnyLocalAnalyzing) && (
        <div className="px-3.5 py-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center gap-2.5 text-xs text-[var(--accent-primary)]">
          <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="truncate font-medium">
            {wf.isAnalyzing
              ? (wf.progressMessage || 'Procesando armonía, estructura y ritmo…')
              : wf.isCalculatingTempo
              ? 'Calculando tempo y primer pulso…'
              : wf.isAnalyzingKey
              ? 'Detectando tonalidad y progresión de acordes…'
              : 'Mapeando estructura y compases…'}
          </span>
        </div>
      )}

      {/* 1. Interactive Beat Timeline */}
      {wf.file && (
        <div ref={wf.timelineContainerRef}>
          <BeatTimeline
            audioBuffer={wf.decodedAudioBuffer}
            beatAnalysis={wf.beatAnalysis}
            chords={wf.effectiveChords.length > 0 ? wf.effectiveChords : undefined}
            sections={wf.effectiveSections.length > 0 ? wf.effectiveSections : null}
            currentTime={wf.currentTime}
            duration={wf.duration || (wf.decodedAudioBuffer?.duration ?? 0)}
            isPlaying={wf.isPlaying}
            onSeek={wf.handleSeek}
            onTogglePlay={wf.togglePlayback}
            isLoading={wf.isAnalyzingBeats || wf.isAnalyzingKey || wf.isAnalyzingStructure}
            onRecalculate={() => wf.file && wf.handleCalculateTempo(wf.file)}
            onExportJSON={wf.handleExportChordsJSON}
            onExportCSV={wf.handleExportChordsCSV}
            onExportMIDI={() => wf.handleExportChordsMIDI()}
            pitchShiftSemitones={wf.pitchShiftSemitones}
            onPitchShiftChange={wf.handlePitchShiftChange}
            preserveTempo={wf.preserveTempo}
            onTogglePreserveTempo={wf.handleTogglePreserveTempo}
            accidentalPreference={wf.accidentalPreference}
            onToggleAccidentalPreference={wf.handleToggleAccidentalPreference}
            meter={wf.meterAnalysis?.meter}
            downbeats={wf.meterAnalysis?.downbeats}
            onMeterChange={wf.handleManualMeterChange}
            playbackRate={wf.playbackRate}
            onPlaybackRateChange={wf.handlePlaybackRateChange}
            loopStart={wf.loopStart}
            loopEnd={wf.loopEnd}
            onSetLoopA={wf.handleSetLoopA}
            onSetLoopB={wf.handleSetLoopB}
            onClearLoop={wf.handleClearLoop}
            eqMode={wf.eqMode}
            onEqModeChange={wf.handleEqModeChange}
          />
        </div>
      )}

      {/* 2. Unified Summary Card */}
      {wf.hasAnyAnalysisData && (
        <AnalyzerSummaryGrid
          file={wf.file}
          savedAudioAnalysis={savedAudioAnalysis}
          analysisResult={wf.analysisResult}
          progressionSummary={wf.progressionSummary}
          effectiveChords={wf.effectiveChords}
          effectiveSections={wf.effectiveSections}
          activeChordNow={wf.activeChordNow}
          accidentalPreference={wf.accidentalPreference}
          showExportMenu={wf.showExportMenu}
          setShowExportMenu={wf.setShowExportMenu}
          exportMenuRef={wf.exportMenuRef}
          onExportMIDI={() => wf.handleExportChordsMIDI()}
          onExportCSV={wf.handleExportChordsCSV}
          onExportJSON={wf.handleExportChordsJSON}
          onInsertChordsIntoLyrics={onInsertChordsIntoLyrics}
          canUndoInsertChords={canUndoInsertChords}
          onUndoInsertChords={onUndoInsertChords}
          canApplyAll={Boolean(
            wf.analysisResult || wf.tempoAnalysis || wf.keyAnalysis || wf.meterAnalysis
          )}
          applied={wf.applied}
          onApplyAll={wf.handleApplyAll}
          displayTempo={wf.displayTempo}
          isCalculatingTempo={wf.isCalculatingTempo}
          appliedTempo={wf.appliedTempo}
          onApplyOnlyTempo={wf.handleApplyOnlyTempo}
          displayKey={wf.displayKey}
          displayScale={wf.displayScale}
          manualKeyOverride={wf.manualKeyOverride}
          setManualKeyOverride={wf.setManualKeyOverride}
          isAnalyzingKey={wf.isAnalyzingKey}
          appliedKey={wf.appliedKey}
          onApplyOnlyKey={wf.handleApplyOnlyKey}
          onToggleAccidentalPreference={wf.handleToggleAccidentalPreference}
          displayMeter={wf.displayMeter}
          meterAnalysis={wf.meterAnalysis}
          isAnalyzingBeats={wf.isAnalyzingBeats}
          appliedMeter={wf.appliedMeter}
          onApplyOnlyMeter={wf.handleApplyOnlyMeter}
          onManualMeterChange={wf.handleManualMeterChange}
          isAnalyzingStructure={wf.isAnalyzingStructure}
          activeKpiEditor={wf.activeKpiEditor}
          setActiveKpiEditor={wf.setActiveKpiEditor}
        />
      )}

      {/* 3. Unified Tabbed Details */}
      {(wf.file || wf.hasAnyAnalysisData) && (
        <div className="rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] overflow-hidden">
          <div
            role="tablist"
            aria-label="Detalles del análisis de audio"
            className="grid grid-cols-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={wf.activeTab === 'chords'}
              onClick={() => wf.setActiveTab('chords')}
              className={`min-h-[44px] sm:min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                wf.activeTab === 'chords'
                  ? 'bg-[var(--bg-modal)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Music className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>Acordes</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={wf.activeTab === 'rhythm'}
              onClick={() => wf.setActiveTab('rhythm')}
              className={`min-h-[44px] sm:min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                wf.activeTab === 'rhythm'
                  ? 'bg-[var(--bg-modal)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Ritmo</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={wf.activeTab === 'advanced'}
              onClick={() => wf.setActiveTab('advanced')}
              className={`min-h-[44px] sm:min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                wf.activeTab === 'advanced'
                  ? 'bg-[var(--bg-modal)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span>Ajustes</span>
            </button>
          </div>

          <div className="p-3.5 sm:p-4 space-y-4">
            {wf.activeTab === 'chords' && (
              <AnalyzerChordsTab
                effectiveSections={wf.effectiveSections}
                effectiveChords={wf.effectiveChords}
                groupedChordSections={wf.groupedChordSections}
                currentTime={wf.currentTime}
                activeChordIndex={wf.activeChordIndex}
                followActiveChord={wf.followActiveChord}
                onToggleFollowActiveChord={() => wf.setFollowActiveChord((prev) => !prev)}
                accidentalPreference={wf.accidentalPreference}
                onToggleAccidentalPreference={wf.handleToggleAccidentalPreference}
                onSeek={wf.handleSeek}
                chordButtonRefs={wf.chordButtonRefs}
                isAnalyzingKey={wf.isAnalyzingKey}
                musicalNotes={wf.analysisResult?.musicalNotes || savedAudioAnalysis?.musicalNotes}
                keyAnalysis={wf.keyAnalysis}
                showChromaChart={wf.showChromaChart}
                onToggleChromaChart={() => wf.setShowChromaChart((prev) => !prev)}
              />
            )}

            {wf.activeTab === 'rhythm' && (
              <AnalyzerRhythmTab
                file={wf.file}
                beatAnalysis={wf.beatAnalysis}
                meterAnalysis={wf.meterAnalysis}
                minTempo={wf.minTempo}
                maxTempo={wf.maxTempo}
                onMinTempoChange={wf.setMinTempo}
                onMaxTempoChange={wf.setMaxTempo}
                isCalculatingTempo={wf.isCalculatingTempo}
                displayOffset={wf.displayOffset}
                onManualMeterChange={wf.handleManualMeterChange}
                onRecalculateTempoRange={(targetFile, minT, maxT) =>
                  void wf.handleCalculateTempo(targetFile, minT, maxT)
                }
              />
            )}

            {wf.activeTab === 'advanced' && (
              <AnalyzerAdvancedTab
                file={wf.file}
                isCalculatingTempo={wf.isCalculatingTempo}
                isAnalyzingKey={wf.isAnalyzingKey}
                onRecalculateTempo={() => wf.file && void wf.handleCalculateTempo(wf.file)}
                onRecalculateKey={() => {
                  if (wf.decodedAudioBuffer) {
                    void wf.analyzeKey(wf.decodedAudioBuffer, wf.beatAnalysis?.beats);
                  } else if (wf.file) {
                    void wf.handleCalculateTempo(wf.file);
                  }
                }}
                keyAnalysis={wf.keyAnalysis}
                meterAnalysis={wf.meterAnalysis}
                analysisResult={wf.analysisResult}
                savedAudioAnalysis={savedAudioAnalysis}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile Sticky Mini-Player */}
      {wf.showMobileMiniPlayer && (
        <AnalyzerMobileMiniPlayer
          isPlaying={wf.isPlaying}
          onTogglePlayback={wf.togglePlayback}
          activeChordNow={wf.activeChordNow}
          nextChordNow={wf.nextChordNow}
          activeSectionNow={wf.activeSectionNow}
          accidentalPreference={wf.accidentalPreference}
          currentTime={wf.currentTime}
          duration={wf.duration}
          hasBufferLoopControls={Boolean(wf.file && wf.decodedAudioBuffer)}
          loopStart={wf.loopStart}
          loopEnd={wf.loopEnd}
          onSetLoopA={wf.handleSetLoopA}
          onSetLoopB={wf.handleSetLoopB}
          onClearLoop={wf.handleClearLoop}
        />
      )}

      {wf.isTunerOpen && (
        <Suspense fallback={null}>
          <ChromaticTunerModal
            initialTuning={wf.analysisResult?.tuning || savedAudioAnalysis?.tuning}
            initialA4Hz={
              wf.keyAnalysis?.referenceA4Hz ??
              wf.analysisResult?.referenceA4Hz ??
              savedAudioAnalysis?.referenceA4Hz ??
              440
            }
            onClose={() => wf.setIsTunerOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};
