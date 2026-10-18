import { Song, GitCommit, GitStatusSummary } from '../types/song';
import { INITIAL_SONGS } from '../data/initialSongs';
import { songToMarkdown, markdownToSong } from '../utils/markdownParser';

const STORAGE_KEY_SONGS = 'tony_cancionero_songs_v1';
const STORAGE_KEY_COMMITS = 'tony_cancionero_git_commits_v1';
const STORAGE_KEY_LAST_COMMITTED_SNAPSHOT = 'tony_cancionero_git_snapshot_v1';

export interface SongVersionRecord {
  commit: GitCommit;
  markdown: string;
  isCurrent: boolean;
}

// Initial commit history with real snapshots
const createInitialCommits = (): GitCommit[] => {
  const nochesOriginal = INITIAL_SONGS[0];
  const faroOriginal = INITIAL_SONGS[1];
  const raizOriginal = INITIAL_SONGS[2];
  const laberintoOriginal = INITIAL_SONGS[3];

  // An earlier version of Noches de Cristal without the bridge strings
  const nochesV1Markdown = `---
id: "noches-de-cristal"
title: "Noches de Cristal"
status: "draft"
year: 2024
genre: "Indie Folk / Autor"
key: "Am"
tempo: 90
tuning: "Estándar (EADGBE)"
notes: "Primer borrador compuesto en casa con guitarra española."
createdAt: "2024-04-10T12:00:00Z"
updatedAt: "2024-05-12T16:00:00Z"
---

## Estrofa 1
[Am] Caminando por la calle ancha de los [F] faroles rotos,
[C] voy juntando en el bolsillo pedazos [G] de viejas fotos.
[Am] El asfalto devuelve un brillo [F] de plata y frío,
[C] mientras la ciudad olvida que alguna vez [G] tuviste un río.

## Estribillo (Borrador inicial)
[F] Y en estas noches de [C] cristal,
[G] donde nadie se atreve [Am] a hablar,
[F] dejamos la persiana [C] abierta
[G] para ver el tiempo [Am] pasar.`;

  // Earlier version of Laberintos de Otoño
  const laberintoV1Markdown = `---
id: "laberintos-de-otono"
title: "Laberintos de Otoño"
status: "draft"
year: 2026
genre: "Canción de Autor / Acústica"
key: "Em"
tempo: 94
tuning: "Estándar (EADGBE)"
notes: "Apunte rápido de acordes para no olvidar la melodía."
createdAt: "2026-02-10T10:00:00Z"
updatedAt: "2026-02-10T10:00:00Z"
---

## Estrofa 1
[Em] Caían las hojas como billetes viejos
[C] sobre los bancos de hierro del bulevar.
[G] Nos prometimos mirarnos desde lejos
[D] sin la tentación de volver a cruzar.`;

  return [
    {
      hash: 'a108f92',
      message: 'init: estructura inicial y primeros acordes de "Noches de Cristal"',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2024-05-12T16:00:00Z',
      filesChanged: ['songs/noches-de-cristal.md'],
      snapshot: {
        'noches-de-cristal': nochesV1Markdown
      }
    },
    {
      hash: 'b319e41',
      message: 'feat: agrega puente lírico, arreglos y publicación de "Noches de Cristal"',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2025-01-15T18:30:00Z',
      filesChanged: ['songs/noches-de-cristal.md'],
      snapshot: {
        'noches-de-cristal': songToMarkdown(nochesOriginal)
      }
    },
    {
      hash: 'c4e819b',
      message: 'feat: agrega balada en 3/4 "Faro de Sal" con afinación Drop D',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2025-08-20T11:15:00Z',
      filesChanged: ['songs/faro-de-sal.md'],
      snapshot: {
        'faro-de-sal': songToMarkdown(faroOriginal)
      }
    },
    {
      hash: 'e1d93aa',
      message: 'release: publicación oficial de "La Raíz del Viento" en Spotify',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2025-11-04T16:45:00Z',
      filesChanged: ['songs/la-raiz-del-viento.md'],
      snapshot: {
        'la-raiz-del-viento': songToMarkdown(raizOriginal)
      }
    },
    {
      hash: '93f0b42',
      message: 'draft: primeros compases y apuntes líricos de "Laberintos de Otoño"',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2026-02-10T10:00:00Z',
      filesChanged: ['songs/laberintos-de-otono.md'],
      snapshot: {
        'laberintos-de-otono': laberintoV1Markdown
      }
    },
    {
      hash: '7d41f0a',
      message: 'update: revisión de estrofa 2 e ideas para el estribillo de "Laberintos de Otoño"',
      author: 'Tony <tony@tonygb.com>',
      timestamp: '2026-10-15T09:20:00Z',
      filesChanged: ['songs/laberintos-de-otono.md'],
      snapshot: {
        'laberintos-de-otono': songToMarkdown(laberintoOriginal)
      }
    }
  ];
};

