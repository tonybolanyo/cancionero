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
import { computeWindowedChromagrams } from '../lib/audio/chroma';
import {
  KeyContext,
  RawChordFrame,
  alignChordsToBeats,
  recognizeChordsWithViterbi,
  smoothChordsWithViterbi
} from '../lib/audio/chords';

export interface ChordSegment {
  startTime: number;
  endTime: number;
  chord: string;
  confidence: number;
  strength?: number;
}

export interface KeyAnalysis {
  key: string;
  scale: 'major' | 'minor';
  confidence: number;
  chroma: number[];
  algorithm: string;
  chords?: ChordSegment[];
}

export interface KeyWorkerRequest {
  id: string;
  channelData: Float32Array;
  sampleRate: number;
  beats?: number[];
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

/**
 * Detects frame-by-frame continuous chords using Essentia's TonalExtractor
 * combined with dual-band chromagrams (40–180 Hz bass & 180–1200 Hz mid),
 * then applies Key-Weighted Viterbi smoothing and slash-chord resolution (C/G, D/F#, Am/G).
 */
function extractChordProgression(
  essentia: any,
  signal: Float32Array,
  sampleRate: number,
  beats?: number[],
  keyContext?: KeyContext
): ChordSegment[] {
  const hopSize = signal.length > sampleRate * 75 ? 4096 : 2048;
  const frameSize = 4096;
  const hopDurationSec = hopSize / sampleRate;

  // Dual-band windows: 40–180 Hz bass (slash chords) & 180–1200 Hz mid (triad disambiguation)
  const dualWindowSec = 0.8;
  const dualHopSec = 0.4;
  const dualWindows = computeWindowedChromagrams(signal, sampleRate, {
    windowDurationSec: dualWindowSec,
    hopDurationSec: dualHopSec,
    dualBand: true
  });

  const lookupDualWindow = (timeSec: number) => {
    if (dualWindows.length === 0) return undefined;
    const idx = Math.max(0, Math.min(dualWindows.length - 1, Math.round(timeSec / dualHopSec)));
    return dualWindows[idx];
  };

  let audioVec: any = null;
  let tonalRes: any = null;

  try {
    audioVec = essentia.arrayToVector(signal);
    tonalRes = essentia.TonalExtractor(audioVec, frameSize, hopSize, 440);

    const progression = tonalRes.chords_progression;
    const strengthVec = tonalRes.chords_strength;
    const numFrames = progression && progression.size ? progression.size() : 0;

    if (numFrames === 0) {
      const fallback = recognizeChordsWithViterbi(dualWindows, {
        keyContext,
        minDurationSec: 0.5,
        enableSlashChords: true
      });
      return alignChordsToBeats(fallback, beats, 0.35).map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        chord: s.chord,
        confidence: s.confidence ?? 0.75,
        strength: s.confidence ?? 0.75
      }));
    }

    const rawFrames: RawChordFrame[] = [];
    for (let i = 0; i < numFrames; i++) {
      const chord = String(progression.get(i) || 'N.C.');
      const strength = strengthVec ? Number(strengthVec.get(i)) : 0.7;
      const startTime = Number((i * hopDurationSec).toFixed(3));
      const endTime = Number(((i + 1) * hopDurationSec).toFixed(3));
      const dual = lookupDualWindow(startTime + hopDurationSec * 0.5);

      rawFrames.push({
        startTime,
        endTime,
        chord,
        confidence: Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0.7,
        bassEstimate: dual?.bassEstimate,
        midChroma: dual?.midChroma
      });
    }

    // Contextual Key-Weighted Viterbi smoothing + 40–180 Hz slash chord resolution
    const viterbiSegments = smoothChordsWithViterbi(rawFrames, {
      keyContext,
      hopDurationSec,
      minDurationSec: 0.45,
      enableSlashChords: true
    });

    const aligned = alignChordsToBeats(viterbiSegments, beats, 0.35);
    return aligned.map(seg => ({
      startTime: seg.startTime,
      endTime: seg.endTime,
      chord: seg.chord,
      confidence: seg.confidence ?? 0.75,
      strength: seg.confidence ?? 0.75
    }));
  } catch (err) {
    console.warn('Essentia continuous chord detection warning:', err);
    if (dualWindows.length > 0) {
      const fallback = recognizeChordsWithViterbi(dualWindows, {
        keyContext,
        minDurationSec: 0.5,
        enableSlashChords: true
      });
      return alignChordsToBeats(fallback, beats, 0.35).map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        chord: s.chord,
        confidence: s.confidence ?? 0.75,
        strength: s.confidence ?? 0.75
      }));
    }
    return [];
  } finally {
    if (tonalRes) {
      if (tonalRes.chords_progression?.delete) tonalRes.chords_progression.delete();
      if (tonalRes.chords_strength?.delete) tonalRes.chords_strength.delete();
      if (tonalRes.hpcp?.delete) tonalRes.hpcp.delete();
      if (tonalRes.hpcp_highres?.delete) tonalRes.hpcp_highres.delete();
      if (tonalRes.chords_histogram?.delete) tonalRes.chords_histogram.delete();
    }
    if (audioVec?.delete) audioVec.delete();
  }
}

self.onmessage = async (e: MessageEvent<KeyWorkerRequest>) => {
  const { id, channelData, sampleRate, beats } = e.data;

  try {
    const essentia = await getEssentia();

    // 1. Sample representative audio (up to 45s) and detect musical Key & Scale FIRST
    let processedSignal = channelData;
    const maxSamples = Math.floor(sampleRate * 45);

    if (channelData.length > maxSamples) {
      const startOffset = Math.floor(channelData.length * 0.1);
      const endOffset = Math.min(channelData.length, startOffset + maxSamples);
      processedSignal = channelData.subarray(startOffset, endOffset);
    }

    const audioVec = essentia.arrayToVector(processedSignal);
    let keyResult: any = null;

    try {
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

    const scale: 'major' | 'minor' =
      keyResult.scale === 'minor' || keyResult.scale === 'min' ? 'minor' : 'major';
    const keyConfidence = Number(Math.min(1, Math.max(0, keyResult.strength || 0.75)).toFixed(2));

    // 2. Continuous chord progression with Key-Weighted Viterbi & Dual-Band Slash Chords
    const keyContext: KeyContext = {
      key: keyResult.key,
      scale,
      confidence: keyConfidence
    };
    const chords = extractChordProgression(essentia, channelData, sampleRate, beats, keyContext);

    // 3. Compute averaged 12-bin chromagram profile
    const chroma = computeAverageHpcp(essentia, processedSignal);

    const result: KeyAnalysis = {
      key: keyResult.key,
      scale,
      confidence: keyConfidence,
      chroma,
      algorithm: 'Essentia.js (KeyExtractor + Viterbi + Dual-Band Slash Chords)',
      chords
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
