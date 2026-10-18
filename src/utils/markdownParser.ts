import { Song, SongStatus } from '../types/song';
import JSZip from 'jszip';

// Musical notes scale for chord transposition
const CHROMATIC_SCALE_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_SCALE_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map flats to sharps index
const NOTE_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

/**
 * Transpose a single chord symbol by N semitones
 * e.g. "Am7" + 2 semitones -> "Bm7"
 */
export function transposeChord(chord: string, semitones: number): string {
  if (semitones === 0) return chord;

  // Match root note (e.g. C, C#, Bb) and chord suffix (m, 7, maj7, sus4, /G)
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;

  const root = match[1];
  const suffix = match[2];

  // If there's a bass note like C/E, transpose the bass note as well
  if (suffix.includes('/')) {
    const [mainSuffix, bass] = suffix.split('/');
    const transposedRoot = shiftNote(root, semitones);
    const transposedBass = shiftNote(bass, semitones);
    return `${transposedRoot}${mainSuffix}/${transposedBass}`;
  }

  const transposedRoot = shiftNote(root, semitones);
  return `${transposedRoot}${suffix}`;
}

function shiftNote(note: string, semitones: number): string {
  const currentSemitone = NOTE_TO_SEMITONE[note];
  if (currentSemitone === undefined) return note;

  let newSemitone = (currentSemitone + semitones) % 12;
  if (newSemitone < 0) newSemitone += 12;

  // Choose sharps by default unless original had flat
  const useFlats = note.includes('b');
  return useFlats ? CHROMATIC_SCALE_FLATS[newSemitone] : CHROMATIC_SCALE_SHARPS[newSemitone];
}

/**
 * Transpose all chords enclosed in brackets [Am] inside lyrics text
 */
export function transposeLyrics(lyrics: string, semitones: number): string {
  if (semitones === 0) return lyrics;
  return lyrics.replace(/\[([A-G][#b]?[^\]]*)\]/g, (_, chord) => {
    return `[${transposeChord(chord, semitones)}]`;
  });
}

/**
 * Serialize a Song object to Markdown with YAML frontmatter
 */
export function songToMarkdown(song: Song): string {
  const frontmatter = [
    '---',
    `id: "${song.id}"`,
    `title: "${song.title.replace(/"/g, '\\"')}"`,
    `status: "${song.status}"`,
    `year: ${song.year}`,
    `genre: "${song.genre.replace(/"/g, '\\"')}"`,
    `key: "${song.key}"`,
    song.tempo ? `tempo: ${song.tempo}` : null,
    song.timeSignature ? `timeSignature: "${song.timeSignature}"` : null,
    song.tuning ? `tuning: "${song.tuning}"` : null,
    song.duration ? `duration: "${song.duration}"` : null,
    song.spotifyUrl ? `spotifyUrl: "${song.spotifyUrl}"` : null,
    song.youtubeUrl ? `youtubeUrl: "${song.youtubeUrl}"` : null,
    song.soundcloudUrl ? `soundcloudUrl: "${song.soundcloudUrl}"` : null,
    song.audioUrl ? `audioUrl: "${song.audioUrl}"` : null,
    song.notes ? `notes: "${song.notes.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"` : null,
    `createdAt: "${song.createdAt}"`,
    `updatedAt: "${song.updatedAt}"`,
    '---',
    '',
    song.lyrics.trim()
  ].filter(Boolean).join('\n');

  return frontmatter;
}

/**
 * Parse Markdown with YAML frontmatter into a Song object
 */
export function markdownToSong(markdown: string, fallbackId?: string): Song {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  const now = new Date().toISOString();

  if (!match) {
    // If no frontmatter, treat whole file as lyrics
    return {
      id: fallbackId || `cancion-${Date.now()}`,
      title: fallbackId ? fallbackId.replace(/-/g, ' ') : 'Canción sin título',
      status: 'draft',
      year: new Date().getFullYear(),
      genre: 'Canción de Autor',
      key: 'C',
      lyrics: markdown.trim(),
      createdAt: now,
      updatedAt: now
    };
  }

  const frontmatterRaw = match[1];
  const lyricsBody = match[2].trim();

  const meta: Record<string, string> = {};
  const lines = frontmatterRaw.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Unquote if wrapped in quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      meta[key] = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }

  const id = meta.id || fallbackId || meta.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `song-${Date.now()}`;
  const status: SongStatus = (meta.status === 'published' || meta.status === 'draft' || meta.status === 'private') 
    ? meta.status 
    : 'draft';

  return {
    id,
    title: meta.title || 'Sin título',
    status,
    year: meta.year ? parseInt(meta.year, 10) : new Date().getFullYear(),
    genre: meta.genre || 'Acústica',
    key: meta.key || 'Am',
    tempo: meta.tempo ? parseInt(meta.tempo, 10) : undefined,
    timeSignature: meta.timeSignature,
    tuning: meta.tuning,
    duration: meta.duration,
    spotifyUrl: meta.spotifyUrl || undefined,
    youtubeUrl: meta.youtubeUrl || undefined,
    soundcloudUrl: meta.soundcloudUrl || undefined,
    audioUrl: meta.audioUrl || undefined,
    notes: meta.notes || undefined,
    lyrics: lyricsBody,
    createdAt: meta.createdAt || now,
    updatedAt: meta.updatedAt || now
  };
}

/**
 * Extract YouTube embed video ID
 */
export function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  // formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=0&rel=0`;
  }
  return null;
}

