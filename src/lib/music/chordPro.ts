import type { Song } from '../../types/song';
import {
  AccidentalPreference,
  transposeChord,
  transposeLyrics
} from '../../utils/markdownParser';

export interface ChordProExportOptions {
  semitones?: number;
  accidentalPreference?: AccidentalPreference;
  capoFret?: number;
  artist?: string;
}

export interface ParsedChordProSong {
  title: string;
  artist?: string;
  key?: string;
  tempo?: number;
  timeSignature?: string;
  tuning?: string;
  year?: number;
  genre?: string;
  notes?: string;
  lyrics: string;
}

/**
 * Serializes a Song to standard ChordPro (.cho / .chopro) format,
 * compatible with OnSong, SongBook, and MobileSheets.
 */
export function songToChordPro(
  song: Song,
  options: ChordProExportOptions = {}
): string {
  const semitones = options.semitones ?? 0;
  const pref = options.accidentalPreference;
  const capo = options.capoFret ?? 0;

  const effectiveKey = transposeChord(song.key || 'Am', semitones, pref);
  const effectiveLyrics = transposeLyrics(song.lyrics || '', semitones, pref);

  const header: string[] = [
    `{title: ${song.title || 'Sin título'}}`,
    options.artist ? `{artist: ${options.artist}}` : '',
    effectiveKey ? `{key: ${effectiveKey}}` : '',
    song.tempo ? `{tempo: ${song.tempo}}` : '',
    song.timeSignature ? `{time: ${song.timeSignature}}` : '',
    capo > 0 ? `{capo: ${capo}}` : '',
    song.tuning ? `{meta: tuning ${song.tuning}}` : '',
    song.genre ? `{meta: genre ${song.genre}}` : '',
    song.year ? `{meta: year ${song.year}}` : '',
    song.notes ? `{comment: ${song.notes.replace(/\r?\n/g, ' | ')}}` : ''
  ].filter(Boolean);

  const bodyLines: string[] = [];
  let openBlockEndTag: string | null = null;

  const closeOpenBlock = () => {
    if (openBlockEndTag) {
      bodyLines.push(openBlockEndTag);
      openBlockEndTag = null;
    }
  };

  for (const rawLine of effectiveLyrics.split('\n')) {
    const trimmed = rawLine.trim();
    if (/^#{1,3}\s+/.test(trimmed)) {
      closeOpenBlock();
      if (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] !== '') {
        bodyLines.push('');
      }
      const sectionName = trimmed.replace(/^#+\s*/, '').trim();
      const lower = sectionName.toLowerCase();

      if (lower.includes('estribillo') || lower.includes('coro') || lower.includes('chorus')) {
        bodyLines.push(`{start_of_chorus: ${sectionName}}`);
        openBlockEndTag = '{end_of_chorus}';
      } else if (lower.includes('estrofa') || lower.includes('verso') || lower.includes('verse')) {
        bodyLines.push(`{start_of_verse: ${sectionName}}`);
        openBlockEndTag = '{end_of_verse}';
      } else if (lower.includes('puente') || lower.includes('bridge')) {
        bodyLines.push(`{start_of_bridge: ${sectionName}}`);
        openBlockEndTag = '{end_of_bridge}';
      } else {
        bodyLines.push(`{comment: ${sectionName}}`);
      }
      continue;
    }

    bodyLines.push(rawLine);
  }

  closeOpenBlock();

  return `${header.join('\n')}\n\n${bodyLines.join('\n').trim()}\n`;
}

/**
 * Parses a ChordPro (.cho / .chopro / .crd) file into Song fields & Markdown lyrics.
 */
export function chordProToSong(
  content: string,
  fallbackTitle?: string
): ParsedChordProSong {
  const result: ParsedChordProSong = {
    title: fallbackTitle || 'Canción importada',
    lyrics: ''
  };

  const lyricLines: string[] = [];
  const noteParts: string[] = [];
  let capoNotes: string | null = null;

  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Ignore ChordPro file comments starting with #
    if (trimmed.startsWith('#')) {
      continue;
    }

    // Match single directive on line: {directive: value} or {directive}
    const dirMatch = trimmed.match(/^\{([^}:]+?)(?::\s*(.*?))?\}$/);
    if (dirMatch) {
      const key = dirMatch[1].trim().toLowerCase();
      const val = (dirMatch[2] ?? '').trim();

      switch (key) {
        case 'title':
        case 't':
          if (val) result.title = val;
          break;
        case 'artist':
        case 'st':
        case 'subtitle':
          if (val && !result.artist) result.artist = val;
          break;
        case 'key':
          if (val) result.key = val;
          break;
        case 'tempo': {
          const parsedTempo = parseInt(val, 10);
          if (Number.isFinite(parsedTempo) && parsedTempo > 0) {
            result.tempo = parsedTempo;
          }
          break;
        }
        case 'time':
          if (val) result.timeSignature = val;
          break;
        case 'capo':
          if (val && val !== '0') {
            capoNotes = `Cejilla en traste ${val}`;
          }
          break;
        case 'meta': {
          const metaParts = val.match(/^(\S+)\s+(.+)$/);
          if (metaParts) {
            const mKey = metaParts[1].toLowerCase();
            const mVal = metaParts[2].trim();
            if (mKey === 'tuning') result.tuning = mVal;
            else if (mKey === 'genre') result.genre = mVal;
            else if (mKey === 'year') {
              const y = parseInt(mVal, 10);
              if (Number.isFinite(y)) result.year = y;
            }
          }
          break;
        }
        case 'start_of_chorus':
        case 'soc':
          lyricLines.push(`## ${val || 'Estribillo'}`);
          break;
        case 'start_of_verse':
        case 'sov':
          lyricLines.push(`## ${val || 'Estrofa'}`);
          break;
        case 'start_of_bridge':
        case 'sob':
          lyricLines.push(`## ${val || 'Puente'}`);
          break;
        case 'start_of_tab':
        case 'sot':
          lyricLines.push(`## ${val || 'Tablatura / Riff'}`);
          break;
        case 'end_of_chorus':
        case 'eoc':
        case 'end_of_verse':
        case 'eov':
        case 'end_of_bridge':
        case 'eob':
        case 'end_of_tab':
        case 'eot':
          if (lyricLines.length > 0 && lyricLines[lyricLines.length - 1] !== '') {
            lyricLines.push('');
          }
          break;
        case 'comment':
        case 'c':
        case 'comment_italic':
        case 'ci':
        case 'comment_box':
        case 'cb':
          if (val) {
            // Heuristic: short section-like comments become ## headers, long ones become notes
            if (val.length <= 36 && !val.includes('|')) {
              lyricLines.push(`## ${val}`);
            } else {
              noteParts.push(val);
            }
          }
          break;
        default:
          break;
      }
      continue;
    }

    lyricLines.push(line);
  }

  if (capoNotes) {
    noteParts.unshift(capoNotes);
  }
  if (noteParts.length > 0) {
    result.notes = noteParts.join('\n');
  }

  result.lyrics = lyricLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

/**
 * Triggers a browser download for a `.cho` ChordPro file.
 */
export function downloadChordProFile(
  song: Song,
  options: ChordProExportOptions = {}
): void {
  const content = songToChordPro(song, options);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${song.id || 'cancion'}.cho`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
