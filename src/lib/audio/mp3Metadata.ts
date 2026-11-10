/**
 * MP3 ID3 Metadata, Lyrics & Synchronized Lyrics (LRC/SYLT) Parser
 *
 * Implements pure client-side extraction of:
 * - ID3v2.4, ID3v2.3, ID3v2.2 tags
 * - ID3v1 / ID3v1.1 tags
 * - Text frames (Title, Artist, Album, Year, Genre, Key, BPM/Tempo, Time Signature)
 * - USLT / ULT (Unsynchronized Lyrics)
 * - SYLT / SLT (Synchronized Lyrics with timestamp tokens -> converted to LRC format)
 * - COMM / COM (Comments / Songwriting Notes)
 * - TXXX (User defined text frames: LYRICS, SYNCEDLYRICS, KEY, TEMPO, etc.)
 */

import { isLrcContent, stripLrcTimestamps } from '../lyrics/parseLrc';
import { formatLrcTimestamp } from '../../types/lyrics';

export interface ExtractedMp3Metadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  key?: string; // Musical key (e.g. 'Am', 'C', 'F#m')
  tempo?: number; // BPM
  timeSignature?: string; // e.g. '4/4', '3/4', '6/8'
  tuning?: string; // e.g. 'Estándar (EADGBE)'
  notes?: string; // Comments, songwriting notes, description
  lyrics?: string; // Unsynchronized lyrics (plain text with verse structure)
  lrc?: string; // Synchronized lyrics in LRC format [mm:ss.xx]
  trackNumber?: number;
  format: 'ID3v2.4' | 'ID3v2.3' | 'ID3v2.2' | 'ID3v1' | 'Desconocido';
  hasAnyMetadata: boolean;
  detectedFieldsCount: number;
}

export type Mp3FieldKey =
  | 'title'
  | 'lyrics'
  | 'lrc'
  | 'key'
  | 'tempo'
  | 'year'
  | 'genre'
  | 'notes'
  | 'timeSignature'
  | 'tuning'
  | 'albumTitle';

export interface ExtractedMp3FieldComparison {
  key: Mp3FieldKey;
  label: string;
  description: string;
  extractedValue: string | number;
  displayValue: string;
  currentValue: string | number | undefined;
  currentDisplayValue: string;
  isDifferent: boolean;
  isEmptyCurrent: boolean;
  isMultiline?: boolean;
}

// Standard ID3v1 Genre Table (0 to 147)
const ID3V1_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap',
  'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks',
  'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
  'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'AlternRock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock',
  'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream',
  'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle',
  'Native American', 'Cabaret', 'New Wave', 'Psychadelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi',
  'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock',
  'Folk', 'Folk-Rock', 'National Folk', 'Swing', 'Fast Fusion', 'Bebop', 'Latin', 'Revival',
  'Celtic', 'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock',
  'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson', 'Opera',
  'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove', 'Satire', 'Slow Jam',
  'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad', 'Rhythmic Soul', 'Freestyle',
  'Duet', 'Punk Rock', 'Drum Solo', 'Acapella', 'Euro-House', 'Dance Hall', 'Goa', 'Drum & Bass',
  'Club-House', 'Hardcore', 'Terror', 'Indie', 'BritPop', 'Negerpunk', 'Polsk Punk', 'Beat',
  'Christian Gangsta Rap', 'Heavy Metal', 'Black Metal', 'Crossover', 'Contemporary Christian', 'Christian Rock',
  'Merengue', 'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop'
];

// Map Camelot notation (Mixed In Key, Traktor) to standard musical keys
const CAMELOT_TO_KEY: Record<string, string> = {
  '1A': 'Abm', '1B': 'B',
  '2A': 'Ebm', '2B': 'F#',
  '3A': 'Bbm', '3B': 'Db',
  '4A': 'Fm',  '4B': 'Ab',
  '5A': 'Cm',  '5B': 'Eb',
  '6A': 'Gm',  '6B': 'Bb',
  '7A': 'Dm',  '7B': 'F',
  '8A': 'Am',  '8B': 'C',
  '9A': 'Em',  '9B': 'G',
  '10A': 'Bm', '10B': 'D',
  '11A': 'F#m', '11B': 'A',
  '12A': 'C#m', '12B': 'E'
};

