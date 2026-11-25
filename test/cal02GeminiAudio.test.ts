import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_GEMINI_AUDIO_MODEL,
  normalizeAudioMimeType,
  prepareGeminiAudioPart,
  resolveGeminiAudioModel,
  resolveGeminiTranscribeModel,
  type GeminiFilesClientLike
} from '../src/lib/server/geminiAudio';
import { getAudioDurationSeconds } from '../src/lib/audio/duration';
import {
  requestServerAudioAnalysis,
  requestServerLyricsTranscription
} from '../src/lib/audio/serverAudioClient';

const originalFetch = global.fetch;
const originalDocument = (globalThis as any).document;
const originalWindow = (globalThis as any).window;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  global.fetch = originalFetch;
  (globalThis as any).document = originalDocument;
  (globalThis as any).window = originalWindow;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe('CAL-02: Gemini audio model resolution and MIME normalization', () => {
  it('defaults to gemini-4-hydrogen and honors GEMINI_AUDIO_MODEL overrides', () => {
    assert.equal(resolveGeminiAudioModel({} as NodeJS.ProcessEnv), DEFAULT_GEMINI_AUDIO_MODEL);
    assert.equal(
      resolveGeminiAudioModel({ GEMINI_AUDIO_MODEL: '  gemini-4-neon  ' } as unknown as NodeJS.ProcessEnv),
      'gemini-4-neon'
    );
    assert.equal(
      resolveGeminiTranscribeModel({ GEMINI_AUDIO_MODEL: 'gemini-4-hydrogen' } as unknown as NodeJS.ProcessEnv),
      'gemini-4-hydrogen'
    );
    assert.equal(
      resolveGeminiTranscribeModel({
        GEMINI_AUDIO_MODEL: 'gemini-4-hydrogen',
        GEMINI_TRANSCRIBE_MODEL: 'gemini-3.5-transcribe'
      } as unknown as NodeJS.ProcessEnv),
      'gemini-3.5-transcribe'
    );
  });

  it('normalizes common audio MIME types and extensions cleanly', () => {
    assert.equal(normalizeAudioMimeType('audio/mp3', 'demo.mp3'), 'audio/mpeg');
    assert.equal(normalizeAudioMimeType('audio/x-wav; charset=binary', 'demo.wav'), 'audio/wav');
    assert.equal(normalizeAudioMimeType('audio/x-m4a', 'demo.m4a'), 'audio/mp4');
    assert.equal(normalizeAudioMimeType('', 'demo.flac'), 'audio/flac');
  });
});

describe('CAL-02: prepareGeminiAudioPart inline vs Files API routing', () => {
  it('uses inlineData when audio size is within the inline threshold', async () => {
    let uploadCalled = false;
    const mockAi: GeminiFilesClientLike = {
      files: {
        upload: async () => {
          uploadCalled = true;
          return {};
        },
        get: async () => ({}),
        delete: async () => ({})
      }
    };

    const buffer = Buffer.from('small-audio-bytes');
    const prepared = await prepareGeminiAudioPart(
      mockAi,
      {
        buffer,
        sizeBytes: buffer.length,
        mimeType: 'audio/mpeg',
        filename: 'demo.mp3'
      },
      { inlineLimitBytes: 1024 }
    );

    assert.equal(uploadCalled, false);
    assert.equal(prepared.transport, 'inline');
    assert.deepEqual(prepared.part, {
      inlineData: {
        mimeType: 'audio/mpeg',
        data: buffer.toString('base64')
      }
    });
    await prepared.cleanup();
  });

  it('uploads via Files API, polls PROCESSING -> ACTIVE, creates fileData part, and deletes on cleanup', async () => {
    const tmpFile = path.join(os.tmpdir(), `cal02-test-${Date.now()}.wav`);
    await fs.promises.writeFile(tmpFile, Buffer.alloc(2048, 1));

    try {
      let uploadedParams: any = null;
      let getCalls = 0;
      let deletedName: string | null = null;

      const mockAi: GeminiFilesClientLike = {
        files: {
          upload: async (params) => {
            uploadedParams = params;
            return {
              name: 'files/abc123',
              uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
              mimeType: 'audio/wav',
              state: 'PROCESSING'
            };
          },
          get: async ({ name }) => {
            getCalls += 1;
            return {
              name,
              uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
              mimeType: 'audio/wav',
              state: 'ACTIVE'
            };
          },
          delete: async ({ name }) => {
            deletedName = name;
            return {};
          }
        }
      };

      const prepared = await prepareGeminiAudioPart(
        mockAi,
        {
          filePath: tmpFile,
          sizeBytes: 2048,
          mimeType: 'audio/wav',
          filename: 'ensayo.wav'
        },
        { inlineLimitBytes: 1024, pollIntervalMs: 1, maxPollAttempts: 3 }
      );

      assert.equal(prepared.transport, 'files_api');
      assert.equal(uploadedParams.file, tmpFile);
      assert.equal(uploadedParams.config.mimeType, 'audio/wav');
      assert.equal(getCalls, 1);
      assert.deepEqual(prepared.part, {
        fileData: {
          fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
          mimeType: 'audio/wav'
        }
      });

      await prepared.cleanup();
      assert.equal(deletedName, 'files/abc123');
    } finally {
      await fs.promises.unlink(tmpFile).catch(() => {});
    }
  });

  it('cleans up remote file if Gemini Files API reports FAILED state', async () => {
    let deletedName: string | null = null;
    const mockAi: GeminiFilesClientLike = {
      files: {
        upload: async () => ({
          name: 'files/failed123',
          uri: 'https://generativelanguage.googleapis.com/v1beta/files/failed123',
          mimeType: 'audio/wav',
          state: 'FAILED'
        }),
        get: async () => ({}),
        delete: async ({ name }) => {
          deletedName = name;
          return {};
        }
      }
    };

    const bigBuffer = Buffer.alloc(2048, 2);
    await assert.rejects(
      () =>
        prepareGeminiAudioPart(
          mockAi,
          {
            buffer: bigBuffer,
            sizeBytes: bigBuffer.length,
            mimeType: 'audio/wav',
            filename: 'bad.wav'
          },
          { inlineLimitBytes: 1024 }
        ),
      /no pudo procesar/i
    );
    assert.equal(deletedName, 'files/failed123');
  });
});

