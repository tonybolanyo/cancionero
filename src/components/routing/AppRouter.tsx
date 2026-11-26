import React, { Suspense, lazy } from 'react';
import { Song, SavedAudioAnalysis } from '../../types/song';
import { Album } from '../../types/album';
import { AppRoute, useAppNavigation } from '../../context/NavigationContext';
import { useSongCatalog } from '../../hooks/useSongCatalog';
import { ChordSegment } from '../../lib/audio/chords';
import { PushResult } from '../../services/githubSyncService';

// Primary landing view stays eager for instant First Contentful Paint
import { CatalogPage } from '../../pages/CatalogPage';
import { AuthorAccessGuard } from '../AuthorAccessGuard';

// Secondary routes split into async chunks via React.lazy
const AlbumsPage = lazy(() =>
  import('../../pages/AlbumsPage').then((m) => ({ default: m.AlbumsPage }))
);
const AlbumDetailPage = lazy(() =>
  import('../../pages/AlbumDetailPage').then((m) => ({ default: m.AlbumDetailPage }))
);
const AlbumEditorPage = lazy(() =>
  import('../../pages/AlbumEditorPage').then((m) => ({ default: m.AlbumEditorPage }))
);
const SongDetailPage = lazy(() =>
  import('../../pages/SongDetailPage').then((m) => ({ default: m.SongDetailPage }))
);
const SongEditorPage = lazy(() =>
  import('../../pages/SongEditorPage').then((m) => ({ default: m.SongEditorPage }))
);
const SongbookPage = lazy(() =>
  import('../../pages/SongbookPage').then((m) => ({ default: m.SongbookPage }))
);
const AudioAnalyzerPage = lazy(() =>
  import('../../pages/AudioAnalyzerPage').then((m) => ({ default: m.AudioAnalyzerPage }))
);
const AboutPage = lazy(() =>
  import('../../pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const GitSyncPage = lazy(() =>
  import('../../pages/GitSyncPage').then((m) => ({ default: m.GitSyncPage }))
);
const SpotifyImportPage = lazy(() =>
  import('../../pages/SpotifyImportPage').then((m) => ({ default: m.SpotifyImportPage }))
);
const VideoVisualizerPage = lazy(() =>
  import('../../pages/VideoVisualizerPage').then((m) => ({ default: m.VideoVisualizerPage }))
);
const ChordDictionaryDemoPage = lazy(() =>
  import('../../pages/ChordDictionaryDemoPage').then((m) => ({ default: m.ChordDictionaryDemoPage }))
);
const ScaleDictionaryPage = lazy(() =>
  import('../../pages/ScaleDictionaryPage').then((m) => ({ default: m.ScaleDictionaryPage }))
);

const RouteLoadingFallback: React.FC = () => (
  <div className="max-w-md mx-auto py-20 text-center space-y-3" role="status" aria-live="polite">
    <div className="w-7 h-7 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
    <p className="text-xs text-[var(--text-muted)] font-mono">Cargando módulo...</p>
  </div>
);

export interface AppRouterProps {
  currentRoute: AppRoute;
  songs: Song[];
  albums: Album[];
  isAuthor: boolean;
  isVerifyingSession?: boolean;
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
  isVerifyingSession = false,
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

  const isProtectedAuthorRoute =
    currentRoute.name === 'album-new' ||
    currentRoute.name === 'album-edit' ||
    currentRoute.name === 'song-new' ||
    currentRoute.name === 'song-edit' ||
    currentRoute.name === 'audio-analyzer' ||
    currentRoute.name === 'video-visualizer' ||
    currentRoute.name === 'git-sync' ||
    currentRoute.name === 'spotify-import';

  if (isVerifyingSession && isProtectedAuthorRoute && !isAuthor) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-3">
        <div className="w-7 h-7 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[var(--text-muted)] font-mono">Verificando sesión de autor...</p>
      </div>
    );
  }

  // Find active items for detail and edit views
  const activeDetailSong = currentRoute.name === 'song-detail' ? songs.find(s => s.id === currentRoute.songId) || null : null;
  const activeEditSong = currentRoute.name === 'song-edit' ? songs.find(s => s.id === currentRoute.songId) || null : null;
  const activeDetailAlbum = currentRoute.name === 'album-detail' ? albums.find(a => a.id === currentRoute.albumId) || null : null;
  const activeEditAlbum = currentRoute.name === 'album-edit' ? albums.find(a => a.id === currentRoute.albumId) || null : null;

  const renderRouteContent = () => {
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
            songs={songs}
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
        return isAuthor ? (
          <VideoVisualizerPage
            songs={songs}
            initialSongId={currentRoute.songId}
            onOpenAuthModal={onOpenAuthModal}
          />
        ) : (
          <AuthorAccessGuard
            title="Generador de Vídeo Protegido"
            description="La creación de vídeos para YouTube con letra sincronizada está reservada únicamente para el autor propietario."
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
            onOpenAuthModal={onOpenAuthModal}
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
            onOpenAuthModal={onOpenAuthModal}
          />
        ) : (
          <AuthorAccessGuard
            title="Importación de Spotify Protegida"
            description="La importación masiva de canciones desde Spotify está restringida al autor del catálogo."
            onOpenAuthModal={onOpenAuthModal}
          />
        );

      case 'scale-dictionary':
        return <ScaleDictionaryPage />;

      case 'chord-dictionary':
        return <ChordDictionaryDemoPage />;

      case 'catalog':
      default:
        return (
          <CatalogPage
            songs={songs}
            albums={albums}
            isAuthor={isAuthor}
            catalog={catalog}
            routeSection={currentRoute.name === 'catalog' ? currentRoute.section : undefined}
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

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      {renderRouteContent()}
    </Suspense>
  );
};
