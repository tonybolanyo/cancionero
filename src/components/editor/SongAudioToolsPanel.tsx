import React, { Suspense, lazy } from 'react';
import {
  AlertCircle,
  Clock,
  Cloud,
  Cpu,
  FileAudio,
  Key,
  Mic,
  Music2,
  Pause,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Wand2
} from 'lucide-react';
import { SavedAudioAnalysis } from '../../types/song';
import { ChordSegment } from '../../lib/audio/chords';
import type { MusicalSection } from '../../lib/audio/structure';
import { ExtractedMp3Metadata } from '../../lib/audio/mp3Metadata';
import { LyricsTranscriptionResult } from '../../types/transcription';

const AudioAnalyzerSection = lazy(() =>
  import('../AudioAnalyzerSection').then((m) => ({ default: m.AudioAnalyzerSection }))
);

export interface SongAudioToolsPanelProps {
  mode: 'audio-studio.dsp' | 'sync.lrc';
  audioUrl: string;
  activeAudioFile: File | null;
  driveFileId: string;
  driveFileName: string;
  isPlayingLocalAudio: boolean;
  audioCurrentTime: number;
  audioDuration: number;
  onToggleLocalAudio: () => void;
  onSeekAudio: (time: number) => void;
  onRequestAudioUpload: () => void;
  onAudioFileChosen: (file: File) => void;
  pendingMp3Metadata: ExtractedMp3Metadata | null;
  onOpenMp3Comparison: () => Promise<void>;
  audioStudioMode: 'analyzer' | 'transcription';
  onAudioStudioModeChange: (mode: 'analyzer' | 'transcription') => void;
  onApplyAudioDetection: (data: {
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
  onInsertDetectedChords: (chordsOverride?: ChordSegment[], sectionsOverride?: MusicalSection[]) => void;
  canUndoChordInsertion: boolean;
  onUndoChordInsertion: () => void;
  savedAudioAnalysis: SavedAudioAnalysis | null;
  keySignature: string;
  tempo: string;
  transcriptionEngine: 'backend_gemini' | 'local_whisper';
  onTranscriptionEngineChange: (engine: 'backend_gemini' | 'local_whisper') => void;
  transcriptionLanguage: 'spanish' | 'english' | 'auto';
  onTranscriptionLanguageChange: (lang: 'spanish' | 'english' | 'auto') => void;
  hasServerApiKey: boolean | null;
  backendConsent: boolean;
  onBackendConsentChange: (val: boolean) => void;
  transcriptionProgress: string | null;
  transcriptionError: string | null;
  lastTranscriptionResult: LyricsTranscriptionResult | null;
  isTranscribing: boolean;
  onRunTranscription: () => void;
  onApplyTranscribedLyrics: (replace: boolean) => void;
  lrc: string;
  onLrcChange: (val: string) => void;
  onCopyLyricsToLrc: () => void;
  onCopyLrcToLyrics: () => void;
  onOpenSyncAssistant: () => void;
}

export const SongAudioToolsPanel: React.FC<SongAudioToolsPanelProps> = ({
  mode,
  audioUrl,
  activeAudioFile,
  driveFileId,
  driveFileName,
  isPlayingLocalAudio,
  audioCurrentTime,
  audioDuration,
  onToggleLocalAudio,
  onSeekAudio,
  onRequestAudioUpload,
  onAudioFileChosen,
  pendingMp3Metadata,
  onOpenMp3Comparison,
  audioStudioMode,
  onAudioStudioModeChange,
  onApplyAudioDetection,
  onInsertDetectedChords,
  canUndoChordInsertion,
  onUndoChordInsertion,
  savedAudioAnalysis,
  keySignature,
  tempo,
  transcriptionEngine,
  onTranscriptionEngineChange,
  transcriptionLanguage,
  onTranscriptionLanguageChange,
  hasServerApiKey,
  backendConsent,
  onBackendConsentChange,
  transcriptionProgress,
  transcriptionError,
  lastTranscriptionResult,
  isTranscribing,
  onRunTranscription,
  onApplyTranscribedLyrics,
  lrc,
  onLrcChange,
  onCopyLyricsToLrc,
  onCopyLrcToLyrics,
  onOpenSyncAssistant
}) => {
  if (mode === 'sync.lrc') {
    return (
      <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-w-5xl mx-auto w-full">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                  Sincronización LRC (Teleprompter & Atril Dinámico)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Permite que los versos se iluminen al ritmo de la música mientras tocas o cantas.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCopyLyricsToLrc}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                title="Importar letra actual limpiando acordes"
              >
                Copiar desde Letra
              </button>
              <button
                type="button"
                onClick={onCopyLrcToLyrics}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] cursor-pointer"
                title="Transferir este texto a lyrics.md sin tiempos"
              >
                Copiar a Letra
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--accent-subtle)]/30 border border-[var(--accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[var(--accent-primary)] uppercase tracking-wider block">
                Asistente Tap-to-Sync en Vivo
              </span>
              <p className="text-xs text-[var(--text-primary)]">
                Pulsa la barra{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[11px] font-bold">
                  Espacio
                </kbd>{' '}
                al inicio de cada frase mientras escuchas la canción.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenSyncAssistant}
              disabled={!audioUrl}
              className="px-4 py-2 text-xs font-bold rounded-md bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{audioUrl ? 'Abrir Asistente Tap-to-Sync' : 'Requiere archivo de audio'}</span>
            </button>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-mono text-[var(--text-secondary)]">
              Marcas de tiempo LRC: <code>[mm:ss.xx] Verso lírico</code>
            </label>
            <textarea
              rows={14}
              value={lrc}
              onChange={(e) => onLrcChange(e.target.value)}
              placeholder="[00:12.30] Primer verso cantado de la canción..."
              className="w-full p-3 font-mono text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-y"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-w-5xl mx-auto w-full">
      {/* Audio Upload / Player Card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              <FileAudio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                Maqueta de Audio & Grabación
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Carga tu nota de voz acústica o mezcla para análisis armónico y transcripción.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRequestAudioUpload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{audioUrl ? 'Reemplazar Audio' : 'Subir Archivo (.mp3, .wav)'}</span>
          </button>
        </div>

        {audioUrl ? (
          <div className="p-4 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 truncate">
                <Music2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span className="font-mono text-xs font-semibold text-[var(--text-primary)] truncate">
                  {activeAudioFile?.name || driveFileName || 'Pista de audio asignada'}
                </span>
              </div>
              {driveFileId && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                  <Cloud className="w-3 h-3" />
                  <span>Google Drive</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onToggleLocalAudio}
                className="w-8 h-8 rounded-full bg-[var(--accent-primary)] text-[var(--accent-text)] flex items-center justify-center cursor-pointer shadow-xs shrink-0"
              >
                {isPlayingLocalAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              <div className="flex-1 space-y-1">
                <input
                  type="range"
                  min="0"
                  max={audioDuration || 100}
                  value={audioCurrentTime}
                  onChange={(e) => onSeekAudio(parseFloat(e.target.value))}
                  className="w-full accent-[var(--accent-primary)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                  <span>
                    {Math.floor(audioCurrentTime / 60)}:{Math.floor(audioCurrentTime % 60).toString().padStart(2, '0')}
                  </span>
                  <span>
                    {Math.floor(audioDuration / 60)}:{Math.floor(audioDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>

            {(pendingMp3Metadata || activeAudioFile) && (
              <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <FileAudio className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-xs text-[var(--text-primary)]">
                        Metadatos ID3 del archivo MP3
                      </h4>
                      {pendingMp3Metadata && (
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {pendingMp3Metadata.format}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {pendingMp3Metadata
                        ? `${pendingMp3Metadata.detectedFieldsCount} ${
                            pendingMp3Metadata.detectedFieldsCount === 1 ? 'campo detectado' : 'campos detectados'
                          } (${
                            [
                              pendingMp3Metadata.title && 'Título',
                              pendingMp3Metadata.lyrics && 'Letra',
                              pendingMp3Metadata.lrc && 'Sincronización LRC',
                              pendingMp3Metadata.key && 'Tono',
                              pendingMp3Metadata.tempo && 'Tempo'
                            ]
                              .filter(Boolean)
                              .join(', ') || 'Metadatos disponibles'
                          })`
                        : 'Inspecciona y compara en paralelo los metadatos y letras de tu archivo.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void onOpenMp3Comparison()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--bg-surface)] border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer shadow-xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Comparar metadatos en paralelo</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                onAudioFileChosen(e.dataTransfer.files[0]);
              }
            }}
            onClick={onRequestAudioUpload}
            className="p-8 text-center rounded-lg border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer space-y-2"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <h4 className="font-serif font-bold text-xs text-[var(--text-primary)]">
              Arrastra o pulsa aquí para subir tu maqueta o nota de voz
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">Formatos soportados: MP3, WAV, M4A, OGG.</p>
          </div>
        )}
      </div>

      {/* Unified Audio Studio Switcher */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-xs">
        <div
          role="tablist"
          aria-label="Herramientas de estudio de audio"
          className="grid grid-cols-2 p-1 gap-1 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={audioStudioMode === 'analyzer'}
            onClick={() => onAudioStudioModeChange('analyzer')}
            className={`min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
              audioStudioMode === 'analyzer'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Wand2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="truncate">Armonía, Ritmo y Acordes</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={audioStudioMode === 'transcription'}
            onClick={() => onAudioStudioModeChange('transcription')}
            className={`min-h-[44px] sm:min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
              audioStudioMode === 'transcription'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Mic className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="truncate">Transcripción de Voz</span>
          </button>
        </div>

        {audioStudioMode === 'analyzer' ? (
          <div className="p-4 sm:p-5">
            <Suspense
              fallback={
                <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                  Cargando analizador armónico...
                </div>
              }
            >
              <AudioAnalyzerSection
                embedded={true}
                onRequestAudioUpload={onRequestAudioUpload}
                onApplyDetection={onApplyAudioDetection}
                onInsertChordsIntoLyrics={onInsertDetectedChords}
                canUndoInsertChords={canUndoChordInsertion}
                onUndoInsertChords={onUndoChordInsertion}
                savedAudioAnalysis={savedAudioAnalysis || undefined}
                currentKey={keySignature}
                currentTempo={tempo}
                currentAudioUrl={audioUrl}
                driveFileId={driveFileId}
                driveFileName={driveFileName}
                onAudioFileSelected={onAudioFileChosen}
                externalAudioFile={activeAudioFile}
              />
            </Suspense>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center font-bold">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                      Transcripción de Voz Cantada
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Convierte el audio cantado a versos con marcas de tiempo.
                    </p>
                  </div>
                </div>

                <div className="text-[11px] font-mono">
                  {transcriptionEngine === 'local_whisper' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" />
                      <span>100% Local / Seguro</span>
                    </span>
                  ) : hasServerApiKey ? (
                    <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      <Key className="w-3 h-3" />
                      <span>GEMINI_API_KEY Configurada</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      <AlertCircle className="w-3 h-3" />
                      <span>Sin clave en servidor</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Selecciona el motor de transcripción:
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-surface-subtle)] rounded-lg border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => onTranscriptionEngineChange('local_whisper')}
                    className={`flex flex-col items-start p-2 rounded-md transition-colors text-left cursor-pointer ${
                      transcriptionEngine === 'local_whisper'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-medium)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Whisper Local</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      En navegador · 100% Privado · Sin API
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTranscriptionEngineChange('backend_gemini')}
                    className={`flex flex-col items-start p-2 rounded-md transition-colors text-left cursor-pointer ${
                      transcriptionEngine === 'backend_gemini'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-medium)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Cloud className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Gemini AI</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5">API Nube · Máxima precisión</span>
                  </button>
                </div>
              </div>

              {transcriptionEngine === 'local_whisper' ? (
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--text-primary)]">Idioma esperado:</span>
                    <select
                      value={transcriptionLanguage}
                      onChange={(e) => onTranscriptionLanguageChange(e.target.value as 'spanish' | 'english' | 'auto')}
                      className="text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none cursor-pointer"
                    >
                      <option value="spanish">Español (Recomendado)</option>
                      <option value="english">Inglés</option>
                      <option value="auto">Detección automática</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Ejecuta el modelo <strong>Whisper Tiny</strong> directamente en tu navegador usando WebAssembly / WebGPU. El audio de tu maqueta{' '}
                    <strong>nunca sale de tu dispositivo</strong>, no consume cuotas y funciona sin necesidad de secretos ni claves de API.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2 text-xs">
                  {hasServerApiKey === false && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] space-y-1">
                      <div className="font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Clave GEMINI_API_KEY no detectada</span>
                      </div>
                      <p>
                        No se ha detectado la variable de entorno en el servidor. Para una experiencia segura y sin errores, recomendamos utilizar el motor{' '}
                        <strong>Whisper Local</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => onTranscriptionEngineChange('local_whisper')}
                        className="font-bold underline text-[var(--accent-primary)] hover:opacity-80 cursor-pointer block pt-0.5"
                      >
                        Usar Whisper Local (listo para procesar de inmediato)
                      </button>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={backendConsent}
                      onChange={(e) => onBackendConsentChange(e.target.checked)}
                      className="rounded accent-[var(--accent-primary)]"
                    />
                    <span>Autorizo procesar el audio mediante el proxy seguro del servidor con Gemini AI</span>
                  </label>
                </div>
              )}

              {transcriptionProgress && (
                <div className="p-2.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-xs flex items-center gap-2 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-ping shrink-0" />
                  <span className="font-mono text-[11px] break-all">{transcriptionProgress}</span>
                </div>
              )}

              {transcriptionError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                  {transcriptionError}
                </div>
              )}

              {lastTranscriptionResult && (
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[var(--text-primary)] font-semibold">
                      Resultado ({lastTranscriptionResult.lines.length} versos):
                    </span>
                    <span className="text-[var(--accent-primary)] uppercase text-[10px] font-bold">
                      {lastTranscriptionResult.engine === 'local_whisper' ? 'Whisper Local' : 'Gemini AI'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[var(--bg-surface)] text-xs font-mono max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {lastTranscriptionResult.text}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onApplyTranscribedLyrics(true)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--accent-primary)] text-[var(--accent-text)] cursor-pointer"
                    >
                      Reemplazar letra
                    </button>
                    <button
                      type="button"
                      onClick={() => onApplyTranscribedLyrics(false)}
                      className="px-2.5 py-1 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] cursor-pointer"
                    >
                      Añadir al final
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onRunTranscription}
              disabled={isTranscribing || !activeAudioFile || (transcriptionEngine === 'backend_gemini' && !backendConsent)}
              className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {transcriptionEngine === 'local_whisper' ? (
                <Cpu className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
              <span>
                {isTranscribing
                  ? 'Procesando transcripción...'
                  : transcriptionEngine === 'local_whisper'
                  ? 'Transcribir con Whisper Local'
                  : 'Transcribir con Gemini AI'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
