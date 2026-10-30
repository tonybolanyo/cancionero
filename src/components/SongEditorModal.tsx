import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  FileEdit,
  Code2,
  AlertCircle,
  Plus,
  Tag,
  GitCommit,
  UploadCloud,
  FileText,
  Wand2,
  Music,
  Check,
  Sparkles,
  Clock
} from 'lucide-react';
import { Song, SongStatus } from '../types/song';
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
import { AudioAnalyzerSection } from './AudioAnalyzerSection';
import { ChordSegment, insertChordsIntoLyrics, getCleanChordSequence } from '../lib/audio/chords';
import { parseLrc } from '../lib/lyrics/parseLrc';
import { SAMPLE_LRC_TEXT } from '../data/sampleLrc';

interface SongEditorModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (song: Song, pushResult?: PushResult) => void;
}

export const SongEditorModal: React.FC<SongEditorModalProps> = ({
  song,
  isOpen,
  onClose,
  onSave
}) => {
  const { token, user } = useAuth();
  const [mode, setMode] = useState<'form' | 'raw_markdown'>('form');

  // Form fields
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<SongStatus>('draft');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [genre, setGenre] = useState('');
  const [key, setKey] = useState('Am');
  const [tempo, setTempo] = useState<string>('');
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [tuning, setTuning] = useState('Estándar (EADGBE)');
  const [spotifyUrl, setSpotifyUrl] = useState('');
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
  const [transposeOffset, setTransposeOffset] = useState<number>(0);
  const [transposeFeedback, setTransposeFeedback] = useState<string | null>(null);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');

  // Git Commit and Push on Save options - Defaults to Auto-Commit enabled
  const [createCommitOnSave, setCreateCommitOnSave] = useState<boolean>(() =>
    GitHubSyncService.isAutoCommitEnabled()
  );
  const [commitMessageOnSave, setCommitMessageOnSave] = useState('');
  const [pushOnSave, setPushOnSave] = useState<boolean>(() =>
    GitHubSyncService.isAutoCommitEnabled()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  const commonTagSuggestions = [
    'acústico',
    'en vivo',
    'colaboración',
    'maqueta',
    'balada',
    'banda',
    'poesía',
    'guitarra',
    'inédita'
  ];

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().toLowerCase().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Raw Markdown mode
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (song) {
      setId(song.id);
      setTitle(song.title);
      setStatus(song.status);
      setYear(song.year);
      setGenre(song.genre);
      setKey(song.key);
      setTempo(song.tempo ? song.tempo.toString() : '');
      setTimeSignature(song.timeSignature || '4/4');
      setTuning(song.tuning || 'Estándar (EADGBE)');
      setSpotifyUrl(song.spotifyUrl || '');
      setYoutubeUrl(song.youtubeUrl || '');
      setSoundcloudUrl(song.soundcloudUrl || '');
      setAudioUrl(song.audioUrl || '');
      setNotes(song.notes || '');
      setTags(song.tags || []);
      setLyrics(song.lyrics);
      setLrc(song.lrc || '');
      setShowLrcEditor(Boolean(song.lrc));
      setRawMarkdown(songToMarkdown(song));
      setTransposeOffset(0);
      setTransposeFeedback(null);
    } else {
      const newId = `cancion-${Date.now()}`;
      setId(newId);
      setTitle('');
      setStatus('draft');
      setYear(new Date().getFullYear());
      setGenre('Canción de Autor');
      setKey('Am');
      setTransposeOffset(0);
      setTransposeFeedback(null);
      setTempo('96');
      setTimeSignature('4/4');
      setTuning('Estándar (EADGBE)');
      setSpotifyUrl('');
      setYoutubeUrl('');
      setSoundcloudUrl('');
      setAudioUrl('');
      setNotes('');
      setLrc('');
      setShowLrcEditor(false);
      setTags(['acústico']);
      setLyrics(`## Estrofa 1\n[Am] Escribe el primer verso aquí\n[G] Segundo verso con acordes\n\n## Estribillo\n[F] Y aquí va el estribillo...`);
      
      const draftSong: Song = {
        id: newId,
        title: '',
        status: 'draft',
        year: new Date().getFullYear(),
        genre: 'Canción de Autor',
        key: 'Am',
        tempo: 96,
        timeSignature: '4/4',
        tuning: 'Estándar (EADGBE)',
        tags: ['acústico'],
        lyrics: `## Estrofa 1\n[Am] Escribe el primer verso aquí\n[G] Segundo verso con acordes\n\n## Estribillo\n[F] Y aquí va el estribillo...`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setRawMarkdown(songToMarkdown(draftSong));
    }
  }, [song, isOpen]);

  if (!isOpen) return null;

  const handleSwitchToRaw = () => {
    const tempSong: Song = {
      id: id || `cancion-${Date.now()}`,
      title: title || 'Sin título',
      status,
      year: year || new Date().getFullYear(),
      genre: genre || 'Acústica',
      key: key || 'Am',
      tempo: tempo ? parseInt(tempo, 10) : undefined,
      timeSignature,
      tuning,
      spotifyUrl: spotifyUrl || undefined,
      youtubeUrl: youtubeUrl || undefined,
      soundcloudUrl: soundcloudUrl || undefined,
      audioUrl: audioUrl || undefined,
      notes: notes || undefined,
      tags: tags.length > 0 ? tags : undefined,
      lyrics,
      lrc: lrc || undefined,
      createdAt: song?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setRawMarkdown(songToMarkdown(tempSong));
    setMode('raw_markdown');
  };

  const handleSwitchToForm = () => {
    try {
      const parsed = markdownToSong(rawMarkdown, id);
      setId(parsed.id);
      setTitle(parsed.title);
      setStatus(parsed.status);
      setYear(parsed.year);
      setGenre(parsed.genre);
      setKey(parsed.key);
      setTempo(parsed.tempo ? parsed.tempo.toString() : '');
      setTimeSignature(parsed.timeSignature || '4/4');
      setTuning(parsed.tuning || 'Estándar (EADGBE)');
      setSpotifyUrl(parsed.spotifyUrl || '');
      setYoutubeUrl(parsed.youtubeUrl || '');
      setSoundcloudUrl(parsed.soundcloudUrl || '');
      setAudioUrl(parsed.audioUrl || '');
      setNotes(parsed.notes || '');
      setTags(parsed.tags || []);
      setLyrics(parsed.lyrics);
      setLrc(parsed.lrc || '');
      setShowLrcEditor(Boolean(parsed.lrc));
      setParseError(null);
      setMode('form');
    } catch (e: any) {
      setParseError('No se pudo convertir el Markdown al formulario. Revisa la sintaxis del frontmatter YAML.');
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
  }) => {
    if (data.tempo) setTempo(data.tempo.toString());
    if (data.key) setKey(data.key);
    if (data.timeSignature) setTimeSignature(data.timeSignature);
    if (data.tuning) setTuning(data.tuning);
    if (data.audioUrl) setAudioUrl(data.audioUrl);
    if (data.chordProgression && !notes) {
      const offsetNote = typeof data.tempoOffset === 'number' && data.tempoOffset > 0
        ? ` (offset 1er beat: ${data.tempoOffset.toFixed(3)}s)`
        : '';
      setNotes(`Progresión armónica detectada: ${data.chordProgression}${offsetNote}`);
    }
    if (data.chords && data.chords.length > 0) {
      setDetectedChords(data.chords);
    }
    if (data.suggestedLyricsChords && (!lyrics || lyrics.includes('Escribe el primer verso aquí'))) {
      setLyrics(data.suggestedLyricsChords);
    }
  };

  const handleInsertDetectedChords = (chordsOverride?: ChordSegment[]) => {
    const list = chordsOverride || detectedChords;
    if (!list || list.length === 0) return;

    const updated = insertChordsIntoLyrics(lyrics, list);
    setLyrics(updated);
    setInsertedChordsFeedback(true);
    setTimeout(() => setInsertedChordsFeedback(false), 2500);
  };

  const handleToggleAccidentalPreference = (newPref?: AccidentalPreference) => {
    const nextPref = newPref || (accidentalPreference === 'sharps' ? 'flats' : 'sharps');
    setAccidentalPreference(nextPref);

    if (lyrics) {
      setLyrics(prev => respellLyrics(prev, nextPref));
    }

    if (key.trim()) {
      setKey(prev => respellChord(prev, nextPref));
    }

    if (detectedChords.length > 0) {
      setDetectedChords(prev =>
        prev.map(c => ({
          ...c,
          chord: respellChord(c.chord, nextPref)
        }))
      );
    }

    setTransposeFeedback(`Notación ajustada a ${nextPref === 'flats' ? 'Bemoles (♭)' : 'Sostenidos (♯)'}`);
    setTimeout(() => setTransposeFeedback(null), 2500);
  };

  const handleTranspose = (semitones: number) => {
    if (semitones === 0) return;

    // 1. Transpose chords embedded in lyrics [Chord]
    if (lyrics) {
      setLyrics(prev => transposeLyrics(prev, semitones, accidentalPreference));
    }

    // 2. Transpose primary key field if filled
    let newKey = key;
    if (key.trim()) {
      newKey = transposeChord(key.trim(), semitones, accidentalPreference);
      setKey(newKey);
    }

    // 3. Transpose detected chords in memory to keep consistency
    if (detectedChords.length > 0) {
      setDetectedChords(prev =>
        prev.map(c => ({
          ...c,
          chord: transposeChord(c.chord, semitones, accidentalPreference)
        }))
      );
    }

    // 4. Update session offset and display feedback
    const newTotalOffset = transposeOffset + semitones;
    setTransposeOffset(newTotalOffset);

    const sign = semitones > 0 ? `+${semitones}` : `${semitones}`;
    const keyInfo = key ? ` (${key} → ${newKey})` : '';
    setTransposeFeedback(`Transpuesto ${sign} semitono${Math.abs(semitones) > 1 ? 's' : ''}${keyInfo}`);
    setTimeout(() => setTransposeFeedback(null), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetSong: Song;

    if (mode === 'raw_markdown') {
      try {
        targetSong = markdownToSong(rawMarkdown, id);
      } catch (err: any) {
        setParseError('Error de sintaxis en el archivo Markdown. Corrige el frontmatter antes de guardar.');
        return;
      }
    } else {
      if (!title.trim()) {
        alert('Por favor introduce un título para la canción');
        return;
      }

      const cleanSlug = id
        .trim()
        .toLowerCase()
        .replace(/\.md$/i, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      let finalId = cleanSlug;
      // If editing existing song and ID changed, perform file rename
      if (song && song.id !== cleanSlug) {
        const renameRes = StorageService.renameSongFile(song.id, cleanSlug, false);
        if (!renameRes.success) {
          setParseError(renameRes.error || 'Error al renombrar el archivo.');
          return;
        }
        finalId = cleanSlug;
      }

      targetSong = {
        id: finalId,
        title: title.trim(),
        status,
        year: Number(year) || new Date().getFullYear(),
        genre: genre.trim() || 'Canción de Autor',
        key: key.trim() || 'Am',
        tempo: tempo ? parseInt(tempo, 10) : undefined,
        timeSignature: timeSignature.trim() || '4/4',
        tuning: tuning.trim() || 'Estándar (EADGBE)',
        spotifyUrl: spotifyUrl.trim() || undefined,
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

    setIsSaving(true);
    setSaveStatusMessage('Guardando canción localmente...');

    try {
      let pushResult: PushResult | undefined;
      const defaultMsg = song
        ? `update: actualizar letra y acordes de "${targetSong.title}"`
        : `feat: nueva composición "${targetSong.title}" en tono ${targetSong.key}`;
      const finalMsg = commitMessageOnSave.trim() || defaultMsg;

      if (createCommitOnSave) {
        setSaveStatusMessage('Creando commit en Git local...');
        const authorStr = user ? `${user.name} <${user.email || 'tony@tonygb.com'}>` : 'Tony <tony@tonygb.com>';
        StorageService.createGitCommit(finalMsg, authorStr);

        if (pushOnSave) {
          setSaveStatusMessage('Haciendo Push a GitHub (tonygb/cancionero)...');
          pushResult = await GitHubSyncService.pushSongFile(targetSong, finalMsg, token);

          if (song && song.id !== targetSong.id) {
            await GitHubSyncService.deleteRemoteFile(
              `songs/${song.id}.md`,
              `chore(files): eliminar ruta anterior tras renombrar a 'songs/${targetSong.id}.md'`,
              token
            );
          }
        }
      }

      onSave(targetSong, pushResult);
    } catch (err: any) {
      console.warn('Error saving song / push', err);
      // Still save locally even if remote push had network failure
      onSave(targetSong);
    } finally {
      setIsSaving(false);
      setSaveStatusMessage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)] transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                {song ? `Editar: ${song.title}` : 'Crear Nueva Canción'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Se guardará como archivo Markdown local sincronizado con Git
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode switch */}
            <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg">
              <button
                type="button"
                onClick={mode === 'raw_markdown' ? handleSwitchToForm : undefined}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === 'form'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Formulario
              </button>
              <button
                type="button"
                onClick={mode === 'form' ? handleSwitchToRaw : undefined}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                  mode === 'raw_markdown'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Markdown Raw</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--bg-surface)]">
          {parseError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-500 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{parseError}</span>
            </div>
          )}

          {mode === 'raw_markdown' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
                <span>Edición directa del archivo Markdown con Frontmatter YAML:</span>
                <span className="text-[var(--accent-primary)] font-semibold">songs/{id || 'cancion'}.md</span>
              </div>
              <textarea
                value={rawMarkdown}
                onChange={(e) => setRawMarkdown(e.target.value)}
                rows={22}
                className="w-full p-4 rounded-xl bg-[var(--bg-code)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] leading-relaxed resize-y select-text"
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} id="song-editor-form" className="space-y-6">
              {/* Row 1: Title and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Título de la canción *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!song) {
                        setId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }
                    }}
                    placeholder="Ej. Noches de Cristal"
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Estado en el catálogo *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SongStatus)}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer shadow-sm"
                  >
                    <option value="published">Publicada (Con o sin audio)</option>
                    <option value="draft">Borrador / En desarrollo</option>
                    <option value="private">Privada / Inédita íntima</option>
                  </select>
                </div>
              </div>

              {/* File Name & Identifier Row */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Nombre de archivo Markdown (.md)</span>
                  </label>
                  {song && song.id !== id && (
                    <span className="text-[11px] text-[var(--accent-primary)] font-semibold flex items-center gap-1">
                      <span>Renombrar archivo desde: </span>
                      <code className="font-mono bg-[var(--bg-modal)] px-1.5 py-0.5 rounded border border-[var(--accent-border)]">{song.id}.md</code>
                    </span>
                  )}
                </div>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-[var(--bg-modal)] border border-r-0 border-[var(--border-subtle)] rounded-l-lg text-xs font-mono text-[var(--text-muted)] select-none">
                    songs/
                  </span>
                  <input
                    type="text"
                    required
                    value={id}
                    onChange={(e) => setId(e.target.value.toLowerCase().replace(/\.md$/i, '').replace(/[^a-z0-9_-]+/g, '-'))}
                    placeholder="ejemplo-mi-cancion"
                    className="flex-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                  <span className="px-3 py-2 bg-[var(--bg-modal)] border border-l-0 border-[var(--border-subtle)] rounded-r-lg text-xs font-mono text-[var(--text-muted)] select-none">
                    .md
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Ruta del archivo en el repositorio Git. Si lo modificas, se renombrará automáticamente al guardar.
                </p>
              </div>

              {/* Audio Upload & Detection Section (MP3 / WAV) */}
              <AudioAnalyzerSection
                onApplyDetection={handleApplyAudioDetection}
                onInsertChordsIntoLyrics={handleInsertDetectedChords}
                currentKey={key}
                currentTempo={tempo}
                currentAudioUrl={audioUrl}
              />

              {/* Row 2: Musical metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Año de composición
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Género / Estilo
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Ej. Indie Folk, Balada"
                    className="w-full px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--text-primary)] block">
                      Tonalidad
                    </label>
                    {transposeOffset !== 0 && (
                      <span className="text-[10px] font-mono text-[var(--accent-primary)] font-bold">
                        {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset} st
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="Ej. Am, G, D, C#m"
                      className="flex-1 min-w-0 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
                    />
                    <div className="flex items-center bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleTranspose(-1)}
                        className="px-1.5 py-1 text-[11px] font-mono font-semibold rounded hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                        title="Transponer -1 semitono a acordes y tonalidad"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTranspose(1)}
                        className="px-1.5 py-1 text-[11px] font-mono font-semibold rounded hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                        title="Transponer +1 semitono a acordes y tonalidad"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAccidentalPreference()}
                        className="px-1.5 py-1 text-[11px] font-mono font-bold rounded hover:bg-[var(--accent-subtle)] text-[var(--accent-primary)] transition-colors cursor-pointer border-l border-[var(--border-subtle)]"
                        title={`Alternar ortografía enarmónica: ${accidentalPreference === 'flats' ? 'Bemoles (♭)' : 'Sostenidos (♯)'}`}
                      >
                        {accidentalPreference === 'flats' ? '♭' : '♯'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Tempo (BPM)
                  </label>
                  <input
                    type="number"
                    value={tempo}
                    onChange={(e) => setTempo(e.target.value)}
                    placeholder="Ej. 96"
                    className="w-full px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
                  />
                </div>
              </div>

              {/* Row 3: Afinación y Compás */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Afinación de guitarra / instrumento
                  </label>
                  <input
                    type="text"
                    value={tuning}
                    onChange={(e) => setTuning(e.target.value)}
                    placeholder="Ej. Estándar (EADGBE), Drop D, Capo 3"
                    className="w-full px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--text-primary)] block">
                      Compás métrico
                    </label>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      {timeSignature === '3/4' ? 'Ternario (Vals)' : timeSignature === '6/8' ? 'Compuesto (Balada/Folk)' : timeSignature === '2/4' ? 'Binario (Marcha)' : 'Cuaternario (Pop/Rock)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={timeSignature}
                      onChange={(e) => setTimeSignature(e.target.value)}
                      placeholder="Ej. 4/4, 3/4, 6/8"
                      className="flex-1 px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
                    />
                    <div className="flex items-center bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg p-0.5 shadow-2xs">
                      {(['2/4', '3/4', '4/4', '6/8'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTimeSignature(m)}
                          className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                            timeSignature === m
                              ? 'bg-[var(--accent-primary)] text-white shadow-xs font-bold'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]'
                          }`}
                          title={`Seleccionar compás ${m}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row: Tags / Temáticas */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                    <Tag className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Etiquetas y Temáticas (ej. acústico, en vivo, colaboración)</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {tags.length} {tags.length === 1 ? 'etiqueta' : 'etiquetas'}
                  </span>
                </div>

                {/* Active tags chips with remove X */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-[var(--bg-surface)] text-[var(--accent-primary)] border border-[var(--accent-border)] rounded-md"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="p-0.5 hover:text-red-500 rounded cursor-pointer"
                        title={`Eliminar etiqueta #${t}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && (
                    <span className="text-xs text-[var(--text-muted)] italic">
                      Sin etiquetas asignadas. Añade una etiqueta abajo o selecciona sugerencias.
                    </span>
                  )}
                </div>

                {/* Input to add custom tag */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tagInput.trim()) handleAddTag(tagInput);
                        }
                      }}
                      placeholder="Nueva etiqueta (ej. en vivo, vals, nostálgico) y pulsa Enter"
                      className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (tagInput.trim()) handleAddTag(tagInput);
                    }}
                    disabled={!tagInput.trim()}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>

                {/* Quick suggestions */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mr-1">
                    Sugerencias:
                  </span>
                  {commonTagSuggestions.map((sug) => {
                    const isAdded = tags.includes(sug);
                    return (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => isAdded ? handleRemoveTag(sug) : handleAddTag(sug)}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          isAdded
                            ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-border)]'
                        }`}
                      >
                        {isAdded ? `✓ #${sug}` : `+ #${sug}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: External Streaming Links */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                  Enlaces de Audio y Plataformas (Opcional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-[#1DB954] block mb-1 font-medium">Spotify URL</label>
                    <input
                      type="url"
                      value={spotifyUrl}
                      onChange={(e) => setSpotifyUrl(e.target.value)}
                      placeholder="https://open.spotify.com/track/..."
                      className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#1DB954]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#e53e3e] block mb-1 font-medium">YouTube URL</label>
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#e53e3e]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#FF5500] block mb-1 font-medium">SoundCloud URL</label>
                    <input
                      type="url"
                      value={soundcloudUrl}
                      onChange={(e) => setSoundcloudUrl(e.target.value)}
                      placeholder="https://soundcloud.com/..."
                      className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF5500]"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)] block">
                  Notas de composición / Bitácora del autor
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Historia de la canción, arreglos, instrumentos previstos..."
                  className="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                />
              </div>

              {/* Row 6: Lyrics Editor */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-primary)] block">
                      Letra de la canción (con acordes opcionales entre corchetes [Am]) *
                    </label>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      Formato: ## Estrofa 1, ## Estribillo, [Acorde]
                    </span>
                  </div>

                  {/* Botones: Transponer acordes e Insertar acordes detectados */}
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Selector interactivo de Transposición [-1 Semitono] / [+1 Semitono] */}
                    <div className="flex items-center bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleTranspose(-1)}
                        className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                        title="Bajar 1 semitono a todos los acordes de la letra y a la tonalidad"
                      >
                        -1 Semitono
                      </button>

                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                          transposeOffset !== 0
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                        title={`Desfase acumulado de transposición: ${transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset} semitonos`}
                      >
                        {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset} st
                      </span>

                      <button
                        type="button"
                        onClick={() => handleTranspose(1)}
                        className="px-2.5 py-1 text-xs font-mono font-semibold rounded bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                        title="Subir 1 semitono a todos los acordes de la letra y a la tonalidad"
                      >
                        +1 Semitono
                      </button>
                    </div>

                    {/* Selector de Preferencia Enarmónica (♯ Sostenidos vs ♭ Bemoles) */}
                    <button
                      type="button"
                      onClick={() => handleToggleAccidentalPreference()}
                      className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer shadow-2xs"
                      title={`Preferencia enarmónica activa: ${accidentalPreference === 'flats' ? 'Bemoles (♭)' : 'Sostenidos (♯)'}. Pulsa para ajustar la ortografía de los acordes.`}
                    >
                      {accidentalPreference === 'flats' ? '♭ Bemoles' : '♯ Sostenidos'}
                    </button>

                    {/* Botón: Insertar acordes detectados automáticamente */}
                    <button
                      type="button"
                      onClick={() => handleInsertDetectedChords()}
                      disabled={detectedChords.length === 0}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                        insertedChordsFeedback
                          ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-1 ring-emerald-400'
                          : detectedChords.length > 0
                          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 ring-1 ring-purple-400'
                          : 'bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)] opacity-55 cursor-not-allowed'
                      }`}
                      title={
                        detectedChords.length > 0
                          ? `Insertar ${detectedChords.length} acordes detectados (${getCleanChordSequence(detectedChords).join(' - ')}) sobre la letra`
                          : 'Sube un audio en la sección de arriba para detectar los acordes de tu maqueta'
                      }
                    >
                      {insertedChordsFeedback ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>¡Acordes insertados en la letra!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {detectedChords.length > 0
                              ? `Insertar acordes detectados (${getCleanChordSequence(detectedChords).length})`
                              : 'Insertar acordes detectados automáticamente'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {transposeFeedback && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs text-[var(--accent-primary)] font-medium animate-fadeIn">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{transposeFeedback}</span>
                  </div>
                )}

                {detectedChords.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
                    <span className="text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1.5 text-[11px]">
                      <Music className="w-3 h-3 text-purple-500 shrink-0" />
                      <span>Secuencia detectada para asignar a los versos:</span>
                      <strong className="font-mono text-purple-600 dark:text-purple-200">
                        {getCleanChordSequence(detectedChords).join(' · ')}
                      </strong>
                    </span>
                    <span className="text-[10px] text-purple-600/80 font-mono hidden sm:inline">
                      {detectedChords.length} segmentos alineados con beats
                    </span>
                  </div>
                )}

                <textarea
                  required
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  rows={12}
                  placeholder="## Estrofa 1&#10;[Am] Caminando por la calle...&#10;&#10;## Estribillo&#10;[C] Y en estas noches..."
                  className="w-full p-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] leading-relaxed resize-y shadow-sm"
                />

                {/* Sub-section: Letra sincronizada LRC */}
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-2">
                    <button
                      type="button"
                      onClick={() => setShowLrcEditor(!showLrcEditor)}
                      className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {showLrcEditor
                          ? 'Ocultar editor de letra sincronizada (LRC)'
                          : lrc
                          ? 'Editar letra sincronizada (LRC) [Activa]'
                          : '+ Añadir letra sincronizada (LRC con marcas de tiempo)'}
                      </span>
                    </button>
                    {lrc && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {parseLrc(lrc).lines.length} líneas sincronizadas
                      </span>
                    )}
                  </div>

                  {showLrcEditor && (
                    <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2.5 animate-fadeIn">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Marcas de tiempo en formato <code>[mm:ss.xx] Letra</code> para teleprompter y karaoke:
                        </span>
                        <div className="flex items-center gap-2">
                          {!lrc && (
                            <button
                              type="button"
                              onClick={() => setLrc(SAMPLE_LRC_TEXT)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                            >
                              Cargar ejemplo LRC
                            </button>
                          )}
                          {lrc && (
                            <button
                              type="button"
                              onClick={() => setLrc('')}
                              className="px-2.5 py-1 text-[11px] font-medium rounded text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              Limpiar LRC
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        value={lrc}
                        onChange={(e) => setLrc(e.target.value)}
                        rows={7}
                        placeholder={`[ti:${title || 'Mi Canción'}]\n[ar:Tony]\n[00:04.20] [Am] Primer verso sincronizado\n[00:09.50] [Dm] Segundo verso`}
                        className="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] leading-relaxed resize-y shadow-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Git Commit & Push on Save Options */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={createCommitOnSave}
                    onChange={(e) => setCreateCommitOnSave(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent-primary)] border-[var(--border-subtle)] focus:ring-0"
                  />
                  <span className="flex items-center gap-1.5">
                    <GitCommit className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Registrar Git Commit automáticamente al guardar</span>
                  </span>
                </label>

                {createCommitOnSave && (
                  <div className="pl-6 space-y-2.5 pt-1 border-t border-[var(--border-subtle)]">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[var(--text-muted)] block">
                        Mensaje del commit (opcional, se autogenera si se deja vacío):
                      </label>
                      <input
                        type="text"
                        value={commitMessageOnSave}
                        onChange={(e) => setCommitMessageOnSave(e.target.value)}
                        placeholder={song ? `update: cambios en "${title || song.title}"` : `feat: nueva composición "${title || 'canción'}"`}
                        className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={pushOnSave}
                        onChange={(e) => setPushOnSave(e.target.checked)}
                        className="w-4 h-4 rounded text-[var(--accent-primary)] border-[var(--border-subtle)] focus:ring-0"
                      />
                      <span className="flex items-center gap-1.5 font-medium">
                        <UploadCloud className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>Hacer <strong>Push</strong> a GitHub inmediatamente tras el commit (git push)</span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex flex-col text-xs font-mono">
            <span className="text-[var(--text-muted)]">
              Archivo destino: <strong className="text-[var(--text-primary)]">songs/{id || 'cancion'}.md</strong>
            </span>
            {isSaving && saveStatusMessage && (
              <span className="text-[var(--accent-primary)] text-[11px] animate-pulse">
                {saveStatusMessage}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{createCommitOnSave && pushOnSave ? 'Guardar, Commit y Push 🚀' : 'Guardar Canción'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
