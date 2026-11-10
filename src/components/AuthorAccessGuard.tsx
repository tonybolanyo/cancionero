import React from 'react';
import { ShieldAlert, Lock, ArrowLeft, KeyRound } from 'lucide-react';
import { useAppNavigation } from '../context/NavigationContext';
import { AUTHORIZED_GITHUB_USER, AUTHORIZED_AUTHOR_EMAIL } from '../utils/authConfig';

interface AuthorAccessGuardProps {
  title?: string;
  description?: string;
  onOpenAuthModal?: () => void;
}

export const AuthorAccessGuard: React.FC<AuthorAccessGuardProps> = ({
  title = 'Sección Exclusiva del Autor',
  description = 'Esta sección de edición, creación, análisis acústico o gestión del cancionero está estrictamente restringida al autor propietario.',
  onOpenAuthModal
}) => {
  const { navigate } = useAppNavigation();

  return (
    <div className="max-w-2xl mx-auto my-12 px-4 animate-fade-in">
      <div className="p-8 sm:p-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] text-xs font-mono font-medium mb-3">
          <Lock className="w-3.5 h-3.5" />
          <span>Acceso Restringido</span>
        </div>

        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3">
          {title}
        </h2>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 max-w-lg mx-auto">
          {description}
        </p>

        <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] max-w-md mx-auto mb-8 text-left space-y-1.5">
          <div className="font-semibold text-[var(--text-primary)] mb-1">
            Políticas de seguridad aplicadas:
          </div>
          <div>
            • Usuario de GitHub autorizado: <span className="font-mono font-semibold text-[var(--text-primary)]">@{AUTHORIZED_GITHUB_USER}</span>
          </div>
          <div>
            • Correo propietario autorizado: <span className="font-mono font-semibold text-[var(--text-primary)]">{AUTHORIZED_AUTHOR_EMAIL}</span>
          </div>
          <div>
            • Las operaciones de creación, edición, borrado, análisis de audio, acordes y vídeos requieren verificación criptográfica de identidad.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <KeyRound className="w-4 h-4" />
              <span>Identificarse como Autor</span>
            </button>
          )}

          <button
            onClick={() => navigate({ name: 'catalog' })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Catálogo Público</span>
          </button>
        </div>
      </div>
    </div>
  );
};
