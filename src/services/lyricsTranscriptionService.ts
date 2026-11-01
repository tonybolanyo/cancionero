import LyricsTranscriptionWorker from '../workers/lyricsTranscription.worker?worker';
import type {
  LyricsTranscriptionWorkerRequest,
  LyricsTranscriptionWorkerResponse
} from '../workers/lyricsTranscription.worker';
import {
  LocalTranscriptionOptions,
  LocalTranscriptionSupport,
  LyricsTranscriptionResult,
  TranscriptionSegment
} from '../types/transcription';
import { decodeAudioBuffer } from '../lib/audio/tempo';
import { extractMonoChannelData } from '../lib/audio/bufferUtils';
import { segmentsToSyncedLyricLines } from '../lib/lyrics/transcription';
import { fileToBase64Payload } from '../lib/audio/fileEncoding';

const DEFAULT_LOCAL_MODEL = 'Xenova/whisper-tiny';
const TARGET_SAMPLE_RATE = 16000;

export type TranscriptionProgressCallback = (message: string, status: string) => void;

interface PendingRequest {
  resolve: (value: LyricsTranscriptionWorkerResponse) => void;
  reject: (reason: Error) => void;
  timeoutId?: NodeJS.Timeout;
  onProgress?: TranscriptionProgressCallback;
}

interface BackendTranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface BackendTranscriptionResponse {
  success: boolean;
  transcription?: {
    text?: string;
    segments?: BackendTranscriptionSegment[];
  };
  error?: string;
}

export class LyricsTranscriptionService {
  private static worker: Worker | null = null;
  private static workerListenerAttached = false;
  private static pending = new Map<string, PendingRequest>();

