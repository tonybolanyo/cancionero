import KeyWorker from '../../workers/keyAnalysis.worker?worker';
import type { KeyWorkerRequest, KeyWorkerResponse, KeyAnalysis, ChordSegment } from '../../workers/keyAnalysis.worker';
import { extractMonoChannelData } from './bufferUtils';

export type { KeyAnalysis, ChordSegment };

/**
 * Runs musical key, scale, and chromagram analysis using Essentia.js WASM in a Web Worker.
 * Offloads heavy signal processing, FFT, and HPCP computations from the main thread.
 *
 * @param audioBuffer The decoded AudioBuffer from the user's audio file
 * @returns Promise<KeyAnalysis> containing key, scale ('major' | 'minor'), confidence, chroma, and algorithm
 */
export function analyzeKeyWithEssentia(audioBuffer: AudioBuffer): Promise<KeyAnalysis> {
  return new Promise((resolve, reject) => {
    try {
      // Re-use the existing mono mixing utility
      const channelData = extractMonoChannelData(audioBuffer);
      const worker = new KeyWorker();
      const requestId = `key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const handleMessage = (e: MessageEvent<KeyWorkerResponse>) => {
        if (e.data.id === requestId) {
          worker.removeEventListener('message', handleMessage);
          worker.terminate();

          if (e.data.success && e.data.result) {
            resolve(e.data.result);
          } else {
            reject(new Error(e.data.error || 'Error al analizar la tonalidad con Essentia'));
          }
        }
      };

      const handleError = (err: ErrorEvent) => {
        worker.removeEventListener('error', handleError);
        worker.terminate();
        reject(new Error(`Fallo en el Web Worker de Essentia: ${err.message}`));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      const request: KeyWorkerRequest = {
        id: requestId,
        channelData,
        sampleRate: audioBuffer.sampleRate
      };

      // Transfer Float32Array buffer for zero-copy memory performance
      worker.postMessage(request, [channelData.buffer]);
    } catch (err: any) {
      reject(err);
    }
  });
}
