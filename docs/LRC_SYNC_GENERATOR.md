# LRC Sync Generator: Synchronization and Chord Positioning

## Overview

The LRC Sync Generator is a comprehensive system for converting plain lyrics into fully synchronized LRC (Lyric File Format) with syllable-level timing and automatic chord positioning based on detected audio chords.

## Core Features

### 1. **Syllable-Level Analysis**
- Automatic syllabification of Spanish and English lyrics
- Character position tracking for precise syllable mapping
- Language detection and adaptive syllabification rules
- Support for compound words, contractions, and special characters

### 2. **Timing Distribution**
Multiple strategies for distributing line duration across syllables:

- **Uniform**: Equal duration per syllable (default, predictable)
- **Exponential**: Later syllables get slightly more time (natural speech pattern)
- **Phonetic**: Weight based on consonant/vowel patterns (linguistically accurate)

### 3. **Chord Positioning**
- Automatic positioning of detected chords at syllable boundaries
- Maps chord timing to syllable positions
- Preserves musicality while respecting timing constraints
- Format: `[Chord]syllable[NextChord]syllable...`

### 4. **LRC Format Support**
- Generate LRC from plain lyrics
- Upgrade existing LRC to syllable level
- Merge detected chords with existing arrangements
- Full metadata support (title, artist, album, offset, etc.)

## API Reference

### Core Modules

#### `syllableAnalysis.ts`
Text analysis and syllabification functions.

```typescript
// Syllabify a single word
syllabifyWord(word: string): string[]

// Syllabify a complete line
syllabifyLine(line: string): SyllableizedLine

// Find syllable at position
findSyllableAtPosition(syllabized: SyllableizedLine, charPosition: number): Syllable | null

// Map chords to syllables
mapChordsToSyllables(
  syllabized: SyllableizedLine,
  lineDurationSec: number,
  chordsInWindow: Array<{ chord: string; timeOffset: number }>
): Map<number, string>
```

#### `lrcSyncGenerator.ts`
Timing calculation and LRC generation.

```typescript
// Calculate syllable timing
calculateSyllableTiming(
  syllables: Syllable[],
  startTime: number,
  endTime: number,
  strategy?: TimingDistributionStrategy
): Map<number, number>

// Generate syllable-level LRC line
generateSyllableLrcLine(
  lineText: string,
  lineStartTime: number,
  lineEndTime: number,
  chordsInWindow?: ChordSegment[],
  timingStrategy?: TimingDistributionStrategy,
  lineId?: string
): LrcLineWithChords

// Generate complete LRC with timing
generateLrcWithSyllableTiming(
  plainLyrics: string,
  lineTiming: Array<{ text: string; startTime: number; endTime: number }>,
  detectedChords?: ChordSegment[],
  metadata?: LrcMetadata,
  timingStrategy?: TimingDistributionStrategy
): string

// From plain lyrics with automatic timing
generateLrcFromPlainLyricsWithChords(
  plainLyrics: string,
  detectedChords?: ChordSegment[],
  metadata?: LrcMetadata,
  options?: { linesPerMinute?: number; timingStrategy?: TimingDistributionStrategy }
): string

// Upgrade existing LRC to syllable level
upgradeLrcToSyllableLevel(
  existingLrcLines: SyncedLyricLine[],
  detectedChords?: ChordSegment[],
  timingStrategy?: TimingDistributionStrategy
): SyncedLyricLine[]
```

#### `lyricsChordIntegration.ts`
High-level integration API.

