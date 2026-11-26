import { SyncedLyricLine } from '../../types/lyrics';

export type VideoResolution = '1080p' | '720p' | '360p';

export interface ResolutionConfig {
  label: string;
  width: number;
  height: number;
  bitrate: number;
  description: string;
}

export type VisualizerEffect =
  | 'spectrum-bars'
  | 'wave-ribbon'
  | 'circular-orb'
  | 'particle-burst'
  | 'acoustic-minimal';

export interface EffectOption {
  id: VisualizerEffect;
  name: string;
  description: string;
}

export type BackgroundTheme =
  | 'midnight'
  | 'warm-amber'
  | 'classic-vinyl'
  | 'emerald-folk'
  | 'deep-space'
  | 'cover-art'
  | 'custom-image';

export interface ThemeOption {
  id: BackgroundTheme;
  name: string;
  gradient: string;
  accent: string;
  description: string;
}

export type LyricFontStyle = 'serif' | 'sans' | 'mono';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  alpha: number;
  hue: number;
}

export interface LyricFrameState {
  active: SyncedLyricLine | null;
  next: SyncedLyricLine | null;
  prev: SyncedLyricLine | null;
  activeIndex: number;
}
