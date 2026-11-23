import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  Sliders,
  Repeat,
  ChevronDown,
  ZoomIn,
  Check
} from 'lucide-react';
import { BeatAnalysis } from '../lib/audio/onsets';
import { ChordSegment } from '../lib/audio/keyAnalysis';
import { respellChord, AccidentalPreference } from '../utils/markdownParser';
import {
  TimeSignature,
  getMeterBeatCount
} from '../lib/audio/meter';
import { MusicalSection, MusicalSectionType } from '../lib/audio/structure';
import type { AudioEqMode } from '../lib/audio/pitchShiftPlayer';

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
  // Time-stretching, A-B Loop & EQ isolation props
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

const SECTION_STYLE_MAP: Record<
  MusicalSectionType,
  { bg: string; activeBg: string; border: string; activeBorder: string; text: string; line: string }
> = {
  Intro: {
    bg: 'rgba(6, 182, 212, 0.16)',
    activeBg: 'rgba(6, 182, 212, 0.38)',
    border: 'rgba(34, 211, 238, 0.35)',
    activeBorder: '#22d3ee',
    text: '#a5f3fc',
    line: 'rgba(34, 211, 238, 0.25)'
  },
  Estrofa: {
    bg: 'rgba(59, 130, 246, 0.18)',
    activeBg: 'rgba(59, 130, 246, 0.42)',
    border: 'rgba(96, 165, 250, 0.38)',
    activeBorder: '#60a5fa',
    text: '#bfdbfe',
    line: 'rgba(96, 165, 250, 0.25)'
  },
  Estribillo: {
    bg: 'rgba(244, 63, 94, 0.22)',
    activeBg: 'rgba(244, 63, 94, 0.48)',
    border: 'rgba(251, 113, 133, 0.45)',
    activeBorder: '#fb7185',
    text: '#fecdd3',
    line: 'rgba(251, 113, 133, 0.32)'
  },
  Puente: {
    bg: 'rgba(16, 185, 129, 0.18)',
    activeBg: 'rgba(16, 185, 129, 0.42)',
    border: 'rgba(52, 211, 153, 0.40)',
    activeBorder: '#34d399',
    text: '#a7f3d0',
    line: 'rgba(52, 211, 153, 0.28)'
  },
  Instrumental: {
    bg: 'rgba(245, 158, 11, 0.18)',
    activeBg: 'rgba(245, 158, 11, 0.42)',
    border: 'rgba(251, 191, 36, 0.40)',
    activeBorder: '#fbbf24',
    text: '#fde68a',
    line: 'rgba(251, 191, 36, 0.28)'
  },
  Outro: {
    bg: 'rgba(148, 163, 184, 0.18)',
    activeBg: 'rgba(148, 163, 184, 0.40)',
    border: 'rgba(148, 163, 184, 0.38)',
    activeBorder: '#cbd5e1',
    text: '#e2e8f0',
    line: 'rgba(148, 163, 184, 0.25)'
  }
};

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
  const [showLayersMenu, setShowLayersMenu] = useState<boolean>(false);
  const [showPracticeTools, setShowPracticeTools] = useState<boolean>(false);

  // Precomputed waveform peaks cache (high fidelity 1600 buckets for 4K / Retina)
  const peaksRef = useRef<number[]>([]);

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

  // Compute downsampled waveform peaks when audioBuffer changes
  useEffect(() => {
    if (!audioBuffer) {
      peaksRef.current = [];
      return;
    }

    const channelData = audioBuffer.getChannelData(0);
    const numBuckets = 1600;
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

  // Keep playhead visible when zoomed and playing
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
  const currentSection = sections?.find(
    s => currentTime >= s.startTime && currentTime < s.endTime
  );
  const currentChord = chords?.find(
    c => currentTime >= c.startTime && currentTime < c.endTime
  );

  // Dynamic height calculation adapted to screen resolution and expand mode
  const getTimelineHeight = useCallback((w: number, chordsActive: boolean, sectionsActive: boolean, tall: boolean) => {
    const extraSec = sectionsActive ? 22 : 0;
    if (w >= 1600) {
      return (tall ? (chordsActive ? 280 : 240) : (chordsActive ? 180 : 150)) + extraSec;
    }
    if (w <= 640) {
      return (tall ? (chordsActive ? 190 : 165) : (chordsActive ? 136 : 112)) + extraSec;
    }
    return (tall ? (chordsActive ? 220 : 190) : (chordsActive ? 150 : 128)) + extraSec;
  }, []);

  // Main Canvas render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    if (width <= 0) return;
    const viewportW = scrollContainerRef.current?.clientWidth || width;
    const height = getTimelineHeight(viewportW, hasChords, hasSections, isTallWaveform);

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

    // 1b. Musical Structure Lane
    if (hasSections && sections) {
      const secY = 14;
      const secH = 18;

      sections.forEach((sec) => {
        if (sec.endTime < 0 || sec.startTime > totalDuration) return;
        const xStart = (Math.max(0, sec.startTime) / totalDuration) * width;
        const xEnd = (Math.min(totalDuration, sec.endTime) / totalDuration) * width;
        const segWidth = Math.max(1, xEnd - xStart);
        const isActive = currentTime >= sec.startTime && currentTime < sec.endTime;
        const style = SECTION_STYLE_MAP[sec.type] || SECTION_STYLE_MAP.Estrofa;

        ctx.fillStyle = isActive ? style.activeBg : style.bg;
        ctx.fillRect(xStart, secY, segWidth, secH);

        ctx.strokeStyle = isActive ? style.activeBorder : style.border;
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.strokeRect(xStart, secY, segWidth, secH);

        if (sec.startTime > 0.2) {
          ctx.save();
          ctx.strokeStyle = isActive ? style.activeBorder : style.line;
          ctx.lineWidth = 1.25;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(xStart, secY + secH);
          ctx.lineTo(xStart, height - 12);
          ctx.stroke();
          ctx.restore();
        }

        if (segWidth > 28) {
          ctx.fillStyle = isActive ? '#ffffff' : style.text;
          ctx.font = `bold ${segWidth > 68 ? '10px' : '9px'} sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const textX = xStart + segWidth / 2;
          const textY = secY + secH / 2;
          const maxChars = Math.max(3, Math.floor((segWidth - 6) / 6));
          const displayLabel = sec.label.length > maxChars
            ? `${sec.label.slice(0, maxChars - 1)}…`
            : sec.label;
          ctx.fillText(displayLabel, textX, textY);
        }
      });
    }

    // 2. Chords Lane
    const chordsY = hasSections ? 34 : 15;
    const chordsH = 22;
    if (hasChords && chords) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.05)';
      ctx.fillRect(0, chordsY, width, chordsH);

      chords.forEach((c) => {
        if (c.endTime < 0 || c.startTime > totalDuration) return;
        const xStart = (Math.max(0, c.startTime) / totalDuration) * width;
        const xEnd = (Math.min(totalDuration, c.endTime) / totalDuration) * width;
        const segWidth = Math.max(1, xEnd - xStart);
        const isActive = currentTime >= c.startTime && currentTime < c.endTime;

        ctx.fillStyle = isActive
          ? 'rgba(168, 85, 247, 0.45)'
          : 'rgba(139, 92, 246, 0.16)';
        ctx.fillRect(xStart, chordsY, segWidth, chordsH);

        ctx.strokeStyle = isActive ? '#c084fc' : 'rgba(168, 85, 247, 0.32)';
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.strokeRect(xStart, chordsY, segWidth, chordsH);

        ctx.save();
        ctx.strokeStyle = isActive ? 'rgba(192, 132, 252, 0.5)' : 'rgba(168, 85, 247, 0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(xStart, chordsY + chordsH);
        ctx.lineTo(xStart, height - 12);
        ctx.stroke();
        ctx.restore();

        if (segWidth > 16) {
          ctx.fillStyle = isActive ? '#ffffff' : '#e9d5ff';
          ctx.font = `bold ${segWidth > 32 ? '11px' : '9px'} monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const textX = xStart + segWidth / 2;
          const textY = chordsY + chordsH / 2;
          const displayedChord = accidentalPreference ? respellChord(c.chord, accidentalPreference) : c.chord;
          ctx.fillText(displayedChord, textX, textY);
        }
      });
    }

    const waveformTopY = 14 + (hasSections ? 22 : 0) + (hasChords ? 24 : 0);
    const waveformBottomY = height - 12;
    const waveformRegionH = Math.max(30, waveformBottomY - waveformTopY);

    // 3. Waveform representation
    const peaks = peaksRef.current;
    if (peaks.length > 0) {
      const barWidth = width / peaks.length;
      const centerY = waveformTopY + waveformRegionH * 0.5;
      const maxAvailableHeight = waveformRegionH * 0.85;

      for (let i = 0; i < peaks.length; i++) {
        const barHeight = Math.max(2, peaks[i] * maxAvailableHeight);
        const x = i * barWidth;
        const progressX = (currentTime / totalDuration) * width;

        if (x <= progressX) {
          ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
        } else {
          ctx.fillStyle = 'rgba(150, 160, 180, 0.22)';
        }

        ctx.fillRect(x, centerY - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight);
      }
    }

    // 4. Beat Grid Lines
    if (showBeats && beatAnalysis && beatAnalysis.beats.length > 0) {
      const topY = waveformTopY;
      const effectiveDownbeats: number[] =
        downbeats && downbeats.length > 0
          ? downbeats
          : (() => {
              const k = getMeterBeatCount(meter);
              const list: number[] = [];
              for (let idx = 0; idx < beatAnalysis.beats.length; idx += k) {
                list.push(beatAnalysis.beats[idx]);
              }
              return list;
            })();

      beatAnalysis.beats.forEach((beatTime) => {
        if (beatTime < 0 || beatTime > totalDuration) return;
        const isCoveredByDownbeat = effectiveDownbeats.some(db => Math.abs(db - beatTime) < 0.04);
        if (isCoveredByDownbeat) return;

        const x = (beatTime / totalDuration) * width;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.30)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, height - 12);
        ctx.stroke();
      });

      effectiveDownbeats.forEach((dbTime, idx) => {
        if (dbTime < 0 || dbTime > totalDuration) return;
        const x = (dbTime / totalDuration) * width;
        const barNumber = idx + 1;

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.90)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, height - 12);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(x, topY + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (width > 420) {
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`${barNumber}`, x + 3, topY + 1);
        }
      });
    }

    // 5. Onsets
    if (showOnsets && beatAnalysis && beatAnalysis.onsets.length > 0) {
      ctx.fillStyle = '#06b6d4';
      beatAnalysis.onsets.forEach((onsetTime) => {
        if (onsetTime < 0 || onsetTime > totalDuration) return;
        const x = (onsetTime / totalDuration) * width;
        ctx.fillRect(x - 0.5, height - 10, 1.5, 6);
      });
    }

    // 6. Time ruler ticks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const intervalSec = zoomLevel >= 4 ? 5 : totalDuration > 120 ? 30 : totalDuration > 60 ? 15 : 5;
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

    // 7. Hover / Touch Scrubbing Tooltip (positioned near top on mobile so finger doesn't hide it)
    if (hoverTime !== null && hoverTime >= 0 && hoverTime <= totalDuration) {
      const hx = (hoverTime / totalDuration) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      const hMins = Math.floor(hoverTime / 60);
      const hSecs = (hoverTime % 60).toFixed(1);
      const hoverSec = sections?.find(s => hoverTime >= s.startTime && hoverTime < s.endTime);
      const hoverChord = chords?.find(c => hoverTime >= c.startTime && hoverTime < c.endTime);
      const hoverChordName = hoverChord
        ? (accidentalPreference ? respellChord(hoverChord.chord, accidentalPreference) : hoverChord.chord)
        : null;

      const labelParts = [`${hMins}:${Number(hSecs) < 10 ? '0' : ''}${hSecs}`];
      if (hoverSec) labelParts.push(hoverSec.label);
      if (hoverChordName) labelParts.push(hoverChordName);
      const hoverLabel = labelParts.join(' · ');

      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const textWidth = ctx.measureText(hoverLabel).width;
      const boxX = Math.max(4, Math.min(width - textWidth - 10, hx - textWidth / 2 - 4));
      const boxY = viewportW <= 640 ? 14 : height - 26;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(boxX, boxY, textWidth + 8, 16);
      ctx.fillStyle = hoverChord ? '#c084fc' : hoverSec ? '#38bdf8' : '#f59e0b';
      ctx.fillText(hoverLabel, boxX + 4, boxY + 11.5);
    }

    // 7b. A-B Rehearsal Loop region overlay
    if (loopStart !== null && totalDuration > 0) {
      const xA = (Math.max(0, Math.min(loopStart, totalDuration)) / totalDuration) * width;
      if (loopEnd !== null && loopEnd > loopStart) {
        const xB = (Math.max(0, Math.min(loopEnd, totalDuration)) / totalDuration) * width;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
        ctx.fillRect(xA, 0, Math.max(2, xB - xA), height);

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xB, 0);
        ctx.lineTo(xB, height);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('B', Math.max(12, xB - 3), 10);
      }
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xA, 0);
      ctx.lineTo(xA, height);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('A', Math.min(width - 10, xA + 3), 10);
    }

    // 8. Playhead / Current Position
    const playheadX = (currentTime / totalDuration) * width;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(playheadX - 4, 0);
    ctx.lineTo(playheadX + 4, 0);
    ctx.lineTo(playheadX, 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [audioBuffer, beatAnalysis, chords, sections, currentTime, duration, hasChords, hasSections, hoverTime, showBeats, showChords, showOnsets, showSections, accidentalPreference, isTallWaveform, getTimelineHeight, meter, downbeats, loopStart, loopEnd, zoomLevel]);

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
    const ro = new ResizeObserver(() => {
      render();
    });
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

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverTime(null);
  };

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
      if (isDragging && zoomLevel === 1) {
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

  const cycleZoom = () => {
    setZoomLevel(prev => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
  };

  const displayedCurrentChord = currentChord
    ? (accidentalPreference ? respellChord(currentChord.chord, accidentalPreference) : currentChord.chord)
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

  return (
    <div className={`rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] overflow-visible ${className}`}>
      {/* Compact Live Readout + 3 Clean Actions */}
      <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {displayedCurrentChord ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-base sm:text-lg font-bold text-purple-600 dark:text-purple-300 tabular-nums shrink-0">
                {displayedCurrentChord}
              </span>
              {currentSection && (
                <>
                  <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
                  <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
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

        {/* Right Controls: Zoom + Capas Popover + Recalculate */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={cycleZoom}
            className={`min-h-[38px] sm:min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              zoomLevel > 1
                ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Cambiar zoom horizontal de la onda (1x, 2x, 4x)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{zoomLevel}x</span>
          </button>

          {/* Unified Layers Popover */}
          <div className="relative" ref={layersMenuRef}>
            <button
              type="button"
              onClick={() => setShowLayersMenu(prev => !prev)}
              className="min-h-[38px] sm:min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              title="Mostrar u ocultar pistas en la línea de tiempo"
            >
              <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Capas</span>
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            </button>

            {showLayersMenu && (
              <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-medium)] shadow-lg py-1.5 z-30 text-xs">
                {sections && sections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSections(v => !v)}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
                  >
                    <span>Estructura ({sections.length})</span>
                    {showSections && <Check className="w-3.5 h-3.5 text-sky-500" />}
                  </button>
                )}
                {chords && chords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowChords(v => !v)}
                    className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
                  >
                    <span>Acordes ({chords.length})</span>
                    {showChords && <Check className="w-3.5 h-3.5 text-purple-500" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowBeats(v => !v)}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
                >
                  <span>Rejilla de pulsos</span>
                  {showBeats && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnsets(v => !v)}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
                >
                  <span>Ataques (Onsets)</span>
                  {showOnsets && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                </button>
                <div className="my-1 border-t border-[var(--border-subtle)]" />
                <button
                  type="button"
                  onClick={() => setIsTallWaveform(v => !v)}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] flex items-center justify-between text-[var(--text-primary)] cursor-pointer"
                >
                  <span>Onda expandida</span>
                  {isTallWaveform && <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
                </button>
              </div>
            )}
          </div>

          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              disabled={isLoading}
              className="min-h-[38px] sm:min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1 whitespace-nowrap"
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
        className={`relative w-full bg-[#0f1117] ${zoomLevel > 1 ? 'overflow-x-auto' : 'overflow-hidden'}`}
      >
        <div
          ref={containerRef}
          className={`relative select-none cursor-pointer ${zoomLevel === 1 ? 'touch-none' : ''}`}
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

      {/* Row 1: Streamlined Transport Bar (Thumb-friendly) */}
      <div className="px-3.5 py-2.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              className="min-h-[44px] sm:min-h-[36px] px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>
          )}

          <div className="font-mono tabular-nums text-xs text-[var(--text-primary)]">
            <span className="font-bold">{formatTime(currentTime)}</span>
            <span className="text-[var(--text-muted)]"> / {formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Quick A-B Loop + Practice Tools Drawer Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSetLoopA && onSetLoopB && (
            <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-xs font-mono">
              <span className="px-1.5 text-[var(--text-muted)] hidden sm:inline-flex items-center">
                <Repeat className="w-3 h-3 text-emerald-500" />
              </span>
              <button
                type="button"
                onClick={onSetLoopA}
                className={`min-h-[38px] sm:min-h-[30px] px-2.5 py-1 rounded-md cursor-pointer font-semibold whitespace-nowrap transition-colors ${
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
                className={`min-h-[38px] sm:min-h-[30px] px-2.5 py-1 rounded-md cursor-pointer font-semibold whitespace-nowrap transition-colors ${
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
                  className="min-h-[38px] sm:min-h-[30px] px-2 py-1 rounded-md cursor-pointer text-[var(--text-muted)] hover:text-red-500 font-bold"
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
              className={`min-h-[40px] sm:min-h-[32px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
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

      {/* Row 2: Collapsible Practice Controls Drawer (Pitch, Speed, EQ) */}
      {showPracticeTools && (
        <div className="px-3.5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Pitch Shifting */}
          {onPitchShiftChange && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text-secondary)]">Tono (Semitonos)</span>
                {onTogglePreserveTempo && (
                  <button
                    type="button"
                    onClick={onTogglePreserveTempo}
                    className={`text-[11px] font-mono font-semibold cursor-pointer ${
                      preserveTempo ? 'text-purple-600 dark:text-purple-300' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {preserveTempo ? 'Tempo fijo' : 'Varipitch'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1 bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg p-1 font-mono">
                <button
                  type="button"
                  onClick={() => onPitchShiftChange(pitchShiftSemitones - 1)}
                  className="min-h-[40px] sm:min-h-[32px] rounded-md font-semibold hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] cursor-pointer"
                >
                  -1 st
                </button>
                <button
                  type="button"
                  onClick={() => onPitchShiftChange(0)}
                  className={`min-h-[40px] sm:min-h-[32px] rounded-md font-bold cursor-pointer ${
                    pitchShiftSemitones !== 0
                      ? 'bg-purple-600 text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Restablecer a 0"
                >
                  {pitchShiftSemitones > 0 ? `+${pitchShiftSemitones}` : pitchShiftSemitones} st
                </button>
                <button
                  type="button"
                  onClick={() => onPitchShiftChange(pitchShiftSemitones + 1)}
                  className="min-h-[40px] sm:min-h-[32px] rounded-md font-semibold hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] cursor-pointer"
                >
                  +1 st
                </button>
              </div>
            </div>
          )}

          {/* Playback Speed */}
          {onPlaybackRateChange && (
            <div className="space-y-1.5">
              <span className="font-semibold text-[var(--text-secondary)] block">Velocidad</span>
              <div className="grid grid-cols-4 gap-1 bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg p-1 font-mono">
                {[0.75, 0.85, 1.0, 1.15].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => onPlaybackRateChange(rate)}
                    className={`min-h-[40px] sm:min-h-[32px] rounded-md font-semibold cursor-pointer transition-colors ${
                      Math.abs(playbackRate - rate) < 0.02
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* EQ / Instrument Isolation */}
          {onEqModeChange && (
            <div className="space-y-1.5">
              <span className="font-semibold text-[var(--text-secondary)] block">Filtro de mezcla</span>
              <div className="grid grid-cols-4 gap-1 bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg p-1 font-mono">
                {([
                  { id: 'normal', label: 'Normal' },
                  { id: 'vocal_cut', label: 'Sin voz' },
                  { id: 'bass_isolate', label: 'Bajo' },
                  { id: 'guitar_focus', label: 'Guitarra' }
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onEqModeChange(opt.id)}
                    className={`min-h-[40px] sm:min-h-[32px] rounded-md font-semibold cursor-pointer transition-colors truncate px-1 ${
                      eqMode === opt.id
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
