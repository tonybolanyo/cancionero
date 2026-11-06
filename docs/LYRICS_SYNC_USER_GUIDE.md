# Lyrics Sync and Chord Integration - User Guide

## Quick Start

### Scenario 1: You have plain lyrics and want LRC with chords

```typescript
import { generateSyncedLrcFromPlainLyrics } from '@/lib/lyrics/lyricsChordIntegration';
import { analyzeChordsDSP } from '@/lib/audio/chords';

// 1. Get your plain lyrics
const lyrics = `La noche es oscura
y las estrellas brillan
en el cielo profundo`;

// 2. Get the audio and detect chords
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
const chords = analyzeChordsDSP(audioBuffer);

// 3. Generate LRC
const { lrc, lyricsWithChords, warnings } = generateSyncedLrcFromPlainLyrics(
  lyrics,
  chords,
  { title: 'La Noche', artist: 'Poeta' },
  { timingStrategy: 'uniform', linesPerMinute: 3 }
);

// 4. Export or use
downloadFile(new Blob([lrc]), 'song.lrc');
console.log(lyricsWithChords);
```

### Scenario 2: You have existing LRC and want to add chords

```typescript
import { upgradeExistingLrcWithChords } from '@/lib/lyrics/lyricsChordIntegration';

const existingLrc = `[ti:Song]
[00:00.00] First line
[00:03.00] Second line`;

const newChords = /* ... detected chords ... */;

const upgraded = upgradeExistingLrcWithChords(existingLrc, newChords);
console.log(upgraded.lrc);  // Upgraded with chord positioning
```

### Scenario 3: In a React component

```typescript
import { useLyricsChordSync } from '@/hooks/useLyricsChordSync';

function MusicEditor() {
  const [state, actions] = useLyricsChordSync({
    initialLyrics: 'Your lyrics...',
    metadata: { title: 'Song', artist: 'Artist' }
  });

  const handleDetectChords = async () => {
    const chords = await detectChordsFromAudio();
    actions.applyDetectedChords(chords);
  };

  return (
    <>
      <textarea 
        value={state.plainLyrics}
        onChange={e => actions.updateLyrics(e.target.value)}
      />
      
      <div>
        <h3>Preview with Chords</h3>
        <pre>{state.lyricsWithChords}</pre>
      </div>

      <div>
        <h3>LRC Output</h3>
        <textarea value={state.lrc} readOnly />
      </div>

      <button onClick={handleDetectChords}>
        Detect Chords
      </button>
    </>
  );
}
```

## Understanding the Output

### LRC Format

LRC files contain timing information for lyrics:

```
[ti:Song Title]
[ar:Artist Name]
[al:Album Name]
[00:00.00] First line of lyrics
[00:03.50] Second line of lyrics
```

With syllable-level chords:

```
[00:00.00] [Em]La [Am]no-[C]che [F]es
[00:02.00] os-[G]cu-[C]ra
```

Each `[time]` mark tells a player when to display that lyric line.

### Lyrics with Chords (Display Format)

This format shows chords positioned above syllables for musicians:

```
[Em]La [Am]no-[C]che [F]es os-[G]cu-[C]ra
[G]y [D]las es-[A]trellas [Em]bri-[B]llan
```

Chords in brackets `[Am]` show which chord is played at that position.

## Configuration Options

### Timing Strategies

#### Uniform (Best for Playback)
Each syllable gets equal time:
```
Line: "La noche es oscura" (6 seconds for 7 syllables)
- "La" → 0-1s
- "no" → 1-2s
- "che" → 2-3s
- ...
```

#### Exponential (Best for Singing)
Later syllables get slightly more time (natural speech):
```
Weights: 0.5, 0.57, 0.64, 0.71, 0.79, 0.86, 0.93
```

#### Phonetic (Best for Accuracy)
Duration based on syllable structure:
- Vowel-heavy syllables get more time
- Consonant clusters add weight
- Technical accuracy

