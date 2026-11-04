/**
 * LrcGenerationPanel Component
 * 
 * Provides UI for generating synchronized LRC from plain lyrics
 * with strategy selection and preview.
 */

import React, { useState, useCallback } from 'react';
import { Sparkles, ChevronDown, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { ChordSegment } from '../lib/audio/chords';
import {
  generateSyncedLrc,
  getStrategyDescription,
  type TimingStrategy,
  estimateProcessingTime,
  recommendStrategy
} from '../lib/lyrics/lrcGenerationUI';

interface LrcGenerationPanelProps {
  lyrics: string;
  detectedChords?: ChordSegment[];
  tempo?: number;
  title?: string;
  artist?: string;
  onLrcGenerated: (lrc: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
}

export const LrcGenerationPanel: React.FC<LrcGenerationPanelProps> = ({
  lyrics,
  detectedChords = [],
  tempo = 120,
  title = 'Sin título',
  artist = 'Autor',
  onLrcGenerated,
  onClose,
  isOpen = true
}) => {
  const [strategy, setStrategy] = useState<TimingStrategy>(() => recommendStrategy(lyrics));
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    lrc?: string;
    lineCount?: number;
    syllableCount?: number;
    chordCount?: number;
  } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!lyrics.trim()) {
      setLastResult({
        success: false,
        error: 'La letra está vacía',
        message: 'Por favor ingresa una letra antes de generar.'
      });
      return;
    }

    setIsGenerating(true);
    
    // Simulate slight delay for UX feedback
    const processingTime = estimateProcessingTime(lyrics);
    setTimeout(() => {
      const result = generateSyncedLrc({
        lyrics,
        tempo,
        detectedChords,
        timingStrategy: strategy,
        title,
        artist
      });

      setLastResult(result);
      
      if (result.success && result.lrc) {
        onLrcGenerated(result.lrc);
      }

      setIsGenerating(false);
    }, Math.min(processingTime, 300));
  }, [lyrics, tempo, detectedChords, strategy, title, artist, onLrcGenerated]);

  if (!isOpen) return null;

  return (
    <div className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">
            Generar LRC Sincronizado
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Strategy Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--text-primary)]">
          Estrategia de Distribución de Tiempo
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['uniform', 'exponential', 'phonetic'] as TimingStrategy[]).map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                strategy === s
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border-default)]'
              }`}
            >
              <div className="capitalize font-semibold">{s}</div>
              <div className="text-[10px] opacity-75 mt-1 leading-tight">
                {s === 'uniform' && 'Equitativo'}
                {s === 'exponential' && 'Exponencial'}
                {s === 'phonetic' && 'Fonético'}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {getStrategyDescription(strategy)}
        </p>
      </div>

      {/* Info Panel */}
      <div className="bg-[var(--bg-surface-subtle)] rounded-lg p-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-[var(--text-secondary)]">Tempo:</span>
          <span className="font-semibold text-[var(--text-primary)]">{tempo} BPM</span>
        </div>
        {detectedChords.length > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Acordes detectados:</span>
            <span className="font-semibold text-[var(--accent-primary)]">
              {detectedChords.length} acordes
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--text-secondary)]">Líneas de letra:</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {lyrics.split('\n').filter(l => l.trim() && !l.startsWith('##')).length}
          </span>
        </div>
      </div>

      {/* Advanced Options */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-surface-subtle)] hover:bg-[var(--border-default)] transition-colors text-sm"
      >
        <span className="text-[var(--text-secondary)]">Opciones Avanzadas</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
        />
      </button>

      {showAdvanced && (
        <div className="bg-[var(--bg-surface-subtle)] rounded-lg p-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Título
            </label>
            <input
              type="text"
              value={title}
              disabled
              className="w-full px-2 py-1 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Artista
            </label>
            <input
              type="text"
              value={artist}
              disabled
              className="w-full px-2 py-1 text-xs rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] italic">
            💡 Estos valores se establecen automáticamente. Edítalos en el formulario principal.
          </p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !lyrics.trim()}
        className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
          isGenerating || !lyrics.trim()
            ? 'bg-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed'
            : 'bg-[var(--accent-primary)] text-[var(--accent-text)] hover:opacity-90'
        }`}
      >
        {isGenerating ? (
          <>
            <Clock className="w-4 h-4 animate-spin" />
            Generando...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generar LRC Sincronizado
          </>
        )}
      </button>

      {/* Result Message */}
      {lastResult && (
        <div
          className={`p-3 rounded-lg flex gap-2 text-sm ${
            lastResult.success
              ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
          }`}
        >
          {lastResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            {lastResult.success && lastResult.message && (
              <p className="text-green-800 dark:text-green-200">{lastResult.message}</p>
            )}
            {!lastResult.success && lastResult.message && (
              <p className="text-red-800 dark:text-red-200">{lastResult.message}</p>
            )}
            {lastResult.error && (
              <p className="text-red-800 dark:text-red-200 font-semibold">{lastResult.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-[var(--bg-surface-subtle)] rounded-lg p-3 text-xs text-[var(--text-muted)] space-y-1">
        <p>
          <strong>¿Cómo funciona?</strong> El sistema convierte tu letra en formato LRC sincronizado,
          marcando automáticamente el tiempo de cada línea basándose en el tempo. Los acordes detectados
          se posicionan en la sílaba correspondiente dentro de cada verso.
        </p>
        <p className="pt-2">
          <strong>Resultado:</strong> Una letra sincronizada lista para ser usada en aplicaciones que
          soporten el formato LRC con display de acordes en tiempo real.
        </p>
      </div>
    </div>
  );
};
