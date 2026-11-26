import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPrimaryNavItems,
  getAuthorStudioItems,
  getResourceItems,
  type NavigationModelInput
} from '../src/components/layout/navigationModel';

function createBaseInput(overrides: Partial<NavigationModelInput> = {}): NavigationModelInput {
  return {
    isAuthor: false,
    activeTab: 'all',
    isAlbumsActive: false,
    activeRouteName: 'catalog',
    hasUncommittedChanges: false,
    hasNewAlbum: true,
    hasAudioAnalyzer: true,
    hasVideoVisualizer: true,
    hasSongbook: true,
    hasChordDictionary: true,
    hasScaleDictionary: true,
    ...overrides
  };
}

describe('UX-01: Header & Mobile Drawer role-aware navigation model', () => {
  it('exposes only public catalog sections and reader resources for public visitors', () => {
    const input = createBaseInput({ isAuthor: false });
    const primary = getPrimaryNavItems(input);
    const studio = getAuthorStudioItems(input);
    const resources = getResourceItems(input);

    assert.deepEqual(
      primary.map((i) => i.id),
      ['tab-all', 'albums', 'tab-published']
    );
    assert.equal(studio.length, 0);
    assert.deepEqual(
      resources.map((i) => i.id),
      ['songbook', 'chord-dictionary', 'scale-dictionary', 'about']
    );
  });

  it('includes author-only sections and studio tools when authenticated as author', () => {
    const input = createBaseInput({
      isAuthor: true,
      hasUncommittedChanges: true,
      activeTab: 'drafts'
    });
    const primary = getPrimaryNavItems(input);
    const studio = getAuthorStudioItems(input);

    assert.deepEqual(
      primary.map((i) => i.id),
      ['tab-all', 'albums', 'tab-published', 'tab-drafts', 'tab-private']
    );
    assert.equal(primary.find((i) => i.id === 'tab-drafts')?.isActive, true);
    assert.equal(primary.find((i) => i.id === 'tab-all')?.isActive, false);

    assert.deepEqual(
      studio.map((i) => i.id),
      [
        'new-song',
        'new-album',
        'git-sync',
        'tab-dashboard',
        'audio-analyzer',
        'spotify-import',
        'video-visualizer'
      ]
    );

    const gitItem = studio.find((i) => i.id === 'git-sync');
    assert.equal(gitItem?.hasDot, true);
    assert.equal(gitItem?.badgeText, 'Pendiente');
  });

  it('highlights secondary routes accurately without falsely activating catalog tabs', () => {
    const scaleInput = createBaseInput({
      isAuthor: true,
      activeTab: 'all',
      activeRouteName: 'scale-dictionary'
    });

    const primary = getPrimaryNavItems(scaleInput);
    const resources = getResourceItems(scaleInput);

    assert.equal(primary.some((i) => i.isActive), false);
    assert.equal(resources.find((i) => i.id === 'scale-dictionary')?.isActive, true);
    assert.equal(resources.find((i) => i.id === 'about')?.isActive, false);
  });

  it('highlights Git Sync tool when on git-sync route and clears album active mismatch', () => {
    const gitInput = createBaseInput({
      isAuthor: true,
      activeRouteName: 'git-sync',
      isAlbumsActive: false
    });

    const studio = getAuthorStudioItems(gitInput);
    assert.equal(studio.find((i) => i.id === 'git-sync')?.isActive, true);
  });
});