### Tempo/Lines Per Minute

Default is 3 lines per minute (20 seconds per line).

Adjust for different tempos:
- Slow songs: 2-3 lines/min
- Normal songs: 3-4 lines/min
- Fast songs: 4-5 lines/min

```typescript
generateSyncedLrcFromPlainLyrics(lyrics, chords, metadata, {
  linesPerMinute: 4  // For faster songs
});
```

### Metadata

Include song information:

```typescript
{
  title: 'Song Name',
  artist: 'Artist Name',
  album: 'Album Name',
  by: 'Lyrics by Name',     // Creator of the LRC
  offset: 1000,              // Timing offset in milliseconds
  length: '03:45',           // Song length
  re: 'Created with Cancionero'
}
```

## Chord Detection Tips

### Getting Good Chord Detection

1. **Use high-quality audio** - WAV or lossless formats work best
2. **Isolate instruments** - Pure instrumental or acapella if possible
3. **Avoid very loud compression** - Let the chords breathe
4. **Use consistent window sizes** - Around 1.5 seconds is standard
5. **Clean up background noise** - Silence means fewer false chords

### Detecting Chords Automatically

```typescript
import { analyzeChordsDSP } from '@/lib/audio/chords';

const chords = analyzeChordsDSP(audioBuffer, {
  windowDurationSec: 1.5,  // Larger = more stable, slower
  hopDurationSec: 0.75,     // 50% overlap typical
  beats: undefined          // Optional: pass detected beats
});

console.log(chords);
// [
//   { chord: 'C', startTime: 0, endTime: 1.5, confidence: 0.92 },
//   { chord: 'G', startTime: 1.5, endTime: 3, confidence: 0.88 },
//   ...
// ]
```

## Troubleshooting

### Empty Lyrics Error
```
Error: "Lyrics input is empty or null"
```
**Fix:** Make sure lyrics are not empty:
```typescript
if (!lyrics || lyrics.trim().length === 0) {
  console.error('Please enter lyrics first');
}
```

### Chord Positioning Issues
If chords don't seem to line up:

1. **Check timing strategy** - Try 'phonetic' if 'uniform' looks off
2. **Verify tempo** - Adjust `linesPerMinute` if timing is wrong
3. **Check syllable count** - May need to review line syllabification
4. **Validate chords** - Ensure chord detection actually found chords

### Language Detection Issues
If lyrics in English get detected as Spanish:

The system auto-detects language. If it's wrong:
1. Include more context (full sentences, not fragments)
2. Use common words specific to the language
3. Add accented characters if Spanish

### Performance Issues
For large files (500+ lines):

1. Process in batches of 100 lines
2. Use 'uniform' timing strategy (fastest)
3. Consider using a Web Worker:

```typescript
const worker = new Worker('lyricsTranscription.worker.ts');
worker.postMessage({ lyrics, chords });
worker.onmessage = (e) => {
  const { lrc } = e.data;
  // Use result
};
```

## Examples

### Example 1: Complete Workflow

```typescript
async function createLrcFile() {
  try {
    // 1. Get audio and lyrics
    const audioBuffer = await loadAudio('song.mp3');
    const lyrics = await loadLyrics('song.txt');

    // 2. Detect chords
    const chords = analyzeChordsDSP(audioBuffer, {
      windowDurationSec: 1.5,
      hopDurationSec: 0.75
    });

    console.log(`Detected ${chords.length} chord segments`);

    // 3. Generate LRC
    const { lrc, warnings } = generateSyncedLrcFromPlainLyrics(
      lyrics,
      chords,
      {
        title: 'My Song',
        artist: 'My Artist',
        album: 'My Album'
      },
      {
        timingStrategy: 'exponential',
        linesPerMinute: 3
      }
    );

    // 4. Show warnings
    if (warnings) {
      warnings.forEach(w => console.warn('⚠️', w));
    }

    // 5. Save LRC
    const blob = new Blob([lrc], { type: 'text/plain' });
    downloadFile(blob, 'song.lrc');

    console.log('✓ LRC file created successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}
```

