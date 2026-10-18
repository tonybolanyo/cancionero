import React from 'react';
import { Play, FileText, Edit3, Download, History } from 'lucide-react';
import { Song } from '../types/song';

interface SongCardProps {
  song: Song;
  onSelect: (song: Song) => void;
  onEdit: (song: Song) => void;
  onDownloadMd: (song: Song) => void;
  isAuthor: boolean;
  onViewHistory?: (song: Song) => void;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  onSelect,
  onEdit,
  onDownloadMd,
  isAuthor,
  onViewHistory
}) => {
  // Extract first 2-3 lines of lyrics for preview
  const lyricPreview = song.lyrics
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('##') && !line.startsWith('#'))
    .slice(0, 2)
    .map(line => line.replace(/\[[^\]]+\]/g, '').trim())
    .filter(Boolean)
    .join(' / ');

  const hasAudio = !!(song.spotifyUrl || song.youtubeUrl || song.soundcloudUrl || song.audioUrl);

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
        <div className="flex items-center gap-3 mb-6 text-xs text-[var(--text-muted)]">
          {hasAudio ? (
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Disponible en:
              </span>
              {song.spotifyUrl && (
                <span className="text-[#1DB954] hover:underline cursor-pointer font-medium" title="Disponible en Spotify">
                  Spotify
                </span>
              )}
              {song.youtubeUrl && (
                <span className="text-[#e53e3e] hover:underline cursor-pointer font-medium" title="Disponible en YouTube">
                  YouTube
                </span>
              )}
              {song.soundcloudUrl && (
                <span className="text-[#FF5500] hover:underline cursor-pointer font-medium" title="Disponible en SoundCloud">
                  SoundCloud
                </span>
              )}
              {song.audioUrl && (
                <span className="text-[var(--accent-primary)] font-medium" title="Audio demo">
                  Maqueta
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)] italic">
              Sin enlaces de audio externos · Letra y acordes disponibles
            </span>
          )}
        </div>
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
              <button
                onClick={() => onEdit(song)}
                className="p-1.5 hover:text-[var(--accent-primary)] rounded-md hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                title="Editar canción / letra / enlaces (Solo autor)"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
};
