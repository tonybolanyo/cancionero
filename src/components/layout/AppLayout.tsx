import React from 'react';
import { Header } from '../Header';
import { Footer } from '../Footer';
import { SkipLink } from '../SkipLink';
import { SeoHelper } from '../SeoHelper';
import { Song } from '../../types/song';
import { NavTab } from '../../hooks/useSongCatalog';
import { AppRoute } from '../../context/NavigationContext';

export interface AppLayoutProps {
  children: React.ReactNode;
  activeSong?: Song | null;
  activeTab: NavTab;
  isAlbumsActive: boolean;
  activeRouteName?: AppRoute['name'];
  hasUncommittedChanges: boolean;
  isAuthor: boolean;
  onOpenNewSong: () => void;
  onOpenNewAlbum: () => void;
  onOpenSpotifyImport: () => void;
  onOpenGitModal: () => void;
  onSelectTab: (tab: NavTab) => void;
  onSelectAlbums: () => void;
  onOpenAbout: () => void;
  onOpenAuthModal: () => void;
  onOpenAudioAnalyzer?: () => void;
  onOpenSongbook: () => void;
  onOpenVideoVisualizer?: () => void;
  onOpenChordDictionary?: () => void;
  onOpenScaleDictionary?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeSong,
  activeTab,
  isAlbumsActive,
  activeRouteName,
  hasUncommittedChanges,
  isAuthor,
  onOpenNewSong,
  onOpenNewAlbum,
  onOpenSpotifyImport,
  onOpenGitModal,
  onSelectTab,
  onSelectAlbums,
  onOpenAbout,
  onOpenAuthModal,
  onOpenAudioAnalyzer,
  onOpenSongbook,
  onOpenVideoVisualizer,
  onOpenChordDictionary,
  onOpenScaleDictionary
}) => {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans transition-colors duration-200">
      {/* Accessibility Skip Link */}
      <SkipLink />

      {/* SEO Meta Tags */}
      <SeoHelper
        title={activeSong ? `${activeSong.title} - Cancionero de versos perdidos` : 'Cancionero de versos perdidos'}
        description="Versos que se perdieron un día y regresaron convertidos en canciones. Canciones propias, letras íntimas y pequeñas verdades hechas de guitarra, memoria y poesía."
        keywords={['canciones', 'poesía', 'acústico', 'cantautor', 'álbumes', 'discografía', 'singer-songwriter']}
        song={activeSong || undefined}
      />

      {/* 3-Zone Top Bar Navigation */}
      <Header
        onOpenNewSong={onOpenNewSong}
        onOpenNewAlbum={onOpenNewAlbum}
        onOpenSpotifyImport={onOpenSpotifyImport}
        onOpenGitModal={onOpenGitModal}
        onSelectTab={onSelectTab}
        onSelectAlbums={onSelectAlbums}
        activeTab={activeTab}
        isAlbumsActive={isAlbumsActive}
        activeRouteName={activeRouteName}
        hasUncommittedChanges={hasUncommittedChanges}
        onOpenAbout={onOpenAbout}
        onOpenAuthModal={onOpenAuthModal}
        onOpenAudioAnalyzer={onOpenAudioAnalyzer}
        onOpenSongbook={onOpenSongbook}
        onOpenVideoVisualizer={onOpenVideoVisualizer}
        onOpenChordDictionary={onOpenChordDictionary}
        onOpenScaleDictionary={onOpenScaleDictionary}
      />

      {/* Main Page Content Router */}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      {/* Editorial Footer */}
      <Footer
        isAuthor={isAuthor}
        onDashboardClick={() => onSelectTab('dashboard')}
        onGitSyncClick={onOpenGitModal}
        onAuthClick={onOpenAuthModal}
        onAboutClick={onOpenAbout}
        onSongbookClick={onOpenSongbook}
      />
    </div>
  );
};
