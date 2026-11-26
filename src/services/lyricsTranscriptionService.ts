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
import { requestServerLyricsTranscription } from '../lib/audio/serverAudioClient';
import { getStoredAuthorToken, isRuntimeAuthorVerified, isServerCookieAuthActive } from '../utils/authConfig';

const DEFAULT_LOCAL_MODEL = 'Xenova/whisper-tiny';
const TARGET_SAMPLE_RATE = 16000;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

export type TranscriptionProgressCallback = (message: string, status: string) => void;
export type TranscriptionWorkerFactory = () => Worker;

interface PendingRequest {
  resolve: (value: LyricsTranscriptionWorkerResponse) => void;
  reject: (reason: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
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
  private static workerCreationPromise: Promise<Worker> | null = null;
  private static workerFactory: TranscriptionWorkerFactory | null = null;
  private static workerEpoch = 0;
  private static messageListener: ((event: MessageEvent<LyricsTranscriptionWorkerResponse>) => void) | null = null;
  private static errorListener: ((event: ErrorEvent) => void) | null = null;
  private static pending = new Map<string, PendingRequest>();
  private static idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
  private static idleTimer: ReturnType<typeof setTimeout> | null = null;

  static setIdleTimeoutMs(ms: number): void {
    this.idleTimeoutMs = Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_IDLE_TIMEOUT_MS;
  }

  static getIdleTimeoutMs(): number {
    return this.idleTimeoutMs;
  }

  static setWorkerFactoryForTesting(factory: TranscriptionWorkerFactory | null): void {
    this.dispose();
    this.workerFactory = factory;
  }

  static isWorkerActive(): boolean {
    return this.worker !== null;
  }

  static hasPendingRequests(): boolean {
    return this.pending.size > 0;
  }

  private static clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private static scheduleIdleDispose(): void {
    this.clearIdleTimer();
    if (!this.worker || this.pending.size > 0 || this.idleTimeoutMs <= 0) {
      return;
    }

    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.pending.size === 0) {
        this.dispose();
      }
    }, this.idleTimeoutMs);

    if (typeof (this.idleTimer as { unref?: () => void }).unref === 'function') {
      (this.idleTimer as { unref: () => void }).unref();
    }
  }

  /**
   * Terminates the Whisper Web Worker immediately and releases WASM/WebGPU model memory.
   */
  static dispose(): void {
    this.clearIdleTimer();
    this.workerEpoch += 1;
    this.workerCreationPromise = null;

    if (this.pending.size > 0) {
      const disposeError = new Error('El worker de transcripción fue cerrado antes de finalizar.');
      for (const pending of this.pending.values()) {
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        pending.reject(disposeError);
      }
      this.pending.clear();
    }

    if (this.worker) {
      if (this.messageListener) {
        this.worker.removeEventListener('message', this.messageListener as EventListener);
        this.messageListener = null;
      }
      if (this.errorListener) {
        this.worker.removeEventListener('error', this.errorListener as EventListener);
        this.errorListener = null;
      }
      try {
        this.worker.terminate();
      } catch {
        // ignore terminate errors
      }
      this.worker = null;
    }
  }

  private static attachWorkerListeners(worker: Worker): void {
    this.messageListener = (event: MessageEvent<LyricsTranscriptionWorkerResponse>) => {
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
      if (this.pending.size === 0) {
        this.scheduleIdleDispose();
      }
      pending.resolve(data);
    };

    this.errorListener = (event: ErrorEvent) => {
      const err = new Error(`Worker de transcripción falló: ${event.message || 'error desconocido'}`);
      for (const pending of this.pending.values()) {
        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }
        pending.reject(err);
      }
      this.pending.clear();
      this.dispose();
    };

    worker.addEventListener('message', this.messageListener as EventListener);
    worker.addEventListener('error', this.errorListener as EventListener);
  }

  private static async ensureWorker(): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    if (this.workerFactory) {
      this.worker = this.workerFactory();
      this.attachWorkerListeners(this.worker);
      return this.worker;
    }

    if (typeof Worker === 'undefined') {
      throw new Error('Los Web Workers no están disponibles en este entorno.');
    }

    const epoch = this.workerEpoch;
    if (!this.workerCreationPromise) {
      this.workerCreationPromise = import('../workers/lyricsTranscription.worker?worker')
        .then(({ default: LyricsTranscriptionWorker }) => {
          if (epoch !== this.workerEpoch) {
            throw new Error('El worker de transcripción fue cancelado durante su inicialización.');
          }
          if (!this.worker) {
            this.worker = new LyricsTranscriptionWorker();
            this.attachWorkerListeners(this.worker);
          }
          return this.worker;
        })
        .finally(() => {
          this.workerCreationPromise = null;
        });
    }

    return this.workerCreationPromise;
  }

  private static async postWorkerRequest(
    request: LyricsTranscriptionWorkerRequest,
    onProgress?: TranscriptionProgressCallback,
    timeoutMs: number = 600000
  ): Promise<LyricsTranscriptionWorkerResponse> {
    this.clearIdleTimer();
    const worker = await this.ensureWorker();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(request.id);
        if (this.pending.size === 0) {
          this.scheduleIdleDispose();
        }
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
        if (this.pending.size === 0) {
          this.scheduleIdleDispose();
        }
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  static async getLocalSupport(): Promise<LocalTranscriptionSupport> {
    const hasWorkerSupport = typeof Worker !== 'undefined' || Boolean(this.workerFactory);
    const hasWasmRuntime = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';

    if (!hasWorkerSupport) {
      return {
        hasWebGpu: false,
        hasWasm: hasWasmRuntime,
        canRunLocal: false,
        reason: 'Web Workers no disponibles en este entorno.'
      };
    }

    let hasWebGpu = Boolean((globalThis.navigator as { gpu?: unknown } | undefined)?.gpu);
    let hasWasm = hasWasmRuntime;

    if (this.worker || this.workerFactory) {
      const requestId = `asr-cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const response = await this.postWorkerRequest({
        id: requestId,
        type: 'capabilities'
      });

      if (response.type !== 'capabilities' || !response.success) {
        return {
          hasWebGpu: false,
          hasWasm: false,
          canRunLocal: false,
          reason: response.type === 'error' ? response.error : 'No se pudo consultar capacidades locales del navegador.'
        };
      }

      hasWebGpu = Boolean(response.capabilities?.hasWebGpu);
      hasWasm = response.capabilities?.hasWasm ?? hasWasmRuntime;
    }

    if (hasWebGpu) {
      return {
        hasWebGpu: true,
        hasWasm,
        canRunLocal: true,
        recommendedDevice: 'webgpu'
      };
    }

    if (hasWasm) {
      return {
        hasWebGpu: false,
        hasWasm: true,
        canRunLocal: true,
        recommendedDevice: 'wasm',
        reason: 'WebGPU no disponible. Disponible mediante fallback WASM (más lento que GPU).'
      };
    }

    return {
      hasWebGpu: false,
      hasWasm: false,
      canRunLocal: false,
      reason: 'Ni WebGPU ni WebAssembly están disponibles en este navegador.'
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
          allowWasmFallback: options?.allowWasmFallback ?? true
        }
      }, onProgress);

      if (response.type === 'error') {
        throw new Error(response.error || 'Error en el worker de transcripción local.');
      }

      if (response.type !== 'transcribe') {
        throw new Error('Respuesta inesperada del worker de transcripción.');
      }

      if (!response.success || !response.result) {
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
    consentGranted: boolean,
    authToken?: string
  ): Promise<LyricsTranscriptionResult> {
    if (!consentGranted) {
      throw new Error('Debes aceptar explícitamente el envío de audio al backend antes de transcribir.');
    }

    const token = authToken || getStoredAuthorToken();
    const canUseServerCookie = isRuntimeAuthorVerified() && isServerCookieAuthActive();
    if (!token && !canUseServerCookie) {
      throw new Error('Operación no permitida: Se requiere iniciar sesión como autor para transcribir con el backend.');
    }

    const mimeType =
      file.type ||
      (file.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : file.name.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/mpeg');

    const { ok, status, data } = await requestServerLyricsTranscription(
      file,
      mimeType,
      token || undefined
    );

    if (!ok || !data) {
      throw new Error(`Backend de transcripción no disponible (${status}).`);
    }

    const typedData = data as BackendTranscriptionResponse;
    if (!typedData.success || !typedData.transcription) {
      throw new Error(typedData.error || 'El backend no devolvió una transcripción válida.');
    }

    const text = (typedData.transcription.text || '').trim();
    const segments = sanitizeSegments(typedData.transcription.segments || []);
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
