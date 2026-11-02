import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Disc,
  AlertCircle,
  Music,
  Clock,
  Link as LinkIcon
} from 'lucide-react';
import { Album, AlbumTrack } from '../types/album';
import { Song } from '../types/song';
import { useAppNavigation } from '../context/NavigationContext';

interface AlbumEditorPageProps {
  album: Album | null;
  songs: Song[];
  onSave: (album: Album) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const AlbumEditorPage: React.FC<AlbumEditorPageProps> = ({
  album,
  songs,
  onSave
}) => {
  const { navigate, goBack } = useAppNavigation();

  // Form states - ONLY title is mandatory
  const [title, setTitle] = useState(album?.title || '');
  const [artist, setArtist] = useState(album?.artist || 'Tony Bolaño');
  const [year, setYear] = useState<number | ''>(album?.year ?? new Date().getFullYear());
  const [coverImage, setCoverImage] = useState(album?.coverImage || '');
  const [spotifyUrl, setSpotifyUrl] = useState(album?.spotifyUrl || '');
  const [youtubeUrl, setYoutubeUrl] = useState(album?.youtubeUrl || '');
  const [appleMusicUrl, setAppleMusicUrl] = useState(album?.appleMusicUrl || '');
  const [soundcloudUrl, setSoundcloudUrl] = useState(album?.soundcloudUrl || '');
  const [notes, setNotes] = useState(album?.notes || '');
  const [tracks, setTracks] = useState<AlbumTrack[]>(album?.tracks || []);

  const [selectedCatalogSongId, setSelectedCatalogSongId] = useState<string>('');
  const [newCustomTitle, setNewCustomTitle] = useState('');
  const [newCustomDuration, setNewCustomDuration] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Add song from catalog
  const handleAddSongFromCatalog = () => {
    if (!selectedCatalogSongId) return;
    const catalogSong = songs.find(s => s.id === selectedCatalogSongId);
    if (!catalogSong) return;

    const newTrack: AlbumTrack = {
      id: `track-${Date.now()}`,
      songId: catalogSong.id,
      title: catalogSong.title,
      order: tracks.length + 1,
      duration: catalogSong.duration || ''
    };

    setTracks([...tracks, newTrack]);
    setSelectedCatalogSongId('');
  };

  // Add manual track
  const handleAddManualTrack = () => {
    if (!newCustomTitle.trim()) return;

    const newTrack: AlbumTrack = {
      id: `track-${Date.now()}`,
      title: newCustomTitle.trim(),
      order: tracks.length + 1,
      duration: newCustomDuration.trim() || undefined
    };

    setTracks([...tracks, newTrack]);
    setNewCustomTitle('');
    setNewCustomDuration('');
  };

  const handleRemoveTrack = (index: number) => {
    const updated = tracks.filter((_, i) => i !== index).map((t, i) => ({
      ...t,
      order: i + 1
    }));
    setTracks(updated);
  };

  const handleMoveTrack = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === tracks.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...tracks];
    const item = reordered.splice(index, 1)[0];
    reordered.splice(newIndex, 0, item);

