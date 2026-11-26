import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeAudioBufferWithWebAudio,
  detectKey,
  detectKeyFromWindowedChroma
} from '../src/utils/webAudioAnalyzer';
import { analyzeKeyFromChromagram, analyzeKeyWithEssentia } from '../src/lib/audio/keyAnalysis';
import { LyricsTranscriptionService } from '../src/services/lyricsTranscriptionService';

function synthesizePolyphonicProgressionAudioBuffer(
  segments: Array<{ freqsHz: number[]; durationSec: number }>,
  sampleRate: number = 44100
): AudioBuffer {
  const totalSamples = Math.floor(
    segments.reduce((sum, s) => sum + s.durationSec, 0) * sampleRate
  );
  const data = new Float32Array(totalSamples);

  let offset = 0;
  for (const seg of segments) {
    const count = Math.floor(seg.durationSec * sampleRate);
    for (let i = 0; i < count && offset + i < totalSamples; i++) {
      const t = i / sampleRate;
      let val = 0;
      for (const f of seg.freqsHz) {
        val += (0.25 / Math.max(1, seg.freqsHz.length)) * Math.sin(2 * Math.PI * f * t);
      }
      data[offset + i] = val;
    }
    offset += count;
  }

  return {
    numberOfChannels: 1,
    length: totalSamples,
    sampleRate,
    duration: totalSamples / sampleRate,
    getChannelData: () => data
  } as unknown as AudioBuffer;
}

class MockTranscriptionWorker {
  terminated = false;
  postedMessages: any[] = [];
  private listeners: Record<string, Array<(event: any) => void>> = {};
  onPostMessage?: (msg: any, worker: MockTranscriptionWorker) => void;

  addEventListener(type: string, cb: (event: any) => void): void {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(cb);
  }

  removeEventListener(type: string, cb: (event: any) => void): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(fn => fn !== cb);
  }

  postMessage(msg: any): void {
    this.postedMessages.push(msg);
    this.onPostMessage?.(msg, this);
  }

  emitMessage(data: any): void {
    for (const cb of this.listeners.message || []) {
      cb({ data });
    }
  }

  emitError(message: string): void {
    for (const cb of this.listeners.error || []) {
      cb({ message });
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

const originalWorker = (globalThis as any).Worker;
const originalNavigator = (globalThis as any).navigator;
const originalWebAssembly = globalThis.WebAssembly;

afterEach(() => {
  LyricsTranscriptionService.setWorkerFactoryForTesting(null);
  LyricsTranscriptionService.setIdleTimeoutMs(60_000);
  (globalThis as any).Worker = originalWorker;
  if (originalNavigator === undefined) {
    delete (globalThis as any).navigator;
  } else {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true
    });
  }
  Object.defineProperty(globalThis, 'WebAssembly', {
    value: originalWebAssembly,
    configurable: true,
    writable: true
  });
});

