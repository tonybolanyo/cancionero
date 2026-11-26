import { Song, SongStatus, SavedAudioAnalysis } from '../types/song';
import * as yaml from 'js-yaml';

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

export type AccidentalPreference = 'sharps' | 'flats';

/**
 * Transpose a single chord symbol by N semitones with optional accidental preference ('sharps' | 'flats')
 * e.g. "F#" with preference "flats" -> "Gb"
 */
export function transposeChord(
  chord: string,
  semitones: number,
  preference?: AccidentalPreference | 'auto'
): string {
  if (semitones === 0 && !preference) return chord;

  // Match root note (e.g. C, C#, Bb) and chord suffix (m, 7, maj7, sus4, dim, m7b5, aug, /G)
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;

  const root = match[1];
  const suffix = match[2];

  // If there's a bass note like C/E, transpose the bass note as well
  if (suffix.includes('/')) {
    const [mainSuffix, bass] = suffix.split('/');
    const transposedRoot = shiftNote(root, semitones, preference);
    const transposedBass = shiftNote(bass, semitones, preference);
    return `${transposedRoot}${mainSuffix}/${transposedBass}`;
  }

  const transposedRoot = shiftNote(root, semitones, preference);
  return `${transposedRoot}${suffix}`;
}

export function shiftNote(
  note: string,
  semitones: number,
  preference?: AccidentalPreference | 'auto'
): string {
  const currentSemitone = NOTE_TO_SEMITONE[note];
  if (currentSemitone === undefined) return note;

  let newSemitone = (currentSemitone + semitones) % 12;
  if (newSemitone < 0) newSemitone += 12;

  if (preference === 'flats') {
    return CHROMATIC_SCALE_FLATS[newSemitone];
  }
  if (preference === 'sharps') {
    return CHROMATIC_SCALE_SHARPS[newSemitone];
  }

  // Choose sharps by default unless original had flat
  const useFlats = note.includes('b');
  return useFlats ? CHROMATIC_SCALE_FLATS[newSemitone] : CHROMATIC_SCALE_SHARPS[newSemitone];
}

/**
 * Respell a chord to the desired enharmonic accidental preference ('sharps' vs 'flats') without changing pitch
 */
export function respellChord(chord: string, preference: AccidentalPreference): string {
  return transposeChord(chord, 0, preference);
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
export function transposeLyrics(
  lyrics: string,
  semitones: number,
  preference?: AccidentalPreference | 'auto'
): string {
  if (semitones === 0 && !preference) return lyrics;
  return lyrics.replace(/\[([A-G][#b]?[^\]]*)\]/g, (_, chord) => {
    return `[${transposeChord(chord, semitones, preference)}]`;
  });
}

/**
 * Respell all chords in lyrics to either sharps (#) or flats (b) without transposing pitch
 */
export function respellLyrics(lyrics: string, preference: AccidentalPreference): string {
  return transposeLyrics(lyrics, 0, preference);
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
 * Validates if an audio URL is currently playable in a standard HTML5 audio element
 * without causing MEDIA_ERR_SRC_NOT_SUPPORTED ("The element has no supported sources").
 * Excludes empty strings, pseudo-protocols like gdrive://, and cross-origin or expired blob URLs.
 */
export function isValidPlayableAudioUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Pseudo-protocols cannot be used directly in <audio src="...">
  if (trimmed.startsWith('gdrive://')) return false;

  // Blob URLs must belong to the active window session origin
  if (trimmed.startsWith('blob:')) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return trimmed.startsWith(`blob:${window.location.origin}/`);
    }
    return false;
  }

  // Standard web audio sources
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('data:audio/')
  );
}

const quoteYamlString = (value: string): string => JSON.stringify(value);

const asOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

const parseOptionalInt = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

/**
 * Serialize a Song object to Markdown with YAML frontmatter
 */