describe('CAL-02: Real audio duration & multipart FormData uploads', () => {
  it('reads real audio duration from HTML <audio> metadata when available', async () => {
    let revoked = false;
    URL.createObjectURL = () => 'blob:mock-audio';
    URL.revokeObjectURL = () => {
      revoked = true;
    };

    (globalThis as any).document = {
      createElement: () => {
        const listeners: Record<string, Array<() => void>> = {};
        const el: any = {
          preload: '',
          duration: 214.6,
          addEventListener: (evt: string, cb: () => void) => {
            listeners[evt] = listeners[evt] || [];
            listeners[evt].push(cb);
          },
          removeEventListener: () => {},
          removeAttribute: () => {},
          load: () => {}
        };
        Object.defineProperty(el, 'src', {
          set() {
            queueMicrotask(() => {
              for (const cb of listeners.loadedmetadata || []) cb();
            });
          }
        });
        return el;
      }
    };

    const tinyBlob = new Blob([new Uint8Array(128)], { type: 'audio/mpeg' });
    const duration = await getAudioDurationSeconds(tinyBlob);
    assert.equal(duration, 215);
    assert.equal(revoked, true);
  });

  it('falls back to AudioContext.decodeAudioData when HTML <audio> metadata is unavailable', async () => {
    (globalThis as any).document = undefined;
    let closed = false;
    (globalThis as any).window = {
      AudioContext: class {
        state = 'running';
        async decodeAudioData() {
          return { duration: 183.4 } as AudioBuffer;
        }
        async close() {
          closed = true;
          this.state = 'closed';
        }
      }
    };

    const blob = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
    const duration = await getAudioDurationSeconds(blob);
    assert.equal(duration, 183);
    assert.equal(closed, true);
  });

  it('AudioAnalysisService.analyzeAudio sends FormData (multipart) and uses real duration instead of file.size / 16000', async () => {
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    URL.createObjectURL = () => 'blob:mock-audio';
    URL.revokeObjectURL = () => {};
    (globalThis as any).document = {
      createElement: () => {
        const listeners: Record<string, Array<() => void>> = {};
        const el: any = {
          preload: '',
          duration: 197.2,
          addEventListener: (evt: string, cb: () => void) => {
            listeners[evt] = listeners[evt] || [];
            listeners[evt].push(cb);
          },
          removeEventListener: () => {},
          removeAttribute: () => {},
          load: () => {}
        };
        Object.defineProperty(el, 'src', {
          set() {
            queueMicrotask(() => {
              for (const cb of listeners.loadedmetadata || []) cb();
            });
          }
        });
        return el;
      }
    };

    global.fetch = (async (_url: any, init: any) => {
      capturedBody = init?.body;
      capturedHeaders = init?.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          source: 'gemini_ai',
          analysis: {
            tempo: 108,
            key: 'Dm',
            scale: 'Menor natural',
            timeSignature: '4/4',
            tuning: 'Estándar (EADGBE)',
            chordProgression: 'Dm - Bb - F - C',
            chords: [{ timestamp: '0:00', chord: 'Dm', section: 'Intro' }],
            musicalNotes: 'Guitarra acústica'
          }
        })
      } as Response;
    }) as typeof fetch;

    const fakeFile = new File([new Uint8Array(320)], 'maqueta-real.mp3', { type: 'audio/mpeg' });
    const result = await requestServerAudioAnalysis(fakeFile, 'audio/mpeg', 'test-token');

    assert.ok(capturedBody instanceof FormData);
    assert.equal(capturedHeaders?.['Content-Type'], undefined);
    assert.equal(capturedHeaders?.Authorization, 'Bearer test-token');
    assert.equal(capturedBody.get('filename'), 'maqueta-real.mp3');
    assert.equal(result.durationSeconds, 197);
    assert.equal(result.data?.source, 'gemini_ai');
  });

  it('requestServerLyricsTranscription sends FormData (multipart)', async () => {
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    global.fetch = (async (_url: any, init: any) => {
      capturedBody = init?.body;
      capturedHeaders = init?.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          transcription: {
            text: 'Verso de prueba',
            segments: [{ start: 0.5, end: 2.5, text: 'Verso de prueba' }]
          }
        })
      } as Response;
    }) as typeof fetch;

    const fakeFile = new File([new Uint8Array(256)], 'voz.mp3', { type: 'audio/mpeg' });
    const result = await requestServerLyricsTranscription(fakeFile, 'audio/mpeg', 'test-token');

    assert.ok(capturedBody instanceof FormData);
    assert.equal(capturedHeaders?.['Content-Type'], undefined);
    assert.equal(capturedHeaders?.Authorization, 'Bearer test-token');
    assert.equal(capturedBody.get('filename'), 'voz.mp3');
    assert.equal(result.data?.transcription?.text, 'Verso de prueba');
  });
});
