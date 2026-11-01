import type {
  AutomaticSpeechRecognitionOutput,
  AutomaticSpeechRecognitionPipeline
} from '@huggingface/transformers';
import type { LocalTranscriptionDevice, TranscriptionSegment } from '../types/transcription';

export interface LocalTranscriptionWorkerRequest {
  id: string;
  type: 'transcribe';
  payload: {
    audioData: Float32Array;
    sampleRate: number;
    model: string;
    language?: string;
    chunkLengthSeconds: number;
    strideLengthSeconds: number;
    allowWasmFallback: boolean;
  };
}

export interface LocalCapabilitiesWorkerRequest {
  id: string;
  type: 'capabilities';
}

export interface LocalTranscriptionProgressUpdate {
  id: string;
  type: 'progress';
  status: 'loading-model' | 'processing-audio' | 'extracting-timestamps';
  message: string;
  progress?: number;
}

export type LyricsTranscriptionWorkerRequest =
  | LocalTranscriptionWorkerRequest
  | LocalCapabilitiesWorkerRequest;

export interface LyricsTranscriptionWorkerSuccess {
  id: string;
  success: true;
  type: 'capabilities' | 'transcribe';
  capabilities?: {
    hasWebGpu: boolean;
  };
  result?: {
    text: string;
    segments: TranscriptionSegment[];
    model: string;
    device: LocalTranscriptionDevice;
  };
}

export interface LyricsTranscriptionWorkerError {
  id: string;
  success: false;
  type: 'error';
  error: string;
}

export type LyricsTranscriptionWorkerResponse =
  | LyricsTranscriptionWorkerSuccess
  | LyricsTranscriptionWorkerError
  | LocalTranscriptionProgressUpdate;

type PipelineFactory = typeof import('@huggingface/transformers').pipeline;
type PipelineEnv = typeof import('@huggingface/transformers').env;

let pipelineFactory: PipelineFactory | null = null;
let pipelineEnv: PipelineEnv | null = null;
const pipelineCache = new Map<string, AutomaticSpeechRecognitionPipeline>();

function hasWebGpuInWorker(): boolean {
  const navigatorLike = (self as unknown as { navigator?: { gpu?: unknown } }).navigator;
  return Boolean(navigatorLike?.gpu);
}

async function loadTransformersRuntime(): Promise<{
  pipeline: PipelineFactory;
  env: PipelineEnv;
}> {
  if (pipelineFactory && pipelineEnv) {
    return { pipeline: pipelineFactory, env: pipelineEnv };
  }

  const runtime = await import('@huggingface/transformers');
  pipelineFactory = runtime.pipeline;
  pipelineEnv = runtime.env;
  pipelineEnv.allowLocalModels = false;
  pipelineEnv.useBrowserCache = true;
  if (pipelineEnv.backends.onnx.wasm) {
    pipelineEnv.backends.onnx.wasm.numThreads = 1;
  }
  return { pipeline: pipelineFactory, env: pipelineEnv };
}

function normalizeAsrOutput(
  output: AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[],
  fallbackDuration: number
): { text: string; segments: TranscriptionSegment[] } {
  if (Array.isArray(output)) {
    const joinedText = output.map((item) => item.text.trim()).filter(Boolean).join(' ').trim();
    const segmentRows: TranscriptionSegment[] = [];

    for (const item of output) {
      if (!item.chunks || item.chunks.length === 0) continue;
      for (const chunk of item.chunks) {
        const [start, end] = chunk.timestamp;
        segmentRows.push({
          start: Number.isFinite(start) ? Math.max(0, start) : 0,
          end: Number.isFinite(end) ? Math.max(0, end) : 0,
          text: chunk.text.trim()
        });
      }
    }

    if (segmentRows.length > 0) {
      return { text: joinedText, segments: segmentRows };
    }

    return {
      text: joinedText,
      segments: joinedText
        ? [{ start: 0, end: fallbackDuration, text: joinedText }]
        : []
    };
  }

  if (output.chunks && output.chunks.length > 0) {
    return {
      text: output.text.trim(),
      segments: output.chunks.map((chunk) => ({
        start: Number.isFinite(chunk.timestamp[0]) ? Math.max(0, chunk.timestamp[0]) : 0,
        end: Number.isFinite(chunk.timestamp[1]) ? Math.max(0, chunk.timestamp[1]) : 0,
        text: chunk.text.trim()
      }))
    };
  }

  const plainText = output.text.trim();
  return {
    text: plainText,
    segments: plainText ? [{ start: 0, end: fallbackDuration, text: plainText }] : []
  };
}

