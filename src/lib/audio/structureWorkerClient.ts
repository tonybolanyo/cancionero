import type {
  StructureWorkerRequest,
  StructureWorkerResponse
} from '../../workers/structureAnalysis.worker';
import { computeWindowedChromagrams, WindowedChroma } from './chroma';
import { extractMonoChannelData } from './bufferUtils';
import {
  analyzeStructureFromChroma,
  StructureAnalysisOptions,
  StructureAnalysisResult
} from './structure';

export interface AnalyzeStructureInput {
  audioBuffer?: AudioBuffer;
  windowedChroma?: WindowedChroma[];
  options?: StructureAnalysisOptions;
}

/**
 * Runs Self-Similarity Matrix musical structure detection inside a dedicated Web Worker
 * (with automatic synchronous fallback when Worker is unavailable, e.g. Node.js/SSR).
 */
export async function analyzeStructureWithWorker(
  input: AnalyzeStructureInput
): Promise<StructureAnalysisResult> {
  const { audioBuffer, windowedChroma, options } = input;

  // Fallback for non-browser / Node.js environments
  if (typeof Worker === 'undefined') {
    let windows = windowedChroma;
    if (!windows && audioBuffer) {
      const channelData = extractMonoChannelData(audioBuffer);
      windows = computeWindowedChromagrams(channelData, audioBuffer.sampleRate, {
        windowDurationSec: 2.0,
        hopDurationSec: 1.0,
        dualBand: true
      });
    }
    const duration = options?.duration ?? audioBuffer?.duration;
    return analyzeStructureFromChroma(windows || [], { ...options, duration });
  }

  const { default: StructureWorker } = await import('../../workers/structureAnalysis.worker?worker');

  return new Promise((resolve, reject) => {
    try {
      const worker = new StructureWorker();
      const requestId = `structure-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const handleMessage = (e: MessageEvent<StructureWorkerResponse>) => {
        if (e.data.id === requestId) {
          worker.removeEventListener('message', handleMessage);
          worker.terminate();
          if (e.data.success && e.data.result) {
            resolve(e.data.result);
          } else {
            reject(new Error(e.data.error || 'Error al analizar la estructura musical'));
          }
        }
      };

      const handleError = (err: ErrorEvent) => {
        worker.removeEventListener('error', handleError);
        worker.terminate();
        reject(new Error(`Fallo en el Web Worker de estructura musical: ${err.message}`));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      if (windowedChroma && windowedChroma.length > 0) {
        const request: StructureWorkerRequest = {
          id: requestId,
          windowedChroma,
          options: {
            ...options,
            duration: options?.duration ?? audioBuffer?.duration
          }
        };
        worker.postMessage(request);
      } else if (audioBuffer) {
        const channelData = extractMonoChannelData(audioBuffer);
        const request: StructureWorkerRequest = {
          id: requestId,
          channelData,
          sampleRate: audioBuffer.sampleRate,
          options: {
            ...options,
            duration: options?.duration ?? audioBuffer.duration
          }
        };
        worker.postMessage(request, [channelData.buffer]);
      } else {
        worker.terminate();
        reject(new Error('Se requiere audioBuffer o windowedChroma para analizar la estructura musical.'));
      }
    } catch (err) {
      reject(err);
    }
  });
}
