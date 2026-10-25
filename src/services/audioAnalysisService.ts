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
   * 1. Attempts server-side AI analysis via Gemini 3.8 Flash (/api/analyze-audio)
   * 2. If server-side AI is unavailable, falls back gracefully to client-side Web Audio DSP
   */
  static async analyzeAudio(
    file: File,
    onProgress?: AnalysisProgressCallback
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

    // 1. Try server-side AI endpoint first
    try {
      onProgress?.('ai_analysis', 'Analizando con modelo de Inteligencia Artificial (tempo, escala, acordes)...');

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
            durationSeconds: Math.round(file.size / 16000), // estimate
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
        }
      }
    } catch (err) {
      console.warn('Server-side AI analysis not available, falling back to Web Audio DSP:', err);
    }

    // 2. Client-Side Fallback via Web Audio API
    onProgress?.('dsp_analysis', 'Procesando señal con analizador Web Audio nativo...');
    const dspResult = await analyzeAudioWithWebAudio(file);
    onProgress?.('complete', 'Análisis completado exitosamente.');
    return dspResult;
  }
}
