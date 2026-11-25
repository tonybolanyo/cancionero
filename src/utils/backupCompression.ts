import { Song } from '../types/song';

export const MAX_BACKUP_POINTS = 5;

const LZ_PREFIX = 'LZ1:';
const RAW_PREFIX = 'RAW:';
const CHAR_OFFSET = 0x0100; // Maps 0..16383 -> 0x0100..0x40FF (avoids surrogate code units)
const MAX_DICT_SIZE = 16384;

export interface SongBackupSummaryItem {
  id: string;
  title: string;
  key: string;
  status: string;
}

export interface SongBackupPoint {
  id: string;
  timestamp: string;
  name: string;
  reason: 'pre_import_json' | 'pre_import_md' | 'pre_sync' | 'pre_reset' | 'manual';
  songCount: number;
  songsJson: string;
  songsSummary: SongBackupSummaryItem[];
}

export interface BackupDiffPayload {
  order: string[];
  changedSongs: Song[];
  removedIds: string[];
}

export interface StoredBackupEntry {
  id: string;
  timestamp: string;
  name: string;
  reason: SongBackupPoint['reason'];
  songCount: number;
  songsSummary: SongBackupSummaryItem[];
  mode: 'full' | 'diff';
  payload: string;
}

/**
 * Synchronous UTF-8 safe LZW compressor producing BMP-safe strings (no surrogate pairs).
 * Falls back to RAW: prefix if compression does not reduce size.
 */
export function compressUtf8String(input: string): string {
  if (!input) return `${RAW_PREFIX}`;

  const bytes = new TextEncoder().encode(input);
  if (bytes.length < 32) {
    return `${RAW_PREFIX}${input}`;
  }

  const dict = new Map<string, number>();
  for (let i = 0; i < 256; i++) {
    dict.set(String.fromCharCode(i), i);
  }

  let dictSize = 256;
  let w = '';
  const codes: number[] = [];

  for (let i = 0; i < bytes.length; i++) {
    const c = String.fromCharCode(bytes[i]);
    const wc = w + c;
    if (dict.has(wc)) {
      w = wc;
    } else {
      codes.push(dict.get(w)!);
      if (dictSize < MAX_DICT_SIZE) {
        dict.set(wc, dictSize++);
      }
      w = c;
    }
  }

  if (w !== '') {
    codes.push(dict.get(w)!);
  }

  if (codes.length + LZ_PREFIX.length >= input.length) {
    return `${RAW_PREFIX}${input}`;
  }

  let out = LZ_PREFIX;
  for (let i = 0; i < codes.length; i += 8192) {
    const chunk = codes.slice(i, i + 8192).map(code => code + CHAR_OFFSET);
    out += String.fromCharCode(...chunk);
  }
  return out;
}

/**
 * Decompresses strings produced by compressUtf8String().
 * Passes through plain JSON strings seamlessly for backwards compatibility.
 */
export function decompressUtf8String(encoded: string): string {
  if (!encoded) return '';
  if (encoded.startsWith(RAW_PREFIX)) {
    return encoded.slice(RAW_PREFIX.length);
  }
  if (!encoded.startsWith(LZ_PREFIX)) {
    return encoded;
  }

  const body = encoded.slice(LZ_PREFIX.length);
  if (body.length === 0) return '';

  const dict: string[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    dict[i] = String.fromCharCode(i);
  }
  let dictSize = 256;

  const firstCode = body.charCodeAt(0) - CHAR_OFFSET;
  let w = dict[firstCode];
  if (w === undefined) {
    throw new Error('Corrupted LZ1 compressed stream (invalid initial code).');
  }

  const chunks: string[] = [w];

  for (let i = 1; i < body.length; i++) {
    const k = body.charCodeAt(i) - CHAR_OFFSET;
    let entry: string;
    if (k < dict.length && dict[k] !== undefined) {
      entry = dict[k];
    } else if (k === dictSize) {
      entry = w + w.charAt(0);
    } else {
      throw new Error(`Corrupted LZ1 compressed stream at index ${i} (code ${k}).`);
    }

    chunks.push(entry);
    if (dictSize < MAX_DICT_SIZE) {
      dict[dictSize++] = w + entry.charAt(0);
    }
    w = entry;
  }

  const rawLatin1 = chunks.join('');
  const outBytes = new Uint8Array(rawLatin1.length);
  for (let i = 0; i < rawLatin1.length; i++) {
    outBytes[i] = rawLatin1.charCodeAt(i);
  }
  return new TextDecoder().decode(outBytes);
}

