/**
 * LRC Generation UI Helper
 * 
 * Provides utilities for UI components to trigger LRC generation
 * with different timing strategies and chord positioning.
 */

import { generateSyncedLrcFromPlainLyrics } from './lyricsChordIntegration';
import type { ChordSegment } from '../audio/chords';

export type TimingStrategy = 'uniform' | 'exponential' | 'phonetic';

export interface SyllableLrcOptions {
  tempo?: number;
  strategy?: TimingStrategy;
  title?: string;
  artist?: string;
}

export interface LrcGenerationConfig {
  lyrics: string;
  tempo?: number;
  detectedChords?: ChordSegment[];
  timingStrategy?: TimingStrategy;
  title?: string;
  artist?: string;
}

export interface LrcGenerationResult {
  success: boolean;
  lrc?: string;
  error?: string;
  message?: string;
  syllableCount?: number;
  lineCount?: number;
  chordCount?: number;
}

/**
 * Generate synchronized LRC from plain lyrics
 * 
 * @param config Configuration object with lyrics and options
 * @returns Generation result with LRC or error message
 */
export function generateSyncedLrc(config: LrcGenerationConfig): LrcGenerationResult {
  try {
    const {
      lyrics,
      tempo = 120,
      detectedChords = [],
      timingStrategy = 'phonetic',
      title = 'Sin título',
      artist = 'Autor'
    } = config;

    if (!lyrics || !lyrics.trim()) {
      return {
        success: false,
        error: 'La letra está vacía',
        message: 'Por favor ingresa una letra antes de generar el LRC sincronizado.'
      };
    }

    // Split lyrics into lines (handling markdown headers)
    const lines = lyrics
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('##'));

    if (lines.length === 0) {
      return {
        success: false,
        error: 'No hay líneas de letra válidas',
        message: 'La letra solo contiene secciones o está vacía. Asegúrate de que hay versos/estrofas.'
      };
    }

    // Clean chords from lyrics for processing
    const cleanLyrics = lyrics
      .split('\n')
      .map(line => {
        // Remove chord markers like [Am], [G], etc.
        return line.replace(/\[\w+(?:#|b)?\]/g, '').trim();
      })
      .filter(line => line && !line.startsWith('##'))
      .join('\n');

    // Generate synced LRC
    const result = generateSyncedLrcFromPlainLyrics(
      cleanLyrics,
      detectedChords,
      undefined, // metadata
      {
        timingStrategy: timingStrategy
      }
    );

    if (!result.lrc) {
      return {
        success: false,
        error: 'No se pudo generar el LRC',
        message: 'Hubo un error al procesar la letra. Verifica que esté bien formateada.'
      };
    }

    const lineCount = result.lrc.split('\n').filter(line => line.trim()).length;
    const syllableCount = result.plainLyrics.split(' ').length * 2; // Rough estimate
    const chordCount = detectedChords.length;

    return {
      success: true,
      lrc: result.lrc,
      message: `LRC generado exitosamente: ${lineCount} líneas, ${syllableCount} sílabas${
        chordCount > 0 ? `, ${chordCount} acordes posicionados` : ''
      }`,
      lineCount,
      syllableCount,
      chordCount
    };
  } catch (error) {
    console.error('Error generating LRC:', error);
    return {
      success: false,
      error: 'Error interno',
      message: `Ocurrió un error inesperado: ${error instanceof Error ? error.message : 'Desconocido'}`
    };
  }
}

/**
 * Get description for a timing strategy
 */
export function getStrategyDescription(strategy: TimingStrategy): string {
  const descriptions: Record<TimingStrategy, string> = {
    uniform: 'Distribuye el tiempo uniformemente entre todas las sílabas. Ideal para canciones con tempo regular.',
    exponential: 'Da más tiempo a las últimas sílabas. Simula un flujo natural de habla/canto.',
    phonetic: 'Calcula el tiempo basado en características fonéticas de las sílabas. Más preciso para sincronización.'
  };
  return descriptions[strategy];
}

/**
 * Validate configuration before generation
 */
export function validateConfig(config: LrcGenerationConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.lyrics || !config.lyrics.trim()) {
    errors.push('La letra es requerida');
  }

  if (config.tempo && (config.tempo < 40 || config.tempo > 300)) {
    errors.push('El tempo debe estar entre 40 y 300 BPM');
  }

  if (!config.timingStrategy || !['uniform', 'exponential', 'phonetic'].includes(config.timingStrategy)) {
    errors.push('Estrategia de timing no válida');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Estimate processing time for lyrics
 */
export function estimateProcessingTime(lyrics: string): number {
  // Roughly 0.1ms per character
  return Math.max(50, Math.min(1000, lyrics.length * 0.1));
}

/**
 * Get recommended strategy based on lyrics characteristics
 */
export function recommendStrategy(lyrics: string): TimingStrategy {
  const lines = lyrics.split('\n').filter(l => l.trim());
  const avgLineLength = lines.reduce((sum, l) => sum + l.length, 0) / (lines.length || 1);

  // Phonetic for complex lyrics, exponential for moderate, uniform for simple
  if (avgLineLength > 60) return 'phonetic';
  if (avgLineLength > 40) return 'exponential';
  return 'uniform';
}