describe('CAL-09: Unified Audio DSP Engine (Chromagram / Essentia HPCP)', () => {
  it('detectKey detects polyphonic C Major and A Minor chord progressions without zero-crossing', () => {
    // Polyphonic triads: C (C4, E4, G4) -> F (F4, A4, C5) -> G (G4, B4, D5) -> C
    const cMajorPolyBuffer = synthesizePolyphonicProgressionAudioBuffer([
      { freqsHz: [261.63, 329.63, 392.0], durationSec: 1.5 },
      { freqsHz: [349.23, 440.0, 523.25], durationSec: 1.5 },
      { freqsHz: [392.0, 493.88, 587.33], durationSec: 1.5 },
      { freqsHz: [261.63, 329.63, 392.0], durationSec: 1.5 }
    ]);

    const cResult = detectKey(cMajorPolyBuffer);
    assert.equal(cResult.key, 'C');
    assert.equal(cResult.scale, 'Mayor');
    assert.ok(cResult.harmonicChords.includes('C'));
    assert.ok(cResult.harmonicChords.includes('G'));

    // Polyphonic A Minor progression: Am -> Dm -> Em -> Am
    const aMinorPolyBuffer = synthesizePolyphonicProgressionAudioBuffer([
      { freqsHz: [220.0, 261.63, 329.63], durationSec: 1.5 },
      { freqsHz: [293.66, 349.23, 440.0], durationSec: 1.5 },
      { freqsHz: [329.63, 392.0, 493.88], durationSec: 1.5 },
      { freqsHz: [220.0, 261.63, 329.63], durationSec: 1.5 }
    ]);

    const amResult = detectKey(aMinorPolyBuffer);
    assert.equal(amResult.key, 'Am');
    assert.equal(amResult.scale, 'Menor');
    assert.ok(amResult.harmonicChords.includes('Am'));
    assert.ok(amResult.harmonicChords.includes('Dm'));
  });

  it('analyzeAudioBufferWithWebAudio reuses unified chromagram / keyAnalysis pipeline', async () => {
    const buffer = synthesizePolyphonicProgressionAudioBuffer([
      { freqsHz: [130.81, 261.63, 329.63, 392.0], durationSec: 2.0 }, // C
      { freqsHz: [196.0, 246.94, 293.66, 392.0], durationSec: 2.0 }, // G
      { freqsHz: [110.0, 220.0, 261.63, 329.63], durationSec: 2.0 }, // Am
      { freqsHz: [174.61, 261.63, 349.23, 440.0], durationSec: 2.0 } // F
    ]);

    const analysis = await analyzeAudioBufferWithWebAudio(buffer);

    assert.equal(analysis.source, 'client_dsp');
    assert.equal(analysis.key, 'C');
    assert.equal(analysis.scale, 'Mayor');
    assert.equal(analysis.chroma?.length, 12);
    assert.ok(analysis.chords.length > 0);
    assert.ok(analysis.chordProgression.includes('C'));
    assert.equal(analysis.durationSeconds, 8);
  });

  it('analyzeKeyWithEssentia falls back cleanly when Worker is unavailable and analyzeKeyFromChromagram returns 12-bin chroma', async () => {
    (globalThis as any).Worker = undefined;

    const buffer = synthesizePolyphonicProgressionAudioBuffer([
      { freqsHz: [220.0, 261.63, 329.63], durationSec: 2.0 },
      { freqsHz: [293.66, 349.23, 440.0], durationSec: 2.0 }
    ]);

    const essentiaFallback = await analyzeKeyWithEssentia(buffer);
    assert.equal(essentiaFallback.key, 'A');
    assert.equal(essentiaFallback.scale, 'minor');
    assert.equal(essentiaFallback.chroma.length, 12);
    assert.ok(Array.isArray(essentiaFallback.chords));

    const directChroma = analyzeKeyFromChromagram(buffer);
    assert.equal(directChroma.key, 'A');
    assert.equal(directChroma.scale, 'minor');

    const fromWindows = detectKeyFromWindowedChroma([
      { chroma: [1, 0, 0.3, 0, 0.8, 0.4, 0, 0.9, 0, 0.2, 0, 0.4], rmsEnergy: 0.5 }
    ]);
    assert.equal(fromWindows.key, 'C');
    assert.equal(fromWindows.scale, 'Mayor');
  });
});

