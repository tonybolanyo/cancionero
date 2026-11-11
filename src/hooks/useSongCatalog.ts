import { useState, useMemo, useCallback, useEffect } from 'react';
import { Song, SongStatus, SongViewMode } from '../types/song';

export type PlatformFilter = 'all' | 'spotify' | 'youtube' | 'soundcloud' | 'audio';
export type NavTab = 'all' | 'published' | 'drafts' | 'private' | 'dashboard';

export interface UseSongCatalogOptions {
  songs: Song[];
  isAuthor: boolean;
  onNavigateToCatalog?: () => void;
  onOpenAuthModal?: () => void;
}

export function filterSongsList(
  songs: Song[],
  isAuthor: boolean,
  filters: {
    searchQuery: string;
    statusFilter: 'all' | SongStatus;
    platformFilter: PlatformFilter;
    keyFilter: string;
    tagFilter: string;
  }
): Song[] {
  const { searchQuery, statusFilter, platformFilter, keyFilter, tagFilter } = filters;

  const normalize = (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const query = searchQuery.trim() ? normalize(searchQuery.trim()) : '';

  return songs.filter(song => {
    // Visibility guard: non-authors can only view published songs
    if (!isAuthor && song.status !== 'published') return false;

    // Status filter
    if (statusFilter !== 'all' && song.status !== statusFilter) return false;

    // Platform filter
    if (platformFilter === 'spotify' && !song.spotifyUrl) return false;
    if (platformFilter === 'youtube' && !song.youtubeUrl) return false;
    if (platformFilter === 'soundcloud' && !song.soundcloudUrl) return false;
    if (platformFilter === 'audio' && !song.audioUrl) return false;

    // Key filter
    if (keyFilter !== 'all' && song.key !== keyFilter) return false;

    // Tag filter
    if (tagFilter !== 'all') {
      if (!song.tags || !song.tags.some(t => t.trim().toLowerCase() === tagFilter.toLowerCase())) {
        return false;
      }
    }

    // Search query
    if (query) {
      const inTitle = normalize(song.title).includes(query);
      const inGenre = song.genre ? normalize(song.genre).includes(query) : false;
      const inLyrics = normalize(song.lyrics).includes(query);
      const inNotes = song.notes ? normalize(song.notes).includes(query) : false;
      const inTags = song.tags?.some(t => normalize(t).includes(query));
      const inKey = song.key ? normalize(song.key).includes(query) : false;
      const inYear = song.year ? song.year.toString().includes(query) : false;
      const inTuning = song.tuning ? normalize(song.tuning).includes(query) : false;

      return inTitle || inGenre || inLyrics || inNotes || !!inTags || inKey || inYear || inTuning;
    }

    return true;
  });
}

export function calculateSongCounts(songs: Song[], isAuthor: boolean) {
  const published = songs.filter(s => s.status === 'published').length;
  const draft = songs.filter(s => s.status === 'draft').length;
  const priv = songs.filter(s => s.status === 'private').length;
  return {
    all: isAuthor ? songs.length : published,
    published,
    draft,
    private: priv
  };
}

export function extractAvailableKeys(songs: Song[], isAuthor: boolean): string[] {
  const set = new Set<string>();
  songs.forEach(s => {
    if (s.key && (isAuthor || s.status === 'published')) {
      set.add(s.key);
    }
  });
  return Array.from(set).sort();
}

export function extractAvailableTags(songs: Song[], isAuthor: boolean): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  songs.forEach(song => {
    if (isAuthor || song.status === 'published') {
      song.tags?.forEach(tag => {
        const clean = tag.trim().toLowerCase();
        if (clean) {
          map.set(clean, (map.get(clean) || 0) + 1);
        }
      });
    }
  });
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function useSongCatalog({
  songs,
  isAuthor,
  onNavigateToCatalog,
  onOpenAuthModal
}: UseSongCatalogOptions) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | SongStatus>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [keyFilter, setKeyFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('all');

  const [viewMode, setViewMode] = useState<SongViewMode>(() => {
    try {
      const saved = localStorage.getItem('cancionero_view_mode');
      if (saved === 'grid' || saved === 'expanded' || saved === 'compact') {
        return saved;
      }
    } catch {
      // Ignore
    }
    return 'grid';
  });

  const handleViewModeChange = useCallback((mode: SongViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('cancionero_view_mode', mode);
    } catch (e) {
      console.warn('Could not save viewMode to localStorage', e);
    }
  }, []);

  // Reset tab if logged out and non-author shouldn't see draft/private
  useEffect(() => {
    if (!isAuthor && (statusFilter === 'draft' || statusFilter === 'private')) {
      setStatusFilter('all');
      setActiveNavTab('all');
    }
  }, [isAuthor, statusFilter]);

  const availableKeys = useMemo(
    () => extractAvailableKeys(songs, isAuthor),
    [songs, isAuthor]
  );

  const availableTags = useMemo(
    () => extractAvailableTags(songs, isAuthor),
    [songs, isAuthor]
  );

  const counts = useMemo(
    () => calculateSongCounts(songs, isAuthor),
    [songs, isAuthor]
  );

  const filteredSongs = useMemo(
    () =>
      filterSongsList(songs, isAuthor, {
        searchQuery,
        statusFilter,
        platformFilter,
        keyFilter,
        tagFilter
      }),
    [songs, isAuthor, searchQuery, statusFilter, platformFilter, keyFilter, tagFilter]
  );

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlatformFilter('all');
    setKeyFilter('all');
    setTagFilter('all');
    setActiveNavTab('all');
  }, []);

  const handleNavSelect = useCallback(
    (tab: NavTab) => {
      setActiveNavTab(tab);
      onNavigateToCatalog?.();

      if (tab === 'dashboard') {
        if (!isAuthor) {
          onOpenAuthModal?.();
          return;
        }
        const el = document.getElementById('dashboard-section');
        el?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      if (tab === 'all') setStatusFilter('all');
      if (tab === 'published') setStatusFilter('published');
      if (tab === 'drafts') {
        if (!isAuthor) {
          onOpenAuthModal?.();
          return;
        }
        setStatusFilter('draft');
      }
      if (tab === 'private') {
        if (!isAuthor) {
          onOpenAuthModal?.();
          return;
        }
        setStatusFilter('private');
      }

      const catEl = document.getElementById('catalogo-section');
      catEl?.scrollIntoView({ behavior: 'smooth' });
    },
    [isAuthor, onNavigateToCatalog, onOpenAuthModal]
  );

  return {
    // State
    searchQuery,
    statusFilter,
    platformFilter,
    keyFilter,
    tagFilter,
    activeNavTab,
    viewMode,

    // Setters / Handlers
    setSearchQuery,
    setStatusFilter,
    setPlatformFilter,
    setKeyFilter,
    setTagFilter,
    setActiveNavTab,
    handleViewModeChange,
    handleNavSelect,
    resetFilters,

    // Computed / Memoized
    filteredSongs,
    availableKeys,
    availableTags,
    counts
  };
}
