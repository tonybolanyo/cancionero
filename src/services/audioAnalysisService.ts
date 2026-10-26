import { AudioAnalysisResult, analyzeAudioWithWebAudio } from '../utils/webAudioAnalyzer';

export interface AnalysisProgressCallback {
  (stage: 'reading' | 'ai_analysis' | 'dsp_analysis' | 'complete', message: string): void;
}

/**
 * Converts a browser File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export class AudioAnalysisService {
  /**
   * Analyzes an uploaded audio file (.mp3, .wav)
   * Prioritizes 100% local client-side processing in the browser via Web Audio API + web-audio-beat-detector,
   * fully adhering to privacy, offline and GitHub Pages requirements (0 API credits required).
   * Server AI is only attempted if explicitly requested via options.useServerAi.
   */
  static async analyzeAudio(
    file: File,
    onProgress?: AnalysisProgressCallback,
    options?: { useServerAi?: boolean }
  ): Promise<AudioAnalysisResult> {
    const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav'];
    const isMp3OrWav =
      validTypes.includes(file.type.toLowerCase()) ||
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.wav');

    if (!isMp3OrWav) {
      throw new Error('Formato no soportado. Por favor sube un archivo de audio en formato .mp3 o .wav');
    }

    onProgress?.('reading', 'Leyendo archivo de audio...');

    // 1. Optional Server-Side AI (only if explicitly enabled)
    if (options?.useServerAi) {
      try {
        onProgress?.('ai_analysis', 'Consultando modelo de Inteligencia Artificial (tempo, escala, acordes)...');

        const base64Data = await fileToBase64(file);
        const cleanBase64 = base64Data.split(',')[1] || base64Data;

        const response = await fetch('/api/analyze-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audioBase64: cleanBase64,
            mimeType: file.type || (file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mp3'),
            filename: file.name
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.analysis) {
            const a = data.analysis;
            onProgress?.('complete', 'Análisis completado con éxito mediante IA.');

            return {
              tempo: Number(a.tempo) || 96,
              key: a.key || 'Am',
              scale: a.scale || 'Menor',
              timeSignature: a.timeSignature || '4/4',
              tuning: a.tuning || 'Estándar (EADGBE)',
              durationSeconds: Math.round(file.size / 16000),
              chordProgression: a.chordProgression || 'Am - F - C - G',
              chords: Array.isArray(a.chords)
                ? a.chords.map((c: any) => ({
                    timestamp: c.timestamp || '0:00',
                    chord: c.chord || 'Am',
                    section: c.section
                  }))
                : [],
              musicalNotes: a.musicalNotes || 'Análisis armónico generado por IA.',
              suggestedLyricsChords: a.suggestedLyricsChords,
              source: 'gemini_ai'
            };
          } else if (data.creditsDepleted) {
            console.info('Créditos de prepago agotados en AI Studio. Usando motor local de DSP.');
          }
        }
      } catch (err) {
        console.warn('Server-side AI analysis not available or depleted, using client Web Audio DSP:', err);
      }
    }

    // 2. Default & reliable path: Local Client-Side Web Audio API + web-audio-beat-detector
    onProgress?.('dsp_analysis', 'Procesando señal con motor local Web Audio DSP...');
    const dspResult = await analyzeAudioWithWebAudio(file);
    onProgress?.('complete', 'Análisis local completado exitosamente.');
    return dspResult;
  }
}
