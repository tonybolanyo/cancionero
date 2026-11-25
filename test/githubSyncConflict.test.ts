import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Song } from '../src/types/song';
import { songToMarkdown } from '../src/utils/markdownParser';

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, String(value)); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
  get length() { return storageMap.size; }
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  });
}

import { GitHubSyncService } from '../src/services/githubSyncService';
import { StorageService } from '../src/services/storageService';

const originalFetch = global.fetch;
const originalWindow = (globalThis as any).window;

const encodeUtf8Base64 = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64');

const makeSong = (overrides: Partial<Song> = {}): Song => ({
  id: 'cancion-sync',
  title: 'Canción Sync',
  status: 'published',
  year: 2025,
  genre: 'Cantautor',
  key: 'C',
  lyrics: '## Estrofa\n[C] Letra inicial',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

describe('CAL-03: GitHubSyncService conflict merge & sync resilience', () => {
  beforeEach(async () => {
    localStorage.clear();
    await StorageService.resetForTesting(true);
    GitHubSyncService.resetSyncStateForTesting();
    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = { btoa: globalThis.btoa, atob: globalThis.atob };
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
    GitHubSyncService.resetSyncStateForTesting();
  });

  it('merges remote GitHub API catalog with local conflicts: keeps newer local draft, accepts newer remote edit with backup, and preserves local-only song', async () => {
    const baseLocalWins = makeSong({
      id: 'tema-local-gana',
      title: 'Título base A',
      lyrics: '[C] Base A',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    const localDraftNewer = makeSong({
      id: 'tema-local-gana',
      title: 'Borrador local más reciente',
      lyrics: '[C] Letra editada hoy',
      updatedAt: '2026-05-01T12:00:00.000Z'
    });

    const baseRemoteWins = makeSong({
      id: 'tema-remoto-gana',
      title: 'Título base B',
      lyrics: '[Am] Base B',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    const localEditedOlder = makeSong({
      id: 'tema-remoto-gana',
      title: 'Edición local antigua',
      lyrics: '[Am] Cambio local viejo',
      updatedAt: '2026-02-01T00:00:00.000Z'
    });

    const localOnly = makeSong({
      id: 'borrador-sin-subir',
      title: 'Idea Nueva Sin Push',
      status: 'draft',
      updatedAt: '2026-05-02T00:00:00.000Z'
    });

    StorageService.saveSongs([localDraftNewer, localEditedOlder, localOnly]);
    localStorage.setItem(
      'tony_cancionero_git_snapshot_v1',
      JSON.stringify({
        [baseLocalWins.id]: songToMarkdown(baseLocalWins),
        [baseRemoteWins.id]: songToMarkdown(baseRemoteWins)
      })
    );

    const remoteCatalog: Song[] = [
      makeSong({
        id: 'tema-local-gana',
        title: 'Versión remota vieja',
        lyrics: '[C] Remota vieja',
        updatedAt: '2026-03-01T00:00:00.000Z'
      }),
      makeSong({
        id: 'tema-remoto-gana',
        title: 'Versión remota ganadora (con ñ y acentós)',
        lyrics: '[Am] Letra remota más nueva',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }),
      makeSong({
        id: 'tema-nuevo-remoto',
        title: 'Canción Nueva en GitHub',
        lyrics: '[G] Añadida desde otro dispositivo',
        updatedAt: '2026-06-02T00:00:00.000Z'
      })
    ];

    global.fetch = (async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ etag: 'W/"etag-v2"' }),
      json: async () => ({
        sha: 'remote-sha-999',
        content: encodeUtf8Base64(JSON.stringify(remoteCatalog))
      })
    })) as unknown as typeof fetch;

    const result = await GitHubSyncService.syncCatalogFromRemote('ghp_valid_token', {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    assert.equal(result.success, true);
    assert.equal(result.source, 'remote');
    assert.equal(result.notModified, false);
    assert.equal(result.etag, 'W/"etag-v2"');
    assert.equal(GitHubSyncService.getCatalogETag(), 'W/"etag-v2"');

    const byId = new Map((result.songs || []).map(s => [s.id, s]));
    assert.equal(byId.get('tema-local-gana')?.title, 'Borrador local más reciente');
    assert.equal(byId.get('tema-remoto-gana')?.title, 'Versión remota ganadora (con ñ y acentós)');
    assert.equal(byId.get('tema-nuevo-remoto')?.title, 'Canción Nueva en GitHub');
    assert.equal(byId.get('borrador-sin-subir')?.title, 'Idea Nueva Sin Push');

    // A pre_sync backup should have been captured before overwriting localEditedOlder
    const backups = StorageService.getBackupPoints();
    assert.equal(backups.length, 1);
    assert.equal(backups[0].reason, 'pre_sync');
  });

  it('honors ETag 304 Not Modified and bypasses If-None-Match when forceReload is true', async () => {
    const localSong = makeSong({ id: 'tema-304', title: 'Tema Cacheado' });
    StorageService.saveSongs([localSong]);
    StorageService.saveSnapshot([localSong]);
    GitHubSyncService.saveCatalogETag('"etag-cached"');

    const capturedHeaders: Array<Record<string, string>> = [];

    global.fetch = (async (_url: any, init: any) => {
      capturedHeaders.push(init?.headers || {});
      if (init?.headers?.['If-None-Match'] === '"etag-cached"') {
        return {
          ok: false,
          status: 304,
          headers: new Headers({ etag: '"etag-cached"' })
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"etag-fresh"' }),
        json: async () => ({
          sha: 'sha-fresh',
          content: encodeUtf8Base64(JSON.stringify([localSong]))
        })
      } as unknown as Response;
    }) as typeof fetch;

    const cachedRes = await GitHubSyncService.syncCatalogFromRemote('ghp_token', {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    assert.equal(cachedRes.success, true);
    assert.equal(cachedRes.notModified, true);
    assert.equal(capturedHeaders[0]['If-None-Match'], '"etag-cached"');

    const forcedRes = await GitHubSyncService.syncCatalogFromRemote(
      'ghp_token',
      { owner: 'tonygb', repo: 'cancionero', branch: 'main' },
      { forceReload: true }
    );

    assert.equal(forcedRes.success, true);
    assert.equal(forcedRes.notModified, false);
    assert.equal(capturedHeaders[1]['If-None-Match'], undefined);
    assert.equal(GitHubSyncService.getCatalogETag(), '"etag-fresh"');
  });

  it('falls back cleanly from GitHub API -> CDN -> static catalog -> local offline state', async () => {
    const localSong = makeSong({ id: 'local-only-song', title: 'Local Offline' });
    StorageService.saveSongs([localSong]);
    StorageService.saveSnapshot([localSong]);

    // 1. CDN fallback succeeds when API fails
    global.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('raw.githubusercontent.com')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ etag: '"cdn-etag"' }),
          json: async () => [makeSong({ id: 'cdn-song', title: 'Desde CDN' })]
        } as unknown as Response;
      }
      return { ok: false, status: 500, headers: new Headers() } as Response;
    }) as typeof fetch;

    const cdnRes = await GitHubSyncService.syncCatalogFromRemote('ghp_token', {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    assert.equal(cdnRes.success, true);
    assert.equal(cdnRes.source, 'remote');
    assert.ok(cdnRes.songs?.some(s => s.id === 'cdn-song'));

    // 2. All remote sources unreachable -> falls back gracefully to local songs without losing local drafts
    localStorage.clear();
    StorageService.saveSongs([localSong]);

    global.fetch = (async () => {
      throw new Error('Network offline');
    }) as typeof fetch;

    const offlineRes = await GitHubSyncService.syncCatalogFromRemote(null, {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    assert.equal(offlineRes.success, true);
    assert.equal(offlineRes.source, 'local');
    assert.ok(offlineRes.songs?.some(s => s.id === 'local-only-song'));
  });

  it('handles pushSongFile authentication, permission/conflict errors, and atomic Git Data API commits (songs/{id}.md + catalog.json + albums.json)', async () => {
    const song = makeSong({ id: 'tema-push', title: 'Tema Español Ñ' });

    const noTokenRes = await GitHubSyncService.pushSongFile(song, 'test', '');
    assert.equal(noTokenRes.success, false);

    // 403 Forbidden on git/ref -> requiresPermissions: true
    global.fetch = (async () => {
      return { ok: false, status: 403, statusText: 'Forbidden', json: async () => ({ message: 'Forbidden' }) } as Response;
    }) as typeof fetch;

    const forbiddenRes = await GitHubSyncService.pushSongFile(song, 'feat: test', 'bad_token');
    assert.equal(forbiddenRes.success, false);
    assert.equal(forbiddenRes.requiresPermissions, true);

    // Full Git Data API atomic commit sequence
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    let blobCounter = 0;

    global.fetch = (async (input: string | URL | Request, init?: any) => {
      const url = String(input);
      const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body });

      if (url.endsWith('/git/ref/heads/main') && method === 'GET') {
        return { ok: true, status: 200, json: async () => ({ object: { sha: 'base-commit-sha-111' } }) } as Response;
      }
      if (url.endsWith('/git/commits/base-commit-sha-111') && method === 'GET') {
        return { ok: true, status: 200, json: async () => ({ sha: 'base-commit-sha-111', tree: { sha: 'base-tree-sha-222' } }) } as Response;
      }
      if (url.endsWith('/git/blobs') && method === 'POST') {
        blobCounter += 1;
        return { ok: true, status: 201, json: async () => ({ sha: `blob-sha-${blobCounter}` }) } as Response;
      }
      if (url.endsWith('/git/trees') && method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ sha: 'new-tree-sha-333' }) } as Response;
      }
      if (url.endsWith('/git/commits') && method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            sha: 'abcdef1234567890',
            html_url: 'https://github.com/tonygb/cancionero/commit/abcdef1234567890'
          })
        } as Response;
      }
      if (url.endsWith('/git/refs/heads/main') && method === 'PATCH') {
        return { ok: true, status: 200, json: async () => ({ object: { sha: 'abcdef1234567890' } }) } as Response;
      }
      return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) } as Response;
    }) as typeof fetch;

    const okRes = await GitHubSyncService.pushSongFile(song, 'feat: actualizar tema', 'good_token', {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    assert.equal(okRes.success, true);
    assert.equal(okRes.commitSha, 'abcdef1');
    assert.deepEqual(okRes.filesCommitted, ['songs/tema-push.md', 'catalog.json', 'albums.json']);

    // Verify Git Data API stages in order
    const blobCalls = calls.filter(c => c.url.endsWith('/git/blobs'));
    assert.equal(blobCalls.length, 3);
    const decodedBlobs = blobCalls.map(c => Buffer.from(c.body.content, 'base64').toString('utf8'));
    assert.ok(decodedBlobs.some(txt => txt.includes('Tema Español Ñ') && txt.includes('---')));
    assert.ok(decodedBlobs.some(txt => {
      try {
        const parsed = JSON.parse(txt);
        return Array.isArray(parsed) && parsed.some((s: any) => s.id === 'tema-push');
      } catch {
        return false;
      }
    }));
    assert.ok(decodedBlobs.some(txt => {
      try {
        const parsed = JSON.parse(txt);
        return Array.isArray(parsed) && parsed.some((a: any) => a.tracks);
      } catch {
        return false;
      }
    }));

    const treeCall = calls.find(c => c.url.endsWith('/git/trees'));
    assert.equal(treeCall?.body.base_tree, 'base-tree-sha-222');
    assert.deepEqual(
      treeCall?.body.tree.map((t: any) => t.path),
      ['songs/tema-push.md', 'catalog.json', 'albums.json']
    );

    const commitCall = calls.find(c => c.url.endsWith('/git/commits') && c.method === 'POST');
    assert.equal(commitCall?.body.tree, 'new-tree-sha-333');
    assert.deepEqual(commitCall?.body.parents, ['base-commit-sha-111']);

    const patchCall = calls.find(c => c.url.endsWith('/git/refs/heads/main') && c.method === 'PATCH');
    assert.equal(patchCall?.body.sha, 'abcdef1234567890');
    assert.equal(patchCall?.body.force, false);
  });
});