export function songToMarkdown(song: Song): string {
  const safeId = song?.id || '';
  const safeTitle = song?.title || 'Sin título';
  const safeStatus = song?.status || 'draft';
  const safeYear = typeof song?.year === 'number' && Number.isFinite(song.year) ? song.year : new Date().getFullYear();
  const safeGenre = song?.genre || 'Canción de Autor';
  const safeKey = song?.key || 'Am';
  const safeCreatedAt = song?.createdAt || new Date().toISOString();
  const safeUpdatedAt = song?.updatedAt || new Date().toISOString();
  const safeLyrics = (song?.lyrics || '').replace(/\r\n?/g, '\n').trim();

  const frontmatterLines = [
    '---',
    `id: ${quoteYamlString(safeId)}`,
    `title: ${quoteYamlString(safeTitle)}`,
    `status: ${quoteYamlString(safeStatus)}`,
    `year: ${safeYear}`,
    `genre: ${quoteYamlString(safeGenre)}`,
    `key: ${quoteYamlString(safeKey)}`,
    typeof song?.tempo === 'number' && Number.isFinite(song.tempo) && song.tempo > 0 ? `tempo: ${song.tempo}` : null,
    song?.albumId ? `albumId: ${quoteYamlString(song.albumId)}` : null,
    song?.albumTitle ? `albumTitle: ${quoteYamlString(song.albumTitle)}` : null,
    typeof song?.trackNumber === 'number' && Number.isFinite(song.trackNumber) ? `trackNumber: ${song.trackNumber}` : null,
    song?.timeSignature ? `timeSignature: ${quoteYamlString(song.timeSignature)}` : null,
    song?.tuning ? `tuning: ${quoteYamlString(song.tuning)}` : null,
    song?.duration ? `duration: ${quoteYamlString(song.duration)}` : null,
    song?.spotifyUrl ? `spotifyUrl: ${quoteYamlString(song.spotifyUrl)}` : null,
    song?.appleMusicUrl ? `appleMusicUrl: ${quoteYamlString(song.appleMusicUrl)}` : null,
    song?.youtubeUrl ? `youtubeUrl: ${quoteYamlString(song.youtubeUrl)}` : null,
    song?.soundcloudUrl ? `soundcloudUrl: ${quoteYamlString(song.soundcloudUrl)}` : null,
    song?.audioUrl && isValidPlayableAudioUrl(song.audioUrl) && !song.audioUrl.startsWith('blob:')
      ? `audioUrl: ${quoteYamlString(song.audioUrl)}`
      : null,
    song?.driveFileId ? `driveFileId: ${quoteYamlString(song.driveFileId)}` : null,
    song?.driveFileName ? `driveFileName: ${quoteYamlString(song.driveFileName)}` : null,
    typeof song?.isPrivateDemo === 'boolean' ? `isPrivateDemo: ${song.isPrivateDemo}` : null,
    song?.coverImage ? `coverImage: ${quoteYamlString(song.coverImage)}` : null,
    song?.notes ? `notes: ${quoteYamlString(song.notes)}` : null,
    song?.lrc ? `lrc: ${quoteYamlString(song.lrc)}` : null,
    song?.audioAnalysis ? `audioAnalysis: ${quoteYamlString(JSON.stringify(song.audioAnalysis))}` : null,
    song?.tags && song.tags.length > 0
      ? `tags: [${song.tags.map((t) => quoteYamlString(String(t))).join(', ')}]`
      : null,
    `createdAt: ${quoteYamlString(safeCreatedAt)}`,
    `updatedAt: ${quoteYamlString(safeUpdatedAt)}`,
    song?.gitHash ? `gitHash: ${quoteYamlString(song.gitHash)}` : null,
    '---'
  ].filter(Boolean);

  return safeLyrics
    ? `${frontmatterLines.join('\n')}\n${safeLyrics}`
    : `${frontmatterLines.join('\n')}\n`;
}

/**
 * Parse Markdown with YAML frontmatter into a Song object
 */
