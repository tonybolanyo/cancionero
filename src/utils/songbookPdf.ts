import { jsPDF } from 'jspdf';
import { Song } from '../types/song';
import {
  transposeChord,
  transposeLyrics,
  parseLyricLine,
  AccidentalPreference
} from './markdownParser';
import { siteMetadata } from './siteConfig';

export interface SongbookExportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  showChords?: boolean;
  chordPosition?: 'above' | 'inline';
  accidentalPreference?: AccidentalPreference;
  semitonesMap?: Record<string, number>;
  defaultSemitones?: number;
  fontSize?: 'sm' | 'base' | 'lg';
  includeCover?: boolean;
  includeIndex?: boolean;
  includeNotes?: boolean;
  includeDate?: boolean;
}

/**
 * Escapes HTML characters safely for printable template generation
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates an HTML document styled with the exact atril print CSS from index.css.
 * Designed for music stands (Atril): high contrast, A4 portrait, non-breaking verses,
 * and clear typography (Fraunces serif, JetBrains Mono chords).
 */
export function generateSongbookHtml(
  songs: Song[],
  options: SongbookExportOptions = {}
): string {
  const {
    title = siteMetadata.name || 'Cancionero de Versos Perdidos',
    subtitle = siteMetadata.subtitle || 'Letras, acordes y notas de ensayo para atril',
    author = 'Tony',
    showChords = true,
    chordPosition = 'above',
    accidentalPreference = 'sharps',
    semitonesMap = {},
    defaultSemitones = 0,
    fontSize = 'base',
    includeCover = songs.length > 1,
    includeIndex = songs.length > 1,
    includeNotes = true,
    includeDate = true
  } = options;

  const fontScale = fontSize === 'sm' ? '0.9' : fontSize === 'lg' ? '1.12' : '1';
  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Build Table of Contents HTML
  let tocHtml = '';
  if (includeIndex) {
    const tocRows = songs
      .map((song, idx) => {
        const semitones = semitonesMap[song.id] ?? defaultSemitones;
        const currentKey = transposeChord(song.key, semitones, accidentalPreference);
        return `
        <div class="musician-toc-row">
          <span class="musician-toc-num">${idx + 1}.</span>
          <span class="musician-toc-song-title">${escapeHtml(song.title)}</span>
          <span class="musician-toc-dots"></span>
          <span class="musician-toc-meta">
            ${escapeHtml(currentKey)} · ${escapeHtml(song.timeSignature || '4/4')}${
          song.tempo ? ` · ${song.tempo} BPM` : ''
        }
          </span>
        </div>
      `;
      })
      .join('\n');

    tocHtml = `
      <div class="musician-print-sheet musician-toc-page">
        <div class="musician-toc-header">
          <span class="musician-song-kicker">REPERTORIO & ESTRUCTURA ARMÓNICA</span>
          <h2 class="musician-toc-title">Índice del Cancionero</h2>
        </div>
        <div class="musician-toc-list">
          ${tocRows}
        </div>
        <div class="musician-toc-footer">
          <span>${songs.length} canciones catalogadas para directo y atril</span>
          <span>Edición de Autor · ${escapeHtml(author)}</span>
        </div>
      </div>
    `;
  }

  // Build Songs HTML
  const songsHtml = songs
    .map((song, songIdx) => {
      const semitones = semitonesMap[song.id] ?? defaultSemitones;
      const currentKey = transposeChord(song.key, semitones, accidentalPreference);
      const displayedLyrics = transposeLyrics(song.lyrics, semitones, accidentalPreference);

      // Parse verses and sections
      const lines = displayedLyrics.split('\n');
      const sections: { title?: string; isChorus?: boolean; lines: string[] }[] = [];
      let currentSection: { title?: string; isChorus?: boolean; lines: string[] } = { lines: [] };

      lines.forEach((line) => {
        if (line.startsWith('##') || line.startsWith('#')) {
          if (currentSection.lines.length > 0 || currentSection.title) {
            sections.push(currentSection);
          }
          const secTitle = line.replace(/^#+\s*/, '').trim();
          const isChorus =
            secTitle.toLowerCase().includes('estribillo') ||
            secTitle.toLowerCase().includes('coro');
          currentSection = { title: secTitle, isChorus, lines: [] };
        } else {
          currentSection.lines.push(line);
        }
      });
      if (currentSection.lines.length > 0 || currentSection.title) {
        sections.push(currentSection);
      }

      const sectionsHtml = sections
        .map((sec) => {
          const headerHtml = sec.title
            ? `
            <div class="musician-print-section-header">
              <span class="musician-section-badge ${sec.isChorus ? 'is-chorus' : ''}">
                ${sec.isChorus ? `[ ${escapeHtml(sec.title.toUpperCase())} ]` : escapeHtml(sec.title.toUpperCase())}
              </span>
            </div>
          `
            : '';

          const linesHtml = sec.lines
            .map((line) => {
              if (!line.trim()) {
                return '<div class="musician-empty-gap"></div>';
              }

              if (showChords && /\[([A-G][#b]?[^\]]*)\]/.test(line)) {
                if (chordPosition === 'above') {
                  const segments = parseLyricLine(line);
                  const segsHtml = segments
                    .map((segment) => {
                      const hasChord = !!segment.chord;
                      return `
                      <span class="musician-chord-segment">
                        <span class="musician-chord-text ${hasChord ? '' : 'is-spacer'}">
                          ${hasChord && segment.chord ? escapeHtml(segment.chord) : '&nbsp;'}
                        </span>
                        <span class="musician-lyric-text">${escapeHtml(segment.text || (hasChord ? '\u00A0' : ''))}</span>
                      </span>
                    `;
                    })
                    .join('');

                  return `<div class="musician-line-above">${segsHtml}</div>`;
                }

                // Inline chords
                const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);
                const inlinePartsHtml = parts
                  .map((part) => {
                    if (part.startsWith('[') && part.endsWith(']')) {
                      return `<strong class="musician-chord-inline">${escapeHtml(part.slice(1, -1))}</strong>`;
                    }
                    return `<span class="musician-lyric-text">${escapeHtml(part)}</span>`;
                  })
                  .join('');

                return `<p class="musician-line-inline">${inlinePartsHtml}</p>`;
              }

              const cleanLine = line.replace(/\[[^\]]+\]/g, '');
              return `<p class="musician-line-plain">${escapeHtml(cleanLine)}</p>`;
            })
            .join('\n');

          return `
          <div class="musician-print-section">
            ${headerHtml}
            <div class="musician-section-body">
              ${linesHtml}
            </div>
          </div>
        `;
        })
        .join('\n');

      const notesHtml =
        includeNotes && song.notes
          ? `
          <div class="musician-notes-box">
            <h4 class="musician-notes-title">Notas de Interpretación & Arreglos</h4>
            <p class="musician-notes-text">${escapeHtml(song.notes)}</p>
          </div>
        `
          : '';

      return `
        <div class="musician-print-sheet musician-song-page" data-song-id="${escapeHtml(song.id)}">
          <!-- Song Top Banner -->
          <div class="musician-song-header">
            <div class="musician-song-kicker-row">
              <span class="musician-song-kicker">CANCIONERO DE AUTOR · EDICIÓN ATRIL</span>
              <span class="musician-song-genre-year">${escapeHtml(song.genre)} · ${song.year}</span>
            </div>
            <div class="musician-song-title-row">
              <span class="musician-song-num">${songIdx + 1}.</span>
              <h1 class="musician-song-title">${escapeHtml(song.title)}</h1>
            </div>

            <!-- Musician Technical Strip -->
            <div class="musician-metadata-strip">
              <div class="musician-meta-col">
                <span class="musician-meta-label">TONO</span>
                <span class="musician-meta-val">${escapeHtml(currentKey)}${
        semitones !== 0 ? ` (${semitones > 0 ? `+${semitones}` : semitones})` : ''
      }</span>
              </div>
              <div class="musician-meta-col">
                <span class="musician-meta-label">AFINACIÓN</span>
                <span class="musician-meta-val">${escapeHtml(song.tuning || 'Estándar (EADGBE)')}</span>
              </div>
              <div class="musician-meta-col">
                <span class="musician-meta-label">COMPÁS</span>
                <span class="musician-meta-val">${escapeHtml(song.timeSignature || '4/4')}</span>
              </div>
              <div class="musician-meta-col">
                <span class="musician-meta-label">TEMPO</span>
                <span class="musician-meta-val">${song.tempo ? `${song.tempo} BPM` : 'Libre'}</span>
              </div>
            </div>
          </div>

          <!-- Lyrics and Chords Content -->
          <div class="musician-lyrics-flow">
            ${sectionsHtml}
          </div>

          ${notesHtml}

          <!-- Song Page Footer -->
          <div class="musician-song-footer">
            <span>${escapeHtml(song.title)} · ${escapeHtml(author)}</span>
            <span>Cancionero de Versos Perdidos · Edición Atril</span>
          </div>
        </div>
      `;
    })
    .join('\n');

  // Build Cover Page HTML
  let coverHtml = '';
  if (includeCover) {
    coverHtml = `
      <div class="musician-print-sheet musician-cover-page">
        <div class="musician-cover-kicker">ARCHIVO & REPERTORIO MUSICAL</div>
        <h1 class="musician-cover-title">${escapeHtml(title)}</h1>
        <p class="musician-cover-subtitle">${escapeHtml(subtitle)}</p>
        <div class="musician-cover-divider"></div>
        <div class="musician-cover-meta">
          <p class="musician-cover-author">Composiciones y letras de <strong>${escapeHtml(author)}</strong></p>
          <p class="musician-cover-count">${songs.length} canciones con cifrado armónico y notas de ensayo</p>
          ${includeDate ? `<p class="musician-cover-date">${currentDate}</p>` : ''}
        </div>
        <div class="musician-cover-footer-note">
          Optimizado para lectura en atril, ensayos en estudio y conciertos en acústico.
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - Edición Atril</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    /* =========================================================================
       ESTILOS DE IMPRESIÓN PARA ATRIL (CANCIONERO DESIGN SYSTEM)
       Inspirado directamente en index.css para máxima nitidez y contraste.
       ========================================================================= */
    :root {
      --font-serif: "Fraunces", Georgia, Cambria, "Times New Roman", serif;
      --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
      --font-mono: "JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, monospace;
    }

    @page {
      size: A4 portrait;
      margin: 1.5cm 1.2cm 1.5cm 1.2cm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: var(--font-serif);
      font-size: calc(16px * ${fontScale});
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }

    /* Page Breaks for Multi-song Songbook */
    .musician-song-page {
      break-before: page !important;
      page-break-before: always !important;
      padding-top: 0.5cm;
    }

    .musician-song-page:first-of-type {
      break-before: auto !important;
      page-break-before: auto !important;
    }

    .musician-cover-page {
      break-after: page !important;
      page-break-after: always !important;
      min-height: 85vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 4cm 1.5cm;
      border: 4px double #111111;
      margin-bottom: 2cm;
    }

    .musician-cover-kicker {
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      font-weight: 700;
      color: #555555;
      margin-bottom: 1.2rem;
    }

    .musician-cover-title {
      font-family: var(--font-serif);
      font-size: 38px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.02em;
      color: #000000;
      margin: 0 0 1rem 0;
    }

    .musician-cover-subtitle {
      font-family: var(--font-serif);
      font-size: 18px;
      font-style: italic;
      color: #444444;
      margin: 0 0 2rem 0;
      max-width: 500px;
    }

    .musician-cover-divider {
      width: 80px;
      height: 2px;
      background: #000000;
      margin: 1.5rem 0;
    }

    .musician-cover-meta {
      font-family: var(--font-sans);
      font-size: 14px;
      color: #222222;
      line-height: 1.6;
    }

    .musician-cover-author strong {
      font-weight: 700;
    }

    .musician-cover-date {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #666666;
      margin-top: 0.8rem;
    }

    .musician-cover-footer-note {
      font-family: var(--font-sans);
      font-size: 11px;
      color: #777777;
      margin-top: 3rem;
      font-style: italic;
    }

    /* Table of Contents */
    .musician-toc-page {
      break-after: page !important;
      page-break-after: always !important;
      padding: 1cm 0 2cm 0;
    }

    .musician-toc-header {
      border-bottom: 2px solid #000000;
      padding-bottom: 0.8rem;
      margin-bottom: 1.5rem;
    }

    .musician-toc-title {
      font-family: var(--font-serif);
      font-size: 26px;
      font-weight: 800;
      margin: 0.3rem 0 0 0;
      color: #000000;
    }

    .musician-toc-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .musician-toc-row {
      display: flex;
      align-items: baseline;
      font-size: 14px;
      gap: 0.5rem;
    }

    .musician-toc-num {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      width: 24px;
      color: #555555;
      text-align: right;
      shrink: 0;
    }

    .musician-toc-song-title {
      font-family: var(--font-serif);
      font-weight: 700;
      font-size: 16px;
      color: #000000;
      white-space: nowrap;
    }

    .musician-toc-dots {
      flex: 1;
      border-bottom: 1px dotted #888888;
      margin: 0 0.4rem;
      height: 1px;
    }

    .musician-toc-meta {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: #222222;
      white-space: nowrap;
    }

    .musician-toc-footer {
      margin-top: 2rem;
      padding-top: 0.8rem;
      border-top: 1px solid #cccccc;
      display: flex;
      justify-content: space-between;
      font-family: var(--font-sans);
      font-size: 11px;
      color: #666666;
    }

    /* Song Header & Metadata Strip */
    .musician-song-header {
      border-bottom: 2px solid #000000;
      padding-bottom: 0.8rem;
      margin-bottom: 1.5rem;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    .musician-song-kicker-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #555555;
      font-weight: 700;
      margin-bottom: 0.3rem;
    }

    .musician-song-title-row {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin: 0.2rem 0 0.8rem 0;
    }

    .musician-song-num {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      color: #444444;
    }

    .musician-song-title {
      font-family: var(--font-serif);
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin: 0;
      color: #000000;
    }

    .musician-metadata-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      border-top: 1px solid #000000;
      padding-top: 0.5rem;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #000000;
    }

    .musician-meta-col {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .musician-meta-label {
      font-size: 10px;
      font-weight: 700;
      color: #555555;
      letter-spacing: 0.05em;
    }

    .musician-meta-val {
      font-weight: 700;
      color: #000000;
    }

    /* Section Control (Prevent verses breaking midway) */
    .musician-print-section {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      margin-bottom: 1.4rem;
    }

    .musician-print-section-header {
      break-after: avoid !important;
      page-break-after: avoid !important;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 3px;
      margin-bottom: 0.7rem;
    }

    .musician-section-badge {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.15em;
      color: #222222;
    }

    .musician-section-badge.is-chorus {
      color: #000000;
      font-weight: 800;
    }

    .musician-section-body {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .musician-empty-gap {
      height: 0.7rem;
    }

    /* Chords Above Lyrics (Stacked Segments) */
    .musician-line-above {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      line-height: 1;
      margin: 2px 0;
    }

    .musician-chord-segment {
      display: inline-flex;
      flex-direction: column;
      justify-content: flex-end;
      vertical-align: bottom;
    }

    .musician-chord-text {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 13px;
      line-height: 1;
      padding-bottom: 3px;
      padding-right: 4px;
      color: #000000;
    }

    .musician-chord-text.is-spacer {
      color: transparent;
      user-select: none;
    }

    .musician-lyric-text {
      font-family: var(--font-serif);
      font-size: calc(16.5px * ${fontScale});
      line-height: 1.35;
      color: #000000;
      white-space: pre;
    }

    /* Inline Chords */
    .musician-line-inline {
      margin: 4px 0;
      font-size: calc(16.5px * ${fontScale});
      line-height: 1.5;
    }

    .musician-chord-inline {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      border: 1px solid #000000;
      border-radius: 3px;
      padding: 1px 4px;
      background: #f4f4f4;
      margin: 0 3px;
      display: inline-block;
      vertical-align: 1px;
    }

    /* Plain Lyrics */
    .musician-line-plain {
      font-family: var(--font-serif);
      font-size: calc(16.5px * ${fontScale});
      line-height: 1.4;
      color: #111111;
      margin: 3px 0;
    }

    /* Composition Notes Box */
    .musician-notes-box {
      margin-top: 1.8rem;
      padding: 0.8rem 1rem;
      border: 1px solid #444444;
      background: #fafafa;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    .musician-notes-title {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #222222;
      margin: 0 0 0.4rem 0;
    }

    .musician-notes-text {
      font-family: var(--font-serif);
      font-size: 13.5px;
      font-style: italic;
      color: #333333;
      margin: 0;
      line-height: 1.5;
    }

    /* Running Song Footer */
    .musician-song-footer {
      margin-top: 2.2rem;
      padding-top: 0.5rem;
      border-top: 1px solid #cccccc;
      display: flex;
      justify-content: space-between;
      font-family: var(--font-sans);
      font-size: 10px;
      color: #777777;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body>
  ${coverHtml}
  ${tocHtml}
  ${songsHtml}
</body>
</html>`;
}

/**
 * Triggers an exact, high-contrast, vector A4 print of the songbook or single song.
 * Uses an isolated hidden iframe that renders the atril HTML and triggers window.print().
 * In all modern browsers, this opens the system print dialog allowing "Guardar como PDF"
 * with 100% crisp vector fonts, exact page breaks, and zero canvas pixelation.
 */
export function exportSongbookToAtrilPrint(
  songs: Song[],
  options: SongbookExportOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('exportSongbookToAtrilPrint requires a browser environment'));
      return;
    }

    if (songs.length === 0) {
      reject(new Error('No hay canciones seleccionadas para exportar'));
      return;
    }

    try {
      const htmlContent = generateSongbookHtml(songs, options);

      // Create an invisible sandboxed iframe
      const iframe = document.createElement('iframe');
      iframe.setAttribute('style', 'position:fixed;right:100%;bottom:100%;width:0;height:0;border:0;opacity:0;');
      iframe.setAttribute('title', 'Atril Print Frame');
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        reject(new Error('No se pudo acceder al documento del frame de impresión'));
        return;
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Wait for fonts and styles to resolve
      const triggerPrint = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            resolve();
          } catch (err) {
            reject(err);
          } finally {
            // Clean up the DOM element after printing
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 3000);
          }
        }, 350);
      };

      if (iframe.contentWindow) {
        iframe.contentWindow.onload = triggerPrint;
      } else {
        triggerPrint();
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convenience wrapper to print a single song with atril styling
 */
export function exportSingleSongToAtrilPrint(
  song: Song,
  options: SongbookExportOptions = {}
): Promise<void> {
  return exportSongbookToAtrilPrint([song], {
    includeCover: false,
    includeIndex: false,
    ...options
  });
}

/**
 * Generates and downloads a complete, print-ready PDF file for the entire Cancionero
 * using jsPDF with atril-ready formatting, cover page, table of contents, and page numbers.
 */
export function exportSongbookToPdfFile(
  songs: Song[],
  options: SongbookExportOptions = {}
): void {
  const {
    title = siteMetadata.name || 'Cancionero de Versos Perdidos',
    subtitle = siteMetadata.subtitle || 'Letras, acordes y notas de ensayo para atril',
    author = 'Tony',
    showChords = true,
    chordPosition = 'above',
    accidentalPreference = 'sharps',
    semitonesMap = {},
    defaultSemitones = 0,
    includeCover = songs.length > 1,
    includeIndex = songs.length > 1,
    includeNotes = true
  } = options;

  if (songs.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;
  let isFirstPage = true;

  const ensureSpace = (neededHeight: number, currentSongTitle?: string) => {
    if (cursorY + neededHeight > pageHeight - margin - 12) {
      doc.addPage();
      cursorY = margin;
      if (currentSongTitle) {
        doc.setFont('times', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 130);
        doc.text(`${escapeHtml(currentSongTitle)} · Edición Atril`, margin, cursorY);
        doc.text(author, pageWidth - margin, cursorY, { align: 'right' });
        cursorY += 4;
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.2);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 7;
      }
    }
  };

  // 1. Cover Page
  if (includeCover) {
    isFirstPage = false;
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(1);
    doc.rect(margin - 4, margin - 4, contentWidth + 8, pageHeight - margin * 2 + 8);
    doc.setLineWidth(0.3);
    doc.rect(margin - 2, margin - 2, contentWidth + 4, pageHeight - margin * 2 + 4);

    let coverY = 70;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text('ARCHIVO & REPERTORIO MUSICAL', pageWidth / 2, coverY, { align: 'center' });

    coverY += 12;
    doc.setFont('times', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(20, 20, 20);
    const splitTitle = doc.splitTextToSize(title, contentWidth - 20);
    doc.text(splitTitle, pageWidth / 2, coverY, { align: 'center' });

    coverY += splitTitle.length * 9 + 4;
    doc.setFont('times', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(90, 90, 90);
    const splitSub = doc.splitTextToSize(subtitle, contentWidth - 30);
    doc.text(splitSub, pageWidth / 2, coverY, { align: 'center' });

    coverY += splitSub.length * 6 + 10;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.8);
    doc.line(pageWidth / 2 - 25, coverY, pageWidth / 2 + 25, coverY);

    coverY += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(`Composiciones de ${author}`, pageWidth / 2, coverY, { align: 'center' });

    coverY += 7;
    doc.setFontSize(9.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`${songs.length} canciones con cifrado armónico para atril`, pageWidth / 2, coverY, { align: 'center' });

    coverY += 8;
    const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
    doc.text(dateStr, pageWidth / 2, coverY, { align: 'center' });

    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text('Optimizado para ensayos, conciertos y lectura a 1 metro de distancia', pageWidth / 2, pageHeight - 30, { align: 'center' });
  }

  // 2. Table of Contents
  if (includeIndex) {
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;
    cursorY = margin + 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text('REPERTORIO & ESTRUCTURA ARMÓNICA', margin, cursorY);
    cursorY += 7;

    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text('Índice del Cancionero', margin, cursorY);
    cursorY += 5;

    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.4);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 10;

    songs.forEach((song, idx) => {
      ensureSpace(10);
      const semitones = semitonesMap[song.id] ?? defaultSemitones;
      const key = transposeChord(song.key, semitones, accidentalPreference);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`${idx + 1}.`, margin, cursorY);

      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(25, 25, 25);
      doc.text(song.title, margin + 8, cursorY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const meta = `${key} · ${song.timeSignature || '4/4'}${song.tempo ? ` · ${song.tempo} BPM` : ''} · ${song.genre}`;
      doc.text(meta, pageWidth - margin, cursorY, { align: 'right' });

      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.15);
      doc.line(margin, cursorY + 2.5, pageWidth - margin, cursorY + 2.5);

      cursorY += 8;
    });
  }

  // 3. Songs Pages
  songs.forEach((song, songIdx) => {
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;
    cursorY = margin;

    const semitones = semitonesMap[song.id] ?? defaultSemitones;
    const currentKey = transposeChord(song.key, semitones, accidentalPreference);
    const displayedLyrics = transposeLyrics(song.lyrics, semitones, accidentalPreference);

    // Kicker
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`CANCIONERO DE AUTOR · PIEZA ${songIdx + 1} DE ${songs.length}`, margin, cursorY);
    doc.text(`${song.genre} · Año ${song.year}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 6;

    // Title
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text(song.title, margin, cursorY);
    cursorY += 6;

    // Metadata Strip Box
    doc.setDrawColor(190, 190, 190);
    doc.setFillColor(248, 248, 248);
    doc.rect(margin, cursorY, contentWidth, 13, 'FD');

    const colW = contentWidth / 4;
    const mY1 = cursorY + 4.5;
    const mY2 = cursorY + 9.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text('TONO', margin + 3, mY1);
    doc.text('AFINACIÓN', margin + colW + 2, mY1);
    doc.text('COMPÁS', margin + colW * 2 + 2, mY1);
    doc.text('TEMPO', margin + colW * 3 + 2, mY1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(
      semitones === 0 ? currentKey : `${currentKey} (${semitones > 0 ? `+${semitones}` : semitones})`,
      margin + 3,
      mY2
    );
    doc.setFont('helvetica', 'normal');
    doc.text(song.tuning || 'Estándar', margin + colW + 2, mY2);
    doc.text(song.timeSignature || '4/4', margin + colW * 2 + 2, mY2);
    doc.text(song.tempo ? `${song.tempo} BPM` : 'Libre', margin + colW * 3 + 2, mY2);

    cursorY += 19;

    // Render Lyrics
    const lines = displayedLyrics.split('\n');

    lines.forEach((line) => {
      const trimmed = line.trim();

      // Section header
      if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
        const secText = trimmed.replace(/^#+\s*/, '').toUpperCase();
        const isChorus = secText.includes('ESTRIBILLO') || secText.includes('CORO');
        ensureSpace(14, song.title);
        cursorY += 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(isChorus ? 20 : 70, isChorus ? 20 : 70, isChorus ? 20 : 70);
        const label = isChorus ? `[ ${secText} ]` : secText;
        doc.text(label, margin, cursorY);
        cursorY += 2;
        doc.setDrawColor(isChorus ? 40 : 180, isChorus ? 40 : 180, isChorus ? 40 : 180);
        doc.setLineWidth(isChorus ? 0.4 : 0.2);
        doc.line(margin, cursorY, margin + doc.getTextWidth(label), cursorY);
        cursorY += 5;
        return;
      }

      if (!trimmed) {
        cursorY += 3.5;
        return;
      }

      if (showChords && /\[([A-G][#b]?[^\]]*)\]/.test(line)) {
        if (chordPosition === 'above') {
          const segments = parseLyricLine(line);
          ensureSpace(12, song.title);
          let posX = margin;

          segments.forEach((seg) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            const chordText = seg.chord || '';
            const chordW = chordText ? doc.getTextWidth(chordText) + 2 : 0;

            doc.setFont('times', 'normal');
            doc.setFontSize(10.5);
            const lyricText = seg.text || '';
            const lyricW = lyricText ? doc.getTextWidth(lyricText) : 0;
            const segW = Math.max(chordW, lyricW);

            if (posX + segW > pageWidth - margin && posX > margin) {
              ensureSpace(12, song.title);
              cursorY += 8.5;
              posX = margin;
            }

            if (chordText) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8);
              doc.setTextColor(180, 83, 9); // Amber print chord
              doc.text(chordText, posX, cursorY - 1);
            }

            if (lyricText) {
              doc.setFont('times', 'normal');
              doc.setFontSize(10.5);
              doc.setTextColor(25, 25, 25);
              doc.text(lyricText, posX, cursorY + 3.8);
            }

            posX += segW;
          });

          cursorY += 8.5;
        } else {
          // Inline
          const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);
          let posX = margin;

          parts.forEach((part) => {
            if (part.startsWith('[') && part.endsWith(']')) {
              const chord = part.slice(1, -1);
              const chordW = doc.getTextWidth(chord) + 1.5;
              if (posX + chordW > pageWidth - margin && posX > margin) {
                ensureSpace(7, song.title);
                cursorY += 6;
                posX = margin;
              }
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8.5);
              doc.setTextColor(180, 83, 9);
              doc.text(chord, posX, cursorY - 1);
              posX += chordW;
            } else if (part) {
              doc.setFont('times', 'normal');
              doc.setFontSize(10.5);
              doc.setTextColor(25, 25, 25);
              const words = part.split(' ');
              words.forEach((word, wIdx) => {
                const wText = wIdx === 0 ? word : ' ' + word;
                const wW = doc.getTextWidth(wText);
                if (posX + wW > pageWidth - margin && posX > margin) {
                  ensureSpace(7, song.title);
                  cursorY += 6;
                  posX = margin;
                }
                doc.text(wText, posX, cursorY);
                posX += wW;
              });
            }
          });
          cursorY += 6;
        }
      } else {
        // Plain line
        const cleanLine = line.replace(/\[[^\]]+\]/g, '');
        doc.setFont('times', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(25, 25, 25);
        const splitLines = doc.splitTextToSize(cleanLine, contentWidth);
        splitLines.forEach((sLine: string) => {
          ensureSpace(6, song.title);
          doc.text(sLine, margin, cursorY);
          cursorY += 5.5;
        });
      }
    });

    // Notes
    if (includeNotes && song.notes) {
      ensureSpace(20, song.title);
      cursorY += 5;
      doc.setDrawColor(210, 210, 210);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('NOTAS DE INTERPRETACIÓN & ARREGLOS', margin, cursorY);
      cursorY += 4.5;

      doc.setFont('times', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      const splitNotes = doc.splitTextToSize(song.notes, contentWidth);
      doc.text(splitNotes, margin, cursorY);
    }
  });

  // 4. Page Numbering Footers
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Don't draw page number on cover
    if (includeCover && p === 1) continue;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Página ${p} de ${totalPages} · Cancionero de Autor`,
      pageWidth / 2,
      pageHeight - 9,
      { align: 'center' }
    );
  }

  // File Download
  const filename =
    songs.length === 1
      ? `${songs[0].title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-_]/g, '').trim()} - Letra y Acordes.pdf`
      : `${title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-_]/g, '').trim()} - Edicion Atril.pdf`;

  doc.save(filename);
}

/**
 * Enhanced single song export keeping backward compatibility
 */
export function exportSongToPdf(song: Song, options: SongbookExportOptions = {}): void {
  exportSongbookToPdfFile([song], {
    includeCover: false,
    includeIndex: false,
    ...options
  });
}
