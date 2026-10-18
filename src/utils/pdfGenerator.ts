import { jsPDF } from 'jspdf';
import { Song } from '../types/song';
import { transposeChord, transposeLyrics } from './markdownParser';

interface PdfExportOptions {
  showChords?: boolean;
  semitones?: number;
}

/**
 * Generate and download an optimized, high-contrast, print-ready PDF for song lyrics.
 * Designed with pure white canvas, serif typography, structured metadata, and clean chord notation.
 */
export function exportSongToPdf(song: Song, options: PdfExportOptions = {}): void {
  const { showChords = true, semitones = 0 } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Active key
  const activeKey = transposeChord(song.key, semitones);
  const rawLyrics = transposeLyrics(song.lyrics, semitones);

  // Helper to check for page break
  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin - 15) {
      doc.addPage();
      cursorY = margin;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Tony · Cancionero & Archivo Musical de Autor', margin, cursorY);
    doc.text(`${song.title} (${activeKey})`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 8;
  };

  // 1. First Page Header
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(115, 115, 115);
  doc.text('CANCIONERO DE AUTOR · LETRA & CIFRADO', margin, cursorY);
  cursorY += 7;

  // Song Title (Serif, bold, dark)
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(25, 25, 25);
  doc.text(song.title, margin, cursorY);
  cursorY += 7;

  // Subtitle / Genre & Year
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`${song.genre} · Año ${song.year}`, margin, cursorY);
  cursorY += 6;

  // 2. Metadata Box for Musicians (Atril)
  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(248, 248, 248);
  doc.rect(margin, cursorY, contentWidth, 14, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);

  const colWidth = contentWidth / 4;
  const metaY = cursorY + 5;
  const valueY = cursorY + 10;

  // Col 1: Tono
  doc.setFont('helvetica', 'bold');
  doc.text('TONALIDAD', margin + 3, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(semitones === 0 ? activeKey : `${activeKey} (${semitones > 0 ? `+${semitones}` : semitones})`, margin + 3, valueY);

  // Col 2: Afinación
  doc.setFont('helvetica', 'bold');
  doc.text('AFINACIÓN', margin + colWidth, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(song.tuning || 'Estándar (EADGBE)', margin + colWidth, valueY);

  // Col 3: Compás
  doc.setFont('helvetica', 'bold');
  doc.text('COMPÁS', margin + colWidth * 2, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(song.timeSignature || '4/4', margin + colWidth * 2, valueY);

  // Col 4: Tempo
  doc.setFont('helvetica', 'bold');
  doc.text('TEMPO', margin + colWidth * 3, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(song.tempo ? `${song.tempo} BPM` : 'Libre', margin + colWidth * 3, valueY);

  cursorY += 20;

  // 3. Lyrics and Chords Rendering
  const lines = rawLyrics.split('\n');

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Section header (## Estrofa, ## Estribillo, ## Puente, etc.)
    if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
      const headerText = trimmed.replace(/^#+\s*/, '').toUpperCase();
      ensureSpace(14);
      cursorY += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(180, 83, 9); // dark amber for clean contrast on white
      doc.text(headerText, margin, cursorY);
      cursorY += 2;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, cursorY, margin + doc.getTextWidth(headerText), cursorY);
      cursorY += 5;
      return;
    }

    // Empty line / paragraph gap
    if (!trimmed) {
      cursorY += 3.5;
      return;
    }

    if (showChords && /\[[A-G][#b]?[^\]]*\]/.test(line)) {
      // Split by chords
      const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);
      let posX = margin;

      parts.forEach((part) => {
        if (part.startsWith('[') && part.endsWith(']')) {
          const chord = part.slice(1, -1);
          const chordWidth = doc.getTextWidth(chord) + 1.5;
          if (posX + chordWidth > pageWidth - margin && posX > margin) {
            ensureSpace(7);
            cursorY += 6;
            posX = margin;
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(180, 83, 9); // Amber print chord
          doc.text(chord, posX, cursorY - 1);
          posX += chordWidth;
        } else if (part) {
          doc.setFont('times', 'normal');
          doc.setFontSize(10.5);
          doc.setTextColor(30, 30, 30);
          
          const words = part.split(' ');
          words.forEach((word, wIdx) => {
            const wordText = wIdx === 0 ? word : ' ' + word;
            const wWidth = doc.getTextWidth(wordText);
            if (posX + wWidth > pageWidth - margin && posX > margin) {
              ensureSpace(7);
              cursorY += 6;
              posX = margin;
            }
            doc.text(wordText, posX, cursorY);
            posX += wWidth;
          });
        }
      });
      cursorY += 6;
    } else {
      // Plain text lyric line without chords
      const cleanLine = line.replace(/\[[^\]]+\]/g, '');
      doc.setFont('times', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 30, 30);
      const splitLines = doc.splitTextToSize(cleanLine, contentWidth);
      splitLines.forEach((sLine: string) => {
        ensureSpace(6);
        doc.text(sLine, margin, cursorY);
        cursorY += 5.5;
      });
    }
  });

  // 4. Composition Notes (if any)
  if (song.notes) {
    ensureSpace(25);
    cursorY += 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    doc.text('NOTAS DE COMPOSICIÓN & ARREGLOS', margin, cursorY);
    cursorY += 5;

    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 70, 70);
    const splitNotes = doc.splitTextToSize(song.notes, contentWidth);
    doc.text(splitNotes, margin, cursorY);
  }

  // 5. Page numbering footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Página ${i} de ${totalPages} · Cancionero de Autor`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Trigger file download
  const cleanTitle = song.title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-_]/g, '').trim();
  doc.save(`${cleanTitle} - Letra y Acordes.pdf`);
}
