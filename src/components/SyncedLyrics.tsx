import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Download,
  FileText,
  Upload,
  Clock,
  Sparkles,
  Music,
  Check,
  AlertCircle,
  Copy,
  Mic,
  Cpu,
  Cloud,
  PencilLine,
  Save,
  LoaderCircle,
  Info
} from 'lucide-react';
import { LrcMetadata, SyncedLyricLine, formatLrcTimestamp, downloadFile } from '../types/lyrics';
import { parseLrc, createLrcBlob, serializeToLrc } from '../lib/lyrics/parseLrc';
import { createVttBlob } from '../lib/lyrics/toVtt';
import { useSyncedLyrics } from '../hooks/useSyncedLyrics';
import { parseLyricLine } from '../utils/markdownParser';
import { LrcSyncAssistant } from './LrcSyncAssistant';
import { LyricsTranscriptionService } from '../services/lyricsTranscriptionService';
import { LocalTranscriptionSupport, LyricsTranscriptionResult } from '../types/transcription';

export interface SyncedLyricsProps {
  lines: SyncedLyricLine[];
  currentTime: number;
  duration?: number;
  isPlaying?: boolean;
  onSeek?: (timeInSeconds: number) => void;
  onTogglePlay?: () => void;
  metadata?: LrcMetadata;
  songTitle?: string;
  songArtist?: string;
  showChords?: boolean;
  fontSize?: 'sm' | 'base' | 'lg';
  rawLyrics?: string;
  onUpdateLyrics?: (newLines: SyncedLyricLine[], rawLrc: string, metadata?: LrcMetadata) => void;
  onSaveToSong?: (newLines: SyncedLyricLine[], rawLrc: string) => void;
}