### Example 2: React Component with State Management

```typescript
import { useLyricsChordSync } from '@/hooks/useLyricsChordSync';

function LyricsEditor() {
  const [syncState, actions] = useLyricsChordSync({
    initialLyrics: '',
    metadata: {
      title: 'Untitled',
      artist: 'Unknown'
    },
    timingStrategy: 'uniform',
    linesPerMinute: 3
  });

  const handleFile = async (file: File) => {
    const text = await file.text();
    actions.updateLyrics(text);
  };

  const handleChordsDetected = async (audioFile: File) => {
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioContext = new (window.AudioContext || 
                            (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const chords = analyzeChordsDSP(audioBuffer);
    actions.applyDetectedChords(chords);
  };

  const exportLrc = () => {
    const blob = new Blob([syncState.lrc], { 
      type: 'text/plain;charset=utf-8' 
    });
    downloadFile(blob, 'song.lrc');
  };

  const changeTiming = (strategy) => {
    actions.setTimingStrategy(strategy);
  };

  return (
    <div className="editor">
      <h1>Lyrics Sync & Chord Editor</h1>

      <section className="input">
        <h2>Input</h2>
        <textarea
          placeholder="Paste plain lyrics here..."
          value={syncState.plainLyrics}
          onChange={e => actions.updateLyrics(e.target.value)}
        />
        <label>
          Or load from file:
          <input 
            type="file" 
            accept=".txt" 
            onChange={e => e.target.files && handleFile(e.target.files[0])}
          />
        </label>
      </section>

      <section className="controls">
        <h2>Chord Detection</h2>
        <label>
          Load audio file:
          <input 
            type="file" 
            accept="audio/*" 
            onChange={e => e.target.files && handleChordsDetected(e.target.files[0])}
          />
        </label>
        {syncState.isLoading && <p>Processing...</p>}
      </section>

      <section className="preview">
        <h2>Preview with Chords</h2>
        <pre>{syncState.lyricsWithChords}</pre>
      </section>

      <section className="settings">
        <h2>Timing Strategy</h2>
        <select 
          value={syncState.timingStrategy}
          onChange={e => changeTiming(e.target.value as any)}
        >
          <option value="uniform">Uniform (Equal syllables)</option>
          <option value="exponential">Exponential (Natural rhythm)</option>
          <option value="phonetic">Phonetic (Language-based)</option>
        </select>
      </section>

      <section className="output">
        <h2>LRC Output</h2>
        <textarea 
          value={syncState.lrc} 
          readOnly 
          rows={15}
        />
        <button onClick={exportLrc}>Download LRC</button>
      </section>

      {syncState.warnings && (
        <section className="warnings">
          <h3>⚠️ Warnings</h3>
          <ul>
            {syncState.warnings.map(w => <li key={w}>{w}</li>)}
          </ul>
        </section>
      )}

      {syncState.error && (
        <section className="error">
          <h3>❌ Error</h3>
          <p>{syncState.error}</p>
        </section>
      )}
    </div>
  );
}
```

## Best Practices

1. **Always validate input** - Check lyrics and audio before processing
2. **Handle errors gracefully** - Wrap operations in try-catch
3. **Show user feedback** - Display warnings and progress
4. **Test syllabification** - Manually check unusual words
5. **Verify chord positioning** - Compare with audio for accuracy
6. **Use appropriate strategy** - Match timing strategy to use case
7. **Cache results** - Don't re-process identical lyrics/chords
8. **Monitor performance** - Track processing time for large files

## See Also

- [Technical Documentation](./LYRICS_SYNC_TECHNICAL.md) - Deep dive into algorithms
- [Integration Example](./INTEGRATION_EXAMPLE.ts) - Code examples
- [Chord Detection API](../src/lib/audio/chords.ts) - Chord detection details
