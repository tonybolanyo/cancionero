import BeatWorker from './beatWorker?worker';
import type { BeatWorkerRequest, BeatWorkerResponse } from './beatWorker';

export interface BeatAnalysis {
  onsets: number[];
  beats: number[];
  tempo: number;
}

export interface BeatAnalysisOptions {
  minBpm?: number;
  maxBpm?: number;
}

import { extractMonoChannelData } from './bufferUtils';
export { extractMonoChannelData };

/**
 * Executes onset detection and beat tracking with @audio/beat inside a Web Worker.
 * Offloads heavy spectral flux / ODF calculations from the main thread.
 */
export function analyzeBeatsAndOnsets(
  audioBuffer: AudioBuffer,
  options?: BeatAnalysisOptions
): Promise<BeatAnalysis> {
  return new Promise((resolve, reject) => {
    try {
      const channelData = extractMonoChannelData(audioBuffer);
      const worker = new BeatWorker();
      const requestId = `beat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const handleMessage = (e: MessageEvent<BeatWorkerResponse>) => {
        if (e.data.id === requestId) {
          worker.removeEventListener('message', handleMessage);
          worker.terminate();

          if (e.data.success && e.data.result) {
            resolve(e.data.result);
          } else {
            reject(new Error(e.data.error || 'Error al analizar onsets y compases de audio'));
          }
        }
      };

      const handleError = (err: ErrorEvent) => {
        worker.removeEventListener('error', handleError);
        worker.terminate();
        reject(new Error(`Fallo en el Web Worker de audio: ${err.message}`));
      };

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
      reject(err);
    }
  });
}
