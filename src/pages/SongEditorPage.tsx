import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  FileEdit,
  AlertCircle,
  Disc,
  Music,
  Wand2,
  Mic,
  FileAudio,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Radio,
  Clock,
  Layers,
  UploadCloud,
  Lock,
  Unlock,
  Cloud,
  RefreshCw,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Play,
  Pause,
  ArrowDown,
  ArrowUp,
  Eraser,
  PenTool,
  Check,
  Tag,
  BookOpen,
  SlidersHorizontal,
  ChevronRight,
  Info,
  Columns,
  FileCode,
  FileText,
  Download,
  HelpCircle,
  Music2,
  Undo2,
  CheckCheck,
  FolderGit2,
  Cpu,
  ShieldCheck,
  Key
} from 'lucide-react';
import { Song, SongStatus } from '../types/song';
import { Album } from '../types/album';
import {
  songToMarkdown,
  markdownToSong,
  transposeChord,
  transposeLyrics,
  respellChord,
  respellLyrics,
  parseLyricLine,
  AccidentalPreference
} from '../utils/markdownParser';
import { StorageService } from '../services/storageService';
import { GitHubSyncService, PushResult } from '../services/githubSyncService';
import { useAuth } from '../context/AuthContext';
import { AudioAnalyzerSection } from '../components/AudioAnalyzerSection';
import { GoogleDriveService } from '../services/googleDriveService';
import { ChordSegment, insertChordsIntoLyrics, getCleanChordSequence } from '../lib/audio/chords';
import {
  parseLrc,
  serializeToLrc,
  stripChordsFromText,
  stripLrcTimestamps,
  copyLyricsToLrcFormat,
  copyLrcToLyricsFormat
} from '../lib/lyrics/parseLrc';
import { LyricsTranscriptionService } from '../services/lyricsTranscriptionService';
import { LyricsTranscriptionResult } from '../types/transcription';
import { useAppNavigation } from '../context/NavigationContext';
import { LrcSyncAssistant } from '../components/LrcSyncAssistant';
import {
  getDiatonicChordsForKey,
  calculateSongCompleteness,
  SONGWRITING_TEMPLATES
} from '../utils/songwriterHelper';
import { exportSongToPdf } from '../utils/pdfGenerator';

interface SongEditorPageProps {
  song: Song | null;
  albums?: Album[];
  initialAlbumId?: string;
  initialAudioFile?: File;
  onSave: (song: Song, pushResult?: PushResult) => void;
  onDelete?: (song: Song) => void;
}

type WorkbenchTab = 'lyrics.md' | 'audio-studio.dsp' | 'sync.lrc' | 'metadata.json';

const COMMON_KEYS_MAJOR = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'];
const COMMON_KEYS_MINOR = ['Am', 'Em', 'Dm', 'Bm', 'F#m', 'C#m', 'Gm'];
const COMMON_TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '12/8'];
const COMMON_TUNINGS = [
  'Estándar (EADGBE)',
  'Drop D (DADGBE)',
  'DADGAD',
  'Medio tono abajo (Eb Ab Db Gb Bb Eb)',
  'Open G (DGDGBD)',
  'Open D (DADF#AD)'
];

