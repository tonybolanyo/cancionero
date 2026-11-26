import { Song } from '../../types/song';
import { CHORD_BRACKET_REGEX } from '../lyrics/parseLrc';
import { formatVideoTime, RESOLUTION_PRESETS } from './presets';
import {
  BackgroundTheme,
  LyricFontStyle,
  LyricFrameState,
  Particle,
  VideoResolution,
  VisualizerEffect
} from './types';

export function createInitialParticles(resolution: VideoResolution, count = 90): Particle[] {
  const config = RESOLUTION_PRESETS[resolution];
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const size = Math.random() * 3 + 1;
    particles.push({
      x: Math.random() * config.width,
      y: Math.random() * config.height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -Math.random() * 0.9 - 0.2,
      size,
      baseSize: size,
      alpha: Math.random() * 0.6 + 0.2,
      hue: Math.random() * 40 + 20
    });
  }
  return particles;
}

export function computeFrameAudioMetrics(
  analyser: AnalyserNode | null,
  isPlaying: boolean,
  hasRealAudio: boolean,
  currentTime: number
): {
  bufferLength: number;
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  bassEnergy: number;
} {
  const bufferLength = analyser ? analyser.frequencyBinCount : 128;
  const frequencyData = new Uint8Array(bufferLength);
  const timeDomainData = new Uint8Array(bufferLength);

  if (analyser && isPlaying && hasRealAudio) {
    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeDomainData);
  } else if (isPlaying) {
    const t = currentTime * 3;
    const beatPulse = (Math.sin(t * 2) + 1) * 0.5;
    for (let i = 0; i < bufferLength; i++) {
      const falloff = Math.max(0, 1 - i / (bufferLength * 0.8));
      const wave = Math.sin(t * 1.5 + i * 0.15) * 45;
      const bass = i < 15 ? beatPulse * 90 : 0;
      frequencyData[i] = Math.min(255, Math.max(15, (wave + bass + 60) * falloff));
      timeDomainData[i] = 128 + Math.sin(t * 4 + i * 0.2) * (20 + beatPulse * 30);
    }
  } else {
    const idleWave = Math.sin(Date.now() * 0.002) * 10;
    for (let i = 0; i < bufferLength; i++) {
      frequencyData[i] = Math.max(10, 25 + idleWave - i * 0.15);
      timeDomainData[i] = 128;
    }
  }

  let bassEnergy = 0;
  for (let i = 0; i < Math.min(16, bufferLength); i++) {
    bassEnergy += frequencyData[i];
  }
  bassEnergy = bassEnergy / (16 * 255);

  return { bufferLength, frequencyData, timeDomainData, bassEnergy };
}

export interface RenderVisualizerFrameParams {
  canvas: HTMLCanvasElement;
  analyser: AnalyserNode | null;
  customImage: HTMLImageElement | null;
  particles: Particle[];
  peakCaps: number[];
  isPlaying: boolean;
  hasRealAudio: boolean;
  currentTime: number;
  duration: number;
  effect: VisualizerEffect;
  theme: BackgroundTheme;
  fontStyle: LyricFontStyle;
  showChords: boolean;
  showMetadataBadge: boolean;
  showProgressBar: boolean;
  watermarkText: string;
  currentLyricState: LyricFrameState;
  song: Pick<Song, 'title' | 'genre' | 'key' | 'tempo' | 'albumTitle'>;
}

