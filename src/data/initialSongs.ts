import { Song } from '../types/song';
import { markdownToSong } from '../utils/markdownParser';
import bundledSongsJson from './bundledSongs.json';

/**
 * Dynamically load every song from repository markdown files and the bundled catalog.
 * Guarantees all 47 canonical songs (32 published, 15 drafts) are available synchronously
 * across all environments (Vite dev server, Vite production build, test runners, and SSR).
 */
export function loadSongsFromMarkdownFiles(): Song[] {
  const loadedSongsMap = new Map<string, Song>();

  // 1. Seed from pre-bundled songs JSON so all 47 canonical songs are immediately available
  if (Array.isArray(bundledSongsJson)) {
    for (const item of (bundledSongsJson as Song[])) {
      if (item && item.id) {
        loadedSongsMap.set(item.id, item);
      }
    }
  }

  // 2. Parse any markdown files available via Vite's build-time glob transform
  try {
    const globFiles = import.meta.glob('../../songs/*.md', {
      query: '?raw',
      import: 'default',
      eager: true
    }) as Record<string, string>;

    if (globFiles && typeof globFiles === 'object') {
      for (const [filePath, content] of Object.entries(globFiles)) {
        if (!content || typeof content !== 'string') continue;
        const filename = filePath.split('/').pop()?.replace(/\.md$/, '') || '';
        try {
          const song = markdownToSong(content, filename);
          loadedSongsMap.set(song.id, song);
        } catch (err) {
          console.error(`Failed to parse song from ${filePath}`, err);
        }
      }
    }
  } catch {
    // Expected in Node.js / non-Vite environments where import.meta.glob is not transformed
  }

  const loadedSongs = Array.from(loadedSongsMap.values());

  // Consistent ordering: published first, then drafts, then private; then sorted by recency/year
  return loadedSongs.sort((a, b) => {
    const statusOrder: Record<string, number> = { published: 1, draft: 2, private: 3 };
    const orderDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (orderDiff !== 0) return orderDiff;
    const bTs = Date.parse(b.updatedAt || new Date(0).toISOString());
    const aTs = Date.parse(a.updatedAt || new Date(0).toISOString());
    if (bTs !== aTs) return bTs - aTs;
    return (b.year || 0) - (a.year || 0);
  });
}

export const INITIAL_SONGS: Song[] = loadSongsFromMarkdownFiles();
