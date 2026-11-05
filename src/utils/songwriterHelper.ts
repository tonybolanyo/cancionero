import { Song } from '../types/song';
import { transposeChord } from './markdownParser';

/**
 * Common diatonic and secondary chords for popular songwriting keys
 */
const DIATONIC_CHORDS_MAP: Record<string, string[]> = {
  'Am': ['Am', 'C', 'Dm', 'Em', 'F', 'G', 'E7', 'A7'],
  'Em': ['Em', 'G', 'Am', 'Bm', 'C', 'D', 'B7', 'E7'],
  'Dm': ['Dm', 'F', 'Gm', 'Am', 'Bb', 'C', 'A7', 'D7'],
  'Bm': ['Bm', 'D', 'Em', 'F#m', 'G', 'A', 'F#7', 'B7'],
  'C#m': ['C#m', 'E', 'F#m', 'G#m', 'A', 'B', 'G#7', 'C#7'],
  'F#m': ['F#m', 'A', 'Bm', 'C#m', 'D', 'E', 'C#7', 'F#7'],
  'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'G7', 'C7'],
  'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'D7', 'G7'],
  'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'A7', 'D7'],
  'A': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'E7', 'A7'],
  'E': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'B7', 'E7'],
  'F': ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'C7', 'F7'],
  'Bb': ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'F7', 'Bb7'],
  'Eb': ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Bb7', 'Eb7']
};

/**
 * Returns the most natural chord palette for any musical key
 */
export function getDiatonicChordsForKey(key: string): string[] {
  const cleanKey = (key || 'Am').trim();
  if (DIATONIC_CHORDS_MAP[cleanKey]) {
    return DIATONIC_CHORDS_MAP[cleanKey];
  }

  // Fallback: if key is minor, transpose from Am; if major, transpose from C
  const isMinor = cleanKey.endsWith('m') && !cleanKey.endsWith('maj7');
  const baseKey = isMinor ? 'Am' : 'C';
  const baseChords = DIATONIC_CHORDS_MAP[baseKey];

  return baseChords;
}

export interface SongwritingStep {
  id: 'title' | 'lyrics' | 'chords' | 'musical' | 'audio' | 'lrc' | 'status';
  title: string;
  isComplete: boolean;
  isRequired: boolean;
  hint: string;
}

export interface CompletenessResult {
  percent: number;
  completedCount: number;
  totalCount: number;
  isReadyToPublish: boolean;
  statusLabel: string;
  nextSuggestion: string;
  steps: SongwritingStep[];
}

/**
 * Calculates how complete a song is along the author's workflow:
 * 1. Title
 * 2. Lyrics (verses written)
 * 3. Chords annotated
 * 4. Musical properties (Key & BPM)
 * 5. Audio demo / stream
 * 6. Synchronized lyrics (LRC)
 */
