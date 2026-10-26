import { guess, analyze } from 'web-audio-beat-detector';

export interface TempoAnalysis {
  bpm: number;
  offset: number;
  tempo: number;
}

export interface TempoOptions {
  minTempo?: number;
  maxTempo?: number;
  offset?: number;
  duration?: number;
}

const DEFAULT_MIN_TEMPO = 60;
const DEFAULT_MAX_TEMPO = 180;

/**
 * Analyzes an AudioBuffer to detect musical tempo (BPM) and first beat offset (seconds)
 * using web-audio-beat-detector.
 *
 * Runs computation asynchronously off the main thread via web-audio-beat-detector's
 * internal background web worker.
 *
 * @param audioBuffer The decoded AudioBuffer to analyze
 * @param options Configuration for tempo detection range (minTempo, maxTempo) and optional slice
 * @returns Promise<TempoAnalysis> with bpm (rounded), offset (first beat time in seconds), and raw tempo
 */
export async function analyzeTempo(
  audioBuffer: AudioBuffer,
  options?: TempoOptions
): Promise<TempoAnalysis> {
  if (!audioBuffer) {
    throw new Error('AudioBuffer inválido o no proporcionado para análisis de tempo.');
  }

  const minTempo = options?.minTempo ?? DEFAULT_MIN_TEMPO;
  const maxTempo = options?.maxTempo ?? DEFAULT_MAX_TEMPO;

  if (minTempo <= 0 || maxTempo <= 0 || minTempo >= maxTempo) {
    throw new Error(
      `Rango de tempo inválido: minTempo (${minTempo}) debe ser mayor que 0 y menor que maxTempo (${maxTempo}).`
    );
  }

  const tempoSettings = { minTempo, maxTempo };

  try {
    let result: { bpm: number; offset: number; tempo?: number };
    if (typeof options?.offset === 'number' && typeof options?.duration === 'number') {
      result = await guess(audioBuffer, options.offset, options.duration, tempoSettings);
    } else if (typeof options?.offset === 'number') {
      result = await guess(audioBuffer, options.offset, tempoSettings);
    } else {
      result = await guess(audioBuffer, tempoSettings);
    }

    const rawTempo = result.tempo ?? result.bpm;
    return {
      bpm: Math.round(result.bpm),
      offset: Number(result.offset.toFixed(4)),
      tempo: Number(rawTempo.toFixed(2))
    };
  } catch (guessErr: any) {
    // 2. Fallback: If guess() fails to lock an offset, attempt analyze() for raw BPM
    try {
      let rawBpm: number;
      if (typeof options?.offset === 'number' && typeof options?.duration === 'number') {
        rawBpm = await analyze(audioBuffer, options.offset, options.duration, tempoSettings);
      } else if (typeof options?.offset === 'number') {
        rawBpm = await analyze(audioBuffer, options.offset, tempoSettings);
      } else {
        rawBpm = await analyze(audioBuffer, tempoSettings);
      }

      return {
        bpm: Math.round(rawBpm),
        offset: 0,
        tempo: Number(rawBpm.toFixed(2))
      };
    } catch {
      // Re-throw with user-friendly Spanish message
      throw new Error(
        guessErr?.message?.includes('channelData does not contain any detectable beats')
          ? 'El audio seleccionado no contiene pulsos rítmicos suficientemente claros para calcular el tempo.'
          : (guessErr?.message || 'Error al analizar el tempo del archivo de audio.')
      );
    }
  }
}

/**
 * Decodes a File or Blob into an AudioBuffer using the browser's Web Audio API.
 * Ensures AudioContext is safely managed and cleaned up.
 */
export async function decodeAudioBuffer(file: File | Blob): Promise<{
  audioBuffer: AudioBuffer;
  audioContext: AudioContext;
}> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Tu navegador no soporta Web Audio API para decodificación de audio local.');
  }

  const audioContext = new AudioContextClass();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return { audioBuffer, audioContext };
  } catch (err: any) {
    if (audioContext.state !== 'closed') {
      try {
        await audioContext.close();
      } catch {}
    }
    const fileName = 'name' in file ? (file as File).name : 'audio';
    throw new Error(
      `Error al decodificar el archivo de audio (${fileName}): ${err.message || 'Formato corrupto o no reconocido'}`
    );
  }
}