function parseSongsFromBackup(point: SongBackupPoint): Song[] {
  try {
    const parsed = JSON.parse(point.songsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Encodes up to MAX_BACKUP_POINTS (5) backups as a compressed newest snapshot
 * followed by compressed incremental reverse-diffs for older snapshots.
 */
export function encodeBackupArchive(backups: SongBackupPoint[]): StoredBackupEntry[] {
  const trimmed = (backups || []).slice(0, MAX_BACKUP_POINTS);
  if (trimmed.length === 0) return [];

  const entries: StoredBackupEntry[] = [];
  let prevSongs: Song[] = [];
  let prevSerializedMap = new Map<string, string>();

  for (let i = 0; i < trimmed.length; i++) {
    const bp = trimmed[i];
    const songs = parseSongsFromBackup(bp);
    const compactFull = JSON.stringify(songs);
    const compressedFull = compressUtf8String(compactFull);

    const currentSerializedMap = new Map<string, string>();
    for (const s of songs) {
      currentSerializedMap.set(s.id, JSON.stringify(s));
    }

    if (i === 0) {
      entries.push({
        id: bp.id,
        timestamp: bp.timestamp,
        name: bp.name,
        reason: bp.reason,
        songCount: bp.songCount,
        songsSummary: bp.songsSummary,
        mode: 'full',
        payload: compressedFull
      });
    } else {
      const changedSongs: Song[] = [];
      for (const s of songs) {
        const curJson = currentSerializedMap.get(s.id);
        const prevJson = prevSerializedMap.get(s.id);
        if (curJson !== prevJson) {
          changedSongs.push(s);
        }
      }

      const currentIds = new Set(songs.map(s => s.id));
      const removedIds: string[] = [];
      for (const prev of prevSongs) {
        if (!currentIds.has(prev.id)) {
          removedIds.push(prev.id);
        }
      }

      const diffObj: BackupDiffPayload = {
        order: songs.map(s => s.id),
        changedSongs,
        removedIds
      };
      const compressedDiff = compressUtf8String(JSON.stringify(diffObj));

      if (compressedDiff.length < compressedFull.length) {
        entries.push({
          id: bp.id,
          timestamp: bp.timestamp,
          name: bp.name,
          reason: bp.reason,
          songCount: bp.songCount,
          songsSummary: bp.songsSummary,
          mode: 'diff',
          payload: compressedDiff
        });
      } else {
        entries.push({
          id: bp.id,
          timestamp: bp.timestamp,
          name: bp.name,
          reason: bp.reason,
          songCount: bp.songCount,
          songsSummary: bp.songsSummary,
          mode: 'full',
          payload: compressedFull
        });
      }
    }

    prevSongs = songs;
    prevSerializedMap = currentSerializedMap;
  }

  return entries;
}

/**
 * Decodes compressed & incremental-diff StoredBackupEntry[] back into SongBackupPoint[].
 * Also supports legacy uncompressed SongBackupPoint[] transparently.
 */
export function decodeBackupArchive(entries: Array<StoredBackupEntry | SongBackupPoint>): SongBackupPoint[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const result: SongBackupPoint[] = [];
  let prevMap = new Map<string, Song>();

  for (const raw of entries.slice(0, MAX_BACKUP_POINTS)) {
    // Legacy uncompressed format support
    if ('songsJson' in raw && typeof raw.songsJson === 'string' && !('mode' in raw)) {
      const parsed = parseSongsFromBackup(raw);
      prevMap = new Map(parsed.map(s => [s.id, s]));
      result.push(raw);
      continue;
    }

    const entry = raw as StoredBackupEntry;
    try {
      const jsonStr = decompressUtf8String(entry.payload);
      let songs: Song[];

      if (entry.mode === 'diff') {
        const diff = JSON.parse(jsonStr) as BackupDiffPayload;
        const workingMap = new Map(prevMap);
        for (const removedId of diff.removedIds || []) {
          workingMap.delete(removedId);
        }
        for (const changed of diff.changedSongs || []) {
          workingMap.set(changed.id, changed);
        }
        songs = (diff.order || [])
          .map(id => workingMap.get(id))
          .filter((s): s is Song => Boolean(s));
      } else {
        const parsed = JSON.parse(jsonStr);
        songs = Array.isArray(parsed) ? parsed : [];
      }

      prevMap = new Map(songs.map(s => [s.id, s]));
      result.push({
        id: entry.id,
        timestamp: entry.timestamp,
        name: entry.name,
        reason: entry.reason,
        songCount: entry.songCount ?? songs.length,
        songsJson: JSON.stringify(songs),
        songsSummary: entry.songsSummary || songs.map(s => ({
          id: s.id,
          title: s.title,
          key: s.key,
          status: s.status
        }))
      });
    } catch (err) {
      console.warn(`Failed to decode backup entry "${entry.id}":`, err);
    }
  }

  return result;
}
