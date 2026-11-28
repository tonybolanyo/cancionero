import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import {
  ArrowLeft,
  Edit3,
  Download,
  Copy,
  Check,
  Printer,
  History,
  FileDown,
  Disc,
  Sparkles,
  Youtube,
  Sliders,
  Maximize2,
  ExternalLink
} from 'lucide-react';
import { Song } from '../types/song';
import { Album } from '../types/album';
import { GoogleDriveService } from '../services/googleDriveService';
import {
  songToMarkdown,
  transposeLyrics,
  transposeChord,
  AccidentalPreference
} from '../utils/markdownParser';
import { isSafeExternalUrl } from '../utils/authConfig';
import { exportSongToPdf } from '../utils/pdfGenerator';
import { SyncedLyricLine, LrcMetadata } from '../types/lyrics';
import { parseLrc, isLrcContent } from '../lib/lyrics/parseLrc';
import { SAMPLE_LRC_TEXT } from '../data/sampleLrc';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { useAppNavigation } from '../context/NavigationContext';
import { calculateSongCompleteness } from '../utils/songwriterHelper';
import { PitchShiftPlayer, AudioEqMode } from '../lib/audio/pitchShiftPlayer';
import {
  InstrumentType,
  extractUniqueChordsFromLyrics,
  chordShapeWithCapo
} from '../lib/music/chordDiagrams';
import { chordToFunctionalSymbol } from '../lib/music/harmonyEngine';
import { playChordPreview, playChordProgression, ProgressionPlaybackHandle } from '../lib/audio/chordSynth';
import {
  extractSectionProgressions,
  buildTimedChordEventsFromSong,
  exportChordsToMidiBytes,
  downloadMidiFile
} from '../lib/music/midiExporter';
import { downloadChordProFile } from '../lib/music/chordPro';
import { SongChordsBar, HarmonicNotationView } from '../components/ChordDiagramCard';
import { SongDetailAudioPlayer } from '../components/songDetail/SongDetailAudioPlayer';
import { SongDetailToolbar, SongDetailTab } from '../components/songDetail/SongDetailToolbar';
import { SongDetailLyricsRenderer } from '../components/songDetail/SongDetailLyricsRenderer';
import {
  useKeyboardShortcuts,
  SHORTCUT_PRIORITY,
  isEditableTarget,
  hasActiveModalDialog
} from '../hooks/useKeyboardShortcuts';

const SongVideoVisualizerModal = lazy(() =>
  import('../components/SongVideoVisualizerModal').then((m) => ({ default: m.SongVideoVisualizerModal }))
);
const SyncedLyrics = lazy(() =>
  import('../components/SyncedLyrics').then((m) => ({ default: m.SyncedLyrics }))
);
const ChromaticTunerModal = lazy(() =>
  import('../components/ChromaticTunerModal').then((m) => ({ default: m.ChromaticTunerModal }))
);
const StageModeOverlay = lazy(() =>
  import('../components/StageModeOverlay').then((m) => ({ default: m.StageModeOverlay }))
);

