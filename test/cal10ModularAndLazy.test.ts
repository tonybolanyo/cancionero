import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatFileSize,
  formatVideoTime,
  parseSongDurationSeconds,
  sanitizeVideoFilename,
  deriveVisualizerLyrics
} from '../src/lib/video/presets';
import {
  getTimelineHeight,
  computeDownsampledPeaks,
  getEffectiveDownbeats,
  findBeatStepTarget
} from '../src/lib/audio/beatTimelineRenderer';
import {
  RESOLUTION_PRESETS,
  EFFECT_OPTIONS,
  THEME_OPTIONS,
  formatFileSize as reExportedFormatFileSize
} from '../src/components/SongVideoVisualizerModal';

describe('CAL-10: Modular decomposition & React.lazy code splitting', () => {
  describe('Extracted video visualizer utilities (src/lib/video/presets.ts)', () => {
    it('formats file sizes and video timestamps cleanly', () => {
      assert.equal(formatFileSize(0), '0 KB');
      assert.equal(formatFileSize(512 * 1024), '512 KB');
      assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
      assert.equal(formatVideoTime(-2), '0:00');
      assert.equal(formatVideoTime(125), '2:05');
    });

    it('parses song durations and sanitizes output filenames', () => {
      assert.equal(parseSongDurationSeconds('03:45'), 225);
      assert.equal(parseSongDurationSeconds(undefined), 180);
      assert.equal(
        sanitizeVideoFilename('Canción de Otoño!', '1080p', 'video/webm;codecs=vp9'),
        'cancion-de-otono-visualizador-1080p.webm'
      );
      assert.equal(
        sanitizeVideoFilename('Mi Tema', '720p', 'video/mp4'),
        'mi-tema-visualizador-720p.mp4'
      );
    });

    it('derives synced lines from LRC when available or distributes plain lyrics evenly', () => {
      const lrcLines = deriveVisualizerLyrics(
        {
          id: 'test-lrc',
          title: 'Test',
          lyrics: 'Ignored raw text',
          lrc: '[00:02.50] Primer verso\n[00:08.00] Segundo verso',
          duration: '01:00'
        },
        false
      );
      assert.equal(lrcLines.length, 2);
      assert.equal(lrcLines[0].text, 'Primer verso');

      const derived = deriveVisualizerLyrics(
        {
          id: 'test-raw',
          title: 'Test Raw',
          lyrics: '## Estrofa\n[Am] En la noche clara\n[G] Cantando bajo la luna',
          duration: '01:00'
        },
        false
      );
      assert.equal(derived.length, 2);
      assert.equal(derived[0].text, 'En la noche clara');
      assert.equal(derived[1].text, 'Cantando bajo la luna');
    });

    it('preserves SongVideoVisualizerModal public re-exports for backwards compatibility', () => {
      assert.equal(reExportedFormatFileSize, formatFileSize);
      assert.ok(RESOLUTION_PRESETS['1080p']);
      assert.ok(EFFECT_OPTIONS.length >= 5);
      assert.ok(THEME_OPTIONS.length >= 6);
    });
  });

  describe('Extracted BeatTimeline renderer utilities (src/lib/audio/beatTimelineRenderer.ts)', () => {
    it('computes responsive timeline heights according to active tracks and viewport width', () => {
      assert.equal(getTimelineHeight(1920, true, true, false), 202);
      assert.equal(getTimelineHeight(1280, true, false, false), 150);
      assert.equal(getTimelineHeight(390, false, false, true), 165);
    });

    it('downsamples waveform peaks into bounded buckets', () => {
      const buffer = new Float32Array(1000);
      buffer[100] = -0.75;
      buffer[600] = 0.9;
      const peaks = computeDownsampledPeaks(buffer, 10);
      assert.equal(peaks.length, 10);
      assert.ok(peaks[1] >= 0.74);
      assert.ok(peaks[6] >= 0.89);
      assert.deepEqual(computeDownsampledPeaks(new Float32Array(0), 10), []);
    });

    it('derives effective downbeats from beat grid and finds next/prev step targets', () => {
      const downbeats = getEffectiveDownbeats(
        undefined,
        {
          bpm: 120,
          confidence: 0.9,
          beats: [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
          onsets: []
        },
        '4/4'
      );
      assert.deepEqual(downbeats, [0, 2.0]);
      assert.equal(findBeatStepTarget(downbeats, 0.5, 1), 2.0);
      assert.equal(findBeatStepTarget(downbeats, 2.1, -1), 0);
      assert.equal(findBeatStepTarget(downbeats, 3.0, -1), 2.0);
    });
  });

  describe('Code-splitting & modular decomposition invariants', () => {
    const readSrc = (relPath: string) =>
      fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf-8');

    it('AppRouter lazy-loads secondary pages inside Suspense while keeping CatalogPage eager', () => {
      const src = readSrc('src/components/routing/AppRouter.tsx');
      assert.ok(src.includes("import { CatalogPage }"), 'CatalogPage should remain eager');
      assert.ok(src.includes('lazy('), 'AppRouter must use React.lazy');
      assert.ok(src.includes('<Suspense'), 'AppRouter must wrap routes in Suspense');
      for (const page of [
        'SongEditorPage',
        'SongDetailPage',
        'AudioAnalyzerPage',
        'ScaleDictionaryPage',
        'ChordDictionaryDemoPage',
        'SongbookPage',
        'SpotifyImportPage',
        'GitSyncPage',
        'AlbumsPage'
      ]) {
        assert.ok(src.includes(`../../pages/${page}`), `Expected lazy import for ${page}`);
      }
    });

    it('AppModals and CatalogPage lazy-load heavy modal/chart bundles', () => {
      const modalsSrc = readSrc('src/components/modals/AppModals.tsx');
      assert.ok(modalsSrc.includes('lazy(') && modalsSrc.includes('<Suspense'));
      const catalogSrc = readSrc('src/pages/CatalogPage.tsx');
      assert.ok(catalogSrc.includes('lazy(') && catalogSrc.includes('SongDashboard'));
    });

    it('heavy zip/pdf libraries use dynamic import() rather than top-level static imports', () => {
      const mdParser = readSrc('src/utils/markdownParser.ts');
      assert.equal(/^import\s+JSZip\s+from\s+['"]jszip['"]/m.test(mdParser), false);
      assert.ok(mdParser.includes("import('jszip')"));

      const dbExport = readSrc('src/utils/databaseExportService.ts');
      assert.equal(/^import\s+JSZip\s+from\s+['"]jszip['"]/m.test(dbExport), false);
      assert.ok(dbExport.includes("import('jszip')"));

      const songbookPdf = readSrc('src/utils/songbookPdf.ts');
      assert.equal(/^import\s+\{\s*jsPDF\s*\}\s+from\s+['"]jspdf['"]/m.test(songbookPdf), false);
      assert.ok(songbookPdf.includes("import('jspdf')"));
    });

    it('SongEditorPage composes dedicated modular editor subcomponents', () => {
      const editorSrc = readSrc('src/pages/SongEditorPage.tsx');
      for (const subcomponent of [
        'SongExportActions',
        'LyricsChordEditor',
        'SongAudioToolsPanel',
        'SongMetadataForm'
      ]) {
        assert.ok(editorSrc.includes(subcomponent), `SongEditorPage should use ${subcomponent}`);
      }
      assert.ok(editorSrc.includes('lazy(') && editorSrc.includes('<Suspense'));
    });
  });
});
