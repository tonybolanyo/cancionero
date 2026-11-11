import React, { useEffect, useCallback } from 'react';
import { Song, SavedAudioAnalysis } from './types/song';
import { ChordSegment } from './lib/audio/chords';
import { Album } from './types/album';
import { StorageService } from './services/storageService';
import { PushResult } from './services/githubSyncService';
import { SONGWRITING_TEMPLATES } from './utils/songwriterHelper';

// Contexts
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationProvider, useAppNavigation } from './context/NavigationContext';

// Hooks
import { useSongsManager } from './hooks/useSongsManager';
import { useAlbumsManager } from './hooks/useAlbumsManager';
import { useSongCatalog } from './hooks/useSongCatalog';
import { useAppModals } from './hooks/useAppModals';
import { useKeyboardShortcuts, GLOBAL_SHORTCUTS } from './hooks/useKeyboardShortcuts';

// Architectural Components
import { AppLayout } from './components/layout/AppLayout';
import { AppRouter } from './components/routing/AppRouter';
import { AppModals } from './components/modals/AppModals';

function CancioneroApp() {
  const { isAuthor, token, user } = useAuth();
  const { currentRoute, navigate } = useAppNavigation();
  const { toggleTheme } = useTheme();
  const { register, unregister } = useKeyboardShortcuts();

  // Modals management
  const modals = useAppModals();

  // Songs data management
  const songsManager = useSongsManager({
    token,
    userLogin: user?.login,
    isAuthor,
    onOpenAuthModal: modals.openAuthModal
  });

  // Albums data management
  const albumsManager = useAlbumsManager({
    isAuthor,
    onOpenAuthModal: modals.openAuthModal,
    onShowToast: modals.setGitToast
  });

  // Catalog search & filter state
  const catalog = useSongCatalog({
    songs: songsManager.songs,
    isAuthor,
    onNavigateToCatalog: () => {
      if (currentRoute.name !== 'catalog') {
        navigate({ name: 'catalog' });
      }
    },
    onOpenAuthModal: modals.openAuthModal
  });

  // Dynamic document title based on route
  useEffect(() => {
    if (currentRoute.name === 'song-detail') {
      const s = songsManager.songs.find(item => item.id === currentRoute.songId);
      if (s) {
        document.title = `${s.title} - Cancionero de versos perdidos`;
        return;
      }
    } else if (currentRoute.name === 'album-detail') {
      const a = albumsManager.albums.find(item => item.id === currentRoute.albumId);
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
  }, [currentRoute, songsManager.songs, albumsManager.albums]);

  // Visualizer trigger
  const handleOpenVisualizer = useCallback((targetSong?: Song) => {
    if (!isAuthor) {
      modals.openAuthModal();
      return;
    }
    const songToView =
      targetSong ||
      (currentRoute.name === 'song-detail' ? songsManager.songs.find(item => item.id === currentRoute.songId) : null) ||
      songsManager.songs[0] ||
      null;

    if (songToView) {
      modals.openVisualizer(songToView);
    }
  }, [isAuthor, currentRoute, songsManager.songs, modals]);

  // Auto-open visualizer when navigating to video-visualizer route
  useEffect(() => {
    if (currentRoute.name === 'video-visualizer') {
      if (!isAuthor) {
        modals.openAuthModal();
        navigate({ name: 'catalog' });
        return;
      }
      const targetSong = (currentRoute.songId ? songsManager.songs.find(s => s.id === currentRoute.songId) : null) || songsManager.songs[0] || null;
      if (targetSong) {
        modals.openVisualizer(targetSong);
      }
    }
  }, [currentRoute, songsManager.songs, isAuthor, modals, navigate]);

  // Global Keyboard Shortcuts registration
  useEffect(() => {
    register('new-song', {
      ...GLOBAL_SHORTCUTS.newSong,
      callback: () => {
        if (isAuthor) modals.openQuickStart();
        else modals.openAuthModal();
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
        if (isAuthor) navigate({ name: 'git-sync' });
        else modals.openAuthModal();
      },
      description: GLOBAL_SHORTCUTS.toggleGitSync.description,
    });

    register('show-shortcuts', {
      ...GLOBAL_SHORTCUTS.showKeyboardShortcuts,
      callback: modals.openKeyboardShortcuts,
      description: GLOBAL_SHORTCUTS.showKeyboardShortcuts.description,
    });

    register('close-modal', {
      ...GLOBAL_SHORTCUTS.closeModal,
      callback: modals.closeAllModals,
      description: GLOBAL_SHORTCUTS.closeModal.description,
    });

    return () => {
      unregister('new-song');
      unregister('toggle-theme');
      unregister('git-sync');
      unregister('show-shortcuts');
      unregister('close-modal');
    };
  }, [isAuthor, register, unregister, toggleTheme, navigate, modals]);

  // Quick Start Handlers
  const handleStartWithLyrics = useCallback(() => {
    if (!isAuthor) {
      modals.openAuthModal();
      return;
    }
    modals.setPendingAudioFile(null);
    modals.closeQuickStart();
    navigate({ name: 'song-new' });
  }, [isAuthor, modals, navigate]);

  const handleStartWithAudioFile = useCallback((file: File) => {
    if (!isAuthor) {
      modals.openAuthModal();
      return;
    }
    modals.setPendingAudioFile(file);
    modals.closeQuickStart();
    navigate({ name: 'song-new' });
  }, [isAuthor, modals, navigate]);

  const handleStartWithTemplate = useCallback((template: typeof SONGWRITING_TEMPLATES[0]) => {
    if (!isAuthor) {
      modals.openAuthModal();
      return;
    }
    modals.setPendingAudioFile(null);
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
    songsManager.setSongs(updated);
    modals.closeQuickStart();
    navigate({ name: 'song-edit', songId: newSong.id });
  }, [isAuthor, modals, navigate, songsManager]);

  // Audio Analyzer creation handler
  const handleCreateSongFromAudio = useCallback((data: {
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
    if (!isAuthor) {
      modals.openAuthModal();
      return;
    }
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
    songsManager.setSongs(updated);
    navigate({ name: 'song-edit', songId: detectedSong.id });
  }, [isAuthor, modals, navigate, songsManager]);

  // Rename & Delete callbacks
  const handleRenameSuccess = useCallback((renamedSong: Song, updatedSongs: Song[]) => {
    songsManager.setSongs(updatedSongs);
    songsManager.checkGitStatus();
    modals.closeRename();
    if (currentRoute.name === 'song-detail') {
      navigate({ name: 'song-detail', songId: renamedSong.id });
    }
  }, [songsManager, modals, currentRoute, navigate]);

  const handleDeleteSuccess = useCallback((deletedSong: Song, updatedSongs: Song[]) => {
    songsManager.setSongs(updatedSongs);
    songsManager.checkGitStatus();
    modals.closeDelete();
    if (currentRoute.name === 'song-detail' && currentRoute.songId === deletedSong.id) {
      navigate({ name: 'catalog' });
    }
  }, [songsManager, modals, currentRoute, navigate]);

  const handleSongRestored = useCallback((restoredSong: Song) => {
    const song = songsManager.handleSongRestored(restoredSong);
    modals.openHistory(song);
  }, [songsManager, modals]);

  // Active song for SEO meta tags
  const activeDetailSong =
    currentRoute.name === 'song-detail'
      ? songsManager.songs.find(s => s.id === currentRoute.songId) || null
      : null;

  return (
    <>
      <AppLayout
        activeSong={activeDetailSong}
        activeTab={catalog.activeNavTab}
        isAlbumsActive={
          currentRoute.name === 'albums' ||
          currentRoute.name === 'album-detail' ||
          currentRoute.name === 'album-new' ||
          currentRoute.name === 'album-edit'
        }
        hasUncommittedChanges={songsManager.hasUncommittedChanges}
        isAuthor={isAuthor}
        onOpenNewSong={() => {
          if (isAuthor) modals.openQuickStart();
          else modals.openAuthModal();
        }}
        onOpenNewAlbum={() => {
          if (isAuthor) navigate({ name: 'album-new' });
          else modals.openAuthModal();
        }}
        onOpenSpotifyImport={() => {
          if (isAuthor) navigate({ name: 'spotify-import' });
          else modals.openAuthModal();
        }}
        onOpenGitModal={() => {
          if (isAuthor) navigate({ name: 'git-sync' });
          else modals.openAuthModal();
        }}
        onSelectTab={catalog.handleNavSelect}
        onSelectAlbums={() => navigate({ name: 'albums' })}
        onOpenAbout={() => navigate({ name: 'about' })}
        onOpenAuthModal={modals.openAuthModal}
        onOpenAudioAnalyzer={isAuthor ? () => navigate({ name: 'audio-analyzer' }) : undefined}
        onOpenSongbook={() => navigate({ name: 'songbook' })}
        onOpenVideoVisualizer={isAuthor ? () => handleOpenVisualizer() : undefined}
      >
        <AppRouter
          currentRoute={currentRoute}
          songs={songsManager.songs}
          albums={albumsManager.albums}
          isAuthor={isAuthor}
          catalog={catalog}
          pendingAudioFile={modals.pendingAudioFile}
          onSaveSong={(song, pushResult) =>
            songsManager.handleSaveSong(
              song,
              pushResult,
              albumsManager.albums,
              albumsManager.setAlbums
            )
          }
          onDownloadMd={songsManager.handleDownloadMd}
          onSaveAlbum={(album) =>
            albumsManager.handleSaveAlbum(
              album,
              songsManager.songs,
              songsManager.setSongs
            )
          }
          onDeleteAlbum={(album) =>
            albumsManager.handleDeleteAlbum(album, () => navigate({ name: 'albums' }))
          }
          onCreateSongFromAudio={handleCreateSongFromAudio}
          onImportSongs={songsManager.handleImportSongs}
          onSongsUpdated={songsManager.handleSongsUpdated}
          onOpenEditSong={(song) => {
            if (!isAuthor) modals.openAuthModal();
            else navigate({ name: 'song-edit', songId: song.id });
          }}
          onOpenHistory={(song) => {
            if (!isAuthor) modals.openAuthModal();
            else modals.openHistory(song);
          }}
          onOpenRename={(song) => {
            if (!isAuthor) modals.openAuthModal();
            else modals.openRename(song);
          }}
          onOpenDelete={(song) => {
            if (!isAuthor) modals.openAuthModal();
            else modals.openDelete(song);
          }}
          onOpenVisualizer={handleOpenVisualizer}
          onOpenNewSong={() => {
            if (isAuthor) modals.openQuickStart();
            else modals.openAuthModal();
          }}
          onOpenAuthModal={modals.openAuthModal}
        />
      </AppLayout>

      <AppModals
        isAuthModalOpen={modals.isAuthModalOpen}
        onCloseAuthModal={modals.closeAuthModal}
        isHistoryModalOpen={modals.isHistoryModalOpen}
        historySong={modals.historySong}
        onCloseHistoryModal={modals.closeHistory}
        onSongRestored={handleSongRestored}
        isAuthor={isAuthor}
        isRenameModalOpen={modals.isRenameModalOpen}
        renamingSong={modals.renamingSong}
        onCloseRenameModal={modals.closeRename}
        onRenameSuccess={handleRenameSuccess}
        isDeleteModalOpen={modals.isDeleteModalOpen}
        deletingSong={modals.deletingSong}
        onCloseDeleteModal={modals.closeDelete}
        onDeleteSuccess={handleDeleteSuccess}
        isKeyboardShortcutsOpen={modals.isKeyboardShortcutsOpen}
        onCloseKeyboardShortcuts={modals.closeKeyboardShortcuts}
        isQuickStartOpen={modals.isQuickStartOpen}
        onCloseQuickStart={modals.closeQuickStart}
        onStartWithLyrics={handleStartWithLyrics}
        onStartWithAudioFile={handleStartWithAudioFile}
        onStartWithTemplate={handleStartWithTemplate}
        gitToast={modals.gitToast || songsManager.gitToast}
        onDismissGitToast={() => {
          modals.setGitToast(null);
          songsManager.setGitToast(null);
        }}
        isVisualizerModalOpen={modals.isVisualizerModalOpen}
        visualizerSong={modals.visualizerSong}
        songs={songsManager.songs}
        onSelectOtherSong={(newSong) => modals.setVisualizerSong(newSong)}
        onCloseVisualizer={modals.closeVisualizer}
      />
    </>
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
