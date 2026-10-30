import { SyncedLyricLine } from './lyrics';

export type LocalTranscriptionDevice = 'webgpu' | 'wasm';

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface LyricsTranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  lines: SyncedLyricLine[];
  engine: 'local_whisper' | 'backend';
  device?: LocalTranscriptionDevice;
  model?: string;
}

export interface LocalTranscriptionSupport {
  hasWebGpu: boolean;
  canRunLocal: boolean;
  reason?: string;
}

export interface LocalTranscriptionOptions {
  model?: string;
  language?: string;
  chunkLengthSeconds?: number;
  strideLengthSeconds?: number;
  allowWasmFallback?: boolean;
}