  private static ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new LyricsTranscriptionWorker();
      this.workerListenerAttached = false;
    }

    if (!this.workerListenerAttached) {
      this.worker.addEventListener('message', (event: MessageEvent<LyricsTranscriptionWorkerResponse>) => {
        const data = event.data;
        
        if (data.type === 'progress') {
          const pending = this.pending.get(data.id);
          if (pending?.onProgress) {
            pending.onProgress(data.message, data.status);
          }
          return;
        }
        
        const pending = this.pending.get(data.id);
        if (!pending) return;
        
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        
        this.pending.delete(data.id);
        pending.resolve(data);
      });

      this.worker.addEventListener('error', (event: ErrorEvent) => {
        const err = new Error(`Worker de transcripción falló: ${event.message}`);
        for (const pending of this.pending.values()) {
          pending.reject(err);
        }
        this.pending.clear();
      });

      this.workerListenerAttached = true;
    }

    return this.worker;
  }

  private static postWorkerRequest(request: LyricsTranscriptionWorkerRequest, onProgress?: TranscriptionProgressCallback, timeoutMs: number = 600000): Promise<LyricsTranscriptionWorkerResponse> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(request.id);
        reject(new Error('La transcripción tardó demasiado (>10 minutos). Verifica tu archivo de audio y conexión.'));
      }, timeoutMs);

      this.pending.set(request.id, { resolve, reject, timeoutId, onProgress });

      try {
        if (request.type === 'transcribe') {
          worker.postMessage(request, [request.payload.audioData.buffer]);
        } else {
          worker.postMessage(request);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        this.pending.delete(request.id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  static async getLocalSupport(): Promise<LocalTranscriptionSupport> {
    const requestId = `asr-cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const response = await this.postWorkerRequest({
      id: requestId,
      type: 'capabilities'
    });

    if (response.type !== 'capabilities') {
      return {
        hasWebGpu: false,
        canRunLocal: false,
        reason: 'No se pudo consultar capacidades locales del navegador.'
      };
    }

    if (!response.success) {
      return {
        hasWebGpu: false,
        canRunLocal: false,
        reason: 'Error al consultar capacidades.'
      };
    }

    if (response.capabilities?.hasWebGpu) {
      return { hasWebGpu: true, canRunLocal: true };
    }

    return {
      hasWebGpu: false,
      canRunLocal: false,
      reason: 'WebGPU no disponible. El modo local solo se recomienda con aceleración GPU.'
    };
  }

  static async transcribeLocalFromFile(
    file: File,
    options?: LocalTranscriptionOptions,
    onProgress?: TranscriptionProgressCallback
  ): Promise<LyricsTranscriptionResult> {
    const { audioBuffer, audioContext } = await decodeAudioBuffer(file);

    try {
      const mono = extractMonoChannelData(audioBuffer);
      const sampled = resampleMonoAudio(mono, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
      const requestId = `asr-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await this.postWorkerRequest({
        id: requestId,
        type: 'transcribe',
        payload: {
          audioData: sampled,
          sampleRate: TARGET_SAMPLE_RATE,
          model: options?.model || DEFAULT_LOCAL_MODEL,
          language: options?.language,
          chunkLengthSeconds: options?.chunkLengthSeconds ?? 28,
          strideLengthSeconds: options?.strideLengthSeconds ?? 4,
          allowWasmFallback: options?.allowWasmFallback ?? false
        }
      }, onProgress);

      if (response.type !== 'transcribe') {
        throw new Error('Respuesta inesperada del worker de transcripción.');
      }

      if (!response.success) {
        throw new Error('La transcripción local no devolvió resultado.');
      }

      if (!response.result) {
        throw new Error('La transcripción local no devolvió resultado.');
      }

      const segments = sanitizeSegments(response.result.segments);
      const text = response.result.text.trim();

      return {
        text,
        segments,
        lines: segmentsToSyncedLyricLines(segments),
        engine: 'local_whisper',
        device: response.result.device,
        model: response.result.model
      };
    } finally {
      if (audioContext.state !== 'closed') {
        try {
          await audioContext.close();
        } catch {
          // ignore close errors
        }
      }
    }
  }

  static async transcribeWithBackendFromFile(
    file: File,
    consentGranted: boolean
  ): Promise<LyricsTranscriptionResult> {
    if (!consentGranted) {
      throw new Error('Debes aceptar explícitamente el envío de audio al backend antes de transcribir.');
    }

    const base64 = await fileToBase64Payload(file);
    const mimeType =
      file.type ||
      (file.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : file.name.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/mpeg');

    const response = await fetch('/api/transcribe-lyrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioBase64: base64,
        mimeType,
        filename: file.name
      })
    });

    if (!response.ok) {
      throw new Error(`Backend de transcripción no disponible (${response.status}).`);
    }

    const data = (await response.json()) as BackendTranscriptionResponse;
    if (!data.success || !data.transcription) {
      throw new Error(data.error || 'El backend no devolvió una transcripción válida.');
    }

    const text = (data.transcription.text || '').trim();
    const segments = sanitizeSegments(data.transcription.segments || []);
    const normalizedSegments =
      segments.length > 0
        ? segments
        : text
        ? [{ start: 0, end: 0, text }]
        : [];

    return {
      text,
      segments: normalizedSegments,
      lines: segmentsToSyncedLyricLines(normalizedSegments),
      engine: 'backend'
    };
  }
}

function sanitizeSegments(segments: TranscriptionSegment[]): TranscriptionSegment[] {
  return segments
    .map((segment) => ({
      start: Number.isFinite(segment.start) ? Math.max(0, segment.start) : 0,
      end: Number.isFinite(segment.end) ? Math.max(0, segment.end) : 0,
      text: String(segment.text || '').trim()
    }))
    .filter((segment) => segment.text.length > 0);
}

function resampleMonoAudio(
  input: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) {
    throw new Error('Frecuencia de muestreo de origen inválida para transcripción.');
  }
  if (!Number.isFinite(targetRate) || targetRate <= 0) {
    throw new Error('Frecuencia de muestreo de destino inválida para transcripción.');
  }
  if (sourceRate === targetRate) {
    return input;
  }

  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const interpolation = position - left;
    output[i] = input[left] * (1 - interpolation) + input[right] * interpolation;
  }

  return output;
}