describe('CAL-06: Atomic Git Data API commits, sync reentrancy lock & SHA/timestamp protection', () => {
  beforeEach(async () => {
    localStorage.clear();
    await StorageService.resetForTesting(true);
    GitHubSyncService.resetSyncStateForTesting();
    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = { btoa: globalThis.btoa, atob: globalThis.atob };
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
    GitHubSyncService.resetSyncStateForTesting();
  });

  it('pushFullCatalog commits modified songs/*.md + deleted songs/*.md + catalog.json + albums.json in one atomic commit', async () => {
    const baseSong = makeSong({ id: 'tema-existente', title: 'Base', lyrics: '[C] Base' });
    const deletedSong = makeSong({ id: 'tema-borrado', title: 'Borrado' });
    StorageService.saveSongs([baseSong, deletedSong]);
    StorageService.saveSnapshot([baseSong, deletedSong]);

    const editedSong = makeSong({ id: 'tema-existente', title: 'Editado Átomo', lyrics: '[G] Editado' });
    const newSong = makeSong({ id: 'tema-nuevo', title: 'Nuevo Átomo', lyrics: '[Am] Nuevo' });
    StorageService.saveSongs([editedSong, newSong]);

    const calls: Array<{ url: string; method: string; body?: any }> = [];
    let blobSeq = 0;

    global.fetch = (async (input: string | URL | Request, init?: any) => {
      const url = String(input);
      const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body });

      if (url.endsWith('/git/ref/heads/main')) {
        return { ok: true, status: 200, json: async () => ({ object: { sha: 'head-sha-001' } }) } as Response;
      }
      if (url.endsWith('/git/commits/head-sha-001')) {
        return { ok: true, status: 200, json: async () => ({ sha: 'head-sha-001', tree: { sha: 'base-tree-001' } }) } as Response;
      }
      if (url.endsWith('/git/blobs')) {
        blobSeq += 1;
        return { ok: true, status: 201, json: async () => ({ sha: `blob-${blobSeq}` }) } as Response;
      }
      if (url.endsWith('/git/trees')) {
        return { ok: true, status: 201, json: async () => ({ sha: 'tree-atomic-999' }) } as Response;
      }
      if (url.endsWith('/git/commits') && method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ sha: 'commit-atomic-777' }) } as Response;
      }
      if (url.endsWith('/git/refs/heads/main') && method === 'PATCH') {
        return { ok: true, status: 200, json: async () => ({ object: { sha: 'commit-atomic-777' } }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const res = await GitHubSyncService.pushFullCatalog(
      [editedSong, newSong],
      'feat: atomic multi-song sync',
      'valid_token',
      { owner: 'tonygb', repo: 'cancionero', branch: 'main' }
    );

    assert.equal(res.success, true);
    assert.equal(res.commitSha, 'commit-');

    const treeCall = calls.find(c => c.url.endsWith('/git/trees'));
    assert.ok(treeCall);
    const treeEntries = treeCall.body.tree as Array<{ path: string; sha: string | null }>;
    const paths = treeEntries.map(t => t.path);

    assert.ok(paths.includes('songs/tema-existente.md'));
    assert.ok(paths.includes('songs/tema-nuevo.md'));
    assert.ok(paths.includes('songs/tema-borrado.md'));
    assert.ok(paths.includes('catalog.json'));
    assert.ok(paths.includes('albums.json'));

    const deletedEntry = treeEntries.find(t => t.path === 'songs/tema-borrado.md');
    assert.equal(deletedEntry?.sha, null);

    // Only ONE commit created and ONE ref update
    assert.equal(calls.filter(c => c.url.endsWith('/git/commits') && c.method === 'POST').length, 1);
    assert.equal(calls.filter(c => c.url.endsWith('/git/refs/heads/main') && c.method === 'PATCH').length, 1);
  });

  it('pushSongFile with deletePaths atomically renames old .md to new .md alongside catalog.json & albums.json, and handles 409/422 branch conflicts', async () => {
    const renamed = makeSong({ id: 'nuevo-slug', title: 'Renombrado' });
    let patchStatus = 200;

    let lastTreeBody: any = null;
    global.fetch = (async (input: string | URL | Request, init?: any) => {
      const url = String(input);
      const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(init.body) : undefined;

      if (url.endsWith('/git/ref/heads/main') && method === 'GET') {
        return { ok: true, status: 200, json: async () => ({ object: { sha: 'head-1' } }) } as Response;
      }
      if (url.endsWith('/git/commits/head-1')) {
        return { ok: true, status: 200, json: async () => ({ sha: 'head-1', tree: { sha: 'tree-1' } }) } as Response;
      }
      if (url.endsWith('/git/blobs')) {
        return { ok: true, status: 201, json: async () => ({ sha: 'blob-x' }) } as Response;
      }
      if (url.endsWith('/git/trees')) {
        lastTreeBody = body;
        return { ok: true, status: 201, json: async () => ({ sha: 'tree-2' }) } as Response;
      }
      if (url.endsWith('/git/commits') && method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ sha: 'commit-2' }) } as Response;
      }
      if (url.endsWith('/git/refs/heads/main') && method === 'PATCH') {
        if (patchStatus !== 200) {
          return { ok: false, status: patchStatus, statusText: 'Unprocessable Entity', json: async () => ({ message: 'Update is not a fast forward' }) } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ object: { sha: 'commit-2' } }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as typeof fetch;

    const renameRes = await GitHubSyncService.pushSongFile(
      renamed,
      'refactor: rename',
      'valid_token',
      { owner: 'tonygb', repo: 'cancionero', branch: 'main' },
      { songs: [renamed], deletePaths: ['songs/antiguo-slug.md'] }
    );

    assert.equal(renameRes.success, true);
    const oldEntry = lastTreeBody.tree.find((t: any) => t.path === 'songs/antiguo-slug.md');
    const newEntry = lastTreeBody.tree.find((t: any) => t.path === 'songs/nuevo-slug.md');
    assert.equal(oldEntry?.sha, null);
    assert.equal(newEntry?.sha, 'blob-x');

    // Non-fast-forward conflict returns isConflict: true
    patchStatus = 422;
    const conflictRes = await GitHubSyncService.pushSongFile(
      renamed,
      'refactor: conflict',
      'valid_token',
      { owner: 'tonygb', repo: 'cancionero', branch: 'main' }
    );
    assert.equal(conflictRes.success, false);
    assert.equal(conflictRes.isConflict, true);
  });

  it('enforces anti-reentrancy concurrency lock in syncCatalogFromRemote so overlapping calls coalesce', async () => {
    const remoteSong = makeSong({ id: 'tema-concurrente', title: 'Concurrente' });
    StorageService.saveSongs([remoteSong]);
    StorageService.saveSnapshot([remoteSong]);

    let fetchCount = 0;
    let releaseFetch!: () => void;
    const fetchGate = new Promise<void>(resolve => {
      releaseFetch = resolve;
    });

    global.fetch = (async () => {
      fetchCount += 1;
      await fetchGate;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"etag-lock"' }),
        json: async () => ({
          sha: 'sha-lock-1',
          content: encodeUtf8Base64(JSON.stringify([remoteSong]))
        })
      } as unknown as Response;
    }) as typeof fetch;

    const p1 = GitHubSyncService.syncCatalogFromRemote('ghp_token', {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    assert.equal(GitHubSyncService.isSyncInProgress(), true);

    const p2 = GitHubSyncService.syncCatalogFromRemote('ghp_token', {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    releaseFetch();
    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(GitHubSyncService.isSyncInProgress(), false);
    assert.equal(fetchCount, 1);
    assert.equal(r1.success, true);
    assert.equal(r2.success, true);
    assert.equal(r2.coalesced, true);
  });

  it('protects uncommitted local creations and snapshot-unchanged remote entries via SHA and updatedAt checks', async () => {
    // 1. Uncommitted local creation without snapshot entry (newer local updatedAt) must NOT be overwritten
    const localNewerSameId = makeSong({
      id: 'tema-sin-snapshot',
      title: 'Borrador Local Reciente',
      lyrics: '[G] Versión local',
      updatedAt: '2026-08-01T12:00:00.000Z'
    });
    // 2. Uncommitted local edit whose base snapshot still matches remote must NOT be overwritten even if timestamps skew
    const baseSnapshot = makeSong({
      id: 'tema-base-remoto-igual',
      title: 'Versión Base',
      lyrics: '[C] Base',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    const localEditedOlderClock = makeSong({
      id: 'tema-base-remoto-igual',
      title: 'Edición Local Con Reloj Atrasado',
      lyrics: '[C] Edición local no confirmada',
      updatedAt: '2025-12-01T00:00:00.000Z'
    });

    StorageService.saveSongs([localNewerSameId, localEditedOlderClock]);
    StorageService.saveSnapshot([baseSnapshot]);

    const remoteCatalog: Song[] = [
      makeSong({
        id: 'tema-sin-snapshot',
        title: 'Versión Remota Antigua',
        lyrics: '[G] Remota vieja',
        updatedAt: '2026-05-01T00:00:00.000Z'
      }),
      baseSnapshot
    ];

    let networkCalls = 0;
    global.fetch = (async () => {
      networkCalls += 1;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"etag-sha-1"' }),
        json: async () => ({
          sha: 'remote-sha-unchanged',
          content: encodeUtf8Base64(JSON.stringify(remoteCatalog))
        })
      } as unknown as Response;
    }) as typeof fetch;

    const firstSync = await GitHubSyncService.syncCatalogFromRemote('ghp_token', {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    assert.equal(firstSync.success, true);
    const firstById = new Map((firstSync.songs || []).map(s => [s.id, s]));
    assert.equal(firstById.get('tema-sin-snapshot')?.title, 'Borrador Local Reciente');
    assert.equal(firstById.get('tema-base-remoto-igual')?.title, 'Edición Local Con Reloj Atrasado');
    assert.ok(firstSync.preservedLocalIds?.includes('tema-sin-snapshot'));
    assert.ok(firstSync.preservedLocalIds?.includes('tema-base-remoto-igual'));

    // 3. Subsequent sync returning the exact same remote SHA short-circuits with notModified: true
    GitHubSyncService.clearCatalogETag();
    const secondSync = await GitHubSyncService.syncCatalogFromRemote('ghp_token', {
      owner: 'tonygb',
      repo: 'cancionero',
      branch: 'main'
    });

    assert.equal(networkCalls, 2);
    assert.equal(secondSync.success, true);
    assert.equal(secondSync.notModified, true);
    const secondById = new Map((secondSync.songs || []).map(s => [s.id, s]));
    assert.equal(secondById.get('tema-sin-snapshot')?.title, 'Borrador Local Reciente');
  });
});

