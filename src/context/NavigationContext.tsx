import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type AppRoute =
  | { name: 'catalog' }
  | { name: 'albums' }
  | { name: 'album-detail'; albumId: string }
  | { name: 'album-new' }
  | { name: 'album-edit'; albumId: string }
  | { name: 'song-detail'; songId: string }
  | { name: 'song-new'; initialAlbumId?: string }
  | { name: 'song-edit'; songId: string }
  | { name: 'songbook' }
  | { name: 'audio-analyzer' }
  | { name: 'about' }
  | { name: 'git-sync' }
  | { name: 'spotify-import' };

interface NavigationContextType {
  currentRoute: AppRoute;
  navigate: (routeOrPath: AppRoute | string) => void;
  goBack: (fallback?: AppRoute | string) => void;
  canGoBack: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function parseHashToRoute(rawHash: string): AppRoute {
  // Strip leading '#' and trim slashes
  let hash = rawHash.replace(/^#\/?/, '').trim();
  // Remove trailing slashes and query strings for route matching
  const [routePart, queryPart] = hash.split('?');
  const path = routePart.replace(/\/+$/, '');

  if (!path || path === 'catalogo' || path === 'canciones') {
    return { name: 'catalog' };
  }

  if (path === 'albumes' || path === 'discografia') {
    return { name: 'albums' };
  }

  if (path === 'album/nuevo') {
    return { name: 'album-new' };
  }

  const albumEditMatch = path.match(/^album\/editar\/([^/]+)$/);
  if (albumEditMatch) {
    return { name: 'album-edit', albumId: decodeURIComponent(albumEditMatch[1]) };
  }

  const albumDetailMatch = path.match(/^album\/([^/]+)$/);
  if (albumDetailMatch) {
    return { name: 'album-detail', albumId: decodeURIComponent(albumDetailMatch[1]) };
  }

  if (path === 'cancion/nueva') {
    const params = new URLSearchParams(queryPart || '');
    const albumId = params.get('albumId') || undefined;
    return { name: 'song-new', initialAlbumId: albumId };
  }

  const songEditMatch = path.match(/^cancion\/editar\/([^/]+)$/);
  if (songEditMatch) {
    return { name: 'song-edit', songId: decodeURIComponent(songEditMatch[1]) };
  }

  const songDetailMatch = path.match(/^cancion\/([^/]+)$/);
  if (songDetailMatch) {
    return { name: 'song-detail', songId: decodeURIComponent(songDetailMatch[1]) };
  }

  if (path === 'cancionero-atril' || path === 'atril') {
    return { name: 'songbook' };
  }

  if (path === 'analizador-audio' || path === 'analizador') {
    return { name: 'audio-analyzer' };
  }

  if (path === 'acerca-de' || path === 'manifiesto') {
    return { name: 'about' };
  }

  if (path === 'git-sync' || path === 'sync') {
    return { name: 'git-sync' };
  }

  if (path === 'importar-spotify' || path === 'spotify') {
    return { name: 'spotify-import' };
  }

  // Fallback to catalog
  return { name: 'catalog' };
}

export function routeToHash(route: AppRoute): string {
  switch (route.name) {
    case 'catalog':
      return '#/';
    case 'albums':
      return '#/albumes';
    case 'album-detail':
      return `#/album/${encodeURIComponent(route.albumId)}`;
    case 'album-new':
      return '#/album/nuevo';
    case 'album-edit':
      return `#/album/editar/${encodeURIComponent(route.albumId)}`;
    case 'song-detail':
      return `#/cancion/${encodeURIComponent(route.songId)}`;
    case 'song-new':
      return route.initialAlbumId ? `#/cancion/nueva?albumId=${encodeURIComponent(route.initialAlbumId)}` : '#/cancion/nueva';
    case 'song-edit':
      return `#/cancion/editar/${encodeURIComponent(route.songId)}`;
    case 'songbook':
      return '#/cancionero-atril';
    case 'audio-analyzer':
      return '#/analizador-audio';
    case 'about':
      return '#/acerca-de';
    case 'git-sync':
      return '#/git-sync';
    case 'spotify-import':
      return '#/importar-spotify';
  }
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    if (typeof window !== 'undefined') {
      return parseHashToRoute(window.location.hash);
    }
    return { name: 'catalog' };
  });

  const [navigationHistoryCount, setNavigationHistoryCount] = useState<number>(0);

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = parseHashToRoute(window.location.hash);
      setCurrentRoute(nextRoute);
      setNavigationHistoryCount(prev => prev + 1);
      // Scroll to top on page navigation
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const navigate = useCallback((routeOrPath: AppRoute | string) => {
    let targetHash = '';
    if (typeof routeOrPath === 'string') {
      targetHash = routeOrPath.startsWith('#') ? routeOrPath : `#/${routeOrPath.replace(/^\/+/, '')}`;
    } else {
      targetHash = routeToHash(routeOrPath);
    }

    if (window.location.hash === targetHash) {
      // Re-trigger parse if already on hash
      setCurrentRoute(parseHashToRoute(targetHash));
    } else {
      window.location.hash = targetHash;
    }
  }, []);

  const goBack = useCallback((fallback?: AppRoute | string) => {
    if (navigationHistoryCount > 0) {
      window.history.back();
    } else if (fallback) {
      navigate(fallback);
    } else {
      navigate({ name: 'catalog' });
    }
  }, [navigationHistoryCount, navigate]);

  const value = useMemo(() => ({
    currentRoute,
    navigate,
    goBack,
    canGoBack: navigationHistoryCount > 0
  }), [currentRoute, navigate, goBack, navigationHistoryCount]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export function useAppNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useAppNavigation must be used within a NavigationProvider');
  }
  return ctx;
}
