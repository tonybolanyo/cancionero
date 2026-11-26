import { AudioAnalysisResult, analyzeAudioWithWebAudio } from '../utils/webAudioAnalyzer';
import { requestServerAudioAnalysis } from '../lib/audio/serverAudioClient';
import { getStoredAuthorToken, isRuntimeAuthorVerified, isServerCookieAuthActive } from '../utils/authConfig';

export interface AnalysisProgressCallback {
  (stage: 'reading' | 'ai_analysis' | 'dsp_analysis' | 'complete', message: string): void;
}

export class AudioAnalysisService {
  /**
   * Analyzes an uploaded audio file (.mp3, .wav)
   * Prioritizes 100% local client-side processing in the browser via Web Audio API + web-audio-beat-detector,
   * fully adhering to privacy, offline and GitHub Pages requirements (0 API credits required).
   * Server AI is only attempted if explicitly requested via options.useServerAi and user is authorized author.
   */
  static async analyzeAudio(
    file: File,
    onProgress?: AnalysisProgressCallback,
    options?: { useServerAi?: boolean; authToken?: string }
  ): Promise<AudioAnalysisResult> {
    const validTypes = [
      'audio/mp3',
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
      'audio/webm'
    ];
    const lowerName = file.name.toLowerCase();
    const validExts = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm'];
    const isSupportedAudio =
      validTypes.includes(file.type.toLowerCase()) ||
      file.type.toLowerCase().startsWith('audio/') ||
      validExts.some(ext => lowerName.endsWith(ext));

    if (!isSupportedAudio) {
      throw new Error('Formato no soportado. Por favor sube un archivo de audio (.mp3, .wav, .m4a, .aac, .ogg o .flac)');
    }

    const resolveMimeType = () => {
      if (file.type) return file.type;
      if (lowerName.endsWith('.wav')) return 'audio/wav';
      if (lowerName.endsWith('.m4a')) return 'audio/mp4';
      if (lowerName.endsWith('.aac')) return 'audio/aac';
      if (lowerName.endsWith('.ogg')) return 'audio/ogg';
      if (lowerName.endsWith('.flac')) return 'audio/flac';
      if (lowerName.endsWith('.webm')) return 'audio/webm';
      return 'audio/mp3';
    };

    onProgress?.('reading', 'Leyendo archivo de audio...');

    // 1. Optional Server-Side AI (only if explicitly enabled with author credentials or HttpOnly server cookie)
    if (options?.useServerAi) {
      const token = options?.authToken || getStoredAuthorToken();
      const canUseServerCookie = isRuntimeAuthorVerified() && isServerCookieAuthActive();
      if (!token && !canUseServerCookie) {
        console.info('Audio analysis: no author session available for server AI, using client Web Audio DSP.');
      } else {
        try {
          onProgress?.('ai_analysis', 'Consultando modelo de Inteligencia Artificial (tempo, escala, acordes)...');

          const mimeType = resolveMimeType();
          const { ok, data, durationSeconds } = await requestServerAudioAnalysis(
            file,
            mimeType,
            token || undefined
          );

          if (ok && data) {
            if (data.success && data.analysis) {
              const a = data.analysis;
              onProgress?.('complete', 'Análisis completado con éxito mediante IA.');

              return {
                tempo: Number(a.tempo) || 96,
                key: a.key || 'Am',
                scale: a.scale || 'Menor',
                timeSignature: a.timeSignature || '4/4',
                tuning: a.tuning || 'Estándar (EADGBE)',
                durationSeconds: durationSeconds > 0 ? durationSeconds : (Number(a.durationSeconds) || 0),
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
    }

  // 2. Default & reliable path: Local Client-Side Web Audio API + web-audio-beat-detector
    onProgress?.('dsp_analysis', 'Procesando señal con motor local Web Audio DSP...');
    const dspResult = await analyzeAudioWithWebAudio(file);
    onProgress?.('complete', 'Análisis local completado exitosamente.');
    return dspResult;
  }
}
