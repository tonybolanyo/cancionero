import { LrcMetadata, SyncedLyricLine } from '../../types/lyrics';

/**
 * Formatea segundos a marca de tiempo WebVTT: hh:mm:ss.mmm
 * ej. 74.25s -> "00:01:14.250"
 */
export function formatVttTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00.000';
  const totalMillis = Math.round(seconds * 1000);
  const hours = Math.floor(totalMillis / 3600000);
  const rem1 = totalMillis % 3600000;
  const mins = Math.floor(rem1 / 60000);
  const rem2 = rem1 % 60000;
  const secs = Math.floor(rem2 / 1000);
  const millis = rem2 % 1000;

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/**
 * Convierte líneas de letra sincronizada en formato WebVTT estándar (.vtt)
 */
export function toVtt(lines: SyncedLyricLine[], metadata?: LrcMetadata): string {
  const output: string[] = ['WEBVTT'];

  // Cabecera opcional de metadatos WebVTT
  if (metadata) {
    if (metadata.title) output.push(`NOTE Title: ${metadata.title}`);
    if (metadata.artist) output.push(`NOTE Artist: ${metadata.artist}`);
    if (metadata.album) output.push(`NOTE Album: ${metadata.album}`);
  }

  output.push(''); // Separador obligatorio tras WEBVTT

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const startTime = currentLine.time;

    // Calcular el tiempo de fin del subtítulo (cue):
    // Usar el inicio de la siguiente línea o un estimado razonable (3.5 segundos)
    let endTime: number;
    if (i < lines.length - 1) {
      const nextTime = lines[i + 1].time;
      const duration = nextTime - startTime;
      // Si la brecha entre líneas es mayor a 6 segundos (ej. solo instrumental), cerrar el subtítulo antes
      if (duration > 6) {
        endTime = startTime + 4.0;
      } else if (duration <= 0.2) {
        endTime = startTime + 1.0;
      } else {
        endTime = nextTime;
      }
    } else {
      // Última línea
      endTime = startTime + 3.5;
    }

    const startStr = formatVttTimestamp(startTime);
    const endStr = formatVttTimestamp(endTime);

    output.push(`${i + 1}`);
    output.push(`${startStr} --> ${endStr}`);
    output.push(currentLine.text || ' ');
    output.push('');
  }

  return output.join('\n');
}

/**
 * Crea un Blob en formato WebVTT (.vtt) para subtítulos web
 */
export function createVttBlob(lines: SyncedLyricLine[], metadata?: LrcMetadata): Blob {
  const vttString = toVtt(lines, metadata);
  return new Blob([vttString], { type: 'text/vtt;charset=utf-8' });
}
