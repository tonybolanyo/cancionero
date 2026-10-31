import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Activity, Music, Layers, Download, Sliders, Maximize2, Minimize2 } from 'lucide-react';
import { BeatAnalysis } from '../lib/audio/onsets';
import { ChordSegment } from '../lib/audio/keyAnalysis';
import { respellChord, AccidentalPreference } from '../utils/markdownParser';
import { TimeSignature } from '../lib/audio/meter';

export interface BeatTimelineProps {
  audioBuffer?: AudioBuffer | null;
  beatAnalysis?: BeatAnalysis | null;
  chords?: ChordSegment[] | null;
  currentTime: number;
  duration: number;
  isPlaying?: boolean;
  onSeek: (timeInSeconds: number) => void;
  onTogglePlay?: () => void;
  isLoading?: boolean;
  onRecalculate?: () => void;
  onExportJSON?: () => void;
  onExportCSV?: () => void;
  // Pitch-Shifting props
  pitchShiftSemitones?: number;
  onPitchShiftChange?: (semitones: number) => void;
  preserveTempo?: boolean;
  onTogglePreserveTempo?: () => void;
  // Enharmonic accidental preference props
  accidentalPreference?: AccidentalPreference;
  onToggleAccidentalPreference?: () => void;
  // Meter & downbeat grid props
  meter?: TimeSignature;
  downbeats?: number[];
  onMeterChange?: (meter: TimeSignature) => void;
  className?: string;
}