export function calculateSongCompleteness(song: {
  title?: string;
  lyrics?: string;
  key?: string;
  tempo?: number | string;
  audioUrl?: string;
  driveFileId?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  soundcloudUrl?: string;
  lrc?: string;
  status?: string;
}): CompletenessResult {
  const hasTitle = Boolean(song.title && song.title.trim().length > 0 && !song.title.includes('Nueva Composición') && !song.title.includes('Sin título'));
  
  const rawLyrics = song.lyrics || '';
  const lines = rawLyrics.split('\n').filter(l => l.trim().length > 0);
  const hasLyrics = lines.length >= 4 && !rawLyrics.includes('Escribe aquí el primer verso');
  
  const hasChords = /\[[A-G][#b]?[^\]]*\]/.test(rawLyrics);
  const hasKey = Boolean(song.key && song.key.trim().length > 0);
  const hasTempo = Boolean(song.tempo && Number(song.tempo) > 0);
  const hasMusical = hasKey && hasTempo;
  
  const hasAudio = Boolean(
    (song.audioUrl && song.audioUrl.trim().length > 0) ||
    (song.driveFileId && song.driveFileId.trim().length > 0) ||
    (song.spotifyUrl && song.spotifyUrl.trim().length > 0) ||
    (song.youtubeUrl && song.youtubeUrl.trim().length > 0) ||
    (song.soundcloudUrl && song.soundcloudUrl.trim().length > 0)
  );

  const hasLrc = Boolean(song.lrc && song.lrc.trim().length > 0);
  const isPublished = song.status === 'published';

  const steps: SongwritingStep[] = [
    {
      id: 'title',
      title: 'Título de la canción',
      isComplete: hasTitle,
      isRequired: true,
      hint: hasTitle ? 'Título definido' : 'Asigna un título para identificar el tema'
    },
    {
      id: 'lyrics',
      title: 'Letra escrita',
      isComplete: hasLyrics,
      isRequired: true,
      hint: hasLyrics ? `${lines.length} versos escritos` : 'Escribe o transcribe las estrofas de la canción'
    },
    {
      id: 'chords',
      title: 'Cifrado de acordes',
      isComplete: hasChords,
      isRequired: false,
      hint: hasChords ? 'Acordes anotados [C]' : 'Inserta los acordes sobre las sílabas con la paleta rápida'
    },
    {
      id: 'musical',
      title: 'Tono & Tempo (BPM)',
      isComplete: hasMusical,
      isRequired: true,
      hint: hasMusical ? `${song.key} · ${song.tempo} BPM` : 'Define el tono y tempo (o detéctalos del audio con 1 clic)'
    },
    {
      id: 'audio',
      title: 'Audio o Maqueta',
      isComplete: hasAudio,
      isRequired: false,
      hint: hasAudio ? 'Audio asignado' : 'Arrastra una nota de voz o enlace para escuchar la canción'
    },
    {
      id: 'lrc',
      title: 'Sincronización LRC (Atril)',
      isComplete: hasLrc,
      isRequired: false,
      hint: hasLrc ? 'Sincronizada con marcas de tiempo' : 'Opcional: Sincroniza versos para lectura automática en vivo'
    }
  ];

  // Calculate score weighting
  let score = 0;
  if (hasTitle) score += 20;
  if (hasLyrics) score += 30;
  if (hasChords) score += 15;
  if (hasMusical) score += 15;
  if (hasAudio) score += 10;
  if (hasLrc) score += 10;

  const completedCount = steps.filter(s => s.isComplete).length;
  const totalCount = steps.length;

  let nextSuggestion = 'Escribe la letra o sube un audio para empezar';
  if (!hasTitle) {
    nextSuggestion = 'Dale un nombre a tu composición';
  } else if (!hasLyrics) {
    nextSuggestion = 'Escribe las estrofas o transcribe tu nota de voz';
  } else if (!hasChords) {
    nextSuggestion = 'Añade los acordes en las estrofas usando la paleta rápida';
  } else if (!hasMusical) {
    nextSuggestion = 'Define la tonalidad y el tempo (BPM)';
  } else if (!hasAudio) {
    nextSuggestion = 'Adjunta una nota de voz o maqueta acústica';
  } else if (!hasLrc) {
    nextSuggestion = 'Sincroniza los versos con el asistente para cantar en atril';
  } else if (!isPublished) {
    nextSuggestion = '¡Canción completa! Puedes publicarla en el catálogo';
  } else {
    nextSuggestion = 'Canción completa y publicada en tu cancionero';
  }

  let statusLabel = 'Idea inicial';
  if (score >= 90) statusLabel = 'Canción Completa';
  else if (score >= 70) statusLabel = 'Avanzada';
  else if (score >= 40) statusLabel = 'En desarrollo';
  else statusLabel = 'Borrador inicial';

  return {
    percent: Math.min(100, score),
    completedCount,
    totalCount,
    isReadyToPublish: hasTitle && hasLyrics && hasKey,
    statusLabel,
    nextSuggestion,
    steps
  };
}

/**
 * Creative songwriting templates to inspire authors
 */
export const SONGWRITING_TEMPLATES = [
  {
    id: 'classic-author',
    title: 'Canción de Autor Clásica',
    description: 'Estructura poética con dos estrofas, estribillo que eleva la emoción y puente reflexivo.',
    key: 'Am',
    tempo: 92,
    timeSignature: '4/4',
    lyrics: `## Intro\n[Am]  [F]  [C]  [G]\n\n## Estrofa 1\n[Am] Hay una luz que no sabe apagarse,\n[F] un mapa viejo trazado en la piel.\n[C] Todo lo dicho comienza a doblarse\n[G] como una carta sin nadie a quien ver.\n\n## Estrofa 2\n[Am] Cruza la calle con paso ligero,\n[F] guarda en el pecho la duda y la fe.\n[C] No pide nada quien sabe de enero\n[G] que la verdad nunca vuelve a doler.\n\n## Estribillo\n[F] Y si la voz se desarma en el aire,\n[C] déjala libre que aprenda a volar.\n[G] No hay más abrigo que no ser cobarde,\n[Am] no hay más camino que echar a andar.\n\n## Puente\n[Dm] Todo lo que fuimos queda en esta cuerda,\n[Am] vibrando despacio, buscando su luz.\n[E7] Antes que el silencio vuelva a recordarte...\n\n## Estribillo Final\n[F] Y si la voz se desarma en el aire,\n[C] déjala libre que aprenda a volar.\n[G] No hay más abrigo que no ser cobarde,\n[Am] no hay más camino que echar a andar.\n\n## Outro\n[F]  [C]  [G]  [Am]`
  },
  {
    id: 'acoustic-ballad',
    title: 'Balada Íntima / Guitarra Acústica',
    description: 'Compás pausado (3/4 o 6/8) ideal para arpegios de dedos y textos intimistas.',
    key: 'G',
    tempo: 78,
    timeSignature: '3/4',
    lyrics: `## Intro (Arpegio)\n[G]  [C]  [Em]  [D]\n\n## Estrofa 1\n[G] Guardé tu silencio detrás de la puerta,\n[C] fingí que no entraba la noche en el mar.\n[Em] Tenía la casa de par en par abierta\n[D] por si decidías de pronto llegar.\n\n## Estribillo\n[C] Pero el tiempo no perdona a los que esperan,\n[G] ni el agua regresa al lugar de donde huyó.\n[D] Te dejo estas notas, pequeñas y sinceras,\n[Em] escritas al filo de lo que empezó.\n\n## Outro\n[G]  [C]  [G]`
  },
  {
    id: 'upbeat-folk',
    title: 'Folk Rítmico / Ritmo Vivo',
    description: 'Ritmo enérgico y directo para canciones de viaje, carretera o protesta alegre.',
    key: 'C',
    tempo: 116,
    timeSignature: '4/4',
    lyrics: `## Intro\n[C]  [G]  [Am]  [F]\n\n## Estrofa 1\n[C] Salí muy temprano sin rumbo ni miedo,\n[G] la vida en la espalda y el viento a favor.\n[Am] No llevo cadenas ni piedras que arrastre,\n[F] tan solo las ganas de hacerme mejor.\n\n## Estribillo\n[C] Que todo lo bueno nos pille despiertos,\n[G] que nadie nos robe la risa al cantar.\n[Am] Se abren los puertos, se rompen los huertos,\n[F] y el mundo de nuevo se vuelve a inventar.`
  }
];
