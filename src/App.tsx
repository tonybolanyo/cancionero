import React, { useState, useEffect, useMemo } from 'react';
import { Song, SongStatus } from './types/song';
import { StorageService } from './services/storageService';
import { songToMarkdown } from './utils/markdownParser';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { SongFilters } from './components/SongFilters';
import { SongCard } from './components/SongCard';
import { SongDashboard } from './components/SongDashboard';
import { SongDetailModal } from './components/SongDetailModal';
import { SongEditorModal } from './components/SongEditorModal';
import { GitSyncModal } from './components/GitSyncModal';
import { AboutModal } from './components/AboutModal';
import { GitHubAuthModal } from './components/GitHubAuthModal';
import { VersionHistory } from './components/VersionHistory';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Music2, FolderGit2, Lock, BarChart3 } from 'lucide-react';

function CancioneroApp() {
  const { isAuthor } = useAuth();

  const [songs, setSongs] = useState<Song[]>(() => {
    return StorageService.getSongs();
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | SongStatus>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'spotify' | 'youtube' | 'soundcloud' | 'audio'>('all');
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [activeNavTab, setActiveNavTab] = useState<'all' | 'published' | 'drafts' | 'private' | 'dashboard'>('all');

  // Modal states
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [historySong, setHistorySong] = useState<Song | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Status of Git repository
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState<boolean>(false);

  useEffect(() => {
    checkGitStatus();
  }, []);

  // If user logs out and was on drafts or private tab, reset to 'all'
  useEffect(() => {
    if (!isAuthor && (statusFilter === 'draft' || statusFilter === 'private')) {
      setStatusFilter('all');
      setActiveNavTab('all');
    }
  }, [isAuthor, statusFilter]);

  const checkGitStatus = () => {
    const status = StorageService.getGitStatus();
    setHasUncommittedChanges(!status.isClean);
  };

  const handleSongsUpdated = (updatedSongs: Song[]) => {
    setSongs(updatedSongs);
    checkGitStatus();
  };

  const handleSaveSong = (song: Song) => {
    const updated = StorageService.upsertSong(song);
    setSongs(updated);
    checkGitStatus();
    setIsEditorOpen(false);
    setEditingSong(null);
    if (selectedSong && selectedSong.id === song.id) {
      setSelectedSong(song);
    }
  };

  const handleDownloadMd = (song: Song) => {
    const markdown = songToMarkdown(song);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${song.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenNewSong = () => {
    if (!isAuthor) {
      setIsAuthModalOpen(true);
      return;
    }
    setEditingSong(null);
    setIsEditorOpen(true);
  };

  const handleEditSong = (song: Song) => {
    if (!isAuthor) {
      setIsAuthModalOpen(true);
      return;
    }
    setEditingSong(song);
    setIsEditorOpen(true);
  };

  const handleViewHistory = (song: Song) => {
    if (!isAuthor) {
      setIsAuthModalOpen(true);
      return;
    }
    setHistorySong(song);
    setIsHistoryModalOpen(true);
  };

  const handleSongRestored = (restoredSong: Song) => {
    const updated = StorageService.getSongs();
    setSongs(updated);
    checkGitStatus();
    if (selectedSong && selectedSong.id === restoredSong.id) {
      setSelectedSong(restoredSong);
    }
    setHistorySong(restoredSong);
  };

  // Available unique musical keys for filter
  const availableKeys = useMemo(() => {
    const set = new Set<string>();
    songs.forEach(s => {
      if (s.key && (isAuthor || s.status === 'published')) {
        set.add(s.key);
      }
    });
    return Array.from(set).sort();
  }, [songs, isAuthor]);

  // Counts for segmented tabs
  const counts = useMemo(() => {
    const published = songs.filter(s => s.status === 'published').length;
    const draft = songs.filter(s => s.status === 'draft').length;
    const priv = songs.filter(s => s.status === 'private').length;
    return {
      all: isAuthor ? songs.length : published,
      published,
      draft,
      private: priv
    };
  }, [songs, isAuthor]);

  // Filtered and searched songs
  const filteredSongs = useMemo(() => {
    return songs.filter(song => {
      // Security constraint: Non-authors can only view published songs
      if (!isAuthor && song.status !== 'published') {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && song.status !== statusFilter) {
        return false;
      }

      // Platform filter
      if (platformFilter === 'spotify' && !song.spotifyUrl) return false;
      if (platformFilter === 'youtube' && !song.youtubeUrl) return false;
      if (platformFilter === 'soundcloud' && !song.soundcloudUrl) return false;
      if (platformFilter === 'audio' && !song.audioUrl) return false;

      // Key filter
      if (keyFilter !== 'all' && song.key !== keyFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = song.title.toLowerCase().includes(q);
        const inGenre = song.genre?.toLowerCase().includes(q);
        const inLyrics = song.lyrics.toLowerCase().includes(q);
        const inNotes = song.notes?.toLowerCase().includes(q);
        return inTitle || inGenre || inLyrics || inNotes;
      }

      return true;
    });
  }, [songs, statusFilter, platformFilter, keyFilter, searchQuery, isAuthor]);

  const handleNavSelect = (tab: 'all' | 'published' | 'drafts' | 'private' | 'dashboard') => {
    setActiveNavTab(tab);
    if (tab === 'dashboard') {
      const el = document.getElementById('dashboard-section');
      el?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (tab === 'all') setStatusFilter('all');
    if (tab === 'published') setStatusFilter('published');
    if (tab === 'drafts') {
      if (!isAuthor) {
        setIsAuthModalOpen(true);
        return;
      }
      setStatusFilter('draft');
    }
    if (tab === 'private') {
      if (!isAuthor) {
        setIsAuthModalOpen(true);
        return;
      }
      setStatusFilter('private');
    }

    const catEl = document.getElementById('catalogo-section');
    catEl?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans transition-colors duration-200">
      {/* 3-Zone Top Bar Navigation */}
      <Header
        onOpenNewSong={handleOpenNewSong}
        onOpenGitModal={() => {
          if (!isAuthor) {
            setIsAuthModalOpen(true);
            return;
          }
          setIsGitModalOpen(true);
        }}
        onSelectTab={handleNavSelect}
        activeTab={activeNavTab}
        hasUncommittedChanges={hasUncommittedChanges}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1">
        {/* Split Hero Section with Visual Image and Metric Strip */}
        <HeroSection
          songs={songs}
          onPlayFeatured={(song) => setSelectedSong(song)}
          onOpenGitModal={() => setIsGitModalOpen(true)}
          onExploreCatalog={() => {
            const el = document.getElementById('catalogo-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          isAuthor={isAuthor}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />

        {/* Catalog Section */}
        <section id="catalogo-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Section Header */}
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
              <span aria-hidden="true">·</span>
              <button
                onClick={() => handleNavSelect('dashboard')}
                className="hover:text-[var(--accent-primary)] transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Ver gráficos</span>
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
            counts={counts}
            isAuthor={isAuthor}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />

          {/* Song Grid */}
          {filteredSongs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSongs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  onSelect={(s) => setSelectedSong(s)}
                  onEdit={(s) => handleEditSong(s)}
                  onDownloadMd={(s) => handleDownloadMd(s)}
                  isAuthor={isAuthor}
                  onViewHistory={handleViewHistory}
                />
              ))}
            </div>
          ) : (
            /* Graceful empty state */
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
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setPlatformFilter('all');
                    setKeyFilter('all');
                    setActiveNavTab('all');
                  }}
                  className="px-4 py-2 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-medium)] transition-colors cursor-pointer"
                >
                  Restablecer filtros
                </button>
                {isAuthor && (
                  <button
                    onClick={handleOpenNewSong}
                    className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
                  >
                    Crear nueva canción
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Recharts Data Visualization Dashboard Section */}
        <SongDashboard
          songs={isAuthor ? songs : songs.filter(s => s.status === 'published')}
          isAuthor={isAuthor}
        />
      </main>

      {/* Editorial Footer */}
      <footer className="mt-auto border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[var(--text-muted)]">
          <div>
            <p className="font-serif text-[var(--text-primary)] font-semibold mb-1">
              Cancionero & Archivo Musical · Tony
            </p>
            <p className="text-[var(--text-muted)]">
              Almacenamiento en archivos locales Markdown con cifrado de acordes y autenticación GitHub 100% estática.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => handleNavSelect('dashboard')}
              className="flex items-center gap-1.5 hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Dashboard & Estadísticas</span>
            </button>

            {isAuthor ? (
              <button
                onClick={() => setIsGitModalOpen(true)}
                className="flex items-center gap-1.5 hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Sincronizar con Git</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Acceso Autor (GitHub)</span>
              </button>
            )}

            <button
              onClick={() => setIsAboutOpen(true)}
              className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Manifiesto
            </button>
            <a
              href="mailto:tony@tonygb.com"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Contacto de Autor
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SongDetailModal
        song={selectedSong}
        onClose={() => setSelectedSong(null)}
        onEdit={(song) => {
          setSelectedSong(null);
          handleEditSong(song);
        }}
        onDownloadMd={handleDownloadMd}
        isAuthor={isAuthor}
        onViewHistory={handleViewHistory}
      />

      <SongEditorModal
        song={editingSong}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingSong(null);
        }}
        onSave={handleSaveSong}
      />

      <GitSyncModal
        isOpen={isGitModalOpen}
        onClose={() => {
          setIsGitModalOpen(false);
          checkGitStatus();
        }}
        songs={songs}
        onSongsUpdated={handleSongsUpdated}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      <GitHubAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Song Version History Modal (Author Only) */}
      <VersionHistory
        song={historySong}
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistorySong(null);
        }}
        onRestoreSong={handleSongRestored}
        isAuthor={isAuthor}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CancioneroApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
