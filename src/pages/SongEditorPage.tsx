import React, { useState, useEffect, useRef } from 'react';
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
  Copy,
  Radio,
  ListMusic,
  Check,
  Clock,
  Layers,
  UploadCloud,
  FileText,
  Lock,
  Unlock,
  Cloud,
  RefreshCw,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Play,
  ArrowDown,
  ArrowUp,
  Eraser
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

interface SongEditorPageProps {
  song: Song | null;
  albums?: Album[];
  initialAlbumId?: string;
  onSave: (song: Song, pushResult?: PushResult) => void;
  onDelete?: (song: Song) => void;
}

export const SongEditorPage: React.FC<SongEditorPageProps> = ({
  song,
  albums = [],
  initialAlbumId,
  onSave,
  onDelete
}) => {
  const { navigate, goBack } = useAppNavigation();
  const { token, user, isAuthor, isGoogleDriveConnected, googleUser, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'form' | 'raw_markdown'>('form');

  // Form fields
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<SongStatus>('draft');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>(initialAlbumId || '');
  const [trackNumber, setTrackNumber] = useState<number | ''>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [genre, setGenre] = useState('');
  const [key, setKey] = useState('Am');
  const [tempo, setTempo] = useState<string>('');
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
  const [showLrcEditor, setShowLrcEditor] = useState<boolean>(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [detectedChords, setDetectedChords] = useState<ChordSegment[]>([]);
  const [insertedChordsFeedback, setInsertedChordsFeedback] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [transposeOffset, setTransposeOffset] = useState<number>(0);
  const [transposeFeedback, setTransposeFeedback] = useState<string | null>(null);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');

  // Google Drive Maqueta States
  const [driveFileId, setDriveFileId] = useState<string>(song?.driveFileId || '');
  const [driveFileName, setDriveFileName] = useState<string>(song?.driveFileName || '');
  const [isPrivateDemo, setIsPrivateDemo] = useState<boolean>(song?.isPrivateDemo ?? true);
  const [activeAudioFile, setActiveAudioFile] = useState<File | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);
  const [isReanalyzingDrive, setIsReanalyzingDrive] = useState<boolean>(false);
  const [driveFeedback, setDriveFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const maquetaFileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Studio & Transcription States
  const [showAudioStudio, setShowAudioStudio] = useState<boolean>(true);
  const [activeStudioTab, setActiveStudioTab] = useState<'analyzer' | 'transcription'>('analyzer');
  const [audioAnalysisNotice, setAudioAnalysisNotice] = useState<string | null>(null);

  // Transcription controls
  const [transcriptionFile, setTranscriptionFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionEngine, setTranscriptionEngine] = useState<'backend_gemini' | 'local_whisper'>('backend_gemini');
  const [backendConsent, setBackendConsent] = useState<boolean>(true);
  const [allowWasmFallback, setAllowWasmFallback] = useState<boolean>(true);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string | null>(null);
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [lastTranscriptionResult, setLastTranscriptionResult] = useState<LyricsTranscriptionResult | null>(null);
  const transcriptionFileInputRef = useRef<HTMLInputElement | null>(null);

  // Raw Markdown field
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Git Push State
  const [pushToGitHub, setPushToGitHub] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (song) {
      setId(song.id);
      setTitle(song.title);
      setStatus(song.status);
      setSelectedAlbumId(song.albumId || initialAlbumId || '');
      setTrackNumber(song.trackNumber ?? '');
      setYear(song.year);
      setGenre(song.genre);
      setKey(song.key || 'Am');
      setTempo(song.tempo ? song.tempo.toString() : '');
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
      setShowLrcEditor(Boolean(song.lrc));
      setTags(song.tags || []);
      setRawMarkdown(songToMarkdown(song));
      setCommitMessage(`feat: actualizar canción "${song.title}"`);
    } else {
      // New song defaults
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
      setShowLrcEditor(false);
      setTags(['acústico', 'maqueta']);
      setCommitMessage(`feat: nueva composición en el cancionero`);
    }
  }, [song, initialAlbumId]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
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
      const offsetNote = typeof data.tempoOffset === 'number' && data.tempoOffset > 0
        ? ` (offset beat 1: ${data.tempoOffset.toFixed(3)}s)`
        : '';
      setNotes(`Progresión armónica detectada: ${data.chordProgression}${offsetNote}`);
    }
    if (data.suggestedLyricsChords && (!lyrics || lyrics.includes('Escribe aquí el primer verso') || lyrics.includes('Escribe el primer verso aquí'))) {
      setLyrics(data.suggestedLyricsChords);
    }

    setAudioAnalysisNotice(`Detección aplicada: ${data.key} · ${data.tempo} BPM · ${data.timeSignature}${data.chords ? ` · ${data.chords.length} acordes detectados` : ''}`);
    setTimeout(() => setAudioAnalysisNotice(null), 5000);
  };

  const handleInsertDetectedChords = (chordsOverride?: ChordSegment[]) => {
    const list = chordsOverride || detectedChords;
    if (!list || list.length === 0) return;

    const updated = insertChordsIntoLyrics(lyrics, list);
    setLyrics(updated);
    setInsertedChordsFeedback(true);
    setTimeout(() => setInsertedChordsFeedback(false), 3000);
  };

  const handleTransposeStudioLyrics = (delta: number) => {
    const nextOffset = transposeOffset + delta;
    setTransposeOffset(nextOffset);
    const transposed = transposeLyrics(lyrics, delta, accidentalPreference);
    setLyrics(transposed);
    const transposedKey = transposeChord(key || 'Am', delta, accidentalPreference);
    setKey(transposedKey);
    setTransposeFeedback(`Tono transmutado a ${transposedKey} (${nextOffset > 0 ? `+${nextOffset}` : nextOffset} st)`);
    setTimeout(() => setTransposeFeedback(null), 3000);
  };

  const handleToggleAccidentals = () => {
    const nextPref: AccidentalPreference = accidentalPreference === 'sharps' ? 'flats' : 'sharps';
    setAccidentalPreference(nextPref);
    setLyrics(respellLyrics(lyrics, nextPref));
    setKey(respellChord(key || 'Am', nextPref));
  };

  const handleInsertSectionHeader = (headerName: string) => {
    const sectionText = `\n\n## ${headerName}\n`;
    setLyrics(prev => prev.trimEnd() + sectionText);
  };

  // Transcription Handlers
  const handleTranscriptionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setTranscriptionFile(selected);
    setTranscriptionError(null);
    setTranscriptionNotice(null);
  };

  const handleRunTranscription = async () => {
    if (!transcriptionFile) {
      setTranscriptionError('Selecciona primero un archivo de audio (.mp3, .wav, .m4a, .ogg) para transcribir.');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionNotice(null);
    setTranscriptionProgress('Iniciando procesamiento de audio...');

    try {
      let result: LyricsTranscriptionResult;

      if (transcriptionEngine === 'backend_gemini') {
        if (!backendConsent) {
          throw new Error('Debes autorizar el envío de audio para la transcripción inteligente.');
        }
        setTranscriptionProgress('Analizando voz cantada con Gemini AI...');
        result = await LyricsTranscriptionService.transcribeWithBackendFromFile(
          transcriptionFile,
          backendConsent
        );
      } else {
        setTranscriptionProgress('Ejecutando modelo Whisper local en el navegador...');
        result = await LyricsTranscriptionService.transcribeLocalFromFile(
          transcriptionFile,
          {
            allowWasmFallback,
            language: 'spanish'
          },
          (message, status) => {
            setTranscriptionProgress(`[${status}] ${message}`);
          }
        );
      }

      setLastTranscriptionResult(result);
      setTranscriptionNotice(`Transcripción completada con éxito (${result.lines.length} versos detectados).`);
    } catch (err: any) {
      setTranscriptionError(err.message || 'Error al procesar la transcripción.');
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
        artist: 'Autor'
      });
      setLrc(generatedLrc);
      setShowLrcEditor(true);
    }

    setInsertedChordsFeedback(true);
    setTimeout(() => setInsertedChordsFeedback(false), 3000);
  };

  const handleCombineTranscriptionWithDetectedChords = () => {
    if (!lastTranscriptionResult?.text) return;
    const chordsToUse = detectedChords.length > 0 ? detectedChords : ['Am', 'G', 'F', 'E7'];
    const merged = insertChordsIntoLyrics(lastTranscriptionResult.text, chordsToUse);
    setLyrics(merged);

    setInsertedChordsFeedback(true);
    setTimeout(() => setInsertedChordsFeedback(false), 3000);
  };

  // Cross-copying and cleaning between Lyrics with Chords and Synced LRC
  const handleCopyLyricsToLrc = () => {
    if (!lyrics.trim()) {
      setSyncFeedback('La letra con acordes está vacía.');
      setTimeout(() => setSyncFeedback(null), 3000);
      return;
    }
    const convertedLrc = copyLyricsToLrcFormat(lyrics, {
      existingLrc: lrc,
      title: title || 'Sin título',
      artist: 'Tony'
    });
    setLrc(convertedLrc);
    setShowLrcEditor(true);
    setSyncFeedback('Letra copiada a LRC limpiando todos los acordes (marcas de tiempo listas).');
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleCopyLrcToLyrics = () => {
    if (!lrc.trim()) {
      setSyncFeedback('El texto LRC sincronizado está vacío.');
      setTimeout(() => setSyncFeedback(null), 3000);
      return;
    }
    const cleanLyrics = copyLrcToLyricsFormat(lrc);
    if (!cleanLyrics.trim()) {
      setSyncFeedback('No se encontraron líneas de texto lírico en el contenido LRC.');
      setTimeout(() => setSyncFeedback(null), 3000);
      return;
    }

    if (lyrics.trim() && !window.confirm('¿Deseas reemplazar la letra con acordes actual por la letra de LRC (limpiando todas las marcas de tiempo)?')) {
      return;
    }

    setLyrics(cleanLyrics);
    setSyncFeedback('Letra importada desde LRC limpiando marcas de tiempo y metadatos.');
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleStripChordsFromLyrics = () => {
    if (!lyrics.trim()) return;
    const stripped = stripChordsFromText(lyrics);
    setLyrics(stripped);
    setSyncFeedback('Acordes eliminados de la letra.');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const handleStripTimestampsFromLrc = () => {
    if (!lrc.trim()) return;
    const stripped = stripLrcTimestamps(lrc);
    setLrc(stripped);
    setSyncFeedback('Marcas de tiempo eliminadas del texto LRC.');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Audio & Google Drive Handlers
  const handleAudioFileChosen = async (file: File) => {
    setActiveAudioFile(file);

    // Auto-create local object URL for immediate browser playback / waveforms
    const localUrl = URL.createObjectURL(file);
    setAudioUrl(localUrl);

    // If connected to Google Drive, upload automatically so user never has to upload twice
    if (isGoogleDriveConnected) {
      setIsUploadingToDrive(true);
      setDriveFeedback({
        type: 'info',
        message: `Guardando "${file.name}" en tu Google Drive de forma segura...`
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
          message: `Maqueta almacenada con éxito en Google Drive (${uploaded.name}). ¡Análisis acústico activado!`
        });
      } catch (err: any) {
        console.error('Error subiendo a Google Drive:', err);
        setDriveFeedback({
          type: 'error',
          message: `Error al subir a Google Drive: ${err.message || 'Comprueba tu conexión o permisos.'}`
        });
      } finally {
        setIsUploadingToDrive(false);
      }
    } else {
      setDriveFeedback({
        type: 'info',
        message: `Audio cargado en memoria para análisis. Conecta tu cuenta de Google Drive para guardarlo sin consumir espacio en GitHub.`
      });
    }
  };

  const handleReanalyzeFromDrive = async () => {
    if (!driveFileId) return;

    setIsReanalyzingDrive(true);
    setDriveFeedback({
      type: 'info',
      message: 'Descargando maqueta directamente desde tu Google Drive...'
    });

    try {
      const blob = await GoogleDriveService.downloadFileBlob(driveFileId);
      const fileName = driveFileName || 'maqueta.mp3';
      const file = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });

      setActiveAudioFile(file);
      const localUrl = URL.createObjectURL(blob);
      setAudioUrl(localUrl);

      // Open analyzer sub-tab automatically
      setShowAudioStudio(true);
      setActiveStudioTab('analyzer');

      setDriveFeedback({
        type: 'success',
        message: 'Maqueta descargada desde Google Drive. Ejecutando análisis automático...'
      });
    } catch (err: any) {
      console.error('Error downloading from Drive:', err);
      setDriveFeedback({
        type: 'error',
        message: `Error al descargar desde Google Drive: ${err.message}`
      });
    } finally {
      setIsReanalyzingDrive(false);
    }
  };

  const handleDeleteDriveMaqueta = async () => {
    if (!driveFileId) return;

    const confirmed = window.confirm(
      `¿Deseas eliminar definitivamente el archivo "${driveFileName || 'esta maqueta'}" de tu Google Drive?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setIsUploadingToDrive(true);
    try {
      await GoogleDriveService.deleteFile(driveFileId);
      setDriveFileId('');
      setDriveFileName('');
      setActiveAudioFile(null);
      if (audioUrl.includes('drive.google.com') || audioUrl.startsWith('blob:')) {
        setAudioUrl('');
      }
      setDriveFeedback({
        type: 'success',
        message: 'La maqueta ha sido eliminada de tu Google Drive.'
      });
    } catch (err: any) {
      console.error('Error deleting from Drive:', err);
      setDriveFeedback({
        type: 'error',
        message: `Error al eliminar de Google Drive: ${err.message}`
      });
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setPushError(null);

    let songToSave: Song;

    if (mode === 'raw_markdown') {
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

    // Git Push to GitHub if configured
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

  const cleanChordList = getCleanChordSequence(detectedChords);

  return (
    <div className="max-w-[1240px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Header / Navigation Actions */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => (song ? navigate({ name: 'song-detail', songId: song.id }) : goBack({ name: 'catalog' }))}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Form vs Raw Markdown mode toggle */}
          <div className="flex items-center bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                if (mode === 'raw_markdown') {
                  try {
                    const parsed = markdownToSong(rawMarkdown, id);
                    setTitle(parsed.title);
                    setLyrics(parsed.lyrics);
                    setStatus(parsed.status);
                  } catch {}
                }
                setMode('form');
              }}
              className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer ${
                mode === 'form' ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold' : 'text-[var(--text-secondary)]'
              }`}
            >
              Formulario
            </button>
            <button
              type="button"
              onClick={() => {
                setRawMarkdown(songToMarkdown({
                  id: id || 'nueva-cancion',
                  title: title || 'Sin título',
                  status,
                  albumId: selectedAlbumId || undefined,
                  year: year || new Date().getFullYear(),
                  genre,
                  key,
                  tempo: tempo ? parseInt(tempo, 10) : undefined,
                  lyrics,
                  notes,
                  tags,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }));
                setMode('raw_markdown');
              }}
              className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer ${
                mode === 'raw_markdown' ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold' : 'text-[var(--text-secondary)]'
              }`}
            >
              Markdown Crudo
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPushing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isPushing ? 'Guardando...' : 'Guardar Canción'}</span>
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{song ? 'Taller de Autor' : 'Nueva Creación'}</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            {song ? `Editar: ${song.title}` : 'Nueva Canción'}
          </h1>
        </div>

        {/* Quick Shortcut Button to Audio Studio */}
        <button
          type="button"
          onClick={() => setShowAudioStudio(prev => !prev)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs ${
            showAudioStudio
              ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          <span>{showAudioStudio ? 'Ocultar Analizador & Transcriptor' : 'Abrir Analizador & Transcriptor de Audio'}</span>
          {showAudioStudio ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {validationError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {audioAnalysisNotice && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{audioAnalysisNotice}</span>
        </div>
      )}

      {mode === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* AUDIO STUDIO: ANALYZER & TRANSCRIPTION (Interactive Workspace) */}
          {showAudioStudio && (
            <div className="bg-[var(--bg-surface)] border-2 border-[var(--accent-border)] rounded-2xl p-5 sm:p-6 shadow-md space-y-5 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center font-bold">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <span>Estudio Acústico: Analizador y Transcripción</span>
                      {cleanChordList.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                          {cleanChordList.length} acordes detectados
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Analiza archivos de audio para detectar BPM, tonalidad, compás y transcribe la voz cantada a letra y acordes.
                    </p>
                  </div>
                </div>

                {/* Tab switchers: Analizador vs Transcriptor */}
                <div className="flex items-center bg-[var(--bg-surface-subtle)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab('analyzer')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeStudioTab === 'analyzer'
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Detección Musical DSP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab('transcription')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeStudioTab === 'transcription'
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Transcripción de Voz (Letra)</span>
                  </button>
                </div>
              </div>

              {/* Sub-tab 1: Audio Analyzer Section */}
              {activeStudioTab === 'analyzer' && (
                <div className="space-y-4">
                  {driveFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center justify-between gap-3 ${
                        driveFeedback.type === 'success'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : driveFeedback.type === 'error'
                          ? 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300'
                          : 'bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--accent-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {driveFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
                        {driveFeedback.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />}
                        {driveFeedback.type === 'info' && <Cloud className="w-4 h-4 shrink-0 text-[var(--accent-primary)]" />}
                        <span className="font-medium">{driveFeedback.message}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDriveFeedback(null)}
                        className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <AudioAnalyzerSection
                    onApplyDetection={handleApplyAudioDetection}
                    onInsertChordsIntoLyrics={handleInsertDetectedChords}
                    currentKey={key}
                    currentTempo={tempo}
                    currentAudioUrl={audioUrl}
                    driveFileId={driveFileId}
                    driveFileName={driveFileName}
                    onAudioFileSelected={handleAudioFileChosen}
                    onReanalyzeDriveAudio={handleReanalyzeFromDrive}
                    isDriveLoading={isUploadingToDrive || isReanalyzingDrive}
                    externalAudioFile={activeAudioFile}
                  />

                  {cleanChordList.length > 0 && (
                    <div className="p-4 rounded-xl bg-[var(--accent-subtle)]/40 border border-[var(--accent-border)] flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-wider block">
                          Progresión de Acordes Detectada
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-[var(--text-primary)] font-bold">
                          {cleanChordList.slice(0, 12).map((c, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                              [{c}]
                            </span>
                          ))}
                          {cleanChordList.length > 12 && (
                            <span className="text-xs text-[var(--text-muted)]">
                              +{cleanChordList.length - 12} más
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInsertDetectedChords()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs"
                      >
                        <Music className="w-3.5 h-3.5" />
                        <span>Insertar en la Letra Ahora</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Lyrics Voice-to-Text Transcription */}
              {activeStudioTab === 'transcription' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Audio File Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-primary)] block">
                        Archivo de audio a transcribir
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={transcriptionFileInputRef}
                          onChange={handleTranscriptionFileSelect}
                          accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => transcriptionFileInputRef.current?.click()}
                          className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--text-primary)] text-left flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">
                            {transcriptionFile ? transcriptionFile.name : 'Seleccionar audio (.mp3, .wav, .m4a)...'}
                          </span>
                          <FileAudio className="w-4 h-4 text-[var(--accent-primary)] shrink-0 ml-2" />
                        </button>
                        {transcriptionFile && (
                          <button
                            type="button"
                            onClick={() => setTranscriptionFile(null)}
                            className="px-2 py-2 text-xs text-[var(--text-muted)] hover:text-rose-500 cursor-pointer"
                            title="Quitar archivo"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {transcriptionFile && (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {(transcriptionFile.size / (1024 * 1024)).toFixed(2)} MB · {transcriptionFile.type || 'audio'}
                        </p>
                      )}
                    </div>

                    {/* Engine selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-primary)] block">
                        Motor de Transcripción
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTranscriptionEngine('backend_gemini')}
                          className={`p-2.5 text-xs text-left rounded-lg border transition-colors cursor-pointer ${
                            transcriptionEngine === 'backend_gemini'
                              ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                              : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1 mb-0.5">
                            <Sparkles className="w-3 h-3" />
                            <span>Gemini AI (Recomendado)</span>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                            Rápido, alta fidelidad para canciones en español con guitarra o piano.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTranscriptionEngine('local_whisper')}
                          className={`p-2.5 text-xs text-left rounded-lg border transition-colors cursor-pointer ${
                            transcriptionEngine === 'local_whisper'
                              ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                              : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1 mb-0.5">
                            <Radio className="w-3 h-3" />
                            <span>Whisper Local</span>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                            Ejecutado localmente en el navegador (WebGPU / WASM).
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>

                  {transcriptionEngine === 'backend_gemini' && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={backendConsent}
                        onChange={(e) => setBackendConsent(e.target.checked)}
                        className="rounded accent-[var(--accent-primary)]"
                      />
                      <span>Autorizo enviar fragmentos del audio para transcribir la letra con Gemini AI</span>
                    </label>
                  )}

                  {transcriptionProgress && (
                    <div className="p-3 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-xs flex items-center gap-2 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-ping" />
                      <span>{transcriptionProgress}</span>
                    </div>
                  )}

                  {transcriptionNotice && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{transcriptionNotice}</span>
                    </div>
                  )}

                  {transcriptionError && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{transcriptionError}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRunTranscription}
                      disabled={isTranscribing || !transcriptionFile}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isTranscribing ? 'Transcribiendo...' : 'Iniciar Transcripción de Voz'}</span>
                    </button>
                  </div>

                  {/* Transcription Output Actions */}
                  {lastTranscriptionResult && (
                    <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">
                          Resultado de la Transcripción ({lastTranscriptionResult.lines.length} versos)
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          Motor: {lastTranscriptionResult.engine}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {lastTranscriptionResult.text}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleApplyTranscribedLyrics(true)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs"
                        >
                          Reemplazar letra actual
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTranscribedLyrics(false)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                          Añadir al final de la letra
                        </button>
                        <button
                          type="button"
                          onClick={handleCombineTranscriptionWithDetectedChords}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Intercala los acordes detectados [Am] con las líneas transcritas"
                        >
                          <Music className="w-3 h-3" />
                          <span>Combinar con acordes detectados</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Metadata Block */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
            <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Metadatos y Clasificación</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  Título de la Canción <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ej. Agua que no se puede evitar"
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)]"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Estado
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SongStatus)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                >
                  <option value="published">Publicada (Visible para todos)</option>
                  <option value="draft">Borrador (Solo autor)</option>
                  <option value="private">Inédita / Privada (Solo autor)</option>
                </select>
              </div>

              {/* Album Selection (Agrupación) */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Álbum al que pertenece</span>
                </label>
                <select
                  value={selectedAlbumId}
                  onChange={(e) => setSelectedAlbumId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                >
                  <option value="">-- Sin álbum asignado (Sencillo) --</option>
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
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    N° de Pista en el Álbum
                  </label>
                  <input
                    type="number"
                    value={trackNumber}
                    onChange={(e) => setTrackNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="1, 2, 3..."
                    min="1"
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>
              )}

              {/* Year */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Año de Composición
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              {/* Key */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Tonalidad Principal
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Am, G, Dm..."
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              {/* Tempo */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Tempo (BPM)
                </label>
                <input
                  type="number"
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value)}
                  placeholder="96"
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              {/* Time Signature */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Compás
                </label>
                <input
                  type="text"
                  value={timeSignature}
                  onChange={(e) => setTimeSignature(e.target.value)}
                  placeholder="4/4, 3/4, 6/8..."
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Duración
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="3:45"
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              {/* Tuning */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Afinación
                </label>
                <input
                  type="text"
                  value={tuning}
                  onChange={(e) => setTuning(e.target.value)}
                  placeholder="Estándar (EADGBE)"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>

              {/* Genre */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Género
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Canción de Autor, Bolero, Acústico..."
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
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
                      onClick={() => handleRemoveTag(tag)}
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
                      handleAddTag();
                    }
                  }}
                  placeholder="Añadir etiqueta (ej. guitarra, acústico)..."
                  className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none flex-1 max-w-xs"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-medium)] cursor-pointer"
                >
                  Añadir
                </button>
              </div>
            </div>
          </div>

          {/* External Links and Audio URL */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
            <div>
              <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Maqueta de Audio (Google Drive) y Enlaces de Reproducción</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Las maquetas de audio se almacenan de forma segura en tu Google Drive sin ocupar espacio en GitHub Pages ni exponerse públicamente si las marcas como privadas.
              </p>
            </div>

            {/* Google Drive Maqueta Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      Almacenamiento en Google Drive
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {isGoogleDriveConnected
                        ? `Conectado como ${googleUser?.email || 'Autor'}`
                        : 'No conectado a Google Drive'}
                    </span>
                  </div>
                </div>

                {!isGoogleDriveConnected ? (
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Conectar Google Drive</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Google Drive Activo</span>
                  </span>
                )}
              </div>

              {/* Maqueta details & controls */}
              {driveFileId ? (
                <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileAudio className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate font-mono">
                          {driveFileName || 'Maqueta alojada en Drive'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] block mt-0.5">
                        ID: {driveFileId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleReanalyzeFromDrive}
                        disabled={isReanalyzingDrive || isUploadingToDrive}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer disabled:opacity-50"
                        title="Descargar la maqueta directamente de Google Drive y ejecutar el análisis sin volver a subirla"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isReanalyzingDrive ? 'animate-spin' : ''}`} />
                        <span>{isReanalyzingDrive ? 'Descargando...' : 'Volver a Analizar'}</span>
                      </button>

                      <a
                        href={`https://drive.google.com/file/d/${driveFileId}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                        title="Ver archivo en Google Drive"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={handleDeleteDriveMaqueta}
                        disabled={isUploadingToDrive}
                        className="p-1.5 text-xs text-red-500 hover:text-red-700 rounded-lg hover:bg-red-500/10 cursor-pointer"
                        title="Eliminar maqueta de Google Drive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Privacy Toggle */}
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isPrivateDemo ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Maqueta Privada (solo audible por el autor)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Maqueta Pública (audible para cualquier visitante)</span>
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPrivateDemo}
                        onChange={(e) => setIsPrivateDemo(e.target.checked)}
                        className="rounded accent-[var(--accent-primary)] cursor-pointer"
                      />
                      <span>Ocultar reproducción a visitantes</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={maquetaFileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAudioFileChosen(file);
                    }}
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => maquetaFileInputRef.current?.click()}
                      disabled={isUploadingToDrive}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <UploadCloud className={`w-4 h-4 ${isUploadingToDrive ? 'animate-bounce' : ''}`} />
                      <span>{isUploadingToDrive ? 'Subiendo a Google Drive...' : 'Subir Maqueta a Google Drive (.mp3, .wav)'}</span>
                    </button>

                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPrivateDemo}
                        onChange={(e) => setIsPrivateDemo(e.target.checked)}
                        className="rounded accent-[var(--accent-primary)] cursor-pointer"
                      />
                      <span>Privada (solo visible/audible para ti como autor)</span>
                    </label>
                  </div>

                  <p className="text-[11px] text-[var(--text-muted)]">
                    Al seleccionar un archivo de maqueta, se almacenará en tu Google Drive y se analizará automáticamente su tempo, tono y acordes sin necesidad de volver a subirlo.
                  </p>
                </div>
              )}
            </div>

            {/* Standard URLs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                  <span>URL de Audio Directo / Enlace Externo (Opcional)</span>
                  {audioUrl && (
                    <span className="text-[10px] font-mono text-[var(--accent-primary)] font-bold">
                      Audio asignado
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="blob:... o https://ejemplo.com/audio.mp3"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Enlace a Spotify
                </label>
                <input
                  type="url"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/track/..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Enlace a Apple Music
                </label>
                <input
                  type="url"
                  value={appleMusicUrl}
                  onChange={(e) => setAppleMusicUrl(e.target.value)}
                  placeholder="https://music.apple.com/..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Enlace a YouTube
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Enlace a SoundCloud
                </label>
                <input
                  type="url"
                  value={soundcloudUrl}
                  onChange={(e) => setSoundcloudUrl(e.target.value)}
                  placeholder="https://soundcloud.com/..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Lyrics and Chords Studio Editor */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Music className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Letra con Acordes Anotados</span>
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                {/* Copy to LRC button */}
                <button
                  type="button"
                  onClick={handleCopyLyricsToLrc}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer shadow-2xs"
                  title="Copiar texto a letra sincronizada (LRC) eliminando automáticamente todos los acordes entre corchetes"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Copiar a LRC (sin acordes)</span>
                </button>

                {/* Import from LRC if LRC exists */}
                {lrc.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyLrcToLyrics}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-colors cursor-pointer"
                    title="Importar letra desde LRC eliminando marcas de tiempo [mm:ss.xx] y metadatos"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>Traer desde LRC (sin tiempos)</span>
                  </button>
                )}

                {/* Transposition buttons */}
                <div className="flex items-center gap-1 ml-1 pl-2 border-l border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => handleTransposeStudioLyrics(-1)}
                    className="px-2 py-1 text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] cursor-pointer"
                    title="Bajar medio tono"
                  >
                    -1 Tono
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTransposeStudioLyrics(1)}
                    className="px-2 py-1 text-xs rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] cursor-pointer"
                    title="Subir medio tono"
                  >
                    +1 Tono
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleAccidentals}
                    className="px-2 py-1 text-xs font-mono rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] cursor-pointer"
                    title="Alternar ortografía de acordes (# / b)"
                  >
                    {accidentalPreference === 'sharps' ? '#' : 'b'}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Section Headers, Chord Cleaning, and Insert Chords Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] text-[var(--text-muted)] mr-1">Secciones:</span>
                {(['Intro', 'Estrofa 1', 'Estrofa 2', 'Estribillo', 'Puente', 'Solo', 'Outro'] as const).map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleInsertSectionHeader(sec)}
                    className="px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    + {sec}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleStripChordsFromLyrics}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  title="Eliminar todos los acordes entre corchetes [Am] de la letra actual"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Limpiar acordes</span>
                </button>

                {cleanChordList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleInsertDetectedChords()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Insertar acordes detectados ({cleanChordList.length})</span>
                  </button>
                )}
              </div>
            </div>

            {transposeFeedback && (
              <div className="p-2 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-xs font-medium">
                {transposeFeedback}
              </div>
            )}

            {insertedChordsFeedback && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                <Check className="w-3.5 h-3.5" />
                <span>Acordes o letra integrados correctamente en el editor</span>
              </div>
            )}

            {syncFeedback && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{syncFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncFeedback(null)}
                  className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <textarea
              rows={14}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Escribe la letra anotando los acordes entre corchetes, ej: [Am] Primer verso..."
              className="w-full px-4 py-3 font-mono text-xs sm:text-sm rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-y"
            />

            {/* Toggle LRC synchronized lyrics editor */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowLrcEditor(!showLrcEditor)}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{showLrcEditor ? 'Ocultar Letra Sincronizada (LRC)' : 'Ver / Editar Letra Sincronizada (LRC)'}</span>
                  {showLrcEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {!showLrcEditor && lyrics.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyLyricsToLrc}
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-primary)] hover:underline cursor-pointer font-medium"
                  >
                    <ArrowDown className="w-3 h-3" />
                    <span>Copiar a LRC sin acordes</span>
                  </button>
                )}
              </div>

              {showLrcEditor && (
                <div className="mt-3 space-y-3 p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] animate-fadeIn">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                      <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Marcas de tiempo LRC [mm:ss.xx] (Modo Atril y Karaoke)</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyLyricsToLrc}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                        title="Reemplazar LRC con la letra de arriba limpiando todos los acordes"
                      >
                        <ArrowDown className="w-3 h-3" />
                        <span>Sincronizar desde Letra (sin acordes)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyLrcToLyrics}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        title="Transferir este texto a la letra de arriba eliminando marcas de tiempo y metadatos"
                      >
                        <ArrowUp className="w-3 h-3" />
                        <span>Copiar a Letra con Acordes (sin tiempos)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleStripTimestampsFromLrc}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
                        title="Quitar marcas de tiempo [mm:ss.xx] y metadatos de este cuadro"
                      >
                        <Eraser className="w-3 h-3" />
                        <span>Limpiar tiempos</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={7}
                    value={lrc}
                    onChange={(e) => setLrc(e.target.value)}
                    placeholder="[00:12.30] Primer verso cantado..."
                    className="w-full px-3 py-2 font-mono text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] resize-y leading-relaxed"
                  />

                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    💡 <strong>Intercambio bidireccional</strong>: Puedes transferir contenido entre ambas secciones con un clic. Al copiar hacia LRC se limpian automáticamente los acordes manteniendo las marcas temporales, y al copiar hacia la letra con acordes se eliminan los tiempos y metadatos para que puedas trabajar en tu cifrado musical o arreglos.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-serif font-bold text-[var(--text-primary)]">
              Notas de Composición y Arreglos
            </h2>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Historia, anécdota, técnica de mano derecha..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)]"
            />
          </div>

          {/* Git Commit & Push Section */}
          {token && (
            <div className="p-4 rounded-xl bg-[var(--accent-subtle)]/30 border border-[var(--accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={pushToGitHub}
                  onChange={(e) => setPushToGitHub(e.target.checked)}
                  className="rounded text-[var(--accent-primary)] accent-[var(--accent-primary)]"
                />
                <span>Hacer push automático a GitHub tras guardar</span>
              </label>

              {pushToGitHub && (
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Mensaje de commit..."
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none flex-1 max-w-md"
                />
              )}
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => (song ? navigate({ name: 'song-detail', songId: song.id }) : goBack({ name: 'catalog' }))}
              className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-medium)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPushing}
              className="px-5 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isPushing ? 'Subiendo...' : 'Guardar Canción'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* Raw Markdown Editor */
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
              onClick={() => (song ? navigate({ name: 'song-detail', songId: song.id }) : goBack({ name: 'catalog' }))}
              className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              Guardar Markdown
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