```typescript
// Main function: generate synced LRC from plain lyrics
generateSyncedLrcFromPlainLyrics(
  plainLyrics: string,
  detectedChords: ChordSegment[],
  metadata?: LrcMetadata,
  options?: {
    timingStrategy?: TimingDistributionStrategy;
    linesPerMinute?: number;
  }
): LyricsAndChordsSync

// Upgrade existing LRC
upgradeExistingLrcWithChords(
  lrcContent: string,
  detectedChords: ChordSegment[],
  timingStrategy?: TimingDistributionStrategy
): LyricsAndChordsSync

// Merge new detected chords with existing
mergeDetectedChordsWithExisting(
  lyricsWithExistingChords: string,
  newDetectedChords: ChordSegment[],
  metadata?: LrcMetadata,
  timingStrategy?: TimingDistributionStrategy
): LyricsAndChordsSync

// Analyze structure for UI
analyzeLyricsStructure(lyrics: string): Array<{
  lineNumber: number;
  text: string;
  syllables: SyllableizedLine;
  syllableCount: number;
}>

// Estimate timing from lyrics
estimateLyricsTimings(
  lyrics: string,
  options?: { linesPerMinute?: number; tempoBeats?: number[] }
): Array<{ text: string; startTime: number; endTime: number }>
```

### React Hook

```typescript
// useLyricsChordSync.ts
const [state, actions] = useLyricsChordSync({
  initialLyrics?: string;
  initialLrc?: string;
  metadata?: LrcMetadata;
  timingStrategy?: TimingDistributionStrategy;
  linesPerMinute?: number;
})

// State
state.plainLyrics          // Clean lyrics without chords
state.lyricsWithChords     // Lyrics with positioned chords
state.lrc                  // Generated LRC format
state.detectedChords       // Current detected chords
state.timingStrategy       // Current timing strategy
state.metadata             // Song metadata
state.isLoading            // Loading state
state.error                // Error message if any
state.lyricsStructure      // Analyzed syllable structure
state.estimatedTimings     // Estimated line timings

// Actions
actions.updateLyrics(lyrics)                      // Update lyrics
actions.applyDetectedChords(chords)               // Apply detected chords
actions.upgradeExistingLrc(lrcContent, chords)    // Upgrade LRC
actions.setTimingStrategy(strategy)               // Change strategy
actions.setMetadata(metadata)                     // Update metadata
actions.reset()                                   // Reset to initial
```

## Usage Examples

### Example 1: Generate LRC from Plain Lyrics

```typescript
import { generateSyncedLrcFromPlainLyrics } from './lib/lyrics/lyricsChordIntegration';
import { analyzeChordsDSP } from './lib/audio/chords';

// Detect chords from audio
const audioContext = new AudioContext();
const audioBuffer = await audioContext.decodeAudioData(...);
const detectedChords = analyzeChordsDSP(audioBuffer);

// Generate synced LRC
const sync = generateSyncedLrcFromPlainLyrics(
  plainLyrics,
  detectedChords,
  {
    title: 'My Song',
    artist: 'Artist Name'
  },
  {
    timingStrategy: 'uniform',      // or 'exponential', 'phonetic'
    linesPerMinute: 3               // Adjust for song tempo
  }
);

console.log(sync.lrc);            // Full LRC format
console.log(sync.lyricsWithChords); // Display version
```

### Example 2: Use in React Component

```typescript
import { useLyricsChordSync } from './hooks/useLyricsChordSync';

function LyricsEditor({ initialLyrics, detectedChords }) {
  const [state, actions] = useLyricsChordSync({
    initialLyrics,
    timingStrategy: 'uniform'
  });

  const handleApplyChords = () => {
    actions.applyDetectedChords(detectedChords);
  };

  const handleTimingChange = (strategy) => {
    actions.setTimingStrategy(strategy);
  };

  return (
    <div>
      {/* Display lyrics with chords */}
      <pre>{state.lyricsWithChords}</pre>

      {/* Show syllable structure */}
      <div>
        {state.lyricsStructure.map(line => (
          <div key={line.lineNumber}>
            Line {line.lineNumber}: {line.syllableCount} syllables
          </div>
        ))}
      </div>

      {/* Timing strategy selector */}
      <select onChange={e => handleTimingChange(e.target.value)}>
        <option value="uniform">Uniform</option>
        <option value="exponential">Exponential</option>
        <option value="phonetic">Phonetic</option>
      </select>

      {/* Apply button */}
      <button onClick={handleApplyChords}>
        Apply Detected Chords
      </button>

      {/* Export LRC */}
      <textarea value={state.lrc} readOnly />
    </div>
  );
}
```

### Example 3: Upgrade Existing LRC