async function getAsrPipeline(
  model: string,
  allowWasmFallback: boolean,
  onProgress?: (message: string) => void
): Promise<{ transcriber: AutomaticSpeechRecognitionPipeline; device: LocalTranscriptionDevice }> {
  const { pipeline } = await loadTransformersRuntime();
  const canUseWebGpu = hasWebGpuInWorker();
  const preferredDevice: LocalTranscriptionDevice | null = canUseWebGpu ? 'webgpu' : null;

  const attemptOrder: LocalTranscriptionDevice[] = [];
  if (preferredDevice) {
    attemptOrder.push(preferredDevice);
  }
  if (allowWasmFallback || !preferredDevice) {
    attemptOrder.push('wasm');
  }

  let lastError: Error | null = null;

  for (const device of attemptOrder) {
    const cacheKey = `${model}::${device}`;
    const cached = pipelineCache.get(cacheKey);
    if (cached) {
      onProgress?.(`Modelo Whisper cargado (${device}) desde caché.`);
      return { transcriber: cached, device };
    }

    try {
      onProgress?.(`Descargando modelo Whisper (${device})... Esta es la primera vez, puede tardar.`);
      const transcriber = await pipeline('automatic-speech-recognition', model, { device });
      pipelineCache.set(cacheKey, transcriber);
      onProgress?.(`Modelo Whisper listo (${device}).`);
      return { transcriber, device };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (!canUseWebGpu && !allowWasmFallback) {
    throw new Error(
      'Este navegador no dispone de WebGPU y el modo WASM de respaldo está deshabilitado para evitar esperas largas.'
    );
  }

  throw new Error(lastError?.message || 'No fue posible inicializar el motor local de transcripción.');
}

self.onmessage = async (event: MessageEvent<LyricsTranscriptionWorkerRequest>) => {
  const request = event.data;

  if (request.type === 'capabilities') {
    const response: LyricsTranscriptionWorkerSuccess = {
      id: request.id,
      success: true,
      type: 'capabilities',
      capabilities: {
        hasWebGpu: hasWebGpuInWorker()
      }
    };
    self.postMessage(response);
    return;
  }

  const { id, payload } = request;

  try {
    const sendProgress = (status: LocalTranscriptionProgressUpdate['status'], message: string) => {
      const progressMessage: LocalTranscriptionProgressUpdate = {
        id,
        type: 'progress',
        status,
        message
      };
      self.postMessage(progressMessage);
    };

    sendProgress('loading-model', 'Inicializando transcriptor de audio...');
    const { transcriber, device } = await getAsrPipeline(payload.model, payload.allowWasmFallback, (msg) => {
      sendProgress('loading-model', msg);
    });
    
    sendProgress('processing-audio', 'Procesando audio con modelo Whisper...');
    const asrOutput = await transcriber(payload.audioData, {
      return_timestamps: true,
      chunk_length_s: payload.chunkLengthSeconds,
      stride_length_s: payload.strideLengthSeconds,
      language: payload.language,
      task: 'transcribe'
    });

    sendProgress('extracting-timestamps', 'Extrayendo marcas de tiempo...');
    const duration = payload.audioData.length / payload.sampleRate;
    const normalized = normalizeAsrOutput(asrOutput, duration);

    const response: LyricsTranscriptionWorkerSuccess = {
      id,
      success: true,
      type: 'transcribe',
      result: {
        text: normalized.text,
        segments: normalized.segments,
        model: payload.model,
        device
      }
    };
    self.postMessage(response);
  } catch (error) {
    const response: LyricsTranscriptionWorkerError = {
      id,
      success: false,
      type: 'error',
      error: error instanceof Error ? error.message : 'Error no controlado en worker de transcripción.'
    };
    self.postMessage(response);
  }
};
