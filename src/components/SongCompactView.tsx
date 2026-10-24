import React, { useState, useMemo } from 'react';
import { Song } from '../types/song';
import { Play, FileText, Edit3, Download, History, ArrowUpDown, Disc, Music, ArrowUp, ArrowDown, FileCode } from 'lucide-react';

interface SongCompactViewProps {
  songs: Song[];
  onSelect: (song: Song) => void;
  onEdit: (song: Song) => void;
  onDownloadMd: (song: Song) => void;
  isAuthor: boolean;
  onViewHistory?: (song: Song) => void;
  onRenameFile?: (song: Song) => void;
}

type SortField = 'title' | 'year' | 'key' | 'tempo' | 'genre' | 'status';
type SortDirection = 'asc' | 'desc';

export const SongCompactView: React.FC<SongCompactViewProps> = ({
  songs,
  onSelect,
  onEdit,
  onDownloadMd,
  isAuthor,
  onViewHistory,
  onRenameFile,
}) => {
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
          break;
        case 'year':
          comparison = a.year - b.year;
          break;
        case 'key':
          comparison = (a.key || '').localeCompare(b.key || '');
          break;
        case 'tempo':
          comparison = (a.tempo || 0) - (b.tempo || 0);
          break;
        case 'genre':
          comparison = (a.genre || '').localeCompare(b.genre || '', 'es');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [songs, sortField, sortDirection]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[var(--accent-primary)]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[var(--accent-primary)]" />
    );
  };

  const getStatusDot = (status: Song['status']) => {
    switch (status) {
      case 'published':
        return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Publicada" />;
      case 'draft':
        return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Borrador" />;
      case 'private':
        return <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" title="Inédita / Privada" />;
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] font-mono uppercase tracking-wider text-[11px]">
              <th
                onClick={() => handleSort('status')}
                className="py-3 pl-4 pr-2 font-semibold cursor-pointer select-none group w-12 text-center"
                title="Ordenar por estado"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Est.</span>
                  {renderSortIcon('status')}
                </div>
              </th>

              <th
                onClick={() => handleSort('title')}
                className="py-3 px-3 font-semibold cursor-pointer select-none group"
                title="Ordenar por título"
              >
                <div className="flex items-center gap-1.5">
                  <span>Canción</span>
                  {renderSortIcon('title')}
                </div>
              </th>

              <th
                onClick={() => handleSort('key')}
                className="py-3 px-3 font-semibold cursor-pointer select-none group text-center w-24"
                title="Ordenar por tonalidad"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Tono</span>
                  {renderSortIcon('key')}
                </div>
              </th>

              <th
                onClick={() => handleSort('tempo')}
                className="py-3 px-3 font-semibold cursor-pointer select-none group text-center w-28 hidden sm:table-cell"
                title="Ordenar por tempo (BPM)"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Tempo</span>
                  {renderSortIcon('tempo')}
                </div>
              </th>

              <th
                onClick={() => handleSort('genre')}
                className="py-3 px-3 font-semibold cursor-pointer select-none group hidden md:table-cell"
                title="Ordenar por género"
              >
                <div className="flex items-center gap-1.5">
                  <span>Género</span>
                  {renderSortIcon('genre')}
                </div>
              </th>

              <th
                onClick={() => handleSort('year')}
                className="py-3 px-3 font-semibold cursor-pointer select-none group text-center w-20 hidden md:table-cell"
                title="Ordenar por año"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Año</span>
                  {renderSortIcon('year')}
                </div>
              </th>

              <th className="py-3 px-3 font-semibold text-center w-28 hidden lg:table-cell">
                Audio
              </th>

              <th className="py-3 pr-4 pl-3 font-semibold text-right w-36">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {sortedSongs.map((song) => {
              const hasAudio = !!(song.spotifyUrl || song.youtubeUrl || song.soundcloudUrl || song.audioUrl);
              return (
                <tr
                  key={song.id}
                  className="hover:bg-[var(--bg-surface-elevated)] transition-colors group"
                >
                  {/* Status Indicator */}
                  <td className="py-2.5 pl-4 pr-2 text-center align-middle">
                    <div className="flex justify-center items-center">
                      {getStatusDot(song.status)}
                    </div>
                  </td>

                  {/* Title & Tag Snippet */}
                  <td className="py-2.5 px-3 align-middle">
                    <div className="flex flex-col">
                      <button
                        onClick={() => onSelect(song)}
                        className="text-left font-serif font-bold text-sm sm:text-base text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer truncate max-w-xs sm:max-w-sm md:max-w-md"
                        title={song.title}
                      >
                        {song.title}
                      </button>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] sm:hidden mt-0.5">
                        <span>{song.genre}</span>
                        <span>·</span>
                        <span>{song.year}</span>
                        {song.tempo && <span>· {song.tempo} BPM</span>}
                      </div>
                    </div>
                  </td>

                  {/* Key */}
                  <td className="py-2.5 px-3 text-center align-middle">
                    {song.key ? (
                      <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-xs bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary)]">
                        {song.key}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)] font-mono">—</span>
                    )}
                  </td>

                  {/* Tempo / Meter */}
                  <td className="py-2.5 px-3 text-center align-middle hidden sm:table-cell">
                    {song.tempo ? (
                      <div className="font-mono tabular-nums text-xs font-medium text-[var(--text-secondary)]">
                        <span>{song.tempo} BPM</span>
                        {song.timeSignature && (
                          <span className="text-[10px] text-[var(--text-muted)] block">
                            {song.timeSignature}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)] font-mono">—</span>
                    )}
                  </td>

                  {/* Genre */}
                  <td className="py-2.5 px-3 align-middle hidden md:table-cell text-[var(--text-secondary)]">
                    {song.genre}
                  </td>

                  {/* Year */}
                  <td className="py-2.5 px-3 text-center align-middle hidden md:table-cell font-mono tabular-nums text-[var(--text-secondary)]">
                    {song.year}
                  </td>

                  {/* Audio badges */}
                  <td className="py-2.5 px-3 text-center align-middle hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      {song.spotifyUrl && (
                        <span className="text-[#1DB954]" title="Spotify disponible">
                          <Disc className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {song.youtubeUrl && (
                        <span className="text-[#e53e3e]" title="YouTube disponible">
                          <Play className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {song.audioUrl && (
                        <span className="text-[var(--accent-primary)]" title="Maqueta de audio">
                          <Music className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {!hasAudio && (
                        <span className="text-[var(--text-muted)] text-[10px] italic">
                          Acordes
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Quick Actions */}
                  <td className="py-2.5 pr-4 pl-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-1 text-[var(--text-muted)]">
                      <button
                        onClick={() => onSelect(song)}
                        className="px-2 py-1 rounded text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer flex items-center gap-1"
                        title="Ver letra y acordes"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ver</span>
                      </button>

                      <button
                        onClick={() => onDownloadMd(song)}
                        className="p-1 hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                        title="Descargar archivo .md"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {isAuthor && (
                        <>
                          {onViewHistory && (
                            <button
                              onClick={() => onViewHistory(song)}
                              className="p-1 hover:text-[var(--accent-primary)] rounded hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                              title="Historial de versiones Git"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onRenameFile && (
                            <button
                              onClick={() => onRenameFile(song)}
                              className="p-1 hover:text-[var(--accent-primary)] rounded hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                              title="Renombrar archivo songs/[nombre].md"
                            >
                              <FileCode className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onEdit(song)}
                            className="p-1 hover:text-[var(--accent-primary)] rounded hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                            title="Editar canción (Solo autor)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
