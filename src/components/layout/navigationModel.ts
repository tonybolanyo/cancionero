import { NavTab } from '../../hooks/useSongCatalog';
import { AppRoute } from '../../context/NavigationContext';

export interface NavItemDescriptor {
  id: string;
  label: string;
  title?: string;
  isActive: boolean;
  badgeText?: string;
  hasDot?: boolean;
  tone?: 'default' | 'primary' | 'danger';
}

export interface NavigationModelInput {
  isAuthor: boolean;
  activeTab: NavTab;
  isAlbumsActive: boolean;
  activeRouteName?: AppRoute['name'];
  hasUncommittedChanges: boolean;
  hasNewAlbum?: boolean;
  hasAudioAnalyzer?: boolean;
  hasVideoVisualizer?: boolean;
  hasSongbook?: boolean;
  hasChordDictionary?: boolean;
  hasScaleDictionary?: boolean;
}

export function isCatalogRoute(activeRouteName?: AppRoute['name']): boolean {
  return !activeRouteName || activeRouteName === 'catalog';
}

export function getPrimaryNavItems(input: NavigationModelInput): NavItemDescriptor[] {
  const onCatalog = isCatalogRoute(input.activeRouteName) && !input.isAlbumsActive;

  const items: NavItemDescriptor[] = [
    {
      id: 'tab-all',
      label: 'Canciones',
      isActive: onCatalog && input.activeTab === 'all'
    },
    {
      id: 'albums',
      label: 'Álbumes',
      isActive: input.isAlbumsActive
    },
    {
      id: 'tab-published',
      label: 'Publicadas',
      isActive: onCatalog && input.activeTab === 'published'
    }
  ];

  if (input.isAuthor) {
    items.push(
      {
        id: 'tab-drafts',
        label: 'Borradores',
        isActive: onCatalog && input.activeTab === 'drafts'
      },
      {
        id: 'tab-private',
        label: 'Inéditas',
        isActive: onCatalog && input.activeTab === 'private'
      }
    );
  }

  return items;
}

export function getAuthorStudioItems(input: NavigationModelInput): NavItemDescriptor[] {
  if (!input.isAuthor) {
    return [];
  }

  const onCatalog = isCatalogRoute(input.activeRouteName);
  const items: NavItemDescriptor[] = [
    {
      id: 'new-song',
      label: 'Nueva Canción',
      title: 'Crear o escribir una nueva canción',
      isActive: input.activeRouteName === 'song-new',
      tone: 'primary'
    }
  ];

  if (input.hasNewAlbum) {
    items.push({
      id: 'new-album',
      label: 'Nuevo Álbum',
      title: 'Crear un nuevo álbum o disco',
      isActive: input.activeRouteName === 'album-new'
    });
  }

  items.push(
    {
      id: 'git-sync',
      label: 'Sincronización Git',
      title: 'Archivos Markdown / JSON y Sincronización Git',
      isActive: input.activeRouteName === 'git-sync',
      hasDot: input.hasUncommittedChanges,
      badgeText: input.hasUncommittedChanges ? 'Pendiente' : undefined
    },
    {
      id: 'tab-dashboard',
      label: 'Dashboard y Respaldos',
      title: 'Estadísticas del repertorio y copias de seguridad',
      isActive: onCatalog && input.activeTab === 'dashboard'
    }
  );

  if (input.hasAudioAnalyzer) {
    items.push({
      id: 'audio-analyzer',
      label: 'Detector de Audio',
      title: 'Detectar tempo, tonalidad y acordes desde un audio (.mp3/.wav)',
      isActive: input.activeRouteName === 'audio-analyzer'
    });
  }

  items.push({
    id: 'spotify-import',
    label: 'Importar Disco (Spotify)',
    title: 'Importar canciones de un disco de Spotify',
    isActive: input.activeRouteName === 'spotify-import'
  });

  if (input.hasVideoVisualizer) {
    items.push({
      id: 'video-visualizer',
      label: 'Vídeo YouTube',
      title: 'Generar vídeo para YouTube con letra sincronizada',
      isActive: input.activeRouteName === 'video-visualizer',
      tone: 'danger'
    });
  }

  return items;
}

export function getResourceItems(input: NavigationModelInput): NavItemDescriptor[] {
  const items: NavItemDescriptor[] = [];

  if (input.hasSongbook) {
    items.push({
      id: 'songbook',
      label: 'Cancionero PDF',
      title: 'Exportar repertorio en formato Cancionero imprimible (PDF) para atril',
      isActive: input.activeRouteName === 'songbook'
    });
  }

  if (input.hasChordDictionary) {
    items.push({
      id: 'chord-dictionary',
      label: 'Diccionario de Acordes',
      title: 'Diccionario de acordes para guitarra',
      isActive: input.activeRouteName === 'chord-dictionary'
    });
  }

  if (input.hasScaleDictionary) {
    items.push({
      id: 'scale-dictionary',
      label: 'Diccionario de Escalas',
      title: 'Diccionario de escalas para guitarra',
      isActive: input.activeRouteName === 'scale-dictionary'
    });
  }

  items.push({
    id: 'about',
    label: 'Manifiesto',
    title: 'Sobre el proyecto y manifiesto de autor',
    isActive: input.activeRouteName === 'about'
  });

  return items;
}
