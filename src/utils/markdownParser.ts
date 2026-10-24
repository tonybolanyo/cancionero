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
 * Structure of a lyric segment for rendering lyrics with chords
 */
export interface LyricSegment {
  chord: string | null;
  text: string;
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
 * Parses a single line of lyrics with embedded chords [Chord] into structured segments.
 * Accurately aligns chords with syllables, avoids collisions between adjacent chords,
 * and preserves proper spacing.
 */
export function parseLyricLine(line: string): LyricSegment[] {
  if (!line) return [];

  // If no chords present, return the whole line as a single segment
  if (!/\[([A-G][#b]?[^\]]*)\]/.test(line)) {
    return [{ chord: null, text: line }];
  }

  // Split line keeping bracketed chord tokens
  const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);
  const rawSegments: { chord: string | null; text: string }[] = [];
  let pendingChord: string | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '') continue;

    if (part.startsWith('[') && part.endsWith(']')) {
      if (pendingChord !== null) {
        // Consecutive chords with no text in between (e.g. [C][G])
        rawSegments.push({ chord: pendingChord, text: '' });
      }
      pendingChord = part.slice(1, -1);
    } else {
      rawSegments.push({ chord: pendingChord, text: part });
      pendingChord = null;
    }
  }

  if (pendingChord !== null) {
    rawSegments.push({ chord: pendingChord, text: '' });
  }

  // Refine segments so words can wrap smoothly on mobile screens while keeping chords attached to exact syllables
  const finalSegments: LyricSegment[] = [];

  for (const seg of rawSegments) {
    if (!seg.text) {
      finalSegments.push({ chord: seg.chord, text: '' });
      continue;
    }

    if (seg.chord) {
      // If the text starts with spaces, preserve the leading space before the chord-bearing word
      const matchLeadingSpaces = seg.text.match(/^(\s+)(.*)$/);
      let leadingSpaces = '';
      let restText = seg.text;

      if (matchLeadingSpaces && matchLeadingSpaces[2].length > 0) {
        leadingSpaces = matchLeadingSpaces[1];
        restText = matchLeadingSpaces[2];
        finalSegments.push({ chord: null, text: leadingSpaces });
      }

      // Split remaining text into word tokens preserving trailing spaces
      const words = restText.match(/\S+\s*|\s+/g) || (restText ? [restText] : ['']);

      if (words.length > 0) {
        finalSegments.push({ chord: seg.chord, text: words[0] });
        for (let w = 1; w < words.length; w++) {
          finalSegments.push({ chord: null, text: words[w] });
        }
      } else {
        finalSegments.push({ chord: seg.chord, text: '' });
      }
    } else {
      // Segment without chord: split into word chunks so text wraps naturally
      const words = seg.text.match(/\S+\s*|\s+/g) || [seg.text];
      for (const word of words) {
        finalSegments.push({ chord: null, text: word });
      }
    }
  }

  return finalSegments;
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
    song.coverImage ? `coverImage: "${song.coverImage}"` : null,
    song.notes ? `notes: "${song.notes.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"` : null,
    song.tags && song.tags.length > 0 ? `tags: [${song.tags.map(t => `"${t.replace(/"/g, '')}"`).join(', ')}]` : null,
    `createdAt: "${song.createdAt}"`,
    `updatedAt: "${song.updatedAt}"`,
    song.gitHash ? `gitHash: "${song.gitHash}"` : null,
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

  let parsedTags: string[] | undefined = undefined;
  if (meta.tags) {
    try {
      if (meta.tags.startsWith('[') && meta.tags.endsWith(']')) {
        parsedTags = JSON.parse(meta.tags);
      } else {
        parsedTags = meta.tags.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
    } catch {
      parsedTags = meta.tags.replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
    }
  }

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
    coverImage: meta.coverImage || undefined,
    notes: meta.notes || undefined,
    tags: parsedTags && parsedTags.length > 0 ? parsedTags : undefined,
    lyrics: lyricsBody,
    createdAt: meta.createdAt || now,
    updatedAt: meta.updatedAt || now,
    gitHash: meta.gitHash || undefined
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
