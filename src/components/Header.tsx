import React from 'react';
import { Music2, Plus, GitBranch, Sun, Moon, Lock, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { siteMetadata } from '../utils/siteConfig';

interface HeaderProps {
  onOpenNewSong: () => void;
  onOpenGitModal: () => void;
  onSelectTab: (tab: 'all' | 'published' | 'drafts' | 'private' | 'dashboard') => void;
  activeTab: 'all' | 'published' | 'drafts' | 'private' | 'dashboard';
  hasUncommittedChanges: boolean;
  onOpenAbout: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewSong,
  onOpenGitModal,
  onSelectTab,
  activeTab,
  hasUncommittedChanges,
  onOpenAbout,
  onOpenAuthModal
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthor, user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-header)] backdrop-blur-md border-b border-[var(--border-subtle)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single line, no pills) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
            <Music2 className="w-5 h-5" />
          </div>
          <button 
            onClick={() => onSelectTab('all')}
            className="text-left group cursor-pointer focus:outline-none"
          >
            <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors whitespace-nowrap block">
              {siteMetadata.name}
            </span>
          </button>
        </div>

        {/* Zone 2: Nav links (respects permissions: Author vs Public Visitor) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--text-secondary)]">
          <button
            onClick={() => onSelectTab('all')}
            className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
              activeTab === 'all'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Catálogo
          </button>
          <button
            onClick={() => onSelectTab('published')}
            className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
              activeTab === 'published'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Publicadas
          </button>

          {/* Protected author-only sections */}
          {isAuthor && (
            <>
              <button
                onClick={() => onSelectTab('drafts')}
                className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
                  activeTab === 'drafts'
                    ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Borradores
              </button>
              <button
                onClick={() => onSelectTab('private')}
                className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
                  activeTab === 'private'
                    ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Inéditas
              </button>
              <button
                onClick={onOpenGitModal}
                className="flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-[var(--text-primary)] text-[var(--text-secondary)] py-1 cursor-pointer"
                title="Archivos Markdown / JSON y Sincronización Git"
              >
                <GitBranch className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Sincronización Git</span>
                {hasUncommittedChanges && (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" title="Cambios sin commit" />
                )}
              </button>
            </>
          )}

          {/* Dashboard Nav link */}
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={onOpenAbout}
            className="whitespace-nowrap transition-colors hover:text-[var(--text-primary)] text-[var(--text-muted)] py-1 cursor-pointer"
          >
            Manifiesto
          </button>
        </nav>

        {/* Zone 3: Theme Toggle + Author Login / New Song */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Light / Dark Mode Toggle button */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="p-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-all cursor-pointer flex items-center justify-center"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-stone-700" />
            )}
          </button>

          {isAuthor ? (
            /* Authenticated Author Controls */
            <div className="flex items-center gap-2.5">
              <button
                onClick={onOpenNewSong}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold tracking-wide text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg active:scale-95 transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Canción</span>
              </button>

              {/* Author badge / User avatar button */}
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--accent-border)] hover:border-[var(--accent-primary)] transition-all cursor-pointer text-xs"
                title={`Sesión iniciada como @${user?.login || 'autor'} (clic para ver o cerrar sesión)`}
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.login}
                    className="w-5 h-5 rounded-full object-cover border border-[var(--accent-primary)]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                )}
                <span className="font-mono text-[var(--text-primary)] font-semibold hidden sm:inline">
                  @{user?.login || 'autor'}
                </span>
              </button>
            </div>
          ) : (
            /* Public Visitor: Discrete Author Access */
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title="Acceso para el autor (Tony) mediante GitHub"
            >
              <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Acceso Autor</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
