import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Activity, Layers, Volume2 } from 'lucide-react';
import { BeatAnalysis } from '../lib/audio/onsets';

export interface BeatTimelineProps {
  audioBuffer?: AudioBuffer | null;
  beatAnalysis?: BeatAnalysis | null;
  currentTime: number;
  duration: number;
  isPlaying?: boolean;
  onSeek: (timeInSeconds: number) => void;
  onTogglePlay?: () => void;
  isLoading?: boolean;
  onRecalculate?: () => void;
  className?: string;
}

export const BeatTimeline: React.FC<BeatTimelineProps> = ({
  audioBuffer,
  beatAnalysis,
  currentTime,
  duration,
  isPlaying = false,
  onSeek,
  onTogglePlay,
  isLoading = false,
  onRecalculate,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showOnsets, setShowOnsets] = useState<boolean>(true);
  const [showBeats, setShowBeats] = useState<boolean>(true);

  // Precomputed waveform peaks cache
  const peaksRef = useRef<number[]>([]);

  // Compute downsampled waveform peaks when audioBuffer changes
  useEffect(() => {
    if (!audioBuffer) {
      peaksRef.current = [];
      return;
    }

    const channelData = audioBuffer.getChannelData(0);
    const numBuckets = 400; // sufficient for high visual fidelity
    const bucketSize = Math.floor(channelData.length / numBuckets);
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

  // Main Canvas render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = 120; // fixed timeline height

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

    // 2. Waveform representation
    const peaks = peaksRef.current;
    if (peaks.length > 0) {
      const barWidth = width / peaks.length;
      const centerY = height * 0.52;

      for (let i = 0; i < peaks.length; i++) {
        const barHeight = Math.max(2, peaks[i] * (height * 0.65));
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

    // 3. Beat Grid Lines (Regular rhythm grid from @audio/beat)
    if (showBeats && beatAnalysis && beatAnalysis.beats.length > 0) {
      ctx.lineWidth = 1;
      beatAnalysis.beats.forEach((beatTime, idx) => {
        if (beatTime < 0 || beatTime > totalDuration) return;
        const x = (beatTime / totalDuration) * width;

        // Emphasize downbeats (every 4 beats)
        const isBarStart = idx % 4 === 0;

        ctx.strokeStyle = isBarStart ? 'rgba(16, 185, 129, 0.85)' : 'rgba(16, 185, 129, 0.38)';
        ctx.beginPath();
        ctx.moveTo(x, 14);
        ctx.lineTo(x, height - 12);
        ctx.stroke();

        // Downbeat top marker
        if (isBarStart) {
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(x, 10, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 4. Onsets (Acoustic transients / attack moments detected by spectral flux)
    if (showOnsets && beatAnalysis && beatAnalysis.onsets.length > 0) {
      ctx.fillStyle = '#06b6d4'; // Cyan tick
      beatAnalysis.onsets.forEach((onsetTime) => {
        if (onsetTime < 0 || onsetTime > totalDuration) return;
        const x = (onsetTime / totalDuration) * width;
        ctx.fillRect(x - 0.5, height - 10, 1.5, 6);
      });
    }

    // 5. Time ruler ticks
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

    // 6. Hover cursor & time preview
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
      const hoverLabel = `${hMins}:${Number(hSecs) < 10 ? '0' : ''}${hSecs}`;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      const textWidth = ctx.measureText(hoverLabel).width;
      const boxX = Math.max(4, Math.min(width - textWidth - 10, hx - textWidth / 2 - 4));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(boxX, height - 26, textWidth + 8, 14);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(hoverLabel, boxX + 4, height - 15);
    }

    // 7. Playhead / Current Position
    const playheadX = (currentTime / totalDuration) * width;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead head marker
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(playheadX - 4, 0);
    ctx.lineTo(playheadX + 4, 0);
    ctx.lineTo(playheadX, 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [audioBuffer, beatAnalysis, currentTime, duration, hoverTime, showBeats, showOnsets]);

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

  // Handle window resize
  useEffect(() => {
    const handleResize = () => render();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  // Seek logic based on canvas coordinate
  const seekFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const totalDuration = duration > 0 ? duration : (audioBuffer?.duration || 1);
    const targetTime = (x / rect.width) * totalDuration;
    onSeek(targetTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    seekFromEvent(e);
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
      seekFromEvent(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverTime(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={`p-4 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] space-y-3 ${className}`}>
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-serif font-bold text-xs text-[var(--text-primary)]">
              Línea de Tiempo: Onsets & Beat Grid
            </span>
            <span className="text-[10px] text-[var(--text-muted)] ml-2 font-mono hidden sm:inline">
              (@audio/beat · Canvas)
            </span>
          </div>
        </div>

        {/* Legend & Display Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => setShowBeats(!showBeats)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              showBeats
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
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
                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
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
              title="Recalcular onsets y beat tracking con el Web Worker"
            >
              <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recalcular</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Canvas Timeline */}
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[#0f1117] select-none cursor-pointer shadow-inner"
        style={{ height: 120 }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block"
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-xs text-[var(--accent-primary)] font-medium">
            <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            <span>Extrayendo onsets y ajustando rejilla rítmica con Web Worker...</span>
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
        </div>

        {beatAnalysis && (
          <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] font-mono">
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
          </div>
        )}
      </div>
    </div>
  );
};
