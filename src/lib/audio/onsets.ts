import type { BeatWorkerRequest, BeatWorkerResponse } from './beatWorker';
import { extractMonoChannelData } from './bufferUtils';

export { extractMonoChannelData };

export interface BeatAnalysis {
  onsets: number[];
  beats: number[];
  tempo: number;
}

export interface BeatAnalysisOptions {
  minBpm?: number;
  maxBpm?: number;
}

/**
 * Executes onset detection and beat tracking with @audio/beat inside a Web Worker.
 * Offloads heavy spectral flux / ODF calculations from the main thread.
 */
export async function analyzeBeatsAndOnsets(
  audioBuffer: AudioBuffer,
  options?: BeatAnalysisOptions
): Promise<BeatAnalysis> {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers no disponibles para detección de beats.');
  }

  const { default: BeatWorker } = await import('./beatWorker?worker');

  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;
    let settled = false;

    const cleanup = () => {
      if (worker) {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
        try {
          worker.terminate();
        } catch {
          // ignore
        }
        worker = null;
      }
    };

    const handleMessage = (e: MessageEvent<BeatWorkerResponse>) => {
      if (e.data.id !== requestId || settled) return;
      settled = true;
      cleanup();

      if (e.data.success && e.data.result) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error || 'Error al analizar onsets y compases de audio'));
      }
    };

    const handleError = (err: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Fallo en el Web Worker de audio: ${err.message}`));
    };

    const requestId = `beat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const channelData = extractMonoChannelData(audioBuffer);
      worker = new BeatWorker();

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      const request: BeatWorkerRequest = {
        id: requestId,
        channelData,
        sampleRate: audioBuffer.sampleRate,
        minBpm: options?.minBpm,
        maxBpm: options?.maxBpm
      };

      // Transfer buffer for zero-copy memory efficiency
      worker.postMessage(request, [channelData.buffer]);
    } catch (err: any) {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });
}
