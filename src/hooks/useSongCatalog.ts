import { useState, useMemo, useCallback, useEffect } from 'react';
import { Song, SongStatus, SongViewMode } from '../types/song';
import { isLrcContent } from '../lib/lyrics/parseLrc';
import { isValidPlayableAudioUrl } from '../utils/markdownParser';

export type PlatformFilter = 'all' | 'spotify' | 'youtube' | 'soundcloud' | 'audio';
export type BpmRangeFilter = 'all' | 'slow' | 'medium' | 'fast' | 'unspecified';
export type MediaFilter = 'all' | 'has-audio' | 'has-lrc' | 'audio-and-lrc' | 'lyrics-only';
export type CatalogSortOption =
  | 'default'
  | 'updated-desc'
  | 'updated-asc'
  | 'year-desc'
  | 'year-asc'
  | 'title-asc'
  | 'title-desc'
  | 'tempo-asc'
  | 'tempo-desc';
export type NavTab = 'all' | 'published' | 'drafts' | 'private' | 'dashboard';
export type CatalogScrollTarget = 'catalog' | 'dashboard';

export interface CatalogScrollRequest {
  target: CatalogScrollTarget;
  nonce: number;
}

export interface UseSongCatalogOptions {
  songs: Song[];
  isAuthor: boolean;
  onNavigateToCatalog?: (section?: CatalogScrollTarget) => void;
  onOpenAuthModal?: () => void;
}

export function songHasAudioSource(song: Song, isAuthor: boolean): boolean {
  const hasExternalPlatform = Boolean(
    song.spotifyUrl || song.youtubeUrl || song.appleMusicUrl || song.soundcloudUrl
  );
  const hasDirectAudio = isValidPlayableAudioUrl(song.audioUrl) && !song.audioUrl?.startsWith('gdrive://');
  const hasAuthorDriveAudio = isAuthor && Boolean(song.driveFileId || song.audioUrl?.startsWith('gdrive://'));
  return hasExternalPlatform || hasDirectAudio || hasAuthorDriveAudio;
}

export function songHasSyncedLyrics(song: Song): boolean {
  return Boolean((song.lrc && song.lrc.trim().length > 0) || isLrcContent(song.lyrics || ''));
}

