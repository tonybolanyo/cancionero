/**
 * Integration Example: How to use LRC Sync Generator in SongEditorPage
 *
 * This file shows how to integrate the new chord positioning and syllable timing
 * functionality into the existing song editor workflow.
 *
 * Usage:
 * 1. Import the new modules in SongEditorPage.tsx
 * 2. Add the useLyricsChordSync hook
 * 3. Update the chord insertion flow
 * 4. Add UI controls for timing strategy
 * 5. Export LRC with syllable timing
 */

import { useLyricsChordSync } from '../hooks/useLyricsChordSync';
import { ChordSegment, analyzeChordsDSP } from '../lib/audio/chords';
import { generateSyncedLrcFromPlainLyrics } from '../lib/lyrics/lyricsChordIntegration';

/**
 * STEP 1: Add hook to component
 */
export function SongEditorPageIntegration() {
  // Initialize the lyrics-chord sync hook
  const [syncState, syncActions] = useLyricsChordSync({
    initialLyrics: '',
    metadata: {
      title: 'Song Title',
      artist: 'Artist Name'
    },
    timingStrategy: 'uniform',
    linesPerMinute: 3
  });

  /**
   * STEP 2: When lyrics change in the editor
   */
  const handleLyricsChange = (newLyrics: string) => {
    syncActions.updateLyrics(newLyrics);
  };

  /**
   * STEP 3: When chords are detected from audio
   */
  const handleChordsDetected = async (audioBuffer: AudioBuffer) => {
    // Detect chords from audio
    const detectedChords = analyzeChordsDSP(audioBuffer, {
      beats: undefined, // Optional: pass detected beats
      windowDurationSec: 1.5,
      hopDurationSec: 0.75
    });

    // Apply to current lyrics with syllable positioning
    syncActions.applyDetectedChords(detectedChords);
  };

  /**
   * STEP 4: Export synchronized LRC
   */
  const handleExportLrc = () => {
    const { lrc } = syncState;
    
    // Download or save LRC
    const blob = new Blob([lrc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lyrics.lrc';
    link.click();
  };

  /**
   * STEP 5: UI Example - Timing Strategy Selector
   */
  return (
    <div className="lyrics-sync-editor">
      {/* Lyrics Editor */}
      <textarea
        value={syncState.plainLyrics}
        onChange={e => handleLyricsChange(e.target.value)}
        placeholder="Enter plain lyrics (one line per verse)..."
      />

      {/* Display with Positioned Chords */}
      <pre className="lyrics-with-chords">
        {syncState.lyricsWithChords}
      </pre>

      {/* Syllable Structure Analysis */}
      <div className="syllable-analysis">
        <h3>Syllable Analysis</h3>
        {syncState.lyricsStructure?.map(line => (
          <div key={line.lineNumber} className="line-analysis">
            <span className="line-number">Line {line.lineNumber}:</span>
            <span className="syllable-count">{line.syllableCount} syllables</span>
            <span className="line-text">{line.text}</span>
          </div>
        ))}
      </div>

      {/* Timing Strategy Selector */}
      <div className="timing-controls">
        <label>
          Timing Strategy:
          <select
            value={syncState.timingStrategy}
            onChange={e => syncActions.setTimingStrategy(e.target.value as any)}
          >
            <option value="uniform">Uniform (Equal syllable timing)</option>
            <option value="exponential">Exponential (Natural rhythm)</option>
            <option value="phonetic">Phonetic (Linguistic accuracy)</option>
          </select>
        </label>

        <label>
          Tempo:
          <input
            type="number"
            min="1"
            max="10"
            defaultValue={3}
            onChange={e => {
              // Re-apply with new tempo
              syncActions.applyDetectedChords(syncState.detectedChords);
            }}
            title="Lines per minute"
          />
          <span className="info">lines/minute</span>
        </label>
      </div>

      {/* Chord Detection Controls */}
      <div className="chord-controls">
        <button onClick={handleChordsDetected}>
          Detect Chords from Audio
        </button>
        
        <button onClick={() => syncActions.reset()}>
          Clear Chords
        </button>
      </div>

      {/* LRC Preview & Export */}
      <div className="lrc-export">
        <h3>Generated LRC (Syllable-Level Sync)</h3>
        <textarea
          value={syncState.lrc}
          readOnly
          className="lrc-output"
        />
        <button onClick={handleExportLrc}>
          Export LRC
        </button>
      </div>

      {/* Error Display */}
      {syncState.error && (
        <div className="error-message">
          {syncState.error}
        </div>
      )}

      {/* Loading State */}
      {syncState.isLoading && (
        <div className="loading-spinner">
          Processing...
        </div>
      )}
    </div>
  );
}

/**
 * STEP 6: Integration with existing chord detection workflow
 *
 * In the existing onChordsDetected handler:
 */
export function integrateChordDetection(
  currentLyrics: string,
  detectedChords: ChordSegment[]
) {
  // OLD WAY (kept for compatibility):
  // const updated = insertChordsIntoLyrics(currentLyrics, detectedChords);

  // NEW WAY (with syllable-level timing):
  const sync = generateSyncedLrcFromPlainLyrics(
    currentLyrics,
    detectedChords,
    {
      title: 'Song Title',
      artist: 'Artist Name'
    },
    {
      timingStrategy: 'uniform',
      linesPerMinute: 3
    }
  );

  return {
    lyricsWithChords: sync.lyricsWithChords,  // For display
    lrc: sync.lrc,                            // For LRC player
    plainLyrics: sync.plainLyrics             // For editing
  };
}

/**
 * STEP 7: Upgrade existing LRC with new chord detection
 *
 * If user already has an LRC file and detects new chords:
 */
export function upgradeExistingLrc(
  existingLrcContent: string,
  newDetectedChords: ChordSegment[]
) {
  const { upgradeExistingLrcWithChords } = require('../lib/lyrics/lyricsChordIntegration');

  return upgradeExistingLrcWithChords(
    existingLrcContent,
    newDetectedChords,
    'exponential'  // Different strategy for existing LRCs
  );
}

/**
 * STEP 8: Type-safe integration in existing components
 */
import React from 'react';
import { SyncedLyricLine } from '../types/lyrics';

interface LyricsEditorProps {
  initialLyrics: string;
  onLyricsChange: (lyrics: string) => void;
  onExportLrc: (lrcContent: string) => void;
}

export const LyricsEditorWithSync: React.FC<LyricsEditorProps> = ({
  initialLyrics,
  onLyricsChange,
  onExportLrc
}) => {
  const [syncState, syncActions] = useLyricsChordSync({
    initialLyrics,
    timingStrategy: 'uniform'
  });

  const handleSave = () => {
    onExportLrc(syncState.lrc);
  };

  return (
    <div className="editor">
      <textarea
        value={syncState.plainLyrics}
        onChange={e => {
          syncActions.updateLyrics(e.target.value);
          onLyricsChange(e.target.value);
        }}
      />
      <button onClick={handleSave}>Save LRC</button>
    </div>
  );
};
