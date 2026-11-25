import fs from 'fs';
import { GoogleGenAI, FileState, createPartFromUri, type Part } from '@google/genai';

export const DEFAULT_GEMINI_AUDIO_MODEL = 'gemini-4-hydrogen';
export const DEFAULT_INLINE_AUDIO_LIMIT_BYTES = 12 * 1024 * 1024; // 12 MB (~16 MB after base64, safely under 20 MB inline limit)
export const MAX_AUDIO_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB server upload limit

export const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/webm',
  'audio/x-m4a'
]);

export const ALLOWED_AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.m4a',
  '.mp4',
  '.aac',
  '.webm'
]);

export function resolveGeminiAudioModel(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.GEMINI_AUDIO_MODEL || '').trim();
  return configured || DEFAULT_GEMINI_AUDIO_MODEL;
}

export function resolveGeminiTranscribeModel(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.GEMINI_TRANSCRIBE_MODEL || env.GEMINI_AUDIO_MODEL || '').trim();
  return configured || DEFAULT_GEMINI_AUDIO_MODEL;
}

export function resolveInlineAudioLimitBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.GEMINI_INLINE_AUDIO_LIMIT_BYTES);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_INLINE_AUDIO_LIMIT_BYTES;
}

export function normalizeAudioMimeType(
  requestedMime: unknown,
  filename?: string,
  fallbackMime: string = 'audio/mpeg'
): string {
  const rawMime = typeof requestedMime === 'string' ? requestedMime.split(';')[0].toLowerCase().trim() : '';
  const lowerName = (filename || '').toLowerCase();

  if (rawMime.includes('wav') || lowerName.endsWith('.wav')) return 'audio/wav';
  if (rawMime === 'audio/mp3') return 'audio/mpeg';
  if (rawMime === 'audio/x-m4a' || rawMime === 'audio/m4a' || lowerName.endsWith('.m4a')) return 'audio/mp4';
  if (rawMime === 'audio/x-flac' || lowerName.endsWith('.flac')) return 'audio/flac';
  if (rawMime && ALLOWED_AUDIO_MIMES.has(rawMime)) return rawMime;

  if (lowerName.endsWith('.ogg')) return 'audio/ogg';
  if (lowerName.endsWith('.aac')) return 'audio/aac';
  if (lowerName.endsWith('.webm')) return 'audio/webm';
  if (lowerName.endsWith('.mp3')) return 'audio/mpeg';

  return fallbackMime;
}

export interface AudioPartSource {
  filePath?: string;
  buffer?: Buffer;
  sizeBytes: number;
  mimeType: string;
  filename: string;
}

export interface PreparedGeminiAudioPart {
  part: Part;
  transport: 'inline' | 'files_api';
  uploadedFileName?: string;
  cleanup: () => Promise<void>;
}

export interface GeminiFilesClientLike {
  files: {
    upload: (params: {
      file: string | Blob;
      config?: { mimeType?: string; displayName?: string };
    }) => Promise<{ name?: string; uri?: string; mimeType?: string; state?: string }>;
    get: (params: {
      name: string;
    }) => Promise<{ name?: string; uri?: string; mimeType?: string; state?: string }>;
    delete: (params: { name: string }) => Promise<unknown>;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Prepares an audio Part for Gemini generateContent:
 * - Files <= inlineLimitBytes are sent as inlineData.
 * - Larger files are uploaded via Gemini Files API (`ai.files.upload`) and deleted in cleanup().
 */
export async function prepareGeminiAudioPart(
  ai: GeminiFilesClientLike | GoogleGenAI,
  source: AudioPartSource,
  options?: {
    inlineLimitBytes?: number;
    pollIntervalMs?: number;
    maxPollAttempts?: number;
  }
): Promise<PreparedGeminiAudioPart> {
  const inlineLimitBytes = options?.inlineLimitBytes ?? resolveInlineAudioLimitBytes();
  const pollIntervalMs = options?.pollIntervalMs ?? 1000;
  const maxPollAttempts = options?.maxPollAttempts ?? 60;

  if (source.sizeBytes > inlineLimitBytes) {
    const uploadTarget: string | Blob = source.filePath
      ? source.filePath
      : new Blob([new Uint8Array(source.buffer || Buffer.alloc(0))], { type: source.mimeType });

    let uploaded = await ai.files.upload({
      file: uploadTarget,
      config: {
        mimeType: source.mimeType,
        displayName: source.filename
      }
    });

    const remoteName = uploaded.name;
    let attempts = 0;
    while (uploaded.state === FileState.PROCESSING && remoteName && attempts < maxPollAttempts) {
      attempts += 1;
      await sleep(pollIntervalMs);
      uploaded = await ai.files.get({ name: remoteName });
    }

    if (uploaded.state === FileState.FAILED) {
      if (remoteName) {
        await ai.files.delete({ name: remoteName }).catch(() => {});
      }
      throw new Error('Gemini Files API no pudo procesar el archivo de audio.');
    }

    if (uploaded.state === FileState.PROCESSING) {
      if (remoteName) {
        await ai.files.delete({ name: remoteName }).catch(() => {});
      }
      throw new Error('Tiempo de espera agotado procesando el audio en Gemini Files API.');
    }

    if (!uploaded.uri) {
      if (remoteName) {
        await ai.files.delete({ name: remoteName }).catch(() => {});
      }
      throw new Error('Gemini Files API no devolvió una URI válida para el archivo subido.');
    }

    return {
      part: createPartFromUri(uploaded.uri, uploaded.mimeType || source.mimeType),
      transport: 'files_api',
      uploadedFileName: remoteName,
      cleanup: async () => {
        if (remoteName) {
          await ai.files.delete({ name: remoteName }).catch(() => {});
        }
      }
    };
  }

  const audioBuffer = source.buffer ?? (source.filePath ? await fs.promises.readFile(source.filePath) : Buffer.alloc(0));
  if (audioBuffer.length === 0) {
    throw new Error('No se recibieron datos de audio válidos.');
  }

  return {
    part: {
      inlineData: {
        mimeType: source.mimeType,
        data: audioBuffer.toString('base64')
      }
    },
    transport: 'inline',
    cleanup: async () => {}
  };
}
