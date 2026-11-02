import React, { useState } from 'react';
import { Disc, Plus, Music, ArrowLeft, Search } from 'lucide-react';
import { Album } from '../types/album';
import { Song } from '../types/song';
import { AlbumCard } from '../components/AlbumCard';
import { useAppNavigation } from '../context/NavigationContext';
import { useAuth } from '../context/AuthContext';

interface AlbumsPageProps {
  albums: Album[];
  songs: Song[];
  onSelectAlbum: (album: Album) => void;
  onEditAlbum?: (album: Album) => void;
}

export const AlbumsPage: React.FC<AlbumsPageProps> = ({
  albums,
  songs,
  onSelectAlbum,
  onEditAlbum
}) => {
  const { navigate, goBack } = useAppNavigation();
  const { isAuthor } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlbums = albums.filter(album => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const titleMatch = album.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q);
    const artistMatch = album.artist?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q);
    const notesMatch = album.notes?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q);
    return titleMatch || artistMatch || notesMatch;
  });

  return (
    <div className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-12 animate-fade-in">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1">
            Repertorio Organizado
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)] tracking-tight">
            Discografía & Álbumes
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Agrupaciones discográficas, grabaciones de estudio y antologías acústicas con listados de temas en orden.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search filter */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar álbum o artista..."
              className="pl-9 pr-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] w-48 sm:w-60"
            />
          </div>

          {isAuthor && (
            <button
              onClick={() => navigate({ name: 'album-new' })}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Álbum</span>
            </button>
          )}
        </div>
      </div>

      {/* Albums Grid */}
      {filteredAlbums.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:gap-8">
          {filteredAlbums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onSelect={onSelectAlbum}
              onEdit={onEditAlbum}
              isAuthor={isAuthor}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-w-md mx-auto my-12 shadow-sm">
          <Disc className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1">
            No se encontraron álbumes
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-5">
            {searchQuery ? 'No hay álbumes que coincidan con la búsqueda.' : 'Aún no se ha registrado ningún álbum.'}
          </p>
          {isAuthor && (
            <button
              onClick={() => navigate({ name: 'album-new' })}
              className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
            >
              Crear primer álbum
            </button>
          )}
        </div>
      )}
    </div>
  );
};
