import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Printer,
  FileDown,
  Music,
  Settings2,
  ArrowUp,
  ArrowDown,
  Play,
  BookmarkPlus,
  Trash2,
  Clock,
  ListMusic
} from 'lucide-react';
import { Song } from '../types/song';
import { AccidentalPreference } from '../utils/markdownParser';
import {
  exportSongbookToAtrilPrint,
  exportSongbookToPdfFile
} from '../utils/songbookPdf';
import { siteMetadata } from '../utils/siteConfig';
import { useAppNavigation } from '../context/NavigationContext';
import { StageModeOverlay } from '../components/StageModeOverlay';

interface SongbookPageProps {
  songs: Song[];
  isAuthor?: boolean;
}

interface SavedSetlist {
  id: string;
  name: string;
  songIds: string[];
  cues: Record<string, string>;
  updatedAt: string;
}

const SETLISTS_STORAGE_KEY = 'cancionero_saved_setlists';

function parseDurationSeconds(durationStr?: string): number {
  if (!durationStr) return 210; // 3:30 fallback
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return Math.max(30, parts[0] * 60 + parts[1]);
  }
  return 210;
}

function formatTotalDuration(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} h ${m} min`;
  }
  return `~${mins} min`;
}

export const SongbookPage: React.FC<SongbookPageProps> = ({
  songs
}) => {
  const { goBack } = useAppNavigation();

  // Ordered selection state (preserves setlist sequence)
  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    const published = songs.filter(s => s.status === 'published').map(s => s.id);
    return published.length > 0 ? published : songs.map(s => s.id);
  });

  // Per-song stage cues (e.g. "Subir cejilla traste 2", "Cambiar a Drop D")
  const [cuesBySongId, setCuesBySongId] = useState<Record<string, string>>({});

  // Saved named setlists in localStorage
  const [savedSetlists, setSavedSetlists] = useState<SavedSetlist[]>(() => {
    try {
      const raw = localStorage.getItem(SETLISTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [setlistNameInput, setSetlistNameInput] = useState<string>('');
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);

  // Stage Mode overlay state
  const [isStageModeOpen, setIsStageModeOpen] = useState<boolean>(false);

  // Options state
  const [showChords, setShowChords] = useState<boolean>(true);
  const [chordPosition, setChordPosition] = useState<'above' | 'inline'>('above');
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');
  const [includeCover, setIncludeCover] = useState<boolean>(true);
  const [includeIndex, setIncludeIndex] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);

  // Loading/feedback states
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(savedSetlists));
    } catch {
      // ignore storage errors
    }
  }, [savedSetlists]);

  const songById = useMemo(() => {
    const map = new Map<string, Song>();
    songs.forEach(s => map.set(s.id, s));
    return map;
  }, [songs]);

  const orderedSelectedSongs = useMemo(() => {
    return orderedIds
      .map(id => songById.get(id))
      .filter((s): s is Song => Boolean(s));
  }, [orderedIds, songById]);

  const totalDurationLabel = useMemo(() => {
    const totalSec = orderedSelectedSongs.reduce(
      (sum, s) => sum + parseDurationSeconds(s.duration),
      0
    );
    return formatTotalDuration(totalSec);
  }, [orderedSelectedSongs]);

  const handleSelectAll = () => {
    setOrderedIds(songs.map(s => s.id));
  };

  const handleDeselectAll = () => {
    setOrderedIds([]);
  };

  const handleToggleSong = (id: string) => {
    setOrderedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleMoveSong = (index: number, direction: -1 | 1) => {
    setOrderedIds(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleCueChange = (songId: string, cue: string) => {
    setCuesBySongId(prev => ({
      ...prev,
      [songId]: cue
    }));
  };

  const handleSaveSetlist = () => {
    if (orderedSelectedSongs.length === 0) return;
    const trimmedName = setlistNameInput.trim() || `Repertorio ${savedSetlists.length + 1}`;
    const newEntry: SavedSetlist = {
      id: activeSetlistId || `setlist-${Date.now()}`,
      name: trimmedName,
      songIds: orderedSelectedSongs.map(s => s.id),
      cues: cuesBySongId,
      updatedAt: new Date().toISOString()
    };

    setSavedSetlists(prev => {
      const existsIdx = prev.findIndex(item => item.id === newEntry.id);
      if (existsIdx >= 0) {
        const updated = [...prev];
        updated[existsIdx] = newEntry;
        return updated;
      }
      return [newEntry, ...prev];
    });
    setActiveSetlistId(newEntry.id);
    setSetlistNameInput(trimmedName);
    setFeedbackMessage(`Repertorio "${trimmedName}" guardado en este navegador.`);
    setTimeout(() => setFeedbackMessage(null), 2600);
  };

  const handleLoadSetlist = (setlist: SavedSetlist) => {
    const validIds = setlist.songIds.filter(id => songById.has(id));
    setOrderedIds(validIds);
    setCuesBySongId(setlist.cues || {});
    setActiveSetlistId(setlist.id);
    setSetlistNameInput(setlist.name);
    setFeedbackMessage(`Repertorio "${setlist.name}" cargado (${validIds.length} temas).`);
    setTimeout(() => setFeedbackMessage(null), 2400);
  };

  const handleDeleteSetlist = (id: string) => {
    setSavedSetlists(prev => prev.filter(item => item.id !== id));
    if (activeSetlistId === id) {
      setActiveSetlistId(null);
    }
  };

  const handlePrint = () => {
    if (orderedSelectedSongs.length === 0) return;
    setIsPrinting(true);
    setFeedbackMessage('Preparando edición atril...');

    setTimeout(() => {
      exportSongbookToAtrilPrint(orderedSelectedSongs, {
        title: siteMetadata.name,
        subtitle: siteMetadata.subtitle,
        author: 'Tony',
        includeCover,
        includeIndex,
        includeNotes,
        showChords,
        chordPosition,
        accidentalPreference,
        fontSize: 'base'
      });
      setIsPrinting(false);
      setFeedbackMessage(null);
    }, 150);
  };

  const handleExportPdf = async () => {
    if (orderedSelectedSongs.length === 0) return;
    setIsExportingPdf(true);
    setFeedbackMessage('Generando archivo PDF...');

    try {
      await exportSongbookToPdfFile(orderedSelectedSongs, {
        title: siteMetadata.name,
        subtitle: siteMetadata.subtitle,
        author: 'Tony',
        includeCover,
        includeIndex,
        includeNotes,
        showChords,
        chordPosition,
        accidentalPreference,
        fontSize: 'base'
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => goBack({ name: 'catalog' })}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al catálogo</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsStageModeOpen(true)}
            disabled={orderedSelectedSongs.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-40 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Iniciar Directo (Modo Escenario)</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={orderedSelectedSongs.length === 0 || isExportingPdf}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-lg transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
          >
            <FileDown className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Descargar PDF</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={orderedSelectedSongs.length === 0 || isPrinting}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-40 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF Atril</span>
          </button>
        </div>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1">
            Edición Impresa y Repertorio de Directo
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            Cancionero y Setlists de Concierto
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Ordena tu repertorio, añade avisos de cambio entre temas, lánzalo en Modo Escenario o exporta el libreto A4/PDF.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 py-2 rounded-xl shrink-0">
          <span>
            <strong className="text-[var(--text-primary)]">{orderedSelectedSongs.length}</strong> temas
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <strong className="text-[var(--text-primary)]">{totalDurationLabel}</strong>
          </span>
        </div>
      </div>

      {feedbackMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs font-medium text-[var(--accent-primary)]">
          {feedbackMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* Left: Song Catalog Checkboxes + Ordered Setlist Builder */}
        <div className="space-y-6">
          {/* Active Setlist Order & Cues */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Orden del Setlist y Avisos de Escenario</span>
              </h2>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {orderedSelectedSongs.length} temas · {totalDurationLabel}
              </span>
            </div>

            {orderedSelectedSongs.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                Marca canciones del catálogo inferior para construir tu repertorio de directo o libreto.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] max-h-[380px] overflow-y-auto pr-1">
                {orderedSelectedSongs.map((song, idx) => (
                  <div
                    key={song.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-6 text-right font-mono text-xs font-bold text-[var(--accent-primary)] shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {song.title}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-muted)] flex flex-wrap items-center gap-1.5">
                          {song.key && <span>{song.key}</span>}
                          {song.tuning && (
                            <>
                              <span>·</span>
                              <span>{song.tuning}</span>
                            </>
                          )}
                          {song.duration && (
                            <>
                              <span>·</span>
                              <span>{song.duration}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:w-auto w-full">
                      <input
                        type="text"
                        value={cuesBySongId[song.id] || ''}
                        onChange={(e) => handleCueChange(song.id, e.target.value)}
                        placeholder="Aviso (ej. Cejilla traste 2, Drop D)..."
                        className="flex-1 sm:w-52 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveSong(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
                          title="Subir en el setlist"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSong(idx, 1)}
                          disabled={idx >= orderedSelectedSongs.length - 1}
                          className="p-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 cursor-pointer"
                          title="Bajar en el setlist"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Catalog Selection List */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-sm font-serif font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Music className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Selección desde el Catálogo</span>
                <span className="text-xs font-mono font-normal text-[var(--text-muted)]">
                  ({orderedSelectedSongs.length} de {songs.length})
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

            <div className="divide-y divide-[var(--border-subtle)] max-h-[380px] overflow-y-auto pr-2">
              {songs.map(song => {
                const isSelected = orderedIds.includes(song.id);
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
                          {song.duration && <span className="font-mono">{song.duration}</span>}
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
        </div>

        {/* Right: Saved Setlists + Layout & Formatting Options */}
        <div className="space-y-6">
          {/* Save / Load Setlists */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-3.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold flex items-center gap-2">
              <BookmarkPlus className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Repertorios Guardados</span>
            </h3>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={setlistNameInput}
                onChange={(e) => setSetlistNameInput(e.target.value)}
                placeholder="Nombre del bolo (ej. Sala Galileo)..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={handleSaveSetlist}
                disabled={orderedSelectedSongs.length === 0}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                Guardar
              </button>
            </div>

            {savedSetlists.length > 0 && (
              <div className="divide-y divide-[var(--border-subtle)] max-h-44 overflow-y-auto pt-1">
                {savedSetlists.map(sl => (
                  <div
                    key={sl.id}
                    className={`py-2 flex items-center justify-between gap-2 text-xs ${
                      activeSetlistId === sl.id ? 'text-[var(--accent-primary)] font-semibold' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadSetlist(sl)}
                      className="text-left flex-1 truncate hover:underline cursor-pointer"
                    >
                      {sl.name} <span className="font-mono text-[10px] text-[var(--text-muted)]">({sl.songIds.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSetlist(sl.id)}
                      className="p-1 text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                      title="Eliminar repertorio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formatting Options */}
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

      {isStageModeOpen && orderedSelectedSongs.length > 0 && (
        <StageModeOverlay
          items={orderedSelectedSongs.map(song => ({
            song,
            cue: cuesBySongId[song.id]?.trim() || undefined
          }))}
          accidentalPreference={accidentalPreference}
          onClose={() => setIsStageModeOpen(false)}
        />
      )}
    </div>
  );
};
