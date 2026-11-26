import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { resolveAppUrl } from '../utils/appUrl';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cloud,
  FileAudio,
  FileCode,
  FileText,
  FolderGit2,
  Sparkles
} from 'lucide-react';
import { Song, SongStatus, SavedAudioAnalysis } from '../types/song';
import { Album } from '../types/album';
import {
  songToMarkdown,
  markdownToSong,
  transposeChord,
  transposeLyrics,
  respellChord,
  respellLyrics,
  isValidPlayableAudioUrl,
  AccidentalPreference
} from '../utils/markdownParser';
import { GitHubSyncService, PushResult } from '../services/githubSyncService';
import { useAuth } from '../context/AuthContext';
import { AuthorAccessGuard } from '../components/AuthorAccessGuard';
import { GoogleDriveService } from '../services/googleDriveService';
import { ChordSegment } from '../lib/audio/chords';
import type { MusicalSection } from '../lib/audio/structure';
import { insertChordsIntoSyllables } from '../lib/lyrics/lyricsChordIntegration';
import {
  serializeToLrc,
  stripChordsFromText,
  copyLyricsToLrcFormat,
  copyLrcToLyricsFormat
} from '../lib/lyrics/parseLrc';
import { LyricsTranscriptionService } from '../services/lyricsTranscriptionService';
import { LyricsTranscriptionResult } from '../types/transcription';
import { useAppNavigation } from '../context/NavigationContext';
import {
  extractMp3Metadata,
  ExtractedMp3Metadata,
  Mp3FieldKey
} from '../lib/audio/mp3Metadata';
import {
  calculateSongCompleteness,
  SONGWRITING_TEMPLATES,
  insertSectionHeaderAtCursor
} from '../utils/songwriterHelper';
import { exportSongToPdf } from '../utils/pdfGenerator';
import {
  MusicalMode,
  buildHarmonicPalette,
  suggestNextChords,
  findLastChordBeforeCursor,
  HarmonicChordEntry
} from '../lib/music/harmonyEngine';
import {
  playChordProgression,
  ProgressionPlaybackHandle
} from '../lib/audio/chordSynth';
import {
  extractSectionProgressions,
  buildTimedChordEventsFromSong,
  exportChordsToMidiBytes,
  downloadMidiFile
} from '../lib/music/midiExporter';
import { analyzePoeticMetrics } from '../lib/lyrics/poeticAnalysis';
import { chordProToSong, downloadChordProFile } from '../lib/music/chordPro';
import { TapTempoTracker } from '../lib/audio/metronome';
import {
  useKeyboardShortcuts,
  SHORTCUT_PRIORITY,
  hasActiveModalDialog
} from '../hooks/useKeyboardShortcuts';
import {
  SongExportActions,
  EditorShortcutsDialog,
  EditorWorkbenchTab
} from '../components/editor/SongExportActions';
import { LyricsChordEditor } from '../components/editor/LyricsChordEditor';
import { SongAudioToolsPanel } from '../components/editor/SongAudioToolsPanel';
import { SongMetadataForm } from '../components/editor/SongMetadataForm';

const LrcSyncAssistant = lazy(() =>
  import('../components/LrcSyncAssistant').then((m) => ({ default: m.LrcSyncAssistant }))
);
const Mp3MetadataComparisonModal = lazy(() =>
  import('../components/Mp3MetadataComparisonModal').then((m) => ({ default: m.Mp3MetadataComparisonModal }))
);
const ChromaticTunerModal = lazy(() =>
  import('../components/ChromaticTunerModal').then((m) => ({ default: m.ChromaticTunerModal }))
);

interface SongEditorPageProps {
  song: Song | null;
  albums?: Album[];
  initialAlbumId?: string;
  initialAudioFile?: File;
  onSave: (song: Song, pushResult?: PushResult) => void;
  onDelete?: (song: Song) => void;
}

