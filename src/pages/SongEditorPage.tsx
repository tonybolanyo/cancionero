import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  FileEdit,
  Code2,
  AlertCircle,
  Plus,
  Tag,
  Disc,
  UploadCloud,
  FileText,
  Wand2,
  Music,
  Check,
  Clock,
  Trash2
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
import { ChordSegment, insertChordsIntoLyrics, getCleanChordSequence } from '../lib/audio/chords';
import { parseLrc } from '../lib/lyrics/parseLrc';
import { SAMPLE_LRC_TEXT } from '../data/sampleLrc';
import { LrcSyncAssistant } from '../components/LrcSyncAssistant';
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
  const { token, user } = useAuth();
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
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [assistantCurrentTime, setAssistantCurrentTime] = useState<number>(0);
  const [assistantIsPlaying, setAssistantIsPlaying] = useState<boolean>(false);
  const assistantAudioRef = useRef<HTMLAudioElement | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [detectedChords, setDetectedChords] = useState<ChordSegment[]>([]);
  const [insertedChordsFeedback, setInsertedChordsFeedback] = useState<boolean>(false);
  const [transposeOffset, setTransposeOffset] = useState<number>(0);
  const [transposeFeedback, setTransposeFeedback] = useState<string | null>(null);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');

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
      setNotes(song.notes || '');
      setLyrics(song.lyrics);
      setLrc(song.lrc || '');
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
      setNotes('');
      setLyrics(`## Intro\n[Am]  [G]  [F]  [E7]\n\n## Estrofa 1\n[Am] Escribe aquí el primer verso de la canción...\n[G] Segundo verso con acordes anotados\n\n## Estribillo\n[C] Y aquí el estribillo que eleva la voz...\n[G] Con notas claras y verdades pequeñas.`);
      setLrc('');
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

  const handleApplyDetectedChords = () => {
    if (detectedChords.length === 0) return;
    const updated = insertChordsIntoLyrics(lyrics, detectedChords);
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

  return (
    <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Header / Actions */}
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

      <div className="mb-6">
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1">
          {song ? 'Taller de Autor' : 'Nueva Creación'}
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
          {song ? `Editar: ${song.title}` : 'Nueva Canción'}
        </h1>
      </div>

      {validationError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {mode === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-8">
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

          {/* External Links */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-serif font-bold text-[var(--text-primary)]">
              Enlaces y Archivo de Audio
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="flex items-center gap-2">
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
                >
                  {accidentalPreference === 'sharps' ? '#' : 'b'}
                </button>
              </div>
            </div>

            {transposeFeedback && (
              <div className="p-2 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-xs font-medium">
                {transposeFeedback}
              </div>
            )}

            <textarea
              rows={14}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Escribe la letra anotando los acordes entre corchetes, ej: [Am] Primer verso..."
              className="w-full px-4 py-3 font-mono text-xs sm:text-sm rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-y"
            />
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
