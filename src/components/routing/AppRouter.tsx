import React from 'react';
import { Song, SavedAudioAnalysis } from '../../types/song';
import { Album } from '../../types/album';
import { AppRoute, useAppNavigation } from '../../context/NavigationContext';
import { useSongCatalog } from '../../hooks/useSongCatalog';
import { ChordSegment } from '../../lib/audio/chords';
import { PushResult } from '../../services/githubSyncService';

// Pages
import { CatalogPage } from '../../pages/CatalogPage';
import { AlbumsPage } from '../../pages/AlbumsPage';
import { AlbumDetailPage } from '../../pages/AlbumDetailPage';
import { AlbumEditorPage } from '../../pages/AlbumEditorPage';
import { SongDetailPage } from '../../pages/SongDetailPage';
import { SongEditorPage } from '../../pages/SongEditorPage';
import { SongbookPage } from '../../pages/SongbookPage';
import { AudioAnalyzerPage } from '../../pages/AudioAnalyzerPage';
import { AboutPage } from '../../pages/AboutPage';
import { GitSyncPage } from '../../pages/GitSyncPage';
import { SpotifyImportPage } from '../../pages/SpotifyImportPage';
import { AuthorAccessGuard } from '../AuthorAccessGuard';

export interface AppRouterProps {
  currentRoute: AppRoute;
  songs: Song[];
  albums: Album[];
  isAuthor: boolean;
  catalog: ReturnType<typeof useSongCatalog>;
  pendingAudioFile: File | null;
  onSaveSong: (song: Song, pushResult?: PushResult) => void;
  onDownloadMd: (song: Song) => void;
  onSaveAlbum: (album: Album) => void;
  onDeleteAlbum: (album: Album) => void;
  onCreateSongFromAudio: (data: {
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
  }) => void;
  onImportSongs: (importedSongs: Song[]) => void;
  onSongsUpdated: (songs: Song[]) => void;
  onOpenEditSong: (song: Song) => void;
  onOpenHistory: (song: Song) => void;
  onOpenRename: (song: Song) => void;
  onOpenDelete: (song: Song) => void;
  onOpenVisualizer: (song?: Song) => void;
  onOpenNewSong: () => void;
  onOpenAuthModal: () => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({
  currentRoute,
  songs,
  albums,
  isAuthor,
  catalog,
  pendingAudioFile,
  onSaveSong,
  onDownloadMd,
  onSaveAlbum,
  onDeleteAlbum,
  onCreateSongFromAudio,
  onImportSongs,
  onSongsUpdated,
  onOpenEditSong,
  onOpenHistory,
  onOpenRename,
  onOpenDelete,
  onOpenVisualizer,
  onOpenNewSong,
  onOpenAuthModal
}) => {
  const { navigate } = useAppNavigation();

  // Find active items for detail and edit views
  const activeDetailSong = currentRoute.name === 'song-detail' ? songs.find(s => s.id === currentRoute.songId) || null : null;
  const activeEditSong = currentRoute.name === 'song-edit' ? songs.find(s => s.id === currentRoute.songId) || null : null;
  const activeDetailAlbum = currentRoute.name === 'album-detail' ? albums.find(a => a.id === currentRoute.albumId) || null : null;
  const activeEditAlbum = currentRoute.name === 'album-edit' ? albums.find(a => a.id === currentRoute.albumId) || null : null;

  switch (currentRoute.name) {
    case 'album-detail':
      return activeDetailAlbum ? (
        <AlbumDetailPage
          album={activeDetailAlbum}
          songs={songs}
          onEditAlbum={(alb) => navigate({ name: 'album-edit', albumId: alb.id })}
          onDeleteAlbum={onDeleteAlbum}
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
      );

    case 'album-new':
    case 'album-edit':
      return isAuthor ? (
        <AlbumEditorPage
          album={activeEditAlbum}
          songs={songs}
          onSave={onSaveAlbum}
        />
      ) : (
        <AuthorAccessGuard
          title="Editor de Álbumes Protegido"
          description="Solo el autor propietario tiene acceso a la creación y edición de álbumes discográficos."
          onOpenAuthModal={onOpenAuthModal}
        />
      );

    case 'albums':
      return (
        <AlbumsPage
          albums={albums}
          songs={songs}
          onSelectAlbum={(alb) => navigate({ name: 'album-detail', albumId: alb.id })}
          onEditAlbum={(alb) => navigate({ name: 'album-edit', albumId: alb.id })}
        />
      );

    case 'song-detail':
      return activeDetailSong ? (
        <SongDetailPage
          song={activeDetailSong}
          albums={albums}
          onEdit={onOpenEditSong}
          onDownloadMd={onDownloadMd}
          isAuthor={isAuthor}
          onSaveSong={onSaveSong}
          onDeleteSong={onOpenDelete}
          onViewHistory={onOpenHistory}
          onRenameFile={onOpenRename}
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
      );

    case 'song-new':
    case 'song-edit':
      return isAuthor ? (
        <SongEditorPage
          song={activeEditSong}
          albums={albums}
          initialAlbumId={currentRoute.name === 'song-new' ? currentRoute.initialAlbumId : undefined}
          initialAudioFile={pendingAudioFile || undefined}
          onSave={onSaveSong}
          onDelete={onOpenDelete}
        />
      ) : (
        <AuthorAccessGuard
          title="Editor de Canciones Protegido"
          description="Solo el autor propietario puede redactar versos, transcribir acordes o modificar la biblioteca lírica."
          onOpenAuthModal={onOpenAuthModal}
        />
      );

    case 'songbook':
      return (
        <SongbookPage
          songs={songs}
          isAuthor={isAuthor}
        />
      );

    case 'audio-analyzer':
      return isAuthor ? (
        <AudioAnalyzerPage
          onCreateSongFromAudio={onCreateSongFromAudio}
        />
      ) : (
        <AuthorAccessGuard
          title="Analizador de Audio Protegido"
          description="El análisis acústico y extracción armónica de pistas de audio está restringido al autor de la obra."
          onOpenAuthModal={onOpenAuthModal}
        />
      );

    case 'video-visualizer':
      return !isAuthor ? (
        <AuthorAccessGuard
          title="Generador de Vídeo Protegido"
          description="La creación de vídeos para YouTube con letra sincronizada está reservada únicamente para el autor propietario."
          onOpenAuthModal={onOpenAuthModal}
        />
      ) : (
        <CatalogPage
          songs={songs}
          albums={albums}
          isAuthor={isAuthor}
          catalog={catalog}
          onSelectSong={(s) => navigate({ name: 'song-detail', songId: s.id })}
          onEditSong={onOpenEditSong}
          onDownloadMd={onDownloadMd}
          onViewHistory={onOpenHistory}
          onRenameSong={onOpenRename}
          onDeleteSong={onOpenDelete}
          onOpenVisualizer={onOpenVisualizer}
          onOpenNewSong={onOpenNewSong}
          onOpenNewAlbum={() => navigate({ name: 'album-new' })}
          onSelectAlbum={(alb) => navigate({ name: 'album-detail', albumId: alb.id })}
          onEditAlbum={(alb) => navigate({ name: 'album-edit', albumId: alb.id })}
          onExploreAlbums={() => navigate({ name: 'albums' })}
          onOpenGitSync={() => navigate({ name: 'git-sync' })}
          onOpenSongbook={() => navigate({ name: 'songbook' })}
          onOpenAuthModal={onOpenAuthModal}
        />
      );

    case 'about':
      return <AboutPage />;

    case 'git-sync':
      return isAuthor ? (
        <GitSyncPage
          songs={songs}
          onSongsUpdated={onSongsUpdated}
        />
      ) : (
        <AuthorAccessGuard
          title="Sincronización Git Protegida"
          description="El repositorio Git y la gestión de versiones en GitHub son accesibles exclusivamente para el autor propietario."
          onOpenAuthModal={onOpenAuthModal}
        />
      );

    case 'spotify-import':
      return isAuthor ? (
        <SpotifyImportPage
          songs={songs}
          onImport={onImportSongs}
        />
      ) : (
        <AuthorAccessGuard
          title="Importación de Spotify Protegida"
          description="La importación masiva de canciones desde Spotify está restringida al autor del catálogo."
          onOpenAuthModal={onOpenAuthModal}
        />
      );

    case 'catalog':
    default:
      return (
        <CatalogPage
          songs={songs}
          albums={albums}
          isAuthor={isAuthor}
          catalog={catalog}
          onSelectSong={(s) => navigate({ name: 'song-detail', songId: s.id })}
          onEditSong={onOpenEditSong}
          onDownloadMd={onDownloadMd}
          onViewHistory={onOpenHistory}
          onRenameSong={onOpenRename}
          onDeleteSong={onOpenDelete}
          onOpenVisualizer={onOpenVisualizer}
          onOpenNewSong={onOpenNewSong}
          onOpenNewAlbum={() => navigate({ name: 'album-new' })}
          onSelectAlbum={(alb) => navigate({ name: 'album-detail', albumId: alb.id })}
          onEditAlbum={(alb) => navigate({ name: 'album-edit', albumId: alb.id })}
          onExploreAlbums={() => navigate({ name: 'albums' })}
          onOpenGitSync={() => {
            if (isAuthor) navigate({ name: 'git-sync' });
            else onOpenAuthModal();
          }}
          onOpenSongbook={() => navigate({ name: 'songbook' })}
          onOpenAuthModal={onOpenAuthModal}
        />
      );
  }
};