export function renderVisualizerFrame({
  canvas,
  analyser,
  customImage,
  particles,
  peakCaps,
  isPlaying,
  hasRealAudio,
  currentTime,
  duration,
  effect,
  theme,
  fontStyle,
  showChords,
  showMetadataBadge,
  showProgressBar,
  watermarkText,
  currentLyricState,
  song
}: RenderVisualizerFrameParams): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const { bufferLength, frequencyData, timeDomainData, bassEnergy } = computeFrameAudioMetrics(
    analyser,
    isPlaying,
    hasRealAudio,
    currentTime
  );

  // 1. Draw Background
  ctx.save();
  if (customImage && customImage.complete) {
    ctx.drawImage(customImage, 0, 0, width, height);
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.2,
      width / 2, height / 2, width * 0.75
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    if (theme === 'midnight') {
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#050811');
    } else if (theme === 'warm-amber') {
      bgGrad.addColorStop(0, '#1a0e07');
      bgGrad.addColorStop(0.5, '#2b160a');
      bgGrad.addColorStop(1, '#0d0703');
    } else if (theme === 'classic-vinyl') {
      bgGrad.addColorStop(0, '#141416');
      bgGrad.addColorStop(0.5, '#1e1d22');
      bgGrad.addColorStop(1, '#0a0a0c');
    } else if (theme === 'emerald-folk') {
      bgGrad.addColorStop(0, '#061811');
      bgGrad.addColorStop(0.5, '#0a231a');
      bgGrad.addColorStop(1, '#030e09');
    } else if (theme === 'deep-space') {
      bgGrad.addColorStop(0, '#0b051b');
      bgGrad.addColorStop(0.5, '#150a30');
      bgGrad.addColorStop(1, '#05020c');
    } else {
      bgGrad.addColorStop(0, '#111827');
      bgGrad.addColorStop(0.5, '#1f2937');
      bgGrad.addColorStop(1, '#0b0f19');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const spotLightRadius = width * 0.45 * (1 + bassEnergy * 0.15);
    const spot = ctx.createRadialGradient(
      width / 2, height * 0.45, 10,
      width / 2, height * 0.45, spotLightRadius
    );
    if (theme === 'warm-amber') {
      spot.addColorStop(0, `rgba(245, 158, 11, ${0.15 + bassEnergy * 0.1})`);
    } else if (theme === 'midnight') {
      spot.addColorStop(0, `rgba(56, 189, 248, ${0.14 + bassEnergy * 0.08})`);
    } else if (theme === 'emerald-folk') {
      spot.addColorStop(0, `rgba(52, 211, 153, ${0.15 + bassEnergy * 0.08})`);
    } else if (theme === 'deep-space') {
      spot.addColorStop(0, `rgba(192, 132, 252, ${0.16 + bassEnergy * 0.09})`);
    } else {
      spot.addColorStop(0, `rgba(226, 179, 64, ${0.12 + bassEnergy * 0.08})`);
    }
    spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();

  // 2. Audio-reactive Floating Particle Field
  ctx.save();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.y += p.vy * (1 + bassEnergy * 2);
    p.x += p.vx;
    if (p.y < 0) {
      p.y = height + 10;
      p.x = Math.random() * width;
    }
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;

    const currentSize = p.baseSize * (1 + bassEnergy * 1.5);
    ctx.beginPath();
    ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
    if (theme === 'warm-amber') {
      ctx.fillStyle = `rgba(251, 191, 36, ${p.alpha * (0.6 + bassEnergy * 0.4)})`;
    } else if (theme === 'emerald-folk') {
      ctx.fillStyle = `rgba(110, 231, 183, ${p.alpha * (0.6 + bassEnergy * 0.4)})`;
    } else if (theme === 'deep-space') {
      ctx.fillStyle = `rgba(216, 180, 254, ${p.alpha * (0.6 + bassEnergy * 0.4)})`;
    } else {
      ctx.fillStyle = `rgba(186, 230, 253, ${p.alpha * (0.6 + bassEnergy * 0.4)})`;
    }
    ctx.fill();
  }
  ctx.restore();

  // 3. Render Selected Visualizer Effect
  ctx.save();
  const primaryColor = theme === 'warm-amber' ? '#f59e0b'
    : theme === 'midnight' ? '#38bdf8'
    : theme === 'emerald-folk' ? '#34d399'
    : theme === 'deep-space' ? '#c084fc'
    : '#e2b340';

  const secondaryColor = theme === 'warm-amber' ? '#d97706'
    : theme === 'midnight' ? '#0284c7'
    : theme === 'emerald-folk' ? '#059669'
    : theme === 'deep-space' ? '#9333ea'
    : '#b48318';

  if (effect === 'spectrum-bars') {
    const barCount = 48;
    const barWidth = (width * 0.6) / barCount;
    const barSpacing = barWidth * 0.25;
    const actualBarWidth = barWidth - barSpacing;
    const startX = (width - barCount * barWidth) / 2;
    const baseY = height * 0.76;
    const maxBarHeight = height * 0.24;

    for (let i = 0; i < barCount; i++) {
      const freqIdx = Math.floor((Math.abs(i - barCount / 2) / (barCount / 2)) * (bufferLength * 0.7));
      const value = frequencyData[freqIdx] || 0;
      const normalized = value / 255;
      const barHeight = Math.max(6, normalized * maxBarHeight);

      const x = startX + i * barWidth;
      const y = baseY - barHeight;

      if (!peakCaps[i] || barHeight > peakCaps[i]) {
        peakCaps[i] = barHeight;
      } else {
        peakCaps[i] = Math.max(0, peakCaps[i] - 1.5);
      }

      const grad = ctx.createLinearGradient(0, baseY, 0, y);
      grad.addColorStop(0, primaryColor);
      grad.addColorStop(0.7, secondaryColor);
      grad.addColorStop(1, '#ffffff');

      ctx.fillStyle = grad;
      ctx.beginPath();
      const radius = Math.min(actualBarWidth / 2, 4);
      ctx.roundRect(x, y, actualBarWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fill();

      const capY = baseY - peakCaps[i] - 5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, capY, actualBarWidth, 3);
    }
  } else if (effect === 'wave-ribbon') {
    const baseY = height * 0.75;
    const waveAmplitude = height * 0.12 * (0.4 + bassEnergy * 0.8);
    const points = 80;
    const step = width / points;

    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 18;

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const x = i * step;
      const tdIdx = Math.floor((i / points) * (bufferLength - 1));
      const val = (timeDomainData[tdIdx] - 128) / 128;
      const y = baseY + val * waveAmplitude + Math.sin(currentTime * 4 + i * 0.15) * (12 + bassEnergy * 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4.5;
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const x = i * step;
      const tdIdx = Math.floor((i / points) * (bufferLength - 1));
      const val = (timeDomainData[tdIdx] - 128) / 128;
      const y = baseY - val * (waveAmplitude * 0.8) - Math.sin(currentTime * 3.5 + i * 0.12) * 8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (effect === 'circular-orb') {
    const centerX = width / 2;
    const centerY = height * 0.72;
    const baseRadius = height * 0.12 * (1 + bassEnergy * 0.1);
    const spikes = 64;
    const angleStep = (Math.PI * 2) / spikes;

    for (let i = 0; i < spikes; i++) {
      const angle = i * angleStep;
      const freqIdx = Math.floor((i / spikes) * (bufferLength * 0.6));
      const val = (frequencyData[freqIdx] || 0) / 255;
      const spikeLength = Math.max(6, val * (height * 0.08));

      const x1 = centerX + Math.cos(angle) * baseRadius;
      const y1 = centerY + Math.sin(angle) * baseRadius;
      const x2 = centerX + Math.cos(angle) * (baseRadius + spikeLength);
      const y2 = centerY + Math.sin(angle) * (baseRadius + spikeLength);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = i % 2 === 0 ? primaryColor : secondaryColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (effect === 'particle-burst') {
    const centerX = width / 2;
    const centerY = height * 0.75;
    const rays = 32;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const freqIdx = Math.floor((i / rays) * 32);
      const intensity = (frequencyData[freqIdx] || 0) / 255;
      const length = width * 0.15 * (0.3 + intensity * 0.7);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length);
      ctx.strokeStyle = `rgba(${theme === 'warm-amber' ? '245, 158, 11' : '56, 189, 248'}, ${0.15 + intensity * 0.5})`;
      ctx.lineWidth = 2 + intensity * 4;
      ctx.stroke();
    }
  } else {
    const baseY = height * 0.76;
    ctx.beginPath();
    ctx.moveTo(width * 0.15, baseY);
    const segments = 60;
    const step = (width * 0.7) / segments;
    for (let i = 0; i <= segments; i++) {
      const x = width * 0.15 + i * step;
      const freqIdx = Math.floor((Math.abs(i - segments / 2) / (segments / 2)) * 24);
      const energy = (frequencyData[freqIdx] || 0) / 255;
      const y = baseY + (i % 2 === 0 ? 1 : -1) * (energy * 18);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();

  // 4. Render Synchronized Lyrics
  ctx.save();
  const fontName = fontStyle === 'serif' ? 'ui-serif, Georgia, "Times New Roman", Times, serif'
    : fontStyle === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const lyricsCenterY = height * 0.42;

  if (currentLyricState.prev) {
    const prevText = currentLyricState.prev.text;
    const prevFontSize = Math.round(height * 0.038);
    ctx.font = `italic 500 ${prevFontSize}px ${fontName}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prevText, width / 2, lyricsCenterY - height * 0.12);
  }

  if (currentLyricState.active) {
    const activeText = currentLyricState.active.text;
    const activeFontSize = Math.round(height * 0.058);

    const rawHasChords = /\[([A-G][#b]?[^\]]*)\]/.test(activeText);
    const displayLyric = activeText.replace(CHORD_BRACKET_REGEX, '').trim();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    ctx.font = `600 ${activeFontSize}px ${fontName}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayLyric, width / 2, lyricsCenterY);

    if (showChords && rawHasChords) {
      const chordMatch = activeText.match(CHORD_BRACKET_REGEX);
      if (chordMatch) {
        const chordLine = chordMatch.map(c => c.replace(/[\[\]]/g, '')).join('   ·   ');
        const chordFontSize = Math.round(height * 0.032);
        ctx.font = `bold ${chordFontSize}px ui-monospace, SFMono-Regular, monospace`;
        ctx.fillStyle = primaryColor;
        ctx.fillText(chordLine, width / 2, lyricsCenterY - activeFontSize * 0.95);
      }
    }

    ctx.shadowBlur = 0;
  } else {
    const introFontSize = Math.round(height * 0.045);
    ctx.font = `italic 500 ${introFontSize}px ${fontName}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`♫ ${song.title} ♫`, width / 2, lyricsCenterY);
  }

  if (currentLyricState.next) {
    const nextText = currentLyricState.next.text.replace(CHORD_BRACKET_REGEX, '').trim();
    const nextFontSize = Math.round(height * 0.038);
    ctx.font = `500 ${nextFontSize}px ${fontName}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nextText, width / 2, lyricsCenterY + height * 0.12);
  }
  ctx.restore();

  // 5. Song Info Badge (Top Left)
  if (showMetadataBadge) {
    ctx.save();
    const badgeX = width * 0.05;
    const badgeY = height * 0.08;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const titleSize = Math.round(height * 0.036);
    ctx.font = `bold ${titleSize}px ${fontName}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(song.title, badgeX, badgeY);

    const subSize = Math.round(height * 0.022);
    ctx.font = `500 ${subSize}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

    const metaTokens = ['Tony GB', song.genre || 'Canción de autor'];
    if (song.key) metaTokens.push(`Tono: ${song.key}`);
    if (song.tempo) metaTokens.push(`${song.tempo} BPM`);
    if (song.albumTitle) metaTokens.push(song.albumTitle);

    ctx.fillText(metaTokens.join('  ·  '), badgeX, badgeY + titleSize + 6);
    ctx.restore();
  }

  // 6. YouTube Watermark / Author Brand (Top Right)
  if (watermarkText.trim()) {
    ctx.save();
    const wmX = width * 0.95;
    const wmY = height * 0.08;
    const wmSize = Math.round(height * 0.022);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${wmSize}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(watermarkText, wmX, wmY);
    ctx.restore();
  }

  // 7. Timeline / Progress Bar at bottom
  if (showProgressBar && duration > 0) {
    ctx.save();
    const pY = height - 8;
    const progressRatio = Math.min(1, Math.max(0, currentTime / duration));

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, pY, width, 8);

    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, pY, width * progressRatio, 8);

    const timeStr = `${formatVideoTime(currentTime)} / ${formatVideoTime(duration)}`;
    const timeFontSize = Math.round(height * 0.02);
    ctx.font = `600 ${timeFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(timeStr, width * 0.95, pY - 10);
    ctx.restore();
  }
}
