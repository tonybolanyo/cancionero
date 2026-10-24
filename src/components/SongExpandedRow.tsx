import React from 'react';
import { Play, FileText, Edit3, Download, History, Music2, Clock, Disc } from 'lucide-react';
import { Song } from '../types/song';

interface SongExpandedRowProps {
  song: Song;
  onSelect: (song: Song) => void;
  onEdit: (song: Song) => void;
  onDownloadMd: (song: Song) => void;
  isAuthor: boolean;
  onViewHistory?: (song: Song) => void;
  onSelectTag?: (tag: string) => void;
}

export const SongExpandedRow: React.FC<SongExpandedRowProps> = ({
  song,
  onSelect,
  onEdit,
  onDownloadMd,
  isAuthor,
  onViewHistory,
  onSelectTag,
}) => {
  // Extract up to 3 lines of lyrics for expanded preview
  const lyricLines = song.lyrics
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('##') && !line.startsWith('#'))
    .slice(0, 3)
    .map(line => line.replace(/\[[^\]]+\]/g, '').trim())
    .filter(Boolean);

  const hasAudio = !!(song.spotifyUrl || song.youtubeUrl || song.soundcloudUrl || song.audioUrl);

  const getStatusBadge = () => {
    switch (song.status) {
      case 'published':
        return {
          label: 'Publicada',
          className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        };
      case 'draft':
        return {
          label: 'Borrador en desarrollo',
          className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        };
      case 'private':
        return {
          label: 'Inédita / Privada',
          className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <article className="group p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface-elevated)] shadow-[var(--shadow-card)] transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      {/* Left/Middle Content block */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Metadatos superiores */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
          <span aria-hidden="true" className="text-[var(--border-subtle)]">·</span>
          <span>{song.year}</span>
          <span aria-hidden="true" className="text-[var(--border-subtle)]">·</span>
          <span className="text-[var(--text-secondary)]">{song.genre}</span>

          {song.key && (
            <>
              <span aria-hidden="true" className="text-[var(--border-subtle)]">·</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary)] font-semibold">
                Tono {song.key}
              </span>
            </>
          )}

          {song.tempo && (
            <>
              <span aria-hidden="true" className="text-[var(--border-subtle)]">·</span>
              <span className="flex items-center gap-1 font-mono tabular-nums text-xs">
                <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                {song.tempo} BPM
              </span>
            </>
          )}

          {song.timeSignature && (
            <span className="font-mono text-xs text-[var(--text-muted)]">
              ({song.timeSignature})
            </span>
          )}

          {song.tuning && song.tuning !== 'Standard EADGBE' && (
            <>
              <span aria-hidden="true" className="text-[var(--border-subtle)]">·</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Afinación: {song.tuning}
              </span>
            </>
          )}
        </div>

        {/* Título de la canción */}
        <div>
          <h3
            onClick={() => onSelect(song)}
            className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors cursor-pointer inline-block"
          >
            {song.title}
          </h3>
        </div>

        {/* Letra ampliada / Preview de estrofas */}
        {lyricLines.length > 0 && (
          <div className="border-l-2 border-[var(--accent-primary)]/40 pl-3.5 py-0.5 my-2">
            {lyricLines.map((line, idx) => (
              <p
                key={idx}
                className="text-sm font-serif italic text-[var(--text-secondary)] leading-relaxed"
              >
                "{line}"
              </p>
            ))}
          </div>
        )}

        {/* Notas del autor o contexto si existen */}
        {song.notes && (
          <p className="text-xs text-[var(--text-muted)] line-clamp-1 italic">
            <span className="font-semibold not-italic">Nota:</span> {song.notes}
          </p>
        )}

        {/* Plataformas de audio y etiquetas */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs">
          {/* Audio links */}
          <div className="flex items-center gap-2">
            <Music2 className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            {hasAudio ? (
              <div className="flex items-center gap-2">
                {song.spotifyUrl && (
                  <span className="text-[#1DB954] font-medium hover:underline cursor-pointer flex items-center gap-1" title="Disponible en Spotify">
                    <Disc className="w-3 h-3" /> Spotify
                  </span>
                )}
                {song.youtubeUrl && (
                  <span className="text-[#e53e3e] font-medium hover:underline cursor-pointer flex items-center gap-1" title="Disponible en YouTube">
                    <Play className="w-3 h-3" /> YouTube
                  </span>
                )}
                {song.soundcloudUrl && (
                  <span className="text-[#FF5500] font-medium hover:underline cursor-pointer" title="Disponible en SoundCloud">
                    SoundCloud
                  </span>
                )}
                {song.audioUrl && (
                  <span className="text-[var(--accent-primary)] font-medium" title="Audio demo directo">
                    Maqueta
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-[var(--text-muted)] italic">
                Letra con cifrado de acordes
              </span>
            )}
          </div>

          {/* Tags */}
          {song.tags && song.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {song.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTag?.(tag);
                  }}
                  className="text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                  title={`Filtrar por #${tag}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions Block */}
      <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] lg:pl-6 shrink-0">
        <button
          onClick={() => onSelect(song)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-sm"
        >
          {hasAudio ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Escuchar y ver letra</span>
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5" />
              <span>Ver acordes y letra</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <button
            onClick={() => onDownloadMd(song)}
            className="p-2 hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
            title="Descargar archivo Markdown (.md)"
          >
            <Download className="w-4 h-4" />
          </button>

          {isAuthor && (
            <>
              {onViewHistory && (
                <button
                  onClick={() => onViewHistory(song)}
                  className="p-2 hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  title="Historial de versiones Git"
                >
                  <History className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onEdit(song)}
                className="p-2 hover:text-[var(--accent-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                title="Editar canción (Solo autor)"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
};
