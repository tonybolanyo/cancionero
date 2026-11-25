/**
 * Reads the real duration (in rounded seconds) of an audio File/Blob.
 * Tries lightweight HTML <audio> metadata first, then falls back to AudioContext.decodeAudioData.
 */
export async function getAudioDurationSeconds(file: File | Blob): Promise<number> {
  // 1. Lightweight path: HTML <audio> metadata (avoids decoding full PCM into RAM)
  if (
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const metadataDuration = await new Promise<number | null>((resolve) => {
      let settled = false;
      const objectUrl = URL.createObjectURL(file);
      const audioEl = document.createElement('audio');
      audioEl.preload = 'metadata';

      const finish = (value: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        audioEl.removeEventListener('loadedmetadata', onLoaded);
        audioEl.removeEventListener('error', onError);
        audioEl.removeAttribute('src');
        audioEl.load();
        URL.revokeObjectURL(objectUrl);
        resolve(value);
      };

      const onLoaded = () => {
        const d = audioEl.duration;
        finish(Number.isFinite(d) && d > 0 ? Math.round(d) : null);
      };

      const onError = () => finish(null);

      const timeoutId = setTimeout(() => finish(null), 4000);
      audioEl.addEventListener('loadedmetadata', onLoaded);
      audioEl.addEventListener('error', onError);
      audioEl.src = objectUrl;
    });

    if (metadataDuration !== null && metadataDuration > 0) {
      return metadataDuration;
    }
  }

  // 2. Fallback: Decode via Web Audio API AudioContext.decodeAudioData
  const AudioContextClass =
    typeof window !== 'undefined'
      ? window.AudioContext || (window as any).webkitAudioContext
      : undefined;

  if (!AudioContextClass) {
    throw new Error('Tu navegador no soporta Web Audio API para obtener la duración del audio.');
  }

  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return Math.max(0, Math.round(audioBuffer.duration));
  } finally {
    if (audioContext.state !== 'closed') {
      try {
        await audioContext.close();
      } catch {
        // ignore close errors
      }
    }
  }
}
