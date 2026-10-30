import { LrcMetadata, ParsedLrc, SyncedLyricLine, formatLrcTimestamp } from '../../types/lyrics';

/**
 * Expresión regular para metadatos LRC estándar: [tag:valor]
 * ej. [ti:Canción], [ar:Tony], [offset:500]
 */
const METADATA_REGEX = /^\[([a-zA-Z]+)\s*:\s*([^\]]*)\]$/;

/**
 * Expresión regular para marcas de tiempo LRC estándar:
 * [mm:ss.xx], [mm:ss.xxx], [mm:ss], [hh:mm:ss.xx], y marcas con signo negativo [-mm:ss.xx]
 */
const TIMESTAMP_REGEX = /\[(-?\d{1,2}:[0-5]?\d(?::[0-5]?\d)?(?:\.\d{1,3})?)\]/g;

/**
 * Parsea una cadena de tiempo LRC (ej. "01:23.45", "74.2", "01:12") a segundos flotantes
 */
export function parseLrcTimeToSeconds(timeStr: string): { seconds: number; isNegative: boolean } {
  const cleanStr = timeStr.trim();
  const isNegative = cleanStr.startsWith('-');
  const unsignedStr = isNegative ? cleanStr.slice(1) : cleanStr;

  const parts = unsignedStr.split(':');
  let seconds = 0;

  if (parts.length === 3) {
    // [hh:mm:ss.xx]
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    seconds = hours * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    // [mm:ss.xx]
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    seconds = mins * 60 + secs;
  } else {
    seconds = parseFloat(unsignedStr) || 0;
  }

  return {
    seconds: isNegative ? -seconds : seconds,
    isNegative
  };
}

/**
 * Elimina marcas de orden de bytes (BOM) y normaliza saltos de línea CRLF/CR a LF
 */
export function cleanRawText(raw: string): string {
  if (!raw) return '';
  // 1. Eliminar Byte Order Mark (BOM UTF-8 \uFEFF o UTF-16 \uFFFE)
  let text = raw.replace(/^[\uFEFF\uFFFE]/, '');
  // 2. Normalizar CRLF (\r\n) y CR (\r) a LF (\n)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return text;
}

/**
 * Detecta si una cadena de texto contiene marcas de tiempo LRC válidas
 */
export function isLrcContent(content: string): boolean {
  if (!content) return false;
  return /\[\d{1,2}:[0-5]?\d(?:\.\d{1,3})?\]/.test(content);
}

/**
 * Parsea un contenido de texto completo en formato LRC (.lrc)
 * Soporta:
 * - BOM y saltos de línea CRLF/LF
 * - Metadatos [ar:], [ti:], [al:], [offset:], [by:], [length:]
 * - Múltiples marcas de tiempo por línea ([00:12.00][00:24.00] Texto)
 * - Tiempos negativos (ajustados a 0 con advertencia explicable)
 * - Tiempos desordenados (reordenados cronológicamente con validación)
 */