export function sortSongsList(songs: Song[], sortBy: CatalogSortOption): Song[] {
  if (sortBy === 'default') return songs;

  const parseTimestamp = (song: Song): number => {
    const raw = song.updatedAt || song.createdAt;
    if (raw) {
      const ts = Date.parse(raw);
      if (Number.isFinite(ts)) return ts;
    }
    return song.year ? Date.UTC(song.year, 0, 1) : 0;
  };

  return [...songs].sort((a, b) => {
    switch (sortBy) {
      case 'updated-desc': {
        const diff = parseTimestamp(b) - parseTimestamp(a);
        return diff !== 0 ? diff : a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      }
      case 'updated-asc': {
        const diff = parseTimestamp(a) - parseTimestamp(b);
        return diff !== 0 ? diff : a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      }
      case 'year-desc': {
        const diff = (b.year || 0) - (a.year || 0);
        return diff !== 0 ? diff : a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      }
      case 'year-asc': {
        const diff = (a.year || 0) - (b.year || 0);
        return diff !== 0 ? diff : a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      }
      case 'title-asc':
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      case 'title-desc':
        return b.title.localeCompare(a.title, 'es', { sensitivity: 'base' });
      case 'tempo-asc': {
        const ta = typeof a.tempo === 'number' && a.tempo > 0 ? a.tempo : Number.POSITIVE_INFINITY;
        const tb = typeof b.tempo === 'number' && b.tempo > 0 ? b.tempo : Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      }
      case 'tempo-desc': {
        const ta = typeof a.tempo === 'number' && a.tempo > 0 ? a.tempo : Number.NEGATIVE_INFINITY;
        const tb = typeof b.tempo === 'number' && b.tempo > 0 ? b.tempo : Number.NEGATIVE_INFINITY;
        if (ta !== tb) return tb - ta;
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      }
      default:
        return 0;
    }
  });
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
    selectedTags?: string[];
    bpmRange?: BpmRangeFilter;
    mediaFilter?: MediaFilter;
    sortBy?: CatalogSortOption;
  }
): Song[] {
  const {
    searchQuery,
    statusFilter,
    platformFilter,
    keyFilter,
    tagFilter,
    selectedTags = [],
    bpmRange = 'all',
    mediaFilter = 'all',
    sortBy = 'default'
  } = filters;

  const normalize = (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const query = searchQuery.trim() ? normalize(searchQuery.trim()) : '';
  const activeTags = selectedTags
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  const filtered = songs.filter(song => {
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

    // BPM range filter
    if (bpmRange !== 'all') {
      const bpm = typeof song.tempo === 'number' && song.tempo > 0 ? song.tempo : null;
      if (bpmRange === 'slow' && (bpm === null || bpm >= 90)) return false;
      if (bpmRange === 'medium' && (bpm === null || bpm < 90 || bpm > 120)) return false;
      if (bpmRange === 'fast' && (bpm === null || bpm <= 120)) return false;
      if (bpmRange === 'unspecified' && bpm !== null) return false;
    }

    // Audio / LRC presence filter
    if (mediaFilter !== 'all') {
      const hasAudio = songHasAudioSource(song, isAuthor);
      const hasLrc = songHasSyncedLyrics(song);
      if (mediaFilter === 'has-audio' && !hasAudio) return false;
      if (mediaFilter === 'has-lrc' && !hasLrc) return false;
      if (mediaFilter === 'audio-and-lrc' && (!hasAudio || !hasLrc)) return false;
      if (mediaFilter === 'lyrics-only' && (hasAudio || hasLrc)) return false;
    }

    // Multi-tag combination (AND) or legacy single tagFilter
    const songTagsLower = (song.tags || []).map(t => t.trim().toLowerCase());
    if (activeTags.length > 0) {
      if (!activeTags.every(reqTag => songTagsLower.includes(reqTag))) {
        return false;
      }
    } else if (tagFilter !== 'all') {
      if (!songTagsLower.includes(tagFilter.trim().toLowerCase())) {
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

  return sortSongsList(filtered, sortBy);
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bpmRange, setBpmRange] = useState<BpmRangeFilter>('all');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [sortBy, setSortBy] = useState<CatalogSortOption>(() => {
    try {
      const saved = localStorage.getItem('cancionero_sort_by') as CatalogSortOption | null;
      if (
        saved === 'default' ||
        saved === 'updated-desc' ||
        saved === 'updated-asc' ||
        saved === 'year-desc' ||
        saved === 'year-asc' ||
        saved === 'title-asc' ||
        saved === 'title-desc' ||
        saved === 'tempo-asc' ||
        saved === 'tempo-desc'
      ) {
        return saved;
      }
    } catch {
      // Ignore
    }
    return 'updated-desc';
  });
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('all');
  const [scrollRequest, setScrollRequest] = useState<CatalogScrollRequest | null>(null);

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

  const handleSortByChange = useCallback((nextSort: CatalogSortOption) => {
    setSortBy(nextSort);
    try {
      localStorage.setItem('cancionero_sort_by', nextSort);
    } catch (e) {
      console.warn('Could not save sortBy to localStorage', e);
    }
  }, []);

  const toggleTag = useCallback((tag: string) => {
    const clean = tag.trim().toLowerCase();
    if (!clean || clean === 'all') {
      setSelectedTags([]);
      return;
    }
    setSelectedTags(prev =>
      prev.some(t => t.toLowerCase() === clean)
        ? prev.filter(t => t.toLowerCase() !== clean)
        : [...prev, clean]
    );
  }, []);

  const clearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const tagFilter = selectedTags.length === 0 ? 'all' : selectedTags[0];

  const setTagFilter = useCallback(
    (tag: string) => {
      if (tag === 'all') {
        setSelectedTags([]);
      } else {
        toggleTag(tag);
      }
    },
    [toggleTag]
  );

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
        tagFilter,
        selectedTags,
        bpmRange,
        mediaFilter,
        sortBy
      }),
    [songs, isAuthor, searchQuery, statusFilter, platformFilter, keyFilter, tagFilter, selectedTags, bpmRange, mediaFilter, sortBy]
  );

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    statusFilter !== 'all' ||
    platformFilter !== 'all' ||
    keyFilter !== 'all' ||
    bpmRange !== 'all' ||
    mediaFilter !== 'all' ||
    selectedTags.length > 0
  );

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlatformFilter('all');
    setKeyFilter('all');
    setSelectedTags([]);
    setBpmRange('all');
    setMediaFilter('all');
    setActiveNavTab('all');
  }, []);

  const requestScroll = useCallback((target: CatalogScrollTarget) => {
    setScrollRequest((prev) => ({
      target,
      nonce: (prev?.nonce ?? 0) + 1
    }));
  }, []);

  const clearScrollRequest = useCallback(() => {
    setScrollRequest(null);
  }, []);

  const handleNavSelect = useCallback(
    (tab: NavTab) => {
      if (tab === 'dashboard') {
        if (!isAuthor) {
          onOpenAuthModal?.();
          return;
        }
        setActiveNavTab('dashboard');
        onNavigateToCatalog?.('dashboard');
        requestScroll('dashboard');
        return;
      }

      if (tab === 'drafts') {
        if (!isAuthor) {
          onOpenAuthModal?.();
          return;
        }
        setActiveNavTab('drafts');
        setStatusFilter('draft');
        onNavigateToCatalog?.('catalog');
        requestScroll('catalog');
        return;
      }

      if (tab === 'private') {
        if (!isAuthor) {
          onOpenAuthModal?.();
          return;
        }
        setActiveNavTab('private');
        setStatusFilter('private');
        onNavigateToCatalog?.('catalog');
        requestScroll('catalog');
        return;
      }

      if (tab === 'published') {
        setActiveNavTab('published');
        setStatusFilter('published');
        onNavigateToCatalog?.('catalog');
        requestScroll('catalog');
        return;
      }

      // tab === 'all'
      const wasOnCatalog =
        typeof document !== 'undefined' && Boolean(document.getElementById('catalogo-section'));
      setActiveNavTab('all');
      setStatusFilter('all');
      onNavigateToCatalog?.();
      if (wasOnCatalog) {
        requestScroll('catalog');
      } else {
        setScrollRequest(null);
      }
    },
    [isAuthor, onNavigateToCatalog, onOpenAuthModal, requestScroll]
  );

  return {
    // State
    searchQuery,
    statusFilter,
    platformFilter,
    keyFilter,
    tagFilter,
    selectedTags,
    bpmRange,
    mediaFilter,
    sortBy,
    hasActiveFilters,
    activeNavTab,
    viewMode,
    scrollRequest,

    // Setters / Handlers
    setSearchQuery,
    setStatusFilter,
    setPlatformFilter,
    setKeyFilter,
    setTagFilter,
    toggleTag,
    clearTags,
    setBpmRange,
    setMediaFilter,
    setSortBy: handleSortByChange,
    setActiveNavTab,
    handleViewModeChange,
    handleNavSelect,
    clearScrollRequest,
    resetFilters,

    // Computed / Memoized
    filteredSongs,
    availableKeys,
    availableTags,
    counts
  };
}
