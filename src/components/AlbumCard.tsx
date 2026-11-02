import React from 'react';
import { Disc, Music, ExternalLink, Calendar, User, Play, ChevronRight } from 'lucide-react';
import { Album } from '../types/album';

interface AlbumCardProps {
  album: Album;
  onSelect: (album: Album) => void;
  onEdit?: (album: Album) => void;
  isAuthor?: boolean;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({
  album,
  onSelect,
  onEdit,
  isAuthor
}) => {
  const trackCount = album.tracks?.length || 0;

  return (
    <article
      onClick={() => onSelect(album)}
      className="group relative bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md"
    >
      <div>
        {/* Album Artwork / Vinyl aesthetic container */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 flex items-center justify-center mb-4 border border-[var(--border-subtle)] group-hover:scale-[1.01] transition-transform duration-300">
          {album.coverImage ? (
            <img
              src={album.coverImage}
              alt={`Portada de ${album.title}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            /* Vinyl Disc Stylized Graphic */
            <div className="relative w-3/4 h-3/4 rounded-full bg-stone-900 border-4 border-stone-800 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500">
              {/* Concentric vinyl grooves */}
              <div className="absolute inset-2 rounded-full border border-stone-700/30" />
              <div className="absolute inset-5 rounded-full border border-stone-700/30" />
              <div className="absolute inset-8 rounded-full border border-stone-700/40" />
              {/* Center label */}
              <div className="w-14 h-14 rounded-full bg-[var(--accent-primary)] text-[var(--accent-text)] flex items-center justify-center text-xs font-serif font-bold shadow-md">
                <Disc className="w-6 h-6 animate-spin-slow opacity-90" />
              </div>
            </div>
          )}

          {/* Quick Play overlay icon */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <span className="px-3.5 py-1.5 rounded-full bg-white/90 text-stone-900 text-xs font-medium tracking-wide shadow-lg flex items-center gap-1.5">
              <span>Ver Álbum</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Unboxed Metadata (Zero-Pill Discipline) */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1.5">
          {album.year && (
            <>
              <span className="font-mono tabular-nums">{album.year}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{trackCount} {trackCount === 1 ? 'canción' : 'canciones'}</span>
          {album.artist && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[120px]">{album.artist}</span>
            </>
          )}
        </div>

        {/* Album Title */}
        <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors line-clamp-1 mb-2">
          {album.title}
        </h3>

        {/* Notes preview */}
        {album.notes && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed mb-4">
            {album.notes}
          </p>
        )}
      </div>

      {/* Footer / Platforms & Actions */}
      <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 mt-auto">
        {/* Streaming links indicators */}
        <div className="flex items-center gap-2 text-[var(--text-muted)]" onClick={(e) => e.stopPropagation()}>
          {album.spotifyUrl && (
            <a
              href={album.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:text-[#1DB954] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              title="Escuchar en Spotify"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </a>
          )}
          {album.appleMusicUrl && (
            <a
              href={album.appleMusicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:text-[#FA243C] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              title="Escuchar en Apple Music"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.62 1.35-.57.65-1.06 1.71-.93 2.73 1 .08 2.02-.48 2.63-1.23z" />
              </svg>
            </a>
          )}
          {album.youtubeUrl && (
            <a
              href={album.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:text-[#FF0000] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              title="Escuchar en YouTube"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          )}
          {album.soundcloudUrl && (
            <a
              href={album.soundcloudUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:text-[#FF5500] hover:bg-[var(--bg-surface-subtle)] transition-colors"
              title="Escuchar en SoundCloud"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M11.56 8.87V17h9.8c1.46 0 2.64-1.18 2.64-2.63 0-1.42-1.12-2.58-2.53-2.63-.3-.88-1.14-1.51-2.13-1.51-.31 0-.6.07-.86.19C17.9 8.21 15.89 6.5 13.5 6.5c-.7 0-1.37.15-1.94.41v1.96zM1.44 13.88C1.2 13.88 1 14.08 1 14.32v1.86c0 .24.2.44.44.44s.44-.2.44-.44v-1.86c0-.24-.2-.44-.44-.44zm1.75-1.22c-.24 0-.44.2-.44.44v3.08c0 .24.2.44.44.44s.44-.2.44-.44V13.1c0-.24-.2-.44-.44-.44zm1.75-1.32c-.24 0-.44.2-.44.44v4.4c0 .24.2.44.44.44s.44-.2.44-.44v-4.4c0-.24-.2-.44-.44-.44zm1.75.14c-.24 0-.44.2-.44.44v4.26c0 .24.2.44.44.44s.44-.2.44-.44v-4.26c0-.24-.2-.44-.44-.44zm1.75-.84c-.24 0-.44.2-.44.44v5.1c0 .24.2.44.44.44s.44-.2.44-.44v-5.1c0-.24-.2-.44-.44-.44zm1.75-1.05c-.24 0-.44.2-.44.44v6.15c0 .24.2.44.44.44s.44-.2.44-.44V10.03c0-.24-.2-.44-.44-.44z" />
              </svg>
            </a>
          )}
        </div>

        {/* Action indicator */}
        <span className="text-xs font-medium text-[var(--accent-primary)] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
          <span>Abrir álbum</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </article>
  );
};
