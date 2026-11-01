import { Song } from '../types/song';
import { AccidentalPreference } from './markdownParser';
import {
  SongbookExportOptions,
  exportSongbookToAtrilPrint,
  exportSingleSongToAtrilPrint,
  exportSongbookToPdfFile,
  generateSongbookHtml
} from './songbookPdf';

export interface PdfExportOptions {
  showChords?: boolean;
  semitones?: number;
  chordPosition?: 'above' | 'inline';
  accidentalPreference?: AccidentalPreference;
  fontSize?: 'sm' | 'base' | 'lg';
  includeNotes?: boolean;
}

/**
 * Generate and download an optimized, high-contrast, print-ready PDF for song lyrics.
 * Designed with pure white canvas, serif typography, structured metadata, and clean chord notation.
 */
export function exportSongToPdf(song: Song, options: PdfExportOptions = {}): void {
  const {
    showChords = true,
    semitones = 0,
    chordPosition = 'above',
    accidentalPreference = 'sharps',
    fontSize = 'base',
    includeNotes = true
  } = options;

  exportSongbookToPdfFile([song], {
    showChords,
    chordPosition,
    accidentalPreference,
    defaultSemitones: semitones,
    fontSize,
    includeNotes,
    includeCover: false,
    includeIndex: false
  });
}

/**
 * Re-export complete songbook export functions for atril and multi-song books
 */
export {
  exportSongbookToAtrilPrint,
  exportSingleSongToAtrilPrint,
  exportSongbookToPdfFile,
  generateSongbookHtml
};
export type { SongbookExportOptions };
