import React from 'react';
import { Search, X, Lock } from 'lucide-react';
import { SongStatus } from '../types/song';

interface SongFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: 'all' | SongStatus;
  onStatusChange: (status: 'all' | SongStatus) => void;
  platformFilter: 'all' | 'spotify' | 'youtube' | 'soundcloud' | 'audio';
  onPlatformChange: (platform: 'all' | 'spotify' | 'youtube' | 'soundcloud' | 'audio') => void;
  keyFilter: string;
  onKeyChange: (key: string) => void;
  availableKeys: string[];
  counts: {
    all: number;
    published: number;
    draft: number;
    private: number;
  };
  isAuthor: boolean;
  onOpenAuthModal: () => void;
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
  counts,
  isAuthor,
  onOpenAuthModal
}) => {
  return (
    <div className="space-y-4 mb-8">
      {/* Top search & quick controls row */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search input with clean affordance */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por título, verso, género o notas..."
            className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Secondary filters: Platform and Musical Key */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Platform selector */}
          <select
            value={platformFilter}
            onChange={(e) => onPlatformChange(e.target.value as any)}
            className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer shadow-sm"
          >
            <option value="all">Todas las plataformas de audio</option>
            <option value="spotify">Solo en Spotify</option>
            <option value="youtube">Solo en YouTube</option>
            <option value="soundcloud">Solo en SoundCloud</option>
            <option value="audio">Con audio directo / maquetas</option>
          </select>

          {/* Key selector */}
          <select
            value={keyFilter}
            onChange={(e) => onKeyChange(e.target.value)}
            className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer shadow-sm"
          >
            <option value="all">Todas las tonalidades</option>
            {availableKeys.map(k => (
              <option key={k} value={k}>Tonalidad: {k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Segmented Filter Control for Status */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-x-auto">
        <button
          onClick={() => onStatusChange('all')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
          }`}
        >
          {isAuthor ? `Todas las canciones (${counts.all})` : `Repertorio público (${counts.published})`}
        </button>

        <button
          onClick={() => onStatusChange('published')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            statusFilter === 'published'
              ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
          }`}
        >
          Publicadas con letra ({counts.published})
        </button>

        {/* Borradores and Inéditas are only accessible to the author */}
        {isAuthor ? (
          <>
            <button
              onClick={() => onStatusChange('draft')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'draft'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              Borradores ({counts.draft})
            </button>

            <button
              onClick={() => onStatusChange('private')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === 'private'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              Inéditas Privadas ({counts.private})
            </button>
          </>
        ) : (
          <button
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