/**
 * Decodes synchsafe integer (7 bits per byte).
 */
export function readSynchsafeInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

/**
 * Decodes standard 32-bit big-endian integer.
 */
export function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

/**
 * Decodes 24-bit big-endian integer (used in ID3v2.2 frame size).
 */
export function readUint24BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

/**
 * Decodes ASCII/Latin string of given length.
 */
function decodeAscii(bytes: Uint8Array, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    const code = bytes[offset + i];
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

/**
 * Finds null terminator in byte array based on text encoding.
 * Encoding:
 * 0 = ISO-8859-1 (1 null byte)
 * 1 = UTF-16 with BOM (2 null bytes aligned)
 * 2 = UTF-16BE (2 null bytes aligned)
 * 3 = UTF-8 (1 null byte)
 */
function findNullTerminator(bytes: Uint8Array, start: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    // 2-byte terminator, check 2-byte alignment relative to start
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0x00 && bytes[i + 1] === 0x00) {
        return i;
      }
    }
  } else {
    // 1-byte terminator
    for (let i = start; i < bytes.length; i++) {
      if (bytes[i] === 0x00) {
        return i;
      }
    }
  }
  return bytes.length;
}

/**
 * Decodes text slice according to ID3 encoding byte.
 */
function decodeTextSlice(bytes: Uint8Array, encoding: number): string {
  if (bytes.length === 0) return '';

  try {
    if (encoding === 0) {
      // ISO-8859-1
      return new TextDecoder('iso-8859-1').decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 1) {
      // UTF-16 with BOM
      if (bytes.length >= 2) {
        if (bytes[0] === 0xff && bytes[1] === 0xfe) {
          return new TextDecoder('utf-16le').decode(bytes.slice(2)).replace(/\0+$/, '').trim();
        } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
          return new TextDecoder('utf-16be').decode(bytes.slice(2)).replace(/\0+$/, '').trim();
        }
      }
      return new TextDecoder('utf-16le').decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 2) {
      // UTF-16BE without BOM
      return new TextDecoder('utf-16be').decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 3) {
      // UTF-8
      return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '').trim();
    }
  } catch (err) {
    // Fallback simple latin-1 decode
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0) s += String.fromCharCode(bytes[i]);
    }
    return s.trim();
  }

  return '';
}

/**
 * Clean & normalize musical key (e.g. Camelot '8A' -> 'Am', '11B' -> 'A', 'Db' -> 'C#')
 */
export function normalizeMusicalKey(rawKey: string): string {
  if (!rawKey) return '';
  const trimmed = rawKey.trim();

  // Check Camelot
  const camelotMatch = trimmed.match(/^([1-9]|1[0-2])[a-bA-B]$/i);
  if (camelotMatch) {
    const key = camelotMatch[0].toUpperCase();
    if (CAMELOT_TO_KEY[key]) {
      return CAMELOT_TO_KEY[key];
    }
  }

  // Common patterns like "C major", "A minor", "F#m", "G#"
  const clean = trimmed
    .replace(/\s+major/i, '')
    .replace(/\s+maj/i, '')
    .replace(/\s+minor/i, 'm')
    .replace(/\s+min/i, 'm');

  return clean;
}

/**
 * Clean & normalize genre (e.g. "(17)" -> "Rock", "17" -> "Rock", "(13)Pop" -> "Pop")
 */
