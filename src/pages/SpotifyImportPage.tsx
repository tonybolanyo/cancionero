import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { SpotifyAlbumImportWorkspace } from '../components/SpotifyAlbumImportModal';
import { useAppNavigation } from '../context/NavigationContext';
import { useAuth } from '../context/AuthContext';
import { AuthorAccessGuard } from '../components/AuthorAccessGuard';
import { Song } from '../types/song';

interface SpotifyImportPageProps {
  songs: Song[];
  onImport: (songs: Song[]) => void;
  onOpenAuthModal?: () => void;
}

export const SpotifyImportPage: React.FC<SpotifyImportPageProps> = ({
  songs,
  onImport,
  onOpenAuthModal
}) => {
  const { goBack } = useAppNavigation();
  const { isAuthor } = useAuth();

  if (!isAuthor) {
    return (
      <AuthorAccessGuard
        title="Importación de Álbumes Reservada al Autor"
        description="La importación y creación de canciones en el catálogo desde discos de Spotify está reservada exclusivamente para el autor propietario."
        onOpenAuthModal={onOpenAuthModal}
      />
    );
  }

  return (
    <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => goBack({ name: 'catalog' })}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al catálogo</span>
        </button>
      </div>

      <SpotifyAlbumImportWorkspace
        onImport={onImport}
        onComplete={() => goBack({ name: 'catalog' })}
        onClose={() => goBack({ name: 'catalog' })}
        existingSongs={songs}
        mode="page"
      />
    </div>
  );
};
