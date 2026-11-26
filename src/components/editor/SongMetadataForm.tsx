import React from 'react';
import { Disc, SlidersHorizontal } from 'lucide-react';
import { Album } from '../../types/album';

export const COMMON_TUNINGS = [
  'Estándar (EADGBE)',
  'Drop D (DADGBE)',
  'DADGAD',
  'Medio tono abajo (Eb Ab Db Gb Bb Eb)',
  'Open G (DGDGBD)',
  'Open D (DADF#AD)'
];

export interface SongMetadataFormProps {
  selectedAlbumId: string;
  onSelectedAlbumIdChange: (val: string) => void;
  albums: Album[];
  trackNumber: number | '';
  onTrackNumberChange: (val: number | '') => void;
  year: number;
  onYearChange: (val: number) => void;
  genre: string;
  onGenreChange: (val: string) => void;
  tuning: string;
  onTuningChange: (val: string) => void;
  duration: string;
  onDurationChange: (val: string) => void;
  spotifyUrl: string;
  onSpotifyUrlChange: (val: string) => void;
  youtubeUrl: string;
  onYoutubeUrlChange: (val: string) => void;
  soundcloudUrl: string;
  onSoundcloudUrlChange: (val: string) => void;
  appleMusicUrl: string;
  onAppleMusicUrlChange: (val: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  tagInput: string;
  onTagInputChange: (val: string) => void;
  notes: string;
  onNotesChange: (val: string) => void;
}

export const SongMetadataForm: React.FC<SongMetadataFormProps> = ({
  selectedAlbumId,
  onSelectedAlbumIdChange,
  albums,
  trackNumber,
  onTrackNumberChange,
  year,
  onYearChange,
  genre,
  onGenreChange,
  tuning,
  onTuningChange,
  duration,
  onDurationChange,
  spotifyUrl,
  onSpotifyUrlChange,
  youtubeUrl,
  onYoutubeUrlChange,
  soundcloudUrl,
  onSoundcloudUrlChange,
  appleMusicUrl,
  onAppleMusicUrlChange,
  tags,
  onTagsChange,
  tagInput,
  onTagInputChange,
  notes,
  onNotesChange
}) => {
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      onTagInputChange('');
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto max-w-5xl mx-auto w-full">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
          <SlidersHorizontal className="w-4 h-4 text-[var(--accent-primary)]" />
          <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
            Ficha Técnica & Configuración de Discografía
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1">
              <Disc className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Álbum de Estudio</span>
            </label>
            <select
              value={selectedAlbumId}
              onChange={(e) => onSelectedAlbumIdChange(e.target.value)}
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

          {selectedAlbumId && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Pista N° en el Álbum
              </label>
              <input
                type="number"
                value={trackNumber}
                onChange={(e) => onTrackNumberChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="1, 2, 3..."
                min="1"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Año de Composición
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => onYearChange(parseInt(e.target.value, 10) || new Date().getFullYear())}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Género / Estilo
            </label>
            <input
              type="text"
              value={genre}
              onChange={(e) => onGenreChange(e.target.value)}
              placeholder="Canción de Autor, Acústico..."
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Afinación del Instrumento
            </label>
            <select
              value={tuning}
              onChange={(e) => onTuningChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
            >
              {COMMON_TUNINGS.map((tun) => (
                <option key={tun} value={tun}>
                  {tun}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Duración (mm:ss)
            </label>
            <input
              type="text"
              value={duration}
              onChange={(e) => onDurationChange(e.target.value)}
              placeholder="03:45"
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
            />
          </div>
        </div>

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
                onChange={(e) => onSpotifyUrlChange(e.target.value)}
                placeholder="https://open.spotify.com/track/..."
                className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">YouTube URL</label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => onYoutubeUrlChange(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">SoundCloud URL</label>
              <input
                type="url"
                value={soundcloudUrl}
                onChange={(e) => onSoundcloudUrlChange(e.target.value)}
                placeholder="https://soundcloud.com/..."
                className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">Apple Music URL</label>
              <input
                type="url"
                value={appleMusicUrl}
                onChange={(e) => onAppleMusicUrlChange(e.target.value)}
                placeholder="https://music.apple.com/..."
                className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>

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
                  onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
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
              onChange={(e) => onTagInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Añadir etiqueta (ej. guitarra, memoria, viaje)..."
              className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none max-w-xs"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] cursor-pointer"
            >
              Añadir
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--text-primary)]">
            Diario de Composición / Historia de la Canción
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="El contexto en que nació la canción, afinación de guitarra o recuerdos..."
            className="w-full px-3 py-2 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] focus:outline-none text-[var(--text-primary)]"
          />
        </div>
      </div>
    </div>
  );
};
