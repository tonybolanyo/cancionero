import React, { useState, useEffect, useMemo } from 'react';
import { Song, SongStatus, SongViewMode } from './types/song';
import { StorageService } from './services/storageService';
import { songToMarkdown } from './utils/markdownParser';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { SongFilters } from './components/SongFilters';
import { SongCard } from './components/SongCard';
import { SongExpandedRow } from './components/SongExpandedRow';
import { SongCompactView } from './components/SongCompactView';
import { SongDashboard } from './components/SongDashboard';
import { SongDetailModal } from './components/SongDetailModal';
import { SongEditorModal } from './components/SongEditorModal';
import { GitSyncModal } from './components/GitSyncModal';
import { AboutModal } from './components/AboutModal';
import { GitHubAuthModal } from './components/GitHubAuthModal';
import { VersionHistory } from './components/VersionHistory';
import { RenameFileModal } from './components/RenameFileModal';
import { AudioAnalyzerModal } from './components/AudioAnalyzerModal';
import { GitNotificationToast, ToastData } from './components/GitNotificationToast';
import { GitHubSyncService, PushResult } from './services/githubSyncService';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Music2, FolderGit2, Lock, BarChart3 } from 'lucide-react';
import { siteMetadata } from './utils/siteConfig';

function CancioneroApp() {
  const { isAuthor, token, user } = useAuth();

  const [songs, setSongs] = useState<Song[]>(() => {
    return StorageService.getSongs();
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | SongStatus>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'spotify' | 'youtube' | 'soundcloud' | 'audio'>('all');
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [activeNavTab, setActiveNavTab] = useState<'all' | 'published' | 'drafts' | 'private' | 'dashboard'>('all');
  const [viewMode, setViewMode] = useState<SongViewMode>(() => {
    try {
      const saved = localStorage.getItem('cancionero_view_mode');
      if (saved === 'grid' || saved === 'expanded' || saved === 'compact') {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'grid';
  });

  const handleViewModeChange = (mode: SongViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('cancionero_view_mode', mode);
    } catch (e) {
      console.warn('Could not save viewMode to localStorage', e);
    }
  };

  // Modal states
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [historySong, setHistorySong] = useState<Song | null>(null);
  const [renamingSong, setRenamingSong] = useState<Song | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isGitModalOpen, setIsGitModalOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);

  // Status of Git repository
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState<boolean>(false);
  const [gitToast, setGitToast] = useState<ToastData | null>(null);

  useEffect(() => {
    checkGitStatus();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let isSyncing = false;

    const syncCatalog = async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const result = await GitHubSyncService.syncCatalogFromRemote(
          token,
          GitHubSyncService.getRemoteConfig(user?.login)
        );

        if (!isMounted || !result.success || !result.songs) {
          return;
        }

        setSongs(result.songs);
        checkGitStatus();
      } catch (err) {
        console.warn('Auto sync catalog error:', err);
      } finally {
        isSyncing = false;
      }
    };

    void syncCatalog();

    // Auto-sync whenever user returns to the tab or network reconnects
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncCatalog();
      }
    };
    const handleOnline = () => {
      void syncCatalog();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [token, user?.login]);

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

  const handleSaveSong = (song: Song, pushResult?: PushResult) => {
    const updated = StorageService.upsertSong(song);
    setSongs(updated);
    checkGitStatus();
    setIsEditorOpen(false);
    setEditingSong(null);
    if (selectedSong && selectedSong.id === song.id) {
      setSelectedSong(song);
    }

    if (pushResult) {
      if (pushResult.success) {
        setGitToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'Git Push Exitoso a GitHub 🚀',
          message: pushResult.message,
          commitHash: pushResult.commitSha,
          commitUrl: pushResult.commitUrl,
          targetRepo: pushResult.targetRepo
        });
      } else if (pushResult.requiresPermissions) {
        setGitToast({
          id: `toast-${Date.now()}`,
          type: 'warning',
          title: 'Permisos de GitHub Requeridos',
          message: pushResult.message,
          requiresPermissions: true,
          targetRepo: pushResult.targetRepo,
          actionLabel: 'Revisar Token en GitHub',
          onAction: () => setIsAuthModalOpen(true)
        });
      } else {
        setGitToast({
          id: `toast-${Date.now()}`,
          type: 'error',
          title: 'Error de Git Push a GitHub',
          message: pushResult.message,
          targetRepo: pushResult.targetRepo
        });
      }
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

  const handleCreateSongFromAudio = (data: {
    tempo: number;
    key: string;
    timeSignature: string;
    tuning?: string;
    audioUrl?: string;
    chordProgression?: string;
    suggestedLyricsChords?: string;
  }) => {
    const newId = `cancion-${Date.now()}`;
    const detectedSong: Song = {
      id: newId,
      title: 'Nueva Composición',
      status: 'draft',
      year: new Date().getFullYear(),
      genre: 'Canción de Autor',
      key: data.key || 'Am',
      tempo: data.tempo || 96,
      timeSignature: data.timeSignature || '4/4',
      tuning: data.tuning || 'Estándar (EADGBE)',
      audioUrl: data.audioUrl,
      notes: data.chordProgression ? `Progresión armónica detectada: ${data.chordProgression}` : undefined,
      tags: ['acústico', 'maqueta'],
      lyrics: data.suggestedLyricsChords || `## Estrofa 1\n[${data.key || 'Am'}] Primer verso de la composición...\n[C] Segundo verso con acordes\n\n## Estribillo\n[G] Y el estribillo asciende aquí...`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingSong(detectedSong);
    setIsAudioModalOpen(false);
    setIsEditorOpen(true);
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

  const handleOpenRename = (song: Song) => {
    if (!isAuthor) {
      setIsAuthModalOpen(true);
      return;
    }
    setRenamingSong(song);
    setIsRenameModalOpen(true);
  };

  const handleRenameSuccess = (renamedSong: Song, updatedSongs: Song[], pushResult?: PushResult) => {
    setSongs(updatedSongs);
    checkGitStatus();
    if (selectedSong && selectedSong.id === renamingSong?.id) {
      setSelectedSong(renamedSong);
    }
    setRenamingSong(null);

    if (pushResult) {
      if (pushResult.success) {
        setGitToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'Archivo Renombrado y Subido a GitHub 🚀',
          message: pushResult.message,
          commitHash: pushResult.commitSha,
          commitUrl: pushResult.commitUrl,
          targetRepo: pushResult.targetRepo
        });
      } else if (pushResult.requiresPermissions) {
        setGitToast({
          id: `toast-${Date.now()}`,
          type: 'warning',
          title: 'Permisos de GitHub Requeridos',
          message: pushResult.message,
          requiresPermissions: true,
          targetRepo: pushResult.targetRepo,
          actionLabel: 'Revisar Token en GitHub',
          onAction: () => setIsAuthModalOpen(true)
        });
      }
    }
  };

  const handleSongRestored = (restoredSong: Song, pushResult?: PushResult) => {
    const updated = StorageService.getSongs();
    setSongs(updated);
    checkGitStatus();
    if (selectedSong && selectedSong.id === restoredSong.id) {
      setSelectedSong(restoredSong);
    }
    setHistorySong(restoredSong);

    if (pushResult) {
      if (pushResult.success) {
        setGitToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'Versión Restaurada y Subida a GitHub 🚀',
          message: pushResult.message,
          commitHash: pushResult.commitSha,
          commitUrl: pushResult.commitUrl,
          targetRepo: pushResult.targetRepo
        });
      } else if (pushResult.requiresPermissions) {
        setGitToast({
          id: `toast-${Date.now()}`,
          type: 'warning',
          title: 'Permisos de GitHub Requeridos',
          message: pushResult.message,
          requiresPermissions: true,
          targetRepo: pushResult.targetRepo,
          actionLabel: 'Revisar Token en GitHub',
          onAction: () => setIsAuthModalOpen(true)
        });
      }
    }
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

  // Available unique tags and counts
  const availableTags = useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach(song => {
      if (isAuthor || song.status === 'published') {
        song.tags?.forEach(tag => {
          const clean = tag.trim().toLowerCase();
          if (clean) {
            map.set(clean, (map.get(clean) || 0) + 1);
          }
        });
      }
    });
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
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

      // Tag filter
      if (tagFilter !== 'all') {
        if (!song.tags || !song.tags.some(t => t.trim().toLowerCase() === tagFilter.toLowerCase())) {
          return false;
        }
      }

      // Search query: accent-insensitive across title, lyrics, notes, tags, genre, key, year, tuning
      if (searchQuery.trim()) {
        const normalize = (text: string) =>
          text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        const q = normalize(searchQuery.trim());
        const inTitle = normalize(song.title).includes(q);
        const inGenre = song.genre ? normalize(song.genre).includes(q) : false;
        const inLyrics = normalize(song.lyrics).includes(q);
        const inNotes = song.notes ? normalize(song.notes).includes(q) : false;
        const inTags = song.tags?.some(t => normalize(t).includes(q));
        const inKey = song.key ? normalize(song.key).includes(q) : false;
        const inYear = song.year ? song.year.toString().includes(q) : false;
        const inTuning = song.tuning ? normalize(song.tuning).includes(q) : false;

        return inTitle || inGenre || inLyrics || inNotes || !!inTags || inKey || inYear || inTuning;
      }

      return true;
    });
  }, [songs, statusFilter, platformFilter, keyFilter, tagFilter, searchQuery, isAuthor]);

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
        onOpenAudioAnalyzer={() => setIsAudioModalOpen(true)}
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
            tagFilter={tagFilter}
            onTagChange={setTagFilter}
            availableTags={availableTags}
            counts={counts}
            isAuthor={isAuthor}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            filteredCount={filteredSongs.length}
          />

          {/* Song Catalog Views */}
          {filteredSongs.length > 0 ? (
            <>
              {/* Vista 1: Cuadrícula de tarjetas visuales (Vista actual) */}
              {viewMode === 'grid' && (
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
                      onSelectTag={setTagFilter}
                      onRenameFile={handleOpenRename}
                    />
                  ))}
                </div>
              )}

              {/* Vista 2: Lista ampliada (Filas detalladas con letra extendida y notas) */}
              {viewMode === 'expanded' && (
                <div className="flex flex-col gap-4">
                  {filteredSongs.map((song) => (
                    <SongExpandedRow
                      key={song.id}
                      song={song}
                      onSelect={(s) => setSelectedSong(s)}
                      onEdit={(s) => handleEditSong(s)}
                      onDownloadMd={(s) => handleDownloadMd(s)}
                      isAuthor={isAuthor}
                      onViewHistory={handleViewHistory}
                      onSelectTag={setTagFilter}
                      onRenameFile={handleOpenRename}
                    />
                  ))}
                </div>
              )}

              {/* Vista 3: Lista más comprimida (Tabla de atril/repertorio densa y ordenable) */}
              {viewMode === 'compact' && (
                <SongCompactView
                  songs={filteredSongs}
                  onSelect={(s) => setSelectedSong(s)}
                  onEdit={(s) => handleEditSong(s)}
                  onDownloadMd={(s) => handleDownloadMd(s)}
                  isAuthor={isAuthor}
                  onViewHistory={handleViewHistory}
                  onRenameFile={handleOpenRename}
                />
              )}
            </>
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
                    setTagFilter('all');
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
              {siteMetadata.name}
            </p>
            <p className="text-[var(--text-muted)] max-w-xl">
              {siteMetadata.description}
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
      {selectedSong && (
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
          onRenameFile={handleOpenRename}
        />
      )}

      {isEditorOpen && (
        <SongEditorModal
          song={editingSong}
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingSong(null);
          }}
          onSave={handleSaveSong}
        />
      )}

      {isGitModalOpen && (
        <GitSyncModal
          isOpen={isGitModalOpen}
          onClose={() => {
            setIsGitModalOpen(false);
            checkGitStatus();
          }}
          songs={songs}
          onSongsUpdated={handleSongsUpdated}
        />
      )}

      {isAboutOpen && (
        <AboutModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
        />
      )}

      {isAuthModalOpen && (
        <GitHubAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}

      {/* Song Version History Modal (Author Only) */}
      {isHistoryModalOpen && historySong && (
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
      )}

      {/* Rename Song File Modal (Author Only) */}
      {isRenameModalOpen && renamingSong && (
        <RenameFileModal
          song={renamingSong}
          isOpen={isRenameModalOpen}
          onClose={() => {
            setIsRenameModalOpen(false);
            setRenamingSong(null);
          }}
          onRenameSuccess={handleRenameSuccess}
        />
      )}

      {/* Standalone Audio Musical Analyzer Modal */}
      {isAudioModalOpen && (
        <AudioAnalyzerModal
          isOpen={isAudioModalOpen}
          onClose={() => setIsAudioModalOpen(false)}
          onCreateSongFromAudio={handleCreateSongFromAudio}
        />
      )}

      {/* Real-time Global Git Push & Commit Notification Toast */}
      <GitNotificationToast
        toast={gitToast}
        onDismiss={() => setGitToast(null)}
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
