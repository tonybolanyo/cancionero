import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { GitSyncModal } from '../components/GitSyncModal';
import { useAppNavigation } from '../context/NavigationContext';
import { useAuth } from '../context/AuthContext';
import { AuthorAccessGuard } from '../components/AuthorAccessGuard';
import { Song } from '../types/song';

interface GitSyncPageProps {
  songs: Song[];
  onSongsUpdated: (songs: Song[]) => void;
}

export const GitSyncPage: React.FC<GitSyncPageProps> = ({
  songs,
  onSongsUpdated
}) => {
  const { goBack } = useAppNavigation();
  const { isAuthor } = useAuth();

  if (!isAuthor) {
    return (
      <AuthorAccessGuard
        title="Sincronización Git Reservada al Autor"
        description="La gestión de commits, copias de seguridad, restauración y sincronización con el repositorio remoto de GitHub está reservada exclusivamente para el autor propietario."
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

      <GitSyncModal
        isOpen={true}
        onClose={() => goBack({ name: 'catalog' })}
        songs={songs}
        onSongsUpdated={onSongsUpdated}
      />
    </div>
  );
};
