import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Song, SongStatus, SongViewMode, SavedAudioAnalysis } from './types/song';
import { ChordSegment } from './lib/audio/chords';
import { Album } from './types/album';
import { StorageService } from './services/storageService';
import { songToMarkdown } from './utils/markdownParser';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { SongFilters } from './components/SongFilters';
import { SongCard } from './components/SongCard';
import { SongExpandedRow } from './components/SongExpandedRow';
import { SongCompactView } from './components/SongCompactView';
import { SongDashboard } from './components/SongDashboard';
import { AlbumCard } from './components/AlbumCard';
import { Footer } from './components/Footer';
import { SeoHelper } from './components/SeoHelper';
import { GitNotificationToast, ToastData } from './components/GitNotificationToast';
import { SkipLink } from './components/SkipLink';
import { GitHubAuthModal } from './components/GitHubAuthModal';
import { RenameFileModal } from './components/RenameFileModal';
import { DeleteSongModal } from './components/DeleteSongModal';
import { VersionHistory } from './components/VersionHistory';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { SongwritingQuickStartModal } from './components/SongwritingQuickStartModal';
import { SongVideoVisualizerModal } from './components/SongVideoVisualizerModal';
import { SONGWRITING_TEMPLATES } from './utils/songwriterHelper';
import { GitHubSyncService, PushResult } from './services/githubSyncService';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationProvider, useAppNavigation } from './context/NavigationContext';
import { useKeyboardShortcuts, GLOBAL_SHORTCUTS } from './hooks/useKeyboardShortcuts';

// Independent Navigation Pages
import { AlbumsPage } from './pages/AlbumsPage';
import { AlbumDetailPage } from './pages/AlbumDetailPage';
import { AlbumEditorPage } from './pages/AlbumEditorPage';
import { SongDetailPage } from './pages/SongDetailPage';
import { SongEditorPage } from './pages/SongEditorPage';
import { SongbookPage } from './pages/SongbookPage';
import { AudioAnalyzerPage } from './pages/AudioAnalyzerPage';
import { AboutPage } from './pages/AboutPage';
import { GitSyncPage } from './pages/GitSyncPage';
import { SpotifyImportPage } from './pages/SpotifyImportPage';

import { Music2, BarChart3, BookOpen, Disc, ArrowRight, Plus } from 'lucide-react';

