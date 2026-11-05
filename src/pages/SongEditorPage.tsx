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
  Info
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

interface SongEditorPageProps {
  song: Song | null;
  albums?: Album[];
  initialAlbumId?: string;
  initialAudioFile?: File;
  onSave: (song: Song, pushResult?: PushResult) => void;
  onDelete?: (song: Song) => void;
}

type EditorStage = 'lyrics' | 'audio' | 'sync' | 'meta';

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
  
  // Editor mode: guided workshop vs raw markdown
  const [editorMode, setEditorMode] = useState<'guided' | 'markdown'>('guided');
  
  // Current active stage
  const [activeStage, setActiveStage] = useState<EditorStage>('lyrics');

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
  const [isReanalyzingDrive, setIsReanalyzingDrive] = useState<boolean>(false);
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
  const [transcriptionEngine, setTranscriptionEngine] = useState<'backend_gemini' | 'local_whisper'>('backend_gemini');
  const [backendConsent, setBackendConsent] = useState<boolean>(true);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [lastTranscriptionResult, setLastTranscriptionResult] = useState<LyricsTranscriptionResult | null>(null);

  // Music stand live preview toggle
  const [showStandPreview, setShowStandPreview] = useState<boolean>(false);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Tap-to-sync assistant modal state
  const [isSyncAssistantOpen, setIsSyncAssistantOpen] = useState<boolean>(false);

  // Raw Markdown
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Git Push State
  const [pushToGitHub, setPushToGitHub] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  // Textarea ref for inserting chords at cursor
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

  // Handle initialAudioFile if passed
  useEffect(() => {
    if (initialAudioFile) {
      handleAudioFileChosen(initialAudioFile);
      setActiveStage('audio');
    }
  }, [initialAudioFile]);

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

  // Clean chord list from detection
  const cleanChordList = useMemo(() => {
    return getCleanChordSequence(detectedChords);
  }, [detectedChords]);

  // Toast feedback helper
  const showFeedback = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
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
      // No selection, insert chord at cursor
      nextText = current.substring(0, start) + chordTag + current.substring(end);
    } else {
      // Selected text: wrap in front of the selected syllable/word
      const selected = current.substring(start, end);
      nextText = current.substring(0, start) + chordTag + selected + current.substring(end);
      newCursorPos = start + chordTag.length + selected.length;
    }

    setLyrics(nextText);
    showFeedback(`Acorde ${chordTag} insertado`);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
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
      }
    }, 50);
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

  // Audio Upload & Google Drive Handler
  const handleAudioFileChosen = async (file: File) => {
    setActiveAudioFile(file);
    const localUrl = URL.createObjectURL(file);
    setAudioUrl(localUrl);

    // If title is empty, deduce default from file name
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

  // Voice-to-Text Transcription Handler
  const handleRunTranscription = async () => {
    if (!activeAudioFile) {
      setTranscriptionError('Selecciona o arrastra primero un archivo de audio para transcribir.');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionProgress('Iniciando procesamiento de voz...');

    try {
      let result: LyricsTranscriptionResult;

      if (transcriptionEngine === 'backend_gemini') {
        if (!backendConsent) {
          throw new Error('Debes autorizar el procesamiento de audio para transcribir con Gemini AI.');
        }
        setTranscriptionProgress('Analizando voz cantada con Gemini AI...');
        result = await LyricsTranscriptionService.transcribeWithBackendFromFile(
          activeAudioFile,
          backendConsent
        );
      } else {
        setTranscriptionProgress('Ejecutando modelo Whisper local en el navegador...');
        result = await LyricsTranscriptionService.transcribeLocalFromFile(
          activeAudioFile,
          {
            allowWasmFallback: true,
            language: 'spanish'
          },
          (message, status) => {
            setTranscriptionProgress(`[${status}] ${message}`);
          }
        );
      }

      setLastTranscriptionResult(result);
      showFeedback(`Transcripción completada: ${result.lines.length} versos detectados`);
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

    // Auto-generate synced LRC if lines exist and LRC was empty
    if (lastTranscriptionResult.lines.length > 0 && !lrc) {
      const generatedLrc = serializeToLrc(lastTranscriptionResult.lines, {
        title: title || 'Sin título',
        artist: user?.name || user?.login || 'Autor'
      });
      setLrc(generatedLrc);
    }

    showFeedback('Letra transcrita importada al editor');
    setActiveStage('lyrics');
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
        setActiveStage('meta');
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

    // Git push if author is connected
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

  return (
    <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in text-[var(--text-primary)]">
      {/* Sticky Top Bar: Breadcrumb + Title + Completeness + Primary Save */}
      <div className="sticky top-18 z-30 bg-[var(--bg-canvas)]/95 backdrop-blur-md pb-4 pt-1 mb-6 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => (song ? navigate({ name: 'song-detail', songId: song.id }) : goBack({ name: 'catalog' }))}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group shrink-0"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Volver</span>
          </button>

          <div className="h-4 w-px bg-[var(--border-subtle)]" />

          {/* Inline Title Field for immediate editing */}
          <div className="min-w-0 flex-1 max-w-md">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la canción..."
              className="w-full font-serif font-bold text-base sm:text-lg bg-transparent border-b border-transparent hover:border-[var(--border-medium)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] truncate px-1 py-0.5"
            />
          </div>
        </div>

        {/* Right side: Completeness progress + View mode + Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Completeness Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              <span className={`w-2 h-2 rounded-full ${completeness.percent >= 80 ? 'bg-emerald-500' : completeness.percent >= 40 ? 'bg-amber-500' : 'bg-slate-400'}`} />
              <span className="font-mono tabular-nums font-bold text-[var(--text-primary)]">
                {completeness.percent}%
              </span>
              <span className="text-[var(--text-muted)]">
                · {completeness.statusLabel}
              </span>
            </div>
          </div>

          {/* Status Segmented Pill */}
          <div className="flex items-center bg-[var(--bg-surface)] p-0.5 rounded-lg border border-[var(--border-subtle)] text-xs">
            <button
              type="button"
              onClick={() => setStatus('draft')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                status === 'draft' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold shadow-2xs' : 'text-[var(--text-muted)]'
              }`}
              title="Solo visible para el autor"
            >
              Borrador
            </button>
            <button
              type="button"
              onClick={() => setStatus('published')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                status === 'published' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold shadow-2xs' : 'text-[var(--text-muted)]'
              }`}
              title="Visible en el catálogo público"
            >
              Publicada
            </button>
            <button
              type="button"
              onClick={() => setStatus('private')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                status === 'private' ? 'bg-stone-500/15 text-stone-700 dark:text-stone-300 font-semibold shadow-2xs' : 'text-[var(--text-muted)]'
              }`}
              title="Inédita y protegida"
            >
              Inédita
            </button>
          </div>

          {/* Mode Switcher */}
          <button
            type="button"
            onClick={() => {
              if (editorMode === 'guided') {
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
                setEditorMode('guided');
              }
            }}
            className="px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            title="Alternar entre Taller Guiado y Markdown"
          >
            {editorMode === 'guided' ? 'MD' : 'Taller'}
          </button>

          {/* Main Save Action */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isPushing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isPushing ? 'Guardando...' : 'Guardar Canción'}</span>
          </button>
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
          <button onClick={() => setValidationError(null)} className="text-xs hover:underline cursor-pointer">
            Entendido
          </button>
        </div>
      )}

      {/* Audio Detection Applied Notice */}
      {audioAnalysisNotice && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{audioAnalysisNotice}</span>
          </div>
          <button onClick={() => setAudioAnalysisNotice(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Quick feedback toast */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 p-3 px-4 rounded-xl bg-[var(--text-primary)] text-[var(--bg-canvas)] shadow-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* MAIN GUIDED WORKSHOP VIEW */}
      {editorMode === 'guided' ? (
        <div className="space-y-6">
          {/* Stage Progression Navigation Tabs */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Tab 1: Letra & Acordes */}
              <button
                type="button"
                onClick={() => setActiveStage('lyrics')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeStage === 'lyrics'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>1. Letra & Acordes</span>
                {lyrics.trim().length > 20 && (
                  <Check className={`w-3.5 h-3.5 ${activeStage === 'lyrics' ? 'text-white' : 'text-emerald-500'}`} />
                )}
              </button>

              {/* Tab 2: Audio & Maqueta */}
              <button
                type="button"
                onClick={() => setActiveStage('audio')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeStage === 'audio'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>2. Audio & Maqueta</span>
                {(audioUrl || driveFileId) && (
                  <Check className={`w-3.5 h-3.5 ${activeStage === 'audio' ? 'text-white' : 'text-emerald-500'}`} />
                )}
              </button>

              {/* Tab 3: Sincronización LRC */}
              <button
                type="button"
                onClick={() => setActiveStage('sync')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeStage === 'sync'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>3. Sincronización LRC</span>
                {lrc.trim().length > 10 && (
                  <Check className={`w-3.5 h-3.5 ${activeStage === 'sync' ? 'text-white' : 'text-emerald-500'}`} />
                )}
              </button>

              {/* Tab 4: Ficha & Publicación */}
              <button
                type="button"
                onClick={() => setActiveStage('meta')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeStage === 'meta'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>4. Ficha & Publicación</span>
                {title.trim().length > 0 && (
                  <Check className={`w-3.5 h-3.5 ${activeStage === 'meta' ? 'text-white' : 'text-emerald-500'}`} />
                )}
              </button>
            </div>

            {/* Quick helper tip */}
            <div className="hidden md:flex items-center gap-2 pr-3 text-xs text-[var(--text-muted)]">
              <span className="font-serif italic">{completeness.nextSuggestion}</span>
            </div>
          </div>

          {/* =========================================================================
              STAGE 1: LETRA & ACORDES (The Lyricist & Chord Workshop)
             ========================================================================= */}
          {activeStage === 'lyrics' && (
            <div className="space-y-6">
              {/* Quick Actions & Chord Inserter Bar */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                {/* Row 1: Key selection + Transposition + Stand preview toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold text-[var(--text-primary)]">Tonalidad:</span>
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        className="w-14 px-2 py-1 font-mono font-bold text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary)] text-center focus:outline-none focus:border-[var(--accent-primary)]"
                        placeholder="Am"
                      />
                    </div>

                    {/* Transpose buttons */}
                    <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)] text-xs">
                      <button
                        type="button"
                        onClick={() => handleTransposeLyrics(-1)}
                        className="px-2 py-1 rounded hover:bg-[var(--bg-surface)] transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title="Bajar medio tono (-1 semitono)"
                      >
                        -1 Tono
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTransposeLyrics(1)}
                        className="px-2 py-1 rounded hover:bg-[var(--bg-surface)] transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title="Subir medio tono (+1 semitono)"
                      >
                        +1 Tono
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleAccidentals}
                        className="px-2 py-1 font-mono font-bold rounded hover:bg-[var(--bg-surface)] transition-colors cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title="Alternar sostenidos (#) o bemoles (b)"
                      >
                        {accidentalPreference === 'sharps' ? '#' : 'b'}
                      </button>
                    </div>

                    <div className="h-4 w-px bg-[var(--border-subtle)] hidden sm:block" />

                    {/* Tempo (BPM) display / input */}
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <span>Tempo:</span>
                      <input
                        type="number"
                        value={tempo}
                        onChange={(e) => setTempo(e.target.value)}
                        className="w-14 px-2 py-1 font-mono text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-center focus:outline-none focus:border-[var(--accent-primary)]"
                        placeholder="96"
                      />
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">BPM</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowStandPreview(!showStandPreview)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        showStandPreview
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                      title="Ver vista previa de atril con acordes sobre la letra"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{showStandPreview ? 'Ocultar Atril' : 'Vista Previa Atril'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStripChords}
                      className="p-1.5 text-xs rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                      title="Eliminar todos los acordes entre corchetes [C] para dejar solo la poesía"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Interactive Quick-Chord Palette for the active Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Paleta de Acordes para [{key}]:</span>
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Haz clic en un acorde para insertarlo en la posición actual del cursor
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {availableChords.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleInsertChordAtCursor(c)}
                        className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer shadow-2xs active:scale-95"
                        title={`Insertar [${c}] en el cursor`}
                      >
                        [{c}]
                      </button>
                    ))}

                    {/* Custom Chord adder input */}
                    <div className="flex items-center gap-1 ml-1 pl-2 border-l border-[var(--border-subtle)]">
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
                        className="w-20 px-2 py-0.5 text-xs font-mono rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomChord}
                        disabled={!customChordInput.trim()}
                        className="px-2 py-0.5 text-xs font-semibold rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:text-[var(--accent-primary)] cursor-pointer disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 3: Section Headers Generators */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium mr-1">Añadir sección:</span>
                  {(['Intro', 'Estrofa 1', 'Estrofa 2', 'Estribillo', 'Puente', 'Solo', 'Outro'] as const).map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleInsertSection(sec)}
                      className="px-2.5 py-0.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:text-[var(--accent-primary)] text-[11px] text-[var(--text-secondary)] transition-colors cursor-pointer"
                    >
                      + {sec}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Lyrics Textarea + Optional Split Stand Preview */}
              <div className={`grid gap-6 ${showStandPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Left: Lyrics Textarea */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="font-mono">
                      {lyrics.split('\n').filter(l => l.trim().length > 0).length} versos anotados
                    </span>
                    <span>Usa corchetes para los acordes: <code>[Am] verso cantado...</code></span>
                  </div>

                  <textarea
                    ref={lyricsTextareaRef}
                    rows={16}
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="Escribe aquí la letra. Inserta los acordes sobre las sílabas con la paleta superior..."
                    className="w-full px-4 py-3 font-mono text-xs sm:text-sm rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-y shadow-xs"
                  />
                </div>

                {/* Right: Stand Preview (when toggled) */}
                {showStandPreview && (
                  <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] shadow-inner space-y-2 flex flex-col">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--border-subtle)]">
                      <span className="font-serif font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>Vista de Atril en Tiempo Real</span>
                      </span>
                      <span className="font-mono text-[11px] text-[var(--accent-primary)] font-bold">
                        Tono: {key}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[420px] pr-2 space-y-1">
                      {renderLyricsStandPreview()}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Navigation for Stage 1 */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)]">
                  Paso 1 de 4: Letra y Acordes
                </span>
                <button
                  type="button"
                  onClick={() => setActiveStage('audio')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs"
                >
                  <span>Siguiente: Audio & Maqueta</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              STAGE 2: AUDIO & MAQUETA (Audio Dropzone, Detection & Transcription)
             ========================================================================= */}
          {activeStage === 'audio' && (
            <div className="space-y-6">
              {/* Audio Dropzone and Player Card */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center font-bold">
                      <Mic className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-serif font-bold text-[var(--text-primary)]">
                        Maqueta de Audio & Análisis Acústico
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        Sube una nota de voz o maqueta acústica para detectar automáticamente tempo, escala y transcribir la letra cantada.
                      </p>
                    </div>
                  </div>

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

                  <button
                    type="button"
                    onClick={() => audioFileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{audioUrl ? 'Cambiar archivo de audio' : 'Subir Nota de Voz / Audio (.mp3, .wav)'}</span>
                  </button>
                </div>

                {/* If audio is assigned, show integrated player */}
                {audioUrl ? (
                  <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileAudio className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate block font-mono">
                            {activeAudioFile?.name || driveFileName || 'Audio de la canción asignado'}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {activeAudioFile ? `${(activeAudioFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Listo para reproducir y analizar'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {driveFileId && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <Cloud className="w-3 h-3" />
                            <span>En Google Drive</span>
                          </span>
                        )}
                      </div>
                    </div>

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

                    {/* Simple Playback Bar */}
                    <div className="flex items-center gap-3 pt-1">
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
                        className="w-9 h-9 rounded-full bg-[var(--accent-primary)] text-[var(--accent-text)] flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        {isPlayingLocalAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
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
                  /* Audio Empty Dropzone */
                  <div
                    onClick={() => audioFileInputRef.current?.click()}
                    className="p-8 text-center rounded-2xl border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-subtle)]/10 transition-colors cursor-pointer space-y-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                      Arrastra tu nota de voz o archivo de audio aquí
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                      Formatos compatibles: .mp3, .wav, .m4a, .ogg. Podrás detectar el tono y tempo o transcribir la letra en un clic.
                    </p>
                  </div>
                )}
              </div>

              {/* The Two Main AI/DSP Powers: 1. Auto-Detect Key & BPM, 2. Transcribe voice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* DSP Key & Tempo Detector Card */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center font-bold">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                      Detección Musical DSP
                    </h4>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Analiza el audio con algoritmos DSP para extraer el tempo exacto (BPM), la tonalidad y los acordes.
                  </p>

                  <div className="pt-2">
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
                </div>

                {/* Voice-to-Text Transcription Card */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center font-bold">
                        <Mic className="w-4 h-4" />
                      </div>
                      <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                        Transcripción de Voz Cantada
                      </h4>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Convierte la voz cantada de tu audio a versos de texto con Gemini AI o Whisper local.
                    </p>

                    {/* Consent checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={backendConsent}
                        onChange={(e) => setBackendConsent(e.target.checked)}
                        className="rounded accent-[var(--accent-primary)]"
                      />
                      <span>Autorizo analizar audio cantado con Gemini AI</span>
                    </label>

                    {transcriptionProgress && (
                      <div className="p-3 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-xs flex items-center gap-2 animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-ping" />
                        <span>{transcriptionProgress}</span>
                      </div>
                    )}

                    {transcriptionError && (
                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                        {transcriptionError}
                      </div>
                    )}

                    {/* Results Box */}
                    {lastTranscriptionResult && (
                      <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
                        <span className="text-[11px] font-mono text-[var(--text-primary)] font-semibold block">
                          Resultado ({lastTranscriptionResult.lines.length} versos):
                        </span>
                        <div className="p-2.5 rounded bg-[var(--bg-surface)] text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {lastTranscriptionResult.text}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApplyTranscribedLyrics(true)}
                            className="px-3 py-1 text-xs font-semibold rounded bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] cursor-pointer"
                          >
                            Reemplazar letra
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyTranscribedLyrics(false)}
                            className="px-3 py-1 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] cursor-pointer"
                          >
                            Añadir al final
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRunTranscription}
                    disabled={isTranscribing || !activeAudioFile}
                    className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    <span>{isTranscribing ? 'Transcribiendo...' : 'Iniciar Transcripción de Voz'}</span>
                  </button>
                </div>
              </div>

              {/* Bottom Navigation for Stage 2 */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setActiveStage('lyrics')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Letra</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStage('sync')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs"
                >
                  <span>Siguiente: Sincronización LRC</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              STAGE 3: SINCRONIZACIÓN LRC (Atril & Teleprompter Timing)
             ========================================================================= */}
          {activeStage === 'sync' && (
            <div className="space-y-6">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center font-bold">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-serif font-bold text-[var(--text-primary)]">
                        Sincronización LRC (Modo Atril & Karaoke)
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        Permite que los versos se iluminen y deslicen automáticamente mientras tocas o cantas la canción en vivo.
                      </p>
                    </div>
                  </div>

                  {/* Actions for LRC */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLyricsToLrc}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                      title="Copiar texto de letra limpiando automáticamente los acordes entre corchetes"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>Importar desde Letra (sin acordes)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyLrcToLyrics}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] transition-colors cursor-pointer"
                      title="Transferir este texto a la letra eliminando marcas temporales"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>Copiar a Letra (sin tiempos)</span>
                    </button>
                  </div>
                </div>

                {/* Hero Tap-to-Sync Assistant Launcher */}
                <div className="p-5 rounded-2xl bg-[var(--accent-subtle)]/30 border border-[var(--accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-[var(--accent-primary)] uppercase tracking-wider block">
                      Asistente en Vivo (Espacio para estampar versos)
                    </span>
                    <p className="text-xs text-[var(--text-primary)]">
                      Sincroniza tus versos en tiempo real: reproduce el audio y presiona la tecla <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[11px] font-bold">Espacio</kbd> al inicio de cada frase.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSyncAssistantOpen(true)}
                    disabled={!audioUrl}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-md disabled:opacity-50 shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{audioUrl ? 'Abrir Asistente en Vivo (Tap-to-Sync)' : 'Sube un audio primero'}</span>
                  </button>
                </div>

                {/* LRC Raw Content Textarea */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">
                    Contenido LRC [mm:ss.xx]
                  </label>
                  <textarea
                    rows={12}
                    value={lrc}
                    onChange={(e) => setLrc(e.target.value)}
                    placeholder="[00:14.20] Primer verso de la canción..."
                    className="w-full px-4 py-3 font-mono text-xs sm:text-sm rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-y"
                  />
                </div>
              </div>

              {/* Bottom Navigation for Stage 3 */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setActiveStage('audio')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Audio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStage('meta')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs"
                >
                  <span>Siguiente: Ficha & Publicación</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              STAGE 4: FICHA & PUBLICACIÓN (Album, Metadata, Notes & Launch)
             ========================================================================= */}
          {activeStage === 'meta' && (
            <div className="space-y-6">
              {/* Completeness Summary Banner */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">
                      Estado de la Canción: {completeness.percent}% Completa
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Revisa los elementos de tu composición antes de publicarla en el cancionero.
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    completeness.percent >= 80 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}>
                    {completeness.statusLabel}
                  </span>
                </div>

                {/* Steps checklist */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {completeness.steps.map(step => (
                    <div
                      key={step.id}
                      className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                        step.isComplete
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${step.isComplete ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                      <div>
                        <span className="font-semibold block text-[var(--text-primary)]">
                          {step.title}
                        </span>
                        <span className="text-[11px] opacity-80">
                          {step.hint}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Album & Metadata Form */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                <h4 className="font-serif font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Ficha Técnica y Clasificación</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Album assignment */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                      <Disc className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Álbum de la Discografía</span>
                    </label>
                    <select
                      value={selectedAlbumId}
                      onChange={(e) => setSelectedAlbumId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    >
                      <option value="">-- Sin álbum (Sencillo suelto) --</option>
                      {albums.map((alb) => (
                        <option key={alb.id} value={alb.id}>
                          {alb.title} {alb.year ? `(${alb.year})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Track number in album */}
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
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
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
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
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
                      placeholder="Canción de Autor, Bolero, Acústico..."
                      className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  {/* Tuning */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Afinación del Instrumento
                    </label>
                    <input
                      type="text"
                      value={tuning}
                      onChange={(e) => setTuning(e.target.value)}
                      placeholder="Estándar (EADGBE)"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>

                  {/* Compás */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Compás Musical
                    </label>
                    <input
                      type="text"
                      value={timeSignature}
                      onChange={(e) => setTimeSignature(e.target.value)}
                      placeholder="4/4, 3/4, 6/8..."
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                {/* Thematic Tags */}
                <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    Etiquetas Temáticas
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] text-xs font-mono"
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
                      className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] max-w-xs"
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
                      className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                </div>

                {/* Songwriting Notes */}
                <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">
                    Historia, Anécdota o Notas de Arreglo
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="El contexto en que nació la canción, anécdota de grabación o técnica de mano derecha..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Final Launch Action Bar */}
              <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <h4 className="font-serif font-bold text-base text-[var(--text-primary)]">
                    ¿Canción completa y lista para compartir?
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    Al marcarla como <strong>Publicada</strong>, estará inmediatamente disponible en el catálogo y lista para exportar en el Cancionero de Atril en PDF.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('published');
                      handleSubmit();
                    }}
                    disabled={isPushing}
                    className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Publicar Canción Completa</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* RAW MARKDOWN VIEW */
        <div className="space-y-4">
          <textarea
            rows={24}
            value={rawMarkdown}
            onChange={(e) => setRawMarkdown(e.target.value)}
            className="w-full p-4 font-mono text-xs sm:text-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-y"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditorMode('guided')}
              className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Volver al Taller Guiado
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="px-5 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              Guardar Markdown
            </button>
          </div>
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
    </div>
  );
};
