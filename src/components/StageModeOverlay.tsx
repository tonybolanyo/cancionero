import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useKeyboardShortcuts,
  SHORTCUT_PRIORITY,
  isEditableTarget
} from '../hooks/useKeyboardShortcuts';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ScrollText,
  Pause,
  Guitar,
  SunMedium
} from 'lucide-react';
import { Song } from '../types/song';
import {
  AccidentalPreference,
  parseLyricLine,
  transposeChord,
  transposeLyrics
} from '../utils/markdownParser';
import {
  InstrumentType,
  chordShapeWithCapo,
  extractUniqueChordsFromLyrics
} from '../lib/music/chordDiagrams';
import { chordToFunctionalSymbol } from '../lib/music/harmonyEngine';
import { playChordPreview } from '../lib/audio/chordSynth';
import { ChordDiagramCard, HarmonicNotationView } from './ChordDiagramCard';
import { MetronomeWidget } from './MetronomeWidget';
import { useDialogFocusManagement } from './modals/AccessibleModal';

export interface StageSetlistItem {
  song: Song;
  cue?: string;
}

interface StageModeOverlayProps {
  items: StageSetlistItem[];
  initialIndex?: number;
  initialSemitones?: number;
  initialCapoFret?: number;
  initialInstrument?: InstrumentType;
  initialNotationView?: HarmonicNotationView;
  accidentalPreference?: AccidentalPreference;
  onCapoChange?: (capoFret: number, song: Song) => void;
  onSemitonesChange?: (semitones: number, song: Song) => void;
  onClose: () => void;
}

const CAPO_FRETS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function parseDurationSeconds(durationStr?: string): number {
  if (!durationStr) return 210;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return Math.max(30, parts[0] * 60 + parts[1]);
  }
  return 210;
}

