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
  Check,
  ArrowRight
} from 'lucide-react';
import { BeatAnalysis } from '../lib/audio/onsets';
import { ChordSegment } from '../lib/audio/chords';
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
  const [scrollRatio, setScrollRatio] = useState<number>(0);
  const [showLayersMenu, setShowLayersMenu] = useState<boolean>(false);
  const [showPracticeTools, setShowPracticeTools] = useState<boolean>(false);

  // Precomputed waveform peaks cache (high fidelity 1600 buckets for 4K / Retina)
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

      let lastBarLabelX = -100;
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

        if (x - lastBarLabelX >= 22) {
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`${barNumber}`, x + 3, topY + 1);
          lastBarLabelX = x;
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
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
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
      touchTapRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        moved: false,
        isPinch: false
      };
      if (zoomLevel === 1) {
        setIsDragging(true);
        seekFromCoord(t.clientX);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchStateRef.current) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
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
    const nextTime = Math.max(0, Math.min(totalDuration, currentTime + deltaSeconds));
    onSeek(nextTime);
  };

  const availableDownbeats: number[] =
    downbeats && downbeats.length > 0
      ? downbeats
      : beatAnalysis && beatAnalysis.beats.length > 0
      ? (() => {
          const k = getMeterBeatCount(meter);
          const list: number[] = [];
          for (let idx = 0; idx < beatAnalysis.beats.length; idx += k) {
            list.push(beatAnalysis.beats[idx]);
          }
          return list;
        })()
      : [];

  const stepBar = (direction: -1 | 1) => {
    if (availableDownbeats.length === 0) return;
    if (direction === 1) {
      const next = availableDownbeats.find(db => db > currentTime + 0.08);
      onSeek(next !== undefined ? next : availableDownbeats[availableDownbeats.length - 1]);
    } else {
      let prevIdx = -1;
      for (let i = availableDownbeats.length - 1; i >= 0; i--) {
        if (availableDownbeats[i] <= currentTime + 0.05) {
          prevIdx = i;
          break;
        }
      }
      if (prevIdx <= 0) {
        onSeek(availableDownbeats[0]);
      } else if (currentTime - availableDownbeats[prevIdx] > 0.35) {
        onSeek(availableDownbeats[prevIdx]);
      } else {
        onSeek(availableDownbeats[prevIdx - 1]);
      }
    }
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

      {/* Dedicated Overview Panner Bar when zoomed (separates horizontal panning from playhead seeking) */}
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
            {/* A-B Loop indicator inside overview */}
            {loopStart !== null && loopEnd !== null && loopEnd > loopStart && totalDur > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/25 border-x border-emerald-400/70 pointer-events-none"
                style={{
                  left: `${(loopStart / totalDur) * 100}%`,
                  width: `${Math.max(1, ((loopEnd - loopStart) / totalDur) * 100)}%`
                }}
              />
            )}

            {/* Playhead indicator inside overview */}
            {totalDur > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none"
                style={{ left: `${Math.min(100, Math.max(0, (currentTime / totalDur) * 100))}%` }}
              />
            )}

            {/* Draggable Viewport Thumb */}
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

      {/* Row 1: Streamlined Transport Bar (Thumb-friendly) */}
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

        {/* Right: Bar Step + Quick A-B Loop + Practice Tools Drawer Toggle */}
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