    // Reassign order
    const updated = reordered.map((t, i) => ({
      ...t,
      order: i + 1
    }));
    setTracks(updated);
  };

  const handleTrackChange = (index: number, field: keyof AlbumTrack, value: any) => {
    const updated = [...tracks];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setTracks(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: Solo el título es obligatorio
    if (!title.trim()) {
      setError('El título del álbum es obligatorio.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const albumId = album?.id || slugify(title) || `album-${Date.now()}`;

    const savedAlbum: Album = {
      id: albumId,
      title: title.trim(),
      artist: artist.trim() || undefined,
      year: typeof year === 'number' && !isNaN(year) ? year : undefined,
      coverImage: coverImage.trim() || undefined,
      spotifyUrl: spotifyUrl.trim() || undefined,
      youtubeUrl: youtubeUrl.trim() || undefined,
      appleMusicUrl: appleMusicUrl.trim() || undefined,
      soundcloudUrl: soundcloudUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      tracks: tracks.map((t, idx) => ({
        ...t,
        order: idx + 1
      })),
      createdAt: album?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(savedAlbum);
    navigate({ name: 'album-detail', albumId });
  };

  return (
    <div className="max-w-[1000px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Header / Actions */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => (album ? navigate({ name: 'album-detail', albumId: album.id }) : goBack({ name: 'albums' }))}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver</span>
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-sm"
        >
          <Save className="w-4 h-4" />
          <span>Guardar Álbum</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1">
          {album ? 'Editar Información' : 'Crear Agrupación'}
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
          {album ? `Editar Álbum: ${album.title}` : 'Nuevo Álbum'}
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Completa los datos del disco. Recuerda que <strong className="text-[var(--text-primary)]">solo el título es obligatorio</strong>; los demás campos son opcionales.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Datos Principales */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
          <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Disc className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Información General</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Título (Obligatorio) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Título del Álbum <span className="text-rose-500">* (Obligatorio)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Cartas sin sello"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-[var(--text-primary)]"
              />
            </div>

            {/* Artista (Opcional) */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Artista del Álbum <span className="text-[var(--text-muted)] font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="ej. Tony Bolaño"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-[var(--text-primary)]"
              />
            </div>

            {/* Año de publicación (Opcional) */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Año de Publicación <span className="text-[var(--text-muted)] font-normal">(Opcional)</span>
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="ej. 2024"
                min="1900"
                max="2100"
                className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-[var(--text-primary)]"
              />
            </div>

            {/* Portada / Cover Image (Opcional) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                URL de Portada o Imagen <span className="text-[var(--text-muted)] font-normal">(Opcional)</span>
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://... o ruta de imagen"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Plataformas de Streaming (Spotify, YouTube, Apple Music, SoundCloud) */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Enlaces a Plataformas de Streaming (Opcionales)</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Añade enlaces directos a las plataformas donde esté publicado el álbum.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Spotify */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Enlace a Spotify
              </label>
              <input
                type="url"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                placeholder="https://open.spotify.com/album/..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[#1DB954] focus:outline-none transition-colors text-[var(--text-primary)]"
              />
            </div>

            {/* YouTube */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Enlace a YouTube
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[#FF0000] focus:outline-none transition-colors text-[var(--text-primary)]"
              />
            </div>

            {/* Apple Music */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Enlace a Apple Music
              </label>
              <input
                type="url"
                value={appleMusicUrl}
                onChange={(e) => setAppleMusicUrl(e.target.value)}
                placeholder="https://music.apple.com/..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[#FA243C] focus:outline-none transition-colors text-[var(--text-primary)]"
              />
            </div>

            {/* SoundCloud */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Enlace a SoundCloud
              </label>
              <input
                type="url"
                value={soundcloudUrl}
                onChange={(e) => setSoundcloudUrl(e.target.value)}
                placeholder="https://soundcloud.com/..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[#FF5500] focus:outline-none transition-colors text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Notas de Publicación (o acerca de) */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>Notas de Publicación (o acerca de)</span>
            <span className="text-xs font-normal text-[var(--text-muted)]">(Opcional)</span>
          </h2>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Historia del disco, contexto de grabación, instrumentación, dedicatoria o conceptos poéticos..."
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors text-[var(--text-primary)] leading-relaxed resize-y"
          />
        </div>

        {/* Listado de Canciones (con orden, duración y enlace a la ficha de la canción) */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Music className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Listado de Canciones del Álbum</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Organiza las canciones con su orden y duración. Se enlazarán automáticamente a la ficha de cada tema.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[var(--accent-primary)] font-semibold">
              {tracks.length} {tracks.length === 1 ? 'canción' : 'canciones'}
            </span>
          </div>

          {/* Add Track Controls */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
            <div className="text-xs font-semibold text-[var(--text-primary)]">Añadir Canción al Álbum:</div>
            
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2.5">
              {/* Option A: Select from existing catalog */}
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedCatalogSongId}
                  onChange={(e) => setSelectedCatalogSongId(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                >
                  <option value="">-- Seleccionar canción existente del catálogo --</option>
                  {songs
                    .filter(s => !tracks.some(t => t.songId === s.id))
                    .map(song => (
                      <option key={song.id} value={song.id}>
                        {song.title} {song.key ? `(${song.key})` : ''} {song.duration ? `· ${song.duration}` : ''}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddSongFromCatalog}
                  disabled={!selectedCatalogSongId}
                  className="px-3.5 py-2 text-xs font-medium text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  + Añadir del catálogo
                </button>
              </div>

              {/* Option B: Add custom track */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
                <input
                  type="text"
                  value={newCustomTitle}
                  onChange={(e) => setNewCustomTitle(e.target.value)}
                  placeholder="Título libre..."
                  className="px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
                <input
                  type="text"
                  value={newCustomDuration}
                  onChange={(e) => setNewCustomDuration(e.target.value)}
                  placeholder="3:45"
                  className="w-20 px-2 py-2 text-xs font-mono text-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddManualTrack}
                  disabled={!newCustomTitle.trim()}
                  className="px-3 py-2 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  + Libre
                </button>
              </div>
            </div>
          </div>

          {/* Ordered Tracklist Table */}
          {tracks.length > 0 ? (
            <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle)]">
              {tracks.map((track, idx) => {
                const song = track.songId ? songs.find(s => s.id === track.songId) : undefined;
                return (
                  <div
                    key={track.id || idx}
                    className="p-3 bg-[var(--bg-surface)] flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 group"
                  >
                    {/* Order & Reorder arrows */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-6 font-mono text-xs tabular-nums text-[var(--text-muted)] text-center font-bold">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => handleMoveTrack(idx, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 cursor-pointer"
                          title="Subir orden"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTrack(idx, 'down')}
                          disabled={idx === tracks.length - 1}
                          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 cursor-pointer"
                          title="Bajar orden"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Track Title input */}
                    <div className="flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={track.title}
                        onChange={(e) => handleTrackChange(idx, 'title', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-medium rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                      {song && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                          ✓ Vinculada a ficha: {song.id}.md
                        </span>
                      )}
                    </div>

                    {/* Duration input */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={track.duration || ''}
                        onChange={(e) => handleTrackChange(idx, 'duration', e.target.value)}
                        placeholder="0:00"
                        className="w-16 px-2 py-1.5 text-xs font-mono text-center rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>

                    {/* Delete track button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveTrack(idx)}
                      className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded transition-colors cursor-pointer shrink-0"
                      title="Quitar canción de este álbum"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-[var(--text-muted)] italic">
              Aún no has agregado canciones a este álbum. Selecciona canciones del catálogo o ingresa pistas arriba.
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => (album ? navigate({ name: 'album-detail', albumId: album.id }) : goBack({ name: 'albums' }))}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-medium)] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Álbum</span>
          </button>
        </div>
      </form>
    </div>
  );
};