export class StorageService {
  /**
   * Load all songs from local storage or initial seed
   */
  static getSongs(): Song[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SONGS);
      if (stored) {
        const songs: Song[] = JSON.parse(stored);
        let updated = false;
        const migrated = songs.map(song => {
          if (!song.tags || song.tags.length === 0) {
            const initial = INITIAL_SONGS.find(i => i.id === song.id);
            if (initial?.tags) {
              updated = true;
              return { ...song, tags: initial.tags };
            }
          }
          return song;
        });
        if (updated) {
          this.saveSongs(migrated);
        }
        return migrated;
      }
    } catch (e) {
      console.warn('Failed to parse songs from storage', e);
    }
    // Seed initial
    this.saveSongs(INITIAL_SONGS);
    this.saveSnapshot(INITIAL_SONGS);
    return INITIAL_SONGS;
  }

  /**
   * Save songs collection to local storage
   */
  static saveSongs(songs: Song[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_SONGS, JSON.stringify(songs));
    } catch (e) {
      console.error('Failed to save songs', e);
    }
  }

  /**
   * Save or update a single song
   */
  static upsertSong(song: Song): Song[] {
    const songs = this.getSongs();
    const existingIndex = songs.findIndex(s => s.id === song.id);
    const updatedSong: Song = {
      ...song,
      updatedAt: new Date().toISOString()
    };

    let updatedList: Song[];
    if (existingIndex >= 0) {
      updatedList = [...songs];
      updatedList[existingIndex] = updatedSong;
    } else {
      updatedList = [updatedSong, ...songs];
    }

    this.saveSongs(updatedList);
    return updatedList;
  }

  /**
   * Delete a song by ID
   */
  static deleteSong(id: string): Song[] {
    const songs = this.getSongs();
    const filtered = songs.filter(s => s.id !== id);
    this.saveSongs(filtered);
    return filtered;
  }

  /**
   * Get Git commit history
   */
  static getCommits(): GitCommit[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMMITS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse git commits', e);
    }
    const initial = createInitialCommits();
    this.saveCommits(initial);
    return initial;
  }

  static saveCommits(commits: GitCommit[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_COMMITS, JSON.stringify(commits));
    } catch (e) {
      console.error('Failed to save commits', e);
    }
  }

  /**
   * Snapshot dictionary of committed markdown content by song ID
   */
  static getSnapshot(): Record<string, string> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse snapshot', e);
    }
    return {};
  }

  static saveSnapshot(songs: Song[]): void {
    const snapshot: Record<string, string> = {};
    songs.forEach(s => {
      snapshot[s.id] = songToMarkdown(s);
    });
    localStorage.setItem(STORAGE_KEY_LAST_COMMITTED_SNAPSHOT, JSON.stringify(snapshot));
  }

  /**
   * Calculate git status against the last committed snapshot
   */
  static getGitStatus(): GitStatusSummary {
    const currentSongs = this.getSongs();
    const snapshot = this.getSnapshot();

    const modified: string[] = [];
    const created: string[] = [];
    const deleted: string[] = [];

    const currentMap = new Map<string, Song>();
    currentSongs.forEach(s => currentMap.set(s.id, s));

    // Check current songs against snapshot
    currentSongs.forEach(song => {
      const committedMarkdown = snapshot[song.id];
      if (!committedMarkdown) {
        created.push(`songs/${song.id}.md`);
      } else {
        const currentMarkdown = songToMarkdown(song);
        if (currentMarkdown.trim() !== committedMarkdown.trim()) {
          modified.push(`songs/${song.id}.md`);
        }
      }
    });

    // Check for deleted
    Object.keys(snapshot).forEach(songId => {
      if (!currentMap.has(songId)) {
        deleted.push(`songs/${songId}.md`);
      }
    });

    const isClean = modified.length === 0 && created.length === 0 && deleted.length === 0;

    return {
      modified,
      created,
      deleted,
      isClean
    };
  }

  /**
   * Create a new Git commit recording current files state
   */
  static createGitCommit(message: string, author: string = 'Tony <tony@tonygb.com>'): { commit: GitCommit; status: GitStatusSummary } {
    const songs = this.getSongs();
    const status = this.getGitStatus();

    const filesChanged = [...status.created, ...status.modified, ...status.deleted];
    if (filesChanged.length === 0) {
      filesChanged.push('catalog.json');
    }

    const hash = Math.random().toString(16).substring(2, 9);
    const newCommit: GitCommit = {
      hash,
      message: message.trim() || `chore: actualización del cancionero (${new Date().toLocaleDateString('es-ES')})`,
      author,
      timestamp: new Date().toISOString(),
      filesChanged,
      snapshot: {}
    };

    // Store markdown snapshot for rollback
    songs.forEach(s => {
      newCommit.snapshot[s.id] = songToMarkdown(s);
    });

    // Update commits list
    const currentCommits = this.getCommits();
    const updatedCommits = [newCommit, ...currentCommits];
    this.saveCommits(updatedCommits);

    // Save current state as baseline snapshot
    this.saveSnapshot(songs);

    return {
      commit: newCommit,
      status: this.getGitStatus()
    };
  }

  /**
   * Retrieve the version history specifically associated with a single song
   */
  static getSongVersionHistory(songId: string): SongVersionRecord[] {
    const commits = this.getCommits();
    const currentSongs = this.getSongs();
    const currentSong = currentSongs.find(s => s.id === songId);
    const currentMarkdown = currentSong ? songToMarkdown(currentSong) : '';

    const records: SongVersionRecord[] = [];

    // Filter commits that touched this song or have a snapshot for it
    commits.forEach(commit => {
      const hasChangedFile = commit.filesChanged?.some(f => f.includes(songId));
      const snapshotMarkdown = commit.snapshot?.[songId];

      if (snapshotMarkdown || hasChangedFile) {
        const md = snapshotMarkdown || currentMarkdown;
        records.push({
          commit,
          markdown: md,
          isCurrent: md.trim() === currentMarkdown.trim()
        });
      }
    });

    // Ensure there is at least one record (the current version)
    if (records.length === 0 && currentSong) {
      records.push({
        commit: {
          hash: currentSong.gitHash || 'head-current',
          message: `Estado actual de la composición "${currentSong.title}"`,
          author: 'Tony <tony@tonygb.com>',
          timestamp: currentSong.updatedAt,
          filesChanged: [`songs/${songId}.md`],
          snapshot: { [songId]: currentMarkdown }
        },
        markdown: currentMarkdown,
        isCurrent: true
      });
    }

    return records;
  }

  /**
   * Revert a song to a previous historical version
   */
  static restoreSongVersion(songId: string, markdown: string, commitHash: string): Song {
    const restored = markdownToSong(markdown, songId);
    this.upsertSong(restored);
    this.createGitCommit(`revert: restaurar versión [${commitHash}] de '${restored.title}'`);
    return restored;
  }

  /**
   * Reset data to initial demo state
   */
  static resetToDefault(): Song[] {
    this.saveSongs(INITIAL_SONGS);
    this.saveSnapshot(INITIAL_SONGS);
    const initialCommits = createInitialCommits();
    this.saveCommits(initialCommits);
    return INITIAL_SONGS;
  }

  /**
   * Import songs from JSON string
   */
  static importFromJson(jsonString: string): { success: boolean; count: number; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data)) {
        throw new Error('El archivo JSON debe contener un arreglo de canciones.');
      }
      const existing = this.getSongs();
      const existingMap = new Map(existing.map(s => [s.id, s]));

      let addedOrUpdated = 0;
      data.forEach(item => {
        if (item.id && item.title) {
          existingMap.set(item.id, {
            ...item,
            status: item.status || 'draft',
            lyrics: item.lyrics || '',
            updatedAt: new Date().toISOString()
          });
          addedOrUpdated++;
        }
      });

      const merged = Array.from(existingMap.values());
      this.saveSongs(merged);
      return { success: true, count: addedOrUpdated };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Error al procesar JSON' };
    }
  }

  /**
   * Import a single Markdown file
   */
  static importFromMarkdown(filename: string, content: string): { success: boolean; song?: Song; error?: string } {
    try {
      const fallbackId = filename.replace(/\.md$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const song = markdownToSong(content, fallbackId);
      this.upsertSong(song);
      return { success: true, song };
    } catch (e: any) {
      return { success: false, error: e.message || 'Error al procesar Markdown' };
    }
  }
}