describe('CAL-09: LyricsTranscriptionService Worker lifecycle and WASM support', () => {
  it('getLocalSupport reports canRunLocal: true with WASM when WebGPU is absent', async () => {
    (globalThis as any).Worker = function DummyWorker() {};
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true
    });

    const support = await LyricsTranscriptionService.getLocalSupport();
    assert.equal(support.hasWebGpu, false);
    assert.equal(support.hasWasm, true);
    assert.equal(support.canRunLocal, true);
    assert.equal(support.recommendedDevice, 'wasm');
    assert.equal(LyricsTranscriptionService.isWorkerActive(), false);
  });

  it('getLocalSupport reports webgpu when navigator.gpu is available and false when Workers are missing', async () => {
    (globalThis as any).Worker = function DummyWorker() {};
    Object.defineProperty(globalThis, 'navigator', {
      value: { gpu: {} },
      configurable: true,
      writable: true
    });

    const gpuSupport = await LyricsTranscriptionService.getLocalSupport();
    assert.equal(gpuSupport.hasWebGpu, true);
    assert.equal(gpuSupport.canRunLocal, true);
    assert.equal(gpuSupport.recommendedDevice, 'webgpu');

    (globalThis as any).Worker = undefined;
    const noWorkerSupport = await LyricsTranscriptionService.getLocalSupport();
    assert.equal(noWorkerSupport.canRunLocal, false);
  });

  it('getLocalSupport reflects WASM capabilities returned by the transcription worker', async () => {
    const worker = new MockTranscriptionWorker();
    worker.onPostMessage = (msg, w) => {
      if (msg.type === 'capabilities') {
        queueMicrotask(() => {
          w.emitMessage({
            id: msg.id,
            success: true,
            type: 'capabilities',
            capabilities: { hasWebGpu: false, hasWasm: true }
          });
        });
      }
    };

    LyricsTranscriptionService.setWorkerFactoryForTesting(() => worker as unknown as Worker);

    const support = await LyricsTranscriptionService.getLocalSupport();
    assert.equal(support.hasWebGpu, false);
    assert.equal(support.hasWasm, true);
    assert.equal(support.canRunLocal, true);
    assert.equal(support.recommendedDevice, 'wasm');
  });

  it('dispose() terminates the active worker immediately and frees resources', async () => {
    const createdWorkers: MockTranscriptionWorker[] = [];
    LyricsTranscriptionService.setWorkerFactoryForTesting(() => {
      const w = new MockTranscriptionWorker();
      w.onPostMessage = (msg, target) => {
        if (msg.type === 'capabilities') {
          queueMicrotask(() => {
            target.emitMessage({
              id: msg.id,
              success: true,
              type: 'capabilities',
              capabilities: { hasWebGpu: false, hasWasm: true }
            });
          });
        }
      };
      createdWorkers.push(w);
      return w as unknown as Worker;
    });

    await LyricsTranscriptionService.getLocalSupport();
    assert.equal(LyricsTranscriptionService.isWorkerActive(), true);
    assert.equal(createdWorkers.length, 1);
    assert.equal(createdWorkers[0].terminated, false);

    LyricsTranscriptionService.dispose();
    assert.equal(LyricsTranscriptionService.isWorkerActive(), false);
    assert.equal(createdWorkers[0].terminated, true);
  });

  it('automatically disposes idle Whisper worker after inactivity timeout and recreates on next call', async () => {
    const createdWorkers: MockTranscriptionWorker[] = [];
    LyricsTranscriptionService.setIdleTimeoutMs(40);
    LyricsTranscriptionService.setWorkerFactoryForTesting(() => {
      const w = new MockTranscriptionWorker();
      w.onPostMessage = (msg, target) => {
        queueMicrotask(() => {
          target.emitMessage({
            id: msg.id,
            success: true,
            type: 'capabilities',
            capabilities: { hasWebGpu: false, hasWasm: true }
          });
        });
      };
      createdWorkers.push(w);
      return w as unknown as Worker;
    });

    await LyricsTranscriptionService.getLocalSupport();
    assert.equal(LyricsTranscriptionService.isWorkerActive(), true);
    assert.equal(createdWorkers[0].terminated, false);

    // Wait beyond 40ms idle timeout
    await new Promise(resolve => setTimeout(resolve, 90));

    assert.equal(LyricsTranscriptionService.isWorkerActive(), false);
    assert.equal(createdWorkers[0].terminated, true);

    // Subsequent call transparently spawns a new worker
    await LyricsTranscriptionService.getLocalSupport();
    assert.equal(createdWorkers.length, 2);
    assert.equal(LyricsTranscriptionService.isWorkerActive(), true);
    assert.equal(createdWorkers[1].terminated, false);
  });

  it('dispose() rejects any in-flight pending requests cleanly and terminates worker', async () => {
    const worker = new MockTranscriptionWorker();
    // Intentionally never responds so request stays in flight
    LyricsTranscriptionService.setWorkerFactoryForTesting(() => worker as unknown as Worker);

    const pendingPromise = LyricsTranscriptionService.getLocalSupport();
    // Allow ensureWorker microtask to attach listeners
    await new Promise(resolve => setTimeout(resolve, 5));

    assert.equal(LyricsTranscriptionService.hasPendingRequests(), true);
    LyricsTranscriptionService.dispose();

    await assert.rejects(pendingPromise, /cerrado/i);
    assert.equal(worker.terminated, true);
    assert.equal(LyricsTranscriptionService.isWorkerActive(), false);
    assert.equal(LyricsTranscriptionService.hasPendingRequests(), false);
  });
});
