import React, { useState, useCallback } from 'react';
import { AlertCircle, Music, Zap } from 'lucide-react';
import { AudioAnalysisService } from '../services/audioAnalysisService';
import { useAudioScaleConnection } from '../hooks/useAudioScaleConnection';
import { ScaleSuggestions } from './ScaleSuggestions';
import { BaseNoteSelector } from './BaseNoteSelector';

interface AudioToScaleProps {
  onScaleSelected?: (scaleId: string, baseNote: string) => void;
}

export const AudioToScale: React.FC<AudioToScaleProps> = ({ onScaleSelected }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { audioScaleData, isProcessing, connectAudioToScales, clearAudioScaleData } = useAudioScaleConnection();

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setAnalyzing(true);
    setError(null);
    clearAudioScaleData();

    try {
      // Analyze audio
      const result = await AudioAnalysisService.analyzeAudio(file, (stage, message) => {
        console.log(`${stage}: ${message}`);
      });

      setAnalysisResult(result);

      // Connect audio analysis with scale suggestions
      await connectAudioToScales(result);
    } catch (err) {
      console.error('Error analyzing audio:', err);
      setError(err instanceof Error ? err.message : 'Error al analizar el archivo de audio.');
    } finally {
      setAnalyzing(false);
    }
  }, [connectAudioToScales, clearAudioScaleData]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Upload Section */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-8 border-2 border-dashed border-[var(--border-medium)]">
        <div className="text-center space-y-4">
          <Music className="w-12 h-12 text-[var(--accent-primary)] mx-auto" />
          
          <div>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Analiza tu Música
            </h3>
            <p className="text-[var(--text-secondary)]">
              Sube un archivo de audio y obtén sugerencias de escalas automáticas
            </p>
          </div>

          <label className="cursor-pointer inline-block">
            <input
              type="file"
              accept="audio/mp3,audio/wav,audio/mpeg,audio/x-wav"
              onChange={handleFileSelect}
              disabled={analyzing}
              className="hidden"
            />
            <span className={`inline-block px-8 py-3 rounded-lg font-semibold transition-all ${
              analyzing
                ? 'bg-[var(--button-primary-disabled-bg)] text-[var(--button-primary-disabled-text)] cursor-not-allowed'
                : 'bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover-bg)] text-[var(--button-primary-text)] cursor-pointer'
            }`}>
              {analyzing ? '⏳ Analizando...' : '📁 Seleccionar Archivo'}
            </span>
          </label>

          <p className="text-xs text-[var(--text-muted)]">
            Formatos soportados: MP3, WAV (máx. 30MB)
          </p>
        </div>
      </div>

      {/* Inline Error Banner */}
      {error && (
        <div
          role="alert"
          className="bg-[var(--state-error-bg)] border border-[var(--state-error-border)] text-[var(--state-error-text)] rounded-xl p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">No se pudo analizar el audio</p>
            <p className="opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* File Info */}
      {selectedFile && (
        <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{selectedFile.name}</p>
              <p className="text-sm text-[var(--text-muted)]">
                Tamaño: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {analyzing && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-primary)]"></div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Audio Analysis Details */}
          <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-subtle)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              🎵 Análisis de Audio
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase">Tonalidad</p>
                <p className="text-2xl font-bold text-[var(--accent-primary)]">{analysisResult.key}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase">Tempo</p>
                <p className="text-2xl font-bold text-[var(--accent-primary)]">{analysisResult.tempo} BPM</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase">Duración</p>
                <p className="text-2xl font-bold text-[var(--accent-primary)]">{analysisResult.durationSeconds}s</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase">Escala</p>
                <p className="text-2xl font-bold text-[var(--accent-primary)]">{analysisResult.scale}</p>
              </div>
            </div>

            {analysisResult.chords && analysisResult.chords.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-xs text-[var(--text-muted)] uppercase mb-2">Acordes Detectados</p>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.chords.map((chord: any, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)] border border-[var(--badge-primary-border)] rounded-full text-sm font-medium"
                    >
                      {chord.chord}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Audio Scale Connection Data */}
          {audioScaleData && (
            <>
              {/* Detected Base Note */}
              {audioScaleData.baseNote && (
                <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-subtle)] space-y-4">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    ✅ Nota Base Detectada
                  </h3>
                  
                  <BaseNoteSelector
                    selectedNote={audioScaleData.baseNote}
                    onNoteChange={() => {}}
                    showSharps={true}
                  />

                  <div className="p-3 bg-[var(--state-success-bg)] border border-[var(--state-success-border)] rounded-lg text-sm text-[var(--state-success-text)]">
                    <Zap className="w-4 h-4 inline mr-2" />
                    La nota base de tu música es <span className="font-bold">{audioScaleData.baseNote}</span>
                  </div>
                </div>
              )}

              {/* Scale Suggestions */}
              {audioScaleData.suggestedScales.length > 0 && (
                <ScaleSuggestions
                  sourceType="key"
                  sourceValue={audioScaleData.baseNote || audioScaleData.key || 'C'}
                  onSelectScale={(scaleId) => {
                    onScaleSelected?.(scaleId, audioScaleData.baseNote || 'C');
                  }}
                  maxSuggestions={5}
                />
              )}
            </>
          )}

          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4"></div>
              <p className="text-[var(--text-muted)]">Generando sugerencias de escalas...</p>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!analysisResult && (
        <div className="bg-[var(--state-info-bg)] rounded-2xl p-6 border border-[var(--state-info-border)] text-[var(--state-info-text)]">
          <h4 className="font-semibold mb-3">💡 Cómo funciona</h4>
          <ol className="text-sm opacity-90 space-y-2 list-decimal list-inside">
            <li>Sube un archivo de audio (MP3 o WAV)</li>
            <li>El sistema analiza la tonalidad, tempo y acordes</li>
            <li>Obtén sugerencias de escalas automáticas</li>
            <li>Visualiza las escalas en el diapasón</li>
            <li>Practica con el quiz interactivo</li>
          </ol>
        </div>
      )}
    </div>
  );
};
