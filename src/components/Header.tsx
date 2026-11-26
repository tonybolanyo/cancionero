import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Music2,
  Plus,
  GitBranch,
  Sun,
  Moon,
  Lock,
  ShieldCheck,
  Wand2,
  Music,
  BookOpen,
  Youtube,
  Menu,
  ChevronDown,
  Wrench,
  BarChart3,
  FolderPlus,
  Guitar,
  Compass,
  Feather
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { siteMetadata } from '../utils/siteConfig';
import { NavTab } from '../hooks/useSongCatalog';
import { AppRoute } from '../context/NavigationContext';
import { MobileNavDrawer } from './layout/MobileNavDrawer';
import {
  getPrimaryNavItems,
  getAuthorStudioItems,
  getResourceItems
} from './layout/navigationModel';

export interface HeaderProps {
  onOpenNewSong: () => void;
  onOpenNewAlbum?: () => void;
  onOpenSpotifyImport: () => void;
  onOpenGitModal: () => void;
  onOpenAudioAnalyzer?: () => void;
  onSelectTab: (tab: NavTab) => void;
  onSelectAlbums?: () => void;
  activeTab: NavTab;
  isAlbumsActive?: boolean;
  activeRouteName?: AppRoute['name'];
  hasUncommittedChanges: boolean;
  onOpenAbout: () => void;
  onOpenAuthModal: () => void;
  onOpenSongbook?: () => void;
  onOpenVideoVisualizer?: () => void;
  onOpenScaleDictionary?: () => void;
  onOpenChordDictionary?: () => void;
}

type DesktopDropdown = 'resources' | 'tools' | null;

