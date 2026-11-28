import React from 'react';
import { Play, FileText, Edit3, Download, History, FileCode, Trash2, Youtube, ExternalLink } from 'lucide-react';
import { Song } from '../types/song';
import { isSafeExternalUrl } from '../utils/authConfig';
import { isValidPlayableAudioUrl } from '../utils/markdownParser';

interface SongCardProps {
  song: Song;
  onSelect: (song: Song) => void;
  onEdit: (song: Song) => void;
  onDownloadMd: (song: Song) => void;
  isAuthor: boolean;
  onViewHistory?: (song: Song) => void;
  onSelectTag?: (tag: string) => void;
  selectedTags?: string[];
  onRenameFile?: (song: Song) => void;
  onDelete?: (song: Song) => void;
  onOpenVisualizer?: (song: Song) => void;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  onSelect,
  onEdit,
  onDownloadMd,
  isAuthor,
  onViewHistory,
  onSelectTag,
  selectedTags = [],
  onRenameFile,
  onDelete,
  onOpenVisualizer
}) => {
  // Extract first 2-3 lines of lyrics for preview
  const lyricPreview = song.lyrics
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('##') && !line.startsWith('#'))
    .slice(0, 2)
    .map(line => line.replace(/\[[^\]]+\]/g, '').trim())
    .filter(Boolean)
    .join(' / ');

  const hasSpotify = isSafeExternalUrl(song.spotifyUrl);
  const hasYoutube = isSafeExternalUrl(song.youtubeUrl);
  const hasAppleMusic = isSafeExternalUrl(song.appleMusicUrl);
  const hasSoundcloud = isSafeExternalUrl(song.soundcloudUrl);
  const hasDirectAudio = isValidPlayableAudioUrl(song.audioUrl) && !song.audioUrl?.startsWith('gdrive://');
  const hasAuthorDriveAudio = isAuthor && Boolean(song.driveFileId || song.audioUrl?.startsWith('gdrive://'));
  const hasAudio = hasSpotify || hasYoutube || hasAppleMusic || hasSoundcloud || hasDirectAudio || hasAuthorDriveAudio;

  const getStatusText = () => {
    switch (song.status) {
      case 'published':
        return 'Publicada';
      case 'draft':
        return 'Borrador en desarrollo';
      case 'private':
        return 'Inédita / Privada';
    }
  };

  return (
    <article className="group relative flex flex-col justify-between p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface-elevated)] shadow-[var(--shadow-card)] transition-all duration-300">
      <div>
        {/* Unboxed Header Metadata with typographic separators (NO PILLS) */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mb-3 font-medium">
          <span className="text-[var(--accent-primary)] font-semibold">{getStatusText()}</span>
          <span aria-hidden="true">·</span>
          <span>{song.year}</span>
          <span aria-hidden="true">·</span>
          <span>{song.genre}</span>
          {song.key && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[var(--text-secondary)]">Tono {song.key}</span>
            </>
          )}
          {song.tempo && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{song.tempo} BPM</span>
            </>
          )}
        </div>

        {/* Primary Song Title */}
        <h3 
          onClick={() => onSelect(song)}
          className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors cursor-pointer text-balance mb-3"
        >
          {song.title}
        </h3>

        {/* Lyrics Preview Excerpt */}
        {lyricPreview && (
          <p className="text-sm font-serif italic text-[var(--text-secondary)] leading-relaxed mb-5 line-clamp-2 border-l border-[var(--accent-border)] pl-3">
            "{lyricPreview}"
          </p>
        )}

        {/* Available Streaming Platforms / Audio availability */}
        <div className="flex items-center gap-3 mb-4 text-xs text-[var(--text-muted)]">
          {hasAudio ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Disponible en:
              </span>
              {hasSpotify && (
                <a
                  href={song.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[#1DB954] hover:underline font-medium"
                  title="Escuchar en Spotify (abre pestaña nueva)"
                >
                  <span>Spotify</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              {hasYoutube && (
                <a
                  href={song.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[#e53e3e] hover:underline font-medium"
                  title="Ver en YouTube (abre pestaña nueva)"
                >
                  <span>YouTube</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              {hasAppleMusic && (
                <a
                  href={song.appleMusicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[#FA243C] hover:underline font-medium"
                  title="Escuchar en Apple Music (abre pestaña nueva)"
                >
                  <span>Apple Music</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              {hasSoundcloud && (
                <a
                  href={song.soundcloudUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[#FF5500] hover:underline font-medium"
                  title="Escuchar en SoundCloud (abre pestaña nueva)"
                >
                  <span>SoundCloud</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              {(hasDirectAudio || hasAuthorDriveAudio) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(song);
                  }}
                  className="text-[var(--accent-primary)] hover:underline cursor-pointer font-medium"
                  title="Abrir maqueta en el reproductor"
                >
                  Maqueta
                </button>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)] italic">
              Sin enlaces de audio externos · Letra y acordes disponibles
            </span>
          )}
        </div>

        {/* Thematic Tags (Clickable for quick catalog filtering) */}
        {song.tags && song.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {song.tags.map((tag) => {
              const isSelected = selectedTags.some(
                t => t.trim().toLowerCase() === tag.trim().toLowerCase()
              );
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTag?.(tag);
                  }}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]'
                  }`}
                  title={`${isSelected ? 'Quitar filtro' : 'Filtrar canciones por'} #${tag}`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)] mt-auto">
        <button
          onClick={() => onSelect(song)}
          className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors cursor-pointer"
        >
          {hasAudio ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Escuchar y ver letra</span>
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5" />
              <span>Leer letra y acordes</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
          {isAuthor && onOpenVisualizer && (
            <button
              onClick={() => onOpenVisualizer(song)}
              className="p-1.5 hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Generar vídeo para YouTube (1080p)"
            >
              <Youtube className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onDownloadMd(song)}
            className="p-1.5 hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
            title="Descargar archivo Markdown individual (.md)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          
          {/* Author exclusive actions: Version history and Edit */}
          {isAuthor && (
            <>
              {onViewHistory && (
                <button
                  onClick={() => onViewHistory(song)}
                  className="p-1.5 hover:text-[var(--accent-primary)] rounded-md hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                  title="Historial de versiones Git de este tema (Solo autor)"
                >
                  <History className="w-3.5 h-3.5" />
                </button>
              )}
              {onRenameFile && (
                <button
                  onClick={() => onRenameFile(song)}
                  className="p-1.5 hover:text-[var(--accent-primary)] rounded-md hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                  title="Renombrar archivo songs/[nombre].md (Solo autor)"
                >
                  <FileCode className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onEdit(song)}
                className="p-1.5 hover:text-[var(--accent-primary)] rounded-md hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                title="Editar canción / letra / enlaces (Solo autor)"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              {onDelete && (
                <button
                  onClick={() => onDelete(song)}
                  className="p-1.5 hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Eliminar canción del catálogo (Solo autor)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
};
