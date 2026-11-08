export type SongStatus = 'published' | 'draft' | 'private';

export type SongViewMode = 'grid' | 'expanded' | 'compact';

export interface SavedAudioAnalysis {
  analyzedAt: string;
  source?: 'gemini_ai' | 'client_dsp' | 'essentia_wasm';
  tempo?: number;
  tempoConfidence?: number;
  tempoOffset?: number;
  rawTempo?: number;
  key?: string;
  scale?: string;
  timeSignature?: string;
  tuning?: string;
  durationSeconds?: number;
  chordProgression?: string;
  chords?: Array<{
    startTime: number;
    endTime: number;
    chord: string;
    confidence?: number;
  }>;
  musicalNotes?: string;
}

export interface Song {
  id: string; // unique slug e.g. 'noches-de-cristal'
  title: string;
  status: SongStatus;
  year: number;
  genre: string;
  key: string; // Musical key e.g. 'Am', 'G', 'D', 'C#m'
  tempo?: number; // BPM
  timeSignature?: string; // '4/4', '3/4', '6/8'
  tuning?: string; // 'Standard EADGBE', 'Drop D', 'DADGAD', etc.
  duration?: string; // '3:45'
  albumId?: string; // ID of the album e.g. 'cartas-sin-sello'
  albumTitle?: string; // Name of the album
  trackNumber?: number; // Track order in album
  spotifyUrl?: string;
  youtubeUrl?: string;
  appleMusicUrl?: string;
  soundcloudUrl?: string;
  audioUrl?: string;
  driveFileId?: string; // Google Drive file ID for private maqueta
  driveFileName?: string; // Original filename in Google Drive
  isPrivateDemo?: boolean; // True if audio is a private author demo
  coverImage?: string;
  notes?: string; // Songwriting notes, history, instrumentation
  tags?: string[]; // Thematic tags e.g. 'acústico', 'en vivo', 'colaboración', 'maqueta'
  lyrics: string; // Markdown formatted lyrics with [Chords] and section headers
  lrc?: string; // Optional synchronized lyrics in LRC format
  audioAnalysis?: SavedAudioAnalysis; // Persistent audio analysis results
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  gitHash?: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: string[];
  snapshot: Record<string, string>; // songId -> markdown content snapshot
}

export interface GitStatusSummary {
  modified: string[];
  created: string[];
  deleted: string[];
  isClean: boolean;
}
