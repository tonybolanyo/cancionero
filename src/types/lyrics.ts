/**
 * Tipos compartidos para el manejo de letras sincronizadas (LRC / WebVTT)
 */

export interface LrcMetadata {
  title?: string; // [ti:Título]
  artist?: string; // [ar:Artista]
  album?: string; // [al:Álbum]
  by?: string; // [by:Creador del archivo LRC]
  offset?: number; // [offset:+/- milisegundos]
  length?: string; // [length:mm:ss]
  re?: string; // [re:Generador o reproductor]
  [key: string]: string | number | undefined;
}

export interface SyncedLyricLine {
  id: string; // Identificador único de línea
  time: number; // Tiempo en segundos con decimales (ej. 14.25)
  text: string; // Texto de la línea (puede incluir acordes o formato)
  rawTime?: string; // Marca de tiempo original (ej. "00:14.25")
}

export interface ParsedLrc {
  metadata: LrcMetadata;
  lines: SyncedLyricLine[];
  hasTimestamps: boolean;
  warnings: string[];
  rawText: string;
}

/**
 * Formatea segundos a marca de tiempo estándar LRC: [mm:ss.xx]
 * ej. 74.25s -> "01:14.25"
 */
export function formatLrcTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const totalCentis = Math.round(seconds * 100);
  const mins = Math.floor(totalCentis / 6000);
  const remainingCentis = totalCentis % 6000;
  const secs = Math.floor(remainingCentis / 100);
  const centis = remainingCentis % 100;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}

/**
 * Descarga en el navegador un Blob con el nombre de archivo especificado
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
