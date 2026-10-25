import JSZip from 'jszip';
import { Song } from '../types/song';
import { songToMarkdown } from './markdownParser';

export interface ExportProgress {
  message: string;
  percent: number;
  currentStep?: string;
}

export interface ExportResult {
  filename: string;
  blob: Blob;
  totalSongs: number;
  audioFilesIncluded: number;
  audioFilesRemoteOnly: number;
  sizeBytes: number;
}

/**
 * Fetches or extracts audio data from a URL or Data URL
 */
async function fetchAudioBlob(
  url: string,
  timeoutMs: number = 7000
): Promise<{ data: Blob | Uint8Array; extension: string } | null> {
  // Case 1: Data URL (e.g. data:audio/mp3;base64,...)
  if (url.startsWith('data:audio/')) {
    try {
      const commaIndex = url.indexOf(',');
      if (commaIndex === -1) return null;

      const header = url.slice(0, commaIndex);
      const base64Data = url.slice(commaIndex + 1);

      let extension = 'mp3';
      if (header.includes('wav')) extension = 'wav';
      else if (header.includes('ogg')) extension = 'ogg';
      else if (header.includes('m4a') || header.includes('mp4')) extension = 'm4a';

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return { data: byteArray, extension };
    } catch (e) {
      console.warn('Error extracting base64 audio:', e);
      return null;
    }
  }

  // Case 2: Network / Blob URL
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors'
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    const blob = await response.blob();
    let extension = 'mp3';
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('wav') || url.toLowerCase().endsWith('.wav')) {
      extension = 'wav';
    } else if (contentType.includes('ogg') || url.toLowerCase().endsWith('.ogg')) {
      extension = 'ogg';
    } else if (contentType.includes('m4a') || url.toLowerCase().endsWith('.m4a')) {
      extension = 'm4a';
    }

    return { data: blob, extension };
  } catch (err) {
    console.warn(`Could not download audio from ${url}:`, err);
    return null;
  }
}

/**
 * Generates a full external backup ZIP containing:
 * 1. songs.json (complete serialized database)
 * 2. audio/ folder (downloaded and base64 audio tracks)
 * 3. audio-manifest.json (mapping between songs and audio files)
 * 4. songs/ folder (individual markdown files with YAML frontmatter)
 * 5. LEEME_COPIA_DE_SEGURIDAD.txt (instructions and metadata)
 */
