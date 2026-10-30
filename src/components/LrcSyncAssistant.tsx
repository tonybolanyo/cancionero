import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Undo2,
  Check,
  Save,
  Download,
  Copy,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Volume2,
  AlertCircle,
  HelpCircle,
  X
} from 'lucide-react';
import { SyncedLyricLine, LrcMetadata, formatLrcTimestamp, downloadFile } from '../types/lyrics';
import { serializeToLrc, createLrcBlob } from '../lib/lyrics/parseLrc';
import { createVttBlob } from '../lib/lyrics/toVtt';

export interface LrcSyncAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  rawLyrics: string;
  existingLines?: SyncedLyricLine[];
  currentTime: number;
  duration?: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  songTitle: string;
  songArtist?: string;
  metadata?: LrcMetadata;
  onSaveSyncedLyrics: (lines: SyncedLyricLine[], rawLrc: string) => void;
}

interface StampingLine {
  id: string;
  text: string;
  timestamp: number | null; // null = aún no estampada
}

/**
 * Prepara las líneas de texto lírico a partir de texto markdown o texto plano
 */
function prepareLinesFromText(lyricsText: string): StampingLine[] {
  if (!lyricsText) return [];
  const rawLines = lyricsText.split(/\r?\n/);
  const result: StampingLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    // Omitir líneas vacías
    if (!trimmed) continue;
    // Omitir cabeceras markdown puras como '## Estribillo' o convertirlas en marcas de sección
    if (trimmed.startsWith('#')) {
      continue;
    }
    // Quitar marcas LRC previas si las tuviera para empezar limpio
    const cleanText = trimmed.replace(/^\[\d{1,2}:[0-5]?\d(?:\.\d{1,3})?\]\s*/, '');
    if (!cleanText) continue;

    result.push({
      id: `stamp-line-${result.length}-${Date.now()}`,
      text: cleanText,
      timestamp: null
    });
  }

  return result;
}

