import { Song } from '../../types/song';
import { SyncedLyricLine } from '../../types/lyrics';
import { parseLrc, cleanRawText, CHORD_BRACKET_REGEX } from '../lyrics/parseLrc';
import { SAMPLE_LRC_TEXT } from '../../data/sampleLrc';
import {
  VideoResolution,
  ResolutionConfig,
  EffectOption,
  ThemeOption
} from './types';

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatVideoTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseSongDurationSeconds(duration?: string): number {
  if (duration) {
    const parts = duration.split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s) && m * 60 + s > 0) {
        return m * 60 + s;
      }
    }
  }
  return 180;
}

export function sanitizeVideoFilename(
  title: string,
  resolution: VideoResolution,
  mimeType: string
): string {
  const cleanTitle = (title || 'cancion')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'cancion';
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  return `${cleanTitle}-visualizador-${resolution}.${ext}`;
}

export function deriveVisualizerLyrics(
  song: Pick<Song, 'id' | 'title' | 'lyrics' | 'lrc' | 'duration'>,
  showChords: boolean
): SyncedLyricLine[] {
  const rawLrc = song.lrc || (song.id === 'si-me-pierdo' ? SAMPLE_LRC_TEXT : '');
  if (rawLrc && rawLrc.trim()) {
    const parsed = parseLrc(rawLrc);
    if (parsed.lines && parsed.lines.length > 0) {
      return parsed.lines;
    }
  }

  // Fallback: derive synchronized lines from lyrics text
  const cleanLyrics = cleanRawText(song.lyrics);
  const rawLines = cleanLyrics.split('\n');
  const validLines: { text: string; chords?: string }[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const hasChords = /\[([A-G][#b]?[^\]]*)\]/.test(trimmed);
    const textOnly = trimmed.replace(CHORD_BRACKET_REGEX, '').trim();
    if (textOnly) {
      validLines.push({
        text: showChords ? trimmed : textOnly,
        chords: hasChords ? trimmed.match(CHORD_BRACKET_REGEX)?.join(' ') : undefined
      });
    }
  }

  if (validLines.length === 0) {
    return [
      { id: '1', time: 0, text: song.title },
      { id: '2', time: 4, text: 'Cancionero de versos perdidos' },
      { id: '3', time: 8, text: 'Música y poesía de autor' }
    ];
  }

  const songEstSeconds = song.duration
    ? (() => {
        const parts = song.duration.split(':');
        const m = parseInt(parts[0], 10);
        const s = parseInt(parts[1], 10);
        return !isNaN(m) && !isNaN(s) ? m * 60 + s : Math.max(120, validLines.length * 5);
      })()
    : Math.max(120, validLines.length * 5);

  const step = Math.max(1, songEstSeconds - 6) / Math.max(1, validLines.length);

  return validLines.map((item, idx) => ({
    id: `derived-line-${idx}`,
    time: Math.round((4 + idx * step) * 10) / 10,
    text: item.text
  }));
}

export const RESOLUTION_PRESETS: Record<VideoResolution, ResolutionConfig> = {
  '1080p': {
    label: '1080p Full HD (Recomendado)',
    width: 1920,
    height: 1080,
    bitrate: 6_000_000,
    description: 'Máxima nitidez para YouTube (1920x1080, 16:9)'
  },
  '720p': {
    label: '720p HD',
    width: 1280,
    height: 720,
    bitrate: 3_500_000,
    description: 'Equilibrado en peso y calidad (1280x720, 16:9)'
  },
  '360p': {
    label: '360p Rápido',
    width: 640,
    height: 360,
    bitrate: 1_200_000,
    description: 'Renderizado ultraligero y previsualización (640x360)'
  }
};

export const EFFECT_OPTIONS: EffectOption[] = [
  { id: 'spectrum-bars', name: 'Barras de Espectro', description: 'Barras simétricas ecualizadas con picos flotantes' },
  { id: 'wave-ribbon', name: 'Onda Sinusoidal', description: 'Cinta fluida luminosa que oscila con la voz y guitarra' },
  { id: 'circular-orb', name: 'Orbe / Vinilo Radial', description: 'Disco vinilo concéntrico con rayos reactivos al compás' },
  { id: 'particle-burst', name: 'Nebulosa de Partículas', description: 'Polvo cósmico y destellos que vibran con los graves' },
  { id: 'acoustic-minimal', name: 'Minimalista Acústico', description: 'Línea sutil y tenue atmósfera intimista de cantautor' }
];

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'midnight',
    name: 'Estudio Nocturno',
    gradient: 'from-[#090d16] via-[#0f172a] to-[#050811]',
    accent: '#38bdf8',
    description: 'Tonos azul pizarra y noche profunda con iluminación cenital'
  },
  {
    id: 'warm-amber',
    name: 'Crepúsculo Ámbar',
    gradient: 'from-[#1c120c] via-[#2c1810] to-[#0f0a06]',
    accent: '#f59e0b',
    description: 'Calidez de madera de guitarra, café y luz de lámpara'
  },
  {
    id: 'classic-vinyl',
    name: 'Vinilo Clásico',
    gradient: 'from-[#141416] via-[#1c1b1f] to-[#0a0a0c]',
    accent: '#e2b340',
    description: 'Elegancia sobria analógica en antracita y toques dorados'
  },
  {
    id: 'emerald-folk',
    name: 'Bosque Acústico',
    gradient: 'from-[#061811] via-[#0b241b] to-[#030d09]',
    accent: '#34d399',
    description: 'Verde esmeralda y musgo, calma orgánica y poética'
  },
  {
    id: 'deep-space',
    name: 'Espacio Infinito',
    gradient: 'from-[#0b051b] via-[#13092b] to-[#05020c]',
    accent: '#c084fc',
    description: 'Púrpura sideral y constelaciones sonoras'
  },
  {
    id: 'cover-art',
    name: 'Portada Difuminada',
    gradient: 'from-[#0f172a] to-[#020617]',
    accent: '#f43f5e',
    description: 'Fondo artístico derivado de la portada de la canción'
  }
];
