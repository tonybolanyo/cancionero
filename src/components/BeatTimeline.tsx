import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  Sliders,
  Repeat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ArrowRight
} from 'lucide-react';
import { BeatAnalysis } from '../lib/audio/onsets';
import { ChordSegment } from '../lib/audio/chords';
import { respellChord, AccidentalPreference } from '../utils/markdownParser';
import { TimeSignature } from '../lib/audio/meter';
import { MusicalSection } from '../lib/audio/structure';
import type { AudioEqMode } from '../lib/audio/pitchShiftPlayer';
import {
  computeDownsampledPeaks,
  findBeatStepTarget,
  getEffectiveDownbeats,
  getTimelineHeight,
  renderBeatTimelineCanvas
} from '../lib/audio/beatTimelineRenderer';
import { BeatTimelineLayersMenu } from './audio/BeatTimelineLayersMenu';
import { BeatTimelinePracticeDrawer } from './audio/BeatTimelinePracticeDrawer';

export interface BeatTimelineProps {
  audioBuffer?: AudioBuffer | null;
  beatAnalysis?: BeatAnalysis | null;
  chords?: ChordSegment[] | null;
  sections?: MusicalSection[] | null;
  currentTime: number;
  duration: number;
  isPlaying?: boolean;
  onSeek: (timeInSeconds: number) => void;
  onTogglePlay?: () => void;
  isLoading?: boolean;
  onRecalculate?: () => void;
  onExportJSON?: () => void;
  onExportCSV?: () => void;
  onExportMIDI?: () => void;
  pitchShiftSemitones?: number;
  onPitchShiftChange?: (semitones: number) => void;
  preserveTempo?: boolean;
  onTogglePreserveTempo?: () => void;
  accidentalPreference?: AccidentalPreference;
  onToggleAccidentalPreference?: () => void;
  meter?: TimeSignature;
  downbeats?: number[];
  onMeterChange?: (meter: TimeSignature) => void;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  loopStart?: number | null;
  loopEnd?: number | null;
  onSetLoopA?: () => void;
  onSetLoopB?: () => void;
  onClearLoop?: () => void;
  eqMode?: AudioEqMode;
  onEqModeChange?: (mode: AudioEqMode) => void;
  className?: string;
}