export const StageModeOverlay: React.FC<StageModeOverlayProps> = ({
  items,
  initialIndex = 0,
  initialSemitones = 0,
  initialCapoFret = 0,
  initialInstrument = 'guitar',
  initialNotationView = 'chords',
  accidentalPreference = 'sharps',
  onCapoChange,
  onSemitonesChange,
  onClose
}) => {
  const clampCapo = (fret: number) => Math.max(0, Math.min(7, Math.round(fret) || 0));

  const [currentIndex, setCurrentIndex] = useState<number>(
    Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1)))
  );
  const [semitones, setSemitones] = useState<number>(initialSemitones);
  const [capoFret, setCapoFret] = useState<number>(() => clampCapo(initialCapoFret));
  const [instrument] = useState<InstrumentType>(initialInstrument);
  const [notationView] = useState<HarmonicNotationView>(initialNotationView);
  const [showDiagrams, setShowDiagrams] = useState<boolean>(true);
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  const [scrollSpeedMultiplier, setScrollSpeedMultiplier] = useState<number>(1.0);
  const [fontScale, setFontScale] = useState<'md' | 'lg' | 'xl'>('lg');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [swipeFeedback, setSwipeFeedback] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef<number>(currentIndex);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const { register, unregister } = useKeyboardShortcuts();

  const activeItem = items[currentIndex];
  const song = activeItem?.song;

  useDialogFocusManagement({
    isOpen: Boolean(song),
    panelRef: containerRef,
    closeOnEscape: false,
    lockBodyScroll: true
  });

  // Reset per-song transposition & capo when changing song in setlist
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      prevIndexRef.current = currentIndex;
      setSemitones(currentIndex === initialIndex ? initialSemitones : 0);
      setCapoFret(currentIndex === initialIndex ? clampCapo(initialCapoFret) : 0);
    }
    if (scrollBodyRef.current) {
      scrollBodyRef.current.scrollTo({ top: 0 });
    }
  }, [currentIndex, initialIndex, initialSemitones, initialCapoFret]);

  useEffect(() => {
    return () => {
      if (swipeTimerRef.current) {
        window.clearTimeout(swipeTimerRef.current);
      }
    };
  }, []);

  // Screen WakeLock API to prevent tablet/phone sleep on stage
  useEffect(() => {
    let wakeLock: any = null;
    let active = true;

    const requestLock = async () => {
      try {
        const nav = navigator as unknown as { wakeLock?: { request: (type: 'screen') => Promise<any> } };
        if (nav.wakeLock) {
          wakeLock = await nav.wakeLock.request('screen');
          if (active) setWakeLockActive(true);
        }
      } catch {
        if (active) setWakeLockActive(false);
      }
    };

    void requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock?.release) {
        void wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore fullscreen denial inside iframe
    }
  };

  // Smart auto-scroll paced by song duration & tempo
  useEffect(() => {
    if (!isAutoScrolling || !scrollBodyRef.current || !song) return;

    const el = scrollBodyRef.current;
    const durationSec = parseDurationSeconds(song.duration);
    const intervalMs = 50;

    const id = window.setInterval(() => {
      const scrollableDistance = Math.max(200, el.scrollHeight - el.clientHeight);
      const pxPerSec = (scrollableDistance / durationSec) * scrollSpeedMultiplier;
      const stepPx = Math.max(0.45, (pxPerSec * intervalMs) / 1000);
      el.scrollTop += stepPx;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
        setIsAutoScrolling(false);
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [isAutoScrolling, scrollSpeedMultiplier, song]);

  // Register Escape at overlay priority (below active modals, above back navigation)
  useEffect(() => {
    register('stage-mode-escape', {
      key: 'Escape',
      priority: SHORTCUT_PRIORITY.OVERLAY,
      description: 'Cerrar modo escenario',
      callback: () => {
        onClose();
        return true;
      },
    });
    return () => unregister('stage-mode-escape');
  }, [register, unregister, onClose]);

  // Keyboard & Bluetooth pedal support (ArrowRight/PageDown, ArrowLeft/PageUp, Space)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e.target)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentIndex(prev => Math.min(items.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsAutoScrolling(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items.length]);

  const soundingKey = useMemo(
    () => (song ? transposeChord(song.key || 'Am', semitones, accidentalPreference) : 'Am'),
    [song, semitones, accidentalPreference]
  );

  const transposedLyrics = useMemo(
    () => (song ? transposeLyrics(song.lyrics, semitones, accidentalPreference) : ''),
    [song, semitones, accidentalPreference]
  );

  const uniqueChords = useMemo(
    () => extractUniqueChordsFromLyrics(transposedLyrics),
    [transposedLyrics]
  );

  if (!song) return null;

  const updateSemitones = (nextRaw: number) => {
    const wrapped = nextRaw > 11 ? nextRaw - 12 : nextRaw < -11 ? nextRaw + 12 : nextRaw;
    setSemitones(wrapped);
    onSemitonesChange?.(wrapped, song);
  };

  const updateCapoFret = (nextRaw: number) => {
    const clamped = clampCapo(nextRaw);
    setCapoFret(clamped);
    onCapoChange?.(clamped, song);
  };

  const showSwipeNotice = (label: string) => {
    setSwipeFeedback(label);
    if (swipeTimerRef.current) {
      window.clearTimeout(swipeTimerRef.current);
    }
    swipeTimerRef.current = window.setTimeout(() => {
      setSwipeFeedback(null);
    }, 1500);
  };

  const goToPreviousSong = () => {
    if (currentIndex <= 0) return;
    const prevIdx = currentIndex - 1;
    setCurrentIndex(prevIdx);
    showSwipeNotice(`Anterior: ${items[prevIdx]?.song.title || ''}`);
  };

  const goToNextSong = () => {
    if (currentIndex >= items.length - 1) return;
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);
    showSwipeNotice(`Siguiente: ${items[nextIdx]?.song.title || ''}`);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (items.length <= 1 || e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || items.length <= 1 || e.changedTouches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const elapsed = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const isHorizontalSwipe =
      elapsed < 700 &&
      Math.abs(dx) >= 64 &&
      Math.abs(dx) > Math.abs(dy) * 1.5;

    if (!isHorizontalSwipe) return;

    if (dx < 0 && currentIndex < items.length - 1) {
      goToNextSong();
    } else if (dx > 0 && currentIndex > 0) {
      goToPreviousSong();
    }
  };

  const formatChordForStage = (sounding: string): string => {
    if (notationView !== 'chords') {
      return chordToFunctionalSymbol(sounding, soundingKey, notationView);
    }
    if (capoFret > 0 && instrument !== 'piano') {
      return chordShapeWithCapo(sounding, capoFret, accidentalPreference);
    }
    return sounding;
  };

  const lyricSizeClass =
    fontScale === 'xl'
      ? 'text-xl sm:text-2xl leading-relaxed'
      : fontScale === 'lg'
      ? 'text-lg sm:text-xl leading-relaxed'
      : 'text-base sm:text-lg leading-normal';

  const chordSizeClass =
    fontScale === 'xl' ? 'text-base sm:text-lg' : fontScale === 'lg' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm';

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col focus:outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Modo Escenario: ${song.title}`}
    >
      {/* Top Stage Header */}
      <header className="px-4 sm:px-6 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {items.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={goToPreviousSong}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                title="Canción anterior (← / PageUp / Deslizar derecha)"
                aria-label="Canción anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono tabular-nums text-xs px-2 text-[var(--text-muted)]">
                {currentIndex + 1}/{items.length}
              </span>
              <button
                type="button"
                disabled={currentIndex >= items.length - 1}
                onClick={goToNextSong}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                title="Siguiente canción (→ / PageDown / Deslizar izquierda)"
                aria-label="Siguiente canción"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="min-w-0">
            <h1 className="font-serif font-bold text-lg sm:text-xl truncate">
              {song.title}
            </h1>
            <div className="text-xs font-mono text-[var(--text-muted)] flex flex-wrap items-center gap-2">
              <span>
                Tono: {soundingKey}
                {semitones !== 0 && ` (${semitones > 0 ? `+${semitones}` : semitones} st)`}
              </span>
              {capoFret > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--accent-primary)] font-semibold">
                    Cejilla {capoFret} ({chordShapeWithCapo(soundingKey, capoFret, accidentalPreference)})
                  </span>
                </>
              )}
              {song.tuning && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{song.tuning}</span>
                </>
              )}
              {song.tempo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{song.tempo} BPM</span>
                </>
              )}
              {wakeLockActive && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-500">
                    <SunMedium className="w-3 h-3" />
                    Pantalla activa
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stage Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Transposition Quick Control */}
          <div
            className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"
            role="group"
            aria-label="Transposición en semitonos"
          >
            <button
              type="button"
              onClick={() => updateSemitones(semitones - 1)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center font-mono text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-l-lg cursor-pointer"
              title="Bajar 1 semitono"
              aria-label="Bajar 1 semitono"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => updateSemitones(0)}
              disabled={semitones === 0}
              className="min-h-[44px] px-2.5 font-mono tabular-nums text-xs font-semibold text-[var(--text-primary)] disabled:opacity-80 cursor-pointer disabled:cursor-default whitespace-nowrap"
              title={semitones === 0 ? 'Tono original (0 st)' : 'Restablecer transposición (0 st)'}
              aria-label={`Transposición actual ${semitones} semitonos`}
            >
              {semitones === 0 ? '0 st' : semitones > 0 ? `+${semitones} st` : `${semitones} st`}
            </button>
            <button
              type="button"
              onClick={() => updateSemitones(semitones + 1)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center font-mono text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-r-lg cursor-pointer"
              title="Subir 1 semitono"
              aria-label="Subir 1 semitono"
            >
              +
            </button>
          </div>

          {/* Capo (0-7) Quick Selector */}
          <div
            className="inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"
            role="group"
            aria-label="Selector rápido de cejilla (Capo 0 a 7)"
          >
            <button
              type="button"
              disabled={capoFret <= 0}
              onClick={() => updateCapoFret(capoFret - 1)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center font-mono text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-l-lg disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              title="Bajar traste de cejilla"
              aria-label="Bajar cejilla"
            >
              -
            </button>
            <select
              value={capoFret}
              onChange={(e) => updateCapoFret(Number(e.target.value))}
              aria-label="Cejilla (Capo)"
              className="min-h-[44px] px-2 bg-transparent text-xs font-mono font-semibold text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              {CAPO_FRETS.map((fret) => (
                <option key={fret} value={fret} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  {fret === 0 ? 'Capo 0' : `Capo ${fret}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={capoFret >= 7}
              onClick={() => updateCapoFret(capoFret + 1)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center font-mono text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-r-lg disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              title="Subir traste de cejilla"
              aria-label="Subir cejilla"
            >
              +
            </button>
          </div>

          <MetronomeWidget
            bpm={song.tempo || 96}
            timeSignature={song.timeSignature || '4/4'}
            compact
          />

          <button
            type="button"
            onClick={() => setShowDiagrams(v => !v)}
            className={`min-h-[44px] px-3 rounded-lg border whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
              showDiagrams
                ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            <Guitar className="w-3.5 h-3.5" />
            <span>Diagramas</span>
          </button>

          <div className="flex items-center bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
            {(['md', 'lg', 'xl'] as const).map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => setFontScale(sz)}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-xs font-mono cursor-pointer ${
                  fontScale === sz
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {sz === 'md' ? 'A' : sz === 'lg' ? 'A+' : 'A++'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsAutoScrolling(s => !s)}
            className={`min-h-[44px] px-3.5 rounded-lg border whitespace-nowrap inline-flex items-center gap-1.5 font-semibold cursor-pointer ${
              isAutoScrolling
                ? 'bg-emerald-600 border-emerald-700 text-white'
                : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
            title="Autodesplazamiento inteligente (Espacio)"
          >
            {isAutoScrolling ? <Pause className="w-3.5 h-3.5" /> : <ScrollText className="w-3.5 h-3.5" />}
            <span>{isAutoScrolling ? 'Pausar Scroll' : 'Auto-Scroll'}</span>
          </button>

          {isAutoScrolling && (
            <select
              value={scrollSpeedMultiplier}
              onChange={(e) => setScrollSpeedMultiplier(Number(e.target.value))}
              className="min-h-[44px] px-2.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs font-mono cursor-pointer"
              aria-label="Velocidad de scroll"
            >
              <option value={0.7}>0.7x</option>
              <option value={1}>1.0x</option>
              <option value={1.3}>1.3x</option>
              <option value={1.6}>1.6x</option>
            </select>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold whitespace-nowrap cursor-pointer"
            title="Salir de Modo Escenario (Esc)"
          >
            <X className="w-4 h-4" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Stage Cue / Transition Notice */}
      {activeItem?.cue && (
        <div className="px-6 py-2 bg-[var(--accent-subtle)] border-b border-[var(--accent-border)] text-xs font-medium text-[var(--accent-primary)] flex items-center justify-between">
          <span>Aviso de escenario: {activeItem.cue}</span>
          {items[currentIndex + 1] && (
            <span className="font-mono text-[var(--text-secondary)]">
              Siguiente: {items[currentIndex + 1].song.title}
            </span>
          )}
        </div>
      )}

      {/* Optional Compact Chord Strip */}
      {showDiagrams && uniqueChords.length > 0 && (
        <div className="px-4 sm:px-6 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] flex items-center gap-2 overflow-x-auto shrink-0">
          {uniqueChords.map(sounding => {
            const shape =
              capoFret > 0 && instrument !== 'piano'
                ? chordShapeWithCapo(sounding, capoFret, accidentalPreference)
                : sounding;
            return (
              <ChordDiagramCard
                key={sounding}
                chord={shape}
                soundingChord={sounding}
                instrument={instrument}
                tuning={song.tuning}
                compact
              />
            );
          })}
        </div>
      )}

      {/* Swipe Song Feedback Banner */}
      {swipeFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="px-6 py-1.5 bg-[var(--accent-subtle)] border-b border-[var(--accent-border)] text-xs font-mono text-center text-[var(--accent-primary)] font-semibold shrink-0"
        >
          {swipeFeedback}
        </div>
      )}

      {/* Large Atril Lyrics Body (supports horizontal swipe left/right on touch devices) */}
      <div
        ref={scrollBodyRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto touch-pan-y px-6 sm:px-12 py-8"
      >
        <div className="max-w-4xl mx-auto space-y-2 pb-28">
          {transposedLyrics.split('\n').map((line, idx) => {
            if (line.startsWith('##') || line.startsWith('#')) {
              return (
                <h3
                  key={idx}
                  className="text-xs sm:text-sm font-mono uppercase tracking-widest text-[var(--accent-primary)] font-bold pt-6 pb-1 border-b border-[var(--border-subtle)]"
                >
                  {line.replace(/^#+\s*/, '')}
                </h3>
              );
            }
            if (!line.trim()) return <div key={idx} className="h-4" />;

            if (/\[([A-G][#b]?[^\]]*)\]/.test(line)) {
              const segments = parseLyricLine(line);
              return (
                <div key={idx} className="flex flex-wrap items-end my-1.5">
                  {segments.map((seg, sIdx) => {
                    const displayChord = seg.chord ? formatChordForStage(seg.chord) : '';
                    return (
                      <span key={sIdx} className="inline-flex flex-col mr-1.5">
                        <button
                          type="button"
                          disabled={!seg.chord}
                          onClick={() => seg.chord && playChordPreview(seg.chord, instrument, song.tuning)}
                          className={`text-left font-mono font-bold text-[var(--accent-primary)] select-none ${chordSizeClass} ${
                            seg.chord ? 'cursor-pointer hover:underline' : 'cursor-default'
                          }`}
                        >
                          {displayChord || '\u00A0'}
                        </button>
                        <span className={`font-serif text-[var(--text-primary)] ${lyricSizeClass}`}>
                          {seg.text || '\u00A0'}
                        </span>
                      </span>
                    );
                  })}
                </div>
              );
            }

            return (
              <p key={idx} className={`font-serif text-[var(--text-secondary)] ${lyricSizeClass}`}>
                {line.replace(/\[[^\]]+\]/g, '')}
              </p>
            );
          })}

          {items.length > 1 && (
            <div className="mt-12 pt-6 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={goToPreviousSong}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-semibold cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Anterior: {items[currentIndex - 1].song.title}</span>
                  </button>
                )}
              </div>

              {items[currentIndex + 1] && (
                <button
                  type="button"
                  onClick={goToNextSong}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold cursor-pointer ml-auto"
                >
                  <span>
                    Siguiente: {items[currentIndex + 1].song.title}
                    {items[currentIndex + 1].cue ? ` · ${items[currentIndex + 1].cue}` : ''}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
