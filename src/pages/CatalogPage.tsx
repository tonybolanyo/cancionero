import React from 'react';
import { Song } from '../types/song';
import { Album } from '../types/album';
import { useSongCatalog } from '../hooks/useSongCatalog';
import { HeroSection } from '../components/HeroSection';
import { AlbumCard } from '../components/AlbumCard';
import { SongFilters } from '../components/SongFilters';
import { SongCard } from '../components/SongCard';
import { SongExpandedRow } from '../components/SongExpandedRow';
import { SongCompactView } from '../components/SongCompactView';
import { SongDashboard } from '../components/SongDashboard';
import { Disc, ArrowRight, Plus, Music2, BarChart3, BookOpen } from 'lucide-react';

export interface CatalogPageProps {
  songs: Song[];
  albums: Album[];
  isAuthor: boolean;
  catalog: ReturnType<typeof useSongCatalog>;
  onSelectSong: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onDownloadMd: (song: Song) => void;
  onViewHistory: (song: Song) => void;
  onRenameSong: (song: Song) => void;
  onDeleteSong: (song: Song) => void;
  onOpenVisualizer: (song?: Song) => void;
  onOpenNewSong: () => void;
  onOpenNewAlbum: () => void;
  onSelectAlbum: (album: Album) => void;
  onEditAlbum: (album: Album) => void;
  onExploreAlbums: () => void;
  onOpenGitSync: () => void;
  onOpenSongbook: () => void;
  onOpenAuthModal: () => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({
  songs,
  albums,
  isAuthor,
  catalog,
  onSelectSong,
  onEditSong,
  onDownloadMd,
  onViewHistory,
  onRenameSong,
  onDeleteSong,
  onOpenVisualizer,
  onOpenNewSong,
  onOpenNewAlbum,
  onSelectAlbum,
  onEditAlbum,
  onExploreAlbums,
  onOpenGitSync,
  onOpenSongbook,
  onOpenAuthModal
}) => {
  const {
    searchQuery,
    statusFilter,
    platformFilter,
    keyFilter,
    tagFilter,
    viewMode,
    setSearchQuery,
    setStatusFilter,
    setPlatformFilter,
    setKeyFilter,
    setTagFilter,
    setActiveNavTab,
    handleViewModeChange,
    handleNavSelect,
    resetFilters,
    filteredSongs,
    availableKeys,
    availableTags,
    counts
  } = catalog;

  return (
    <>
      {/* Split Hero Section */}
      <HeroSection
        songs={songs}
        albumCount={albums.length}
        onPlayFeatured={onSelectSong}
        onOpenGitModal={onOpenGitSync}
        onExploreCatalog={() => {
          const el = document.getElementById('catalogo-section');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        onExploreAlbums={onExploreAlbums}
        onOpenNewSong={onOpenNewSong}
        isAuthor={isAuthor}
        onOpenAuthModal={onOpenAuthModal}
      />

      {/* Featured Albums Highlight Strip */}
      {albums.length > 0 && (
        <section className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60 py-10">
          <div className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1 flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5" />
                  <span>Agrupación por Álbum</span>
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
                  Discografía & Álbumes de Estudio
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {isAuthor && (
                  <button
                    onClick={onOpenNewAlbum}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Álbum</span>
                  </button>
                )}
                <button
                  onClick={onExploreAlbums}
                  className="text-xs font-medium text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver discografía completa ({albums.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {albums.slice(0, 4).map(album => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  onSelect={onSelectAlbum}
                  onEdit={onEditAlbum}
                  isAuthor={isAuthor}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Catalog Section */}
      <section id="catalogo-section" className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1">
              {isAuthor ? 'Panel de Administración & Catálogo' : 'Repertorio Público'}
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              {isAuthor ? 'Archivo Completo de Composiciones' : 'Canciones Editadas'}
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">{filteredSongs.length}</span>
            <span>de {isAuthor ? songs.length : counts.published} temas visibles</span>
            {isAuthor && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  onClick={() => handleNavSelect('dashboard')}
                  className="hover:text-[var(--accent-primary)] transition-colors flex items-center gap-1 cursor-pointer font-medium"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Ver gráficos</span>
                </button>
              </>
            )}
            <span aria-hidden="true">·</span>
            <button
              onClick={onOpenSongbook}
              className="hover:text-[var(--accent-primary)] transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
              title="Generar Cancionero imprimible (PDF) listo para atril"
            >
              <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Cancionero PDF (Atril)</span>
            </button>
          </div>
        </div>

        {/* Search and Segmented Filter Controls */}
        <SongFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={(status) => {
            setStatusFilter(status);
            if (status === 'all') setActiveNavTab('all');
            if (status === 'published') setActiveNavTab('published');
            if (status === 'draft') setActiveNavTab('drafts');
            if (status === 'private') setActiveNavTab('private');
          }}
          platformFilter={platformFilter}
          onPlatformChange={setPlatformFilter}
          keyFilter={keyFilter}
          onKeyChange={setKeyFilter}
          availableKeys={availableKeys}
          tagFilter={tagFilter}
          onTagChange={setTagFilter}
          availableTags={availableTags}
          counts={counts}
          isAuthor={isAuthor}
          onOpenAuthModal={onOpenAuthModal}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          filteredCount={filteredSongs.length}
        />

        {/* Song Catalog Views */}
        {filteredSongs.length > 0 ? (
          <>
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-5 sm:gap-6">
                {filteredSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    onSelect={onSelectSong}
                    onEdit={onEditSong}
                    onDownloadMd={onDownloadMd}
                    isAuthor={isAuthor}
                    onViewHistory={onViewHistory}
                    onSelectTag={setTagFilter}
                    onRenameFile={onRenameSong}
                    onDelete={onDeleteSong}
                    onOpenVisualizer={onOpenVisualizer}
                  />
                ))}
              </div>
            )}

            {viewMode === 'expanded' && (
              <div className="flex flex-col gap-4">
                {filteredSongs.map((song) => (
                  <SongExpandedRow
                    key={song.id}
                    song={song}
                    onSelect={onSelectSong}
                    onEdit={onEditSong}
                    onDownloadMd={onDownloadMd}
                    isAuthor={isAuthor}
                    onViewHistory={onViewHistory}
                    onSelectTag={setTagFilter}
                    onRenameFile={onRenameSong}
                    onDelete={onDeleteSong}
                    onOpenVisualizer={onOpenVisualizer}
                  />
                ))}
              </div>
            )}

            {viewMode === 'compact' && (
              <SongCompactView
                songs={filteredSongs}
                onSelect={onSelectSong}
                onEdit={onEditSong}
                onDownloadMd={onDownloadMd}
                isAuthor={isAuthor}
                onViewHistory={onViewHistory}
                onRenameFile={onRenameSong}
                onDelete={onDeleteSong}
              />
            )}
          </>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] max-w-lg mx-auto my-8 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-surface-subtle)] mx-auto flex items-center justify-center text-[var(--text-muted)] mb-4">
              <Music2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-[var(--text-primary)] mb-2">
              No se encontraron canciones
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-6">
              No hay temas que coincidan con los filtros seleccionados o el término de búsqueda actual.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-medium)] transition-colors cursor-pointer"
              >
                Restablecer filtros
              </button>
              {isAuthor && (
                <button
                  onClick={onOpenNewSong}
                  className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
                >
                  Crear nueva canción
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Recharts Data Visualization Dashboard Section (Exclusively for Author) */}
      {isAuthor && (
        <SongDashboard
          songs={songs}
          isAuthor={isAuthor}
        />
      )}
    </>
  );
};
