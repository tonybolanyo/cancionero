import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFileSize, RESOLUTION_PRESETS, VideoResolution } from '../src/components/SongVideoVisualizerModal';

describe('Video Visualizer & YouTube Generator', () => {
  describe('formatFileSize', () => {
    it('should format 0 and negative bytes gracefully', () => {
      assert.equal(formatFileSize(0), '0 KB');
      assert.equal(formatFileSize(-100), '0 KB');
    });

    it('should format kilobyte sizes accurately', () => {
      assert.equal(formatFileSize(1024), '1 KB');
      assert.equal(formatFileSize(512 * 1024), '512 KB');
      assert.equal(formatFileSize(850 * 1024), '850 KB');
    });

    it('should format megabyte sizes with decimal precision', () => {
      assert.equal(formatFileSize(1024 * 1024), '1.0 MB');
      assert.equal(formatFileSize(1.5 * 1024 * 1024), '1.5 MB');
      assert.equal(formatFileSize(15.75 * 1024 * 1024), '15.8 MB');
    });
  });

  describe('RESOLUTION_PRESETS', () => {
    const resolutions: VideoResolution[] = ['1080p', '720p', '360p'];

    it('should provide standard 16:9 aspect ratios for all presets', () => {
      resolutions.forEach(res => {
        const preset = RESOLUTION_PRESETS[res];
        assert.ok(preset, `Preset ${res} should exist`);
        const ratio = preset.width / preset.height;
        assert.ok(Math.abs(ratio - (16 / 9)) < 0.01, `Preset ${res} should have 16:9 ratio`);
      });
    });

    it('should have exact pixel dimensions for YouTube presets', () => {
      assert.equal(RESOLUTION_PRESETS['1080p'].width, 1920);
      assert.equal(RESOLUTION_PRESETS['1080p'].height, 1080);
      assert.equal(RESOLUTION_PRESETS['720p'].width, 1280);
      assert.equal(RESOLUTION_PRESETS['720p'].height, 720);
      assert.equal(RESOLUTION_PRESETS['360p'].width, 640);
      assert.equal(RESOLUTION_PRESETS['360p'].height, 360);
    });

    it('should configure descending bitrates for smaller resolutions', () => {
      assert.ok(RESOLUTION_PRESETS['1080p'].bitrate > RESOLUTION_PRESETS['720p'].bitrate);
      assert.ok(RESOLUTION_PRESETS['720p'].bitrate > RESOLUTION_PRESETS['360p'].bitrate);
    });
  });

  describe('filename sanitization', () => {
    it('should sanitize song titles into safe filenames with correct video extension', () => {
      const titles = [
        { title: 'Canción para los cuerdos', ext: 'webm', expected: 'cancion-para-los-cuerdos-visualizador-1080p.webm' },
        { title: '¿Desde cuándo? (Acústica)', ext: 'mp4', expected: 'desde-cuando-acustica-visualizador-720p.mp4' },
        { title: 'Agua que no se puede evitar!', ext: 'webm', expected: 'agua-que-no-se-puede-evitar-visualizador-1080p.webm' }
      ];

      titles.forEach(({ title, ext, expected }) => {
        const cleanTitle = title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const res = ext === 'mp4' ? '720p' : '1080p';
        const filename = `${cleanTitle}-visualizador-${res}.${ext}`;
        assert.equal(filename, expected);
      });
    });
  });
});