export function parseLrc(rawContent: string): ParsedLrc {
  const warnings: string[] = [];
  const metadata: LrcMetadata = {};
  const rawText = cleanRawText(rawContent);

  if (!rawText.trim()) {
    return {
      metadata,
      lines: [],
      hasTimestamps: false,
      warnings: ['El archivo de letra proporcionado está vacío.'],
      rawText: ''
    };
  }

  const rawLines = rawText.split('\n');
  const extractedLines: Array<{ time: number; text: string; rawTime: string; originalIndex: number }> = [];

  let hadNegativeTime = false;
  let offsetMs = 0;

  // Primer paso: extraer metadatos y pares de tiempo/texto
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const rawLine = rawLines[lineIndex].trim();
    if (!rawLine) continue;

    // Verificar si es una etiqueta de metadatos: [tag:valor]
    const metaMatch = rawLine.match(METADATA_REGEX);
    if (metaMatch) {
      const tag = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();

      if (tag === 'ti') metadata.title = val;
      else if (tag === 'ar') metadata.artist = val;
      else if (tag === 'al') metadata.album = val;
      else if (tag === 'by') metadata.by = val;
      else if (tag === 're') metadata.re = val;
      else if (tag === 'length') metadata.length = val;
      else if (tag === 'offset') {
        const parsedOffset = parseInt(val, 10);
        if (!isNaN(parsedOffset)) {
          metadata.offset = parsedOffset;
          offsetMs = parsedOffset;
        } else {
          warnings.push(`Metadato offset no numérico ignorado: "${val}".`);
        }
      } else {
        metadata[tag] = val;
      }
      continue;
    }

    // Verificar si la línea contiene marcas de tiempo
    const timeMatches = Array.from(rawLine.matchAll(TIMESTAMP_REGEX));
    if (timeMatches.length === 0) {
      // Línea de texto sin marcas de tiempo (ej. cabeceras de sección o anotaciones)
      continue;
    }

    // El texto lírico es el resto de la línea tras quitar todas las marcas de tiempo
    const lyricText = rawLine.replace(TIMESTAMP_REGEX, '').trim();

    // Soportar múltiples marcas por línea:
    // ej. [00:10.50][00:20.50] Estribillo repetido
    for (const match of timeMatches) {
      const timeStr = match[1];
      const { seconds, isNegative } = parseLrcTimeToSeconds(timeStr);

      if (isNegative || seconds < 0) {
        hadNegativeTime = true;
      }

      extractedLines.push({
        time: seconds,
        text: lyricText,
        rawTime: timeStr,
        originalIndex: lineIndex
      });
    }
  }

  if (hadNegativeTime) {
    warnings.push('Se detectaron marcas de tiempo negativas en el archivo. Se ajustaron a 0.00s.');
  }

  // Aplicar offset si está definido (LRC spec: offset en ms)
  const offsetSeconds = offsetMs / 1000;
  if (offsetMs !== 0) {
    for (const line of extractedLines) {
      line.time = Math.max(0, line.time + offsetSeconds);
    }
  }

  // Verificar si las líneas estaban desordenadas cronológicamente
  let wasDisordered = false;
  for (let i = 1; i < extractedLines.length; i++) {
    if (extractedLines[i].time < extractedLines[i - 1].time) {
      wasDisordered = true;
      break;
    }
  }

  if (wasDisordered) {
    warnings.push('Las marcas de tiempo estaban desordenadas en el archivo y fueron reordenadas cronológicamente.');
  }

  // Ordenar de forma estable por tiempo ascendente
  extractedLines.sort((a, b) => {
    if (Math.abs(a.time - b.time) < 0.001) {
      return a.originalIndex - b.originalIndex;
    }
    return a.time - b.time;
  });

  // Asegurar que ningún tiempo sea negativo y crear los objetos SyncedLyricLine finales
  const lines: SyncedLyricLine[] = extractedLines.map((item, idx) => ({
    id: `lrc-line-${idx}-${Math.round(Math.max(0, item.time) * 100)}`,
    time: Math.max(0, Math.round(item.time * 100) / 100),
    text: item.text,
    rawTime: item.rawTime
  }));

  const hasTimestamps = lines.length > 0;
  if (!hasTimestamps && rawLines.length > 0) {
    warnings.push('No se encontraron marcas de tiempo con formato [mm:ss.xx] en el texto.');
  }

  return {
    metadata,
    lines,
    hasTimestamps,
    warnings,
    rawText
  };
}

/**
 * Serializa líneas sincronizadas y metadatos a formato estándar LRC (.lrc)
 */
export function serializeToLrc(lines: SyncedLyricLine[], metadata?: LrcMetadata): string {
  const output: string[] = [];

  if (metadata) {
    if (metadata.title) output.push(`[ti:${metadata.title}]`);
    if (metadata.artist) output.push(`[ar:${metadata.artist}]`);
    if (metadata.album) output.push(`[al:${metadata.album}]`);
    if (metadata.by) output.push(`[by:${metadata.by}]`);
    if (metadata.offset !== undefined && metadata.offset !== 0) output.push(`[offset:${metadata.offset}]`);
    if (metadata.length) output.push(`[length:${metadata.length}]`);
    if (metadata.re) output.push(`[re:${metadata.re}]`);

    // Añadir línea en blanco tras cabecera de metadatos si hay alguno
    if (output.length > 0) output.push('');
  }

  for (const line of lines) {
    const timestamp = `[${formatLrcTimestamp(line.time)}]`;
    output.push(`${timestamp} ${line.text}`.trimEnd());
  }

  return output.join('\n');
}

/**
 * Crea un Blob en formato LRC listo para descarga
 */
export function createLrcBlob(lines: SyncedLyricLine[], metadata?: LrcMetadata): Blob {
  const lrcString = serializeToLrc(lines, metadata);
  return new Blob([lrcString], { type: 'text/plain;charset=utf-8' });
}