interface SongDetailPageProps {
  song: Song;
  songs?: Song[];
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
  songs = [],
  albums = [],
  onEdit,
  onDownloadMd,
  isAuthor,
  onSaveSong,
  onViewHistory
}) => {
  const { navigate, goBack } = useAppNavigation();
  const { isGoogleDriveConnected, driveTokenStatus, loginWithGoogle } = useAuth();
  const { register, unregister } = useKeyboardShortcuts();

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
  const [activeTab, setActiveTab] = useState<SongDetailTab>('lyrics');
  const [syncedLines, setSyncedLines] = useState<SyncedLyricLine[]>([]);
  const [lrcMetadata, setLrcMetadata] = useState<LrcMetadata>({});
  const [, setCustomLrcText] = useState<string>('');

  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(1);
  const [, setIsExportingPdf] = useState<boolean>(false);
  const [isVisualizerOpen, setIsVisualizerOpen] = useState<boolean>(false);
  const [isStageModeOpen, setIsStageModeOpen] = useState<boolean>(false);
  const [isTunerOpen, setIsTunerOpen] = useState<boolean>(false);
  const scrollIntervalRef = useRef<number | null>(null);

  const [instrument, setInstrument] = useState<InstrumentType>('guitar');
  const [capoFret, setCapoFret] = useState<number>(0);
  const [notationView, setNotationView] = useState<HarmonicNotationView>('chords');
  const [activeChordDiagram, setActiveChordDiagram] = useState<string | null>(null);
  const [playingProgressionId, setPlayingProgressionId] = useState<string | null>(null);
  const [activeProgressionStep, setActiveProgressionStep] = useState<{ id: string; index: number } | null>(null);
  const progressionHandleRef = useRef<ProgressionPlaybackHandle | null>(null);

  const completeness = React.useMemo(() => calculateSongCompleteness(song), [song]);

  useEffect(() => {
    if (isAutoScrolling) {
      let targetSec = 210;
      if (song.duration) {
        const parts = song.duration.split(':').map(Number);
        if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          targetSec = Math.max(30, parts[0] * 60 + parts[1]);
        }
      }
      const intervalMs = 50;
      scrollIntervalRef.current = window.setInterval(() => {
        const docScrollable = Math.max(300, document.documentElement.scrollHeight - window.innerHeight);
        const pxPerSec = (docScrollable / targetSec) * scrollSpeed;
        const step = Math.max(0.4, (pxPerSec * intervalMs) / 1000);
        window.scrollBy({ top: step });
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          setIsAutoScrolling(false);
        }
      }, intervalMs);
    } else if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isAutoScrolling, scrollSpeed, song.duration]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const dspPlayerRef = useRef<PitchShiftPlayer | null>(null);
  const [useDspPlayer, setUseDspPlayer] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [eqMode, setEqMode] = useState<AudioEqMode>('normal');
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [syncAudioPitch, setSyncAudioPitch] = useState<boolean>(true);

  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string>('');
  const [isLoadingDriveAudio, setIsLoadingDriveAudio] = useState<boolean>(false);
  const [driveAudioError, setDriveAudioError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      dspPlayerRef.current?.dispose();
      dspPlayerRef.current = null;
      progressionHandleRef.current?.stop();
      progressionHandleRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    const resolveAudio = async () => {
      const fileId = song.driveFileId || (song.audioUrl?.startsWith('gdrive://') ? song.audioUrl.replace('gdrive://', '') : null);

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
  }, [song.driveFileId, song.audioUrl, song.isPrivateDemo, isAuthor, isGoogleDriveConnected, driveTokenStatus]);

  useEffect(() => {
    setSemitones(0);
    setCapoFret(0);
    setActiveChordDiagram(null);
    setIsAutoScrolling(false);
    setIsPlayingAudio(false);
    setIsExportingPdf(false);
    setCurrentTime(0);
    setLoopStart(null);
    setLoopEnd(null);
    setPlaybackRate(1.0);
    setEqMode('normal');
    dspPlayerRef.current?.pause();
    dspPlayerRef.current?.clearLoop();
    progressionHandleRef.current?.stop();
    progressionHandleRef.current = null;
    setPlayingProgressionId(null);
    setActiveProgressionStep(null);

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

  useEffect(() => {
    let cancelled = false;
    setUseDspPlayer(false);

    if (!resolvedAudioUrl || !isAuthor) {
      dspPlayerRef.current?.pause();
      return;
    }

    const loadDspBuffer = async () => {
      try {
        const res = await fetch(resolvedAudioUrl);
        if (!res.ok) return;
        const arrBuf = await res.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const tempCtx = new AudioCtx();
        const decoded = await tempCtx.decodeAudioData(arrBuf);
        void tempCtx.close().catch(() => {});
        if (cancelled) return;

        if (!dspPlayerRef.current) {
          dspPlayerRef.current = new PitchShiftPlayer({
            preserveTempo: true,
            semitones: syncAudioPitch ? semitones : 0,
            playbackRate,
            eqMode,
            onTimeUpdate: (t) => setCurrentTime(t),
            onEnded: () => setIsPlayingAudio(false),
            onStateChange: (playing) => setIsPlayingAudio(playing)
          });
        }
        dspPlayerRef.current.setBuffer(decoded);
        setDuration(decoded.duration);
        setUseDspPlayer(true);
      } catch {
        if (!cancelled) setUseDspPlayer(false);
      }
    };

    void loadDspBuffer();
    return () => {
      cancelled = true;
    };
  }, [resolvedAudioUrl, isAuthor]);

  useEffect(() => {
    if (useDspPlayer && dspPlayerRef.current) {
      dspPlayerRef.current.setPitch(syncAudioPitch ? semitones : 0);
    }
  }, [semitones, syncAudioPitch, useDspPlayer]);

  const linkedAlbum = React.useMemo(() => {
    if (song.albumId) {
      return albums.find((a) => a.id === song.albumId);
    }
    return albums.find(
      (a) =>
        a.tracks?.some((t) => t.songId === song.id) ||
        (song.notes && song.notes.toLowerCase().includes(a.title.toLowerCase())) ||
        (song.tags && song.tags.some((tag) => tag.toLowerCase() === a.id.toLowerCase()))
    );
  }, [albums, song.albumId, song.id, song.notes, song.tags]);

  const trackInAlbum = linkedAlbum?.tracks?.find((t) => t.songId === song.id);

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

  const togglePlayAudio = useCallback(() => {
    if (useDspPlayer && dspPlayerRef.current) {
      if (dspPlayerRef.current.isPlaying) {
        dspPlayerRef.current.pause();
      } else {
        dspPlayerRef.current.play();
      }
      return;
    }
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlayingAudio(true);
        })
        .catch((err) => {
          console.warn('Could not play audio', err);
        });
    }
  }, [useDspPlayer, isPlayingAudio]);

  const handleEscapeGoBack = useCallback(() => {
    if (isStageModeOpen || isTunerOpen || isVisualizerOpen || hasActiveModalDialog()) {
      return false;
    }
    goBack({ name: 'catalog' });
    return true;
  }, [isStageModeOpen, isTunerOpen, isVisualizerOpen, goBack]);

  useEffect(() => {
    register('song-detail-go-back', {
      key: 'Escape',
      priority: SHORTCUT_PRIORITY.NAVIGATION,
      description: 'Volver al catálogo',
      when: () => !isStageModeOpen && !isTunerOpen && !isVisualizerOpen && !hasActiveModalDialog(),
      callback: handleEscapeGoBack
    });
    return () => unregister('song-detail-go-back');
  }, [register, unregister, isStageModeOpen, isTunerOpen, isVisualizerOpen, handleEscapeGoBack]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isStageModeOpen || isTunerOpen || isVisualizerOpen || hasActiveModalDialog()) return;
      if (isEditableTarget(e.target)) {
        return;
      }
      if (e.key === ' ' && (resolvedAudioUrl || song.audioUrl)) {
        e.preventDefault();
        togglePlayAudio();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [song.audioUrl, resolvedAudioUrl, togglePlayAudio, isStageModeOpen, isTunerOpen, isVisualizerOpen]);

  const handleTimeUpdate = () => {
    if (useDspPlayer) return;
    if (audioRef.current) {
      const t = audioRef.current.currentTime;
      if (loopStart !== null && loopEnd !== null && loopEnd > loopStart && t >= loopEnd) {
        audioRef.current.currentTime = loopStart;
        setCurrentTime(loopStart);
      } else {
        setCurrentTime(t);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && !useDspPlayer) {
      setDuration(audioRef.current.duration);
    }
  };

  const seekAudio = (time: number) => {
    setCurrentTime(time);
    if (useDspPlayer && dspPlayerRef.current) {
      dspPlayerRef.current.seek(time);
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekAudio(parseFloat(e.target.value));
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (useDspPlayer && dspPlayerRef.current) {
      dspPlayerRef.current.setPlaybackRate(rate);
    } else if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleEqModeChange = (mode: AudioEqMode) => {
    setEqMode(mode);
    if (useDspPlayer && dspPlayerRef.current) {
      dspPlayerRef.current.setEqMode(mode);
    }
  };

  const handleSetLoopA = () => {
    const a = currentTime;
    const b = loopEnd !== null && loopEnd > a + 0.25 ? loopEnd : null;
    setLoopStart(a);
    setLoopEnd(b);
    dspPlayerRef.current?.setLoop(a, b);
  };

  const handleSetLoopB = () => {
    const a = loopStart ?? Math.max(0, currentTime - 4);
    const b = Math.max(a + 0.5, currentTime);
    setLoopStart(a);
    setLoopEnd(b);
    dspPlayerRef.current?.setLoop(a, b);
  };

  const handleClearLoop = () => {
    setLoopStart(null);
    setLoopEnd(null);
    dspPlayerRef.current?.clearLoop();
  };

  const handleSaveSyncedLyrics = (newLines: SyncedLyricLine[], rawLrc: string) => {
    if (!isAuthor) return;
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
    setSemitones((prev) => {
      const next = prev + delta;
      return next > 11 ? next - 12 : next < -11 ? next + 12 : next;
    });
  };

  const handleCopyLyrics = () => {
    const transposed = transposeLyrics(song.lyrics, semitones, accidentalPreference);
    const textToCopy = showChords ? transposed : transposed.replace(/\[[^\]]+\]/g, '');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportSongToPdf(song, {
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
  const uniqueSongChords = useMemo(
    () => extractUniqueChordsFromLyrics(transposedLyrics),
    [transposedLyrics]
  );
  const sectionProgressions = useMemo(
    () => extractSectionProgressions(transposedLyrics),
    [transposedLyrics]
  );

  const stopProgressionPlayback = () => {
    progressionHandleRef.current?.stop();
    progressionHandleRef.current = null;
    setPlayingProgressionId(null);
    setActiveProgressionStep(null);
  };

  const handleToggleProgression = (progId: string, chords: string[]) => {
    if (playingProgressionId === progId) {
      stopProgressionPlayback();
      return;
    }
    stopProgressionPlayback();
    if (chords.length === 0) return;

    setPlayingProgressionId(progId);
    progressionHandleRef.current = playChordProgression(chords, {
      tempo: song.tempo || 96,
      timeSignature: song.timeSignature || '4/4',
      instrument,
      tuning: song.tuning,
      onChordChange: (idx) => setActiveProgressionStep({ id: progId, index: idx }),
      onEnded: () => {
        setPlayingProgressionId(null);
        setActiveProgressionStep(null);
        progressionHandleRef.current = null;
      }
    });
  };

  const handleExportChordPro = () => {
    downloadChordProFile(song, {
      semitones,
      accidentalPreference,
      capoFret
    });
  };

  const handleExportMidi = () => {
    const events = buildTimedChordEventsFromSong(
      {
        lyrics: transposedLyrics,
        tempo: song.tempo,
        timeSignature: song.timeSignature
      },
      {
        tempoOverride: song.tempo,
        timeSignatureOverride: song.timeSignature
      }
    );
    if (events.length === 0) return;
    const midiBytes = exportChordsToMidiBytes(events, {
      title: song.title || 'Cancion',
      tempo: song.tempo || 96,
      timeSignature: song.timeSignature || '4/4',
      instrument,
      tuning: song.tuning
    });
    downloadMidiFile(midiBytes, `${song.id || 'cancion'}_progresion.mid`);
  };

  const formatDisplayedChord = (soundingChord: string): string => {
    if (notationView !== 'chords') {
      return chordToFunctionalSymbol(soundingChord, currentKey, notationView);
    }
    if (capoFret > 0 && instrument !== 'piano') {
      return chordShapeWithCapo(soundingChord, capoFret, accidentalPreference);
    }
    return soundingChord;
  };

  const handleInlineChordClick = (soundingChord: string) => {
    setActiveChordDiagram(soundingChord);
    playChordPreview(soundingChord, instrument, song.tuning);
  };

  const stageItems = useMemo(() => {
    if (songs.length === 0) return [{ song }];
    return songs.map((s) => ({ song: s }));
  }, [songs, song]);

  const stageInitialIndex = useMemo(() => {
    const idx = stageItems.findIndex((item) => item.song.id === song.id);
    return idx >= 0 ? idx : 0;
  }, [stageItems, song.id]);

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsTunerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Abrir afinador cromático por micrófono"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Afinador</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStageModeOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title="Modo Escenario a pantalla completa con WakeLock y soporte para pedal"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Modo Escenario</span>
          </button>

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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Canción</span>
              </button>

              <button
                onClick={() => setIsVisualizerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                title="Generar vídeo para YouTube con letra sincronizada (1080p / 720p / 360p)"
              >
                <Youtube className="w-3.5 h-3.5" />
                <span>Vídeo YouTube</span>
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
            type="button"
            onClick={handleExportChordPro}
            className="px-2 py-1.5 text-[11px] font-mono font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer border border-[var(--border-subtle)]"
            title="Exportar a formato ChordPro (.cho) compatible con OnSong / SongBook"
          >
            .cho
          </button>
          {uniqueSongChords.length > 0 && (
            <button
              type="button"
              onClick={handleExportMidi}
              className="px-2 py-1.5 text-[11px] font-mono font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer border border-[var(--border-subtle)]"
              title="Exportar progresión armónica a archivo MIDI (.mid)"
            >
              .mid
            </button>
          )}
          <button
            onClick={() => void handleExportPdf()}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
            title="Exportar PDF para atril"
          >
            <FileDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.print()}
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
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                completeness.percent >= 80
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Taller de Autor · {completeness.statusLabel} ({completeness.percent}%)
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    song.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {song.status === 'published' ? 'Publicada' : song.status === 'draft' ? 'Borrador' : 'Inédita'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{completeness.nextSuggestion}</p>
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

      {/* Album Linkage Banner */}
      {linkedAlbum && (
        <div className="mb-6 p-3.5 rounded-xl bg-[var(--accent-subtle)]/50 border border-[var(--accent-border)] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Disc className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="text-[var(--text-secondary)] truncate">
              Perteneciente al álbum <strong className="text-[var(--text-primary)]">{linkedAlbum.title}</strong>
              {trackInAlbum?.order && <span className="font-mono ml-1 font-semibold">· Pista #{trackInAlbum.order}</span>}
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

        <div className="flex flex-wrap items-center gap-3">
          {song.spotifyUrl && isSafeExternalUrl(song.spotifyUrl) && (
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
          {song.appleMusicUrl && isSafeExternalUrl(song.appleMusicUrl) && (
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
          {song.youtubeUrl && isSafeExternalUrl(song.youtubeUrl) && (
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
          {song.soundcloudUrl && isSafeExternalUrl(song.soundcloudUrl) && (
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

      {/* Audio Player & Drive Protection */}
      <SongDetailAudioPlayer
        song={song}
        isAuthor={isAuthor}
        resolvedAudioUrl={resolvedAudioUrl}
        useDspPlayer={useDspPlayer}
        semitones={semitones}
        syncAudioPitch={syncAudioPitch}
        onToggleSyncAudioPitch={() => setSyncAudioPitch((v) => !v)}
        onEditSong={onEdit}
        audioRef={audioRef}
        isPlayingAudio={isPlayingAudio}
        onTogglePlayAudio={togglePlayAudio}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onAudioEnded={() => setIsPlayingAudio(false)}
        onAudioError={(msg) => {
          setIsPlayingAudio(false);
          setDriveAudioError(msg);
        }}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        playbackRate={playbackRate}
        onSpeedChange={handleSpeedChange}
        loopStart={loopStart}
        loopEnd={loopEnd}
        onSetLoopA={handleSetLoopA}
        onSetLoopB={handleSetLoopB}
        onClearLoop={handleClearLoop}
        eqMode={eqMode}
        onEqModeChange={handleEqModeChange}
        isLoadingDriveAudio={isLoadingDriveAudio}
        driveAudioError={driveAudioError}
        driveTokenStatus={driveTokenStatus}
        onLoginWithGoogle={loginWithGoogle}
      />

      {/* Content Toolbar */}
      <SongDetailToolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentKey={currentKey}
        semitones={semitones}
        onTranspose={handleTranspose}
        onResetTranspose={() => setSemitones(0)}
        accidentalPreference={accidentalPreference}
        onToggleAccidentalPreference={() =>
          setAccidentalPreference((prev) => (prev === 'sharps' ? 'flats' : 'sharps'))
        }
        showChords={showChords}
        onToggleShowChords={() => setShowChords((prev) => !prev)}
        chordPosition={chordPosition}
        onChordPositionChange={handleChordPositionChange}
        fontSize={fontSize}
        onFontSizeChange={handleFontSizeChange}
        tempo={song.tempo}
        timeSignature={song.timeSignature}
        isAutoScrolling={isAutoScrolling}
        onToggleAutoScroll={() => setIsAutoScrolling((prev) => !prev)}
        scrollSpeed={scrollSpeed}
        onScrollSpeedChange={setScrollSpeed}
        sectionProgressions={sectionProgressions}
        playingProgressionId={playingProgressionId}
        onToggleProgression={handleToggleProgression}
        copied={copied}
        onCopyLyrics={handleCopyLyrics}
      />

      {/* Dynamic SVG Chord Diagrams, Capo Calculator & Roman/Nashville View */}
      {activeTab === 'lyrics' && showChords && uniqueSongChords.length > 0 && (
        <SongChordsBar
          chords={uniqueSongChords}
          soundingKey={currentKey}
          tuning={song.tuning}
          capoFret={capoFret}
          onCapoChange={setCapoFret}
          instrument={instrument}
          onInstrumentChange={setInstrument}
          notationView={notationView}
          onNotationViewChange={setNotationView}
          accidentalPreference={accidentalPreference}
          activeChord={activeChordDiagram}
          onChordSelect={setActiveChordDiagram}
        />
      )}

      {/* Main Tab Views */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-10 shadow-sm min-h-[450px]">
        {activeTab === 'lyrics' && (
          <SongDetailLyricsRenderer
            transposedLyrics={transposedLyrics}
            showChords={showChords}
            chordPosition={chordPosition}
            fontSize={fontSize}
            sectionProgressions={sectionProgressions}
            playingProgressionId={playingProgressionId}
            activeProgressionStep={activeProgressionStep}
            onToggleProgression={handleToggleProgression}
            onInlineChordClick={handleInlineChordClick}
            formatDisplayedChord={formatDisplayedChord}
          />
        )}

        {activeTab === 'synced_lyrics' && (
          <Suspense fallback={<div className="py-12 text-center text-xs text-[var(--text-muted)]">Cargando letras sincronizadas...</div>}>
            <SyncedLyrics
              lines={syncedLines}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlayingAudio}
              onSeek={seekAudio}
              onTogglePlay={togglePlayAudio}
              metadata={lrcMetadata}
              songTitle={song.title}
              showChords={showChords}
              fontSize={fontSize}
              onSaveToSong={isAuthor ? handleSaveSyncedLyrics : undefined}
            />
          </Suspense>
        )}

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
                <span className="font-medium text-[var(--text-primary)]">
                  {song.tuning || 'Estándar (EADGBE)'}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block mb-1">Compás</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {song.timeSignature || '4/4'}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block mb-1">Tono Principal</span>
                <span className="font-medium font-mono text-[var(--text-primary)]">
                  {song.key || 'Am'}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block mb-1">Tempo</span>
                <span className="font-medium font-mono text-[var(--text-primary)]">
                  {song.tempo ? `${song.tempo} BPM` : 'No especificado'}
                </span>
              </div>
            </div>
          </div>
        )}

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

      {isVisualizerOpen && (
        <Suspense fallback={null}>
          <SongVideoVisualizerModal
            song={song}
            onClose={() => setIsVisualizerOpen(false)}
          />
        </Suspense>
      )}

      {isTunerOpen && (
        <Suspense fallback={null}>
          <ChromaticTunerModal
            initialTuning={song.tuning}
            initialA4Hz={song.audioAnalysis?.referenceA4Hz || 440}
            onClose={() => setIsTunerOpen(false)}
          />
        </Suspense>
      )}

      {isStageModeOpen && (
        <Suspense fallback={null}>
          <StageModeOverlay
            items={stageItems}
            initialIndex={stageInitialIndex}
            initialSemitones={semitones}
            initialCapoFret={capoFret}
            initialInstrument={instrument}
            initialNotationView={notationView}
            accidentalPreference={accidentalPreference}
            onCapoChange={(nextCapo, activeSong) => {
              if (activeSong.id === song.id) {
                setCapoFret(nextCapo);
              }
            }}
            onSemitonesChange={(nextSemitones, activeSong) => {
              if (activeSong.id === song.id) {
                setSemitones(nextSemitones);
              }
            }}
            onClose={() => setIsStageModeOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};