export const Header: React.FC<HeaderProps> = ({
  onOpenNewSong,
  onOpenNewAlbum,
  onOpenSpotifyImport,
  onOpenGitModal,
  onOpenAudioAnalyzer,
  onSelectTab,
  onSelectAlbums,
  activeTab,
  isAlbumsActive = false,
  activeRouteName,
  hasUncommittedChanges,
  onOpenAbout,
  onOpenAuthModal,
  onOpenSongbook,
  onOpenVideoVisualizer,
  onOpenScaleDictionary,
  onOpenChordDictionary
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthor, user } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DesktopDropdown>(null);

  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const toolsDropdownRef = useRef<HTMLDivElement | null>(null);
  const resourcesDropdownRef = useRef<HTMLDivElement | null>(null);
  const resourcesNavDropdownRef = useRef<HTMLDivElement | null>(null);
  const toolsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resourcesTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Close desktop dropdown on outside click or Escape
  useEffect(() => {
    if (!openDropdown) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTools = toolsDropdownRef.current?.contains(target);
      const inResources =
        resourcesDropdownRef.current?.contains(target) ||
        resourcesNavDropdownRef.current?.contains(target);
      if (!inTools && !inResources) {
        setOpenDropdown(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        const prev = openDropdown;
        setOpenDropdown(null);
        if (prev === 'tools') {
          toolsTriggerRef.current?.focus();
        } else if (prev === 'resources') {
          resourcesTriggerRef.current?.focus();
        }
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDropdown]);

  // Close dropdowns when opening mobile drawer or switching role
  useEffect(() => {
    setOpenDropdown(null);
  }, [isAuthor, isMobileMenuOpen]);

  const navModel = useMemo(
    () => ({
      isAuthor,
      activeTab,
      isAlbumsActive,
      activeRouteName,
      hasUncommittedChanges,
      hasNewAlbum: Boolean(onOpenNewAlbum),
      hasAudioAnalyzer: Boolean(onOpenAudioAnalyzer),
      hasVideoVisualizer: Boolean(onOpenVideoVisualizer),
      hasSongbook: Boolean(onOpenSongbook),
      hasChordDictionary: Boolean(onOpenChordDictionary),
      hasScaleDictionary: Boolean(onOpenScaleDictionary)
    }),
    [
      isAuthor,
      activeTab,
      isAlbumsActive,
      activeRouteName,
      hasUncommittedChanges,
      onOpenNewAlbum,
      onOpenAudioAnalyzer,
      onOpenVideoVisualizer,
      onOpenSongbook,
      onOpenChordDictionary,
      onOpenScaleDictionary
    ]
  );

  const primaryItems = useMemo(() => getPrimaryNavItems(navModel), [navModel]);
  const studioItems = useMemo(() => getAuthorStudioItems(navModel), [navModel]);
  const resourceItems = useMemo(() => getResourceItems(navModel), [navModel]);

  const handleDispatchAction = useCallback(
    (itemId: string) => {
      setOpenDropdown(null);
      switch (itemId) {
        case 'tab-all':
          onSelectTab('all');
          break;
        case 'tab-published':
          onSelectTab('published');
          break;
        case 'tab-drafts':
          onSelectTab('drafts');
          break;
        case 'tab-private':
          onSelectTab('private');
          break;
        case 'tab-dashboard':
          onSelectTab('dashboard');
          break;
        case 'albums':
          onSelectAlbums?.();
          break;
        case 'new-song':
          onOpenNewSong();
          break;
        case 'new-album':
          onOpenNewAlbum?.();
          break;
        case 'git-sync':
          onOpenGitModal();
          break;
        case 'audio-analyzer':
          onOpenAudioAnalyzer?.();
          break;
        case 'spotify-import':
          onOpenSpotifyImport();
          break;
        case 'video-visualizer':
          onOpenVideoVisualizer?.();
          break;
        case 'songbook':
          onOpenSongbook?.();
          break;
        case 'chord-dictionary':
          onOpenChordDictionary?.();
          break;
        case 'scale-dictionary':
          onOpenScaleDictionary?.();
          break;
        case 'about':
          onOpenAbout();
          break;
      }
    },
    [
      onSelectTab,
      onSelectAlbums,
      onOpenNewSong,
      onOpenNewAlbum,
      onOpenGitModal,
      onOpenAudioAnalyzer,
      onOpenSpotifyImport,
      onOpenVideoVisualizer,
      onOpenSongbook,
      onOpenChordDictionary,
      onOpenScaleDictionary,
      onOpenAbout
    ]
  );

  const hasActiveResource = resourceItems.some((item) => item.isActive);
  const authorToolDropdownItems = useMemo(
    () => studioItems.filter((item) => item.id !== 'new-song'),
    [studioItems]
  );
  const hasActiveAuthorTool = authorToolDropdownItems.some((item) => item.isActive);

  const renderDropdownIcon = (id: string) => {
    switch (id) {
      case 'git-sync':
        return <GitBranch className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      case 'tab-dashboard':
        return <BarChart3 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      case 'new-album':
        return <FolderPlus className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      case 'audio-analyzer':
        return <Wand2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      case 'spotify-import':
        return <Music className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      case 'video-visualizer':
        return <Youtube className="w-4 h-4 text-red-500 shrink-0" />;
      case 'songbook':
        return <BookOpen className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      case 'chord-dictionary':
        return <Guitar className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      case 'scale-dictionary':
        return <Compass className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      case 'about':
        return <Feather className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
      default:
        return <Music2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[var(--bg-header)] backdrop-blur-md border-b border-[var(--border-subtle)] transition-colors duration-200">
        <div className="max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3200px] w-full mx-auto px-3 sm:px-6 lg:px-8 xl:px-12 h-18 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
          {/* Zone 1: Mobile Hamburger + Brand wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <button
              ref={mobileTriggerRef}
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="md:hidden relative min-h-[42px] min-w-[42px] rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] flex items-center justify-center text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
              {isAuthor && hasUncommittedChanges && (
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent-primary)]"
                  title="Cambios sin commit en Git"
                />
              )}
            </button>

            <div className="hidden sm:flex w-9 h-9 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Music2 className="w-5 h-5" />
            </div>

            <button
              type="button"
              onClick={() => onSelectTab('all')}
              className="text-left group cursor-pointer focus:outline-none min-w-0"
            >
              <span className="font-serif text-base sm:text-lg xl:text-xl font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors whitespace-nowrap block truncate max-w-[170px] sm:max-w-none">
                {siteMetadata.name}
              </span>
            </button>
          </div>

          {/* Zone 2: Desktop Primary Nav (cleanly fits 768px-1280px+ without crowding) */}
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-3.5 lg:gap-5 xl:gap-6 text-xs lg:text-sm font-medium text-[var(--text-secondary)]"
          >
            {primaryItems.map((item) => {
              if (item.id === 'albums' && !onSelectAlbums) return null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleDispatchAction(item.id)}
                  aria-current={item.isActive ? 'page' : undefined}
                  className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
                    item.isActive
                      ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            {/* For public visitors, show resource links inline on lg+, dropdown on md */}
            {!isAuthor && (
              <>
                <div className="hidden lg:flex items-center gap-5 xl:gap-6">
                  <button
                    type="button"
                    onClick={onOpenAbout}
                    aria-current={activeRouteName === 'about' ? 'page' : undefined}
                    className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
                      activeRouteName === 'about'
                        ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Manifiesto
                  </button>

                  {onOpenChordDictionary && (
                    <button
                      type="button"
                      onClick={onOpenChordDictionary}
                      aria-current={activeRouteName === 'chord-dictionary' ? 'page' : undefined}
                      className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
                        activeRouteName === 'chord-dictionary'
                          ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                          : 'text-[var(--text-muted)]'
                      }`}
                      title="Diccionario de acordes para guitarra"
                    >
                      Acordes
                    </button>
                  )}

                  {onOpenScaleDictionary && (
                    <button
                      type="button"
                      onClick={onOpenScaleDictionary}
                      aria-current={activeRouteName === 'scale-dictionary' ? 'page' : undefined}
                      className={`whitespace-nowrap transition-colors hover:text-[var(--text-primary)] py-1 cursor-pointer ${
                        activeRouteName === 'scale-dictionary'
                          ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                          : 'text-[var(--text-muted)]'
                      }`}
                      title="Diccionario de escalas para guitarra"
                    >
                      Escalas
                    </button>
                  )}
                </div>

                {/* Compact Resources dropdown on md (768px-1023px) */}
                <div ref={resourcesNavDropdownRef} className="relative lg:hidden">
                  <button
                    ref={resourcesTriggerRef}
                    type="button"
                    onClick={() =>
                      setOpenDropdown((prev) => (prev === 'resources' ? null : 'resources'))
                    }
                    aria-haspopup="menu"
                    aria-expanded={openDropdown === 'resources'}
                    className={`flex items-center gap-1 whitespace-nowrap py-1 transition-colors cursor-pointer ${
                      hasActiveResource
                        ? 'text-[var(--accent-primary)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>Recursos</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        openDropdown === 'resources' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openDropdown === 'resources' && (
                    <div
                      role="menu"
                      aria-label="Recursos y diccionarios"
                      className="absolute left-0 mt-2 w-56 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-[var(--shadow-lg)] py-1.5 z-50"
                    >
                      {resourceItems
                        .filter((r) => r.id !== 'songbook')
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            onClick={() => handleDispatchAction(item.id)}
                            className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                              item.isActive
                                ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                            }`}
                          >
                            {renderDropdownIcon(item.id)}
                            <span>{item.label}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* For authors, group secondary reader resources in a single clean dropdown */}
            {isAuthor && (
              <div ref={resourcesDropdownRef} className="relative">
                <button
                  ref={resourcesTriggerRef}
                  type="button"
                  onClick={() =>
                    setOpenDropdown((prev) => (prev === 'resources' ? null : 'resources'))
                  }
                  aria-haspopup="menu"
                  aria-expanded={openDropdown === 'resources'}
                  className={`flex items-center gap-1 whitespace-nowrap py-1 transition-colors cursor-pointer ${
                    hasActiveResource
                      ? 'text-[var(--accent-primary)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>Recursos</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      openDropdown === 'resources' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'resources' && (
                  <div
                    role="menu"
                    aria-label="Recursos del cancionero"
                    className="absolute left-0 mt-2 w-60 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-[var(--shadow-lg)] py-1.5 z-50"
                  >
                    {resourceItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        title={item.title}
                        onClick={() => handleDispatchAction(item.id)}
                        className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                          item.isActive
                            ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {renderDropdownIcon(item.id)}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Zone 3: Contextual Actions (Clean on 1024px-1280px via Author Tools Dropdown) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Visitor direct Songbook button on sm+ */}
            {!isAuthor && onOpenSongbook && (
              <button
                type="button"
                onClick={onOpenSongbook}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  activeRouteName === 'songbook'
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                }`}
                title="Exportar repertorio en formato Cancionero imprimible (PDF) para atril"
              >
                <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Cancionero PDF</span>
              </button>
            )}

            {/* Author Tools Dropdown ("Herramientas") on md+ */}
            {isAuthor && (
              <div ref={toolsDropdownRef} className="relative hidden md:block">
                <button
                  ref={toolsTriggerRef}
                  type="button"
                  onClick={() =>
                    setOpenDropdown((prev) => (prev === 'tools' ? null : 'tools'))
                  }
                  aria-haspopup="menu"
                  aria-expanded={openDropdown === 'tools'}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    hasActiveAuthorTool || openDropdown === 'tools'
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                  }`}
                  title="Herramientas de estudio, Git, Spotify y producción"
                >
                  <Wrench className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Herramientas</span>
                  {hasUncommittedChanges && (
                    <span
                      className="w-2 h-2 rounded-full bg-[var(--accent-primary)]"
                      title="Cambios pendientes en Git"
                    />
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      openDropdown === 'tools' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'tools' && (
                  <div
                    role="menu"
                    aria-label="Herramientas de autor y publicación"
                    className="absolute right-0 mt-2 w-68 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-[var(--shadow-xl)] py-2 z-50"
                  >
                    <p className="px-3.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                      Publicación y Gestión
                    </p>
                    {authorToolDropdownItems
                      .filter((i) => ['git-sync', 'tab-dashboard', 'new-album'].includes(i.id))
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          title={item.title}
                          onClick={() => handleDispatchAction(item.id)}
                          className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            item.isActive
                              ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            {renderDropdownIcon(item.id)}
                            <span>{item.label}</span>
                          </span>
                          {item.badgeText && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                              {item.badgeText}
                            </span>
                          )}
                        </button>
                      ))}

                    <div className="my-1.5 border-t border-[var(--border-subtle)]" />

                    <p className="px-3.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                      Estudio y Producción
                    </p>
                    {authorToolDropdownItems
                      .filter((i) =>
                        ['audio-analyzer', 'spotify-import', 'video-visualizer'].includes(i.id)
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          title={item.title}
                          onClick={() => handleDispatchAction(item.id)}
                          className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                            item.isActive
                              ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {renderDropdownIcon(item.id)}
                          <span>{item.label}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              className="p-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-all cursor-pointer flex items-center justify-center min-h-[38px] min-w-[38px]"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-stone-700" />
              )}
            </button>

            {isAuthor ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenNewSong}
                  className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold tracking-wide text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg active:scale-95 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Nueva Canción</span>
                  <span className="sm:hidden">Nueva</span>
                </button>

                {/* Author badge on sm+ (also accessible in mobile drawer) */}
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="hidden sm:flex items-center gap-2 p-1.5 pl-2 pr-2.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--accent-border)] hover:border-[var(--accent-primary)] transition-all cursor-pointer text-xs"
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
                  <span className="font-mono text-[var(--text-primary)] font-semibold hidden lg:inline">
                    @{user?.login || 'autor'}
                  </span>
                </button>
              </div>
            ) : (
              /* Public Visitor: Author Access */
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                title="Acceso para el autor (Tony) mediante GitHub"
              >
                <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span className="hidden sm:inline">Acceso Autor</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Accessible Mobile Navigation Drawer (< md) */}
      <MobileNavDrawer
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        returnFocusRef={mobileTriggerRef}
        isAuthor={isAuthor}
        userLogin={user?.login}
        userAvatarUrl={user?.avatar_url}
        theme={theme}
        onToggleTheme={toggleTheme}
        primaryItems={primaryItems}
        studioItems={studioItems}
        resourceItems={resourceItems}
        onSelectItem={handleDispatchAction}
        onOpenAuthModal={onOpenAuthModal}
      />
    </>
  );
};
