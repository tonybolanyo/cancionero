import React, { useRef, useEffect } from 'react';
import {
  Search,
  X,
  Lock,
  Tag,
  RotateCcw,
  LayoutGrid,
  List,
  AlignJustify,
  ArrowUpDown
} from 'lucide-react';
import { SongStatus, SongViewMode } from '../types/song';
import {
  PlatformFilter,
  BpmRangeFilter,
  MediaFilter,
  CatalogSortOption
} from '../hooks/useSongCatalog';

interface SongFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: 'all' | SongStatus;
  onStatusChange: (status: 'all' | SongStatus) => void;
  platformFilter: PlatformFilter;
  onPlatformChange: (platform: PlatformFilter) => void;
  keyFilter: string;
  onKeyChange: (key: string) => void;
  availableKeys: string[];
  bpmRange: BpmRangeFilter;
  onBpmRangeChange: (range: BpmRangeFilter) => void;
  mediaFilter: MediaFilter;
  onMediaFilterChange: (media: MediaFilter) => void;
  sortBy: CatalogSortOption;
  onSortByChange: (sort: CatalogSortOption) => void;
  tagFilter?: string;
  onTagChange?: (tag: string) => void;
  selectedTags?: string[];
  onToggleTag?: (tag: string) => void;
  onClearTags?: () => void;
  availableTags: { tag: string; count: number }[];
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  counts: {
    all: number;
    published: number;
    draft: number;
    private: number;
  };
  isAuthor: boolean;
  onOpenAuthModal: () => void;
  viewMode: SongViewMode;
  onViewModeChange: (mode: SongViewMode) => void;
  filteredCount?: number;
}

