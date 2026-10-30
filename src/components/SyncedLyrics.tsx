import React, { useRef, useState } from 'react';
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
  Copy
} from 'lucide-react';
import { LrcMetadata, SyncedLyricLine, formatLrcTimestamp, downloadFile } from '../types/lyrics';
import { parseLrc, createLrcBlob } from '../lib/lyrics/parseLrc';
import { createVttBlob } from '../lib/lyrics/toVtt';
import { useSyncedLyrics } from '../hooks/useSyncedLyrics';
import { parseLyricLine } from '../utils/markdownParser';
import { LrcSyncAssistant } from './LrcSyncAssistant';

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

  const { activeIndex, lineProgress } = useSyncedLyrics({
    lines,
    currentTime,
    autoScroll,
    scrollContainerRef: containerRef,
    scrollOffsetFraction: 0.38
  });

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
    const lrcText = lines.map(l => `[${formatLrcTimestamp(l.time)}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(lrcText);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
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
