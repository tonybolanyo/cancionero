import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Printer,
  FileDown,
  Check,
  CheckSquare,
  Square,
  Music,
  Settings2,
  Sparkles,
  Info
} from 'lucide-react';
import { Song } from '../types/song';
import { AccidentalPreference } from '../utils/markdownParser';
import {
  exportSongbookToAtrilPrint,
  exportSongbookToPdfFile,
  SongbookExportOptions
} from '../utils/songbookPdf';
import { siteMetadata } from '../utils/siteConfig';

interface SongbookExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  isAuthor?: boolean;
}

export const SongbookExportModal: React.FC<SongbookExportModalProps> = ({
  isOpen,
  onClose,
  songs,
  isAuthor = false
}) => {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    // Default to published songs, or all if none published
    const published = songs.filter(s => s.status === 'published').map(s => s.id);
    return published.length > 0 ? published : songs.map(s => s.id);
  });

  // Options state
  const [showChords, setShowChords] = useState<boolean>(true);
  const [chordPosition, setChordPosition] = useState<'above' | 'inline'>('above');
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');
  const [includeCover, setIncludeCover] = useState<boolean>(true);
  const [includeIndex, setIncludeIndex] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Loading/feedback states
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedSongs = songs.filter(s => selectedIds.includes(s.id));

  const toggleSelectSong = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(songs.map(s => s.id));
  };

  const selectPublished = () => {
    setSelectedIds(songs.filter(s => s.status === 'published').map(s => s.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const getExportOptions = (): SongbookExportOptions => ({
    title: siteMetadata.name || 'Cancionero de Versos Perdidos',
    subtitle: siteMetadata.subtitle || 'Letras, acordes y notas de ensayo para atril',
    author: 'Tony',
    showChords,
    chordPosition,
    accidentalPreference,
    fontSize,
    includeCover: selectedSongs.length > 1 && includeCover,
    includeIndex: selectedSongs.length > 1 && includeIndex,
    includeNotes
  });

  const handlePrintAtril = async () => {
    if (selectedSongs.length === 0) return;
    try {
      setIsPrinting(true);
      await exportSongbookToAtrilPrint(selectedSongs, getExportOptions());
      setFeedbackMessage('¡Ventana de impresión para atril iniciada!');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      console.error('Error al imprimir cancionero:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (selectedSongs.length === 0) return;
    try {
      setIsExportingPdf(true);
      exportSongbookToPdfFile(selectedSongs, getExportOptions());
      setFeedbackMessage('¡Archivo PDF del cancionero generado con éxito!');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      console.error('Error al generar PDF del cancionero:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden animate-fadeIn">
      <div className="relative w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                  Exportar Cancionero para Atril (PDF)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                  A4 / Atril
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Genera un libro imprimible con portada, índice armónico y formato de alta visibilidad para músicos.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
            title="Cerrar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Two columns on wide displays */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Song Selection (col-span-7) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div>
                <h4 className="font-semibold text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)]">
                  Canciones a Incluir ({selectedSongs.length} de {songs.length})
                </h4>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[var(--accent-primary)] hover:underline cursor-pointer font-medium"
                >
                  Todas
                </button>
                <span className="text-[var(--text-muted)]">·</span>
                <button
                  type="button"
                  onClick={selectPublished}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Solo editadas
                </button>
                <span className="text-[var(--text-muted)]">·</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                >
                  Deseleccionar
                </button>
              </div>
            </div>

            {/* Song Checkbox List */}
            <div className="overflow-y-auto max-h-[360px] sm:max-h-[420px] space-y-1.5 pr-1 divide-y divide-[var(--border-subtle)]/40">
              {songs.map((song, idx) => {
                const isSelected = selectedIds.includes(song.id);
                return (
                  <div
                    key={song.id}
                    onClick={() => toggleSelectSong(song.id)}
                    className={`pt-1.5 first:pt-0 flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent-subtle)]/50 border border-[var(--accent-border)]'
                        : 'hover:bg-[var(--bg-surface-subtle)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="text-[var(--accent-primary)] shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 fill-[var(--accent-subtle)]" />
                        ) : (
                          <Square className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)] w-5 text-right shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-serif font-semibold text-[var(--text-primary)] block truncate">
                          {song.title}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                          <span>{song.genre}</span>
                          <span>·</span>
                          <span className="font-mono">{song.timeSignature || '4/4'}</span>
                          {song.tempo && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{song.tempo} BPM</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-semibold bg-[var(--bg-surface)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                        {song.key}
                      </span>
                      {song.status !== 'published' && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          {song.status === 'draft' ? 'Borrador' : 'Privada'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Atril Configuration (col-span-5) */}
          <div className="lg:col-span-5 flex flex-col space-y-4 bg-[var(--bg-surface-subtle)]/60 p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <Settings2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <h4 className="font-semibold text-xs font-mono uppercase tracking-wider text-[var(--text-primary)]">
                Ajustes de Atril & Partitura
              </h4>
            </div>

            {/* Chords Position */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Visualización de Acordes
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChordPosition('above')}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
                    chordPosition === 'above'
                      ? 'bg-[var(--bg-modal)] border-[var(--accent-primary)] shadow-sm text-[var(--accent-primary)] font-semibold'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="block font-bold">Sobre el verso</span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Estilo partitura tradicional</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChordPosition('inline')}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
                    chordPosition === 'inline'
                      ? 'bg-[var(--bg-modal)] border-[var(--accent-primary)] shadow-sm text-[var(--accent-primary)] font-semibold'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="block font-bold">En línea [Am]</span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Formato compacto</span>
                </button>
              </div>
            </div>

            {/* Songbook Structure Elements */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Estructura del Cancionero
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeCover}
                    onChange={(e) => setIncludeCover(e.target.checked)}
                    className="rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                  />
                  <span>Incluir Portada Editorial (Título, Autor y Fecha)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeIndex}
                    onChange={(e) => setIncludeIndex(e.target.checked)}
                    className="rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                  />
                  <span>Incluir Índice Armónico (Tono, Compás y Tempo)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="rounded text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                  />
                  <span>Incluir Notas de Interpretación & Arreglos</span>
                </label>
              </div>
            </div>

            {/* Typography Scale for Music Stand */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Tamaño de Letra para Lectura a Distancia
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFontSize('sm')}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-mono transition-colors cursor-pointer ${
                    fontSize === 'sm'
                      ? 'bg-[var(--accent-primary)] text-white font-bold'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Compacta (14px)
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('base')}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-mono transition-colors cursor-pointer ${
                    fontSize === 'base'
                      ? 'bg-[var(--accent-primary)] text-white font-bold'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Atril Normal (16px)
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('lg')}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-mono transition-colors cursor-pointer ${
                    fontSize === 'lg'
                      ? 'bg-[var(--accent-primary)] text-white font-bold'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Grande (18px)
                </button>
              </div>
            </div>

            {/* Info Notice about print styles in index.css */}
            <div className="p-3 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <Info className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Estilos de Impresión index.css</span>
              </div>
              <p className="leading-relaxed">
                Utiliza tipografía editorial <em>Fraunces</em> y acordes en negrita <em>JetBrains Mono</em>, márgenes A4 exactos y saltos de página inteligentes para no partir estrofas.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-header)] backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[var(--text-muted)]">
            {feedbackMessage ? (
              <span className="text-emerald-500 font-semibold flex items-center gap-1.5 animate-fadeIn">
                <Check className="w-4 h-4" />
                {feedbackMessage}
              </span>
            ) : (
              <span>
                <strong>{selectedSongs.length}</strong> {selectedSongs.length === 1 ? 'canción lista' : 'canciones listas'} para compilar
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {/* Button 1: Download direct PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={selectedSongs.length === 0 || isExportingPdf}
              className="px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              title="Descargar archivo PDF directamente a tu ordenador o dispositivo"
            >
              <FileDown className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{isExportingPdf ? 'Generando PDF...' : 'Descargar .PDF'}</span>
            </button>

            {/* Button 2: Print Atril / Save as PDF via native print engine */}
            <button
              type="button"
              onClick={handlePrintAtril}
              disabled={selectedSongs.length === 0 || isPrinting}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              title="Abre el cuadro de diálogo del navegador con los estilos CSS de atril para imprimir o 'Guardar como PDF'"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Preparando...' : 'Imprimir / Guardar PDF (Atril)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