export function markdownToSong(markdown: string, fallbackId?: string): Song {
  const normalizedMarkdown = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const frontmatterMatch = normalizedMarkdown.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/);
  const emptyFrontmatterMatch = !frontmatterMatch
    ? normalizedMarkdown.match(/^---\n---(?:\n([\s\S]*))?$/)
    : null;

  const now = new Date().toISOString();

  if (!frontmatterMatch && !emptyFrontmatterMatch) {
    // If no frontmatter, treat whole file as lyrics
    return {
      id: fallbackId || `cancion-${Date.now()}`,
      title: fallbackId ? fallbackId.replace(/-/g, ' ') : 'Canción sin título',
      status: 'draft',
      year: new Date().getFullYear(),
      genre: 'Canción de Autor',
      key: 'C',
      lyrics: normalizedMarkdown.trim(),
      createdAt: now,
      updatedAt: now
    };
  }

  const frontmatterRaw = frontmatterMatch ? frontmatterMatch[1] : '';
  const lyricsBody = ((frontmatterMatch ? frontmatterMatch[2] : emptyFrontmatterMatch?.[1]) ?? '').trim();

  let meta: Record<string, unknown> = {};
  if (frontmatterRaw.trim()) {
    const loaded = yaml.load(frontmatterRaw, { schema: yaml.CORE_SCHEMA });
    if (loaded !== null && loaded !== undefined) {
      if (typeof loaded !== 'object' || Array.isArray(loaded)) {
        throw new Error('El frontmatter YAML debe ser un mapa clave-valor.');
      }
      meta = loaded as Record<string, unknown>;
    }
  }

  const rawId = asOptionalString(meta.id);
  const rawTitle = asOptionalString(meta.title);
  const rawStatus = asOptionalString(meta.status);
  const id = rawId || fallbackId || rawTitle?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `song-${Date.now()}`;
  const status: SongStatus = (rawStatus === 'published' || rawStatus === 'draft' || rawStatus === 'private')
    ? rawStatus
    : 'draft';

  let parsedTags: string[] | undefined = undefined;
  if (Array.isArray(meta.tags)) {
    parsedTags = meta.tags
      .map((t) => asOptionalString(t))
      .filter((t): t is string => typeof t === 'string' && t.length > 0);
  } else if (typeof meta.tags === 'string' && meta.tags.trim()) {
    const rawTags = meta.tags.trim();
    try {
      if (rawTags.startsWith('[') && rawTags.endsWith(']')) {
        const jsonTags = JSON.parse(rawTags);
        if (Array.isArray(jsonTags)) {
          parsedTags = jsonTags.map((t) => String(t)).filter(Boolean);
        }
      } else {
        parsedTags = rawTags.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
    } catch {
      parsedTags = rawTags.replace(/[\[\]"]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  let parsedAudioAnalysis: SavedAudioAnalysis | undefined = undefined;
  if (meta.audioAnalysis && typeof meta.audioAnalysis === 'object' && !Array.isArray(meta.audioAnalysis)) {
    parsedAudioAnalysis = meta.audioAnalysis as SavedAudioAnalysis;
  } else if (typeof meta.audioAnalysis === 'string' && meta.audioAnalysis.trim()) {
    try {
      parsedAudioAnalysis = JSON.parse(meta.audioAnalysis);
    } catch (e) {
      console.warn('Failed to parse audioAnalysis from markdown frontmatter', e);
    }
  }

  const rawAudioUrl = asOptionalString(meta.audioUrl);
  const rawDriveFileId = asOptionalString(meta.driveFileId);
  const parsedIsPrivateDemo =
    typeof meta.isPrivateDemo === 'boolean'
      ? meta.isPrivateDemo
      : typeof meta.isPrivateDemo === 'string'
        ? meta.isPrivateDemo === 'true'
        : Boolean(rawDriveFileId)
          ? true
          : undefined;

  return {
    id,
    title: rawTitle || 'Sin título',
    status,
    albumId: asOptionalString(meta.albumId) || undefined,
    albumTitle: asOptionalString(meta.albumTitle) || undefined,
    trackNumber: parseOptionalInt(meta.trackNumber),
    year: parseOptionalInt(meta.year) ?? new Date().getFullYear(),
    genre: asOptionalString(meta.genre) || 'Acústica',
    key: asOptionalString(meta.key) || 'Am',
    tempo: parseOptionalInt(meta.tempo),
    timeSignature: asOptionalString(meta.timeSignature),
    tuning: asOptionalString(meta.tuning),
    duration: asOptionalString(meta.duration),
    spotifyUrl: asOptionalString(meta.spotifyUrl) || undefined,
    appleMusicUrl: asOptionalString(meta.appleMusicUrl) || undefined,
    youtubeUrl: asOptionalString(meta.youtubeUrl) || undefined,
    soundcloudUrl: asOptionalString(meta.soundcloudUrl) || undefined,
    audioUrl: isValidPlayableAudioUrl(rawAudioUrl) ? rawAudioUrl : undefined,
    driveFileId: rawDriveFileId || undefined,
    driveFileName: asOptionalString(meta.driveFileName) || undefined,
    isPrivateDemo: parsedIsPrivateDemo,
    coverImage: asOptionalString(meta.coverImage) || undefined,
    notes: asOptionalString(meta.notes) || undefined,
    lrc: asOptionalString(meta.lrc) || undefined,
    audioAnalysis: parsedAudioAnalysis,
    tags: parsedTags && parsedTags.length > 0 ? parsedTags : undefined,
    lyrics: lyricsBody,
    createdAt: asOptionalString(meta.createdAt) || now,
    updatedAt: asOptionalString(meta.updatedAt) || now,
    gitHash: asOptionalString(meta.gitHash) || undefined
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
  const { default: JSZip } = await import('jszip');
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