```typescript
import { upgradeExistingLrcWithChords } from './lib/lyrics/lyricsChordIntegration';

// Existing line-level LRC
const existingLrc = `
[ti:My Song]
[ar:Artist]
[00:00.00]First line
[00:04.00]Second line
[00:08.00]Third line
`;

// Detected chords
const chords = [
  { startTime: 0, endTime: 2, chord: 'C', confidence: 0.9 },
  { startTime: 2, endTime: 4, chord: 'G', confidence: 0.85 },
  // ... more chords
];

// Upgrade to syllable level
const upgraded = upgradeExistingLrcWithChords(
  existingLrc,
  chords,
  'exponential'
);

console.log(upgraded.lrc); // Syllable-level LRC with chords
```

## Output Format

### Generated LRC Example

```
[ti:La Noche Hermosa]
[ar:Tony González]
[al:Cancionero 2026]

[00:00.00] [C]La[G]no[Am]che[F]es
[00:02.50] [C]os[G]cu[Am]ra[F]y
[00:05.00] [C]be[G]lla[Am]son[F]las
[00:07.50] [C]es[G]tre[Am]llas[F]del
```

### Lyrics with Positioned Chords

```
[C]La[G]no[Am]che[F]es
[C]os[G]cu[Am]ra[F]y
[C]be[G]lla[Am]son[F]las
[C]es[G]tre[Am]llas[F]del
```

## Configuration

### Timing Strategies

**Uniform** (Default)
- Each syllable gets equal time
- Most predictable, works well for consistent pacing
- Best for metronome-like playback

**Exponential**
- Earlier syllables shorter, later syllables longer
- Natural speech rhythm
- Good for realistic singing simulation

**Phonetic**
- Weights based on vowel/consonant patterns
- Longer syllables with more consonants/vowels
- Most linguistically accurate

### Tempo Configuration

```typescript
// Lines per minute (default: 3 = ~20 seconds per line)
const options = {
  linesPerMinute: 4   // Faster: 15 seconds per line
  linesPerMinute: 2   // Slower: 30 seconds per line
}
```

## Testing

All components include comprehensive test coverage:

```bash
# Run syllable analysis tests
npx tsx --test test/lrcSyncGenerator.test.ts

# Run all lyrics tests
npx tsx --test test/lyrics.test.ts
```

## Performance Considerations

- Syllabification is O(n) where n = text length
- Chord positioning is O(m*k) where m = chords, k = syllables per line
- Typical performance: <100ms for a full song (100+ lines)
- All operations are CPU-bound, suitable for worker threads

## Future Enhancements

1. **Machine Learning Models**: Replace template-based chord recognition
2. **Beat Alignment**: Snap chord changes to detected beats
3. **User Correction UI**: Allow manual adjustment of syllable positions
4. **Audio Alignment**: Fine-tune timing based on voice analysis
5. **Multi-Language Support**: Add Portuguese, French, Italian syllabification
6. **Interactive Preview**: Real-time playback with synchronized display

## File Structure

```
src/
├── lib/
│   └── lyrics/
│       ├── syllableAnalysis.ts          # Syllabification logic
│       ├── lrcSyncGenerator.ts          # Timing and LRC generation
│       ├── lyricsChordIntegration.ts    # High-level API
│       └── parseLrc.ts                  # (existing) LRC parsing
├── hooks/
│   └── useLyricsChordSync.ts            # React hook
└── types/
    └── lyrics.ts                         # (existing) Type definitions
test/
├── lrcSyncGenerator.test.ts             # Unit tests
└── lyrics.test.ts                       # (existing) Integration tests
```

## Integration Checklist

- [x] Core syllable analysis
- [x] Timing distribution algorithms
- [x] Chord positioning
- [x] LRC generation
- [x] Comprehensive testing
- [x] React hook integration
- [x] Integration service API
- [ ] UI components (editor, preview, timing adjuster)
- [ ] Performance optimization for large files
- [ ] Extended language support

## Compatibility

- Works with existing LRC parser and chord detection
- No breaking changes to existing API
- Can be integrated into SongEditorPage
- Compatible with audio analysis pipeline
- Supports both plain lyrics and existing LRC files
