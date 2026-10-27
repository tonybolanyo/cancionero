/**
 * Web Worker for Key (Tonalidad) and Scale Estimation using Essentia.js WebAssembly.
 * Runs completely in a background thread to prevent any UI stutter or frame drops.
 */

// Worker environment shims for Emscripten's web build
const workerCtx = self as unknown as { document?: any; window?: any };
if (typeof workerCtx.document === 'undefined') {
  workerCtx.document = { currentScript: null, title: '' };
}
if (typeof workerCtx.window === 'undefined') {
  workerCtx.window = self;
}

import EssentiaWASM from 'essentia.js/dist/essentia-wasm.web.js';
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';

export interface KeyAnalysis {
  key: string;
  scale: 'major' | 'minor';
  confidence: number;
  chroma: number[];
  algorithm: string;
}

export interface KeyWorkerRequest {
  id: string;
  channelData: Float32Array;
  sampleRate: number;
}

export interface KeyWorkerResponse {
  id: string;
  success: boolean;
  result?: KeyAnalysis;
  error?: string;
}

let essentiaInstance: any = null;
let initPromise: Promise<any> | null = null;

/**
 * Downloads the Essentia WebAssembly binary using local Vite assets first,
 * falling back to CDN only if local loading fails.
 */
async function fetchWasmBinary(): Promise<ArrayBuffer> {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
    ? import.meta.env.BASE_URL
    : '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  const candidates = [
    `${cleanBase}essentia-wasm.web.wasm`,
    './essentia-wasm.web.wasm',
    '/essentia-wasm.web.wasm',
    '/cancionero/essentia-wasm.web.wasm'
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Fallback to CDN for resilient deployment
  const cdnUrl = 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.wasm';
  try {
    const cdnRes = await fetch(cdnUrl);
    if (cdnRes.ok) {
      return await cdnRes.arrayBuffer();
    }
  } catch (cdnErr) {
    throw new Error(`No se pudo cargar Essentia WASM ni localmente ni desde CDN: ${cdnErr}`);
  }

  throw new Error('No se pudo localizar el archivo essentia-wasm.web.wasm.');
}

/**
 * Initializes the Essentia singleton inside this worker thread
 */
async function getEssentia(): Promise<any> {
  if (essentiaInstance) return essentiaInstance;
  if (!initPromise) {
    initPromise = (async () => {
      const wasmBinary = await fetchWasmBinary();
      const wasmModule = await EssentiaWASM({
        wasmBinary,
        print: () => {},
        printErr: (msg: any) => console.warn('Essentia WASM:', msg)
      });
      essentiaInstance = new Essentia(wasmModule);
      return essentiaInstance;
    })();
  }
  return initPromise;
}

/**
 * Computes the 12-bin Harmonic Pitch Class Profile (HPCP / Chromagram)
 * averaged over key harmonic sections of the audio.
 */
function computeAverageHpcp(essentia: any, signal: Float32Array): number[] {
  const frameSize = 4096;
  const hopSize = 4096;
  const totalFrames = Math.floor((signal.length - frameSize) / hopSize);

  if (totalFrames <= 0) {
    return new Array(12).fill(0);
  }

  const maxFramesToAnalyze = 60;
  const step = Math.max(1, Math.floor(totalFrames / maxFramesToAnalyze));
  const avgChroma = new Float32Array(12);
  let validFrames = 0;

  for (let f = 0; f < totalFrames; f += step) {
    const start = f * hopSize;
    const slice = signal.subarray(start, start + frameSize);
    let frameVec: any = null;
    let win: any = null;
    let spec: any = null;
    let peaks: any = null;
    let hpcpRes: any = null;

    try {
      frameVec = essentia.arrayToVector(slice);
      win = essentia.Windowing(frameVec);
      spec = essentia.Spectrum(win.frame);
      peaks = essentia.SpectralPeaks(spec.spectrum);

      if (peaks.frequencies && peaks.frequencies.size() > 0) {
        hpcpRes = essentia.HPCP(peaks.frequencies, peaks.magnitudes);
        const chromaArr = essentia.vectorToArray(hpcpRes.hpcp);
        for (let i = 0; i < 12; i++) {
          avgChroma[i] += chromaArr[i] || 0;
        }
        validFrames++;
      }
    } catch {
      // Ignore individual frame errors
    } finally {
      if (frameVec?.delete) frameVec.delete();
      if (win?.frame?.delete) win.frame.delete();
      if (spec?.spectrum?.delete) spec.spectrum.delete();
      if (peaks?.frequencies?.delete) peaks.frequencies.delete();
      if (peaks?.magnitudes?.delete) peaks.magnitudes.delete();
      if (hpcpRes?.hpcp?.delete) hpcpRes.hpcp.delete();
    }
  }

  if (validFrames > 0) {
    let maxVal = 0;
    for (let i = 0; i < 12; i++) {
      avgChroma[i] /= validFrames;
      if (avgChroma[i] > maxVal) maxVal = avgChroma[i];
    }
    if (maxVal > 0) {
      for (let i = 0; i < 12; i++) {
        avgChroma[i] = Number((avgChroma[i] / maxVal).toFixed(4));
      }
    }
  }

  return Array.from(avgChroma);
}

self.onmessage = async (e: MessageEvent<KeyWorkerRequest>) => {
  const { id, channelData, sampleRate } = e.data;

  try {
    const essentia = await getEssentia();

    // To optimize performance and memory, sample representative audio (up to 45s)
    let processedSignal = channelData;
    const maxSamples = Math.floor(sampleRate * 45);

    if (channelData.length > maxSamples) {
      // Offset by 10% to skip silent intros or count-ins
      const startOffset = Math.floor(channelData.length * 0.1);
      const endOffset = Math.min(channelData.length, startOffset + maxSamples);
      processedSignal = channelData.subarray(startOffset, endOffset);
    }

    const audioVec = essentia.arrayToVector(processedSignal);
    let keyResult: any = null;

    try {
      // Run Essentia KeyExtractor (HPCP + polyphonic profile correlation)
      // Profile: 'bgate' (Bivariate Gaussian Tonality Profile) provides robust major/minor key recognition
      keyResult = essentia.KeyExtractor(
        audioVec,
        true, // averageDetuningCorrection
        4096, // frameSize
        4096, // hopSize
        12,   // hpcpSize
        3500, // maxFrequency
        60,   // maximumSpectralPeaks
        25,   // minFrequency
        0.2,  // pcpThreshold
        'bgate', // profileType
        sampleRate
      );
    } finally {
      if (audioVec?.delete) audioVec.delete();
    }

    if (!keyResult || !keyResult.key) {
      throw new Error('Essentia no pudo determinar la tonalidad del audio.');
    }

    // Compute averaged 12-bin chromagram profile
    const chroma = computeAverageHpcp(essentia, processedSignal);

    const scale: 'major' | 'minor' =
      keyResult.scale === 'minor' || keyResult.scale === 'min' ? 'minor' : 'major';

    const result: KeyAnalysis = {
      key: keyResult.key,
      scale,
      confidence: Number(Math.min(1, Math.max(0, keyResult.strength || 0.75)).toFixed(2)),
      chroma,
      algorithm: 'Essentia.js KeyExtractor (HPCP WASM)'
    };

    const response: KeyWorkerResponse = {
      id,
      success: true,
      result
    };
    self.postMessage(response);
  } catch (err: any) {
    const response: KeyWorkerResponse = {
      id,
      success: false,
      error: err?.message || 'Error en el cálculo de tonalidad con Essentia WASM'
    };
    self.postMessage(response);
  }
};
