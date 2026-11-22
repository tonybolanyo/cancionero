import React, { useState, useCallback } from 'react';
import { Music, Zap } from 'lucide-react';
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
  const { audioScaleData, isProcessing, connectAudioToScales, clearAudioScaleData } = useAudioScaleConnection();

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setAnalyzing(true);
    clearAudioScaleData();

    try {
      // Analyze audio
      const result = await AudioAnalysisService.analyzeAudio(file, (stage, message) => {
        console.log(`${stage}: ${message}`);
      });

      setAnalysisResult(result);

      // Connect audio analysis with scale suggestions
      await connectAudioToScales(result);
    } catch (error) {
      console.error('Error analyzing audio:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAnalyzing(false);
    }
  }, [connectAudioToScales, clearAudioScaleData]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Upload Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-8 border-2 border-dashed border-blue-300 dark:border-blue-700">
        <div className="text-center space-y-4">
          <Music className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto" />
          
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
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
            }`}>
              {analyzing ? '⏳ Analizando...' : '📁 Seleccionar Archivo'}
            </span>
          </label>

          <p className="text-xs text-[var(--text-muted)]">
            Formatos soportados: MP3, WAV (máx. 30MB)
          </p>
        </div>
      </div>

      {/* File Info */}
      {selectedFile && (
        <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{selectedFile.name}</p>
              <p className="text-sm text-[var(--text-muted)]">
                Tamaño: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {analyzing && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Audio Analysis Details */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              🎵 Análisis de Audio
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase">Tonalidad</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analysisResult.key}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase">Tempo</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analysisResult.tempo} BPM</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase">Duración</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analysisResult.durationSeconds}s</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase">Escala</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{analysisResult.scale}</p>
              </div>
            </div>

            {analysisResult.chords && analysisResult.chords.length > 0 && (
              <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                <p className="text-xs text-[var(--text-muted)] uppercase mb-2">Acordes Detectados</p>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.chords.map((chord: any, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-purple-200 dark:bg-purple-700/50 text-purple-900 dark:text-purple-200 rounded-full text-sm font-medium"
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
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    ✅ Nota Base Detectada
                  </h3>
                  
                  <BaseNoteSelector
                    selectedNote={audioScaleData.baseNote}
                    onNoteChange={() => {}}
                    showSharps={true}
                  />

                  <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded text-sm text-green-800 dark:text-green-200">
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-[var(--text-muted)]">Generando sugerencias de escalas...</p>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!analysisResult && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6 border border-amber-200 dark:border-amber-800">
          <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-3">💡 Cómo funciona</h4>
          <ol className="text-sm text-amber-800 dark:text-amber-300 space-y-2 list-decimal list-inside">
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
