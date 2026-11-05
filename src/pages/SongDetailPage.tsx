import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
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
  Disc,
  Tag,
  Lock,
  Cloud,
  Sparkles,
  ScrollText
} from 'lucide-react';
import { Song } from '../types/song';
import { Album } from '../types/album';
import { GoogleDriveService } from '../services/googleDriveService';
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
import { SyncedLyrics } from '../components/SyncedLyrics';
import { SyncedLyricLine, LrcMetadata } from '../types/lyrics';
import { parseLrc, isLrcContent } from '../lib/lyrics/parseLrc';
import { SAMPLE_LRC_TEXT } from '../data/sampleLrc';
import { StorageService } from '../services/storageService';
import { useAppNavigation } from '../context/NavigationContext';
import { calculateSongCompleteness } from '../utils/songwriterHelper';

interface SongDetailPageProps {
  song: Song;
  albums?: Album[];
  onEdit: (song: Song) => void;
  onDownloadMd: (song: Song) => void;
  isAuthor: boolean;
  onSaveSong?: (song: Song) => void;
  onDeleteSong?: (song: Song) => void;
  onViewHistory?: (song: Song) => void;
  onRenameFile?: (song: Song) => void;
}

export const SongDetailPage: React.FC<SongDetailPageProps> = ({
  song,
  albums = [],
  onEdit,
  onDownloadMd,
  isAuthor,
  onSaveSong,
  onDeleteSong,
  onViewHistory,
  onRenameFile
}) => {
  const { navigate, goBack } = useAppNavigation();

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
  const [activeTab, setActiveTab] = useState<'lyrics' | 'synced_lyrics' | 'markdown' | 'notes'>('lyrics');
  const [syncedLines, setSyncedLines] = useState<SyncedLyricLine[]>([]);
  const [lrcMetadata, setLrcMetadata] = useState<LrcMetadata>({});
  const [, setCustomLrcText] = useState<string>('');

  // Auto-scroll state for singing/playing
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [scrollSpeed] = useState<number>(1);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  const completeness = React.useMemo(() => calculateSongCompleteness(song), [song]);

  useEffect(() => {
    if (isAutoScrolling) {
      scrollIntervalRef.current = window.setInterval(() => {
        window.scrollBy({ top: 1.2 * scrollSpeed, behavior: 'smooth' });
      }, 50);
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isAutoScrolling, scrollSpeed]);

  // Direct Audio player ref
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showConfirmDeleteAudio, setShowConfirmDeleteAudio] = useState(false);
  const [audioDeleteFeedback, setAudioDeleteFeedback] = useState<string | null>(null);

  // Private demo / Google Drive resolution states
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string>('');
  const [isLoadingDriveAudio, setIsLoadingDriveAudio] = useState<boolean>(false);
  const [driveAudioError, setDriveAudioError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    const resolveAudio = async () => {
      const fileId = song.driveFileId || (song.audioUrl?.startsWith('gdrive://') ? song.audioUrl.replace('gdrive://', '') : null);

      // Private maqueta protection: hide audio if user is not author
      if ((fileId || song.isPrivateDemo) && !isAuthor) {
        setResolvedAudioUrl('');
        return;
      }

      if (fileId && isAuthor) {
        setIsLoadingDriveAudio(true);
        setDriveAudioError(null);
        try {
          const url = await GoogleDriveService.createAudioObjectUrl(fileId);
          if (active) {
            objectUrlToRevoke = url;
            setResolvedAudioUrl(url);
          }
        } catch (err: any) {
          if (active) {
            setDriveAudioError(err.message || 'Inicia sesión con Google Drive para escuchar esta maqueta.');
          }
        } finally {
          if (active) setIsLoadingDriveAudio(false);
        }
      } else if (song.audioUrl && !song.audioUrl.startsWith('gdrive://') && !song.audioUrl.startsWith('blob:')) {
        setResolvedAudioUrl(song.audioUrl);
      } else {
        setResolvedAudioUrl('');
      }
    };

    void resolveAudio();

    return () => {
      active = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [song.driveFileId, song.audioUrl, song.isPrivateDemo, isAuthor]);

  useEffect(() => {
    setSemitones(0);
    setIsAutoScrolling(false);
    setIsPlayingAudio(false);
    setIsExportingPdf(false);
    setCurrentTime(0);

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

  // Find linked album if any
  const linkedAlbum = React.useMemo(() => {
    if (song.albumId) {
      return albums.find(a => a.id === song.albumId);
    }
    // Fallback: match by tracks or notes
    return albums.find(a =>
      a.tracks?.some(t => t.songId === song.id) ||
      (song.notes && song.notes.toLowerCase().includes(a.title.toLowerCase())) ||
      (song.tags && song.tags.some(tag => tag.toLowerCase() === a.id.toLowerCase()))
    );
  }, [albums, song.albumId, song.id, song.notes, song.tags]);

  const trackInAlbum = linkedAlbum?.tracks?.find(t => t.songId === song.id);

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

  // Keyboard navigation & spacebar to play audio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'Escape') {
        goBack({ name: 'catalog' });
      } else if (e.key === ' ' && song.audioUrl) {
        e.preventDefault();
        togglePlayAudio();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [song.audioUrl, isPlayingAudio, goBack]);

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(err => {
        console.warn('Could not play audio', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatAudioTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveSyncedLyrics = (newLines: SyncedLyricLine[], rawLrc: string) => {
    setSyncedLines(newLines);
    setCustomLrcText(rawLrc);

    const updatedSong: Song = {
      ...song,
      lrc: rawLrc,
      updatedAt: new Date().toISOString()
    };
    StorageService.upsertSong(updatedSong);
    if (onSaveSong) {
      onSaveSong(updatedSong);
    }
  };

  const handleTranspose = (delta: number) => {
    setSemitones(prev => {
      const next = prev + delta;
      return next > 11 ? next - 12 : next < -11 ? next + 12 : next;
    });
  };

  const handleResetTranspose = () => {
    setSemitones(0);
  };

  const handleCopyLyrics = () => {
    const transposed = transposeLyrics(song.lyrics, semitones, accidentalPreference);
    const textToCopy = showChords ? transposed : transposed.replace(/\[[^\]]+\]/g, '');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    try {
      setIsExportingPdf(true);
      exportSongToPdf(song, {
        semitones,
        showChords,
        chordPosition,
        accidentalPreference
      });
    } catch (err) {
      console.error('Error generando PDF de la canción:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const currentKey = transposeChord(song.key || 'Am', semitones, accidentalPreference);
  const transposedLyrics = transposeLyrics(song.lyrics, semitones, accidentalPreference);
  const youtubeEmbedUrl = getYouTubeEmbedUrl(song.youtubeUrl);
  const spotifyEmbedUrl = getSpotifyEmbedUrl(song.spotifyUrl);

  const renderLyrics = () => {
    const lines = transposedLyrics.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('##') || line.startsWith('#')) {
        const title = line.replace(/^#+\s*/, '');
        return (
          <h4
            key={idx}
            className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold mt-6 mb-2 border-b border-[var(--border-subtle)] pb-1"
          >
            {title}
          </h4>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-4" />;
      }

      if (showChords && /\[([A-G][#b]?[^\]]*)\]/.test(line)) {
        if (chordPosition === 'above') {
          const segments = parseLyricLine(line);
          return (
            <div key={idx} className="flex flex-wrap items-end my-1 font-mono leading-none">
              {segments.map((segment, sIdx) => {
                const chord = segment.chord;
                const text = segment.text;
                return (
                  <span key={sIdx} className="inline-flex flex-col mr-1">
                    <span className="text-xs font-bold text-[var(--accent-primary)] select-none h-4">
                      {chord || '\u00A0'}
                    </span>
                    <span className={`font-serif text-[var(--text-primary)] leading-normal ${
                      fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'
                    }`}>
                      {text || '\u00A0'}
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
              return (
                <span
                  key={pIdx}
                  className={`font-serif text-[var(--text-primary)] ${
                    fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'
                  }`}
                >
                  {part}
                </span>
              );
            })}
          </p>
        );
      }

      const cleanLine = line.replace(/\[[^\]]+\]/g, '');
      return (
        <p
          key={idx}
          className={`leading-relaxed font-serif text-[var(--text-secondary)] my-1 ${
            fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'
          }`}
        >
          {cleanLine}
        </p>
      );
    });
  };

  return (
    <div className="max-w-[1440px] 3xl:max-w-[2000px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => (linkedAlbum ? navigate({ name: 'album-detail', albumId: linkedAlbum.id }) : goBack({ name: 'catalog' }))}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{linkedAlbum ? `Volver a ${linkedAlbum.title}` : 'Volver al catálogo'}</span>
        </button>

        {/* Quick author & export actions */}
        <div className="flex items-center gap-2">
          {isAuthor && (
            <>
              {onViewHistory && (
                <button
                  onClick={() => onViewHistory(song)}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                  title="Historial de versiones Git"
                >
                  <History className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onEdit(song)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Canción</span>
              </button>
            </>
          )}

          <button
            onClick={() => onDownloadMd(song)}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
            title="Descargar archivo Markdown (.md)"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportPdf}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
            title="Exportar PDF para atril"
          >
            <FileDown className="w-4 h-4" />
          </button>
          <button
            onClick={handlePrint}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
            title="Imprimir partitura / letra"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Author Studio & Completeness Assistant Bar */}
      {isAuthor && (
        <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-wrap items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              completeness.percent >= 80 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Taller de Autor · {completeness.statusLabel} ({completeness.percent}%)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  song.status === 'published' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                }`}>
                  {song.status === 'published' ? 'Publicada' : song.status === 'draft' ? 'Borrador' : 'Inédita'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {completeness.nextSuggestion}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {song.status !== 'published' && onSaveSong && (
              <button
                onClick={() => {
                  const updated = { ...song, status: 'published' as const, updatedAt: new Date().toISOString() };
                  StorageService.upsertSong(updated);
                  onSaveSong(updated);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                title="Cambiar estado a publicada para que sea visible en el repertorio público"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Publicar Canción</span>
              </button>
            )}
            <button
              onClick={() => onEdit(song)}
              className="px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Abrir en Taller de Autor</span>
            </button>
          </div>
        </div>
      )}

      {/* Album Linkage Banner (if this song belongs to an album) */}
      {linkedAlbum && (
        <div className="mb-6 p-3.5 rounded-xl bg-[var(--accent-subtle)]/50 border border-[var(--accent-border)] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Disc className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="text-[var(--text-secondary)] truncate">
              Perteneciente al álbum <strong className="text-[var(--text-primary)]">{linkedAlbum.title}</strong>
              {trackInAlbum?.order && (
                <span className="font-mono ml-1 font-semibold">· Pista #{trackInAlbum.order}</span>
              )}
            </span>
          </div>
          <button
            onClick={() => navigate({ name: 'album-detail', albumId: linkedAlbum.id })}
            className="px-2.5 py-1 font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] hover:bg-[var(--accent-subtle)] rounded transition-colors cursor-pointer shrink-0"
          >
            Ver Álbum completo →
          </button>
        </div>
      )}

      {/* Main Song Header & Meta */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] font-medium mb-1.5">
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
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{song.tempo} BPM</span>
            </>
          )}
          {song.duration && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{song.duration}</span>
            </>
          )}
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] tracking-tight mb-3">
          {song.title}
        </h1>

        {song.tags && song.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {song.tags.map(tag => (
              <span
                key={tag}
                className="text-[11px] font-mono text-[var(--accent-primary)] bg-[var(--accent-subtle)] border border-[var(--accent-border)] px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Streaming links & Audio preview if present */}
        <div className="flex flex-wrap items-center gap-3">
          {song.spotifyUrl && (
            <a
              href={song.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30 text-xs font-medium transition-colors"
            >
              <span>Spotify</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {song.appleMusicUrl && (
            <a
              href={song.appleMusicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FA243C]/10 hover:bg-[#FA243C]/20 text-[#FA243C] border border-[#FA243C]/30 text-xs font-medium transition-colors"
            >
              <span>Apple Music</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {song.youtubeUrl && (
            <a
              href={song.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF0000]/10 hover:bg-[#FF0000]/20 text-[#FF0000] border border-[#FF0000]/30 text-xs font-medium transition-colors"
            >
              <span>YouTube</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {song.soundcloudUrl && (
            <a
              href={song.soundcloudUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF5500]/10 hover:bg-[#FF5500]/20 text-[#FF5500] border border-[#FF5500]/30 text-xs font-medium transition-colors"
            >
              <span>SoundCloud</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Protected Private Maqueta message for non-author visitors */}
      {!isAuthor && (song.driveFileId || song.isPrivateDemo || (song.audioUrl && (song.audioUrl.startsWith('gdrive://') || song.audioUrl.startsWith('blob:')))) && (
        <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-[var(--text-primary)] block">Maqueta acústica de autor protegida</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                Grabación íntima guardada en Google Drive. Inicia sesión como autor para escucharla.
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)] self-start sm:self-auto">
            Privada (Solo autor)
          </span>
        </div>
      )}

      {/* Author Audio Player Bar (when resolved audio URL is available) */}
      {isAuthor && resolvedAudioUrl && (
        <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-[var(--text-primary)]">
                {song.driveFileName || 'Maqueta Acústica Privada (Google Drive)'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
                Google Drive
              </span>
            </div>
            <button
              onClick={() => onEdit(song)}
              className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Reanalizar en Taller</span>
            </button>
          </div>

          <audio
            ref={audioRef}
            src={resolvedAudioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlayingAudio(false)}
          />

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={togglePlayAudio}
              className="w-10 h-10 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer"
            >
              {isPlayingAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="flex-1 w-full space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-[var(--accent-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                <span>{formatAudioTime(currentTime)}</span>
                <span>{formatAudioTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAuthor && isLoadingDriveAudio && (
        <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs flex items-center gap-2.5 animate-pulse text-[var(--text-muted)]">
          <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          <span>Cargando maqueta segura desde Google Drive...</span>
        </div>
      )}

      {isAuthor && driveAudioError && (
        <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <Cloud className="w-4 h-4 shrink-0" />
          <span>{driveAudioError}</span>
        </div>
      )}

      {/* Content Toolbar: Tabs & Musical Controls */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-subtle)] rounded-lg">
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'lyrics'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Letra y Acordes
          </button>
          <button
            onClick={() => setActiveTab('synced_lyrics')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'synced_lyrics'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Letras Sincronizadas (LRC)
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Notas y Contexto
          </button>
          <button
            onClick={() => setActiveTab('markdown')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'markdown'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Markdown
          </button>
        </div>

        {/* Musical & Transposition Controls (when on lyrics tab) */}
        {activeTab === 'lyrics' && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Transpose Semitones */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg px-2 py-1">
              <span className="text-xs text-[var(--text-muted)] font-mono">Tono:</span>
              <button
                onClick={() => handleTranspose(-1)}
                className="w-6 h-6 flex items-center justify-center rounded text-xs hover:bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
                title="Bajar medio tono (-1)"
              >
                -1
              </button>
              <span className="font-mono font-bold text-xs px-1 text-[var(--accent-primary)]">
                {currentKey}
              </span>
              <button
                onClick={() => handleTranspose(1)}
                className="w-6 h-6 flex items-center justify-center rounded text-xs hover:bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
                title="Subir medio tono (+1)"
              >
                +1
              </button>
              {semitones !== 0 && (
                <button
                  onClick={handleResetTranspose}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer ml-1"
                  title="Restablecer tono original"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sharp / Flat preference */}
            <button
              onClick={() => setAccidentalPreference(prev => (prev === 'sharps' ? 'flats' : 'sharps'))}
              className="px-2 py-1 text-xs font-mono rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Alternar sostenidos (#) y bemoles (b)"
            >
              {accidentalPreference === 'sharps' ? '#' : 'b'}
            </button>

            {/* Chords toggle */}
            <button
              onClick={() => setShowChords(!showChords)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                showChords
                  ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {showChords ? 'Acordes activados' : 'Sin acordes'}
            </button>

            {/* Chord position toggle (above vs inline) */}
            {showChords && (
              <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
                <button
                  onClick={() => handleChordPositionChange('above')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer ${
                    chordPosition === 'above' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium shadow-sm' : 'text-[var(--text-muted)]'
                  }`}
                  title="Acordes sobre la letra"
                >
                  Arriba
                </button>
                <button
                  onClick={() => handleChordPositionChange('inline')}
                  className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer ${
                    chordPosition === 'inline' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium shadow-sm' : 'text-[var(--text-muted)]'
                  }`}
                  title="Acordes en línea [Am]"
                >
                  En línea
                </button>
              </div>
            )}

            {/* Font size control */}
            <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
              {(['sm', 'base', 'lg'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => handleFontSizeChange(size)}
                  className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors cursor-pointer ${
                    fontSize === size ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-sm' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {size === 'sm' ? 'A-' : size === 'lg' ? 'A+' : 'A'}
                </button>
              ))}
            </div>

            {/* Auto-scroll rehearsal button */}
            <button
              onClick={() => setIsAutoScrolling(!isAutoScrolling)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isAutoScrolling
                  ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
              title="Desplazamiento automático para leer la letra y tocar en atril"
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>{isAutoScrolling ? 'Pausar Desplazamiento' : 'Autodesplazamiento'}</span>
            </button>

            {/* Copy lyrics */}
            <button
              onClick={handleCopyLyrics}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-medium)] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiada' : 'Copiar letra'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Views */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-10 shadow-sm min-h-[450px]">
        {/* Tab 1: Lyrics & Chords */}
        {activeTab === 'lyrics' && (
          <div className="max-w-3xl">
            {renderLyrics()}
          </div>
        )}

        {/* Tab 2: Synced Lyrics (LRC) */}
        {activeTab === 'synced_lyrics' && (
          <div>
            <SyncedLyrics
              lines={syncedLines}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlayingAudio}
              onSeek={(time) => {
                if (audioRef.current) audioRef.current.currentTime = time;
                setCurrentTime(time);
              }}
              onTogglePlay={togglePlayAudio}
              metadata={lrcMetadata}
              songTitle={song.title}
              showChords={showChords}
              fontSize={fontSize}
              onSaveToSong={handleSaveSyncedLyrics}
            />
          </div>
        )}

        {/* Tab 3: Notes & Context */}
        {activeTab === 'notes' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Notas de Composición & Arreglos
            </h3>
            {song.notes ? (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line bg-[var(--bg-surface-subtle)] p-5 rounded-xl border border-[var(--border-subtle)]">
                {song.notes}
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">
                No hay notas añadidas para esta composición.
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--border-subtle)] text-xs">
              <div>
                <span className="text-[var(--text-muted)] block mb-1">Afinación</span>
                <span className="font-medium text-[var(--text-primary)]">{song.tuning || 'Estándar (EADGBE)'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block mb-1">Compás</span>
                <span className="font-medium text-[var(--text-primary)]">{song.timeSignature || '4/4'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block mb-1">Tono Principal</span>
                <span className="font-medium font-mono text-[var(--text-primary)]">{song.key || 'Am'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block mb-1">Tempo</span>
                <span className="font-medium font-mono text-[var(--text-primary)]">{song.tempo ? `${song.tempo} BPM` : 'No especificado'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Raw Markdown */}
        {activeTab === 'markdown' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-[var(--text-muted)]">songs/{song.id}.md</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(songToMarkdown(song));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] rounded hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado' : 'Copiar Markdown'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] overflow-x-auto leading-relaxed">
              {songToMarkdown(song)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
