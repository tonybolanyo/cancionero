import React from 'react';
import { Cpu, Info, RotateCcw, ShieldCheck } from 'lucide-react';
import { KeyAnalysis } from '../../lib/audio/keyAnalysis';
import { MeterAnalysis } from '../../lib/audio/meter';
import { AudioAnalysisResult } from '../../utils/webAudioAnalyzer';
import { SavedAudioAnalysis } from '../../types/song';

export interface AnalyzerAdvancedTabProps {
  file: File | null;
  isCalculatingTempo: boolean;
  isAnalyzingKey: boolean;
  onRecalculateTempo: () => void;
  onRecalculateKey: () => void;
  keyAnalysis: KeyAnalysis | null;
  meterAnalysis: MeterAnalysis | null;
  analysisResult: AudioAnalysisResult | null;
  savedAudioAnalysis?: SavedAudioAnalysis;
}

export const AnalyzerAdvancedTab: React.FC<AnalyzerAdvancedTabProps> = ({
  file,
  isCalculatingTempo,
  isAnalyzingKey,
  onRecalculateTempo,
  onRecalculateKey,
  keyAnalysis,
  meterAnalysis,
  analysisResult,
  savedAudioAnalysis
}) => {
  const refA4 = keyAnalysis?.referenceA4Hz ?? analysisResult?.referenceA4Hz ?? savedAudioAnalysis?.referenceA4Hz;
  const detuning = keyAnalysis?.detuningCents ?? analysisResult?.detuningCents ?? savedAudioAnalysis?.detuningCents ?? 0;

  return (
    <div className="space-y-4">
      {file && (
        <div className="space-y-2">
          <h6 className="font-semibold text-xs text-[var(--text-primary)]">
            Recalcular motores individuales
          </h6>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRecalculateTempo}
              disabled={isCalculatingTempo}
              className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${isCalculatingTempo ? 'animate-spin' : ''}`} />
              <span>Recalcular ritmo y estructura</span>
            </button>

            <button
              type="button"
              onClick={onRecalculateKey}
              disabled={isAnalyzingKey}
              className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-purple-500 ${isAnalyzingKey ? 'animate-spin' : ''}`} />
              <span>Recalcular tonalidad y acordes</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
          <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Calibración A4, confianza y motor</span>
          </span>
          <p className="font-mono text-[var(--text-secondary)]">
            {keyAnalysis?.algorithm || (analysisResult?.source === 'gemini_ai' ? 'Análisis IA multimodal' : 'Web Audio DSP local')}
          </p>
          <p className="font-mono text-[var(--text-muted)] tabular-nums">
            {typeof refA4 === 'number'
              ? `A4 = ${refA4.toFixed(1)} Hz (${detuning >= 0 ? '+' : ''}${detuning} cents)`
              : 'Referencia estándar A4 = 440.0 Hz'}
          </p>
          {(keyAnalysis || meterAnalysis) && (
            <p className="font-mono text-[var(--text-muted)] tabular-nums">
              {[
                keyAnalysis ? `Tonalidad: ${Math.round(keyAnalysis.confidence * 100)}%` : null,
                meterAnalysis ? `Compás: ${Math.round(meterAnalysis.confidence * 100)}%` : null
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
          <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Notas de estimación</span>
          </span>
          <p className="text-[var(--text-muted)] leading-relaxed">
            El análisis combina detección local en tu navegador (beats, downbeats, cromagrama y matriz de autosimilitud) y refinamiento opcional con IA. En temas con rubato libre, ajusta el compás o la tonalidad tocando directamente su tarjeta.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <span>
          El procesamiento DSP se ejecuta localmente en tu navegador y el análisis en servidor protege las credenciales en variables de entorno sin exponerlas al cliente.
        </span>
      </div>
    </div>
  );
};
