import React, { useState } from 'react';
import {
  ArrowLeft,
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
  exportSongbookToPdfFile
} from '../utils/songbookPdf';
import { siteMetadata } from '../utils/siteConfig';
import { useAppNavigation } from '../context/NavigationContext';

interface SongbookPageProps {
  songs: Song[];
  isAuthor?: boolean;
}

export const SongbookPage: React.FC<SongbookPageProps> = ({
  songs,
  isAuthor = false
}) => {
  const { goBack } = useAppNavigation();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
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

  const selectedSongs = songs.filter(s => selectedIds.includes(s.id));

  const handleSelectAll = () => {
    setSelectedIds(songs.map(s => s.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleToggleSong = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    if (selectedSongs.length === 0) return;
    setIsPrinting(true);
    setFeedbackMessage('Preparando edición atril...');

    setTimeout(() => {
      exportSongbookToAtrilPrint(selectedSongs, {
        title: siteMetadata.name,
        subtitle: siteMetadata.subtitle,
        author: 'Tony',
        includeCover,
        includeIndex,
        includeNotes,
        showChords,
        chordPosition,
        accidentalPreference,
        fontSize
      });
      setIsPrinting(false);
      setFeedbackMessage(null);
    }, 150);
  };

  const handleExportPdf = async () => {
    if (selectedSongs.length === 0) return;
    setIsExportingPdf(true);
    setFeedbackMessage('Generando archivo PDF...');

    try {
      await exportSongbookToPdfFile(selectedSongs, {
        title: siteMetadata.name,
        subtitle: siteMetadata.subtitle,
        author: 'Tony',
        includeCover,
        includeIndex,
        includeNotes,
        showChords,
        chordPosition,
        accidentalPreference,
        fontSize
      });
      setFeedbackMessage('PDF generado con éxito');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      console.error('Error exportando PDF:', err);
      setFeedbackMessage('Error al generar PDF. Prueba con la opción Imprimir.');
      setTimeout(() => setFeedbackMessage(null), 4000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => goBack({ name: 'catalog' })}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al catálogo</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={selectedSongs.length === 0 || isExportingPdf}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <FileDown className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Descargar PDF</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={selectedSongs.length === 0 || isPrinting}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF Atril</span>
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1">
          Edición Impresa de Escenario
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
          Cancionero para Atril (A4 / PDF)
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Genera un cuaderno completo o libreto con portada, índice alfabético y fichas de canciones con acordes grandes y saltos de página limpios.
        </p>
      </div>

      {feedbackMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs font-medium text-[var(--accent-primary)]">
          {feedbackMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Left: Song Selection List */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Music className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Selección de Canciones</span>
              <span className="text-xs font-mono font-normal text-[var(--text-muted)]">
                ({selectedSongs.length} de {songs.length})
              </span>
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                Todas
              </button>
              <span className="text-[var(--text-muted)]">·</span>
              <button
                onClick={handleDeselectAll}
                className="text-xs text-[var(--text-secondary)] hover:underline cursor-pointer"
              >
                Ninguna
              </button>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] max-h-[550px] overflow-y-auto pr-2">
            {songs.map(song => {
              const isSelected = selectedIds.includes(song.id);
              return (
                <label
                  key={song.id}
                  className="py-2.5 px-2 hover:bg-[var(--bg-surface-subtle)] rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSong(song.id)}
                      className="rounded text-[var(--accent-primary)] accent-[var(--accent-primary)]"
                    />
                    <div className="truncate">
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {song.title}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-2">
                        {song.key && <span className="font-mono">[{song.key}]</span>}
                        {song.year && <span>{song.year}</span>}
                        {song.status !== 'published' && (
                          <span className="text-amber-500 font-mono">({song.status})</span>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Right: Layout & Formatting Options */}
        <div className="space-y-6">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Opciones del Libreto</span>
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[var(--text-secondary)]">Incluir Portada de Cancionero</span>
                <input
                  type="checkbox"
                  checked={includeCover}
                  onChange={(e) => setIncludeCover(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[var(--text-secondary)]">Incluir Índice de Contenidos</span>
                <input
                  type="checkbox"
                  checked={includeIndex}
                  onChange={(e) => setIncludeIndex(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[var(--text-secondary)]">Mostrar Acordes en Letras</span>
                <input
                  type="checkbox"
                  checked={showChords}
                  onChange={(e) => setShowChords(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[var(--text-secondary)]">Incluir Notas de Composición</span>
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
              </label>
            </div>

            {showChords && (
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3 text-xs">
                <div>
                  <span className="block text-[var(--text-muted)] mb-1">Posición de acordes:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChordPosition('above')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                        chordPosition === 'above'
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Sobre la letra
                    </button>
                    <button
                      type="button"
                      onClick={() => setChordPosition('inline')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                        chordPosition === 'inline'
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      En línea [Am]
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-[var(--text-muted)] mb-1">Alteraciones:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccidentalPreference('sharps')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono border text-center transition-colors cursor-pointer ${
                        accidentalPreference === 'sharps'
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Sostenidos (#)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccidentalPreference('flats')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono border text-center transition-colors cursor-pointer ${
                        accidentalPreference === 'flats'
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Bemoles (b)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
