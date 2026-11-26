import type { KeyWorkerRequest, KeyWorkerResponse, KeyAnalysis, ChordSegment } from '../../workers/keyAnalysis.worker';
import { extractMonoChannelData } from './bufferUtils';
import { computeWindowedChromagrams, WindowedChroma } from './chroma';
import { alignChordsToBeats, detectChordsFromChromagram, defaultChordRecognizer } from './chords';
import { averageWindowedChroma, detectKeyFromChroma } from './keyDetection';
import { estimateDetuningCents } from './tuning';

export type { KeyAnalysis, ChordSegment };

const DEFAULT_KEY_WORKER_TIMEOUT_MS = 120_000;

/**
 * Synchronous chromagram + Krumhansl-Schmuckler + Viterbi key & chord analysis fallback.
 * Reuses pre-computed windowedChroma when provided to avoid duplicate DSP work.
 */
export function analyzeKeyFromChromagram(
  audioBuffer: AudioBuffer,
  options?: {
    beats?: number[];
    windowedChroma?: WindowedChroma[];
    channelData?: Float32Array;
    detuningCents?: number;
    referenceA4Hz?: number;
    detectedTempo?: number;
  }
): KeyAnalysis {
  const channelData = options?.channelData ?? extractMonoChannelData(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;

  let detuningCents = options?.detuningCents;
  let referenceA4Hz = options?.referenceA4Hz;

  if (detuningCents === undefined || referenceA4Hz === undefined) {
    const detuning = estimateDetuningCents(channelData, sampleRate);
    detuningCents = detuning.cents;
    referenceA4Hz = detuning.confidence >= 0.35 ? detuning.referenceA4Hz : 440;
  }

  const windows =
    options?.windowedChroma ??
    computeWindowedChromagrams(channelData, sampleRate, {
      windowDurationSec: 1.5,
      hopDurationSec: 0.75,
      dualBand: true,
      tripleBand: true,
      referenceA4Hz,
      suppressOnsets: true,
      onsetSilenceWindowMs: 80
    });

  const avgChroma = averageWindowedChroma(windows);
  const detected = detectKeyFromChroma(avgChroma);
  const scale: 'major' | 'minor' = detected.scale === 'Menor' ? 'minor' : 'major';
  const rootKey = detected.key.replace(/m$/, '');

  const rawChords = detectChordsFromChromagram(windows, defaultChordRecognizer, undefined, {
    keyContext: {
      key: rootKey,
      scale,
      confidence: 0.75
    },
    detectedTempo: options?.detectedTempo
  });

  const alignedChords = options?.beats && options.beats.length > 0
    ? alignChordsToBeats(rawChords, options.beats, 0.35)
    : rawChords;

  const chords: ChordSegment[] = alignedChords.map(seg => ({
    startTime: seg.startTime,
    endTime: seg.endTime,
    chord: seg.chord,
    confidence: seg.confidence ?? 0.75,
    strength: seg.confidence ?? 0.75
  }));

  return {
    key: rootKey,
    scale,
    confidence: 0.75,
    chroma: avgChroma,
    algorithm: 'Goertzel Chromagram + Krumhansl-Schmuckler + Viterbi',
    chords,
    detuningCents,
    referenceA4Hz
  };
}

/**
 * Runs musical key, scale, and chromagram analysis using Essentia.js WASM in a Web Worker.
 * Offloads heavy signal processing, FFT, and HPCP computations from the main thread
 * and terminates the Worker immediately upon completion or failure to free WASM memory.
 *
 * @param audioBuffer The decoded AudioBuffer from the user's audio file
 * @returns Promise<KeyAnalysis> containing key, scale ('major' | 'minor'), confidence, chroma, and algorithm
 */
export async function analyzeKeyWithEssentia(audioBuffer: AudioBuffer, beats?: number[]): Promise<KeyAnalysis> {
  if (typeof Worker === 'undefined') {
    return analyzeKeyFromChromagram(audioBuffer, { beats });
  }

  const { default: KeyWorker } = await import('../../workers/keyAnalysis.worker?worker');

  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (worker) {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
        try {
          worker.terminate();
        } catch {
          // ignore worker termination errors
        }
        worker = null;
      }
    };

    const handleMessage = (e: MessageEvent<KeyWorkerResponse>) => {
      if (e.data.id !== requestId || settled) return;
      settled = true;
      cleanup();

      if (e.data.success && e.data.result) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error || 'Error al analizar la tonalidad con Essentia'));
      }
    };

    const handleError = (err: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Fallo en el Web Worker de Essentia: ${err.message}`));
    };

    const requestId = `key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const channelData = extractMonoChannelData(audioBuffer);
      worker = new KeyWorker();

      timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('El análisis de tonalidad con Essentia excedió el tiempo límite.'));
      }, DEFAULT_KEY_WORKER_TIMEOUT_MS);

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      const request: KeyWorkerRequest = {
        id: requestId,
        channelData,
        sampleRate: audioBuffer.sampleRate,
        beats
      };

      // Transfer Float32Array buffer for zero-copy memory performance
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
