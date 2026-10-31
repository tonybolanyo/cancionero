import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  ExternalLink,
  Edit3,
  Download,
  Copy,
  Check,
  Printer,
  FileCode,
  Music,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  History,
  FileDown,
  Clock,
  Trash2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Song } from '../types/song';
import {
  songToMarkdown,
  transposeLyrics,
  transposeChord,
  parseLyricLine,
  getYouTubeEmbedUrl,
  getSpotifyEmbedUrl,
  AccidentalPreference
} from '../utils/markdownParser';
import { exportSongToPdf } from '../utils/pdfGenerator';
import { SyncedLyrics } from './SyncedLyrics';
import { SyncedLyricLine, LrcMetadata } from '../types/lyrics';
import { parseLrc, isLrcContent } from '../lib/lyrics/parseLrc';
import { SAMPLE_LRC_TEXT } from '../data/sampleLrc';
import { StorageService } from '../services/storageService';

interface SongDetailModalProps {
  song: Song;
  onClose: () => void;
  onEdit: (song: Song) => void;
  onDownloadMd: (song: Song) => void;
  isAuthor: boolean;
  onSaveSong?: (song: Song) => void;
  onDeleteSong?: (song: Song) => void;
  onViewHistory?: (song: Song) => void;
  onRenameFile?: (song: Song) => void;
}