export const LrcSyncAssistant: React.FC<LrcSyncAssistantProps> = ({
  isOpen,
  onClose,
  rawLyrics,
  existingLines,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onTogglePlay,
  songTitle,
  songArtist = 'Tony',
  metadata,
  onSaveSyncedLyrics
}) => {
  // Lista de líneas a estampar
  const [lines, setLines] = useState<StampingLine[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [stampFlash, setStampFlash] = useState<boolean>(false);
  const [copiedLrc, setCopiedLrc] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // Inicializar líneas al abrir
  useEffect(() => {
    if (isOpen) {
      if (existingLines && existingLines.length > 0) {
        // Cargar marcas existentes
        setLines(
          existingLines.map((l, idx) => ({
            id: l.id || `line-${idx}`,
            text: l.text,
            timestamp: l.time
          }))
        );
        // Buscar el primer verso sin estampar o posicionarse al inicio
        const firstUnstamped = existingLines.findIndex(l => l.time === undefined || l.time === null);
        setCurrentIndex(firstUnstamped >= 0 ? firstUnstamped : 0);
      } else {
        // Preparar desde la letra en bruto
        const prepared = prepareLinesFromText(rawLyrics);
        setLines(prepared);
        setCurrentIndex(0);
      }
      setSavedSuccess(false);
    }
  }, [isOpen, rawLyrics, existingLines]);

  // Estampar la marca actual con el currentTime del reproductor
  const handleStampCurrent = useCallback(() => {
    if (currentIndex >= lines.length) return;

    // Estampar el tiempo actual redondeado a centésimas
    const stampedTime = Math.max(0, Math.round(currentTime * 100) / 100);

    setLines(prev => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        timestamp: stampedTime
      };
      return updated;
    });

    // Feedback visual breve
    setStampFlash(true);
    setTimeout(() => setStampFlash(false), 200);

    // Avanzar a la siguiente línea
    setCurrentIndex(prev => Math.min(prev + 1, lines.length));
  }, [currentIndex, currentTime, lines.length]);

  // Deshacer la última marca de tiempo
  const handleUndo = useCallback(() => {
    if (currentIndex <= 0 && (!lines[0] || lines[0].timestamp === null)) return;

    const targetIdx = currentIndex > 0 ? currentIndex - 1 : 0;
    setLines(prev => {
      const updated = [...prev];
      updated[targetIdx] = {
        ...updated[targetIdx],
        timestamp: null
      };
      return updated;
    });

    setCurrentIndex(targetIdx);

    // Si retrocedemos a un verso con marca previa, podemos recolocar el audio medio segundo antes
    const previousStamp = lines[targetIdx - 1]?.timestamp;
    if (previousStamp !== undefined && previousStamp !== null) {
      onSeek(Math.max(0, previousStamp - 0.2));
    }
  }, [currentIndex, lines, onSeek]);

  // Reiniciar todas las marcas de tiempo
  const handleReset = () => {
    setLines(prev => prev.map(l => ({ ...l, timestamp: null })));
    setCurrentIndex(0);
    onSeek(0);
  };

  // Ajuste fino en milisegundos (+/- delta) para una línea específica
  const handleNudgeTimestamp = (index: number, deltaSeconds: number) => {
    setLines(prev => {
      const updated = [...prev];
      const cur = updated[index]?.timestamp;
      if (cur !== null && cur !== undefined) {
        updated[index] = {
          ...updated[index],
          timestamp: Math.max(0, Math.round((cur + deltaSeconds) * 100) / 100)
        };
      }
      return updated;
    });
  };

  // Saltar o seleccionar directamente una línea para estamparla
  const handleSelectLineToStamp = (idx: number) => {
    setCurrentIndex(idx);
    const stamped = lines[idx]?.timestamp;
    if (stamped !== null && stamped !== undefined) {
      onSeek(stamped);
    }
  };

  // Manejo de atajos de teclado globales mientras el asistente está activo
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en algún input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        handleStampCurrent();
      } else if (e.code === 'Backspace') {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleStampCurrent, handleUndo, onTogglePlay, onClose]);

  // Auto-scroll del visor para mantener la línea activa en el foco
  useEffect(() => {
    if (!listContainerRef.current) return;
    const activeEl = listContainerRef.current.querySelector(`[data-stamp-index="${currentIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIndex]);

  // Generar objeto SyncedLyricLine[] con las líneas válidas estampadas
  const getStampedSyncedLines = (): SyncedLyricLine[] => {
    return lines
      .filter(l => l.timestamp !== null)
      .map((l, idx) => ({
        id: `lrc-${idx}-${Math.round((l.timestamp || 0) * 100)}`,
        time: l.timestamp || 0,
        text: l.text
      }))
      .sort((a, b) => a.time - b.time);
  };

  // Guardar en la canción
  const handleApplyToSong = () => {
    const stamped = getStampedSyncedLines();
    const lrcText = serializeToLrc(stamped, {
      title: metadata?.title || songTitle,
      artist: metadata?.artist || songArtist,
      by: 'Cancionero Tap-to-Sync Assistant'
    });

    onSaveSyncedLyrics(stamped, lrcText);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleExportLrc = () => {
    const stamped = getStampedSyncedLines();
    const blob = createLrcBlob(stamped, {
      title: metadata?.title || songTitle,
      artist: metadata?.artist || songArtist,
      by: 'Cancionero'
    });
    downloadFile(blob, `${songTitle.toLowerCase().replace(/\s+/g, '-')}-sincronizada.lrc`);
  };

  const handleExportVtt = () => {
    const stamped = getStampedSyncedLines();
    const blob = createVttBlob(stamped, {
      title: metadata?.title || songTitle,
      artist: metadata?.artist || songArtist
    });
    downloadFile(blob, `${songTitle.toLowerCase().replace(/\s+/g, '-')}-subtitulos.vtt`);
  };

  const handleCopyLrcText = () => {
    const stamped = getStampedSyncedLines();
    const text = serializeToLrc(stamped, {
      title: metadata?.title || songTitle,
      artist: metadata?.artist || songArtist
    });
    navigator.clipboard.writeText(text);
    setCopiedLrc(true);
    setTimeout(() => setCopiedLrc(false), 2000);
  };

  if (!isOpen) return null;

  const stampedCount = lines.filter(l => l.timestamp !== null).length;
  const totalCount = lines.length;
  const isFinished = totalCount > 0 && stampedCount === totalCount;
  const currentLine = currentIndex < lines.length ? lines[currentIndex] : null;
  const nextLine = currentIndex + 1 < lines.length ? lines[currentIndex + 1] : null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                  Asistente de Sincronización en Vivo (Tap-to-Sync)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                  {stampedCount} / {totalCount} versos
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Pulsa la tecla <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold text-[var(--text-primary)]">Espacio</kbd> al inicio de cada verso mientras suena la canción.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
              title="Atajos de teclado"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
              title="Cerrar asistente"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Shortcuts Cheat Sheet Banner (Collapsible) */}
        {showShortcutsHelp && (
          <div className="p-3 bg-[var(--accent-subtle)]/40 border-b border-[var(--accent-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 font-mono">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-[10px] font-bold">Espacio</kbd>
                <span>o</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-[10px] font-bold">Enter</kbd>
                <span>: Estampar y avanzar</span>
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-[10px] font-bold">Backspace</kbd>
                <span>: Deshacer línea anterior</span>
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-[10px] font-bold">P</kbd>
                <span>: Pausar / Continuar audio</span>
              </span>
            </div>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="text-[11px] text-[var(--text-muted)] hover:underline"
            >
              Ocultar
            </button>
          </div>
        )}

        {/* Hero Interactive Tap Area & Prominent Teleprompter Cue */}
        <div className="p-5 sm:p-7 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-col items-center justify-center text-center relative">
          {/* Audio Playback & Progress Status Bar */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onTogglePlay}
              className="w-11 h-11 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
              title={isPlaying ? 'Pausar audio (Tecla P)' : 'Iniciar audio (Tecla P)'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 ml-0.5 fill-current" />
              )}
            </button>

            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {formatLrcTimestamp(currentTime)}
              </span>
              {duration ? (
                <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                  / {formatLrcTimestamp(duration)}
                </span>
              ) : null}
            </div>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isPlaying
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isPlaying ? 'Audio en marcha' : 'En pausa'}</span>
            </span>
          </div>

          {/* Current Line Cue */}
          <div className="w-full max-w-2xl py-3 px-4 min-h-[110px] flex flex-col items-center justify-center">
            {isFinished ? (
              <div className="text-center space-y-2 animate-fadeIn">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-[var(--text-primary)]">
                  ¡Todos los versos han sido sincronizados!
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Revisa los tiempos en la lista inferior, afina con los botones +/- o guarda directamente en la canción.
                </p>
              </div>
            ) : currentLine ? (
              <div className="space-y-1.5 w-full">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold">
                  Verso actual ({currentIndex + 1} de {totalCount})
                </span>
                <p className={`font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)] transition-transform duration-150 ${
                  stampFlash ? 'scale-105 text-[var(--accent-primary)]' : ''
                }`}>
                  {currentLine.text}
                </p>
                {nextLine && (
                  <p className="text-xs sm:text-sm font-serif text-[var(--text-muted)] italic truncate">
                    Siguiente: {nextLine.text}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No hay líneas disponibles para sincronizar.</p>
            )}
          </div>

          {/* Giant Tap Button */}
          <div className="flex items-center gap-3 mt-3 w-full max-w-md justify-center">
            <button
              onClick={handleUndo}
              disabled={currentIndex === 0 && (!lines[0] || lines[0].timestamp === null)}
              className="px-3.5 py-3 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="Deshacer última marca y retroceder (Tecla Backspace)"
            >
              <Undo2 className="w-4 h-4" />
              <span>Deshacer</span>
            </button>

            <button
              onClick={handleStampCurrent}
              disabled={isFinished}
              className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer select-none ${
                stampFlash
                  ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30'
                  : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Estampar tiempo actual en este verso y pasar al siguiente (Barra Espaciadora)"
            >
              <Clock className="w-5 h-5" />
              <span>Marcar Verso [Espacio]</span>
            </button>

            <button
              onClick={handleReset}
              className="px-3 py-3 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:text-red-500 text-[var(--text-muted)] transition-colors cursor-pointer text-xs font-semibold shadow-xs"
              title="Reiniciar todas las marcas de tiempo a cero"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive List of All Lines with Fine-Tuning */}
        <div
          ref={listContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1.5 divide-y divide-[var(--border-subtle)]/40"
          style={{ minHeight: '220px', maxHeight: '420px' }}
        >
          {lines.map((line, idx) => {
            const isCurrent = idx === currentIndex;
            const isStamped = line.timestamp !== null;

            return (
              <div
                key={line.id}
                data-stamp-index={idx}
                className={`pt-2 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-xl transition-colors ${
                  isCurrent
                    ? 'bg-[var(--accent-subtle)] border border-[var(--accent-border)]'
                    : isStamped
                    ? 'hover:bg-[var(--bg-surface-subtle)]'
                    : 'opacity-60 hover:opacity-90'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-[11px] font-mono text-[var(--text-muted)] w-6 text-right shrink-0">
                    {idx + 1}.
                  </span>

                  {/* Timestamp Badge / Stamp trigger */}
                  <button
                    onClick={() => handleSelectLineToStamp(idx)}
                    className={`px-2 py-0.5 rounded font-mono text-xs tabular-nums font-semibold shrink-0 cursor-pointer transition-colors ${
                      isStamped
                        ? 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)]'
                        : isCurrent
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]'
                    }`}
                    title={isStamped ? `Escuchar desde ${formatLrcTimestamp(line.timestamp!)}` : 'Seleccionar para marcar'}
                  >
                    {isStamped ? formatLrcTimestamp(line.timestamp!) : '--:--.--'}
                  </button>

                  <span className={`font-serif text-xs sm:text-sm truncate ${
                    isCurrent ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
                  }`}>
                    {line.text}
                  </span>
                </div>

                {/* Fine-Tuning Nudge Controls (+/- 100ms) */}
                {isStamped && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleNudgeTimestamp(idx, -0.1)}
                      className="px-1.5 py-0.5 rounded bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer"
                      title="Adelantar 100ms (-0.1s)"
                    >
                      -100ms
                    </button>
                    <button
                      onClick={() => handleNudgeTimestamp(idx, 0.1)}
                      className="px-1.5 py-0.5 rounded bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer"
                      title="Retrasar 100ms (+0.1s)"
                    >
                      +100ms
                    </button>
                    <button
                      onClick={() => line.timestamp !== null && onSeek(line.timestamp)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-primary)] cursor-pointer"
                      title="Reproducir desde aquí"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportLrc}
              disabled={stampedCount === 0}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5 font-medium"
              title="Descargar archivo LRC local"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar .LRC</span>
            </button>

            <button
              onClick={handleExportVtt}
              disabled={stampedCount === 0}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5 font-medium"
              title="Descargar archivo WebVTT"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar .VTT</span>
            </button>

            <button
              onClick={handleCopyLrcText}
              disabled={stampedCount === 0}
              className="p-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer disabled:opacity-40"
              title="Copiar texto LRC al portapapeles"
            >
              {copiedLrc ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApplyToSong}
              disabled={stampedCount === 0}
              className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                savedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Guardado con éxito!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Aplicar a la Canción ({stampedCount} versos)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