export const SongEditorPage: React.FC<SongEditorPageProps> = ({
  song,
  albums = [],
  initialAlbumId,
  initialAudioFile,
  onSave,
  onDelete
}) => {
  const { navigate, goBack } = useAppNavigation();
  const { token, user, isAuthor, isGoogleDriveConnected, googleUser, loginWithGoogle } = useAuth();
  
  // Editor mode: desktop studio vs raw markdown
  const [editorMode, setEditorMode] = useState<'studio' | 'markdown'>('studio');
  
  // Current active workbench tab
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('lyrics.md');

  // Menu bar state (which dropdown is open)
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
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);
  const [driveFeedback, setDriveFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Audio Playback
  const [isPlayingLocalAudio, setIsPlayingLocalAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Analysis & Transcription States
  const [detectedChords, setDetectedChords] = useState<ChordSegment[]>([]);
  const [audioAnalysisNotice, setAudioAnalysisNotice] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionEngine, setTranscriptionEngine] = useState<'backend_gemini' | 'local_whisper'>('local_whisper');
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<'spanish' | 'english' | 'auto'>('spanish');
  const [hasServerApiKey, setHasServerApiKey] = useState<boolean | null>(null);
  const [backendConsent, setBackendConsent] = useState<boolean>(true);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [lastTranscriptionResult, setLastTranscriptionResult] = useState<LyricsTranscriptionResult | null>(null);

  // Split view live music stand preview toggle
  const [showStandPreview, setShowStandPreview] = useState<boolean>(true);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Tap-to-sync assistant modal state
  const [isSyncAssistantOpen, setIsSyncAssistantOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);

  // Raw Markdown
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Git Push State
  const [pushToGitHub, setPushToGitHub] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  // Cursor tracking in Lyrics Editor for Status Bar
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const lyricsTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
      setLyrics(`## Intro\n[Am]  [G]  [F]  [E7]\n\n## Estrofa 1\n[Am] Escribe aquí el primer verso de la canción...\n[G] Segundo verso con acordes anotados\n\n## Estribillo\n[C] Y aquí el estribillo que eleva la voz...\n[G] Con notas claras y verdades pequeñas.`);
      setLrc('');
      setTags(['acústico', 'maqueta']);
      setCommitMessage('feat: nueva composición en el cancionero');
    }
  }, [song, initialAlbumId]);

  // Check backend server configuration to determine available transcription engines
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        const hasKey = Boolean(data?.hasGeminiKey);
        setHasServerApiKey(hasKey);
        if (hasKey) {
          setTranscriptionEngine('backend_gemini');
        } else {
          setTranscriptionEngine('local_whisper');
        }
      })
      .catch(() => {
        setHasServerApiKey(false);
        setTranscriptionEngine('local_whisper');
      });
  }, []);

  // Handle initialAudioFile if passed
  useEffect(() => {
    if (initialAudioFile) {
      handleAudioFileChosen(initialAudioFile);
      setActiveTab('audio-studio.dsp');
    }
  }, [initialAudioFile]);

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

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+B, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmit();
      }
      // Toggle Split Atril: Ctrl+B / Cmd+B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowStandPreview(prev => !prev);
        showFeedback(showStandPreview ? 'Vista de atril oculta' : 'Vista de atril activada');
      }
      // Escape to close dropdown menus
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Dynamic Diatonic Chords for the current key
  const availableChords = useMemo(() => {
    return getDiatonicChordsForKey(key);
  }, [key]);

  // Calculate completeness progress
  const completeness = useMemo(() => {
    return calculateSongCompleteness({
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
    });
  }, [title, lyrics, key, tempo, audioUrl, driveFileId, spotifyUrl, youtubeUrl, soundcloudUrl, lrc, status]);

  // Toast feedback helper
  const showFeedback = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Track cursor position in Textarea
  const updateCursorPosition = () => {
    const textarea = lyricsTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const linesBefore = textarea.value.substring(0, start).split('\n');
    const curLine = linesBefore.length;
    const curCol = linesBefore[linesBefore.length - 1].length + 1;
    setCursorPos({ line: curLine, col: curCol });
  };

  // Insert Chord at cursor position in Lyrics Textarea
  const handleInsertChordAtCursor = (chordName: string) => {
    const textarea = lyricsTextareaRef.current;
    const chordTag = `[${chordName}]`;

    if (!textarea) {
      setLyrics(prev => prev + ` ${chordTag}`);
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

    setLyrics(nextText);
    showFeedback(`Acorde ${chordTag} insertado`);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
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

  // Section Header Insertion
  const handleInsertSection = (sectionName: string) => {
    const block = `\n\n## ${sectionName}\n`;
    setLyrics(prev => prev.trimEnd() + block);
    showFeedback(`Sección ${sectionName} añadida`);
    setTimeout(() => {
      if (lyricsTextareaRef.current) {
        lyricsTextareaRef.current.focus();
        lyricsTextareaRef.current.scrollTop = lyricsTextareaRef.current.scrollHeight;
        updateCursorPosition();
      }
    }, 50);
  };

  // Apply complete songwriter template
  const handleApplyTemplate = (templateKey: string) => {
    const tpl = SONGWRITING_TEMPLATES.find(t => t.id === templateKey);
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

  // Transpose Lyrics
  const handleTransposeLyrics = (delta: number) => {
    const nextKey = transposeChord(key || 'Am', delta, accidentalPreference);
    setKey(nextKey);
    const transposed = transposeLyrics(lyrics, delta, accidentalPreference);
    setLyrics(transposed);
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
    const stripped = stripChordsFromText(lyrics);
    setLyrics(stripped);
    showFeedback('Acordes entre corchetes eliminados');
  };

  // Export current song to print-ready PDF
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
    exportSongToPdf(songSnapshot, {
      showChords: true,
      chordPosition: 'above',
      accidentalPreference
    });
    showFeedback('Generando PDF de atril para imprimir...');
  };

  // Audio Upload & Google Drive Handler
  const handleAudioFileChosen = async (file: File) => {
    setActiveAudioFile(file);
    const localUrl = URL.createObjectURL(file);
    setAudioUrl(localUrl);

    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
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
      } catch (err: any) {
        setDriveFeedback({
          type: 'error',
          message: `Error al subir a Google Drive: ${err.message || 'Comprueba tu conexión.'}`
        });
      } finally {
        setIsUploadingToDrive(false);
      }
    } else {
      setDriveFeedback({
        type: 'info',
        message: 'Audio cargado en memoria listo para reproducir y detectar tono y tempo.'
      });
    }
  };

  // Detection applied callback from AudioAnalyzer
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
  }) => {
    if (data.tempo) setTempo(data.tempo.toString());
    if (data.key) setKey(data.key);
    if (data.timeSignature) setTimeSignature(data.timeSignature);
    if (data.tuning) setTuning(data.tuning);
    if (data.audioUrl) setAudioUrl(data.audioUrl);
    if (data.chords && data.chords.length > 0) {
      setDetectedChords(data.chords);
    }
    if (data.chordProgression && !notes) {
      setNotes(`Progresión armónica detectada: ${data.chordProgression}`);
    }
    if (data.suggestedLyricsChords && (!lyrics || lyrics.includes('Escribe aquí el primer verso'))) {
      setLyrics(data.suggestedLyricsChords);
    }

    setAudioAnalysisNotice(`¡Detección acústica aplicada! Tono: ${data.key} · Tempo: ${data.tempo} BPM · Compás: ${data.timeSignature}`);
    showFeedback(`Tono ${data.key} y ${data.tempo} BPM aplicados a la canción`);
    setTimeout(() => setAudioAnalysisNotice(null), 5000);
  };

  const handleInsertDetectedChords = (chordsOverride?: ChordSegment[]) => {
    const list = chordsOverride || detectedChords;
    if (!list || list.length === 0) return;

    const updated = insertChordsIntoLyrics(lyrics, list);
    setLyrics(updated);
    showFeedback('Acordes detectados intercalados en la letra');
  };

  // Voice-to-Text Transcription Handler (Supports both Local Whisper & Gemini AI Cloud)
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
        result = await LyricsTranscriptionService.transcribeWithBackendFromFile(
          activeAudioFile,
          backendConsent
        );
      } else {
        setTranscriptionProgress('Iniciando modelo Whisper local en el navegador...');
        const lang = transcriptionLanguage === 'auto' ? undefined : transcriptionLanguage;
        result = await LyricsTranscriptionService.transcribeLocalFromFile(
          activeAudioFile,
          {
            allowWasmFallback: true,
            language: lang
          },
          (message, status) => {
            setTranscriptionProgress(`[${status}] ${message}`);
          }
        );
      }

      setLastTranscriptionResult(result);
      const engineLabel = result.engine === 'local_whisper' ? 'Whisper Local' : 'Gemini AI';
      showFeedback(`Transcripción (${engineLabel}) completada: ${result.lines.length} versos detectados`);
    } catch (err: any) {
      setTranscriptionError(err.message || 'Error al procesar la transcripción de voz.');
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
      setLyrics(prev => (prev.trim() ? `${prev.trim()}\n\n${transcribed}` : transcribed));
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

  // LRC Sync Copy Helpers
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
    if (lyrics.trim() && !window.confirm('¿Deseas reemplazar la letra actual por la letra limpia de LRC (sin marcas de tiempo)?')) {
      return;
    }
    setLyrics(cleanLyrics);
    showFeedback('Letra importada desde LRC sin marcas de tiempo');
  };

  // Save / Submit
  const handleSubmit = async (e?: React.FormEvent) => {
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
          updatedAt: new Date().toISOString()
        };
      } catch (err: any) {
        setValidationError(`Error en formato Markdown: ${err.message}`);
        return;
      }
    } else {
      if (!title.trim()) {
        setValidationError('Por favor ingresa un título para la canción.');
        setActiveTab('metadata.json');
        return;
      }

      const songId = song?.id || id || `cancion-${Date.now()}`;
      const chosenAlbum = albums.find(a => a.id === selectedAlbumId);

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
        isPrivateDemo: isPrivateDemo,
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        lyrics: lyrics.trim(),
        lrc: lrc.trim() || undefined,
        createdAt: song?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    let pushResult: PushResult | undefined = undefined;
    if (pushToGitHub && token) {
      setIsPushing(true);
      try {
        const config = GitHubSyncService.getRemoteConfig(user?.login);
        pushResult = await GitHubSyncService.pushSongFile(
          songToSave,
          commitMessage || `feat: actualizar ${songToSave.title}`,
          token,
          config
        );
      } catch (err: any) {
        console.warn('Push warning:', err);
      } finally {
        setIsPushing(false);
      }
    }

    onSave(songToSave, pushResult);
    navigate({ name: 'song-detail', songId: songToSave.id });
  };

  // Render stand-preview chords over text
  const renderLyricsStandPreview = () => {
    const lines = lyrics.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('##') || line.startsWith('#')) {
        const heading = line.replace(/^#+\s*/, '');
        return (
          <h4 key={idx} className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-bold mt-5 mb-1.5 border-b border-[var(--border-subtle)] pb-0.5">
            {heading}
          </h4>
        );
      }
      if (!line.trim()) return <div key={idx} className="h-3" />;

      if (/\[([A-G][#b]?[^\]]*)\]/.test(line)) {
        const segments = parseLyricLine(line);
        return (
          <div key={idx} className="flex flex-wrap items-end my-0.5 font-mono leading-none">
            {segments.map((segment, sIdx) => (
              <span key={sIdx} className="inline-flex flex-col mr-1">
                <span className="text-[11px] font-bold text-[var(--accent-primary)] select-none h-3.5">
                  {segment.chord || '\u00A0'}
                </span>
                <span className="font-serif text-sm text-[var(--text-primary)] leading-normal">
                  {segment.text || '\u00A0'}
                </span>
              </span>
            ))}
          </div>
        );
      }

      return (
        <p key={idx} className="font-serif text-sm text-[var(--text-secondary)] leading-relaxed my-0.5">
          {line.replace(/\[[^\]]+\]/g, '')}
        </p>
      );
    });
  };

  // Metrics for bottom status bar
  const linesCount = useMemo(() => lyrics.split('\n').length, [lyrics]);
  const wordsCount = useMemo(() => {
    const clean = stripChordsFromText(lyrics).trim();
    if (!clean) return 0;
    return clean.split(/\s+/).length;
  }, [lyrics]);

  return (
    <div className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-2 sm:px-4 lg:px-6 py-4 animate-fade-in text-[var(--text-primary)]">
      {/* =========================================================================
          DESKTOP APPLICATION WINDOW FRAME (VS Code / MDE / Photoshop Studio Style)
         ========================================================================= */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md overflow-hidden flex flex-col">
        
        {/* ROW 1: DESKTOP APPLICATION MENU BAR (Archivo · Editar · Música · Audio · Atril · Ver · Ayuda) */}
        <div ref={menuBarRef} className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] px-3 py-1 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Back button */}
            <button
              type="button"
              onClick={() => (song ? navigate({ name: 'song-detail', songId: song.id }) : goBack({ name: 'catalog' }))}
              className="px-2 py-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1 mr-1"
              title="Volver al catálogo (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Catálogo</span>
            </button>

            {/* Application Wordmark */}
            <span className="font-mono text-[11px] font-semibold text-[var(--accent-primary)] hidden md:inline border-r border-[var(--border-subtle)] pr-2">
              Studio
            </span>

            {/* Menu Dropdown: ARCHIVO */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'archivo' ? null : 'archivo')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  openMenu === 'archivo' ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]' : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                Archivo
              </button>
              {openMenu === 'archivo' && (
                <div className="absolute left-0 top-full mt-1 w-56 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      handleSubmit();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Guardar Cambios</span>
                    <kbd className="font-mono text-[10px] opacity-70">Ctrl+S</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('published');
                      handleSubmit();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Guardar y Publicar</span>
                    <kbd className="font-mono text-[10px] opacity-70">Ctrl+Shift+S</kbd>
                  </button>
                  <div className="h-px bg-[var(--border-subtle)] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      handleExportCurrentPdf();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Exportar PDF para Atril</span>
                    <kbd className="font-mono text-[10px] opacity-70">PDF</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      audioFileInputRef.current?.click();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Cargar Archivo de Audio...</span>
                    <kbd className="font-mono text-[10px] opacity-70">MP3/WAV</kbd>
                  </button>
                  <div className="h-px bg-[var(--border-subtle)] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      if (song) navigate({ name: 'song-detail', songId: song.id });
                      else goBack({ name: 'catalog' });
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-between cursor-pointer"
                  >
                    <span>Cerrar / Descartar</span>
                    <kbd className="font-mono text-[10px] opacity-70">Esc</kbd>
                  </button>
                </div>
              )}
            </div>

            {/* Menu Dropdown: EDITAR */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'editar' ? null : 'editar')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  openMenu === 'editar' ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]' : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                Editar
              </button>
              {openMenu === 'editar' && (
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      handleInsertSection('Intro');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                  >
                    Insertar Sección Intro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleInsertSection('Estribillo');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                  >
                    Insertar Sección Estribillo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleInsertSection('Puente');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                  >
                    Insertar Sección Puente
                  </button>
                  <div className="h-px bg-[var(--border-subtle)] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      handleStripChords();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    Limpiar todos los acordes [C]
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyLyricsToLrc();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                  >
                    Copiar Letra a LRC (sin acordes)
                  </button>
                </div>
              )}
            </div>

            {/* Menu Dropdown: MÚSICA & ARMONÍA */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'musica' ? null : 'musica')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  openMenu === 'musica' ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]' : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                Música
              </button>
              {openMenu === 'musica' && (
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      handleTransposeLyrics(1);
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Subir +1 Semitono</span>
                    <kbd className="font-mono text-[10px]">+1</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleTransposeLyrics(-1);
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Bajar -1 Semitono</span>
                    <kbd className="font-mono text-[10px]">-1</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleAccidentals();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Alternar # / b</span>
                    <span className="font-mono text-[10px] font-bold">{accidentalPreference === 'sharps' ? 'Activo: #' : 'Activo: b'}</span>
                  </button>
                  <div className="h-px bg-[var(--border-subtle)] my-1" />
                  <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                    Tonalidades Populares
                  </div>
                  <div className="grid grid-cols-4 gap-1 px-2 py-1">
                    {[...COMMON_KEYS_MAJOR.slice(0, 4), ...COMMON_KEYS_MINOR.slice(0, 4)].map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setKey(k);
                          setOpenMenu(null);
                        }}
                        className={`px-1.5 py-1 text-center font-mono rounded text-[11px] font-bold ${
                          key === k ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]' : 'hover:bg-[var(--bg-surface-subtle)]'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Menu Dropdown: AUDIO & DSP */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'audio' ? null : 'audio')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  openMenu === 'audio' ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]' : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                Audio
              </button>
              {openMenu === 'audio' && (
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('audio-studio.dsp');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center gap-2 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Abrir Estudio DSP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!localAudioRef.current) return;
                      if (isPlayingLocalAudio) {
                        localAudioRef.current.pause();
                        setIsPlayingLocalAudio(false);
                      } else {
                        localAudioRef.current.play();
                        setIsPlayingLocalAudio(true);
                      }
                      setOpenMenu(null);
                    }}
                    disabled={!audioUrl}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer disabled:opacity-40"
                  >
                    <span>{isPlayingLocalAudio ? 'Pausar Audio' : 'Reproducir Audio'}</span>
                    <kbd className="font-mono text-[10px] opacity-70">Espacio</kbd>
                  </button>
                  <div className="h-px bg-[var(--border-subtle)] my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setTranscriptionEngine('local_whisper');
                      setActiveTab('audio-studio.dsp');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Transcribir con Whisper Local</span>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">100% Privado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTranscriptionEngine('backend_gemini');
                      setActiveTab('audio-studio.dsp');
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Mic className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Transcribir con Gemini AI</span>
                    </div>
                    <span className="font-mono text-[10px] opacity-70">Nube</span>
                  </button>
                </div>
              )}
            </div>

            {/* Menu Dropdown: ATRIL & VISTA */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'vista' ? null : 'vista')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  openMenu === 'vista' ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]' : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                Atril
              </button>
              {openMenu === 'vista' && (
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStandPreview(!showStandPreview);
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>{showStandPreview ? 'Ocultar Vista Dividida' : 'Activar Vista Dividida'}</span>
                    <kbd className="font-mono text-[10px] opacity-70">Ctrl+B</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSyncAssistantOpen(true);
                      setOpenMenu(null);
                    }}
                    disabled={!audioUrl}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer disabled:opacity-40"
                  >
                    <span>Asistente Tap-to-Sync</span>
                    <kbd className="font-mono text-[10px] opacity-70">LRC</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportCurrentPdf();
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Imprimir Cancionero PDF</span>
                    <kbd className="font-mono text-[10px] opacity-70">Ctrl+P</kbd>
                  </button>
                </div>
              )}
            </div>

            {/* Menu Dropdown: AYUDA */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'ayuda' ? null : 'ayuda')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  openMenu === 'ayuda' ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]' : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                Ayuda
              </button>
              {openMenu === 'ayuda' && (
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsShortcutsModalOpen(true);
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                  >
                    <span>Atajos de Teclado</span>
                    <kbd className="font-mono text-[10px] opacity-70">?</kbd>
                  </button>
                  <div className="px-3 py-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] mt-1">
                    Escribe acordes entre corchetes: <code>[Am] verso cantado...</code> para que se posicionen sobre la sílaba exacta en el atril.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center/Right: Document Title Indicator (Photoshop/VS Code Style) */}
          <div className="flex items-center gap-2 max-w-sm truncate text-[var(--text-secondary)] font-mono text-[11px]">
            <span className="opacity-60 hidden md:inline">canciones/</span>
            <span className="text-[var(--text-primary)] font-bold truncate">
              {title.trim() || 'nueva-cancion.md'}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${completeness.percent >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} title={`Completitud: ${completeness.percent}%`} />
          </div>
        </div>

        {/* ROW 2: DOCKED ACTION TOOLBAR RIBBON (Barra de herramientas compacta de 1 clic) */}
        <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-3 py-2 flex flex-wrap items-center justify-between gap-2.5">
          {/* Group 1: Title Input & Save Primary Button */}
          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-md">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la composición..."
              className="font-serif font-bold text-sm sm:text-base bg-transparent border-b border-[var(--border-subtle)] hover:border-[var(--accent-primary)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] w-full px-1 py-0.5 truncate"
            />
            
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isPushing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-md transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
              title="Guardar canción (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isPushing ? 'Guardando...' : 'Guardar'}</span>
            </button>
          </div>

          {/* Group 2: Quick Music Controls (Transpose, Key, Tempo, Meter) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Tonalidad */}
            <div className="flex items-center bg-[var(--bg-surface-subtle)] rounded-md border border-[var(--border-subtle)] px-2 py-1 gap-1">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Tono:</span>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-10 font-mono font-bold text-xs bg-transparent text-[var(--accent-primary)] text-center focus:outline-none"
                placeholder="Am"
              />
            </div>

            {/* Quick Transpose Buttons */}
            <div className="flex items-center bg-[var(--bg-surface-subtle)] rounded-md border border-[var(--border-subtle)] p-0.5">
              <button
                type="button"
                onClick={() => handleTransposeLyrics(-1)}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Bajar medio tono (-1)"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => handleTransposeLyrics(1)}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Subir medio tono (+1)"
              >
                +1
              </button>
              <button
                type="button"
                onClick={handleToggleAccidentals}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Alternar sostenidos (#) o bemoles (b)"
              >
                {accidentalPreference === 'sharps' ? '#' : 'b'}
              </button>
            </div>

            {/* Tempo (BPM) */}
            <div className="flex items-center bg-[var(--bg-surface-subtle)] rounded-md border border-[var(--border-subtle)] px-2 py-1 gap-1">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">BPM:</span>
              <input
                type="number"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                className="w-11 font-mono text-xs bg-transparent text-[var(--text-primary)] text-center focus:outline-none"
                placeholder="96"
              />
            </div>

            {/* Compás */}
            <select
              value={timeSignature}
              onChange={(e) => setTimeSignature(e.target.value)}
              className="bg-[var(--bg-surface-subtle)] rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs font-mono text-[var(--text-secondary)] focus:outline-none cursor-pointer"
            >
              {COMMON_TIME_SIGNATURES.map(ts => (
                <option key={ts} value={ts}>{ts}</option>
              ))}
            </select>
          </div>

          {/* Group 3: Audio Transport Quick Player (when audio is loaded) */}
          <div className="flex items-center gap-2">
            {audioUrl ? (
              <div className="flex items-center gap-1.5 bg-[var(--bg-surface-subtle)] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (!localAudioRef.current) return;
                    if (isPlayingLocalAudio) {
                      localAudioRef.current.pause();
                      setIsPlayingLocalAudio(false);
                    } else {
                      localAudioRef.current.play();
                      setIsPlayingLocalAudio(true);
                    }
                  }}
                  className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-text)] flex items-center justify-center cursor-pointer shadow-2xs"
                  title="Reproducir / Pausar maqueta (Espacio)"
                >
                  {isPlayingLocalAudio ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
                </button>
                <span className="font-mono tabular-nums text-[11px] text-[var(--text-muted)]">
                  {Math.floor(audioCurrentTime / 60)}:{(Math.floor(audioCurrentTime % 60)).toString().padStart(2, '0')}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => audioFileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Cargar archivo de audio o maqueta"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cargar Audio</span>
              </button>
            )}

            {/* Split Preview Toggle Button */}
            <button
              type="button"
              onClick={() => setShowStandPreview(!showStandPreview)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                showStandPreview
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)] font-semibold'
                  : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Alternar vista dividida del atril (Ctrl+B)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split Atril</span>
            </button>

            {/* Export PDF */}
            <button
              type="button"
              onClick={handleExportCurrentPdf}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Generar Cancionero imprimible en PDF listo para atril"
            >
              <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Status Selector */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SongStatus)}
              className={`text-xs font-semibold px-2 py-1 rounded-md border cursor-pointer focus:outline-none ${
                status === 'published'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : status === 'draft'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  : 'bg-stone-500/10 border-stone-500/30 text-stone-700 dark:text-stone-300'
              }`}
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicada</option>
              <option value="private">Inédita</option>
            </select>
          </div>
        </div>

        {/* ROW 3: WORKBENCH TABS (lyrics.md · audio-studio.dsp · sync.lrc · metadata.json) */}
        <div className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] px-2 pt-1 flex items-center justify-between text-xs overflow-x-auto">
          <div className="flex items-center gap-1">
            {/* Tab 1: lyrics.md */}
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
              {lyrics.trim().length > 20 && (
                <span className="text-[10px] opacity-60">({linesCount})</span>
              )}
            </button>

            {/* Tab 2: audio-studio.dsp */}
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
              {(audioUrl || driveFileId) && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            {/* Tab 3: sync.lrc */}
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
              {lrc.trim().length > 10 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            {/* Tab 4: metadata.json */}
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
              {selectedAlbumId && (
                <span className="text-[10px] opacity-60">Álbum</span>
              )}
            </button>
          </div>

          {/* Right Mode Switcher: Studio Workbench vs Raw Markdown */}
          <div className="flex items-center gap-2 pb-1 pr-1">
            <button
              type="button"
              onClick={() => {
                if (editorMode === 'studio') {
                  setRawMarkdown(songToMarkdown({
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
                    isPrivateDemo: isPrivateDemo,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  }));
                  setEditorMode('markdown');
                } else {
                  try {
                    const parsed = markdownToSong(rawMarkdown, id);
                    setTitle(parsed.title);
                    setLyrics(parsed.lyrics);
                    setStatus(parsed.status);
                    if (parsed.key) setKey(parsed.key);
                    if (parsed.tempo) setTempo(parsed.tempo.toString());
                  } catch {}
                  setEditorMode('studio');
                }
              }}
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
            <button onClick={() => setValidationError(null)} className="hover:underline cursor-pointer">
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
            <button onClick={() => setAudioAnalysisNotice(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
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
            if (file) handleAudioFileChosen(file);
          }}
          className="hidden"
        />

        {/* Global Hidden Audio Element */}
        {audioUrl && (
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
          />
        )}

        {/* =========================================================================
            TAB CONTENT PANELS
           ========================================================================= */}
        {editorMode === 'studio' ? (
          <div className="flex-1 flex flex-col min-h-[580px] bg-[var(--bg-canvas)]">
            
            {/* -----------------------------------------------------------------------
                TAB 1: LYRICS.MD (Songwriting Studio & Live Stand Preview)
               ----------------------------------------------------------------------- */}
            {activeTab === 'lyrics.md' && (
              <div className="flex-1 flex flex-col">
                {/* Diatonic Chord Toolbar + Quick Section Anchors */}
                <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Left: Diatonic Chord Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-[var(--text-primary)] mr-1 flex items-center gap-1">
                      <Music className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Acordes en [{key}]:</span>
                    </span>
                    {availableChords.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleInsertChordAtCursor(c)}
                        className="px-2 py-1 text-xs font-mono font-bold rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer shadow-2xs active:scale-95"
                        title={`Insertar acorde [${c}] en la posición del cursor`}
                      >
                        [{c}]
                      </button>
                    ))}

                    {/* Custom Chord input */}
                    <div className="flex items-center gap-1 pl-1">
                      <input
                        type="text"
                        value={customChordInput}
                        onChange={(e) => setCustomChordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomChord();
                          }
                        }}
                        placeholder="ej. B7, D/F#"
                        className="w-16 px-1.5 py-0.5 text-xs font-mono rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomChord}
                        disabled={!customChordInput.trim()}
                        className="px-1.5 py-0.5 text-xs font-semibold rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:text-[var(--accent-primary)] cursor-pointer disabled:opacity-40"
                        title="Insertar acorde personalizado"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Right: Section Anchors & Songwriting Templates */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-muted)] font-medium mr-1">Sección:</span>
                    {(['Intro', 'Estrofa 1', 'Estrofa 2', 'Estribillo', 'Puente', 'Coda'] as const).map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => handleInsertSection(sec)}
                        className="px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:text-[var(--accent-primary)] text-[11px] text-[var(--text-secondary)] transition-colors cursor-pointer"
                      >
                        + {sec}
                      </button>
                    ))}

                    <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

                    {/* Templates dropdown */}
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleApplyTemplate(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="text-[11px] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded px-2 py-0.5 text-[var(--text-secondary)] focus:outline-none cursor-pointer"
                      defaultValue=""
                    >
                      <option value="" disabled>Plantillas de estructura...</option>
                      {SONGWRITING_TEMPLATES.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleStripChords}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                      title="Eliminar todos los acordes [C] para dejar solo la poesía"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Editor Workbench: Left Code/Lyrics + Right Live Atril Preview */}
                <div className={`flex-1 grid ${showStandPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)] min-h-[460px]`}>
                  {/* Left: Code/Lyrics Editor */}
                  <div className="flex flex-col relative bg-[var(--bg-surface)]">
                    <div className="px-4 py-2 bg-[var(--bg-surface-subtle)]/50 border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
                      <span>Editor de Versos y Armonía</span>
                      <span>Inserta <code>[Acorde]</code> justo antes de la sílaba acentuada</span>
                    </div>

                    <div className="flex-1 flex relative">
                      {/* Line Numbers Gutter */}
                      <div className="w-10 py-3 bg-[var(--bg-surface-subtle)]/30 border-r border-[var(--border-subtle)] select-none text-right pr-2 font-mono text-[11px] text-[var(--text-muted)]/60 leading-relaxed overflow-hidden">
                        {Array.from({ length: Math.max(linesCount, 18) }, (_, i) => (
                          <div key={i + 1}>{i + 1}</div>
                        ))}
                      </div>

                      {/* Textarea */}
                      <textarea
                        ref={lyricsTextareaRef}
                        value={lyrics}
                        onChange={(e) => {
                          setLyrics(e.target.value);
                          updateCursorPosition();
                        }}
                        onKeyUp={updateCursorPosition}
                        onClick={updateCursorPosition}
                        placeholder="Escribe aquí los versos. Ejemplo: [Am] En la noche que nos [G] vimos..."
                        className="flex-1 p-3 font-mono text-xs sm:text-sm bg-transparent text-[var(--text-primary)] leading-relaxed resize-none focus:outline-none"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  {/* Right: Live Stand Preview (Atril interactivo) */}
                  {showStandPreview && (
                    <div className="flex flex-col bg-[var(--bg-surface-subtle)]/30">
                      <div className="px-4 py-2 bg-[var(--bg-surface-subtle)]/70 border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                          <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          <span>Atril en Vivo (Acordes sobre sílabas)</span>
                        </span>
                        <span className="font-bold text-[var(--accent-primary)]">
                          Tono: {key}
                        </span>
                      </div>

                      <div className="flex-1 p-5 overflow-y-auto max-h-[580px] space-y-1">
                        {renderLyricsStandPreview()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------------
                TAB 2: AUDIO-STUDIO.DSP (Audio Workstation, DSP Analysis & Transcription)
               ----------------------------------------------------------------------- */}
            {activeTab === 'audio-studio.dsp' && (
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
                      onClick={() => audioFileInputRef.current?.click()}
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
                          onClick={() => {
                            if (!localAudioRef.current) return;
                            if (isPlayingLocalAudio) {
                              localAudioRef.current.pause();
                              setIsPlayingLocalAudio(false);
                            } else {
                              localAudioRef.current.play();
                              setIsPlayingLocalAudio(true);
                            }
                          }}
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
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setAudioCurrentTime(val);
                              if (localAudioRef.current) localAudioRef.current.currentTime = val;
                            }}
                            className="w-full accent-[var(--accent-primary)] cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                            <span>{Math.floor(audioCurrentTime / 60)}:{(Math.floor(audioCurrentTime % 60)).toString().padStart(2, '0')}</span>
                            <span>{Math.floor(audioDuration / 60)}:{(Math.floor(audioDuration % 60)).toString().padStart(2, '0')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => audioFileInputRef.current?.click()}
                      className="p-8 text-center rounded-lg border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer space-y-2"
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <h4 className="font-serif font-bold text-xs text-[var(--text-primary)]">
                        Arrastra o pulsa aquí para subir tu maqueta o nota de voz
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Formatos soportados: MP3, WAV, M4A, OGG.
                      </p>
                    </div>
                  )}
                </div>

                {/* Grid: 1. DSP Harmonic Detection & 2. Gemini AI Voice Transcription */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* DSP Analyzer Widget */}
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center font-bold">
                        <Wand2 className="w-4 h-4" />
                      </div>
                      <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                        Detector Acústico DSP
                      </h4>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Extrae tono, tempo (BPM), compás y acordes desde las ondas sonoras.
                    </p>

                    <AudioAnalyzerSection
                      onApplyDetection={handleApplyAudioDetection}
                      onInsertChordsIntoLyrics={handleInsertDetectedChords}
                      currentKey={key}
                      currentTempo={tempo}
                      currentAudioUrl={audioUrl}
                      driveFileId={driveFileId}
                      driveFileName={driveFileName}
                      onAudioFileSelected={handleAudioFileChosen}
                      externalAudioFile={activeAudioFile}
                    />
                  </div>

                  {/* Dual-Engine Voice-to-Text Transcription Card (Whisper Local vs Gemini AI Cloud) */}
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
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

                        {/* Security / Secret badge */}
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

                      {/* Engine Segmented Selector */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                          Selecciona el motor de transcripción:
                        </label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-surface-subtle)] rounded-lg border border-[var(--border-subtle)]">
                          {/* Option 1: Whisper Local */}
                          <button
                            type="button"
                            onClick={() => setTranscriptionEngine('local_whisper')}
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

                          {/* Option 2: Gemini AI Cloud */}
                          <button
                            type="button"
                            onClick={() => setTranscriptionEngine('backend_gemini')}
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
                            <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                              API Nube · Máxima precisión
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Engine-specific Options & Guidance */}
                      {transcriptionEngine === 'local_whisper' ? (
                        <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                              Idioma esperado:
                            </span>
                            <select
                              value={transcriptionLanguage}
                              onChange={(e) => setTranscriptionLanguage(e.target.value as any)}
                              className="text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none cursor-pointer"
                            >
                              <option value="spanish">Español (Recomendado)</option>
                              <option value="english">Inglés</option>
                              <option value="auto">Detección automática</option>
                            </select>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            Ejecuta el modelo <strong>Whisper Tiny</strong> directamente en tu navegador usando WebAssembly / WebGPU. El audio de tu maqueta <strong>nunca sale de tu dispositivo</strong>, no consume cuotas y funciona sin necesidad de secretos ni claves de API.
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
                                No se ha detectado la variable de entorno en el servidor. Para una experiencia segura y sin errores, recomendamos utilizar el motor <strong>Whisper Local</strong>.
                              </p>
                              <button
                                type="button"
                                onClick={() => setTranscriptionEngine('local_whisper')}
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
                              onChange={(e) => setBackendConsent(e.target.checked)}
                              className="rounded accent-[var(--accent-primary)]"
                            />
                            <span>Autorizo procesar el audio mediante el proxy seguro del servidor con Gemini AI</span>
                          </label>
                        </div>
                      )}

                      {/* Progress and status ticker */}
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

                      {/* Last result box */}
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
                              onClick={() => handleApplyTranscribedLyrics(true)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--accent-primary)] text-[var(--accent-text)] cursor-pointer"
                            >
                              Reemplazar letra
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyTranscribedLyrics(false)}
                              className="px-2.5 py-1 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] cursor-pointer"
                            >
                              Añadir al final
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Execution Button */}
                    <button
                      type="button"
                      onClick={handleRunTranscription}
                      disabled={isTranscribing || !activeAudioFile || (transcriptionEngine === 'backend_gemini' && !backendConsent)}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {transcriptionEngine === 'local_whisper' ? <Cpu className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>
                        {isTranscribing
                          ? 'Procesando transcripción...'
                          : transcriptionEngine === 'local_whisper'
                          ? 'Transcribir con Whisper Local'
                          : 'Transcribir con Gemini AI'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------------
                TAB 3: SYNC.LRC (LRC Sincronización & Tap-to-Sync Assistant)
               ----------------------------------------------------------------------- */}
            {activeTab === 'sync.lrc' && (
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
                        onClick={handleCopyLyricsToLrc}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                        title="Importar letra actual limpiando acordes"
                      >
                        Copiar desde Letra
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyLrcToLyrics}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] cursor-pointer"
                        title="Transferir este texto a lyrics.md sin tiempos"
                      >
                        Copiar a Letra
                      </button>
                    </div>
                  </div>

                  {/* Hero Tap-to-Sync Banner */}
                  <div className="p-4 rounded-xl bg-[var(--accent-subtle)]/30 border border-[var(--accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-[var(--accent-primary)] uppercase tracking-wider block">
                        Asistente Tap-to-Sync en Vivo
                      </span>
                      <p className="text-xs text-[var(--text-primary)]">
                        Pulsa la barra <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[11px] font-bold">Espacio</kbd> al inicio de cada frase mientras escuchas la canción.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsSyncAssistantOpen(true)}
                      disabled={!audioUrl}
                      className="px-4 py-2 text-xs font-bold rounded-md bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{audioUrl ? 'Abrir Asistente Tap-to-Sync' : 'Requiere archivo de audio'}</span>
                    </button>
                  </div>

                  {/* LRC Editor */}
                  <div className="space-y-1">
                    <label className="block text-xs font-mono text-[var(--text-secondary)]">
                      Marcas de tiempo LRC: <code>[mm:ss.xx] Verso lírico</code>
                    </label>
                    <textarea
                      rows={14}
                      value={lrc}
                      onChange={(e) => setLrc(e.target.value)}
                      placeholder="[00:12.30] Primer verso cantado de la canción..."
                      className="w-full p-3 font-mono text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-y"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------------
                TAB 4: METADATA.JSON (Technical Sheet, Album Tracklist & Diary)
               ----------------------------------------------------------------------- */}
            {activeTab === 'metadata.json' && (
              <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-w-5xl mx-auto w-full">
                {/* Form Sheet */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-xs space-y-5">
                  <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                    <SlidersHorizontal className="w-4 h-4 text-[var(--accent-primary)]" />
                    <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                      Ficha Técnica & Configuración de Discografía
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Album assignment */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1">
                        <Disc className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>Álbum de Estudio</span>
                      </label>
                      <select
                        value={selectedAlbumId}
                        onChange={(e) => setSelectedAlbumId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      >
                        <option value="">-- Sin álbum (Tema independiente) --</option>
                        {albums.map((alb) => (
                          <option key={alb.id} value={alb.id}>
                            {alb.title} {alb.year ? `(${alb.year})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Track Number */}
                    {selectedAlbumId && (
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                          Pista N° en el Álbum
                        </label>
                        <input
                          type="number"
                          value={trackNumber}
                          onChange={(e) => setTrackNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                          placeholder="1, 2, 3..."
                          min="1"
                          className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Year */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Año de Composición
                      </label>
                      <input
                        type="number"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>

                    {/* Genre */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Género / Estilo
                      </label>
                      <input
                        type="text"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        placeholder="Canción de Autor, Acústico..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>

                    {/* Tuning */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Afinación del Instrumento
                      </label>
                      <select
                        value={tuning}
                        onChange={(e) => setTuning(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                      >
                        {COMMON_TUNINGS.map(tun => (
                          <option key={tun} value={tun}>{tun}</option>
                        ))}
                      </select>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Duración (mm:ss)
                      </label>
                      <input
                        type="text"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="03:45"
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Streaming URLs */}
                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Enlaces de Distribución y Streaming
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">Spotify URL</label>
                        <input
                          type="url"
                          value={spotifyUrl}
                          onChange={(e) => setSpotifyUrl(e.target.value)}
                          placeholder="https://open.spotify.com/track/..."
                          className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">YouTube URL</label>
                        <input
                          type="url"
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">SoundCloud URL</label>
                        <input
                          type="url"
                          value={soundcloudUrl}
                          onChange={(e) => setSoundcloudUrl(e.target.value)}
                          placeholder="https://soundcloud.com/..."
                          className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--text-muted)] mb-1">Apple Music URL</label>
                        <input
                          type="url"
                          value={appleMusicUrl}
                          onChange={(e) => setAppleMusicUrl(e.target.value)}
                          placeholder="https://music.apple.com/..."
                          className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">
                      Etiquetas Temáticas
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] text-xs font-mono"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => setTags(tags.filter(t => t !== tag))}
                            className="hover:text-rose-500 cursor-pointer ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const trimmed = tagInput.trim().toLowerCase();
                            if (trimmed && !tags.includes(trimmed)) {
                              setTags([...tags, trimmed]);
                              setTagInput('');
                            }
                          }
                        }}
                        placeholder="Añadir etiqueta (ej. guitarra, memoria, viaje)..."
                        className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none max-w-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = tagInput.trim().toLowerCase();
                          if (trimmed && !tags.includes(trimmed)) {
                            setTags([...tags, trimmed]);
                            setTagInput('');
                          }
                        }}
                        className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>

                  {/* Composition Notes / Diary */}
                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">
                      Diario de Composición / Historia de la Canción
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="El contexto en que nació la canción, afinación de guitarra o recuerdos..."
                      className="w-full px-3 py-2 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:outline-none text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>
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
                onClick={() => handleSubmit()}
                className="px-4 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] rounded-md hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                Guardar Markdown
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            ROW 4: DESKTOP APPLICATION STATUS BAR (VS Code / IDE Style)
           ========================================================================= */}
        <div className="bg-[var(--bg-surface-subtle)] border-t border-[var(--border-subtle)] px-3 py-1 flex flex-wrap items-center justify-between text-[11px] font-mono text-[var(--text-muted)] select-none">
          {/* Left: Caret position & Word count */}
          <div className="flex items-center gap-3">
            <span>
              Ln <strong className="text-[var(--text-primary)]">{cursorPos.line}</strong>, Col <strong className="text-[var(--text-primary)]">{cursorPos.col}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>{linesCount} versos</span>
            <span aria-hidden="true">·</span>
            <span>{wordsCount} palabras</span>
            <span aria-hidden="true">·</span>
            <span>UTF-8</span>
          </div>

          {/* Center: Musical settings */}
          <div className="flex items-center gap-3 hidden md:flex">
            <span>Tono: <strong className="text-[var(--accent-primary)]">{key}</strong> ({accidentalPreference === 'sharps' ? '#' : 'b'})</span>
            <span aria-hidden="true">·</span>
            <span>{tempo || '--'} BPM</span>
            <span aria-hidden="true">·</span>
            <span>{timeSignature}</span>
          </div>

          {/* Right: Completeness, Git status, Google Drive */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span>Completitud:</span>
              <strong className="text-[var(--text-primary)] tabular-nums">{completeness.percent}%</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1" title={token ? `Conectado a GitHub como @${user?.login || 'autor'}` : 'Guardado solo localmente'}>
              <FolderGit2 className="w-3 h-3 text-[var(--accent-primary)]" />
              <span>{token ? `@${user?.login || 'autor'}` : 'Local'}</span>
            </span>
            {driveFileId && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Maqueta guardada en Google Drive">
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

      {/* Tap-to-Sync Assistant Modal */}
      {isSyncAssistantOpen && (
        <LrcSyncAssistant
          isOpen={isSyncAssistantOpen}
          onClose={() => setIsSyncAssistantOpen(false)}
          rawLyrics={lyrics}
          currentTime={audioCurrentTime}
          duration={audioDuration}
          isPlaying={isPlayingLocalAudio}
          onSeek={(time) => {
            if (localAudioRef.current) localAudioRef.current.currentTime = time;
            setAudioCurrentTime(time);
          }}
          onTogglePlay={() => {
            if (!localAudioRef.current) return;
            if (isPlayingLocalAudio) {
              localAudioRef.current.pause();
              setIsPlayingLocalAudio(false);
            } else {
              localAudioRef.current.play();
              setIsPlayingLocalAudio(true);
            }
          }}
          songTitle={title || 'Sin título'}
          onSaveSyncedLyrics={(lines, rawLrc) => {
            setLrc(rawLrc);
            showFeedback(`Letra sincronizada guardada (${lines.length} versos marcados)`);
            setIsSyncAssistantOpen(false);
          }}
        />
      )}

      {/* Keyboard Shortcuts Help Dialog */}
      {isShortcutsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[var(--accent-primary)]" />
                <h3 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                  Atajos de Teclado del Estudio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span>Guardar canción</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">Ctrl + S</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span>Alternar Vista Dividida Atril</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">Ctrl + B</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span>Reproducir / Pausar audio</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">Espacio</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span>Exportar Cancionero PDF</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">Ctrl + P</kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Cerrar menús desplegables</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">Esc</kbd>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
