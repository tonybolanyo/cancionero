import React, { useMemo } from 'react';
import { ArrowLeft, Youtube } from 'lucide-react';
import { Song } from '../types/song';
import { SongVideoVisualizerWorkspace } from '../components/SongVideoVisualizerModal';
import { useAppNavigation } from '../context/NavigationContext';
import { useAuth } from '../context/AuthContext';
import { AuthorAccessGuard } from '../components/AuthorAccessGuard';

export interface VideoVisualizerPageProps {
  songs: Song[];
  initialSongId?: string;
  onOpenAuthModal?: () => void;
}

export const VideoVisualizerPage: React.FC<VideoVisualizerPageProps> = ({
  songs,
  initialSongId,
  onOpenAuthModal
}) => {
  const { goBack, navigate } = useAppNavigation();
  const { isAuthor } = useAuth();

  const activeSong = useMemo(() => {
    if (songs.length === 0) return null;
    if (initialSongId) {
      const matched = songs.find((s) => s.id === initialSongId);
      if (matched) return matched;
    }
    return songs[0];
  }, [songs, initialSongId]);

  if (!isAuthor) {
    return (
      <AuthorAccessGuard
        title="Generador de Vídeo Protegido"
        description="La creación de vídeos para YouTube con letra sincronizada está reservada únicamente para el autor propietario."
        onOpenAuthModal={onOpenAuthModal}
      />
    );
  }

  return (
    <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => goBack({ name: 'catalog' })}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al catálogo</span>
        </button>
      </div>

      {activeSong ? (
        <SongVideoVisualizerWorkspace
          song={activeSong}
          allSongs={songs}
          onSelectOtherSong={(targetSong) =>
            navigate({ name: 'video-visualizer', songId: targetSong.id })
          }
          mode="page"
        />
      ) : (
        <div className="max-w-lg mx-auto py-16 px-6 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
            <Youtube className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-xl font-bold text-[var(--text-primary)]">
            No hay canciones disponibles
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Añade al menos una canción al repertorio para poder generar un vídeo sincronizado para YouTube.
          </p>
          <button
            onClick={() => navigate({ name: 'catalog' })}
            className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
          >
            Ir al catálogo
          </button>
        </div>
      )}
    </div>
  );
};
