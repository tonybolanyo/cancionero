/**
 * Web Worker for Musical Structure Detection via Self-Similarity Matrix (SSM).
 * Computes windowed chromagrams + RMS energy (or reuses precomputed WindowedChroma[])
 * and runs Foote's Checkerboard Novelty + Repetition Clustering off the main thread.
 */

import { computeWindowedChromagrams, WindowedChroma } from '../lib/audio/chroma';
import {
  analyzeStructureFromChroma,
  StructureAnalysisOptions,
  StructureAnalysisResult
} from '../lib/audio/structure';

export interface StructureWorkerRequest {
  id: string;
  channelData?: Float32Array;
  sampleRate?: number;
  windowedChroma?: WindowedChroma[];
  options?: StructureAnalysisOptions;
}

export interface StructureWorkerResponse {
  id: string;
  success: boolean;
  result?: StructureAnalysisResult;
  error?: string;
}

self.onmessage = (e: MessageEvent<StructureWorkerRequest>) => {
  const { id, channelData, sampleRate, windowedChroma, options } = e.data;

  try {
    let windows = windowedChroma;

    if (!windows || windows.length === 0) {
      if (!channelData || !sampleRate) {
        throw new Error('Se requieren ventanas de Chroma o datos de audio para detectar la estructura musical.');
      }
      windows = computeWindowedChromagrams(channelData, sampleRate, {
        windowDurationSec: 2.0,
        hopDurationSec: 1.0,
        dualBand: true
      });
    }

    const duration =
      options?.duration ??
      (channelData && sampleRate ? Number((channelData.length / sampleRate).toFixed(3)) : undefined);

    const result = analyzeStructureFromChroma(windows, {
      ...options,
      duration
    });

    const response: StructureWorkerResponse = {
      id,
      success: true,
      result
    };
    self.postMessage(response);
  } catch (err: any) {
    const response: StructureWorkerResponse = {
      id,
      success: false,
      error: err?.message || 'Error en el Worker de detección de estructura musical'
    };
    self.postMessage(response);
  }
};
