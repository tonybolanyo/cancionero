import { useState, useCallback } from 'react';
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

  const handleDeleteAlbum = useCallback((
    album: Album,
    onNavigateAfterDelete?: () => void
  ) => {
    if (!isAuthor) {
      onOpenAuthModal?.();
      return;
    }
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`¿Estás seguro de que deseas eliminar el álbum "${album.title}"? Las canciones del catálogo no se borrarán.`);
      if (!ok) return;
    }

    const updated = StorageService.deleteAlbum(album.id);
    setAlbums(updated);
    onNavigateAfterDelete?.();

    onShowToast?.({
      id: `toast-${Date.now()}`,
      type: 'info',
      title: 'Álbum Eliminado',
      message: `El álbum "${album.title}" ha sido eliminado de la discografía.`
    });
  }, [isAuthor, onOpenAuthModal, onShowToast]);

  return {
    albums,
    setAlbums,
    handleSaveAlbum,
    handleDeleteAlbum
  };
}