export const BeatTimeline: React.FC<BeatTimelineProps> = ({
  audioBuffer,
  beatAnalysis,
  chords,
  currentTime,
  duration,
  isPlaying = false,
  onSeek,
  onTogglePlay,
  isLoading = false,
  onRecalculate,
  onExportJSON,
  onExportCSV,
  pitchShiftSemitones = 0,
  onPitchShiftChange,
  preserveTempo = true,
  onTogglePreserveTempo,
  accidentalPreference = 'sharps',
  onToggleAccidentalPreference,
  meter = '4/4',
  downbeats,
  onMeterChange,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showOnsets, setShowOnsets] = useState<boolean>(true);
  const [showBeats, setShowBeats] = useState<boolean>(true);
  const [showChords, setShowChords] = useState<boolean>(true);
  const [isTallWaveform, setIsTallWaveform] = useState<boolean>(false);

  // Precomputed waveform peaks cache (high fidelity 1600 buckets for 4K / Retina)
  const peaksRef = useRef<number[]>([]);

  // Compute downsampled waveform peaks when audioBuffer changes
  useEffect(() => {
    if (!audioBuffer) {
      peaksRef.current = [];
      return;
    }

    const channelData = audioBuffer.getChannelData(0);
    const numBuckets = 1600; // high visual fidelity across wide and 4K displays
    const bucketSize = Math.max(1, Math.floor(channelData.length / numBuckets));
    const peaks: number[] = [];

    for (let i = 0; i < numBuckets; i++) {
      let max = 0;
      const start = i * bucketSize;
      const end = Math.min(start + bucketSize, channelData.length);
      for (let j = start; j < end; j += 4) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks.push(max);
    }
    peaksRef.current = peaks;
  }, [audioBuffer]);

  const hasChords = Boolean(showChords && chords && chords.length > 0);
  const currentChord = chords?.find(
    c => currentTime >= c.startTime && currentTime < c.endTime
  );

  // Dynamic height calculation adapted to screen resolution and studio expand mode
  const getTimelineHeight = useCallback((w: number, chordsActive: boolean, tall: boolean) => {
    if (w >= 1600) {
      // 4K and Ultra-wide monitors
      return tall ? (chordsActive ? 280 : 240) : (chordsActive ? 180 : 150);
    }
    if (w <= 640) {
      // Mobile screens
      return tall ? (chordsActive ? 170 : 150) : (chordsActive ? 124 : 104);
    }
    // Standard desktop and laptop
    return tall ? (chordsActive ? 220 : 190) : (chordsActive ? 144 : 124);
  }, []);

  // Main Canvas render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = getTimelineHeight(width, hasChords, isTallWaveform);

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Background
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, width, height);

    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);

    // 2. Chords Lane (Essentia ChordsDetection frame-by-frame)
    if (hasChords && chords) {
      const blockY = 15;
      const blockH = 22;

      // Draw faint background lane for chords
      ctx.fillStyle = 'rgba(139, 92, 246, 0.05)';
      ctx.fillRect(0, blockY, width, blockH);

      chords.forEach((c) => {
        if (c.endTime < 0 || c.startTime > totalDuration) return;
        const xStart = (Math.max(0, c.startTime) / totalDuration) * width;
        const xEnd = (Math.min(totalDuration, c.endTime) / totalDuration) * width;
        const segWidth = Math.max(1, xEnd - xStart);
        const isActive = currentTime >= c.startTime && currentTime < c.endTime;

        // Background color
        ctx.fillStyle = isActive
          ? 'rgba(168, 85, 247, 0.45)' // Bright violet highlight
          : 'rgba(139, 92, 246, 0.16)';
        ctx.fillRect(xStart, blockY, segWidth, blockH);

        // Border
        ctx.strokeStyle = isActive ? '#c084fc' : 'rgba(168, 85, 247, 0.32)';
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.strokeRect(xStart, blockY, segWidth, blockH);

        // Dotted transition line continuing downwards into the waveform
        ctx.save();
        ctx.strokeStyle = isActive ? 'rgba(192, 132, 252, 0.5)' : 'rgba(168, 85, 247, 0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(xStart, blockY + blockH);
        ctx.lineTo(xStart, height - 12);
        ctx.stroke();
        ctx.restore();

        // Chord name label
        if (segWidth > 15) {
          ctx.fillStyle = isActive ? '#ffffff' : '#e9d5ff';
          ctx.font = `bold ${segWidth > 32 ? '11px' : '9px'} monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const textX = xStart + segWidth / 2;
          const textY = blockY + blockH / 2;
          const displayedChord = accidentalPreference ? respellChord(c.chord, accidentalPreference) : c.chord;
          ctx.fillText(displayedChord, textX, textY);
        }
      });
    }

    // 3. Waveform representation
    const peaks = peaksRef.current;
    if (peaks.length > 0) {
      const barWidth = width / peaks.length;
      const centerY = hasChords ? 82 : height * 0.52;
      const maxAvailableHeight = hasChords ? height * 0.55 : height * 0.65;

      for (let i = 0; i < peaks.length; i++) {
        const barHeight = Math.max(2, peaks[i] * maxAvailableHeight);
        const x = i * barWidth;
        const progressX = (currentTime / totalDuration) * width;

        // Waveform color: brighter for played section, subtle for unplayed
        if (x <= progressX) {
          ctx.fillStyle = 'rgba(217, 119, 6, 0.45)'; // Amber active
        } else {
          ctx.fillStyle = 'rgba(150, 160, 180, 0.22)';
        }

        ctx.fillRect(x, centerY - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight);
      }
    }

    // 4. Beat Grid Lines (Regular rhythm grid from @audio/beat and estimated downbeats)
    if (showBeats && beatAnalysis && beatAnalysis.beats.length > 0) {
      const topY = hasChords ? 39 : 14;

      beatAnalysis.beats.forEach((beatTime, idx) => {
        if (beatTime < 0 || beatTime > totalDuration) return;
        const x = (beatTime / totalDuration) * width;

        // Check if this beat is an estimated/confirmed downbeat
        let barNumber: number | null = null;
        if (downbeats && downbeats.length > 0) {
          const matchIdx = downbeats.findIndex(db => Math.abs(db - beatTime) < 0.04);
          if (matchIdx !== -1) {
            barNumber = matchIdx + 1;
          }
        } else {
          // Fallback to grouping by meter
          const K = meter === '3/4' ? 3 : meter === '6/8' ? 6 : meter === '2/4' ? 2 : 4;
          if (idx % K === 0) {
            barNumber = Math.floor(idx / K) + 1;
          }
        }
        const isBarStart = barNumber !== null;

        ctx.strokeStyle = isBarStart ? 'rgba(16, 185, 129, 0.90)' : 'rgba(16, 185, 129, 0.30)';
        ctx.lineWidth = isBarStart ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, height - 12);
        ctx.stroke();

        // Downbeat marker and bar number
        if (isBarStart) {
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(x, topY + 2, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Bar number label if enough horizontal space
          if (width > 420) {
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`${barNumber}`, x + 3, topY + 1);
          }
        }
      });
    }

    // 5. Onsets (Acoustic transients / attack moments detected by spectral flux)
    if (showOnsets && beatAnalysis && beatAnalysis.onsets.length > 0) {
      ctx.fillStyle = '#06b6d4'; // Cyan tick
      beatAnalysis.onsets.forEach((onsetTime) => {
        if (onsetTime < 0 || onsetTime > totalDuration) return;
        const x = (onsetTime / totalDuration) * width;
        ctx.fillRect(x - 0.5, height - 10, 1.5, 6);
      });
    }

    // 6. Time ruler ticks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '9px monospace';
    const intervalSec = totalDuration > 120 ? 30 : totalDuration > 60 ? 15 : 5;
    for (let t = 0; t <= totalDuration; t += intervalSec) {
      const x = (t / totalDuration) * width;
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      const label = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      ctx.fillRect(x, 0, 1, 6);
      if (x < width - 24) {
        ctx.fillText(label, x + 3, 9);
      }
    }

    // 7. Hover cursor & time / chord preview
    if (hoverTime !== null && hoverTime >= 0 && hoverTime <= totalDuration) {
      const hx = (hoverTime / totalDuration) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      const hMins = Math.floor(hoverTime / 60);
      const hSecs = (hoverTime % 60).toFixed(2);
      const hoverChord = chords?.find(c => hoverTime >= c.startTime && hoverTime < c.endTime);
      const hoverChordName = hoverChord
        ? (accidentalPreference ? respellChord(hoverChord.chord, accidentalPreference) : hoverChord.chord)
        : null;

      const hoverLabel = hoverChordName
        ? `${hMins}:${Number(hSecs) < 10 ? '0' : ''}${hSecs} · ${hoverChordName}`
        : `${hMins}:${Number(hSecs) < 10 ? '0' : ''}${hSecs}`;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      const textWidth = ctx.measureText(hoverLabel).width;
      const boxX = Math.max(4, Math.min(width - textWidth - 10, hx - textWidth / 2 - 4));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.fillRect(boxX, height - 26, textWidth + 8, 15);
      ctx.fillStyle = hoverChord ? '#c084fc' : '#f59e0b';
      ctx.fillText(hoverLabel, boxX + 4, height - 15);
    }

    // 8. Playhead / Current Position
    const playheadX = (currentTime / totalDuration) * width;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead top triangle marker
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(playheadX - 4, 0);
    ctx.lineTo(playheadX + 4, 0);
    ctx.lineTo(playheadX, 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [audioBuffer, beatAnalysis, chords, currentTime, duration, hasChords, hoverTime, showBeats, showChords, showOnsets, accidentalPreference, isTallWaveform, getTimelineHeight]);

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

  // Handle ResizeObserver for dynamic full-width adaptation from mobile to 4K
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    render();
    const ro = new ResizeObserver(() => {
      render();
    });
    ro.observe(container);

    window.addEventListener('resize', render);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', render);
    };
  }, [render]);

  // Unified Seek logic based on horizontal coordinate (mouse or touch)
  const seekFromCoord = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
    const targetTime = (x / rect.width) * totalDuration;
    onSeek(targetTime);
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
    const t = (x / rect.width) * totalDuration;
    setHoverTime(t);

    if (isDragging) {
      seekFromCoord(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverTime(null);
  };

  // Touch handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    if (e.touches[0]) {
      seekFromCoord(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches[0]) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
        const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
        setHoverTime((x / rect.width) * totalDuration);
      }
      if (isDragging) {
        seekFromCoord(e.touches[0].clientX);
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setHoverTime(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={`p-3.5 sm:p-4 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] space-y-3 ${className}`}>
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-serif font-bold text-xs text-[var(--text-primary)]">
              Línea de Tiempo: Forma de Onda, Ritmo & Acordes
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono hidden sm:inline">
              (@audio/beat + Essentia Chords)
            </span>
            {currentChord && (
              <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-600 dark:text-purple-300 font-mono text-[11px] font-bold flex items-center gap-1 animate-pulse">
                <Music className="w-3 h-3 text-purple-400" />
                <span>Acorde: {accidentalPreference ? respellChord(currentChord.chord, accidentalPreference) : currentChord.chord}</span>
                <span className="text-[9px] text-purple-400/80">({Math.round((currentChord.confidence ?? currentChord.strength ?? 0.8) * 100)}%)</span>
              </span>
            )}
          </div>
        </div>

        {/* Legend & Display Filters */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {/* Toggle waveform height (compact vs studio tall) */}
          <button
            type="button"
            onClick={() => setIsTallWaveform(!isTallWaveform)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1 shadow-2xs ${
              isTallWaveform
                ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title={isTallWaveform ? 'Volver a altura estándar' : 'Expandir altura de onda (Modo Estudio 4K)'}
          >
            {isTallWaveform ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span className="hidden sm:inline">{isTallWaveform ? 'Onda compacta' : 'Onda estudio'}</span>
          </button>

          {chords && chords.length > 0 && (
            <button
              type="button"
              onClick={() => setShowChords(!showChords)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                showChords
                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400 font-semibold'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-60'
              }`}
              title="Mostrar/Ocultar progresión continua de acordes (Essentia ChordsDetection)"
            >
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Acordes ({chords.length})</span>
            </button>
          )}

          {chords && chords.length > 0 && onExportJSON && (
            <button
              type="button"
              onClick={onExportJSON}
              className="px-2 py-0.5 rounded text-[10px] font-mono border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Exportar secuencia de acordes a JSON"
            >
              <Download className="w-2.5 h-2.5 text-purple-400" />
              <span>JSON</span>
            </button>
          )}

          {chords && chords.length > 0 && onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              className="px-2 py-0.5 rounded text-[10px] font-mono border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Exportar secuencia de acordes a CSV"
            >
              <Download className="w-2.5 h-2.5 text-purple-400" />
              <span>CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowBeats(!showBeats)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              showBeats
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-60'
            }`}
            title="Mostrar/Ocultar rejilla rítmica de beats"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Beat Grid {beatAnalysis ? `(${beatAnalysis.beats.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOnsets(!showOnsets)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              showOnsets
                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-semibold'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] opacity-60'
            }`}
            title="Mostrar/Ocultar ataques musicales (onsets)"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Onsets {beatAnalysis ? `(${beatAnalysis.onsets.length})` : ''}</span>
          </button>

          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              disabled={isLoading}
              className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-colors cursor-pointer disabled:opacity-50 text-[11px] flex items-center gap-1"
              title="Recalcular onsets, beats y progresión armónica con los Web Workers"
            >
              <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recalcular</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Canvas Timeline with dynamic responsive height and touch scrubbing */}
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[#0f1117] select-none cursor-pointer shadow-inner transition-all duration-150 touch-none"
        style={{
          minHeight: hasChords ? (isTallWaveform ? 170 : 124) : (isTallWaveform ? 150 : 104)
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

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-xs text-[var(--accent-primary)] font-medium">
            <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            <span>Analizando compases rítmicos y acordes continuos con Web Workers...</span>
          </div>
        )}
      </div>

      {/* Transport & Metrics Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        <div className="flex items-center gap-3">
          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title={isPlaying ? 'Pausar reproducción' : 'Reproducir audio'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>
          )}

          <div className="font-mono text-xs text-[var(--text-primary)]">
            <span className="font-bold">{formatTime(currentTime)}</span>
            <span className="text-[var(--text-muted)]"> / {formatTime(duration)}</span>
          </div>

          {currentChord && (
            <div className="font-mono text-xs text-purple-600 dark:text-purple-300 font-semibold hidden sm:inline">
              Acorde activo: <span className="text-sm font-bold underline decoration-purple-500">{accidentalPreference ? respellChord(currentChord.chord, accidentalPreference) : currentChord.chord}</span>
            </div>
          )}
        </div>

        {/* Pitch-Shifting & Enharmonic Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onPitchShiftChange && (
            <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 shadow-2xs">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase px-1.5 font-semibold flex items-center gap-1">
                <Sliders className="w-2.5 h-2.5 text-purple-500" />
                <span>Pitch:</span>
              </span>
              <button
                type="button"
                onClick={() => onPitchShiftChange(pitchShiftSemitones - 1)}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                title="Bajar 1 semitono al audio en tiempo real"
              >
                -1 st
              </button>
              <button
                type="button"
                onClick={() => onPitchShiftChange(0)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  pitchShiftSemitones !== 0
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Restablecer tono original (0 semitonos)"
              >
                {pitchShiftSemitones > 0 ? `+${pitchShiftSemitones}` : pitchShiftSemitones} st
              </button>
              <button
                type="button"
                onClick={() => onPitchShiftChange(pitchShiftSemitones + 1)}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                title="Subir 1 semitono al audio en tiempo real"
              >
                +1 st
              </button>

              {onTogglePreserveTempo && (
                <button
                  type="button"
                  onClick={onTogglePreserveTempo}
                  className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    preserveTempo
                      ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-semibold'
                      : 'bg-[var(--bg-modal)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title={preserveTempo ? 'Modo: Mantener velocidad y tempo original (fase vocoder)' : 'Modo: Varipitch (cambia tono y velocidad)'}
                >
                  {preserveTempo ? 'Tempo fijo' : 'Varipitch'}
                </button>
              )}
            </div>
          )}

          {onToggleAccidentalPreference && (
            <button
              type="button"
              onClick={onToggleAccidentalPreference}
              className="px-2 py-1 rounded text-[10px] font-mono border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs font-semibold"
              title={`Preferencia enarmónica activa: ${accidentalPreference === 'flats' ? 'Bemoles (b)' : 'Sostenidos (#)'}. Clic para alternar.`}
            >
              <span>{accidentalPreference === 'flats' ? '♭ Bemoles' : '♯ Sostenidos'}</span>
            </button>
          )}

          {/* Selector interactivo de compás (2/4, 3/4, 4/4, 6/8) */}
          {onMeterChange && (
            <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-[10px] font-mono shadow-2xs">
              <span className="px-1.5 text-[var(--text-muted)] font-semibold hidden sm:inline">Compás:</span>
              {(['2/4', '3/4', '4/4', '6/8'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMeterChange(m)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer font-semibold transition-colors ${
                    meter === m
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]'
                  }`}
                  title={`Ajustar compás a ${m}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3.5 text-[11px] text-[var(--text-muted)] font-mono flex-wrap">
          {beatAnalysis && (
            <>
              <div>
                <span>Tempo: </span>
                <strong className="text-[var(--text-primary)]">{beatAnalysis.tempo} BPM</strong>
              </div>
              <div>
                <span>Pulsos: </span>
                <strong className="text-emerald-500">{beatAnalysis.beats.length} beats</strong>
              </div>
              <div>
                <span>Ataques: </span>
                <strong className="text-cyan-400">{beatAnalysis.onsets.length} onsets</strong>
              </div>
            </>
          )}
          {meter && (
            <div>
              <span>Compás: </span>
              <strong className="text-emerald-500 font-bold">{meter}</strong>
              {downbeats && downbeats.length > 0 && (
                <span className="text-[10px] opacity-75 ml-1 font-semibold">({downbeats.length} compases)</span>
              )}
            </div>
          )}
          {chords && chords.length > 0 && (
            <div>
              <span>Acordes: </span>
              <strong className="text-purple-500">{chords.length} segmentos</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
