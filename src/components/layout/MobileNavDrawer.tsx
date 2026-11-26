import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Music2,
  Music,
  Disc3,
  Globe,
  FileEdit,
  EyeOff,
  Plus,
  FolderPlus,
  GitBranch,
  BarChart3,
  Wand2,
  Youtube,
  BookOpen,
  Guitar,
  Compass,
  Feather,
  Sun,
  Moon,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { NavItemDescriptor } from './navigationModel';
import { siteMetadata } from '../../utils/siteConfig';

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
  isAuthor: boolean;
  userLogin?: string;
  userAvatarUrl?: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  primaryItems: NavItemDescriptor[];
  studioItems: NavItemDescriptor[];
  resourceItems: NavItemDescriptor[];
  onSelectItem: (itemId: string) => void;
  onOpenAuthModal: () => void;
}

const ITEM_ICONS: Record<string, React.ReactNode> = {
  'tab-all': <Music className="w-4 h-4 shrink-0" />,
  albums: <Disc3 className="w-4 h-4 shrink-0" />,
  'tab-published': <Globe className="w-4 h-4 shrink-0" />,
  'tab-drafts': <FileEdit className="w-4 h-4 shrink-0" />,
  'tab-private': <EyeOff className="w-4 h-4 shrink-0" />,
  'new-song': <Plus className="w-4 h-4 shrink-0" />,
  'new-album': <FolderPlus className="w-4 h-4 shrink-0" />,
  'git-sync': <GitBranch className="w-4 h-4 shrink-0" />,
  'tab-dashboard': <BarChart3 className="w-4 h-4 shrink-0" />,
  'audio-analyzer': <Wand2 className="w-4 h-4 shrink-0" />,
  'spotify-import': <Music2 className="w-4 h-4 shrink-0" />,
  'video-visualizer': <Youtube className="w-4 h-4 shrink-0" />,
  songbook: <BookOpen className="w-4 h-4 shrink-0" />,
  'chord-dictionary': <Guitar className="w-4 h-4 shrink-0" />,
  'scale-dictionary': <Compass className="w-4 h-4 shrink-0" />,
  about: <Feather className="w-4 h-4 shrink-0" />
};

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  returnFocusRef,
  isAuthor,
  userLogin,
  userAvatarUrl,
  theme,
  onToggleTheme,
  primaryItems,
  studioItems,
  resourceItems,
  onSelectItem,
  onOpenAuthModal
}) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus close button on open
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 10);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      returnFocusRef?.current?.focus();
    };
  }, [isOpen, onClose, returnFocusRef]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const handleAction = (id: string) => {
    onClose();
    onSelectItem(id);
  };

  const renderSection = (title: string, items: NavItemDescriptor[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className="px-3 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </p>
        <div className="space-y-1">
          {items.map((item) => {
            const isPrimaryTone = item.tone === 'primary';
            const isDangerTone = item.tone === 'danger';

            let buttonStyle =
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]';

            if (item.isActive) {
              buttonStyle =
                'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold';
            } else if (isPrimaryTone) {
              buttonStyle =
                'bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold shadow-xs';
            } else if (isDangerTone) {
              buttonStyle =
                'bg-red-600/10 text-red-600 dark:text-red-400 hover:bg-red-600/20 border border-red-500/25 font-medium';
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAction(item.id)}
                aria-current={item.isActive ? 'page' : undefined}
                className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-sm transition-colors cursor-pointer text-left ${buttonStyle}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  {ITEM_ICONS[item.id] || <Music className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </span>

                {(item.hasDot || item.badgeText) && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    {item.badgeText && (
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                        {item.badgeText}
                      </span>
                    )}
                    {item.hasDot && (
                      <span
                        className="w-2 h-2 rounded-full bg-[var(--accent-primary)]"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-drawer-title"
        className="relative z-10 w-[86vw] max-w-sm h-full bg-[var(--bg-modal)] border-r border-[var(--border-subtle)] shadow-[var(--shadow-xl)] flex flex-col overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="px-4 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Music2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="mobile-drawer-title"
                className="font-serif text-base font-bold text-[var(--text-primary)] truncate"
              >
                {siteMetadata.name}
              </h2>
              <p className="text-[11px] font-mono text-[var(--text-muted)]">
                {isAuthor ? 'Modo Autor' : 'Modo Lector'}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú de navegación"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <nav
          aria-label="Navegación móvil"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
        >
          {renderSection('Catálogo', primaryItems)}
          {isAuthor && renderSection('Estudio y Publicación', studioItems)}
          {renderSection('Recursos y Utilidades', resourceItems)}
        </nav>

        {/* Drawer Footer: Theme + Auth */}
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] space-y-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] flex items-center justify-between text-sm text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-stone-700" />
              )}
              <span>{theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAuthModal();
            }}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] flex items-center justify-between text-sm text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            {isAuthor ? (
              <span className="flex items-center gap-2.5 min-w-0">
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userLogin || 'autor'}
                    className="w-5 h-5 rounded-full object-cover border border-[var(--accent-primary)] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                )}
                <span className="font-mono font-semibold truncate">
                  @{userLogin || 'autor'}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Acceso Autor</span>
              </span>
            )}
            <span className="text-xs text-[var(--text-muted)]">
              {isAuthor ? 'Gestionar' : 'Entrar'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