/**
 * Extract Spotify Embed URL
 */
export function getSpotifyEmbedUrl(url?: string): string | null {
  if (!url) return null;
  // formats: open.spotify.com/track/ID
  const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
  if (trackMatch && trackMatch[1]) {
    return `https://open.spotify.com/embed/track/${trackMatch[1]}?utm_source=generator&theme=0`;
  }
  return null;
}

/**
 * Generate a complete ZIP archive for Git repository download
 */
export async function generateGitRepositoryZip(songs: Song[]): Promise<Blob> {
  const zip = new JSZip();

  // Create directory structure:
  // /songs/
  //   cancion-1.md
  //   cancion-2.md
  // /catalog.json
  // /README.md
  // /.gitignore

  const songsFolder = zip.folder('songs');

  songs.forEach(song => {
    const markdown = songToMarkdown(song);
    songsFolder?.file(`${song.id}.md`, markdown);
  });

  // catalog.json
  zip.file('catalog.json', JSON.stringify(songs, null, 2));

  // README.md
  const readmeContent = `# Archivo de Canciones de Autor

Este repositorio contiene la colección de canciones originales compuestas por Tony.
Cada tema se almacena de forma independiente como archivo Markdown (.md) con cabecera YAML (frontmatter) y letra con acordes anotados en formato \`[Acorde]\`.

## Estructura del Repositorio
- \`/songs/\`: Archivos individuales en Markdown para cada tema (publicados, borradores y privados).
- \`catalog.json\`: Catálogo serializado completo con metadatos musicales (tonalidad, tempo, compás, afinación y enlaces a Spotify, YouTube y SoundCloud).

## Sincronización con Git
Para versionar los cambios con Git local o GitHub:
\`\`\`bash
# 1. Añadir cambios
git add songs/*.md catalog.json

# 2. Registrar commit
git commit -m "feat: actualización de letras y nuevas canciones"

# 3. Subir a repositorio remoto
git push origin main
\`\`\`

Generado automáticamente desde la aplicación de Cancionero.
`;
  zip.file('README.md', readmeContent);

  // .gitignore
  zip.file('.gitignore', `# Dependencias y temporales
node_modules/
.DS_Store
*.tmp
`);

  return await zip.generateAsync({ type: 'blob' });
}