export const SongDetailModal: React.FC<SongDetailModalProps> = ({
  song,
  onClose,
  onEdit,
  onDownloadMd,
  isAuthor,
  onSaveSong,
  onDeleteSong,
  onViewHistory,
  onRenameFile
}) => {
  const [semitones, setSemitones] = useState<number>(0);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');
  const [showChords, setShowChords] = useState<boolean>(true);
  const [chordPosition, setChordPosition] = useState<'above' | 'inline'>(() => {
    try {
      const saved = localStorage.getItem('cancionero_chord_position');
      if (saved === 'above' || saved === 'inline') return saved;
    } catch {
      // ignore
    }
    return 'above';
  });
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>(() => {
    try {
      const saved = localStorage.getItem('cancionero_font_size');
      if (saved === 'sm' || saved === 'base' || saved === 'lg') return saved;
    } catch {
      // ignore
    }
    return 'base';
  });
  const [copied, setCopied] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cancionero_detail_maximized') === 'true';
    } catch {
      return false;
    }
  });
  const [activeTab, setActiveTab] = useState<'lyrics' | 'synced_lyrics' | 'markdown' | 'notes'>('lyrics');
  const [syncedLines, setSyncedLines] = useState<SyncedLyricLine[]>([]);
  const [lrcMetadata, setLrcMetadata] = useState<LrcMetadata>({});
  const [, setCustomLrcText] = useState<string>('');

  const toggleMaximized = () => {
    setIsMaximized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cancionero_detail_maximized', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleChordPositionChange = (pos: 'above' | 'inline') => {
    setChordPosition(pos);
    try {
      localStorage.setItem('cancionero_chord_position', pos);
    } catch (err) {
      console.warn('Error al guardar la posición de acordes:', err);
    }
  };

  const handleFontSizeChange = (size: 'sm' | 'base' | 'lg') => {
    setFontSize(size);
    try {
      localStorage.setItem('cancionero_font_size', size);
    } catch (err) {
      console.warn('Error al guardar el tamaño de fuente:', err);
    }
  };
  
  // Auto-scroll state for singing/playing
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [scrollSpeed] = useState<number>(1);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  // Direct Audio player ref
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showConfirmDeleteAudio, setShowConfirmDeleteAudio] = useState(false);
  const [audioDeleteFeedback, setAudioDeleteFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSemitones(0);
    setIsAutoScrolling(false);
    setIsPlayingAudio(false);
    setIsExportingPdf(false);
    setCurrentTime(0);

    // Initial parsing of synced lyrics
    const sourceText = song.lrc || (isLrcContent(song.lyrics) ? song.lyrics : (song.id === 'si-me-pierdo' ? SAMPLE_LRC_TEXT : ''));
    if (sourceText) {
      const parsed = parseLrc(sourceText);
      setSyncedLines(parsed.lines);
      setLrcMetadata(parsed.metadata);
      setCustomLrcText(sourceText);
    } else {
      setSyncedLines([]);
      setLrcMetadata({});
      setCustomLrcText('');
    }
  }, [song.id, song.lrc, song.lyrics]);

  // Synthetic timer for rehearsals when audioUrl is not attached
  useEffect(() => {
    if (!song.audioUrl && isPlayingAudio) {
      const interval = window.setInterval(() => {
        setCurrentTime(t => t + 0.1);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [song.audioUrl, isPlayingAudio]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isAutoScrolling) {
      const step = () => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += scrollSpeed * 0.8;
        }
      };
      const interval = window.setInterval(step, 40);
      scrollIntervalRef.current = interval;
      return () => clearInterval(interval);
    } else {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    }
  }, [isAutoScrolling, scrollSpeed]);

  const rawMarkdown = songToMarkdown(song);
  const currentKey = transposeChord(song.key, semitones, accidentalPreference);
  const displayedLyrics = transposeLyrics(song.lyrics, semitones, accidentalPreference);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(rawMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    try {
      setIsExportingPdf(true);
      exportSongToPdf(song, { showChords, semitones, chordPosition, accidentalPreference });
      setTimeout(() => setIsExportingPdf(false), 1800);
    } catch (err) {
      console.error('Error al exportar canción a PDF:', err);
      setIsExportingPdf(false);
    }
  };

  const youtubeEmbed = getYouTubeEmbedUrl(song.youtubeUrl);
  const spotifyEmbed = getSpotifyEmbedUrl(song.spotifyUrl);

  const toggleAudio = () => {
    if (song.audioUrl && audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play().catch(e => console.warn(e));
        setIsPlayingAudio(true);
      }
    } else {
      setIsPlayingAudio(prev => !prev);
    }
  };

  const handleSeek = (timeInSeconds: number) => {
    setCurrentTime(timeInSeconds);
    if (song.audioUrl && audioRef.current) {
      audioRef.current.currentTime = timeInSeconds;
    }
  };

  const handleUpdateSyncedLyrics = (newLines: SyncedLyricLine[], rawLrc: string, metadata?: LrcMetadata) => {
    setSyncedLines(newLines);
    setCustomLrcText(rawLrc);
    if (metadata) setLrcMetadata(metadata);
  };

  const handleSaveSyncedLyricsToSong = (newLines: SyncedLyricLine[], rawLrc: string) => {
    setSyncedLines(newLines);
    setCustomLrcText(rawLrc);

    const updatedSong: Song = {
      ...song,
      lrc: rawLrc,
      updatedAt: new Date().toISOString()
    };

    try {
      StorageService.upsertSong(updatedSong);
      if (onSaveSong) {
        onSaveSong(updatedSong);
      }
    } catch (err) {
      console.warn('Error guardando letra sincronizada en storage local:', err);
    }
  };

  const handleDeleteAudio = () => {
    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
    if (song.audioUrl && song.audioUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(song.audioUrl);
      } catch {}
    }
    const updated: Song = {
      ...song,
      audioUrl: undefined,
      updatedAt: new Date().toISOString()
    };
    try {
      StorageService.upsertSong(updated);
      if (onSaveSong) {
        onSaveSong(updated);
      }
      setAudioDeleteFeedback('Pista de audio eliminada');
      setTimeout(() => setAudioDeleteFeedback(null), 2500);
    } catch (err) {
      console.warn('Error al eliminar audio de storage', err);
    }
    setShowConfirmDeleteAudio(false);
  };

  const renderLyricsFormatted = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, idx) => {
      if (line.startsWith('##') || line.startsWith('#')) {
        const headerText = line.replace(/^#+\s*/, '');
        const isChorus = headerText.toLowerCase().includes('estribillo') || headerText.toLowerCase().includes('coro');
        return (
          <div key={idx} className="mt-8 mb-3 first:mt-2">
            <h4 className={`text-xs font-mono uppercase tracking-widest ${
              isChorus ? 'text-[var(--accent-primary)] font-semibold' : 'text-[var(--text-muted)]'
            }`}>
              {headerText}
            </h4>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-4" />;
      }

      if (showChords && /\[([A-G][#b]?[^\]]*)\]/.test(line)) {
        if (chordPosition === 'above') {
          const segments = parseLyricLine(line);
          return (
            <div
              key={idx}
              className="flex flex-wrap items-end my-1 font-serif text-[var(--text-primary)]"
            >
              {segments.map((segment, sIdx) => {
                const hasChord = !!segment.chord;
                return (
                  <span
                    key={sIdx}
                    className="inline-flex flex-col justify-end align-bottom select-text"
                  >
                    <span
                      className={`font-mono font-bold text-xs leading-none select-none ${
                        hasChord
                          ? 'text-[var(--accent-primary)] pb-1 pr-1.5'
                          : 'text-transparent pb-1'
                      }`}
                      aria-hidden={!hasChord}
                    >
                      {hasChord ? segment.chord : '\u00A0'}
                    </span>
                    <span className="font-serif leading-normal whitespace-pre">
                      {segment.text || (hasChord ? '\u00A0' : '')}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        }

        const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);
        return (
          <p key={idx} className="leading-relaxed font-mono text-[var(--text-primary)] flex flex-wrap items-baseline gap-1 my-1">
            {parts.map((part, pIdx) => {
              if (part.startsWith('[') && part.endsWith(']')) {
                const chordSymbol = part.slice(1, -1);
                return (
                  <span
                    key={pIdx}
                    className="inline-block px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-mono font-semibold text-xs border border-[var(--accent-border)] -translate-y-1 mx-0.5 select-none"
                  >
                    {chordSymbol}
                  </span>
                );
              }
              return <span key={pIdx} className="font-serif text-[var(--text-primary)]">{part}</span>;
            })}
          </p>
        );
      }

      const cleanLine = line.replace(/\[[^\]]+\]/g, '');
      return (
        <p key={idx} className="leading-relaxed font-serif text-[var(--text-secondary)] my-1">
          {cleanLine}
        </p>
      );
    });
  };

  /**
   * Render lyrics and chords specially styled for musicians on music stands (Atril).
   * Uses larger, bolder typography, high-contrast black on white, and avoids splitting verses across pages.
   */
  const renderMusicianPrintLyrics = (text: string) => {
    const lines = text.split('\n');
    const sections: { title?: string; isChorus?: boolean; lines: string[] }[] = [];
    let currentSection: { title?: string; isChorus?: boolean; lines: string[] } = { lines: [] };

    lines.forEach((line) => {
      if (line.startsWith('##') || line.startsWith('#')) {
        if (currentSection.lines.length > 0 || currentSection.title) {
          sections.push(currentSection);
        }
        const title = line.replace(/^#+\s*/, '');
        const isChorus = title.toLowerCase().includes('estribillo') || title.toLowerCase().includes('coro');
        currentSection = { title, isChorus, lines: [] };
      } else {
        currentSection.lines.push(line);
      }
    });
    if (currentSection.lines.length > 0 || currentSection.title) {
      sections.push(currentSection);
    }

    return sections.map((sec, sIdx) => (
      <div key={sIdx} className="musician-print-section mb-6 break-inside-avoid page-break-inside-avoid">
        {sec.title && (
          <div className="musician-print-section-header pb-1 mb-2.5 border-b-2 border-black/80 break-after-avoid page-break-after-avoid">
            <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
              sec.isChorus ? 'text-black font-extrabold' : 'text-gray-800'
            }`}>
              {sec.isChorus ? `[ ${sec.title.toUpperCase()} ]` : sec.title.toUpperCase()}
            </span>
          </div>
        )}

        <div className="space-y-2">
          {sec.lines.map((line, lIdx) => {
            if (!line.trim()) {
              return <div key={lIdx} className="h-3.5" />;
            }

            if (showChords && /\[([A-G][#b]?[^\]]*)\]/.test(line)) {
              if (chordPosition === 'above') {
                const segments = parseLyricLine(line);
                return (
                  <div key={lIdx} className="flex flex-wrap items-end my-1 font-serif text-black leading-none">
                    {segments.map((segment, segIdx) => {
                      const hasChord = !!segment.chord;
                      return (
                        <span key={segIdx} className="inline-flex flex-col justify-end align-bottom">
                          <span className={`font-mono font-bold text-sm leading-none pb-1 ${
                            hasChord ? 'text-black pr-2' : 'text-transparent'
                          }`}>
                            {hasChord ? segment.chord : '\u00A0'}
                          </span>
                          <span className="font-serif text-[18px] leading-snug whitespace-pre text-black font-normal">
                            {segment.text || (hasChord ? '\u00A0' : '')}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                );
              }

              // Inline chords
              const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);
              return (
                <p key={lIdx} className="font-serif text-[18px] leading-relaxed text-black my-1 flex flex-wrap items-baseline gap-1">
                  {parts.map((part, pIdx) => {
                    if (part.startsWith('[') && part.endsWith(']')) {
                      return (
                        <strong key={pIdx} className="font-mono text-sm font-bold text-black border border-black rounded px-1.5 py-0.5 bg-gray-100">
                          {part.slice(1, -1)}
                        </strong>
                      );
                    }
                    return <span key={pIdx}>{part}</span>;
                  })}
                </p>
              );
            }

            const cleanLine = line.replace(/\[[^\]]+\]/g, '');
            return (
              <p key={lIdx} className="font-serif text-[18px] leading-relaxed text-black my-1">
                {cleanLine}
              </p>
            );
          })}
        </div>
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-black/80 backdrop-blur-sm overflow-hidden modal-print-container print:static print:p-0 print:m-0 print:bg-white print:overflow-visible print:block print:inset-auto">
      <div 
        ref={scrollContainerRef}
        className={`relative w-full flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-y-auto text-[var(--text-primary)] transition-all duration-200 print:static print:p-0 print:m-0 print:bg-white print:overflow-visible print:max-h-none print:w-full print:shadow-none print:border-none print:rounded-none ${
          isMaximized
            ? 'w-[99vw] max-w-[99vw] h-[98vh] max-h-[98vh]'
            : 'max-w-4xl xl:max-w-5xl 2xl:max-w-6xl 3xl:max-w-[2000px] 4xl:max-w-[2600px] max-h-[92vh]'
        }`}
      >
        {/* Sticky Header with Action Controls */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 sm:p-6 bg-[var(--bg-header)] backdrop-blur-md border-b border-[var(--border-subtle)] no-print print:hidden">
          <div className="min-w-0 pr-4">
            {/* Unboxed Metadata with typographic separators (NO PILLS) */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] font-medium mb-1">
              <span className="text-[var(--accent-primary)] font-semibold">
                {song.status === 'published' ? 'Publicada' : song.status === 'draft' ? 'Borrador' : 'Inédita Privada'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{song.year}</span>
              <span aria-hidden="true">·</span>
              <span>{song.genre}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[var(--text-primary)]">
                Tono: {currentKey} {semitones !== 0 && `(${semitones > 0 ? `+${semitones}` : semitones})`}
              </span>
              {song.tempo && (
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{song.tempo} BPM</span>
                </span>
              )}
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)] truncate">
              {song.title}
            </h2>

            {song.tags && song.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {song.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] font-mono text-[var(--accent-primary)] bg-[var(--accent-subtle)] border border-[var(--accent-border)] px-2 py-0.5 rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAuthor && (
              <>
                {onViewHistory && (
                  <button
                    onClick={() => onViewHistory(song)}
                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                    title="Historial de versiones Git de esta canción (Solo autor)"
                  >
                    <History className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onEdit(song)}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                  title="Editar canción y letra (Solo autor)"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                {onRenameFile && (
                  <button
                    onClick={() => onRenameFile(song)}
                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                    title="Renombrar archivo Markdown (.md) (Solo autor)"
                  >
                    <FileCode className="w-4 h-4" />
                  </button>
                )}
                {onDeleteSong && (
                  <button
                    onClick={() => onDeleteSong(song)}
                    className="p-2 text-red-500 hover:text-red-600 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Eliminar canción completa (Solo autor)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            <button
              onClick={handleExportPdf}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer flex items-center gap-1"
              title="Exportar letra a PDF (optimizado para impresión: fuente serif, sin fondos oscuros)"
            >
              {isExportingPdf ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => onDownloadMd(song)}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
              title="Descargar archivo Markdown individual (.md)"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer no-print"
              title="Imprimir partitura / letra para atril"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={toggleMaximized}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer no-print"
              title={isMaximized ? "Restaurar tamaño normal" : "Maximizar a pantalla completa / modo atril"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
              title="Cerrar (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media & Player Hub Section */}
        <div className="p-4 sm:p-6 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)]">
          {/* Direct HTML5 Demo Audio Player */}
          {song.audioUrl && (
            <div className="mb-4 p-3.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAudio}
                  className="w-10 h-10 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] flex items-center justify-center shrink-0 cursor-pointer shadow"
                >
                  {isPlayingAudio ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5 fill-current" />
                  )}
                </button>
                <div>
                  <span className="text-xs font-semibold text-[var(--accent-primary)] block">
                    Maqueta Acústica / Grabación Local
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Audio demo para escucha directa en el cancionero
                  </span>
                </div>
              </div>

              <audio
                ref={audioRef}
                src={song.audioUrl}
                onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
                onEnded={() => setIsPlayingAudio(false)}
                className="hidden"
              />

              <div className="flex items-center gap-3">
                <div className="text-xs font-mono text-[var(--text-secondary)] shrink-0">
                  {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} /{' '}
                  {duration ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}` : '0:00'}
                </div>

                {isAuthor && (
                  <button
                    onClick={() => setShowConfirmDeleteAudio(true)}
                    className="px-2.5 py-1 text-xs text-red-500 hover:text-red-600 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                    title="Eliminar la pista de audio local de esta canción"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar audio</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {audioDeleteFeedback && (
            <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>{audioDeleteFeedback}</span>
            </div>
          )}

          {/* Embedded Streaming Players */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Spotify Player */}
            {song.spotifyUrl && (
              <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {spotifyEmbed ? (
                  <iframe
                    src={spotifyEmbed}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title={`Spotify player para ${song.title}`}
                  />
                ) : (
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#1DB954] font-semibold block">Spotify</span>
                      <span className="text-xs text-[var(--text-secondary)]">Disponible en la plataforma</span>
                    </div>
                    <a
                      href={song.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs text-white bg-[#1DB954] hover:bg-[#1aa34a] rounded-lg flex items-center gap-1.5"
                    >
                      <span>Abrir en Spotify</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* YouTube Player */}
            {song.youtubeUrl && (
              <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {youtubeEmbed ? (
                  <iframe
                    src={youtubeEmbed}
                    width="100%"
                    height="152"
                    title={`YouTube video para ${song.title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-[152px]"
                  />
                ) : (
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#e53e3e] font-semibold block">YouTube</span>
                      <span className="text-xs text-[var(--text-secondary)]">Vídeo disponible</span>
                    </div>
                    <a
                      href={song.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5"
                    >
                      <span>Abrir en YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* SoundCloud Link */}
            {song.soundcloudUrl && !song.spotifyUrl && !song.youtubeUrl && (
              <div className="rounded-xl p-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between col-span-full">
                <div>
                  <span className="text-xs font-semibold text-[#FF5500] block">SoundCloud Audio</span>
                  <span className="text-xs text-[var(--text-secondary)]">Escucha la pista en SoundCloud</span>
                </div>
                <a
                  href={song.soundcloudUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs text-white bg-[#FF5500] hover:bg-[#e04b00] rounded-lg flex items-center gap-1.5"
                >
                  <span>Abrir en SoundCloud</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* If no audio links available (Draft or Private) */}
            {!song.spotifyUrl && !song.youtubeUrl && !song.soundcloudUrl && !song.audioUrl && (
              <div className="col-span-full p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                      Canción sin enlaces de audio públicos
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                      Esta obra está catalogada en formato de texto y acordes. Ideal para ensayar con guitarra o piano,
                      consultar la letra en directo o continuar desarrollando las estrofas en el editor Markdown.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('lyrics')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'lyrics'
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Letra & Cifrado
            </button>
            <button
              onClick={() => setActiveTab('synced_lyrics')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'synced_lyrics'
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Letra Sincronizada (LRC)</span>
              {syncedLines.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold">
                  {syncedLines.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'notes'
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Notas de Composición
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'markdown'
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Archivo Markdown (.md)</span>
            </button>
          </div>

          {/* Interactive Toolbar for Musicians */}
          {activeTab === 'lyrics' && (
            <div className="flex flex-wrap items-center gap-2 pb-2">
              {/* Show/Hide Chords toggle */}
              <button
                onClick={() => setShowChords(!showChords)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                  showChords
                    ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-medium'
                    : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Mostrar u ocultar acordes entre corchetes"
              >
                {showChords ? 'Acordes: Visibles' : 'Acordes: Ocultos'}
              </button>

              {/* Transpose Semitones Controls & Chord Position Toggle */}
              {showChords && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md p-0.5">
                    <button
                      onClick={() => setSemitones(prev => prev - 1)}
                      className="p-1 hover:bg-[var(--bg-surface)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Bajar 1 semitono"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] font-mono px-1.5 text-[var(--accent-primary)] font-semibold tabular-nums">
                      {semitones === 0 ? 'Tono 0' : semitones > 0 ? `+${semitones}` : semitones}
                    </span>
                    <button
                      onClick={() => setSemitones(prev => prev + 1)}
                      className="p-1 hover:bg-[var(--bg-surface)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Subir 1 semitono"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    {semitones !== 0 && (
                      <button
                        onClick={() => setSemitones(0)}
                        className="p-1 hover:bg-[var(--bg-surface)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Restablecer tonalidad original"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  {/* Enharmonic accidental preference toggle (# vs b) */}
                  <button
                    onClick={() => setAccidentalPreference(prev => prev === 'sharps' ? 'flats' : 'sharps')}
                    className="px-2 py-1 rounded text-[11px] font-mono border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--accent-primary)] font-semibold transition-colors cursor-pointer shadow-2xs"
                    title={`Preferencia enarmónica activa: ${accidentalPreference === 'flats' ? 'Bemoles (♭)' : 'Sostenidos (♯)'}. Pulsa para alternar.`}
                  >
                    {accidentalPreference === 'flats' ? '♭ Bemoles' : '♯ Sostenidos'}
                  </button>

                  {/* Chord Position Toggle: Above vs Inline */}
                  <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md p-0.5 text-xs">
                    <span className="text-[11px] text-[var(--text-muted)] px-1 font-medium hidden sm:inline">
                      Acordes:
                    </span>
                    <button
                      onClick={() => handleChordPositionChange('above')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer font-medium ${
                        chordPosition === 'above'
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                      title="Mostrar acordes encima de las sílabas correspondientes (preferencia guardada)"
                    >
                      Encima
                    </button>
                    <button
                      onClick={() => handleChordPositionChange('inline')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer font-medium ${
                        chordPosition === 'inline'
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                      title="Mostrar acordes en la misma línea intercalados con el texto (preferencia guardada)"
                    >
                      En línea
                    </button>
                  </div>
                </div>
              )}

              {/* Font Size Selector */}
              <div className="flex items-center gap-0.5 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md p-0.5 text-xs">
                <button
                  onClick={() => handleFontSizeChange('sm')}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                    fontSize === 'sm'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Tamaño de letra: Pequeña"
                >
                  A-
                </button>
                <button
                  onClick={() => handleFontSizeChange('base')}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                    fontSize === 'base'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Tamaño de letra: Normal"
                >
                  A
                </button>
                <button
                  onClick={() => handleFontSizeChange('lg')}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                    fontSize === 'lg'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Tamaño de letra: Grande"
                >
                  A+
                </button>
              </div>

              {/* Teleprompter / Auto-scroll toggle */}
              <button
                onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isAutoScrolling
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Desplazamiento automático para cantar o tocar"
              >
                {isAutoScrolling ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isAutoScrolling ? 'Pausar Scroll' : 'Auto-scroll'}</span>
              </button>

              {/* Export PDF Button (Optimized for printing / music stand) */}
              <button
                onClick={handleExportPdf}
                className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Descargar versión PDF optimizada para impresión (fuente serif, fondo blanco y tonalidad actual)"
              >
                {isExportingPdf ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">¡PDF Guardado!</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <FileDown className="w-3 h-3 text-[var(--accent-primary)]" />
                    <span>Exportar PDF</span>
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Lyrics Content */}
        {activeTab === 'lyrics' && (
          <div className="p-6 sm:p-10 font-serif leading-relaxed text-[var(--text-primary)] max-w-2xl xl:max-w-4xl 2xl:max-w-5xl 3xl:max-w-6xl mx-auto w-full">
            <div className={`space-y-1 ${
              fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'
            }`}>
              {renderLyricsFormatted(displayedLyrics)}
            </div>
          </div>
        )}

        {/* Tab: Synced Lyrics (LRC / WebVTT) */}
        {activeTab === 'synced_lyrics' && (
          <div className="p-4 sm:p-6 max-w-3xl xl:max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl mx-auto w-full">
            <SyncedLyrics
              lines={syncedLines}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlayingAudio}
              onSeek={handleSeek}
              onTogglePlay={toggleAudio}
              metadata={lrcMetadata}
              songTitle={song.title}
              songArtist="Tony"
              showChords={showChords}
              fontSize={fontSize}
              rawLyrics={song.lyrics}
              onUpdateLyrics={handleUpdateSyncedLyrics}
              onSaveToSong={handleSaveSyncedLyricsToSong}
            />
          </div>
        )}

        {/* Tab 2: Composition Notes */}
        {activeTab === 'notes' && (
          <div className="p-6 sm:p-8 max-w-2xl xl:max-w-4xl 2xl:max-w-5xl 3xl:max-w-6xl mx-auto w-full space-y-6">
            <div>
              <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] mb-2">
                Ficha Técnica Musical
              </h4>
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs">
                <div>
                  <span className="text-[var(--text-muted)] block">Tonalidad base:</span>
                  <span className="font-semibold text-[var(--text-primary)] font-mono">{song.key}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Afinación de guitarra:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{song.tuning || 'Estándar (EADGBE)'}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Compás métrico:</span>
                  <span className="font-semibold text-[var(--text-primary)] font-mono">{song.timeSignature || '4/4'}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Tempo estimado:</span>
                  <span className="font-semibold text-[var(--text-primary)] font-mono">{song.tempo ? `${song.tempo} BPM` : 'Libre'}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] mb-2">
                Bitácora & Contexto Creativo
              </h4>
              <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] leading-relaxed font-serif">
                {song.notes || 'No se han registrado notas de composición para este tema todavía.'}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Raw Markdown with YAML Frontmatter */}
        {activeTab === 'markdown' && (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  Archivo fuente: <strong className="text-[var(--accent-primary)]">songs/{song.id}.md</strong>
                </span>
                {isAuthor && onRenameFile && (
                  <button
                    onClick={() => onRenameFile(song)}
                    className="px-2 py-0.5 text-[11px] font-sans font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                  >
                    (Renombrar archivo)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyMarkdown}
                  className="px-3 py-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado al portapapeles' : 'Copiar archivo'}</span>
                </button>
                <button
                  onClick={() => onDownloadMd(song)}
                  className="px-3 py-1.5 text-xs rounded-md bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold hover:bg-[var(--accent-hover)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar .md</span>
                </button>
              </div>
            </div>
            <pre className="p-4 rounded-xl bg-[var(--bg-code)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] overflow-x-auto leading-relaxed select-all">
              {rawMarkdown}
            </pre>
          </div>
        )}
      </div>

      {/* Confirmation Modal to Delete Local Audio */}
      {showConfirmDeleteAudio && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[var(--text-primary)]">
                  ¿Eliminar audio local de esta canción?
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Esta acción desvinculará la maqueta/pista de audio de "{song.title}".
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-surface-subtle)] p-3 rounded-xl border border-[var(--border-subtle)]">
              La letra, acordes, notas de composición y enlaces externos a Spotify o YouTube se conservarán intactos.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteAudio(false)}
                className="px-3.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAudio}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Eliminar audio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
