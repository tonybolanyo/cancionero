import { Song } from '../types/song';
import { markdownToSong } from '../utils/markdownParser';

// Dynamically load every song markdown file from /src/songs/
// This ensures each song lives in its own dedicated .md file in the repo
const songFiles = import.meta.glob('../songs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

export function loadSongsFromMarkdownFiles(): Song[] {
  const loadedSongs: Song[] = [];
  
  for (const [filePath, content] of Object.entries(songFiles)) {
    // Extract filename without path and extension as fallback ID (e.g., 'noches-de-cristal')
    const filename = filePath.split('/').pop()?.replace(/\.md$/, '') || '';
    try {
      const song = markdownToSong(content, filename);
      loadedSongs.push(song);
    } catch (err) {
      console.error(`Failed to parse song from ${filePath}`, err);
    }
  }

  // Consistent ordering: published first, then drafts, then private; then sorted by year/recency
  return loadedSongs.sort((a, b) => {
    const statusOrder: Record<string, number> = { published: 1, draft: 2, private: 3 };
    const orderDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (orderDiff !== 0) return orderDiff;
    return (b.year || 0) - (a.year || 0);
  });
}

export const INITIAL_SONGS: Song[] = loadSongsFromMarkdownFiles();