export function normalizeGenre(rawGenre: string): string {
  if (!rawGenre) return '';
  const trimmed = rawGenre.trim();

  // Match (17) or (17)Rock
  const parenMatch = trimmed.match(/^\((\d{1,3})\)(.*)$/);
  if (parenMatch) {
    const idx = parseInt(parenMatch[1], 10);
    const suffix = parenMatch[2].trim();
    if (suffix) return suffix;
    if (idx >= 0 && idx < ID3V1_GENRES.length) {
      return ID3V1_GENRES[idx];
    }
  }

  // Pure digits: "17"
  if (/^\d{1,3}$/.test(trimmed)) {
    const idx = parseInt(trimmed, 10);
    if (idx >= 0 && idx < ID3V1_GENRES.length) {
      return ID3V1_GENRES[idx];
    }
  }

  return trimmed;
}

/**
 * Clean & normalize year/date from strings like "2024", "2024-05-18", "1998"
 */
export function normalizeYear(rawYear: string): number | undefined {
  if (!rawYear) return undefined;
  const match = rawYear.match(/\b(19\d{2}|20\d{2})\b/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed >= 1900 && parsed <= 2100) {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Converts ID3 SYLT (Synchronized Lyrics) tokens into standardized LRC format.
 */
function parseSyltToLrc(
  data: Uint8Array,
  encoding: number,
  timeFormat: number, // 1 = MPEG frames, 2 = milliseconds
  contentDescriptorEnd: number
): { lrc: string; lyrics: string } {
  let pos = contentDescriptorEnd;
  const lines: Array<{ timeMs: number; text: string }> = [];

  // Frame duration approximation if format === 1 (MPEG frames ~26ms at 44.1kHz standard MP3 frame)
  const msPerFrame = 26.122;

  let currentLineBuffer = '';
  let currentLineStartTime: number | null = null;

  while (pos < data.length) {
    // Find null terminator for text string
    const termPos = findNullTerminator(data, pos, encoding);
    if (termPos >= data.length) break;

    const termLen = encoding === 1 || encoding === 2 ? 2 : 1;
    const textBytes = data.slice(pos, termPos);
    const tokenText = decodeTextSlice(textBytes, encoding);

    pos = termPos + termLen;
    if (pos + 4 > data.length) break;

    // Read 32-bit timestamp
    const rawTime = readUint32BE(data, pos);
    pos += 4;

    const timeMs = timeFormat === 1 ? Math.round(rawTime * msPerFrame) : rawTime;

    if (currentLineStartTime === null) {
      currentLineStartTime = timeMs;
    }

    // Check if tokenText represents newline or line break
    if (tokenText.includes('\n') || tokenText.includes('\r')) {
      const parts = tokenText.split(/\r\n|\r|\n/);
      for (let p = 0; p < parts.length; p++) {
        if (p > 0) {
          if (currentLineBuffer.trim()) {
            lines.push({
              timeMs: currentLineStartTime ?? timeMs,
              text: currentLineBuffer.trim()
            });
          }
          currentLineBuffer = parts[p];
          currentLineStartTime = timeMs;
        } else {
          currentLineBuffer += parts[p];
        }
      }
    } else {
      currentLineBuffer += tokenText;
    }
  }

  if (currentLineBuffer.trim() && currentLineStartTime !== null) {
    lines.push({
      timeMs: currentLineStartTime,
      text: currentLineBuffer.trim()
    });
  }

  if (lines.length === 0) {
    return { lrc: '', lyrics: '' };
  }

  // Format into standard LRC: [mm:ss.xx] line
  const lrcLines = lines.map(item => {
    const seconds = Math.max(0, item.timeMs / 1000);
    return `[${formatLrcTimestamp(seconds)}] ${item.text}`;
  });

  const lrc = lrcLines.join('\n');
  const lyrics = lines.map(item => item.text).join('\n');

  return { lrc, lyrics };
}

/**
 * Parses ID3v2 tag from binary data buffer.
 */
function parseId3v2(bytes: Uint8Array): Partial<ExtractedMp3Metadata> | null {
  if (bytes.length < 10) return null;

  // Header must begin with "ID3" (0x49, 0x44, 0x33)
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return null;
  }

  const majorVersion = bytes[3];
  const revision = bytes[4];
  const flags = bytes[5];

  if (majorVersion !== 2 && majorVersion !== 3 && majorVersion !== 4) {
    return null;
  }

  const formatStr: ExtractedMp3Metadata['format'] =
    majorVersion === 4 ? 'ID3v2.4' : majorVersion === 3 ? 'ID3v2.3' : 'ID3v2.2';

  // Tag size (excluding 10-byte header) is synchsafe integer
  const tagSize = readSynchsafeInt(bytes, 6);
  const tagEnd = Math.min(bytes.length, 10 + tagSize);

  let offset = 10;

  // Handle extended header
  const hasExtendedHeader = (flags & 0x40) !== 0;
  if (hasExtendedHeader && offset + 4 <= tagEnd) {
    if (majorVersion === 4) {
      const extSize = readSynchsafeInt(bytes, offset);
      offset += extSize;
    } else if (majorVersion === 3) {
      const extSize = readUint32BE(bytes, offset);
      offset += extSize + 4;
    }
  }

  const result: Partial<ExtractedMp3Metadata> = {
    format: formatStr
  };

  const isV2 = majorVersion === 2;

  while (offset < tagEnd) {
    // Check for padding (zero bytes)
    if (bytes[offset] === 0x00) {
      break;
    }

    let frameId = '';
    let frameSize = 0;
    let headerLen = 0;

    if (isV2) {
      // ID3v2.2: 3-character ID, 3-byte size, no flags
      if (offset + 6 > tagEnd) break;
      frameId = decodeAscii(bytes, offset, 3);
      frameSize = readUint24BE(bytes, offset + 3);
      headerLen = 6;
    } else {
      // ID3v2.3 / ID3v2.4: 4-character ID, 4-byte size, 2-byte flags
      if (offset + 10 > tagEnd) break;
      frameId = decodeAscii(bytes, offset, 4);
      if (majorVersion === 4) {
        frameSize = readSynchsafeInt(bytes, offset + 4);
      } else {
        frameSize = readUint32BE(bytes, offset + 4);
      }
      headerLen = 10;
    }

    if (frameSize <= 0 || offset + headerLen + frameSize > tagEnd) {
      break;
    }

    const payload = bytes.subarray(offset + headerLen, offset + headerLen + frameSize);
    offset += headerLen + frameSize;

    if (payload.length === 0) continue;

    const encoding = payload[0];

    // Decode Text Frames
    if (
      frameId === 'TIT2' || frameId === 'TT2' // Title
    ) {
      const val = decodeTextSlice(payload.slice(1), encoding);
      if (val && !result.title) result.title = val;
    } else if (
      frameId === 'TPE1' || frameId === 'TP1' // Artist
    ) {
      const val = decodeTextSlice(payload.slice(1), encoding);
      if (val && !result.artist) result.artist = val;
    } else if (
      frameId === 'TALB' || frameId === 'TAL' // Album
    ) {
      const val = decodeTextSlice(payload.slice(1), encoding);
      if (val && !result.album) result.album = val;
    } else if (
      frameId === 'TYER' || frameId === 'TYE' || frameId === 'TDRC' // Year / Recording time
    ) {
      const val = decodeTextSlice(payload.slice(1), encoding);
      const parsedYear = normalizeYear(val);
      if (parsedYear && !result.year) result.year = parsedYear;
    } else if (
      frameId === 'TCON' || frameId === 'TCO' // Content Type / Genre
    ) {
      const val = decodeTextSlice(payload.slice(1), encoding);
      const cleanGenre = normalizeGenre(val);
      if (cleanGenre && !result.genre) result.genre = cleanGenre;
    } else if (
      frameId === 'TBPM' || frameId === 'TBP' // BPM / Tempo
    ) {
      const val = decodeTextSlice(payload.slice(1), encoding);
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed > 0 && !result.tempo) {
        result.tempo = Math.round(parsed);
      }
    } else if (
      frameId === 'TKEY' || frameId === 'TKE' // Initial Key
    ) {
      const val = decodeTextSlice(payload.slice(1), encoding);
      const cleanKey = normalizeMusicalKey(val);
      if (cleanKey && !result.key) result.key = cleanKey;
    } else if (
      frameId === 'TRCK' || frameId === 'TRK' // Track number
    ) {
      const val = decodeTextSlice(payload.slice(1), encoding);
      const trackMatch = val.match(/^(\d+)/);
      if (trackMatch && !result.trackNumber) {
        result.trackNumber = parseInt(trackMatch[1], 10);
      }
    }
    // USLT / ULT - Unsynchronized lyrics
    else if (frameId === 'USLT' || frameId === 'ULT') {
      if (payload.length > 4) {
        // payload[0] = encoding, payload[1..3] = language (3 chars)
        const termPos = findNullTerminator(payload, 4, encoding);
        const termLen = encoding === 1 || encoding === 2 ? 2 : 1;
        const lyricsBytes = payload.slice(termPos + termLen);
        const lyricsText = decodeTextSlice(lyricsBytes, encoding);

        if (lyricsText) {
          // Check if this USLT frame already contains LRC timestamp lines
          if (isLrcContent(lyricsText)) {
            if (!result.lrc) result.lrc = lyricsText;
            if (!result.lyrics) result.lyrics = stripLrcTimestamps(lyricsText);
          } else {
            if (!result.lyrics) result.lyrics = lyricsText;
          }
        }
      }
    }
    // SYLT / SLT - Synchronized lyrics
    else if (frameId === 'SYLT' || frameId === 'SLT') {
      if (payload.length > 6) {
        // payload[0] = encoding
        // payload[1..3] = language
        // payload[4] = timeFormat (1=frames, 2=ms)
        // payload[5] = contentType (1=lyrics)
        const timeFormat = payload[4];
        const termPos = findNullTerminator(payload, 6, encoding);
        const termLen = encoding === 1 || encoding === 2 ? 2 : 1;
        const descEnd = termPos + termLen;

        const syltResult = parseSyltToLrc(payload, encoding, timeFormat, descEnd);
        if (syltResult.lrc && !result.lrc) {
          result.lrc = syltResult.lrc;
        }
        if (syltResult.lyrics && !result.lyrics) {
          result.lyrics = syltResult.lyrics;
        }
      }
    }
    // COMM / COM - Comments & Songwriting notes
    else if (frameId === 'COMM' || frameId === 'COM') {
      if (payload.length > 4) {
        const termPos = findNullTerminator(payload, 4, encoding);
        const termLen = encoding === 1 || encoding === 2 ? 2 : 1;
        const commentBytes = payload.slice(termPos + termLen);
        const commentText = decodeTextSlice(commentBytes, encoding);

        if (commentText) {
          // Sometimes lyrics or LRC are put into COMM
          if (isLrcContent(commentText)) {
            if (!result.lrc) result.lrc = commentText;
            if (!result.lyrics) result.lyrics = stripLrcTimestamps(commentText);
          } else if (commentText.length > 100 && commentText.includes('\n') && !result.lyrics) {
            // Likely lyrics in comment
            result.lyrics = commentText;
          } else if (!result.notes) {
            result.notes = commentText;
          }
        }
      }
    }
    // TXXX - User defined text frames
    else if (frameId === 'TXXX') {
      if (payload.length > 1) {
        const termPos = findNullTerminator(payload, 1, encoding);
        const termLen = encoding === 1 || encoding === 2 ? 2 : 1;
        const descBytes = payload.slice(1, termPos);
        const desc = decodeTextSlice(descBytes, encoding).trim().toUpperCase();
        const valueBytes = payload.slice(termPos + termLen);
        const val = decodeTextSlice(valueBytes, encoding).trim();

        if (val) {
          if (desc === 'LYRICS' || desc === 'UNSYNCED LYRICS' || desc === 'UNSYNCEDLYRICS') {
            if (isLrcContent(val)) {
              if (!result.lrc) result.lrc = val;
              if (!result.lyrics) result.lyrics = stripLrcTimestamps(val);
            } else if (!result.lyrics) {
              result.lyrics = val;
            }
          } else if (desc === 'SYNCEDLYRICS' || desc === 'LRC' || desc === 'SYNCED LYRICS') {
            if (!result.lrc) result.lrc = val;
            if (!result.lyrics) result.lyrics = stripLrcTimestamps(val);
          } else if ((desc === 'KEY' || desc === 'INITIALKEY') && !result.key) {
            result.key = normalizeMusicalKey(val);
          } else if ((desc === 'BPM' || desc === 'TEMPO') && !result.tempo) {
            const p = parseFloat(val);
            if (!isNaN(p)) result.tempo = Math.round(p);
          } else if ((desc === 'TIME SIGNATURE' || desc === 'METER') && !result.timeSignature) {
            result.timeSignature = val;
          } else if (desc === 'TUNING' && !result.tuning) {
            result.tuning = val;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Parses ID3v1 / ID3v1.1 tag (last 128 bytes of file).
 */
function parseId3v1(bytes: Uint8Array): Partial<ExtractedMp3Metadata> | null {
  if (bytes.length < 128) return null;

  const offset = bytes.length - 128;
  // Must start with "TAG" (0x54, 0x41, 0x47)
  if (bytes[offset] !== 0x54 || bytes[offset + 1] !== 0x41 || bytes[offset + 2] !== 0x47) {
    return null;
  }

  const title = decodeTextSlice(bytes.slice(offset + 3, offset + 33), 0);
  const artist = decodeTextSlice(bytes.slice(offset + 33, offset + 63), 0);
  const album = decodeTextSlice(bytes.slice(offset + 63, offset + 93), 0);
  const yearStr = decodeTextSlice(bytes.slice(offset + 93, offset + 97), 0);

  // Check ID3v1.1 track number
  let comment = '';
  let trackNumber: number | undefined;

  if (bytes[offset + 125] === 0x00 && bytes[offset + 126] !== 0x00) {
    comment = decodeTextSlice(bytes.slice(offset + 97, offset + 125), 0);
    trackNumber = bytes[offset + 126];
  } else {
    comment = decodeTextSlice(bytes.slice(offset + 97, offset + 127), 0);
  }

  const genreByte = bytes[offset + 127];
  let genre: string | undefined;
  if (genreByte < ID3V1_GENRES.length) {
    genre = ID3V1_GENRES[genreByte];
  }

  const parsedYear = normalizeYear(yearStr);

  return {
    title: title || undefined,
    artist: artist || undefined,
    album: album || undefined,
    year: parsedYear,
    genre,
    notes: comment || undefined,
    trackNumber,
    format: 'ID3v1'
  };
}

/**
 * Extracts complete metadata, lyrics and synchronized lyrics from an MP3 File, Blob, or ArrayBuffer.
 */
export async function extractMp3Metadata(
  input: File | Blob | ArrayBuffer
): Promise<ExtractedMp3Metadata> {
  let buffer: ArrayBuffer;

  if (input instanceof ArrayBuffer) {
    buffer = input;
  } else {
    buffer = await input.arrayBuffer();
  }

  const bytes = new Uint8Array(buffer);

  // 1. Try parsing ID3v2 at the beginning of the file
  const id3v2Data = parseId3v2(bytes);

  // 2. Try parsing ID3v1 at the end of the file
  const id3v1Data = parseId3v1(bytes);

  // 3. Merge: prefer ID3v2 if present, fallback to ID3v1 for missing fields
  const merged: ExtractedMp3Metadata = {
    title: id3v2Data?.title || id3v1Data?.title,
    artist: id3v2Data?.artist || id3v1Data?.artist,
    album: id3v2Data?.album || id3v1Data?.album,
    year: id3v2Data?.year || id3v1Data?.year,
    genre: id3v2Data?.genre || id3v1Data?.genre,
    key: id3v2Data?.key,
    tempo: id3v2Data?.tempo,
    timeSignature: id3v2Data?.timeSignature,
    tuning: id3v2Data?.tuning,
    notes: id3v2Data?.notes || id3v1Data?.notes,
    lyrics: id3v2Data?.lyrics,
    lrc: id3v2Data?.lrc,
    trackNumber: id3v2Data?.trackNumber || id3v1Data?.trackNumber,
    format: id3v2Data?.format || id3v1Data?.format || 'Desconocido',
    hasAnyMetadata: false,
    detectedFieldsCount: 0
  };

  // Count detected useful fields
  let count = 0;
  if (merged.title) count++;
  if (merged.lyrics) count++;
  if (merged.lrc) count++;
  if (merged.key) count++;
  if (merged.tempo) count++;
  if (merged.year) count++;
  if (merged.genre) count++;
  if (merged.notes) count++;
  if (merged.timeSignature) count++;
  if (merged.tuning) count++;
  if (merged.album) count++;

  merged.detectedFieldsCount = count;
  merged.hasAnyMetadata = count > 0;

  return merged;
}

/**
 * Builds side-by-side comparison field definitions between current song data and extracted MP3 metadata.
 */
export function buildComparisonFields(
  extracted: ExtractedMp3Metadata,
  current: {
    title?: string;
    lyrics?: string;
    lrc?: string;
    key?: string;
    tempo?: number | string;
    year?: number;
    genre?: string;
    notes?: string;
    timeSignature?: string;
    tuning?: string;
    albumTitle?: string;
  }
): ExtractedMp3FieldComparison[] {
  const fields: ExtractedMp3FieldComparison[] = [];

  // Helper to test if two values are meaningfully different
  const areDifferent = (a: any, b: any): boolean => {
    const strA = (a === undefined || a === null ? '' : String(a)).trim();
    const strB = (b === undefined || b === null ? '' : String(b)).trim();
    return strA.toLowerCase() !== strB.toLowerCase();
  };

  // Helper to format display text
  const cleanDisplay = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim();
  };

  // 1. Title
  if (extracted.title) {
    const curVal = current.title;
    const isDiff = areDifferent(curVal, extracted.title);
    fields.push({
      key: 'title',
      label: 'Título de la Canción',
      description: 'Nombre de la composición',
      extractedValue: extracted.title,
      displayValue: extracted.title,
      currentValue: curVal,
      currentDisplayValue: cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: !curVal?.trim()
    });
  }

  // 2. Lyrics
  if (extracted.lyrics) {
    const curVal = current.lyrics;
    const curEmpty = !curVal?.trim() || curVal.includes('Escribe el primer verso aquí') || curVal.includes('Escribe aquí el primer verso');
    const isDiff = curEmpty || areDifferent(curVal, extracted.lyrics);
    const lineCount = extracted.lyrics.split('\n').filter(l => l.trim()).length;
    fields.push({
      key: 'lyrics',
      label: 'Letra de la Canción',
      description: `Texto poético (${lineCount} ${lineCount === 1 ? 'verso' : 'versos'})`,
      extractedValue: extracted.lyrics,
      displayValue: extracted.lyrics,
      currentValue: curVal,
      currentDisplayValue: curEmpty ? '' : cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: curEmpty,
      isMultiline: true
    });
  }

  // 3. Synchronized Lyrics (LRC)
  if (extracted.lrc) {
    const curVal = current.lrc;
    const isDiff = areDifferent(curVal, extracted.lrc);
    const lineCount = extracted.lrc.split('\n').filter(l => l.trim().startsWith('[')).length;
    fields.push({
      key: 'lrc',
      label: 'Letra Sincronizada (LRC)',
      description: `Marcas de tiempo rítmicas [mm:ss.xx] (${lineCount} líneas)`,
      extractedValue: extracted.lrc,
      displayValue: extracted.lrc,
      currentValue: curVal,
      currentDisplayValue: cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: !curVal?.trim(),
      isMultiline: true
    });
  }

  // 4. Key
  if (extracted.key) {
    const curVal = current.key;
    const isDiff = areDifferent(curVal, extracted.key);
    fields.push({
      key: 'key',
      label: 'Tonalidad / Tono',
      description: 'Armadura y escala musical',
      extractedValue: extracted.key,
      displayValue: extracted.key,
      currentValue: curVal,
      currentDisplayValue: cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: !curVal?.trim()
    });
  }

  // 5. Tempo / BPM
  if (extracted.tempo) {
    const curVal = current.tempo !== undefined && current.tempo !== '' ? Number(current.tempo) : undefined;
    const isDiff = curVal === undefined || curVal !== extracted.tempo;
    fields.push({
      key: 'tempo',
      label: 'Tempo (BPM)',
      description: 'Pulsaciones por minuto',
      extractedValue: extracted.tempo,
      displayValue: `${extracted.tempo} BPM`,
      currentValue: curVal,
      currentDisplayValue: curVal ? `${curVal} BPM` : '',
      isDifferent: isDiff,
      isEmptyCurrent: curVal === undefined || isNaN(curVal)
    });
  }

  // 6. Year
  if (extracted.year) {
    const curVal = current.year;
    const isDiff = curVal === undefined || curVal !== extracted.year;
    fields.push({
      key: 'year',
      label: 'Año de Composición',
      description: 'Fecha o año de grabación',
      extractedValue: extracted.year,
      displayValue: String(extracted.year),
      currentValue: curVal,
      currentDisplayValue: curVal ? String(curVal) : '',
      isDifferent: isDiff,
      isEmptyCurrent: curVal === undefined
    });
  }

  // 7. Genre
  if (extracted.genre) {
    const curVal = current.genre;
    const isDiff = areDifferent(curVal, extracted.genre);
    fields.push({
      key: 'genre',
      label: 'Género Musical',
      description: 'Estilo y categorización acústica',
      extractedValue: extracted.genre,
      displayValue: extracted.genre,
      currentValue: curVal,
      currentDisplayValue: cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: !curVal?.trim()
    });
  }

  // 8. Notes / Comments
  if (extracted.notes) {
    const curVal = current.notes;
    const isDiff = areDifferent(curVal, extracted.notes);
    fields.push({
      key: 'notes',
      label: 'Notas del Autor / Comentarios',
      description: 'Apuntes de composición y arreglos',
      extractedValue: extracted.notes,
      displayValue: extracted.notes,
      currentValue: curVal,
      currentDisplayValue: cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: !curVal?.trim(),
      isMultiline: true
    });
  }

  // 9. Time Signature
  if (extracted.timeSignature) {
    const curVal = current.timeSignature;
    const isDiff = areDifferent(curVal, extracted.timeSignature);
    fields.push({
      key: 'timeSignature',
      label: 'Compás Rítmico',
      description: 'Métrica musical (ej. 4/4, 3/4, 6/8)',
      extractedValue: extracted.timeSignature,
      displayValue: extracted.timeSignature,
      currentValue: curVal,
      currentDisplayValue: cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: !curVal?.trim()
    });
  }

  // 10. Tuning
  if (extracted.tuning) {
    const curVal = current.tuning;
    const isDiff = areDifferent(curVal, extracted.tuning);
    fields.push({
      key: 'tuning',
      label: 'Afinación de Instrumento',
      description: 'Patrón de afinación (ej. Drop D, DADGAD)',
      extractedValue: extracted.tuning,
      displayValue: extracted.tuning,
      currentValue: curVal,
      currentDisplayValue: cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: !curVal?.trim()
    });
  }

  // 11. Album / Collection
  if (extracted.album) {
    const curVal = current.albumTitle;
    const isDiff = areDifferent(curVal, extracted.album);
    fields.push({
      key: 'albumTitle',
      label: 'Álbum / Colección',
      description: 'Disco o recopilación vinculada',
      extractedValue: extracted.album,
      displayValue: extracted.album,
      currentValue: curVal,
      currentDisplayValue: cleanDisplay(curVal),
      isDifferent: isDiff,
      isEmptyCurrent: !curVal?.trim()
    });
  }

  return fields;
}
