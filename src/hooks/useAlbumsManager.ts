import { useState, useCallback, useEffect } from 'react';
import { Album } from '../types/album';
import { Song } from '../types/song';
import { StorageService } from '../services/storageService';
import { ToastData } from '../components/GitNotificationToast';

export interface UseAlbumsManagerOptions {
  isAuthor: boolean;
  onOpenAuthModal?: () => void;
  onShowToast?: (toast: ToastData) => void;
}

export function useAlbumsManager({
  isAuthor,
  onOpenAuthModal,
  onShowToast
}: UseAlbumsManagerOptions) {
  const [albums, setAlbums] = useState<Album[]>(() => StorageService.getAlbums());

  useEffect(() => {
    let isMounted = true;
    StorageService.init()
      .then(() => {
        if (isMounted) {
          setAlbums(StorageService.getAlbums());
        }
      })
      .catch(err => {
        console.warn('Failed to hydrate albums from IndexedDB:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveAlbum = useCallback((
    album: Album,
    songs?: Song[],
    onUpdateSongs?: (newSongs: Song[]) => void
  ) => {
    if (!isAuthor) {
      onOpenAuthModal?.();
      return;
    }
    const updated = StorageService.upsertAlbum(album);
    setAlbums(updated);

    // Sync album title/id on matching songs
    if (album.tracks && album.tracks.length > 0 && songs && onUpdateSongs) {
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
        onUpdateSongs(currentSongs);
      }
    }

    onShowToast?.({
      id: `toast-${Date.now()}`,
      type: 'success',
      title: 'Álbum Guardado',
      message: `El álbum "${album.title}" ha sido guardado en la discografía.`
    });
  }, [isAuthor, onOpenAuthModal, onShowToast]);

  const [pendingDeleteAlbum, setPendingDeleteAlbum] = useState<{
    album: Album;
    onNavigateAfterDelete?: () => void;
  } | null>(null);

  const handleDeleteAlbum = useCallback((
    album: Album,
    onNavigateAfterDelete?: () => void
  ) => {
    if (!isAuthor) {
      onOpenAuthModal?.();
      return;
    }
    setPendingDeleteAlbum({ album, onNavigateAfterDelete });
  }, [isAuthor, onOpenAuthModal]);

  const cancelDeleteAlbum = useCallback(() => {
    setPendingDeleteAlbum(null);
  }, []);

  const confirmDeleteAlbum = useCallback(() => {
    if (!pendingDeleteAlbum) return;
    const { album, onNavigateAfterDelete } = pendingDeleteAlbum;
    setPendingDeleteAlbum(null);

    const updated = StorageService.deleteAlbum(album.id);
    setAlbums(updated);
    onNavigateAfterDelete?.();

    onShowToast?.({
      id: `toast-${Date.now()}`,
      type: 'info',
      title: 'Álbum Eliminado',
      message: `El álbum "${album.title}" ha sido eliminado de la discografía.`
    });
  }, [pendingDeleteAlbum, onShowToast]);

  return {
    albums,
    setAlbums,
    handleSaveAlbum,
    handleDeleteAlbum,
    pendingDeleteAlbum,
    confirmDeleteAlbum,
    cancelDeleteAlbum
  };
}