export const SyncedLyrics: React.FC<SyncedLyricsProps> = ({
  lines,
  currentTime,
  duration,
  isPlaying = false,
  onSeek,
  onTogglePlay,
  metadata,
  songTitle,
  songArtist,
  showChords = true,
  fontSize = 'base',
  rawLyrics,
  onUpdateLyrics,
  onSaveToSong
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<'lrc' | 'vtt' | null>(null);
  const [copiedRaw, setCopiedRaw] = useState<boolean>(false);
  const [transcriptionMode, setTranscriptionMode] = useState<'manual' | 'local' | 'backend'>('manual');
  const [transcriptionFile, setTranscriptionFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(null);
  const [backendConsent, setBackendConsent] = useState<boolean>(false);
  const [allowWasmFallback, setAllowWasmFallback] = useState<boolean>(false);
  const [localSupport, setLocalSupport] = useState<LocalTranscriptionSupport | null>(null);
  const [editableLines, setEditableLines] = useState<SyncedLyricLine[]>(lines);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const { activeIndex, lineProgress } = useSyncedLyrics({
    lines,
    currentTime,
    autoScroll,
    scrollContainerRef: containerRef,
    scrollOffsetFraction: 0.38
  });

  useEffect(() => {
    setEditableLines(lines);
  }, [lines]);

  useEffect(() => {
    let cancelled = false;
    const loadSupport = async () => {
      try {
        const support = await LyricsTranscriptionService.getLocalSupport();
        if (!cancelled) {
          setLocalSupport(support);
        }
      } catch (err) {
        if (!cancelled) {
          setLocalSupport({
            hasWebGpu: false,
            canRunLocal: false,
            reason: err instanceof Error ? err.message : 'No fue posible inicializar capacidades locales.'
          });
        }
      }
    };
    void loadSupport();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLineClick = (lineTime: number) => {
    if (onSeek) {
      onSeek(lineTime);
    }
  };

  const handleExportLrc = () => {
    try {
      const blob = createLrcBlob(lines, {
        title: metadata?.title || songTitle,
        artist: metadata?.artist || songArtist,
        album: metadata?.album,
        by: metadata?.by || 'Cancionero'
      });
      const filename = `${(songTitle || metadata?.title || 'letra-sincronizada').toLowerCase().replace(/\s+/g, '-')}.lrc`;
      downloadFile(blob, filename);
      setDownloadSuccess('lrc');
      setTimeout(() => setDownloadSuccess(null), 2000);
    } catch (err) {
      console.error('Error al exportar LRC:', err);
    }
  };

  const handleExportVtt = () => {
    try {
      const blob = createVttBlob(lines, {
        title: metadata?.title || songTitle,
        artist: metadata?.artist || songArtist,
        album: metadata?.album
      });
      const filename = `${(songTitle || metadata?.title || 'subtitulos-web').toLowerCase().replace(/\s+/g, '-')}.vtt`;
      downloadFile(blob, filename);
      setDownloadSuccess('vtt');
      setTimeout(() => setDownloadSuccess(null), 2000);
    } catch (err) {
      console.error('Error al exportar WebVTT:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        processLrcContent(content);
      }
    };
    reader.onerror = () => {
      setImportError('Error al leer el archivo local.');
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const processLrcContent = (content: string) => {
    setImportError(null);
    const parsed = parseLrc(content);

    if (parsed.lines.length === 0) {
      setImportError('No se encontraron líneas con marcas de tiempo [mm:ss.xx] válidas en el archivo.');
      return;
    }

    if (onUpdateLyrics) {
      onUpdateLyrics(parsed.lines, content, parsed.metadata);
    }
    setIsImportModalOpen(false);
    setPasteText('');
  };

  const handleCopyRawLrc = () => {
    if (lines.length === 0) return;
    const lrcText = serializeToLrc(lines, metadata);
    navigator.clipboard.writeText(lrcText);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleTranscriptionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] || null;
    setTranscriptionFile(next);
    setTranscriptionError(null);
    setTranscriptionNotice(null);
    event.target.value = '';
  };

  const applyTranscriptionResult = (result: LyricsTranscriptionResult) => {
    if (!onUpdateLyrics) return;
    const lrcMetadata: LrcMetadata = {
      ...metadata,
      title: metadata?.title || songTitle,
      artist: metadata?.artist || songArtist,
      by:
        result.engine === 'local_whisper'
          ? `Cancionero ASR local (${result.model || 'Whisper'})`
          : 'Cancionero ASR backend'
    };
    const lrcText = serializeToLrc(result.lines, lrcMetadata);
    onUpdateLyrics(result.lines, lrcText, lrcMetadata);
  };

  const handleLocalTranscription = async () => {
    if (!onUpdateLyrics) return;
    if (!transcriptionFile) {
      setTranscriptionError('Primero selecciona un archivo de audio local (.mp3 o .wav).');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionNotice(null);
    try {
      const result = await LyricsTranscriptionService.transcribeLocalFromFile(transcriptionFile, {
        allowWasmFallback,
        language: 'spanish'
      }, (message, status) => {
        setTranscriptionNotice(`[${status}] ${message}`);
      });
      if (result.lines.length === 0) {
        throw new Error('No se detectó letra cantada utilizable para generar líneas sincronizadas.');
      }
      applyTranscriptionResult(result);
      setTranscriptionNotice(
        result.device === 'webgpu'
          ? 'Transcripción local completada con WebGPU.'
          : 'Transcripción local completada en WASM (modo lento).'
      );
      setIsEditing(true);
      setTranscriptionMode('manual');
    } catch (err) {
      setTranscriptionError(err instanceof Error ? err.message : 'Falló la transcripción local.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleBackendTranscription = async () => {
    if (!onUpdateLyrics) return;
    if (!transcriptionFile) {
      setTranscriptionError('Primero selecciona un archivo de audio local (.mp3 o .wav).');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionNotice(null);
    try {
      const result = await LyricsTranscriptionService.transcribeWithBackendFromFile(transcriptionFile, backendConsent);
      if (result.lines.length === 0) {
        throw new Error('El backend no devolvió segmentos temporales utilizables.');
      }
      applyTranscriptionResult(result);
      setTranscriptionNotice('Transcripción backend aplicada. Revisa y corrige antes de guardar.');
      setIsEditing(true);
      setTranscriptionMode('manual');
    } catch (err) {
      setTranscriptionError(err instanceof Error ? err.message : 'Falló la transcripción por backend.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleEditableLineChange = (
    lineId: string,
    field: 'text' | 'time',
    value: string
  ) => {
    setEditableLines((previous) =>
      previous.map((line) => {
        if (line.id !== lineId) return line;
        if (field === 'text') {
          return { ...line, text: value };
        }
        const parsedTime = Number(value);
        return {
          ...line,
          time: Number.isFinite(parsedTime) ? Math.max(0, parsedTime) : line.time
        };
      })
    );
  };

  const handleApplyLineEdits = () => {
    if (!onUpdateLyrics) return;
    const sorted = [...editableLines]
      .map((line) => ({
        ...line,
        text: line.text.trim(),
        time: Number(Math.max(0, line.time).toFixed(2))
      }))
      .filter((line) => line.text.length > 0)
      .sort((a, b) => a.time - b.time);

    const lrcText = serializeToLrc(sorted, metadata);
    onUpdateLyrics(sorted, lrcText, metadata);
    if (onSaveToSong) {
      onSaveToSong(sorted, lrcText);
    }
    setTranscriptionNotice('Edición aplicada a la letra sincronizada.');
    setIsEditing(false);
  };

  const renderLineTextWithChords = (text: string, isCurrent: boolean) => {
    if (!text.trim()) return <span className="text-[var(--text-muted)] italic">···</span>;

    // Si tiene acordes y está activado showChords
    if (showChords && /\[([A-G][#b]?[^\]]*)\]/.test(text)) {
      const segments = parseLyricLine(text);
      return (
        <span className="inline-flex flex-wrap items-baseline gap-1">
          {segments.map((seg, sIdx) => (
            <span key={sIdx} className="inline-flex items-baseline gap-0.5">
              {seg.chord && (
                <span className={`font-mono text-xs font-bold px-1 py-0.5 rounded ${
                  isCurrent
                    ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                    : 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]'
                }`}>
                  {seg.chord}
                </span>
              )}
              {seg.text && <span>{seg.text}</span>}
            </span>
          ))}
        </span>
      );
    }

    // Limpiar corchetes si showChords está desactivado
    const clean = showChords ? text : text.replace(/\[[^\]]+\]/g, '');
    return <span>{clean}</span>;
  };

  return (
    <div className="flex flex-col h-full w-full rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] overflow-hidden">
      {/* Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs">
        <div className="flex items-center gap-3">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className="w-8 h-8 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-colors"
              title={isPlaying ? 'Pausar reproducción' : 'Iniciar reproducción'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
              )}
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[var(--text-primary)] tabular-nums">
              {formatLrcTimestamp(currentTime)}
            </span>
            {duration && duration > 0 ? (
              <>
                <span className="text-[var(--text-muted)]">/</span>
                <span className="font-mono text-xs text-[var(--text-secondary)] tabular-nums">
                  {formatLrcTimestamp(duration)}
                </span>
              </>
            ) : null}
          </div>

          {metadata?.offset ? (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[10px] font-mono text-[var(--accent-primary)]">
              <Clock className="w-3 h-3" />
              Offset: {metadata.offset > 0 ? `+${metadata.offset}` : metadata.offset}ms
            </span>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tap-to-sync Live Assistant */}
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="px-2.5 py-1 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Abrir Asistente para estampar marcas de tiempo en vivo pulsando la barra espaciadora"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Grabar Marcas [Espacio]</span>
          </button>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              autoScroll
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Auto-scroll inteligente hacia la línea activa durante la reproducción"
          >
            <Sparkles className="w-3 h-3" />
            <span>{autoScroll ? 'Auto-scroll: Activo' : 'Auto-scroll: Off'}</span>
          </button>

          {/* Export LRC */}
          <button
            onClick={handleExportLrc}
            disabled={lines.length === 0}
            className="px-2.5 py-1 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="Descargar archivo .LRC sincronizado"
          >
            {downloadSuccess === 'lrc' ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">.LRC</span>
          </button>

          {/* Export VTT */}
          <button
            onClick={handleExportVtt}
            disabled={lines.length === 0}
            className="px-2.5 py-1 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="Descargar subtítulos WebVTT (.vtt)"
          >
            {downloadSuccess === 'vtt' ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">.VTT</span>
          </button>

          {/* Copy LRC */}
          <button
            onClick={handleCopyRawLrc}
            disabled={lines.length === 0}
            className="p-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer disabled:opacity-40"
            title="Copiar texto LRC completo al portapapeles"
          >
            {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Import / Paste LRC */}
          {onUpdateLyrics && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-2.5 py-1 rounded-md bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              title="Importar archivo .LRC o pegar texto con marcas de tiempo"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar LRC</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".lrc,.txt,.vtt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Section: Lyrics Transcription */}
      {onUpdateLyrics && (
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 sm:px-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Transcripción de letra</span>
            </h4>
            <button
              onClick={() => setIsEditing((prev) => !prev)}
              className="px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer flex items-center gap-1"
              title="Editar texto y tiempos de cada línea"
            >
              <PencilLine className="w-3 h-3" />
              <span>{isEditing ? 'Cerrar editor' : 'Editar líneas'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTranscriptionMode('manual')}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                transcriptionMode === 'manual'
                  ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <Upload className="w-3.5 h-3.5 inline mr-1" />
              Cargar LRC manual
            </button>
            <button
              onClick={() => setTranscriptionMode('local')}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                transcriptionMode === 'local'
                  ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 inline mr-1" />
              Transcribir local
            </button>
            <button
              onClick={() => setTranscriptionMode('backend')}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                transcriptionMode === 'backend'
                  ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 inline mr-1" />
              Backend opcional
            </button>
          </div>

          {transcriptionMode !== 'manual' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <label className="px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] cursor-pointer text-[var(--text-secondary)]">
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a"
                    onChange={handleTranscriptionFileChange}
                    className="hidden"
                  />
                  Seleccionar audio para transcribir
                </label>
                <span className="text-[var(--text-muted)]">
                  {transcriptionFile ? transcriptionFile.name : 'Sin archivo seleccionado'}
                </span>
              </div>

              {transcriptionMode === 'local' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      Modelo local Whisper ({localSupport?.hasWebGpu ? 'WebGPU disponible' : 'sin WebGPU'}). Sin WebGPU, se recomienda cargar LRC manual o usar backend con consentimiento.
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={allowWasmFallback}
                      onChange={(event) => setAllowWasmFallback(event.target.checked)}
                    />
                    <span>Permitir fallback WASM (más lento, útil para clips cortos).</span>
                  </label>
                  <button
                    onClick={handleLocalTranscription}
                    disabled={isTranscribing || !transcriptionFile}
                    className="px-3 py-1.5 rounded-md bg-[var(--accent-primary)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                  >
                    {isTranscribing ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                    <span>{isTranscribing ? 'Transcribiendo...' : 'Iniciar transcripción local'}</span>
                  </button>
                </div>
              )}

              {transcriptionMode === 'backend' && (
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={backendConsent}
                      onChange={(event) => setBackendConsent(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Acepto enviar este audio al backend para transcripción externa. Sin este consentimiento explícito no se enviará nada.
                    </span>
                  </label>
                  <button
                    onClick={handleBackendTranscription}
                    disabled={isTranscribing || !backendConsent || !transcriptionFile}
                    className="px-3 py-1.5 rounded-md bg-[var(--accent-primary)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                  >
                    {isTranscribing ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                    <span>{isTranscribing ? 'Transcribiendo...' : 'Transcribir vía backend'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {transcriptionError && (
            <div className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-1.5">
              {transcriptionError}
            </div>
          )}
          {transcriptionNotice && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1.5">
              {transcriptionNotice}
            </div>
          )}

          {isEditing && editableLines.length > 0 && (
            <div className="border border-[var(--border-subtle)] rounded-lg p-2.5 bg-[var(--bg-surface-subtle)] space-y-2">
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {editableLines.map((line) => (
                  <div key={line.id} className="grid grid-cols-[96px_1fr] gap-2 items-center">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.time}
                      onChange={(event) => handleEditableLineChange(line.id, 'time', event.target.value)}
                      className="px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-input)] text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={line.text}
                      onChange={(event) => handleEditableLineChange(line.id, 'text', event.target.value)}
                      className="px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-input)] text-xs"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleApplyLineEdits}
                className="px-3 py-1.5 rounded-md bg-[var(--accent-primary)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Aplicar edición de texto y tiempos</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lines Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-2 select-text scroll-smooth"
        style={{ maxHeight: '550px', minHeight: '320px' }}
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] mb-3">
              <Music className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Sin letra sincronizada disponible
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-md mb-4 leading-relaxed">
              Puedes cargar un archivo .LRC o pegar marcas de tiempo en formato [mm:ss.xx] para seguir la letra en tiempo real sobre el reproductor.
            </p>
            {onUpdateLyrics && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setIsAssistantOpen(true)}
                  className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Grabar Marcas en Vivo (Tap-to-Sync)</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] text-xs font-medium rounded-lg shadow-2xs cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir .LRC</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3.5 py-2 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] text-xs font-medium rounded-lg cursor-pointer transition-colors"
                >
                  Pegar texto
                </button>
              </div>
            )}
          </div>
        ) : (
          lines.map((line, idx) => {
            const isCurrent = idx === activeIndex;
            const isPast = activeIndex >= 0 && idx < activeIndex;

            return (
              <div
                key={line.id}
                data-lyric-index={idx}
                onClick={() => handleLineClick(line.time)}
                className={`group relative flex items-start gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                  isCurrent
                    ? 'bg-[var(--accent-subtle)] border-l-4 border-[var(--accent-primary)] text-[var(--text-primary)] shadow-sm scale-[1.01]'
                    : isPast
                    ? 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] opacity-70'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] opacity-85'
                }`}
              >
                {/* Timestamp Badge (Clickable) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLineClick(line.time);
                  }}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] tabular-nums shrink-0 transition-colors select-none ${
                    isCurrent
                      ? 'bg-[var(--accent-primary)] text-white font-bold'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] group-hover:border-[var(--accent-primary)]'
                  }`}
                  title={`Saltar a ${formatLrcTimestamp(line.time)}`}
                >
                  {formatLrcTimestamp(line.time)}
                </button>

                {/* Line Text */}
                <div
                  className={`flex-1 font-serif leading-relaxed transition-all ${
                    fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
                  } ${isCurrent ? 'font-semibold text-[var(--text-primary)]' : ''}`}
                >
                  {renderLineTextWithChords(line.text, isCurrent)}

                  {/* Active line progress bar */}
                  {isCurrent && isPlaying && (
                    <div className="w-full bg-[var(--accent-border)] h-0.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-[var(--accent-primary)] h-full transition-all duration-100 ease-linear"
                        style={{ width: `${Math.round(lineProgress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal para importar / pegar texto LRC */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Upload className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Importar Letra Sincronizada (LRC)</span>
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer text-xs"
              >
                Cerrar
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Pega aquí el contenido de un archivo <code>.lrc</code> con marcas de tiempo en formato <code>[mm:ss.xx]</code> o selecciona un archivo de tu equipo.
            </p>

            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`[ti:Mi Canción]\n[ar:Tony]\n[00:12.30] Primera frase de la canción\n[00:18.50] Segunda frase con acordes [Am] o texto\n[00:25.00] Estribillo`}
              className="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
            />

            {importError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Seleccionar archivo local</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => processLrcContent(pasteText)}
                  disabled={!pasteText.trim()}
                  className="px-4 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  Procesar y Sincronizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Tap-to-Sync Assistant Modal */}
      <LrcSyncAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        rawLyrics={rawLyrics || lines.map(l => l.text).join('\n')}
        existingLines={lines.length > 0 ? lines : undefined}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={onSeek || (() => {})}
        onTogglePlay={onTogglePlay || (() => {})}
        songTitle={songTitle || 'Canción'}
        songArtist={songArtist}
        metadata={metadata}
        onSaveSyncedLyrics={(newLines, rawLrc) => {
          if (onUpdateLyrics) {
            onUpdateLyrics(newLines, rawLrc, metadata);
          }
          if (onSaveToSong) {
            onSaveToSong(newLines, rawLrc);
          }
        }}
      />
    </div>
  );
};
