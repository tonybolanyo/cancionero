export type SongStatus = 'published' | 'draft' | 'private';

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
  spotifyUrl?: string;
  youtubeUrl?: string;
  soundcloudUrl?: string;
  audioUrl?: string;
  coverImage?: string;
  notes?: string; // Songwriting notes, history, instrumentation
  tags?: string[]; // Thematic tags e.g. 'acústico', 'en vivo', 'colaboración', 'maqueta'
  lyrics: string; // Markdown formatted lyrics with [Chords] and section headers
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