function CancioneroApp() {
  const { isAuthor, token, user } = useAuth();
  const { currentRoute, navigate, goBack } = useAppNavigation();

  // Songs and Albums state
  const [songs, setSongs] = useState<Song[]>(() => {
    return StorageService.getSongs();
  });

  const [albums, setAlbums] = useState<Album[]>(() => {
    return StorageService.getAlbums();
  });

  // Filters for catalog
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
      // Ignore
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

  // Dedicated dialog states (only for confirmations / auth)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isQuickStartOpen, setIsQuickStartOpen] = useState<boolean>(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState<boolean>(false);
  const [historySong, setHistorySong] = useState<Song | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [renamingSong, setRenamingSong] = useState<Song | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [deletingSong, setDeletingSong] = useState<Song | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [visualizerSong, setVisualizerSong] = useState<Song | null>(null);
  const [isVisualizerModalOpen, setIsVisualizerModalOpen] = useState<boolean>(false);

  const handleOpenVisualizer = (targetSong?: Song) => {
    const s = targetSong || (currentRoute.name === 'song-detail' ? songs.find(item => item.id === currentRoute.songId) : null) || songs[0] || null;
    if (s) {
      setVisualizerSong(s);
      setIsVisualizerModalOpen(true);
    }
  };

  // Status of Git repository
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState<boolean>(false);
  const [gitToast, setGitToast] = useState<ToastData | null>(null);

  const { toggleTheme } = useTheme();
  const { register, unregister } = useKeyboardShortcuts();

  useEffect(() => {
    checkGitStatus();
  }, []);

  const handleStartWithLyrics = () => {
    setPendingAudioFile(null);
    setIsQuickStartOpen(false);
    navigate({ name: 'song-new' });
  };

  const handleStartWithAudioFile = (file: File) => {
    setPendingAudioFile(file);
    setIsQuickStartOpen(false);
    navigate({ name: 'song-new' });
  };

  const handleStartWithTemplate = (template: typeof SONGWRITING_TEMPLATES[0]) => {
    setPendingAudioFile(null);
    const newId = `cancion-${Date.now()}`;
    const newSong: Song = {
      id: newId,
      title: template.title,
      status: 'draft',
      year: new Date().getFullYear(),
      genre: 'Canción de Autor',
      key: template.key,
      tempo: template.tempo,
      timeSignature: template.timeSignature,
      tuning: 'Estándar (EADGBE)',
      tags: ['acústico', 'composición'],
      lyrics: template.lyrics,
      notes: template.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updated = StorageService.upsertSong(newSong);
    setSongs(updated);
    setIsQuickStartOpen(false);
    navigate({ name: 'song-edit', songId: newSong.id });
  };

  // Update document title dynamically based on route
  useEffect(() => {
    if (currentRoute.name === 'song-detail') {
      const s = songs.find(item => item.id === currentRoute.songId);
      if (s) {
        document.title = `${s.title} - Cancionero de versos perdidos`;
        return;
      }
    } else if (currentRoute.name === 'album-detail') {
      const a = albums.find(item => item.id === currentRoute.albumId);
      if (a) {
        document.title = `${a.title} - Álbum - Cancionero de versos perdidos`;
        return;
      }
    } else if (currentRoute.name === 'albums') {
      document.title = `Discografía & Álbumes - Cancionero de versos perdidos`;
      return;
    } else if (currentRoute.name === 'song-new') {
      document.title = `Nueva Canción - Cancionero de versos perdidos`;
      return;
    } else if (currentRoute.name === 'album-new') {
      document.title = `Nuevo Álbum - Cancionero de versos perdidos`;
      return;
    } else if (currentRoute.name === 'video-visualizer') {
      document.title = `Generador de Vídeo para YouTube - Cancionero de versos perdidos`;
      return;
    }
    document.title = `Cancionero de versos perdidos`;
  }, [currentRoute, songs, albums]);

  // Auto-open visualizer when navigating to video-visualizer route
  useEffect(() => {
    if (currentRoute.name === 'video-visualizer') {
      const targetSong = (currentRoute.songId ? songs.find(s => s.id === currentRoute.songId) : null) || songs[0] || null;
      if (targetSong) {
        setVisualizerSong(targetSong);
        setIsVisualizerModalOpen(true);
      }
    }
  }, [currentRoute, songs]);

  // Setup keyboard shortcuts
  useEffect(() => {
    register('new-song', {
      ...GLOBAL_SHORTCUTS.newSong,
      callback: () => {
        if (isAuthor) {
          setIsQuickStartOpen(true);
        } else {
          setIsAuthModalOpen(true);
        }
      },
      description: GLOBAL_SHORTCUTS.newSong.description,
    });

    register('toggle-theme', {
      ...GLOBAL_SHORTCUTS.toggleTheme,
      callback: toggleTheme,
      description: GLOBAL_SHORTCUTS.toggleTheme.description,
    });

    register('git-sync', {
      ...GLOBAL_SHORTCUTS.toggleGitSync,
      callback: () => {
        if (isAuthor) {
          navigate({ name: 'git-sync' });
        } else {
          setIsAuthModalOpen(true);
        }
      },
      description: GLOBAL_SHORTCUTS.toggleGitSync.description,
    });

    register('show-shortcuts', {
      ...GLOBAL_SHORTCUTS.showKeyboardShortcuts,
      callback: () => setIsKeyboardShortcutsOpen(true),
      description: GLOBAL_SHORTCUTS.showKeyboardShortcuts.description,
    });

    register('close-modal', {
      ...GLOBAL_SHORTCUTS.closeModal,
      callback: () => {
        if (isHistoryModalOpen) setIsHistoryModalOpen(false);
        if (isRenameModalOpen) setIsRenameModalOpen(false);
        if (isDeleteModalOpen) setIsDeleteModalOpen(false);
        if (isAuthModalOpen) setIsAuthModalOpen(false);
        if (isKeyboardShortcutsOpen) setIsKeyboardShortcutsOpen(false);
      },
      description: GLOBAL_SHORTCUTS.closeModal.description,
    });

    return () => {
      unregister('new-song');
      unregister('toggle-theme');
      unregister('git-sync');
      unregister('show-shortcuts');
      unregister('close-modal');
    };
  }, [isAuthor, isHistoryModalOpen, isRenameModalOpen, isDeleteModalOpen, isAuthModalOpen, isKeyboardShortcutsOpen, register, unregister, toggleTheme, navigate]);

  // Background catalog synchronization
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

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncCatalog();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, user?.login]);

  // Reset tab if logged out
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

  // Song CRUD
  const handleSaveSong = (song: Song, pushResult?: PushResult) => {
    const updated = StorageService.upsertSong(song);
    setSongs(updated);
    checkGitStatus();

    // If song was linked to an album, ensure album tracklist is synced
    if (song.albumId) {
      const targetAlbum = albums.find(a => a.id === song.albumId);
      if (targetAlbum) {
        const hasTrack = targetAlbum.tracks.some(t => t.songId === song.id);
        if (!hasTrack) {
          const updatedTracks = [
            ...targetAlbum.tracks,
            {
              id: `track-${Date.now()}`,
              songId: song.id,
              title: song.title,
              order: targetAlbum.tracks.length + 1,
              duration: song.duration
            }
          ];
          const updatedAlbum: Album = { ...targetAlbum, tracks: updatedTracks };
          const newAlbums = StorageService.upsertAlbum(updatedAlbum);
          setAlbums(newAlbums);
        }
      }
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

  // Album CRUD
  const handleSaveAlbum = (album: Album) => {
    const updated = StorageService.upsertAlbum(album);
    setAlbums(updated);

    // Sync album title/id on matching songs
    if (album.tracks && album.tracks.length > 0) {
      let songsChanged = false;
      const currentSongs = [...songs];
      album.tracks.forEach(track => {
        if (track.songId) {
          const songIndex = currentSongs.findIndex(s => s.id === track.songId);
          if (songIndex >= 0) {
            currentSongs[songIndex] = {
              ...currentSongs[songIndex],
              albumId: album.id,
              albumTitle: album.title,
              trackNumber: track.order
            };
            StorageService.upsertSong(currentSongs[songIndex]);
            songsChanged = true;
          }
        }
      });
      if (songsChanged) {
        setSongs(currentSongs);
      }
    }

    setGitToast({
      id: `toast-${Date.now()}`,
      type: 'success',
      title: 'Álbum Guardado',
      message: `El álbum "${album.title}" ha sido guardado en la discografía.`
    });
  };

  const handleDeleteAlbum = (album: Album) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`¿Estás seguro de que deseas eliminar el álbum "${album.title}"? Las canciones del catálogo no se borrarán.`);
      if (!ok) return;
    }

    const updated = StorageService.deleteAlbum(album.id);
    setAlbums(updated);
    navigate({ name: 'albums' });

    setGitToast({
      id: `toast-${Date.now()}`,
      type: 'info',
      title: 'Álbum Eliminado',
      message: `El álbum "${album.title}" ha sido eliminado de la discografía.`
    });
  };

  const handleCreateSongFromAudio = (data: {
    tempo: number;
    key: string;
    timeSignature: string;
    tuning?: string;
    audioUrl?: string;
    chordProgression?: string;
    suggestedLyricsChords?: string;
    tempoOffset?: number;
    chords?: ChordSegment[];
    audioAnalysis?: SavedAudioAnalysis;
  }) => {
    const newId = `cancion-${Date.now()}`;
    const offsetNote = typeof data.tempoOffset === 'number' && data.tempoOffset > 0
      ? ` (offset 1er beat: ${data.tempoOffset.toFixed(3)}s)`
      : '';
    const initialNotes = data.chordProgression
      ? `Progresión armónica detectada: ${data.chordProgression}${offsetNote}`
      : (offsetNote ? `Offset primer beat: ${data.tempoOffset?.toFixed(3)}s` : undefined);

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
      notes: initialNotes,
      tags: ['acústico', 'maqueta'],
      lyrics: data.suggestedLyricsChords || `## Estrofa 1\n[${data.key || 'Am'}] Primer verso...\n[C] Segundo verso\n\n## Estribillo\n[G] Y el estribillo asciende...`,
      audioAnalysis: data.audioAnalysis,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = StorageService.upsertSong(detectedSong);
    setSongs(updated);
    navigate({ name: 'song-edit', songId: detectedSong.id });
  };

  const handleImportSongs = (importedSongs: Song[]) => {
    setSongs([...songs, ...importedSongs]);
    checkGitStatus();
  };

  const handleEditSong = (song: Song) => {
    if (!isAuthor) {
      setIsAuthModalOpen(true);
      return;
    }
    navigate({ name: 'song-edit', songId: song.id });
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
    setRenamingSong(null);
    if (currentRoute.name === 'song-detail') {
      navigate({ name: 'song-detail', songId: renamedSong.id });
    }
  };

  const handleOpenDelete = (song: Song) => {
    if (!isAuthor) {
      setIsAuthModalOpen(true);
      return;
    }
    setDeletingSong(song);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = (deletedSong: Song, updatedSongs: Song[], pushResult?: PushResult) => {
    setSongs(updatedSongs);
    checkGitStatus();
    setDeletingSong(null);
    if (currentRoute.name === 'song-detail' && currentRoute.songId === deletedSong.id) {
      navigate({ name: 'catalog' });
    }
  };

  const handleSongRestored = (restoredSong: Song, pushResult?: PushResult) => {
    const updated = StorageService.getSongs();
    setSongs(updated);
    checkGitStatus();
    setHistorySong(restoredSong);
  };

  // Keys & Tags for Filters
  const availableKeys = useMemo(() => {
    const set = new Set<string>();
    songs.forEach(s => {
      if (s.key && (isAuthor || s.status === 'published')) {
        set.add(s.key);
      }
    });
    return Array.from(set).sort();
  }, [songs, isAuthor]);

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

  const filteredSongs = useMemo(() => {
    return songs.filter(song => {
      if (!isAuthor && song.status !== 'published') return false;
      if (statusFilter !== 'all' && song.status !== statusFilter) return false;
      if (platformFilter === 'spotify' && !song.spotifyUrl) return false;
      if (platformFilter === 'youtube' && !song.youtubeUrl) return false;
      if (platformFilter === 'soundcloud' && !song.soundcloudUrl) return false;
      if (platformFilter === 'audio' && !song.audioUrl) return false;
      if (keyFilter !== 'all' && song.key !== keyFilter) return false;
      if (tagFilter !== 'all') {
        if (!song.tags || !song.tags.some(t => t.trim().toLowerCase() === tagFilter.toLowerCase())) {
          return false;
        }
      }

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
    if (currentRoute.name !== 'catalog') {
      navigate({ name: 'catalog' });
    }

    if (tab === 'dashboard') {
      if (!isAuthor) {
        setIsAuthModalOpen(true);
        return;
      }
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

  // Find current song / album for detail and edit views
  const activeDetailSong = currentRoute.name === 'song-detail' ? songs.find(s => s.id === currentRoute.songId) || null : null;
  const activeEditSong = currentRoute.name === 'song-edit' ? songs.find(s => s.id === currentRoute.songId) || null : null;
  const activeDetailAlbum = currentRoute.name === 'album-detail' ? albums.find(a => a.id === currentRoute.albumId) || null : null;
  const activeEditAlbum = currentRoute.name === 'album-edit' ? albums.find(a => a.id === currentRoute.albumId) || null : null;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans transition-colors duration-200">
      {/* Accessibility Skip Link */}
      <SkipLink />

      {/* SEO Meta Tags */}
      <SeoHelper
        title={activeDetailSong ? `${activeDetailSong.title} - Cancionero de versos perdidos` : 'Cancionero de versos perdidos'}
        description="Versos que se perdieron un día y regresaron convertidos en canciones. Canciones propias, letras íntimas y pequeñas verdades hechas de guitarra, memoria y poesía."
        keywords={['canciones', 'poesía', 'acústico', 'cantautor', 'álbumes', 'discografía', 'singer-songwriter']}
        song={activeDetailSong || undefined}
      />

      {/* 3-Zone Top Bar Navigation */}
      <Header
        onOpenNewSong={() => {
          if (isAuthor) {
            setIsQuickStartOpen(true);
          } else {
            setIsAuthModalOpen(true);
          }
        }}
        onOpenNewAlbum={() => {
          if (isAuthor) {
            navigate({ name: 'album-new' });
          } else {
            setIsAuthModalOpen(true);
          }
        }}
        onOpenSpotifyImport={() => {
          if (isAuthor) {
            navigate({ name: 'spotify-import' });
          } else {
            setIsAuthModalOpen(true);
          }
        }}
        onOpenGitModal={() => {
          if (isAuthor) {
            navigate({ name: 'git-sync' });
          } else {
            setIsAuthModalOpen(true);
          }
        }}
        onSelectTab={handleNavSelect}
        onSelectAlbums={() => navigate({ name: 'albums' })}
        activeTab={activeNavTab}
        isAlbumsActive={currentRoute.name === 'albums' || currentRoute.name === 'album-detail' || currentRoute.name === 'album-new' || currentRoute.name === 'album-edit'}
        hasUncommittedChanges={hasUncommittedChanges}
        onOpenAbout={() => navigate({ name: 'about' })}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAudioAnalyzer={() => navigate({ name: 'audio-analyzer' })}
        onOpenSongbook={() => navigate({ name: 'songbook' })}
        onOpenVideoVisualizer={() => handleOpenVisualizer()}
      />

      {/* Main Page Content Router */}
      <main className="flex-1">
        {/* Route: Album Detail Page */}
        {currentRoute.name === 'album-detail' && (
          activeDetailAlbum ? (
            <AlbumDetailPage
              album={activeDetailAlbum}
              songs={songs}
              onEditAlbum={(alb) => navigate({ name: 'album-edit', albumId: alb.id })}
              onDeleteAlbum={handleDeleteAlbum}
              onSelectSong={(s) => navigate({ name: 'song-detail', songId: s.id })}
            />
          ) : (
            <div className="max-w-md mx-auto py-16 text-center">
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-2">Álbum no encontrado</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">El álbum solicitado no existe o ha sido eliminado.</p>
              <button
                onClick={() => navigate({ name: 'albums' })}
                className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] rounded-lg cursor-pointer"
              >
                Volver a Álbumes
              </button>
            </div>
          )
        )}

        {/* Route: Album Editor (New or Edit) */}
        {(currentRoute.name === 'album-new' || currentRoute.name === 'album-edit') && (
          <AlbumEditorPage
            album={activeEditAlbum}
            songs={songs}
            onSave={handleSaveAlbum}
          />
        )}

        {/* Route: Albums Overview Gallery */}
        {currentRoute.name === 'albums' && (
          <AlbumsPage
            albums={albums}
            songs={songs}
            onSelectAlbum={(alb) => navigate({ name: 'album-detail', albumId: alb.id })}
            onEditAlbum={(alb) => navigate({ name: 'album-edit', albumId: alb.id })}
          />
        )}

        {/* Route: Song Detail Page */}
        {currentRoute.name === 'song-detail' && (
          activeDetailSong ? (
            <SongDetailPage
              song={activeDetailSong}
              albums={albums}
              onEdit={handleEditSong}
              onDownloadMd={handleDownloadMd}
              isAuthor={isAuthor}
              onSaveSong={handleSaveSong}
              onDeleteSong={handleOpenDelete}
              onViewHistory={handleViewHistory}
              onRenameFile={handleOpenRename}
            />
          ) : (
            <div className="max-w-md mx-auto py-16 text-center">
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-2">Canción no encontrada</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">El tema no existe o no está disponible.</p>
              <button
                onClick={() => navigate({ name: 'catalog' })}
                className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] rounded-lg cursor-pointer"
              >
                Volver al catálogo
              </button>
            </div>
          )
        )}

        {/* Route: Song Editor Page (New or Edit) */}
        {(currentRoute.name === 'song-new' || currentRoute.name === 'song-edit') && (
          <SongEditorPage
            song={activeEditSong}
            albums={albums}
            initialAlbumId={currentRoute.name === 'song-new' ? currentRoute.initialAlbumId : undefined}
            initialAudioFile={pendingAudioFile || undefined}
            onSave={handleSaveSong}
            onDelete={handleOpenDelete}
          />
        )}

        {/* Route: Songbook Page */}
        {currentRoute.name === 'songbook' && (
          <SongbookPage
            songs={songs}
            isAuthor={isAuthor}
          />
        )}

        {/* Route: Audio Analyzer Page */}
        {currentRoute.name === 'audio-analyzer' && (
          <AudioAnalyzerPage
            onCreateSongFromAudio={handleCreateSongFromAudio}
          />
        )}

        {/* Route: About Page */}
        {currentRoute.name === 'about' && (
          <AboutPage />
        )}

        {/* Route: Git Sync Page */}
        {currentRoute.name === 'git-sync' && (
          <GitSyncPage
            songs={songs}
            onSongsUpdated={handleSongsUpdated}
          />
        )}

        {/* Route: Spotify Import Page */}
        {currentRoute.name === 'spotify-import' && (
          <SpotifyImportPage
            songs={songs}
            onImport={handleImportSongs}
          />
        )}

        {/* Route: Default Main Catalog */}
        {currentRoute.name === 'catalog' && (
          <>
            {/* Split Hero Section */}
            <HeroSection
              songs={songs}
              albumCount={albums.length}
              onPlayFeatured={(song) => navigate({ name: 'song-detail', songId: song.id })}
              onOpenGitModal={() => {
                if (isAuthor) navigate({ name: 'git-sync' });
                else setIsAuthModalOpen(true);
              }}
              onExploreCatalog={() => {
                const el = document.getElementById('catalogo-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              onExploreAlbums={() => navigate({ name: 'albums' })}
              onOpenNewSong={() => {
                if (isAuthor) setIsQuickStartOpen(true);
                else setIsAuthModalOpen(true);
              }}
              isAuthor={isAuthor}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
                          onClick={() => navigate({ name: 'album-new' })}
                          className="px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nuevo Álbum</span>
                        </button>
                      )}
                      <button
                        onClick={() => navigate({ name: 'albums' })}
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
                        onSelect={(alb) => navigate({ name: 'album-detail', albumId: alb.id })}
                        onEdit={(alb) => navigate({ name: 'album-edit', albumId: alb.id })}
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
                    onClick={() => navigate({ name: 'songbook' })}
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
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
                          onSelect={(s) => navigate({ name: 'song-detail', songId: s.id })}
                          onEdit={(s) => handleEditSong(s)}
                          onDownloadMd={(s) => handleDownloadMd(s)}
                          isAuthor={isAuthor}
                          onViewHistory={handleViewHistory}
                          onSelectTag={setTagFilter}
                          onRenameFile={handleOpenRename}
                          onDelete={handleOpenDelete}
                          onOpenVisualizer={handleOpenVisualizer}
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
                          onSelect={(s) => navigate({ name: 'song-detail', songId: s.id })}
                          onEdit={(s) => handleEditSong(s)}
                          onDownloadMd={(s) => handleDownloadMd(s)}
                          isAuthor={isAuthor}
                          onViewHistory={handleViewHistory}
                          onSelectTag={setTagFilter}
                          onRenameFile={handleOpenRename}
                          onDelete={handleOpenDelete}
                          onOpenVisualizer={handleOpenVisualizer}
                        />
                      ))}
                    </div>
                  )}

                  {viewMode === 'compact' && (
                    <SongCompactView
                      songs={filteredSongs}
                      onSelect={(s) => navigate({ name: 'song-detail', songId: s.id })}
                      onEdit={(s) => handleEditSong(s)}
                      onDownloadMd={(s) => handleDownloadMd(s)}
                      isAuthor={isAuthor}
                      onViewHistory={handleViewHistory}
                      onRenameFile={handleOpenRename}
                      onDelete={handleOpenDelete}
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
                        onClick={() => navigate({ name: 'song-new' })}
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
        )}
      </main>

      {/* Editorial Footer */}
      <Footer
        isAuthor={isAuthor}
        onDashboardClick={() => handleNavSelect('dashboard')}
        onGitSyncClick={() => {
          if (isAuthor) navigate({ name: 'git-sync' });
          else setIsAuthModalOpen(true);
        }}
        onAuthClick={() => setIsAuthModalOpen(true)}
        onAboutClick={() => navigate({ name: 'about' })}
        onSongbookClick={() => navigate({ name: 'songbook' })}
      />

      {/* Confirmation & Auth Dialogs (Kept lightweight without blocking full-page navigation) */}
      {isAuthModalOpen && (
        <GitHubAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}

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

      {isDeleteModalOpen && deletingSong && (
        <DeleteSongModal
          song={deletingSong}
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeletingSong(null);
          }}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}

      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsOpen}
        onClose={() => setIsKeyboardShortcutsOpen(false)}
      />

      <SongwritingQuickStartModal
        isOpen={isQuickStartOpen}
        onClose={() => setIsQuickStartOpen(false)}
        onStartWithLyrics={handleStartWithLyrics}
        onStartWithAudioFile={handleStartWithAudioFile}
        onStartWithTemplate={handleStartWithTemplate}
      />

      <GitNotificationToast
        toast={gitToast}
        onDismiss={() => setGitToast(null)}
      />

      {isVisualizerModalOpen && visualizerSong && (
        <SongVideoVisualizerModal
          song={visualizerSong}
          allSongs={songs}
          onSelectOtherSong={(newSong) => setVisualizerSong(newSong)}
          onClose={() => {
            setIsVisualizerModalOpen(false);
            setVisualizerSong(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationProvider>
          <CancioneroApp />
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
