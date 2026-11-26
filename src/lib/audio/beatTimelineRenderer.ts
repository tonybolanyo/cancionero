import { BeatAnalysis } from './onsets';
import { ChordSegment } from './chords';
import { respellChord, AccidentalPreference } from '../../utils/markdownParser';
import { TimeSignature, getMeterBeatCount } from './meter';
import { MusicalSection, MusicalSectionType } from './structure';

export const SECTION_STYLE_MAP: Record<
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

export function getTimelineHeight(
  viewportWidth: number,
  chordsActive: boolean,
  sectionsActive: boolean,
  tall: boolean
): number {
  const extraSec = sectionsActive ? 22 : 0;
  if (viewportWidth >= 1600) {
    return (tall ? (chordsActive ? 280 : 240) : (chordsActive ? 180 : 150)) + extraSec;
  }
  if (viewportWidth <= 640) {
    return (tall ? (chordsActive ? 190 : 165) : (chordsActive ? 136 : 112)) + extraSec;
  }
  return (tall ? (chordsActive ? 220 : 190) : (chordsActive ? 150 : 128)) + extraSec;
}

export function computeDownsampledPeaks(channelData: Float32Array, numBuckets = 1600): number[] {
  if (!channelData || channelData.length === 0 || numBuckets <= 0) return [];
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
  return peaks;
}

export function getEffectiveDownbeats(
  downbeats: number[] | undefined,
  beatAnalysis: BeatAnalysis | null | undefined,
  meter: TimeSignature
): number[] {
  if (downbeats && downbeats.length > 0) return downbeats;
  if (beatAnalysis && beatAnalysis.beats.length > 0) {
    const k = getMeterBeatCount(meter);
    const list: number[] = [];
    for (let idx = 0; idx < beatAnalysis.beats.length; idx += k) {
      list.push(beatAnalysis.beats[idx]);
    }
    return list;
  }
  return [];
}

export function findBeatStepTarget(
  availableDownbeats: number[],
  currentTime: number,
  direction: -1 | 1
): number | null {
  if (availableDownbeats.length === 0) return null;
  if (direction === 1) {
    const next = availableDownbeats.find((db) => db > currentTime + 0.08);
    return next !== undefined ? next : availableDownbeats[availableDownbeats.length - 1];
  }
  let prevIdx = -1;
  for (let i = availableDownbeats.length - 1; i >= 0; i--) {
    if (availableDownbeats[i] <= currentTime + 0.05) {
      prevIdx = i;
      break;
    }
  }
  if (prevIdx <= 0) {
    return availableDownbeats[0];
  }
  if (currentTime - availableDownbeats[prevIdx] > 0.35) {
    return availableDownbeats[prevIdx];
  }
  return availableDownbeats[prevIdx - 1];
}

export interface RenderBeatTimelineParams {
  canvas: HTMLCanvasElement;
  width: number;
  viewportW: number;
  height: number;
  peaks: number[];
  totalDuration: number;
  currentTime: number;
  hoverTime: number | null;
  hasSections: boolean;
  hasChords: boolean;
  showBeats: boolean;
  showOnsets: boolean;
  sections?: MusicalSection[] | null;
  chords?: ChordSegment[] | null;
  beatAnalysis?: BeatAnalysis | null;
  accidentalPreference?: AccidentalPreference;
  meter: TimeSignature;
  downbeats?: number[];
  loopStart: number | null;
  loopEnd: number | null;
  zoomLevel: 1 | 2 | 4;
}

export function renderBeatTimelineCanvas({
  canvas,
  width,
  viewportW,
  height,
  peaks,
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
}: RenderBeatTimelineParams): void {
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

      ctx.fillStyle = isActive ? 'rgba(168, 85, 247, 0.45)' : 'rgba(139, 92, 246, 0.16)';
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
  if (peaks.length > 0) {
    const barWidth = width / peaks.length;
    const centerY = waveformTopY + waveformRegionH * 0.5;
    const maxAvailableHeight = waveformRegionH * 0.85;

    for (let i = 0; i < peaks.length; i++) {
      const barHeight = Math.max(2, peaks[i] * maxAvailableHeight);
      const x = i * barWidth;
      const progressX = (currentTime / totalDuration) * width;

      ctx.fillStyle = x <= progressX ? 'rgba(217, 119, 6, 0.45)' : 'rgba(150, 160, 180, 0.22)';
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight);
    }
  }

  // 4. Beat Grid Lines
  if (showBeats && beatAnalysis && beatAnalysis.beats.length > 0) {
    const topY = waveformTopY;
    const effectiveDownbeats = getEffectiveDownbeats(downbeats, beatAnalysis, meter);

    beatAnalysis.beats.forEach((beatTime) => {
      if (beatTime < 0 || beatTime > totalDuration) return;
      const isCoveredByDownbeat = effectiveDownbeats.some((db) => Math.abs(db - beatTime) < 0.04);
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

  // 7. Hover / Touch Scrubbing Tooltip
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
    const hoverSec = sections?.find((s) => hoverTime >= s.startTime && hoverTime < s.endTime);
    const hoverChord = chords?.find((c) => hoverTime >= c.startTime && hoverTime < c.endTime);
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
}
