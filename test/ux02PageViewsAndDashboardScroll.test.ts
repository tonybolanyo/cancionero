import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseHashToRoute, routeToHash } from '../src/context/NavigationContext';

const readSrc = (relPath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf-8');

describe('UX-02: Real page views without modal-in-page antipattern & cross-route Dashboard scroll', () => {
  describe('NavigationContext catalog section query parsing and serialization', () => {
    it('parses default catalog hashes without adding an empty section field', () => {
      assert.deepEqual(parseHashToRoute(''), { name: 'catalog' });
      assert.deepEqual(parseHashToRoute('#/'), { name: 'catalog' });
      assert.deepEqual(parseHashToRoute('#/catalogo'), { name: 'catalog' });
    });

    it('parses ?section=dashboard and ?section=catalog on catalog routes', () => {
      assert.deepEqual(parseHashToRoute('#/?section=dashboard'), {
        name: 'catalog',
        section: 'dashboard'
      });
      assert.deepEqual(parseHashToRoute('#/catalogo?section=dashboard'), {
        name: 'catalog',
        section: 'dashboard'
      });
      assert.deepEqual(parseHashToRoute('#/?section=catalog'), {
        name: 'catalog',
        section: 'catalog'
      });
      assert.deepEqual(parseHashToRoute('#/?section=unknown'), { name: 'catalog' });
    });

    it('serializes catalog routes with and without section query params', () => {
      assert.equal(routeToHash({ name: 'catalog' }), '#/');
      assert.equal(routeToHash({ name: 'catalog', section: 'dashboard' }), '#/?section=dashboard');
      assert.equal(routeToHash({ name: 'catalog', section: 'catalog' }), '#/?section=catalog');
    });
  });

  describe('Page views reuse workspace content without fixed modal backdrop', () => {
    it('GitSyncPage uses GitSyncWorkspace in page mode without rendering GitSyncModal', () => {
      const pageSrc = readSrc('src/pages/GitSyncPage.tsx');
      assert.ok(pageSrc.includes('<GitSyncWorkspace'));
      assert.ok(pageSrc.includes('mode="page"'));
      assert.equal(pageSrc.includes('<GitSyncModal'), false);
      assert.equal(pageSrc.includes('fixed inset-0'), false);
    });

    it('SpotifyImportPage uses SpotifyAlbumImportWorkspace in page mode without rendering SpotifyAlbumImportModal', () => {
      const pageSrc = readSrc('src/pages/SpotifyImportPage.tsx');
      assert.ok(pageSrc.includes('<SpotifyAlbumImportWorkspace'));
      assert.ok(pageSrc.includes('mode="page"'));
      assert.equal(pageSrc.includes('<SpotifyAlbumImportModal'), false);
      assert.equal(pageSrc.includes('fixed inset-0'), false);
    });

    it('VideoVisualizerPage uses SongVideoVisualizerWorkspace in page mode without fixed backdrop', () => {
      const pageSrc = readSrc('src/pages/VideoVisualizerPage.tsx');
      assert.ok(pageSrc.includes('SongVideoVisualizerWorkspace'));
      assert.ok(pageSrc.includes('mode="page"'));
      assert.equal(pageSrc.includes('fixed inset-0'), false);
    });

    it('Modal wrappers retain fixed backdrop only for overlay invocations', () => {
      const gitModalSrc = readSrc('src/components/GitSyncModal.tsx');
      assert.ok(gitModalSrc.includes('export const GitSyncWorkspace'));
      assert.ok(gitModalSrc.includes('export const GitSyncModal'));
      assert.ok(gitModalSrc.includes('mode="modal"'));

      const spotifyModalSrc = readSrc('src/components/SpotifyAlbumImportModal.tsx');
      assert.ok(spotifyModalSrc.includes('export const SpotifyAlbumImportWorkspace'));
      assert.ok(spotifyModalSrc.includes('export const SpotifyAlbumImportModal'));
      assert.ok(spotifyModalSrc.includes('mode="modal"'));

      const videoModalSrc = readSrc('src/components/SongVideoVisualizerModal.tsx');
      assert.ok(videoModalSrc.includes('export const SongVideoVisualizerWorkspace'));
      assert.ok(videoModalSrc.includes('export const SongVideoVisualizerModal'));
      assert.ok(videoModalSrc.includes('mode="modal"'));

      // SongDetailPage and AppModals still support modal overlay triggers
      const songDetailSrc = readSrc('src/pages/SongDetailPage.tsx');
      assert.ok(songDetailSrc.includes('<SongVideoVisualizerModal'));
      const appModalsSrc = readSrc('src/components/modals/AppModals.tsx');
      assert.ok(appModalsSrc.includes('<SongVideoVisualizerModal'));
    });
  });

  describe('Routing & cross-page Dashboard scroll coordination', () => {
    it('AppRouter routes video-visualizer to lazy VideoVisualizerPage instead of CatalogPage', () => {
      const routerSrc = readSrc('src/components/routing/AppRouter.tsx');
      assert.ok(routerSrc.includes('../../pages/VideoVisualizerPage'));
      assert.ok(routerSrc.includes('<VideoVisualizerPage'));
      const videoCaseStart = routerSrc.indexOf("case 'video-visualizer':");
      const aboutCaseStart = routerSrc.indexOf("case 'about':");
      const videoCaseSlice = routerSrc.slice(videoCaseStart, aboutCaseStart);
      assert.equal(videoCaseSlice.includes('<CatalogPage'), false);
    });

    it('App.tsx does not auto-open the visualizer modal via useEffect on video-visualizer route', () => {
      const appSrc = readSrc('src/App.tsx');
      assert.equal(appSrc.includes("if (currentRoute.name === 'video-visualizer') {\n      if (isVerifyingSession)"), false);
      assert.ok(appSrc.includes("navigate({ name: 'video-visualizer'"));
    });

    it('useSongCatalog and CatalogPage coordinate deferred scroll to #dashboard-section across routes', () => {
      const hookSrc = readSrc('src/hooks/useSongCatalog.ts');
      assert.ok(hookSrc.includes('scrollRequest'));
      assert.ok(hookSrc.includes('clearScrollRequest'));
      assert.ok(hookSrc.includes("onNavigateToCatalog?.('dashboard')"));

      const catalogSrc = readSrc('src/pages/CatalogPage.tsx');
      assert.ok(catalogSrc.includes('routeSection'));
      assert.ok(catalogSrc.includes('dashboard-section'));
      assert.ok(catalogSrc.includes('MutationObserver'));
    });
  });
});
