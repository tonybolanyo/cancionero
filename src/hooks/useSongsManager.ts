import { useState, useEffect, useCallback } from 'react';
import { Song } from '../types/song';
import { Album } from '../types/album';
import { StorageService } from '../services/storageService';
import { GitHubSyncService, PushResult } from '../services/githubSyncService';
import { songToMarkdown } from '../utils/markdownParser';
import { ToastData } from '../components/GitNotificationToast';

export interface UseSongsManagerOptions {
  token: string | null;
  userLogin?: string;
  isAuthor: boolean;
  onOpenAuthModal?: () => void;
}

export function useSongsManager({
  token,
  userLogin,
  isAuthor,
  onOpenAuthModal
}: UseSongsManagerOptions) {
  const [songs, setSongs] = useState<Song[]>(() => StorageService.getSongs());
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState<boolean>(false);
  const [gitToast, setGitToast] = useState<ToastData | null>(null);

  const checkGitStatus = useCallback(() => {
    const status = StorageService.getGitStatus();
    setHasUncommittedChanges(!status.isClean);
  }, []);

  useEffect(() => {
    checkGitStatus();
  }, [checkGitStatus]);

  // Background catalog synchronization from remote
  useEffect(() => {
    let isMounted = true;
    let isSyncing = false;

    const syncCatalog = async () => {
      if (isSyncing) return;
      isSyncing = true;
      try {
        const result = await GitHubSyncService.syncCatalogFromRemote(
          token,
          GitHubSyncService.getRemoteConfig(userLogin)
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
  }, [token, userLogin, checkGitStatus]);

  const handleSongsUpdated = useCallback((updatedSongs: Song[]) => {
    setSongs(updatedSongs);
    checkGitStatus();
  }, [checkGitStatus]);

  const handleSaveSong = useCallback((
    song: Song,
    pushResult?: PushResult,
    albums?: Album[],
    onUpdateAlbums?: (newAlbums: Album[]) => void
  ) => {
    if (!isAuthor) {
      onOpenAuthModal?.();
      return;
    }
    const updated = StorageService.upsertSong(song);
    setSongs(updated);
    checkGitStatus();

    // If song was linked to an album, ensure album tracklist is synced
    if (song.albumId && albums && onUpdateAlbums) {
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
          onUpdateAlbums(newAlbums);
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
          onAction: () => onOpenAuthModal?.()
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
  }, [isAuthor, onOpenAuthModal, checkGitStatus]);

  const handleDownloadMd = useCallback((song: Song) => {
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
  }, []);

  const handleImportSongs = useCallback((importedSongs: Song[]) => {
    if (!isAuthor) {
      onOpenAuthModal?.();
      return;
    }
    setSongs(prev => {
      const merged = [...prev, ...importedSongs];
      return merged;
    });
    checkGitStatus();
  }, [isAuthor, onOpenAuthModal, checkGitStatus]);

  const handleSongRestored = useCallback((restoredSong: Song) => {
    const updated = StorageService.getSongs();
    setSongs(updated);
    checkGitStatus();
    return restoredSong;
  }, [checkGitStatus]);

  return {
    songs,
    setSongs,
    hasUncommittedChanges,
    checkGitStatus,
    gitToast,
    setGitToast,
    handleSongsUpdated,
    handleSaveSong,
    handleDownloadMd,
    handleImportSongs,
    handleSongRestored
  };
}