export const BeatTimeline: React.FC<BeatTimelineProps> = ({
  audioBuffer,
  beatAnalysis,
  chords,
  sections,
  currentTime,
  duration,
  isPlaying = false,
  onSeek,
  onTogglePlay,
  isLoading = false,
  onRecalculate,
  pitchShiftSemitones = 0,
  onPitchShiftChange,
  preserveTempo = true,
  onTogglePreserveTempo,
  accidentalPreference = 'sharps',
  meter = '4/4',
  downbeats,
  playbackRate = 1.0,
  onPlaybackRateChange,
  loopStart = null,
  loopEnd = null,
  onSetLoopA,
  onSetLoopB,
  onClearLoop,
  eqMode = 'normal',
  onEqModeChange,
  className = ''
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersMenuRef = useRef<HTMLDivElement>(null);

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showOnsets, setShowOnsets] = useState<boolean>(true);
  const [showBeats, setShowBeats] = useState<boolean>(true);
  const [showChords, setShowChords] = useState<boolean>(true);
  const [showSections, setShowSections] = useState<boolean>(true);
  const [isTallWaveform, setIsTallWaveform] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 4>(1);
  const [scrollRatio, setScrollRatio] = useState<number>(0);
  const [showLayersMenu, setShowLayersMenu] = useState<boolean>(false);
  const [showPracticeTools, setShowPracticeTools] = useState<boolean>(false);

  const peaksRef = useRef<number[]>([]);
  const overviewBarRef = useRef<HTMLDivElement>(null);
  const isPanningOverviewRef = useRef<boolean>(false);
  const pinchStateRef = useRef<{ startDist: number; midRatio: number } | null>(null);
  const touchTapRef = useRef<{ startX: number; startY: number; moved: boolean; isPinch: boolean } | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (layersMenuRef.current && !layersMenuRef.current.contains(e.target as Node)) {
        setShowLayersMenu(false);
      }
    };
    if (showLayersMenu) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [showLayersMenu]);

  useEffect(() => {
    if (!audioBuffer) {
      peaksRef.current = [];
      return;
    }
    peaksRef.current = computeDownsampledPeaks(audioBuffer.getChannelData(0), 1600);
  }, [audioBuffer]);

  useEffect(() => {
    if (!isPlaying || zoomLevel === 1) return;
    const scroller = scrollContainerRef.current;
    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
    if (!scroller || totalDuration <= 0) return;

    const playheadPx = (currentTime / totalDuration) * scroller.scrollWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;

    if (playheadPx < viewLeft + 40 || playheadPx > viewRight - 60) {
      scroller.scrollLeft = Math.max(0, playheadPx - scroller.clientWidth * 0.3);
    }
  }, [currentTime, duration, audioBuffer, isPlaying, zoomLevel]);

  const hasSections = Boolean(showSections && sections && sections.length > 0);
  const hasChords = Boolean(showChords && chords && chords.length > 0);
  const currentSection = sections?.find(s => currentTime >= s.startTime && currentTime < s.endTime);
  const currentChordIdx = chords
    ? chords.findIndex(c => currentTime >= c.startTime && currentTime < c.endTime)
    : -1;
  const currentChord = currentChordIdx >= 0 && chords ? chords[currentChordIdx] : undefined;
  const nextChord = (() => {
    if (!chords || chords.length === 0) return undefined;
    if (currentChordIdx >= 0) {
      const currentName = accidentalPreference
        ? respellChord(chords[currentChordIdx].chord, accidentalPreference)
        : chords[currentChordIdx].chord;
      for (let i = currentChordIdx + 1; i < chords.length; i++) {
        const candidateName = accidentalPreference
          ? respellChord(chords[i].chord, accidentalPreference)
          : chords[i].chord;
        if (candidateName !== currentName) {
          return chords[i];
        }
      }
      return undefined;
    }
    return chords.find(c => c.startTime > currentTime);
  })();

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    if (width <= 0) return;
    const viewportW = scrollContainerRef.current?.clientWidth || width;
    const height = getTimelineHeight(viewportW, hasChords, hasSections, isTallWaveform);
    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);

    renderBeatTimelineCanvas({
      canvas,
      width,
      viewportW,
      height,
      peaks: peaksRef.current,
      totalDuration,
      currentTime,
      hoverTime,
      hasSections,
      hasChords,
      showBeats,
      showOnsets,
      sections,
      chords,
      beatAnalysis,
      accidentalPreference,
      meter,
      downbeats,
      loopStart,
      loopEnd,
      zoomLevel
    });
  }, [
    audioBuffer,
    beatAnalysis,
    chords,
    sections,
    currentTime,
    duration,
    hasChords,
    hasSections,
    hoverTime,
    showBeats,
    showOnsets,
    accidentalPreference,
    isTallWaveform,
    meter,
    downbeats,
    loopStart,
    loopEnd,
    zoomLevel
  ]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      if (isPlaying) {
        animId = requestAnimationFrame(loop);
      }
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [render, isPlaying]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    render();
    const ro = new ResizeObserver(() => render());
    ro.observe(container);
    window.addEventListener('resize', render);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', render);
    };
  }, [render, zoomLevel]);

  const seekFromCoord = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
    onSeek((x / rect.width) * totalDuration);
  }, [audioBuffer, duration, onSeek]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    seekFromCoord(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
    setHoverTime((x / rect.width) * totalDuration);
    if (isDragging) {
      seekFromCoord(e.clientX);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverTime(null);
  };

  const applyZoomWithAnchor = useCallback((nextZoom: 1 | 2 | 4, anchorRatio: number) => {
    setZoomLevel(nextZoom);
    if (nextZoom === 1) {
      setScrollRatio(0);
      return;
    }
    requestAnimationFrame(() => {
      const scroller = scrollContainerRef.current;
      if (!scroller) return;
      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const targetLeft = Math.max(0, Math.min(maxScroll, anchorRatio * scroller.scrollWidth - scroller.clientWidth / 2));
      scroller.scrollLeft = targetLeft;
      setScrollRatio(maxScroll > 0 ? targetLeft / maxScroll : 0);
    });
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midRatio = canvasRect && canvasRect.width > 0
        ? Math.max(0, Math.min(1, (midX - canvasRect.left) / canvasRect.width))
        : 0.5;
      pinchStateRef.current = { startDist: dist, midRatio };
      touchTapRef.current = { startX: midX, startY: 0, moved: true, isPinch: true };
      setIsDragging(false);
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchTapRef.current = { startX: t.clientX, startY: t.clientY, moved: false, isPinch: false };
      if (zoomLevel === 1) {
        setIsDragging(true);
        seekFromCoord(t.clientX);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchStateRef.current) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const scale = dist / Math.max(1, pinchStateRef.current.startDist);

      if (scale >= 1.35 && zoomLevel < 4) {
        const nextZoom: 1 | 2 | 4 = zoomLevel === 1 ? 2 : 4;
        pinchStateRef.current.startDist = dist;
        applyZoomWithAnchor(nextZoom, pinchStateRef.current.midRatio);
      } else if (scale <= 0.72 && zoomLevel > 1) {
        const nextZoom: 1 | 2 | 4 = zoomLevel === 4 ? 2 : 1;
        pinchStateRef.current.startDist = dist;
        applyZoomWithAnchor(nextZoom, pinchStateRef.current.midRatio);
      }
      return;
    }

    if (e.touches.length === 1 && touchTapRef.current && !touchTapRef.current.isPinch) {
      const t = e.touches[0];
      if (Math.abs(t.clientX - touchTapRef.current.startX) > 8 || Math.abs(t.clientY - touchTapRef.current.startY) > 8) {
        touchTapRef.current.moved = true;
      }

      if (zoomLevel === 1) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = Math.max(0, Math.min(t.clientX - rect.left, rect.width));
          const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
          setHoverTime((x / rect.width) * totalDuration);
        }
        if (isDragging) {
          seekFromCoord(t.clientX);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) {
      pinchStateRef.current = null;
    }
    if (
      zoomLevel > 1 &&
      touchTapRef.current &&
      !touchTapRef.current.isPinch &&
      !touchTapRef.current.moved &&
      e.changedTouches[0]
    ) {
      seekFromCoord(e.changedTouches[0].clientX);
    }
    if (e.touches.length === 0) {
      touchTapRef.current = null;
      setIsDragging(false);
      setHoverTime(null);
    }
  };

  const handleContainerScroll = () => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    setScrollRatio(maxScroll > 0 ? scroller.scrollLeft / maxScroll : 0);
  };

  const panFromOverviewCoord = useCallback((clientX: number) => {
    const bar = overviewBarRef.current;
    const scroller = scrollContainerRef.current;
    if (!bar || !scroller) return;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const targetLeft = Math.max(0, Math.min(maxScroll, ratio * scroller.scrollWidth - scroller.clientWidth / 2));
    scroller.scrollLeft = targetLeft;
    setScrollRatio(maxScroll > 0 ? targetLeft / maxScroll : 0);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const cycleZoom = () => {
    const nextZoom: 1 | 2 | 4 = zoomLevel === 1 ? 2 : zoomLevel === 2 ? 4 : 1;
    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
    const anchor = totalDuration > 0 ? Math.max(0, Math.min(1, currentTime / totalDuration)) : 0.5;
    applyZoomWithAnchor(nextZoom, anchor);
  };

  const stepSeek = (deltaSeconds: number) => {
    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
    onSeek(Math.max(0, Math.min(totalDuration, currentTime + deltaSeconds)));
  };

  const availableDownbeats = getEffectiveDownbeats(downbeats, beatAnalysis, meter);

  const stepBar = (direction: -1 | 1) => {
    const target = findBeatStepTarget(availableDownbeats, currentTime, direction);
    if (target !== null) onSeek(target);
  };

  const displayedCurrentChord = currentChord
    ? (accidentalPreference ? respellChord(currentChord.chord, accidentalPreference) : currentChord.chord)
    : null;
  const displayedNextChord = nextChord
    ? (accidentalPreference ? respellChord(nextChord.chord, accidentalPreference) : nextChord.chord)
    : null;

  const hasPracticeOverrides =
    pitchShiftSemitones !== 0 || Math.abs(playbackRate - 1.0) >= 0.02 || eqMode !== 'normal';

  const activePracticeSummary = [
    pitchShiftSemitones !== 0 ? `${pitchShiftSemitones > 0 ? '+' : ''}${pitchShiftSemitones} st` : null,
    Math.abs(playbackRate - 1.0) >= 0.02 ? `${playbackRate}x` : null,
    eqMode === 'vocal_cut'
      ? 'Sin voz'
      : eqMode === 'bass_isolate'
      ? 'Bajo'
      : eqMode === 'guitar_focus'
      ? 'Guitarra'
      : null
  ].filter(Boolean);

  const totalDur = duration > 0 ? duration : (audioBuffer?.duration || 1);
  const thumbWidthPct = (1 / zoomLevel) * 100;
  const thumbLeftPct = scrollRatio * (100 - thumbWidthPct);

  return (
    <div className={`rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] overflow-visible ${className}`}>
      {/* Compact Live Readout (Current -> Next Chord) + Zoom/Layers/Recalculate */}
      <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {displayedCurrentChord ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-baseline gap-1.5 shrink-0">
                <span className="font-mono text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-300 tabular-nums leading-none">
                  {displayedCurrentChord}
                </span>
                {displayedNextChord && (
                  <span className="inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-semibold text-[var(--text-muted)] tabular-nums">
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    <span>{displayedNextChord}</span>
                  </span>
                )}
              </div>
              {currentSection && (
                <>
                  <span className="text-[var(--text-muted)] shrink-0" aria-hidden="true">·</span>
                  <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
                    {currentSection.label}
                  </span>
                </>
              )}
            </div>
          ) : displayedNextChord ? (
            <div className="flex items-center gap-1.5 min-w-0 text-xs">
              <span className="text-[var(--text-muted)] shrink-0">Próx.</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-300 shrink-0">
                {displayedNextChord}
              </span>
              {currentSection && (
                <>
                  <span className="text-[var(--text-muted)] shrink-0" aria-hidden="true">·</span>
                  <span className="font-medium text-[var(--text-secondary)] truncate">
                    {currentSection.label}
                  </span>
                </>
              )}
            </div>
          ) : currentSection ? (
            <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {currentSection.label}
            </span>
          ) : (
            <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
              Línea de tiempo interactiva
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={cycleZoom}
            className={`min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              zoomLevel > 1
                ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Cambiar zoom horizontal de la onda (1x, 2x, 4x)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{zoomLevel}x</span>
          </button>

          <div className="relative" ref={layersMenuRef}>
            <button
              type="button"
              onClick={() => setShowLayersMenu(prev => !prev)}
              className="min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              title="Mostrar u ocultar pistas en la línea de tiempo"
            >
              <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Capas</span>
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            </button>

            {showLayersMenu && (
              <BeatTimelineLayersMenu
                sectionsCount={sections?.length || 0}
                chordsCount={chords?.length || 0}
                showSections={showSections}
                onToggleSections={() => setShowSections(v => !v)}
                showChords={showChords}
                onToggleChords={() => setShowChords(v => !v)}
                showBeats={showBeats}
                onToggleBeats={() => setShowBeats(v => !v)}
                showOnsets={showOnsets}
                onToggleOnsets={() => setShowOnsets(v => !v)}
                isTallWaveform={isTallWaveform}
                onToggleTallWaveform={() => setIsTallWaveform(v => !v)}
                onClose={() => setShowLayersMenu(false)}
              />
            )}
          </div>

          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              disabled={isLoading}
              className="min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1 whitespace-nowrap"
              title="Recalcular pulsos y acordes"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recalcular</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Zoomable Canvas Timeline */}
      <div
        ref={scrollContainerRef}
        onScroll={handleContainerScroll}
        className={`relative w-full bg-[#0f1117] ${zoomLevel > 1 ? 'overflow-x-auto touch-pan-x touch-pan-y' : 'overflow-hidden'}`}
      >
        <div
          ref={containerRef}
          className={`relative select-none cursor-pointer ${zoomLevel === 1 ? 'touch-none' : 'touch-pan-x touch-pan-y'}`}
          style={{
            width: `${zoomLevel * 100}%`,
            minHeight: (hasChords ? (isTallWaveform ? 190 : 136) : (isTallWaveform ? 165 : 112)) + (hasSections ? 22 : 0)
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="w-full h-full block"
          />

          {isLoading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-xs text-[var(--accent-primary)] font-medium px-4 text-center">
              <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Analizando pulso y armonía…</span>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Overview Panner Bar when zoomed */}
      {zoomLevel > 1 && (
        <div className="px-3 py-1.5 bg-[#0a0c10] border-t border-white/10 flex items-center gap-2.5 select-none">
          <div
            ref={overviewBarRef}
            role="slider"
            aria-label="Desplazar ventana de onda"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(scrollRatio * 100)}
            tabIndex={0}
            onMouseDown={(e) => {
              isPanningOverviewRef.current = true;
              panFromOverviewCoord(e.clientX);
            }}
            onMouseMove={(e) => {
              if (isPanningOverviewRef.current) {
                panFromOverviewCoord(e.clientX);
              }
            }}
            onMouseUp={() => { isPanningOverviewRef.current = false; }}
            onMouseLeave={() => { isPanningOverviewRef.current = false; }}
            onTouchStart={(e) => {
              if (e.touches[0]) {
                isPanningOverviewRef.current = true;
                panFromOverviewCoord(e.touches[0].clientX);
              }
            }}
            onTouchMove={(e) => {
              if (isPanningOverviewRef.current && e.touches[0]) {
                panFromOverviewCoord(e.touches[0].clientX);
              }
            }}
            onTouchEnd={() => { isPanningOverviewRef.current = false; }}
            onTouchCancel={() => { isPanningOverviewRef.current = false; }}
            className="relative flex-1 h-5 rounded-md bg-white/5 border border-white/10 overflow-hidden cursor-ew-resize touch-none"
          >
            {loopStart !== null && loopEnd !== null && loopEnd > loopStart && totalDur > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/25 border-x border-emerald-400/70 pointer-events-none"
                style={{
                  left: `${(loopStart / totalDur) * 100}%`,
                  width: `${Math.max(1, ((loopEnd - loopStart) / totalDur) * 100)}%`
                }}
              />
            )}

            {totalDur > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none"
                style={{ left: `${Math.min(100, Math.max(0, (currentTime / totalDur) * 100))}%` }}
              />
            )}

            <div
              className="absolute top-0.5 bottom-0.5 rounded bg-white/20 border border-white/40 pointer-events-none transition-[left] duration-75"
              style={{
                left: `${thumbLeftPct}%`,
                width: `${thumbWidthPct}%`
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-white/55 whitespace-nowrap shrink-0">
            Toca onda para saltar
          </span>
        </div>
      )}

      {/* Row 1: Streamlined Transport Bar */}
      <div className="px-3.5 py-2.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => stepSeek(-5)}
            aria-label="Retroceder 5 segundos"
            title="Retroceder 5 segundos"
            className="min-h-[44px] sm:min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            -5s
          </button>

          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              className="min-h-[44px] sm:min-h-[36px] px-3.5 sm:px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => stepSeek(5)}
            aria-label="Avanzar 5 segundos"
            title="Avanzar 5 segundos"
            className="min-h-[44px] sm:min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            +5s
          </button>

          <div className="font-mono tabular-nums text-xs text-[var(--text-primary)] ml-1 whitespace-nowrap">
            <span className="font-bold">{formatTime(currentTime)}</span>
            <span className="text-[var(--text-muted)]"> / {formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {availableDownbeats.length > 0 && (
            <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => stepBar(-1)}
                aria-label="Ir al compás anterior"
                title="Ir al compás anterior"
                className="min-h-[44px] sm:min-h-[30px] min-w-[38px] sm:min-w-[28px] px-1.5 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)] cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1 font-mono text-[10px] font-semibold text-[var(--text-muted)] select-none whitespace-nowrap">
                Compás
              </span>
              <button
                type="button"
                onClick={() => stepBar(1)}
                aria-label="Ir al siguiente compás"
                title="Ir al siguiente compás"
                className="min-h-[44px] sm:min-h-[30px] min-w-[38px] sm:min-w-[28px] px-1.5 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)] cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {onSetLoopA && onSetLoopB && (
            <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-xs font-mono">
              <span className="px-1.5 text-[var(--text-muted)] hidden sm:inline-flex items-center">
                <Repeat className="w-3 h-3 text-emerald-500" />
              </span>
              <button
                type="button"
                onClick={onSetLoopA}
                className={`min-h-[44px] sm:min-h-[30px] px-2.5 py-1 rounded-md cursor-pointer font-semibold whitespace-nowrap transition-colors ${
                  loopStart !== null
                    ? 'bg-emerald-600 text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)]'
                }`}
                title="Marcar punto A de bucle"
              >
                {loopStart !== null ? `A ${formatTime(loopStart)}` : 'A'}
              </button>
              <button
                type="button"
                onClick={onSetLoopB}
                className={`min-h-[44px] sm:min-h-[30px] px-2.5 py-1 rounded-md cursor-pointer font-semibold whitespace-nowrap transition-colors ${
                  loopEnd !== null
                    ? 'bg-emerald-600 text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)]'
                }`}
                title="Marcar punto B de bucle"
              >
                {loopEnd !== null ? `B ${formatTime(loopEnd)}` : 'B'}
              </button>
              {(loopStart !== null || loopEnd !== null) && onClearLoop && (
                <button
                  type="button"
                  onClick={onClearLoop}
                  className="min-h-[44px] sm:min-h-[30px] px-2.5 py-1 rounded-md cursor-pointer text-[var(--text-muted)] hover:text-red-500 font-bold"
                  title="Quitar bucle A-B"
                >
                  ×
                </button>
              )}
            </div>
          )}

          {(onPitchShiftChange || onPlaybackRateChange || onEqModeChange) && (
            <button
              type="button"
              onClick={() => setShowPracticeTools(prev => !prev)}
              className={`min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                showPracticeTools || hasPracticeOverrides
                  ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>
                {activePracticeSummary.length > 0
                  ? `Ensayo · ${activePracticeSummary.join(' · ')}`
                  : 'Ensayo'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPracticeTools ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Collapsible Practice Controls Drawer */}
      {showPracticeTools && (
        <BeatTimelinePracticeDrawer
          pitchShiftSemitones={pitchShiftSemitones}
          onPitchShiftChange={onPitchShiftChange}
          preserveTempo={preserveTempo}
          onTogglePreserveTempo={onTogglePreserveTempo}
          playbackRate={playbackRate}
          onPlaybackRateChange={onPlaybackRateChange}
          eqMode={eqMode}
          onEqModeChange={onEqModeChange}
        />
      )}
    </div>
  );
};
