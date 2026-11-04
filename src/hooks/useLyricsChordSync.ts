/**
 * React Hook for managing synchronized lyrics and chord positioning
 */

import { useState, useCallback, useMemo } from 'react';
import { ChordSegment } from '../lib/audio/chords';
import { LrcMetadata } from '../types/lyrics';
import {
  generateSyncedLrcFromPlainLyrics,
  upgradeExistingLrcWithChords,
  mergeDetectedChordsWithExisting,
  analyzeLyricsStructure,
  estimateLyricsTimings,
  LyricsAndChordsSync
} from '../lib/lyrics/lyricsChordIntegration';
import { TimingDistributionStrategy } from '../lib/lyrics/lrcSyncGenerator';

export interface UseLyricsChordSyncOptions {
  initialLyrics?: string;
  initialLrc?: string;
  metadata?: LrcMetadata;
  timingStrategy?: TimingDistributionStrategy;
  linesPerMinute?: number;
}

export interface UseLyricsChordSyncState {
  plainLyrics: string;
  lyricsWithChords: string;
  lrc: string;
  detectedChords: ChordSegment[];
  timingStrategy: TimingDistributionStrategy;
  metadata?: LrcMetadata;
  isLoading: boolean;
  error: string | null;
}

export interface UseLyricsChordSyncActions {
  // Update lyrics and regenerate LRC
  updateLyrics: (lyrics: string) => void;

  // Apply detected chords to current lyrics
  applyDetectedChords: (chords: ChordSegment[]) => void;

  // Upgrade existing LRC to syllable level
  upgradeExistingLrc: (lrcContent: string, chords: ChordSegment[]) => void;

  // Change timing strategy and regenerate
  setTimingStrategy: (strategy: TimingDistributionStrategy) => void;

  // Update metadata
  setMetadata: (metadata: LrcMetadata) => void;

  // Reset to initial state
  reset: () => void;
}

/**
 * Hook for managing lyrics, chords, and LRC synchronization
 * Handles syllable-level timing and chord positioning
 */
export function useLyricsChordSync(
  options: UseLyricsChordSyncOptions = {}
): [UseLyricsChordSyncState, UseLyricsChordSyncActions] {
  const [state, setState] = useState<UseLyricsChordSyncState>({
    plainLyrics: options.initialLyrics || '',
    lyricsWithChords: options.initialLyrics || '',
    lrc: options.initialLrc || '',
    detectedChords: [],
    timingStrategy: options.timingStrategy || 'uniform',
    metadata: options.metadata,
    isLoading: false,
    error: null
  });

  const updateLyrics = useCallback((lyrics: string) => {
    setState(prev => ({
      ...prev,
      plainLyrics: lyrics,
      isLoading: true,
      error: null
    }));

    try {
      const sync = generateSyncedLrcFromPlainLyrics(
        lyrics,
        prev.detectedChords,
        prev.metadata,
        {
          timingStrategy: prev.timingStrategy,
          linesPerMinute: options.linesPerMinute
        }
      );

      setState(prev => ({
        ...prev,
        plainLyrics: sync.plainLyrics,
        lyricsWithChords: sync.lyricsWithChords,
        lrc: sync.lrc,
        isLoading: false
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error updating lyrics'
      }));
    }
  }, [options.linesPerMinute, state.detectedChords, state.metadata, state.timingStrategy]);

  const applyDetectedChords = useCallback((chords: ChordSegment[]) => {
    setState(prev => ({
      ...prev,
      detectedChords: chords,
      isLoading: true,
      error: null
    }));

    try {
      const sync = generateSyncedLrcFromPlainLyrics(
        state.plainLyrics,
        chords,
        state.metadata,
        {
          timingStrategy: state.timingStrategy,
          linesPerMinute: options.linesPerMinute
        }
      );

      setState(prev => ({
        ...prev,
        lyricsWithChords: sync.lyricsWithChords,
        lrc: sync.lrc,
        detectedChords: chords,
        isLoading: false
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error applying chords'
      }));
    }
  }, [state.plainLyrics, state.metadata, state.timingStrategy, options.linesPerMinute]);

  const upgradeExistingLrc = useCallback((lrcContent: string, chords: ChordSegment[]) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      const sync = upgradeExistingLrcWithChords(
        lrcContent,
        chords,
        state.timingStrategy
      );

      setState(prev => ({
        ...prev,
        plainLyrics: sync.plainLyrics,
        lyricsWithChords: sync.lyricsWithChords,
        lrc: sync.lrc,
        detectedChords: chords,
        metadata: sync.metadata,
        isLoading: false
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error upgrading LRC'
      }));
    }
  }, [state.timingStrategy]);

  const setTimingStrategy = useCallback((strategy: TimingDistributionStrategy) => {
    setState(prev => ({
      ...prev,
      timingStrategy: strategy,
      isLoading: true,
      error: null
    }));

    try {
      const sync = generateSyncedLrcFromPlainLyrics(
        state.plainLyrics,
        state.detectedChords,
        state.metadata,
        {
          timingStrategy: strategy,
          linesPerMinute: options.linesPerMinute
        }
      );

      setState(prev => ({
        ...prev,
        lyricsWithChords: sync.lyricsWithChords,
        lrc: sync.lrc,
        timingStrategy: strategy,
        isLoading: false
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error changing timing strategy'
      }));
    }
  }, [state.plainLyrics, state.detectedChords, state.metadata, options.linesPerMinute]);

  const setMetadata = useCallback((metadata: LrcMetadata) => {
    setState(prev => ({
      ...prev,
      metadata,
      isLoading: true,
      error: null
    }));

    try {
      const sync = generateSyncedLrcFromPlainLyrics(
        state.plainLyrics,
        state.detectedChords,
        metadata,
        {
          timingStrategy: state.timingStrategy,
          linesPerMinute: options.linesPerMinute
        }
      );

      setState(prev => ({
        ...prev,
        lyricsWithChords: sync.lyricsWithChords,
        lrc: sync.lrc,
        metadata,
        isLoading: false
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error updating metadata'
      }));
    }
  }, [state.plainLyrics, state.detectedChords, state.timingStrategy, options.linesPerMinute]);

  const reset = useCallback(() => {
    setState({
      plainLyrics: options.initialLyrics || '',
      lyricsWithChords: options.initialLyrics || '',
      lrc: options.initialLrc || '',
      detectedChords: [],
      timingStrategy: options.timingStrategy || 'uniform',
      metadata: options.metadata,
      isLoading: false,
      error: null
    });
  }, [options.initialLyrics, options.initialLrc, options.metadata, options.timingStrategy]);

  // Memoize computed values
  const lyricsStructure = useMemo(
    () => analyzeLyricsStructure(state.plainLyrics),
    [state.plainLyrics]
  );

  const estimatedTimings = useMemo(
    () => estimateLyricsTimings(state.plainLyrics, { linesPerMinute: options.linesPerMinute }),
    [state.plainLyrics, options.linesPerMinute]
  );

  const stateWithAnalysis = useMemo(
    () => ({
      ...state,
      lyricsStructure,
      estimatedTimings
    }),
    [state, lyricsStructure, estimatedTimings]
  );

  const actions: UseLyricsChordSyncActions = {
    updateLyrics,
    applyDetectedChords,
    upgradeExistingLrc,
    setTimingStrategy,
    setMetadata,
    reset
  };

  return [stateWithAnalysis as any, actions];
}