export const SongFilters: React.FC<SongFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  platformFilter,
  onPlatformChange,
  keyFilter,
  onKeyChange,
  availableKeys,
  bpmRange,
  onBpmRangeChange,
  mediaFilter,
  onMediaFilterChange,
  sortBy,
  onSortByChange,
  tagFilter = 'all',
  onTagChange,
  selectedTags,
  onToggleTag,
  onClearTags,
  availableTags,
  hasActiveFilters = false,
  onResetFilters,
  counts,
  isAuthor,
  onOpenAuthModal,
  viewMode,
  onViewModeChange,
  filteredCount,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeTags = selectedTags ?? (tagFilter && tagFilter !== 'all' ? [tagFilter] : []);

  const handleTagClick = (tag: string) => {
    if (onToggleTag) {
      onToggleTag(tag);
    } else if (onTagChange) {
      const isSelected = activeTags.some(t => t.toLowerCase() === tag.toLowerCase());
      onTagChange(isSelected ? 'all' : tag);
    }
  };

  const handleClearTags = () => {
    if (onClearTags) {
      onClearTags();
    } else if (onTagChange) {
      onTagChange('all');
    }
  };

  // Global hotkey: press '/' or 'Ctrl+K' / 'Cmd+K' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-4 mb-8">
      {/* Top search & view mode switcher row */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Search input with clean affordance */}
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por título, verso, tonalidad, género, año..."
            className="w-full pl-10 pr-20 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors shadow-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  searchInputRef.current?.focus();
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-full hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                title="Borrar búsqueda"
                aria-label="Borrar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded shadow-2xs">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* View Mode Switcher Button Group */}
        <div className="flex items-center p-1 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl shrink-0 self-start lg:self-auto shadow-xs">
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'grid'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
            title="Vista de cuadrícula (Tarjetas visuales con acordes y reproductores)"
            aria-label="Vista cuadrícula"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tarjetas</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('expanded')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'expanded'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
            title="Vista de lista ampliada (Filas detalladas con letra extendida y notas)"
            aria-label="Vista lista ampliada"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lista ampliada</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('compact')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'compact'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
            title="Vista compacta (Tabla de atril/repertorio densa y ordenable por tonalidad o tempo)"
            aria-label="Vista compacta"
          >
            <AlignJustify className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Comprimida</span>
          </button>
        </div>
      </div>

      {/* Filter & Global Sort Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Global Sort Selector */}
        <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-primary)] shadow-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as CatalogSortOption)}
            aria-label="Ordenar canciones"
            className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer pr-1"
          >
            <option value="updated-desc">Orden: Más recientes</option>
            <option value="updated-asc">Orden: Más antiguas</option>
            <option value="year-desc">Año: Reciente a antiguo</option>
            <option value="year-asc">Año: Antiguo a reciente</option>
            <option value="title-asc">Título: A–Z</option>
            <option value="title-desc">Título: Z–A</option>
            <option value="tempo-asc">BPM: Lento a rápido</option>
            <option value="tempo-desc">BPM: Rápido a lento</option>
            <option value="default">Orden original</option>
          </select>
        </div>

        {/* Key selector */}
        <select
          value={keyFilter}
          onChange={(e) => onKeyChange(e.target.value)}
          aria-label="Filtrar por tonalidad"
          className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer shadow-xs"
        >
          <option value="all">Todas las tonalidades</option>
          {availableKeys.map(k => (
            <option key={k} value={k}>Tono: {k}</option>
          ))}
        </select>

        {/* BPM Range selector */}
        <select
          value={bpmRange}
          onChange={(e) => onBpmRangeChange(e.target.value as BpmRangeFilter)}
          aria-label="Filtrar por rango de BPM"
          className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer shadow-xs"
        >
          <option value="all">Cualquier BPM</option>
          <option value="slow">Lento (&lt; 90 BPM)</option>
          <option value="medium">Medio (90–120 BPM)</option>
          <option value="fast">Rápido (&gt; 120 BPM)</option>
          <option value="unspecified">Sin BPM definido</option>
        </select>

        {/* Audio / LRC Presence selector */}
        <select
          value={mediaFilter}
          onChange={(e) => onMediaFilterChange(e.target.value as MediaFilter)}
          aria-label="Filtrar por audio o letra sincronizada LRC"
          className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer shadow-xs"
        >
          <option value="all">Audio y LRC: Todos</option>
          <option value="has-audio">Con audio o plataforma</option>
          <option value="has-lrc">Con LRC sincronizado</option>
          <option value="audio-and-lrc">Audio + LRC sincronizado</option>
          <option value="lyrics-only">Solo letra y acordes</option>
        </select>

        {/* Platform selector */}
        <select
          value={platformFilter}
          onChange={(e) => onPlatformChange(e.target.value as PlatformFilter)}
          aria-label="Filtrar por plataforma de audio"
          className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer shadow-xs"
        >
          <option value="all">Todas las plataformas</option>
          <option value="spotify">Spotify</option>
          <option value="youtube">YouTube</option>
          <option value="soundcloud">SoundCloud</option>
          <option value="audio">Maquetas directas</option>
        </select>

        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--accent-primary)] bg-[var(--accent-subtle)] border border-[var(--accent-border)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar filtros</span>
          </button>
        )}
      </div>

      {/* Active search summary notification */}
      {searchQuery && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <span className="font-medium">Búsqueda:</span>
            <span className="font-serif italic font-bold text-[var(--text-primary)]">"{searchQuery}"</span>
            {filteredCount !== undefined && (
              <span className="text-[var(--text-muted)] font-mono tabular-nums">
                · {filteredCount} {filteredCount === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpiar búsqueda</span>
          </button>
        </div>
      )}

      {/* Interactive Multi-Tag Filter Row */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-2 pt-1 pb-1 overflow-x-auto text-xs scrollbar-none">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] shrink-0 font-medium mr-1">
            <Tag className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Etiquetas:</span>
          </div>

          <button
            type="button"
            onClick={handleClearTags}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 border whitespace-nowrap ${
              activeTags.length === 0
                ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)] font-semibold'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)]'
            }`}
          >
            Todas
          </button>

          {availableTags.map(({ tag, count }) => {
            const isSelected = activeTags.some(t => t.toLowerCase() === tag.toLowerCase());
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleTagClick(tag)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 border whitespace-nowrap ${
                  isSelected
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)] font-semibold shadow-xs'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]'
                }`}
                title={`${isSelected ? 'Quitar' : 'Combinar'} etiqueta "${tag}" (${count} ${count === 1 ? 'canción' : 'canciones'})`}
              >
                <span>#{tag}</span>
                <span className={`text-[10px] tabular-nums px-1 py-0.2 rounded ${
                  isSelected ? 'bg-white/20 text-white' : 'text-[var(--text-muted)]'
                }`}>
                  {count}
                </span>
                {isSelected && <X className="w-3 h-3 ml-0.5 opacity-80" />}
              </button>
            );
          })}

          {activeTags.length > 0 && (
            <button
              type="button"
              onClick={handleClearTags}
              className="px-2 py-1 text-[11px] text-[var(--accent-primary)] hover:underline flex items-center gap-1 shrink-0 cursor-pointer ml-1 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>
                {activeTags.length > 1
                  ? `Limpiar etiquetas (${activeTags.length})`
                  : 'Limpiar etiqueta'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Segmented Filter Control for Status */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-x-auto">
        <button
          type="button"
          onClick={() => onStatusChange('all')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
          }`}
        >
          {isAuthor ? `Todas las canciones (${counts.all})` : `Repertorio público (${counts.published})`}
        </button>

        <button
          type="button"
          onClick={() => onStatusChange('published')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            statusFilter === 'published'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
          }`}
        >
          Publicadas con letra ({counts.published})
        </button>

        {/* Borradores and Inéditas are only accessible to the author */}
        {isAuthor ? (
          <>
            <button
              type="button"
              onClick={() => onStatusChange('draft')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'draft'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              Borradores ({counts.draft})
            </button>

            <button
              type="button"
              onClick={() => onStatusChange('private')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'private'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              Inéditas Privadas ({counts.private})
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ml-auto"
            title="Inicia sesión con tu cuenta de GitHub para gestionar borradores e inéditas"
          >
            <Lock className="w-3 h-3" />
            <span>Borradores & Privadas (Solo autor)</span>
          </button>
        )}
      </div>
    </div>
  );
};