export async function exportDatabaseWithAudioZip(
  songs: Song[],
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  const zip = new JSZip();
  const currentDate = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toLocaleString('es-ES');

  onProgress?.({
    message: 'Preparando base de datos songs.json...',
    percent: 10,
    currentStep: 'database'
  });

  // 1. Root songs.json (exact state of the songs database)
  const songsJsonString = JSON.stringify(songs, null, 2);
  zip.file('songs.json', songsJsonString);

  // 2. Mirror as catalog.json for backwards compatibility
  zip.file('catalog.json', songsJsonString);

  // 3. songs/ folder with individual .md files
  const songsFolder = zip.folder('songs');
  songs.forEach((song) => {
    try {
      const markdown = songToMarkdown(song);
      songsFolder?.file(`${song.id}.md`, markdown);
    } catch (e) {
      console.warn(`Could not generate markdown for ${song.id}:`, e);
    }
  });

  // 4. Audio files processing
  const audioFolder = zip.folder('audio');
  const audioManifest: Array<{
    songId: string;
    songTitle: string;
    hasAudio: boolean;
    audioUrlOriginal?: string;
    archivePath?: string;
    status: 'included' | 'remote_reference_only' | 'no_audio';
    note?: string;
  }> = [];

  const songsWithAudio = songs.filter((s) => !!s.audioUrl);
  let audioIncludedCount = 0;
  let audioRemoteOnlyCount = 0;

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];

    if (!song.audioUrl) {
      audioManifest.push({
        songId: song.id,
        songTitle: song.title,
        hasAudio: false,
        status: 'no_audio'
      });
      continue;
    }

    const currentAudioIdx = songsWithAudio.indexOf(song) + 1;
    const progressPercent = Math.round(20 + (currentAudioIdx / (songsWithAudio.length || 1)) * 55);

    onProgress?.({
      message: `Procesando audio (${currentAudioIdx}/${songsWithAudio.length}): "${song.title}"...`,
      percent: progressPercent,
      currentStep: 'audio'
    });

    const result = await fetchAudioBlob(song.audioUrl);

    if (result) {
      const audioFilename = `${song.id}.${result.extension}`;
      audioFolder?.file(audioFilename, result.data);
      audioIncludedCount++;

      audioManifest.push({
        songId: song.id,
        songTitle: song.title,
        hasAudio: true,
        audioUrlOriginal: song.audioUrl.startsWith('data:') ? 'data:audio/... (base64 incrustado)' : song.audioUrl,
        archivePath: `audio/${audioFilename}`,
        status: 'included',
        note: 'Archivo de audio descargado y empaquetado correctamente en el zip.'
      });
    } else {
      audioRemoteOnlyCount++;
      audioManifest.push({
        songId: song.id,
        songTitle: song.title,
        hasAudio: true,
        audioUrlOriginal: song.audioUrl,
        status: 'remote_reference_only',
        note: 'No se pudo descargar automáticamente (restricción CORS o sin conexión). El enlace original se conserva en songs.json.'
      });
    }
  }

  // 5. audio-manifest.json
  zip.file(
    'audio-manifest.json',
    JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        totalSongs: songs.length,
        audioTracksIncluded: audioIncludedCount,
        audioTracksRemoteOnly: audioRemoteOnlyCount,
        tracks: audioManifest
      },
      null,
      2
    )
  );

  // 6. Human-readable README instructions
  const readmeContent = `================================================================================
COPIA DE SEGURIDAD EXTERNA COMPLETA DEL CANCIONERO
================================================================================
Fecha de exportación: ${timestamp}
Canciones en la base de datos: ${songs.length}
Archivos de audio empaquetados en /audio/: ${audioIncludedCount}
Referencias remotas conservadas: ${audioRemoteOnlyCount}
================================================================================

ESTRUCTURA DEL ARCHIVO COMPRIMIDO (.ZIP):
--------------------------------------------------------------------------------
1. songs.json
   Estado completo y serializado de la base de datos de canciones con todas sus
   letras, tonalidades, tempos, afinaciones, acordes, enlaces y metadatos.

2. /audio/
   Directorio que contiene las pistas de audio asociadas (.mp3 / .wav)
   identificadas por el slug de cada canción (ej. audio/noches-de-cristal.mp3).

3. audio-manifest.json
   Índice técnico que mapea cada canción con su respectivo archivo de audio
   o enlace original.

4. /songs/
   Directorio con cada canción en formato Markdown individual (.md) con cabecera
   YAML estándar y acordes incrustados con formato [Acorde].

5. catalog.json
   Copia idéntica a songs.json para compatibilidad con sistemas externos y Git.

CÓMO RESTAURAR O IMPORTAR ESTA COPIA:
--------------------------------------------------------------------------------
- Para restaurar todas las canciones en la aplicación:
  1. Abre el Cancionero.
  2. Haz clic en "Sincronizar con Git / Archivos".
  3. En la pestaña "Importar Archivos", selecciona el archivo "songs.json" de este paquete.
  4. El sistema creará automáticamente un punto de restauración previo y cargará todo el repertorio.

- Para reproducir o editar los audios:
  Puedes reproducir los archivos de la carpeta /audio/ con cualquier reproductor multimedia
  estándar (VLC, QuickTime, Audacity, etc.).

Generado automáticamente desde la plataforma de Cancionero de Autor.
================================================================================
`;
  zip.file('LEEME_COPIA_DE_SEGURIDAD.txt', readmeContent);

  onProgress?.({
    message: 'Comprimiendo archivo ZIP...',
    percent: 85,
    currentStep: 'compress'
  });

  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      onProgress?.({
        message: `Comprimiendo archivo ZIP (${Math.round(metadata.percent)}%)...`,
        percent: Math.min(99, Math.round(85 + (metadata.percent / 100) * 14)),
        currentStep: 'compress'
      });
    }
  );

  const filename = `cancionero-backup-completo-${currentDate}.zip`;

  onProgress?.({
    message: '¡Copia de seguridad completada con éxito!',
    percent: 100,
    currentStep: 'complete'
  });

  return {
    filename,
    blob,
    totalSongs: songs.length,
    audioFilesIncluded: audioIncludedCount,
    audioFilesRemoteOnly: audioRemoteOnlyCount,
    sizeBytes: blob.size
  };
}

/**
 * Helper to trigger immediate browser download of the export result
 */
export function downloadExportResult(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
