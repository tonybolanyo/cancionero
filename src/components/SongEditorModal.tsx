import React, { useState, useEffect } from 'react';
import { X, Save, FileEdit, Code2, AlertCircle, Plus, Tag } from 'lucide-react';
import { Song, SongStatus } from '../types/song';
import { songToMarkdown, markdownToSong } from '../utils/markdownParser';

interface SongEditorModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (song: Song) => void;
}

export const SongEditorModal: React.FC<SongEditorModalProps> = ({
  song,
  isOpen,
  onClose,
  onSave
}) => {
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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');

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
      setRawMarkdown(songToMarkdown(song));
    } else {
      const newId = `cancion-${Date.now()}`;
      setId(newId);
      setTitle('');
      setStatus('draft');
      setYear(new Date().getFullYear());
      setGenre('Canción de Autor');
      setKey('Am');
      setTempo('96');
      setTimeSignature('4/4');
      setTuning('Estándar (EADGBE)');
      setSpotifyUrl('');
      setYoutubeUrl('');
      setSoundcloudUrl('');
      setAudioUrl('');
      setNotes('');
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
      setParseError(null);
      setMode('form');
    } catch (e: any) {
      setParseError('No se pudo convertir el Markdown al formulario. Revisa la sintaxis del frontmatter YAML.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'raw_markdown') {
      try {
        const parsed = markdownToSong(rawMarkdown, id);
        onSave(parsed);
      } catch (err: any) {
        setParseError('Error de sintaxis en el archivo Markdown. Corrige el frontmatter antes de guardar.');
      }
      return;
    }

    if (!title.trim()) {
      alert('Por favor introduce un título para la canción');
      return;
    }

    const songSlug = id.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const updatedSong: Song = {
      id: songSlug,
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
      createdAt: song?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(updatedSong);
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
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Tonalidad
                  </label>
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Ej. Am, G, D, C#m"
                    className="w-full px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
                  />
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
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Compás métrico
                  </label>
                  <input
                    type="text"
                    value={timeSignature}
                    onChange={(e) => setTimeSignature(e.target.value)}
                    placeholder="Ej. 4/4, 3/4, 6/8"
                    className="w-full px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
                  />
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Letra de la canción (con acordes opcionales entre corchetes [Am]) *
                  </label>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    Formato: ## Estrofa 1, ## Estribillo, [Acorde]
                  </span>
                </div>
                <textarea
                  required
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  rows={12}
                  placeholder="## Estrofa 1&#10;[Am] Caminando por la calle...&#10;&#10;## Estribillo&#10;[C] Y en estas noches..."
                  className="w-full p-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] leading-relaxed resize-y shadow-sm"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Archivo destino: <strong className="text-[var(--text-primary)]">songs/{id || 'cancion'}.md</strong>
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Canción</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