export const SongEditorPage: React.FC<SongEditorPageProps> = ({
  song,
  albums = [],
  initialAlbumId,
  initialAudioFile,
  onSave
}) => {
  const { navigate, goBack } = useAppNavigation();
  const { register, unregister } = useKeyboardShortcuts();
  const {
    token,
    isAuthenticated,
    user,
    isAuthor,
    isGoogleDriveConnected,
    driveTokenStatus
  } = useAuth();

  // Editor mode & active workbench tab
  const [editorMode, setEditorMode] = useState<'studio' | 'markdown'>('studio');
  const [activeTab, setActiveTab] = useState<EditorWorkbenchTab>('lyrics.md');

  // Menu bar state
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement | null>(null);

  // Form fields
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<SongStatus>('draft');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>(initialAlbumId || '');
  const [trackNumber, setTrackNumber] = useState<number | ''>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [genre, setGenre] = useState('');
  const [key, setKey] = useState('Am');
  const [tempo, setTempo] = useState<string>('96');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [tuning, setTuning] = useState('Estándar (EADGBE)');
  const [duration, setDuration] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [appleMusicUrl, setAppleMusicUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [soundcloudUrl, setSoundcloudUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [lrc, setLrc] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [customChordInput, setCustomChordInput] = useState<string>('');

  // Audio & Google Drive States
  const [driveFileId, setDriveFileId] = useState<string>(song?.driveFileId || '');
  const [driveFileName, setDriveFileName] = useState<string>(song?.driveFileName || '');
  const [isPrivateDemo, setIsPrivateDemo] = useState<boolean>(song?.isPrivateDemo ?? true);
  const [activeAudioFile, setActiveAudioFile] = useState<File | null>(initialAudioFile || null);
  const [, setIsUploadingToDrive] = useState<boolean>(false);
  const [, setDriveFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Audio Playback
  const [isPlayingLocalAudio, setIsPlayingLocalAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Analysis & Transcription States
  const [detectedChords, setDetectedChords] = useState<ChordSegment[]>([]);
  const [savedAudioAnalysis, setSavedAudioAnalysis] = useState<SavedAudioAnalysis | null>(song?.audioAnalysis || null);
  const [lyricsUndoHistory, setLyricsUndoHistory] = useState<string | null>(null);
  const [audioAnalysisNotice, setAudioAnalysisNotice] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionEngine, setTranscriptionEngine] = useState<'backend_gemini' | 'local_whisper'>('local_whisper');
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<'spanish' | 'english' | 'auto'>('spanish');
  const [hasServerApiKey, setHasServerApiKey] = useState<boolean | null>(null);
  const [backendConsent, setBackendConsent] = useState<boolean>(true);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [lastTranscriptionResult, setLastTranscriptionResult] = useState<LyricsTranscriptionResult | null>(null);
  const [audioStudioMode, setAudioStudioMode] = useState<'analyzer' | 'transcription'>('analyzer');

  // Split view live music stand preview & feedback
  const [showStandPreview, setShowStandPreview] = useState<boolean>(true);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Modals
  const [isSyncAssistantOpen, setIsSyncAssistantOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [pendingMp3Metadata, setPendingMp3Metadata] = useState<ExtractedMp3Metadata | null>(null);
  const [isMp3MetadataModalOpen, setIsMp3MetadataModalOpen] = useState<boolean>(false);
  const [mp3MetadataFileName, setMp3MetadataFileName] = useState<string>('');

  // Raw Markdown & Validation
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Git Push State
  const [pushToGitHub] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  // Cursor tracking
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [cursorOffset, setCursorOffset] = useState<number>(0);
  const lyricsTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Harmonic Theory, Tuner, Tap Tempo, Poetic & Progression Preview states
  const [musicalMode, setMusicalMode] = useState<MusicalMode | 'auto'>('auto');
  const [chordPaletteTab, setChordPaletteTab] = useState<HarmonicChordEntry['category']>('diatonic');
  const [isTunerOpen, setIsTunerOpen] = useState<boolean>(false);
  const [tapCount, setTapCount] = useState<number>(0);
  const tapTrackerRef = useRef<TapTempoTracker>(new TapTempoTracker());
  const [showPoeticAnalysis, setShowPoeticAnalysis] = useState<boolean>(false);
  const [playingProgressionId, setPlayingProgressionId] = useState<string | null>(null);
  const [activeProgressionStep, setActiveProgressionStep] = useState<{ id: string; index: number } | null>(null);
  const progressionHandleRef = useRef<ProgressionPlaybackHandle | null>(null);
  const chordProInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const processedInitialAudioRef = useRef<File | null>(null);

  // Initialize fields on load or change
  useEffect(() => {
    if (song) {
      setId(song.id);
      setTitle(song.title);
      setStatus(song.status);
      setSelectedAlbumId(song.albumId || initialAlbumId || '');
      setTrackNumber(song.trackNumber ?? '');
      setYear(song.year);
      setGenre(song.genre || 'Canción de Autor');
      setKey(song.key || 'Am');
      setTempo(song.tempo ? song.tempo.toString() : '96');
      setTimeSignature(song.timeSignature || '4/4');
      setTuning(song.tuning || 'Estándar (EADGBE)');
      setDuration(song.duration || '');
      setSpotifyUrl(song.spotifyUrl || '');
      setAppleMusicUrl(song.appleMusicUrl || '');
      setYoutubeUrl(song.youtubeUrl || '');
      setSoundcloudUrl(song.soundcloudUrl || '');
      setAudioUrl(song.audioUrl || '');
      setDriveFileId(song.driveFileId || '');
      setDriveFileName(song.driveFileName || '');
      setIsPrivateDemo(song.isPrivateDemo ?? true);
      setNotes(song.notes || '');
      setLyrics(song.lyrics);
      setLrc(song.lrc || '');
      setTags(song.tags || []);
      setRawMarkdown(songToMarkdown(song));
      setCommitMessage(`feat: actualizar canción "${song.title}"`);
      setSavedAudioAnalysis(song.audioAnalysis || null);
      setLyricsUndoHistory(null);
      if (song.audioAnalysis?.chords && song.audioAnalysis.chords.length > 0) {
        setDetectedChords(song.audioAnalysis.chords);
      }
    } else {
      const autoId = `cancion-${Date.now()}`;
      setId(autoId);
      setTitle('');
      setStatus('draft');
      setSelectedAlbumId(initialAlbumId || '');
      setTrackNumber('');
      setYear(new Date().getFullYear());
      setGenre('Canción de Autor');
      setKey('Am');
      setTempo('96');
      setTimeSignature('4/4');
      setTuning('Estándar (EADGBE)');
      setDuration('');
      setSpotifyUrl('');
      setAppleMusicUrl('');
      setYoutubeUrl('');
      setSoundcloudUrl('');
      setAudioUrl('');
      setDriveFileId('');
      setDriveFileName('');
      setIsPrivateDemo(true);
      setNotes('');
      setLyrics(
        `## Intro\n[Am]  [G]  [F]  [E7]\n\n## Estrofa 1\n[Am] Escribe aquí el primer verso de la canción...\n[G] Segundo verso con acordes anotados\n\n## Estribillo\n[C] Y aquí el estribillo que eleva la voz...\n[G] Con notas claras y verdades pequeñas.`
      );
      setLrc('');
      setTags(['acústico', 'maqueta']);
      setCommitMessage('feat: nueva composición en el cancionero');
      setSavedAudioAnalysis(null);
      setLyricsUndoHistory(null);
      setDetectedChords([]);
    }
  }, [song, initialAlbumId]);

  // Check backend server configuration for available transcription engines
  useEffect(() => {
    let cancelled = false;
    fetch(resolveAppUrl('api/health'))
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const hasKey = Boolean(data?.hasGeminiKey);
        setHasServerApiKey(hasKey);
        setTranscriptionEngine(hasKey ? 'backend_gemini' : 'local_whisper');
      })
      .catch(() => {
        if (cancelled) return;
        setHasServerApiKey(false);
        setTranscriptionEngine('local_whisper');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Audio Upload & Google Drive Handler
  const handleAudioFileChosen = useCallback(
    async (file: File) => {
      setActiveAudioFile(file);
      const localUrl = URL.createObjectURL(file);
      setAudioUrl(localUrl);

      try {
        const extracted = await extractMp3Metadata(file);
        if (extracted.hasAnyMetadata && extracted.detectedFieldsCount > 0) {
          setPendingMp3Metadata(extracted);
          setMp3MetadataFileName(file.name);
          setIsMp3MetadataModalOpen(true);
        } else if (!title.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setTitle(cleanName);
        }
      } catch (metaErr) {
        console.warn('Error al leer metadatos MP3:', metaErr);
        if (!title.trim()) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setTitle(cleanName);
        }
      }

      if (isGoogleDriveConnected) {
        setIsUploadingToDrive(true);
        setDriveFeedback({
          type: 'info',
          message: `Guardando "${file.name}" en tu Google Drive seguro...`
        });

        try {
          const songId = song?.id || id || `cancion-${Date.now()}`;
          const cleanTitle = (title || file.name.replace(/\.[^/.]+$/, '')).trim();
          const driveName = `Maqueta_${cleanTitle}_${file.name}`;
          const uploaded = await GoogleDriveService.uploadAudioFile(file, driveName, {
            songId,
            title: cleanTitle
          });

          setDriveFileId(uploaded.id);
          setDriveFileName(uploaded.name);
          setDriveFeedback({
            type: 'success',
            message: `Maqueta almacenada con éxito en Google Drive (${uploaded.name}).`
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Comprueba tu conexión.';
          setDriveFeedback({
            type: 'error',
            message: `Error al subir a Google Drive: ${message}`
          });
        } finally {
          setIsUploadingToDrive(false);
        }
      } else if (driveTokenStatus === 'expired') {
        setDriveFeedback({
          type: 'error',
          message: 'Tu acceso a Google Drive ha caducado. Renueva la sesión en "Autor" para subir la maqueta.'
        });
      } else {
        setDriveFeedback({
          type: 'info',
          message: 'Audio cargado en memoria listo para reproducir y detectar tono y tempo.'
        });
      }
    },
    [driveTokenStatus, id, isGoogleDriveConnected, song?.id, title]
  );

  // Handle initialAudioFile if passed
  useEffect(() => {
    if (initialAudioFile && processedInitialAudioRef.current !== initialAudioFile) {
      processedInitialAudioRef.current = initialAudioFile;
      void handleAudioFileChosen(initialAudioFile);
      setActiveTab('audio-studio.dsp');
    }
  }, [initialAudioFile, handleAudioFileChosen]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Stop progression preview playback and timers on unmount
  useEffect(() => {
    return () => {
      progressionHandleRef.current?.stop();
      progressionHandleRef.current = null;
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
      if (!LyricsTranscriptionService.hasPendingRequests()) {
        LyricsTranscriptionService.dispose();
      }
    };
  }, []);

  // Toast feedback helper
  const showFeedback = useCallback((msg: string) => {
    setFeedbackToast(msg);
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedbackToast(null);
      feedbackTimeoutRef.current = null;
    }, 3500);
  }, []);

  const handleToggleStandPreview = useCallback(() => {
    const next = !showStandPreview;
    setShowStandPreview(next);
    showFeedback(next ? 'Vista de atril activada' : 'Vista de atril oculta');
  }, [showStandPreview, showFeedback]);

  // Save / Submit
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setValidationError(null);

      let songToSave: Song;

      if (editorMode === 'markdown') {
        try {
          const parsed = markdownToSong(rawMarkdown, id || `cancion-${Date.now()}`);
          if (!parsed.title.trim()) {
            setValidationError('La canción debe tener un título válido en el frontmatter.');
            return;
          }
          songToSave = {
            ...parsed,
            albumId: selectedAlbumId || undefined,
            trackNumber: typeof trackNumber === 'number' ? trackNumber : undefined,
            driveFileId: driveFileId || parsed.driveFileId || undefined,
            driveFileName: driveFileName || parsed.driveFileName || undefined,
            isPrivateDemo: isPrivateDemo ?? parsed.isPrivateDemo ?? true,
            audioAnalysis: parsed.audioAnalysis || savedAudioAnalysis || undefined,
            updatedAt: new Date().toISOString()
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          setValidationError(`Error en formato Markdown: ${message}`);
          return;
        }
      } else {
        if (!title.trim()) {
          setValidationError('Por favor ingresa un título para la canción.');
          setActiveTab('metadata.json');
          return;
        }

        const songId = song?.id || id || `cancion-${Date.now()}`;
        const chosenAlbum = albums.find((a) => a.id === selectedAlbumId);

        songToSave = {
          id: songId,
          title: title.trim(),
          status,
          albumId: selectedAlbumId || undefined,
          albumTitle: chosenAlbum?.title || undefined,
          trackNumber: typeof trackNumber === 'number' && !isNaN(trackNumber) ? trackNumber : undefined,
          year: year || new Date().getFullYear(),
          genre: genre.trim() || 'Canción de Autor',
          key: key.trim() || 'Am',
          tempo: tempo ? parseInt(tempo, 10) : undefined,
          timeSignature: timeSignature.trim() || '4/4',
          tuning: tuning.trim() || 'Estándar (EADGBE)',
          duration: duration.trim() || undefined,
          spotifyUrl: spotifyUrl.trim() || undefined,
          appleMusicUrl: appleMusicUrl.trim() || undefined,
          youtubeUrl: youtubeUrl.trim() || undefined,
          soundcloudUrl: soundcloudUrl.trim() || undefined,
          audioUrl: audioUrl.trim() || undefined,
          driveFileId: driveFileId.trim() || undefined,
          driveFileName: driveFileName.trim() || undefined,
          isPrivateDemo,
          notes: notes.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
          lyrics: lyrics.trim(),
          lrc: lrc.trim() || undefined,
          audioAnalysis: savedAudioAnalysis || undefined,
          createdAt: song?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      let pushResult: PushResult | undefined = undefined;
      if (pushToGitHub && (isAuthenticated || token)) {
        setIsPushing(true);
        try {
          const config = GitHubSyncService.getRemoteConfig(user?.login);
          pushResult = await GitHubSyncService.pushSongFile(
            songToSave,
            commitMessage || `feat: actualizar ${songToSave.title}`,
            token,
            config
          );
        } catch (err) {
          console.warn('Push warning:', err);
        } finally {
          setIsPushing(false);
        }
      }

      onSave(songToSave, pushResult);
      navigate({ name: 'song-detail', songId: songToSave.id });
    },
    [
      editorMode,
      rawMarkdown,
      id,
      selectedAlbumId,
      trackNumber,
      driveFileId,
      driveFileName,
      isPrivateDemo,
      savedAudioAnalysis,
      title,
      song,
      albums,
      status,
      year,
      genre,
      key,
      tempo,
      timeSignature,
      tuning,
      duration,
      spotifyUrl,
      appleMusicUrl,
      youtubeUrl,
      soundcloudUrl,
      audioUrl,
      notes,
      tags,
      lyrics,
      lrc,
      pushToGitHub,
      isAuthenticated,
      token,
      user,
      commitMessage,
      onSave,
      navigate
    ]
  );

  // Register Escape priorities for editor modal & dropdown overlay
  useEffect(() => {
    if (!isAuthor) return;

    register('song-editor-shortcuts-escape', {
      key: 'Escape',
      priority: SHORTCUT_PRIORITY.MODAL,
      allowInEditable: true,
      description: 'Cerrar ayuda de atajos del editor',
      when: () => isShortcutsModalOpen,
      callback: () => {
        setIsShortcutsModalOpen(false);
        return true;
      }
    });

    register('song-editor-menu-escape', {
      key: 'Escape',
      priority: SHORTCUT_PRIORITY.OVERLAY,
      allowInEditable: true,
      description: 'Cerrar menú del editor',
      when: () =>
        openMenu !== null &&
        !hasActiveModalDialog() &&
        !isSyncAssistantOpen &&
        !isMp3MetadataModalOpen &&
        !isTunerOpen,
      callback: () => {
        setOpenMenu(null);
        return true;
      }
    });

    return () => {
      unregister('song-editor-shortcuts-escape');
      unregister('song-editor-menu-escape');
    };
  }, [
    isAuthor,
    register,
    unregister,
    isShortcutsModalOpen,
    openMenu,
    isSyncAssistantOpen,
    isMp3MetadataModalOpen,
    isTunerOpen
  ]);

  // Editor Keyboard Shortcuts (Ctrl+S, Ctrl+B) with explicit dependency array
  useEffect(() => {
    if (!isAuthor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSubmit();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleStandPreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthor, handleSubmit, handleToggleStandPreview]);

  // Dynamic Harmonic Palette & Contextual Next-Chord Suggestions
  const harmonicPalette = useMemo(
    () => buildHarmonicPalette(key, musicalMode === 'auto' ? undefined : musicalMode),
    [key, musicalMode]
  );

  const activeCategoryChords = useMemo<HarmonicChordEntry[]>(() => {
    switch (chordPaletteTab) {
      case 'seventh':
        return harmonicPalette.diatonicSevenths;
      case 'secondary_dominant':
        return harmonicPalette.secondaryDominants;
      case 'modal_interchange':
        return harmonicPalette.modalInterchange;
      case 'diatonic':
      default:
        return harmonicPalette.diatonicTriads;
    }
  }, [harmonicPalette, chordPaletteTab]);

  const lastChordBeforeCursor = useMemo(
    () => findLastChordBeforeCursor(lyrics, cursorOffset || lyrics.length),
    [lyrics, cursorOffset]
  );

  const contextualNextChords = useMemo(
    () => suggestNextChords(lastChordBeforeCursor, key, musicalMode === 'auto' ? undefined : musicalMode),
    [lastChordBeforeCursor, key, musicalMode]
  );

  const completeness = useMemo(
    () =>
      calculateSongCompleteness({
        title,
        lyrics,
        key,
        tempo,
        audioUrl,
        driveFileId,
        spotifyUrl,
        youtubeUrl,
        soundcloudUrl,
        lrc,
        status
      }),
    [title, lyrics, key, tempo, audioUrl, driveFileId, spotifyUrl, youtubeUrl, soundcloudUrl, lrc, status]
  );

  const updateCursorPosition = () => {
    const textarea = lyricsTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    setCursorOffset(start);
    const linesBefore = textarea.value.substring(0, start).split('\n');
    setCursorPos({ line: linesBefore.length, col: linesBefore[linesBefore.length - 1].length + 1 });
  };

  const handleTapTempo = () => {
    const res = tapTrackerRef.current.tap();
    setTapCount(res.tapCount);
    if (res.bpm !== null) {
      setTempo(String(res.bpm));
      showFeedback(`Tempo marcado: ${res.bpm} BPM`);
    }
  };

  const handleInsertChordAtCursor = (chordName: string) => {
    const textarea = lyricsTextareaRef.current;
    const chordTag = `[${chordName}]`;

    if (!textarea) {
      setLyrics((prev) => prev + ` ${chordTag}`);
      showFeedback(`Acorde ${chordTag} añadido`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = lyrics;
    let nextText = '';
    let newCursorPos = start + chordTag.length;

    if (start === end) {
      nextText = current.substring(0, start) + chordTag + current.substring(end);
    } else {
      const selected = current.substring(start, end);
      nextText = current.substring(0, start) + chordTag + selected + current.substring(end);
      newCursorPos = start + chordTag.length + selected.length;
    }

    const prevScrollTop = textarea.scrollTop;
    setLyrics(nextText);
    showFeedback(`Acorde ${chordTag} insertado`);

    setTimeout(() => {
      textarea.scrollTop = prevScrollTop;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
      updateCursorPosition();
    }, 0);
  };

  const handleAddCustomChord = () => {
    const clean = customChordInput.trim();
    if (clean) {
      handleInsertChordAtCursor(clean);
      setCustomChordInput('');
    }
  };

  const handleInsertSection = (sectionName: string) => {
    const textarea = lyricsTextareaRef.current;

    if (!textarea) {
      const trimmed = lyrics.trimEnd();
      const block = trimmed ? `\n\n## ${sectionName}\n` : `## ${sectionName}\n`;
      setLyrics(trimmed + block);
      showFeedback(`Sección ${sectionName} añadida`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prevScrollTop = textarea.scrollTop;
    const { text: nextText, cursorOffset: nextCursorPos } = insertSectionHeaderAtCursor(
      lyrics,
      sectionName,
      start,
      end
    );

    setLyrics(nextText);
    showFeedback(`Sección ${sectionName} insertada`);

    setTimeout(() => {
      textarea.scrollTop = prevScrollTop;
      textarea.setSelectionRange(nextCursorPos, nextCursorPos);
      textarea.focus();
      updateCursorPosition();
    }, 0);
  };

  const handleApplyTemplate = (templateKey: string) => {
    const tpl = SONGWRITING_TEMPLATES.find((t) => t.id === templateKey);
    if (!tpl) return;
    if (lyrics.trim() && !window.confirm(`¿Reemplazar la letra actual por la plantilla "${tpl.title}"?`)) {
      return;
    }
    setLyrics(tpl.lyrics);
    if (tpl.key) setKey(tpl.key);
    if (tpl.tempo) setTempo(tpl.tempo.toString());
    if (tpl.timeSignature) setTimeSignature(tpl.timeSignature);
    showFeedback(`Plantilla "${tpl.title}" aplicada`);
  };

  const handleTransposeLyrics = (delta: number) => {
    const nextKey = transposeChord(key || 'Am', delta, accidentalPreference);
    setKey(nextKey);
    setLyrics(transposeLyrics(lyrics, delta, accidentalPreference));
    showFeedback(`Tono transmutado a ${nextKey} (${delta > 0 ? `+${delta}` : delta} semitono)`);
  };

  const handleToggleAccidentals = () => {
    const nextPref: AccidentalPreference = accidentalPreference === 'sharps' ? 'flats' : 'sharps';
    setAccidentalPreference(nextPref);
    setLyrics(respellLyrics(lyrics, nextPref));
    setKey(respellChord(key || 'Am', nextPref));
    showFeedback(`Notación cambiada a ${nextPref === 'sharps' ? 'Sostenidos (#)' : 'Bemoles (b)'}`);
  };

  const handleStripChords = () => {
    if (!lyrics.trim()) return;
    setLyrics(stripChordsFromText(lyrics));
    showFeedback('Acordes entre corchetes eliminados');
  };

  const handleExportCurrentPdf = () => {
    const songSnapshot: Song = {
      id: id || `cancion-${Date.now()}`,
      title: title || 'Sin título',
      status,
      albumId: selectedAlbumId || undefined,
      genre: genre || 'Canción de Autor',
      key,
      tempo: tempo ? parseInt(tempo, 10) : undefined,
      timeSignature,
      tuning,
      lyrics,
      notes: notes || undefined,
      year,
      createdAt: song?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    void exportSongToPdf(songSnapshot, {
      showChords: true,
      chordPosition: 'above',
      accidentalPreference
    });
    showFeedback('Generando PDF de atril para imprimir...');
  };

  const poeticAnalysis = useMemo(
    () => (showPoeticAnalysis ? analyzePoeticMetrics(lyrics) : null),
    [lyrics, showPoeticAnalysis]
  );

  const sectionProgressions = useMemo(() => extractSectionProgressions(lyrics), [lyrics]);

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

    const parsedTempo = parseInt(tempo, 10);
    setPlayingProgressionId(progId);
    progressionHandleRef.current = playChordProgression(chords, {
      tempo: Number.isFinite(parsedTempo) && parsedTempo > 0 ? parsedTempo : 96,
      timeSignature: timeSignature || '4/4',
      instrument: 'guitar',
      tuning,
      onChordChange: (idx) => setActiveProgressionStep({ id: progId, index: idx }),
      onEnded: () => {
        setPlayingProgressionId(null);
        setActiveProgressionStep(null);
        progressionHandleRef.current = null;
      }
    });
  };

  const handleExportCurrentMidi = () => {
    const parsedTempo = parseInt(tempo, 10);
    const effectiveTempo = Number.isFinite(parsedTempo) && parsedTempo > 0 ? parsedTempo : 96;
    const events = buildTimedChordEventsFromSong(
      { lyrics, tempo: effectiveTempo, timeSignature },
      { tempoOverride: effectiveTempo, timeSignatureOverride: timeSignature }
    );
    if (events.length === 0) {
      showFeedback('Añade al menos un acorde [Am] para exportar a MIDI');
      return;
    }
    const midiBytes = exportChordsToMidiBytes(events, {
      title: title || 'Composicion',
      tempo: effectiveTempo,
      timeSignature: timeSignature || '4/4',
      instrument: 'guitar',
      tuning
    });
    downloadMidiFile(midiBytes, `${id || 'cancion'}_progresion.mid`);
    showFeedback('Archivo MIDI (.mid) descargado');
  };

  const handleExportCurrentChordPro = () => {
    const songSnapshot: Song = {
      id: id || `cancion-${Date.now()}`,
      title: title || 'Sin título',
      status,
      albumId: selectedAlbumId || undefined,
      genre: genre || 'Canción de Autor',
      key,
      tempo: tempo ? parseInt(tempo, 10) : undefined,
      timeSignature,
      tuning,
      lyrics,
      notes: notes || undefined,
      year,
      createdAt: song?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    downloadChordProFile(songSnapshot, { accidentalPreference });
    showFeedback('Archivo ChordPro (.cho) descargado');
  };

  const handleImportChordProFile = async (file: File) => {
    try {
      const content = await file.text();
      const fallbackTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const parsed = chordProToSong(content, fallbackTitle);

      if (lyrics.trim() && !lyrics.includes('Escribe aquí el primer verso')) {
        setLyricsUndoHistory(lyrics);
      }

      setTitle(parsed.title || fallbackTitle);
      setLyrics(parsed.lyrics);
      if (parsed.key) setKey(parsed.key);
      if (parsed.tempo) setTempo(String(parsed.tempo));
      if (parsed.timeSignature) setTimeSignature(parsed.timeSignature);
      if (parsed.tuning) setTuning(parsed.tuning);
      if (parsed.genre) setGenre(parsed.genre);
      if (parsed.year) setYear(parsed.year);
      if (parsed.notes) {
        setNotes((prev) => (prev ? `${prev}\n${parsed.notes}` : parsed.notes || ''));
      }
      setEditorMode('studio');
      setActiveTab('lyrics.md');
      showFeedback(`ChordPro "${parsed.title}" importado al editor`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'formato inválido';
      showFeedback(`No se pudo importar el archivo ChordPro: ${message}`);
    }
  };

  const handleApplyMp3Fields = (selectedFields: Partial<Record<Mp3FieldKey, string | number>>) => {
    const updatedNames: string[] = [];

    if (selectedFields.title !== undefined) {
      setTitle(String(selectedFields.title));
      updatedNames.push('Título');
    }
    if (selectedFields.lyrics !== undefined) {
      setLyricsUndoHistory(lyrics);
      setLyrics(String(selectedFields.lyrics));
      updatedNames.push('Letra');
    }
    if (selectedFields.lrc !== undefined) {
      setLrc(String(selectedFields.lrc));
      updatedNames.push('Letra sincronizada');
    }
    if (selectedFields.key !== undefined) {
      setKey(String(selectedFields.key));
      updatedNames.push('Tono');
    }
    if (selectedFields.tempo !== undefined) {
      setTempo(String(selectedFields.tempo));
      updatedNames.push('Tempo');
    }
    if (selectedFields.year !== undefined) {
      setYear(Number(selectedFields.year));
      updatedNames.push('Año');
    }
    if (selectedFields.genre !== undefined) {
      setGenre(String(selectedFields.genre));
      updatedNames.push('Género');
    }
    if (selectedFields.notes !== undefined) {
      setNotes(String(selectedFields.notes));
      updatedNames.push('Notas');
    }
    if (selectedFields.timeSignature !== undefined) {
      setTimeSignature(String(selectedFields.timeSignature));
      updatedNames.push('Compás');
    }
    if (selectedFields.tuning !== undefined) {
      setTuning(String(selectedFields.tuning));
      updatedNames.push('Afinación');
    }
    if (selectedFields.albumTitle !== undefined) {
      const albumStr = String(selectedFields.albumTitle);
      const matched = albums.find((a) => a.title.toLowerCase() === albumStr.toLowerCase());
      if (matched) {
        setSelectedAlbumId(matched.id);
        updatedNames.push('Álbum');
      } else {
        setNotes((prev) => (prev ? `${prev}\nÁlbum original: ${albumStr}` : `Álbum original: ${albumStr}`));
        updatedNames.push('Álbum (en notas)');
      }
    }

    if (updatedNames.length > 0) {
      const msg = `¡Metadatos del MP3 actualizados! Se han sobreescrito ${updatedNames.length} campos: ${updatedNames.join(', ')}`;
      setAudioAnalysisNotice(msg);
      showFeedback(msg);
      setTimeout(() => setAudioAnalysisNotice(null), 6000);
    }
  };

  const handleApplyAudioDetection = (data: {
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
  }) => {
    if (data.tempo) setTempo(data.tempo.toString());
    if (data.key) setKey(data.key);
    if (data.timeSignature) setTimeSignature(data.timeSignature);
    if (data.tuning) setTuning(data.tuning);
    if (data.audioUrl) setAudioUrl(data.audioUrl);
    if (data.chords && data.chords.length > 0) {
      setDetectedChords(data.chords);
    }
    if (data.audioAnalysis) {
      setSavedAudioAnalysis(data.audioAnalysis);
    }
    if (data.chordProgression && !notes) {
      setNotes(`Progresión armónica detectada: ${data.chordProgression}`);
    }
    if (data.suggestedLyricsChords && (!lyrics || lyrics.includes('Escribe aquí el primer verso'))) {
      setLyrics(data.suggestedLyricsChords);
    }

    setAudioAnalysisNotice(
      `¡Detección acústica aplicada! Tono: ${data.key} · Tempo: ${data.tempo} BPM · Compás: ${data.timeSignature}`
    );
    showFeedback(`Tono ${data.key} y ${data.tempo} BPM aplicados a la canción`);
    setTimeout(() => setAudioAnalysisNotice(null), 5000);
  };

  const handleInsertDetectedChords = (
    chordsOverride?: ChordSegment[],
    sectionsOverride?: MusicalSection[]
  ) => {
    const list = chordsOverride || savedAudioAnalysis?.chords || detectedChords;
    if (!list || list.length === 0) {
      showFeedback('No hay acordes detectados disponibles');
      return;
    }

    setLyricsUndoHistory(lyrics);

    const updated = insertChordsIntoSyllables(lyrics, list, {
      lrcText: lrc || undefined,
      audioDuration: audioDuration || savedAudioAnalysis?.durationSeconds,
      tempo: tempo ? parseInt(tempo, 10) : savedAudioAnalysis?.tempo || 96,
      tempoOffset: savedAudioAnalysis?.tempoOffset,
      sections: sectionsOverride || savedAudioAnalysis?.sections
    });

    setLyrics(updated);
    showFeedback(`¡${list.length} acordes insertados en introducción, partes cantadas e instrumentales!`);
  };

  const handleUndoChordInsertion = () => {
    if (lyricsUndoHistory !== null) {
      setLyrics(lyricsUndoHistory);
      setLyricsUndoHistory(null);
      showFeedback('Inserción de acordes deshecha');
    }
  };

  const handleRunTranscription = async () => {
    if (!activeAudioFile) {
      setTranscriptionError('Selecciona o arrastra primero un archivo de audio para transcribir.');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      let result: LyricsTranscriptionResult;

      if (transcriptionEngine === 'backend_gemini') {
        if (!backendConsent) {
          throw new Error('Debes autorizar el procesamiento de audio para transcribir con Gemini AI.');
        }
        setTranscriptionProgress('Analizando voz cantada con Gemini AI en el servidor...');
        result = await LyricsTranscriptionService.transcribeWithBackendFromFile(activeAudioFile, backendConsent);
      } else {
        setTranscriptionProgress('Iniciando modelo Whisper local en el navegador...');
        const lang = transcriptionLanguage === 'auto' ? undefined : transcriptionLanguage;
        result = await LyricsTranscriptionService.transcribeLocalFromFile(
          activeAudioFile,
          {
            allowWasmFallback: true,
            language: lang
          },
          (message, statusMsg) => {
            setTranscriptionProgress(`[${statusMsg}] ${message}`);
          }
        );
      }

      setLastTranscriptionResult(result);
      const engineLabel = result.engine === 'local_whisper' ? 'Whisper Local' : 'Gemini AI';
      showFeedback(`Transcripción (${engineLabel}) completada: ${result.lines.length} versos detectados`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al procesar la transcripción de voz.';
      setTranscriptionError(message);
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(null);
    }
  };

  const handleApplyTranscribedLyrics = (replace: boolean) => {
    if (!lastTranscriptionResult?.text) return;
    const transcribed = lastTranscriptionResult.text;

    if (replace) {
      setLyrics(transcribed);
    } else {
      setLyrics((prev) => (prev.trim() ? `${prev.trim()}\n\n${transcribed}` : transcribed));
    }

    if (lastTranscriptionResult.lines.length > 0 && !lrc) {
      const generatedLrc = serializeToLrc(lastTranscriptionResult.lines, {
        title: title || 'Sin título',
        artist: user?.name || user?.login || 'Autor'
      });
      setLrc(generatedLrc);
    }

    showFeedback('Letra transcrita importada al editor');
    setActiveTab('lyrics.md');
  };

  const handleCopyLyricsToLrc = () => {
    if (!lyrics.trim()) {
      showFeedback('La letra está vacía');
      return;
    }
    const convertedLrc = copyLyricsToLrcFormat(lyrics, {
      existingLrc: lrc,
      title: title || 'Sin título',
      artist: user?.name || 'Autor'
    });
    setLrc(convertedLrc);
    showFeedback('Letra transferida a LRC limpiando todos los acordes');
  };

  const handleCopyLrcToLyrics = () => {
    if (!lrc.trim()) {
      showFeedback('El contenido LRC está vacío');
      return;
    }
    const cleanLyrics = copyLrcToLyricsFormat(lrc);
    if (!cleanLyrics.trim()) {
      showFeedback('No se encontraron líneas líricas en LRC');
      return;
    }
    if (
      lyrics.trim() &&
      !window.confirm('¿Deseas reemplazar la letra actual por la letra limpia de LRC (sin marcas de tiempo)?')
    ) {
      return;
    }
    setLyrics(cleanLyrics);
    showFeedback('Letra importada desde LRC sin marcas de tiempo');
  };

  const toggleLocalAudio = () => {
    if (!localAudioRef.current) return;
    if (isPlayingLocalAudio) {
      localAudioRef.current.pause();
      setIsPlayingLocalAudio(false);
    } else {
      void localAudioRef.current.play();
      setIsPlayingLocalAudio(true);
    }
  };

  const handleSeekAudio = (time: number) => {
    setAudioCurrentTime(time);
    if (localAudioRef.current) {
      localAudioRef.current.currentTime = time;
    }
  };

  const handleOpenMp3Comparison = async () => {
    if (!pendingMp3Metadata && activeAudioFile) {
      try {
        const ext = await extractMp3Metadata(activeAudioFile);
        setPendingMp3Metadata(ext);
        setMp3MetadataFileName(activeAudioFile.name);
      } catch (err) {
        console.warn(err);
      }
    }
    setIsMp3MetadataModalOpen(true);
  };

  const handleToggleMarkdownMode = () => {
    if (editorMode === 'studio') {
      setRawMarkdown(
        songToMarkdown({
          id: id || 'nueva-cancion',
          title: title || 'Sin título',
          status,
          albumId: selectedAlbumId || undefined,
          year: year || new Date().getFullYear(),
          genre,
          key,
          tempo: tempo ? parseInt(tempo, 10) : undefined,
          timeSignature,
          tuning,
          lyrics,
          lrc,
          notes,
          tags,
          audioUrl: audioUrl || undefined,
          driveFileId: driveFileId || undefined,
          driveFileName: driveFileName || undefined,
          isPrivateDemo,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      );
      setEditorMode('markdown');
    } else {
      try {
        const parsed = markdownToSong(rawMarkdown, id);
        setTitle(parsed.title);
        setLyrics(parsed.lyrics);
        setStatus(parsed.status);
        if (parsed.key) setKey(parsed.key);
        if (parsed.tempo) setTempo(parsed.tempo.toString());
      } catch {
        // Keep current form fields if markdown parsing fails
      }
      setEditorMode('studio');
    }
  };

  const linesCount = useMemo(() => lyrics.split('\n').length, [lyrics]);
  const wordsCount = useMemo(() => {
    const clean = stripChordsFromText(lyrics).trim();
    if (!clean) return 0;
    return clean.split(/\s+/).length;
  }, [lyrics]);

  const detectedChordsCount = savedAudioAnalysis?.chords?.length || detectedChords.length;
  const hasDetectedChords = Boolean(savedAudioAnalysis?.chords?.length || detectedChords.length > 0);

  if (!isAuthor) {
    return (
      <AuthorAccessGuard
        title="Editor de Canciones Reservado al Autor"
        description="La creación, edición y eliminación de temas, maquetas de audio y acordes está reservada exclusivamente para el autor propietario."
      />
    );
  }

  return (
    <div className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-2 sm:px-4 lg:px-6 py-4 animate-fade-in text-[var(--text-primary)]">
      {/* DESKTOP APPLICATION WINDOW FRAME */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md overflow-hidden flex flex-col">
        {/* ROW 1 & ROW 2: MENU BAR & ACTION RIBBON */}
        <SongExportActions
          menuBarRef={menuBarRef}
          openMenu={openMenu}
          onSetOpenMenu={setOpenMenu}
          onNavigateBack={() => (song ? navigate({ name: 'song-detail', songId: song.id }) : goBack({ name: 'catalog' }))}
          title={title}
          onTitleChange={setTitle}
          completenessPercent={completeness.percent}
          status={status}
          onStatusChange={setStatus}
          keySignature={key}
          onKeyChange={setKey}
          tempo={tempo}
          onTempoChange={setTempo}
          timeSignature={timeSignature}
          onTimeSignatureChange={setTimeSignature}
          accidentalPreference={accidentalPreference}
          onTransposeLyrics={handleTransposeLyrics}
          onToggleAccidentals={handleToggleAccidentals}
          onTapTempo={handleTapTempo}
          tapCount={tapCount}
          onOpenTuner={() => setIsTunerOpen(true)}
          audioUrl={audioUrl}
          isPlayingLocalAudio={isPlayingLocalAudio}
          onToggleLocalAudio={toggleLocalAudio}
          audioCurrentTime={audioCurrentTime}
          onRequestAudioUpload={() => audioFileInputRef.current?.click()}
          onRequestChordProImport={() => chordProInputRef.current?.click()}
          showStandPreview={showStandPreview}
          onToggleStandPreview={() => setShowStandPreview((prev) => !prev)}
          onExportPdf={handleExportCurrentPdf}
          onExportChordPro={handleExportCurrentChordPro}
          onExportMidi={handleExportCurrentMidi}
          onSubmit={() => void handleSubmit()}
          isPushing={isPushing}
          onInsertSection={handleInsertSection}
          hasDetectedChords={hasDetectedChords}
          detectedChordsCount={detectedChordsCount}
          onInsertDetectedChords={() => handleInsertDetectedChords()}
          canUndoChordInsertion={lyricsUndoHistory !== null}
          onUndoChordInsertion={handleUndoChordInsertion}
          onStripChords={handleStripChords}
          onCopyLyricsToLrc={handleCopyLyricsToLrc}
          onOpenAudioStudio={() => setActiveTab('audio-studio.dsp')}
          onSelectTranscriptionEngine={(engine) => {
            setTranscriptionEngine(engine);
            setActiveTab('audio-studio.dsp');
          }}
          onOpenSyncAssistant={() => setIsSyncAssistantOpen(true)}
          onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        />

        {/* ROW 3: WORKBENCH TABS */}
        <div className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] px-2 pt-1 flex items-center justify-between text-xs overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('lyrics.md')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md font-mono text-xs transition-colors cursor-pointer border-t-2 ${
                activeTab === 'lyrics.md'
                  ? 'bg-[var(--bg-surface)] border-t-[var(--accent-primary)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'border-t-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>lyrics.md</span>
              {lyrics.trim().length > 20 && <span className="text-[10px] opacity-60">({linesCount})</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audio-studio.dsp')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md font-mono text-xs transition-colors cursor-pointer border-t-2 ${
                activeTab === 'audio-studio.dsp'
                  ? 'bg-[var(--bg-surface)] border-t-[var(--accent-primary)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'border-t-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/60'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5 text-blue-500" />
              <span>audio-studio.dsp</span>
              {(audioUrl || driveFileId) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sync.lrc')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md font-mono text-xs transition-colors cursor-pointer border-t-2 ${
                activeTab === 'sync.lrc'
                  ? 'bg-[var(--bg-surface)] border-t-[var(--accent-primary)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'border-t-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-purple-500" />
              <span>sync.lrc</span>
              {lrc.trim().length > 10 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('metadata.json')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md font-mono text-xs transition-colors cursor-pointer border-t-2 ${
                activeTab === 'metadata.json'
                  ? 'bg-[var(--bg-surface)] border-t-[var(--accent-primary)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'border-t-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/60'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-amber-500" />
              <span>metadata.json</span>
              {selectedAlbumId && <span className="text-[10px] opacity-60">Álbum</span>}
            </button>
          </div>

          <div className="flex items-center gap-2 pb-1 pr-1">
            <button
              type="button"
              onClick={handleToggleMarkdownMode}
              className="text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] cursor-pointer"
              title="Ver archivo Markdown crudo con frontmatter YAML"
            >
              {editorMode === 'studio' ? 'Código MD' : 'Modo Workbench'}
            </button>
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button type="button" onClick={() => setValidationError(null)} className="hover:underline cursor-pointer">
              Entendido
            </button>
          </div>
        )}

        {/* Audio Analysis Notice */}
        {audioAnalysisNotice && (
          <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{audioAnalysisNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAudioAnalysisNotice(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hidden Audio File Input */}
        <input
          ref={audioFileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleAudioFileChosen(file);
          }}
          className="hidden"
        />

        {/* Hidden ChordPro File Input */}
        <input
          ref={chordProInputRef}
          type="file"
          accept=".cho,.chopro,.crd,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void handleImportChordProFile(file);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        {/* Global Hidden Audio Element */}
        {isValidPlayableAudioUrl(audioUrl) && (
          <audio
            ref={localAudioRef}
            src={audioUrl}
            onTimeUpdate={() => {
              if (localAudioRef.current) setAudioCurrentTime(localAudioRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (localAudioRef.current) setAudioDuration(localAudioRef.current.duration);
            }}
            onEnded={() => setIsPlayingLocalAudio(false)}
            onError={(e) => {
              console.warn('Error en el reproductor de audio local:', e);
              setIsPlayingLocalAudio(false);
            }}
          />
        )}

        {/* TAB CONTENT PANELS */}
        {editorMode === 'studio' ? (
          <div className="flex-1 flex flex-col min-h-[580px] bg-[var(--bg-canvas)]">
            {activeTab === 'lyrics.md' && (
              <LyricsChordEditor
                keySignature={key}
                tempo={tempo}
                tuning={tuning}
                musicalMode={musicalMode}
                onMusicalModeChange={setMusicalMode}
                chordPaletteTab={chordPaletteTab}
                onChordPaletteTabChange={setChordPaletteTab}
                activeCategoryChords={activeCategoryChords}
                onInsertChordAtCursor={handleInsertChordAtCursor}
                customChordInput={customChordInput}
                onCustomChordInputChange={setCustomChordInput}
                onAddCustomChord={handleAddCustomChord}
                onInsertSection={handleInsertSection}
                onApplyTemplate={handleApplyTemplate}
                hasDetectedChords={hasDetectedChords}
                detectedChordsCount={detectedChordsCount}
                onInsertDetectedChords={() => handleInsertDetectedChords()}
                canUndoChordInsertion={lyricsUndoHistory !== null}
                onUndoChordInsertion={handleUndoChordInsertion}
                onStripChords={handleStripChords}
                lastChordBeforeCursor={lastChordBeforeCursor}
                contextualNextChords={contextualNextChords}
                showStandPreview={showStandPreview}
                onShowStandPreviewChange={setShowStandPreview}
                savedAudioAnalysis={savedAudioAnalysis}
                showPoeticAnalysis={showPoeticAnalysis}
                onTogglePoeticAnalysis={setShowPoeticAnalysis}
                poeticAnalysis={poeticAnalysis}
                linesCount={linesCount}
                lyricsTextareaRef={lyricsTextareaRef}
                lyrics={lyrics}
                onLyricsChange={setLyrics}
                onUpdateCursorPosition={updateCursorPosition}
                sectionProgressions={sectionProgressions}
                playingProgressionId={playingProgressionId}
                activeProgressionStep={activeProgressionStep}
                onToggleProgression={handleToggleProgression}
                onExportCurrentMidi={handleExportCurrentMidi}
              />
            )}

            {(activeTab === 'audio-studio.dsp' || activeTab === 'sync.lrc') && (
              <SongAudioToolsPanel
                mode={activeTab}
                audioUrl={audioUrl}
                activeAudioFile={activeAudioFile}
                driveFileId={driveFileId}
                driveFileName={driveFileName}
                isPlayingLocalAudio={isPlayingLocalAudio}
                audioCurrentTime={audioCurrentTime}
                audioDuration={audioDuration}
                onToggleLocalAudio={toggleLocalAudio}
                onSeekAudio={handleSeekAudio}
                onRequestAudioUpload={() => audioFileInputRef.current?.click()}
                onAudioFileChosen={(file) => void handleAudioFileChosen(file)}
                pendingMp3Metadata={pendingMp3Metadata}
                onOpenMp3Comparison={handleOpenMp3Comparison}
                audioStudioMode={audioStudioMode}
                onAudioStudioModeChange={setAudioStudioMode}
                onApplyAudioDetection={handleApplyAudioDetection}
                onInsertDetectedChords={handleInsertDetectedChords}
                canUndoChordInsertion={lyricsUndoHistory !== null}
                onUndoChordInsertion={handleUndoChordInsertion}
                savedAudioAnalysis={savedAudioAnalysis}
                keySignature={key}
                tempo={tempo}
                transcriptionEngine={transcriptionEngine}
                onTranscriptionEngineChange={setTranscriptionEngine}
                transcriptionLanguage={transcriptionLanguage}
                onTranscriptionLanguageChange={setTranscriptionLanguage}
                hasServerApiKey={hasServerApiKey}
                backendConsent={backendConsent}
                onBackendConsentChange={setBackendConsent}
                transcriptionProgress={transcriptionProgress}
                transcriptionError={transcriptionError}
                lastTranscriptionResult={lastTranscriptionResult}
                isTranscribing={isTranscribing}
                onRunTranscription={() => void handleRunTranscription()}
                onApplyTranscribedLyrics={handleApplyTranscribedLyrics}
                lrc={lrc}
                onLrcChange={setLrc}
                onCopyLyricsToLrc={handleCopyLyricsToLrc}
                onCopyLrcToLyrics={handleCopyLrcToLyrics}
                onOpenSyncAssistant={() => setIsSyncAssistantOpen(true)}
              />
            )}

            {activeTab === 'metadata.json' && (
              <SongMetadataForm
                selectedAlbumId={selectedAlbumId}
                onSelectedAlbumIdChange={setSelectedAlbumId}
                albums={albums}
                trackNumber={trackNumber}
                onTrackNumberChange={setTrackNumber}
                year={year}
                onYearChange={setYear}
                genre={genre}
                onGenreChange={setGenre}
                tuning={tuning}
                onTuningChange={setTuning}
                duration={duration}
                onDurationChange={setDuration}
                spotifyUrl={spotifyUrl}
                onSpotifyUrlChange={setSpotifyUrl}
                youtubeUrl={youtubeUrl}
                onYoutubeUrlChange={setYoutubeUrl}
                soundcloudUrl={soundcloudUrl}
                onSoundcloudUrlChange={setSoundcloudUrl}
                appleMusicUrl={appleMusicUrl}
                onAppleMusicUrlChange={setAppleMusicUrl}
                tags={tags}
                onTagsChange={setTags}
                tagInput={tagInput}
                onTagInputChange={setTagInput}
                notes={notes}
                onNotesChange={setNotes}
              />
            )}
          </div>
        ) : (
          /* RAW MARKDOWN VIEW */
          <div className="flex-1 flex flex-col p-4 space-y-3 bg-[var(--bg-surface)] min-h-[580px]">
            <textarea
              rows={24}
              value={rawMarkdown}
              onChange={(e) => setRawMarkdown(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-xs sm:text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorMode('studio')}
                className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Volver a Modo Workbench
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="px-4 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] rounded-md hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                Guardar Markdown
              </button>
            </div>
          </div>
        )}

        {/* ROW 4: DESKTOP APPLICATION STATUS BAR */}
        <div className="bg-[var(--bg-surface-subtle)] border-t border-[var(--border-subtle)] px-3 py-1 flex flex-wrap items-center justify-between text-[11px] font-mono text-[var(--text-muted)] select-none">
          <div className="flex items-center gap-3">
            <span>
              Ln <strong className="text-[var(--text-primary)]">{cursorPos.line}</strong>, Col{' '}
              <strong className="text-[var(--text-primary)]">{cursorPos.col}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>{linesCount} versos</span>
            <span aria-hidden="true">·</span>
            <span>{wordsCount} palabras</span>
            <span aria-hidden="true">·</span>
            <span>UTF-8</span>
          </div>

          <div className="flex items-center gap-3 hidden md:flex">
            <span>
              Tono: <strong className="text-[var(--accent-primary)]">{key}</strong> (
              {accidentalPreference === 'sharps' ? '#' : 'b'})
            </span>
            <span aria-hidden="true">·</span>
            <span>{tempo || '--'} BPM</span>
            <span aria-hidden="true">·</span>
            <span>{timeSignature}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span>Completitud:</span>
              <strong className="text-[var(--text-primary)] tabular-nums">{completeness.percent}%</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span
              className="flex items-center gap-1"
              title={
                isAuthenticated || token
                  ? `Conectado a GitHub como @${user?.login || 'autor'}`
                  : 'Guardado solo localmente'
              }
            >
              <FolderGit2 className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>{isAuthenticated || token ? `@${user?.login || 'autor'}` : 'Local'}</span>
            </span>
            {driveFileId && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                  title="Maqueta guardada en Google Drive"
                >
                  <Cloud className="w-3 h-3" />
                  <span>Drive</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick floating feedback notification */}
      {feedbackToast && (
        <div className="fixed bottom-10 right-6 z-50 p-2.5 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Lazy-Loaded Studio Modals */}
      <Suspense fallback={null}>
        {isSyncAssistantOpen && (
          <LrcSyncAssistant
            isOpen={isSyncAssistantOpen}
            onClose={() => setIsSyncAssistantOpen(false)}
            rawLyrics={lyrics}
            currentTime={audioCurrentTime}
            duration={audioDuration}
            isPlaying={isPlayingLocalAudio}
            onSeek={handleSeekAudio}
            onTogglePlay={toggleLocalAudio}
            songTitle={title || 'Sin título'}
            onSaveSyncedLyrics={(lines, rawLrc) => {
              setLrc(rawLrc);
              showFeedback(`Letra sincronizada guardada (${lines.length} versos marcados)`);
              setIsSyncAssistantOpen(false);
            }}
          />
        )}

        {pendingMp3Metadata && isMp3MetadataModalOpen && (
          <Mp3MetadataComparisonModal
            isOpen={isMp3MetadataModalOpen}
            onClose={() => setIsMp3MetadataModalOpen(false)}
            metadata={pendingMp3Metadata}
            fileName={mp3MetadataFileName || activeAudioFile?.name || driveFileName}
            currentSongData={{
              title,
              lyrics,
              lrc,
              key,
              tempo,
              year,
              genre,
              notes,
              timeSignature,
              tuning,
              albumTitle: albums?.find((a) => a.id === selectedAlbumId)?.title
            }}
            onApplyFields={handleApplyMp3Fields}
          />
        )}

        {isTunerOpen && (
          <ChromaticTunerModal
            initialTuning={tuning}
            initialA4Hz={savedAudioAnalysis?.referenceA4Hz || 440}
            onClose={() => setIsTunerOpen(false)}
          />
        )}
      </Suspense>

      {isShortcutsModalOpen && <EditorShortcutsDialog onClose={() => setIsShortcutsModalOpen(false)} />}
    </div>
  );
};
