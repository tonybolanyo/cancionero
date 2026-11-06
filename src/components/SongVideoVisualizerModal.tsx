import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Download,
  Cloud,
  Check,
  Video,
  Film,
  Sparkles,
  Sliders,
  Palette,
  Type,
  Maximize2,
  Volume2,
  VolumeX,
  Upload,
  Music,
  Clock,
  Layers,
  Settings2,
  Share2,
  ExternalLink,
  Info,
  Youtube
} from 'lucide-react';
import { Song } from '../types/song';
import { GoogleDriveService } from '../services/googleDriveService';
import { parseLrc, cleanRawText, CHORD_BRACKET_REGEX, stripChordsFromText } from '../lib/lyrics/parseLrc';
import { SyncedLyricLine } from '../types/lyrics';
import { SAMPLE_LRC_TEXT } from '../data/sampleLrc';

export type VideoResolution = '1080p' | '720p' | '360p';

export interface ResolutionConfig {
  label: string;
  width: number;
  height: number;
  bitrate: number;
  description: string;
}

export const RESOLUTION_PRESETS: Record<VideoResolution, ResolutionConfig> = {
  '1080p': {
    label: '1080p Full HD (Recomendado)',
    width: 1920,
    height: 1080,
    bitrate: 6_000_000,
    description: 'Máxima nitidez para YouTube (1920x1080, 16:9)'
  },
  '720p': {
    label: '720p HD',
    width: 1280,
    height: 720,
    bitrate: 3_500_000,
    description: 'Equilibrado en peso y calidad (1280x720, 16:9)'
  },
  '360p': {
    label: '360p Rápido',
    width: 640,
    height: 360,
    bitrate: 1_200_000,
    description: 'Renderizado ultraligero y previsualización (640x360)'
  }
};

export type VisualizerEffect = 'spectrum-bars' | 'wave-ribbon' | 'circular-orb' | 'particle-burst' | 'acoustic-minimal';

export interface EffectOption {
  id: VisualizerEffect;
  name: string;
  description: string;
}

export const EFFECT_OPTIONS: EffectOption[] = [
  { id: 'spectrum-bars', name: 'Barras de Espectro', description: 'Barras simétricas ecualizadas con picos flotantes' },
  { id: 'wave-ribbon', name: 'Onda Sinusoidal', description: 'Cinta fluida luminosa que oscila con la voz y guitarra' },
  { id: 'circular-orb', name: 'Orbe / Vinilo Radial', description: 'Disco vinilo concéntrico con rayos reactivos al compás' },
  { id: 'particle-burst', name: 'Nebulosa de Partículas', description: 'Polvo cósmico y destellos que vibran con los graves' },
  { id: 'acoustic-minimal', name: 'Minimalista Acústico', description: 'Línea sutil y tenue atmósfera intimista de cantautor' }
];

export type BackgroundTheme = 'midnight' | 'warm-amber' | 'classic-vinyl' | 'emerald-folk' | 'deep-space' | 'cover-art' | 'custom-image';

export interface ThemeOption {
  id: BackgroundTheme;
  name: string;
  gradient: string;
  accent: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'midnight',
    name: 'Estudio Nocturno',
    gradient: 'from-[#090d16] via-[#0f172a] to-[#050811]',
    accent: '#38bdf8',
    description: 'Tonos azul pizarra y noche profunda con iluminación cenital'
  },
  {
    id: 'warm-amber',
    name: 'Crepúsculo Ámbar',
    gradient: 'from-[#1c120c] via-[#2c1810] to-[#0f0a06]',
    accent: '#f59e0b',
    description: 'Calidez de madera de guitarra, café y luz de lámpara'
  },
  {
    id: 'classic-vinyl',
    name: 'Vinilo Clásico',
    gradient: 'from-[#141416] via-[#1c1b1f] to-[#0a0a0c]',
    accent: '#e2b340',
    description: 'Elegancia sobria analógica en antracita y toques dorados'
  },
  {
    id: 'emerald-folk',
    name: 'Bosque Acústico',
    gradient: 'from-[#061811] via-[#0b241b] to-[#030d09]',
    accent: '#34d399',
    description: 'Verde esmeralda y musgo, calma orgánica y poética'
  },
  {
    id: 'deep-space',
    name: 'Espacio Infinito',
    gradient: 'from-[#0b051b] via-[#13092b] to-[#05020c]',
    accent: '#c084fc',
    description: 'Púrpura sideral y constelaciones sonoras'
  },
  {
    id: 'cover-art',
    name: 'Portada Difuminada',
    gradient: 'from-[#0f172a] to-[#020617]',
    accent: '#f43f5e',
    description: 'Fondo artístico derivado de la portada de la canción'
  }
];

export type LyricFontStyle = 'serif' | 'sans' | 'mono';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  alpha: number;
  hue: number;
}

interface SongVideoVisualizerModalProps {
  song: Song;
  onClose: () => void;
  allSongs?: Song[];
  onSelectOtherSong?: (song: Song) => void;
}

export const SongVideoVisualizerModal: React.FC<SongVideoVisualizerModalProps> = ({
  song,
  onClose,
  allSongs = [],
  onSelectOtherSong
}) => {
  // Configuration States
  const [resolution, setResolution] = useState<VideoResolution>('1080p');
  const [effect, setEffect] = useState<VisualizerEffect>('spectrum-bars');
  const [theme, setTheme] = useState<BackgroundTheme>('warm-amber');
  const [fontStyle, setFontStyle] = useState<LyricFontStyle>('serif');
  const [showChords, setShowChords] = useState<boolean>(false);
  const [showMetadataBadge, setShowMetadataBadge] = useState<boolean>(true);
  const [showProgressBar, setShowProgressBar] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>('Tony GB · Cancionero de autor');
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);

  // Playback & Audio Analyzer States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string>('');
  const [audioSourceType, setAudioSourceType] = useState<'url' | 'drive' | 'custom' | 'synthetic'>('url');
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Recording & Export States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState<string | null>(null);
  const [driveUploadError, setDriveUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'settings' | 'export'>('preview');

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const peakCapsRef = useRef<number[]>([]);
  const customImgElementRef = useRef<HTMLImageElement | null>(null);

  // Parse lyrics into synchronized timestamps
  const syncedLyrics = useMemo<SyncedLyricLine[]>(() => {
    const rawLrc = song.lrc || (song.id === 'si-me-pierdo' ? SAMPLE_LRC_TEXT : '');
    if (rawLrc && rawLrc.trim()) {
      const parsed = parseLrc(rawLrc);
      if (parsed.lines && parsed.lines.length > 0) {
        return parsed.lines;
      }
    }

    // Fallback: derive synchronized lines from lyrics text
    const cleanLyrics = cleanRawText(song.lyrics);
    const rawLines = cleanLyrics.split('\n');
    const validLines: { text: string; chords?: string }[] = [];

    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const hasChords = /\[([A-G][#b]?[^\]]*)\]/.test(trimmed);
      const textOnly = trimmed.replace(CHORD_BRACKET_REGEX, '').trim();
      if (textOnly) {
        validLines.push({
          text: showChords ? trimmed : textOnly,
          chords: hasChords ? trimmed.match(CHORD_BRACKET_REGEX)?.join(' ') : undefined
        });
      }
    }

    if (validLines.length === 0) {
      return [
        { id: '1', time: 0, text: song.title },
        { id: '2', time: 4, text: 'Cancionero de versos perdidos' },
        { id: '3', time: 8, text: 'Música y poesía de autor' }
      ];
    }

    // Distribute lines over estimated song duration
    const songEstSeconds = song.duration
      ? (() => {
          const parts = song.duration.split(':');
          return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        })()
      : Math.max(120, validLines.length * 5);

    const step = (songEstSeconds - 6) / Math.max(1, validLines.length);

    return validLines.map((item, idx) => ({
      id: `derived-line-${idx}`,
      time: Math.round((4 + idx * step) * 10) / 10,
      text: item.text
    }));
  }, [song.lrc, song.lyrics, song.id, song.title, song.duration, showChords]);

  // Resolve Audio Source
  useEffect(() => {
    let isCancelled = false;
    let driveObjUrl: string | null = null;

    const resolveAudio = async () => {
      setIsLoadingAudio(true);
      setAudioError(null);

      try {
        // If user manually uploaded an audio file in this session
        if (customAudioFile) {
          const url = URL.createObjectURL(customAudioFile);
          driveObjUrl = url;
          if (!isCancelled) {
            setResolvedAudioUrl(url);
            setAudioSourceType('custom');
          }
          return;
        }

        // Check Google Drive file
        const fileId = song.driveFileId || (song.audioUrl?.startsWith('gdrive://') ? song.audioUrl.replace('gdrive://', '') : null);
        if (fileId) {
          try {
            const url = await GoogleDriveService.createAudioObjectUrl(fileId);
            driveObjUrl = url;
            if (!isCancelled) {
              setResolvedAudioUrl(url);
              setAudioSourceType('drive');
            }
            return;
          } catch (driveErr: any) {
            console.warn('Google Drive audio unavailable:', driveErr);
          }
        }

        // Direct web URL if available and valid
        if (song.audioUrl && !song.audioUrl.startsWith('gdrive://') && !song.audioUrl.startsWith('blob:')) {
          if (!isCancelled) {
            setResolvedAudioUrl(song.audioUrl);
            setAudioSourceType('url');
          }
          return;
        }

        // Default: If no reachable audio URL, flag as synthetic generator
        if (!isCancelled) {
          setResolvedAudioUrl('');
          setAudioSourceType('synthetic');
        }
      } catch (err: any) {
        if (!isCancelled) {
          setAudioError(err.message || 'No se pudo cargar el audio.');
        }
      } finally {
        if (!isCancelled) setIsLoadingAudio(false);
      }
    };

    void resolveAudio();

    return () => {
      isCancelled = true;
      if (driveObjUrl) {
        URL.revokeObjectURL(driveObjUrl);
      }
    };
  }, [song.audioUrl, song.driveFileId, customAudioFile]);

  // Load custom background image if specified
  useEffect(() => {
    if (customBgUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = customBgUrl;
      img.onload = () => {
        customImgElementRef.current = img;
      };
    } else {
      customImgElementRef.current = null;
    }
  }, [customBgUrl]);

  // Initialize Particles
  useEffect(() => {
    const config = RESOLUTION_PRESETS[resolution];
    const particles: Particle[] = [];
    const count = 90;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -Math.random() * 0.9 - 0.2,
        size: Math.random() * 3 + 1,
        baseSize: Math.random() * 3 + 1,
        alpha: Math.random() * 0.6 + 0.2,
        hue: Math.random() * 40 + 20
      });
    }
    particlesRef.current = particles;
    peakCapsRef.current = new Array(64).fill(0);
  }, [resolution]);

  // Web Audio Context & Analyser Node Setup
  const setupAudioGraph = useCallback(() => {
    if (audioContextRef.current && analyserRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;

      const mediaStreamDest = ctx.createMediaStreamDestination();

      if (audioRef.current) {
        // Prevent reconnecting the same audio element twice
        if (!sourceNodeRef.current) {
          const source = ctx.createMediaElementSource(audioRef.current);
          source.connect(analyser);
          analyser.connect(ctx.destination);
          analyser.connect(mediaStreamDest);
          sourceNodeRef.current = source;
        }
      }

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      mediaStreamDestRef.current = mediaStreamDest;
    } catch (err) {
      console.warn('AudioContext setup error (user interaction may be required):', err);
    }
  }, []);

  // Handle Play/Pause
  const togglePlay = () => {
    setupAudioGraph();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }

    if (audioRef.current && resolvedAudioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.warn('Playback error:', err);
        });
      }
    } else {
      // Synthetic simulation playback if no external audio element
      setIsPlaying(prev => !prev);
    }
  };

  // Synthetic timer ticker when no audio file is attached
  useEffect(() => {
    let timer: number;
    if (isPlaying && (!audioRef.current || !resolvedAudioUrl)) {
      timer = window.setInterval(() => {
        setCurrentTime(t => {
          const next = t + 0.1;
          if (next >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying, resolvedAudioUrl, duration]);

  // Handle Seeking
  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (audioRef.current && resolvedAudioUrl) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Find Current Active, Previous, and Next Lyric Lines
  const currentLyricState = useMemo(() => {
    if (syncedLyrics.length === 0) {
      return { active: null, next: null, prev: null, activeIndex: -1 };
    }

    let activeIdx = -1;
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (syncedLyrics[i].time <= currentTime) {
        activeIdx = i;
      } else {
        break;
      }
    }

    const active = activeIdx >= 0 ? syncedLyrics[activeIdx] : null;
    const prev = activeIdx > 0 ? syncedLyrics[activeIdx - 1] : null;
    const next = activeIdx + 1 < syncedLyrics.length ? syncedLyrics[activeIdx + 1] : null;

    return { active, next, prev, activeIndex: activeIdx };
  }, [syncedLyrics, currentTime]);

  // Visualizer Canvas Drawing Loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const selectedRes = RESOLUTION_PRESETS[resolution];

    // Read real frequency data from Analyser if available, else simulate realistic acoustic harmonics
    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 128;
    const frequencyData = new Uint8Array(bufferLength);
    const timeDomainData = new Uint8Array(bufferLength);

    if (analyserRef.current && isPlaying && resolvedAudioUrl) {
      analyserRef.current.getByteFrequencyData(frequencyData);
      analyserRef.current.getByteTimeDomainData(timeDomainData);
    } else if (isPlaying) {
      // Procedural acoustic frequency simulation driven by time and rhythm
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
      // Gentle breathing idle state
      const idleWave = Math.sin(Date.now() * 0.002) * 10;
      for (let i = 0; i < bufferLength; i++) {
        frequencyData[i] = Math.max(10, 25 + idleWave - i * 0.15);
        timeDomainData[i] = 128;
      }
    }

    // Compute bass energy (sub-bass / bass frequencies)
    let bassEnergy = 0;
    for (let i = 0; i < Math.min(16, bufferLength); i++) {
      bassEnergy += frequencyData[i];
    }
    bassEnergy = bassEnergy / (16 * 255);

    // 1. Draw Background
    ctx.save();
    if (customImgElementRef.current && customImgElementRef.current.complete) {
      // Draw user custom uploaded background image scaled & centered
      ctx.drawImage(customImgElementRef.current, 0, 0, width, height);
      // Dark vignette overlay for optimal lyric readability
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, width * 0.2,
        width / 2, height / 2, width * 0.75
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Elegant themed gradient background
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
        // Cover Art / Modern Slate
        bgGrad.addColorStop(0, '#111827');
        bgGrad.addColorStop(0.5, '#1f2937');
        bgGrad.addColorStop(1, '#0b0f19');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Ambient radial spotlight reacting subtly to bass
      const spotLightRadius = (width * 0.45) * (1 + bassEnergy * 0.15);
      const spot = ctx.createRadialGradient(
        width / 2, height * 0.45, 10,
        width / 2, height * 0.45, spotLightRadius
      );
      if (theme === 'warm-amber') {
        spot.addColorStop(0, `rgba(245, 158, 11, ${0.15 + bassEnergy * 0.1})`);
        spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (theme === 'midnight') {
        spot.addColorStop(0, `rgba(56, 189, 248, ${0.14 + bassEnergy * 0.08})`);
        spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (theme === 'emerald-folk') {
        spot.addColorStop(0, `rgba(52, 211, 153, ${0.15 + bassEnergy * 0.08})`);
        spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (theme === 'deep-space') {
        spot.addColorStop(0, `rgba(192, 132, 252, ${0.16 + bassEnergy * 0.09})`);
        spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        spot.addColorStop(0, `rgba(226, 179, 64, ${0.12 + bassEnergy * 0.08})`);
        spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();

    // 2. Audio-reactive Floating Particle Field
    ctx.save();
    const particles = particlesRef.current;
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
      // Symmetrical modern spectrum bars positioned at lower third
      const barCount = 48;
      const barWidth = (width * 0.6) / barCount;
      const barSpacing = barWidth * 0.25;
      const actualBarWidth = barWidth - barSpacing;
      const startX = (width - (barCount * barWidth)) / 2;
      const baseY = height * 0.76;
      const maxBarHeight = height * 0.24;

      for (let i = 0; i < barCount; i++) {
        // Mirror frequencies from center
        const freqIdx = Math.floor(Math.abs(i - barCount / 2) / (barCount / 2) * (bufferLength * 0.7));
        const value = frequencyData[freqIdx] || 0;
        const normalized = value / 255;
        const barHeight = Math.max(6, normalized * maxBarHeight);

        const x = startX + i * barWidth;
        const y = baseY - barHeight;

        // Falling peak caps
        if (!peakCapsRef.current[i] || barHeight > peakCapsRef.current[i]) {
          peakCapsRef.current[i] = barHeight;
        } else {
          peakCapsRef.current[i] = Math.max(0, peakCapsRef.current[i] - 1.5);
        }

        // Draw bar
        const grad = ctx.createLinearGradient(0, baseY, 0, y);
        grad.addColorStop(0, primaryColor);
        grad.addColorStop(0.7, secondaryColor);
        grad.addColorStop(1, '#ffffff');

        ctx.fillStyle = grad;
        ctx.beginPath();
        // Rounded top bar
        const radius = Math.min(actualBarWidth / 2, 4);
        ctx.roundRect(x, y, actualBarWidth, barHeight, [radius, radius, 0, 0]);
        ctx.fill();

        // Draw Peak Cap
        const capY = baseY - peakCapsRef.current[i] - 5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, capY, actualBarWidth, 3);
      }
    } else if (effect === 'wave-ribbon') {
      // Dual glowing oscillating sine waveform
      const baseY = height * 0.75;
      const waveAmplitude = height * 0.12 * (0.4 + bassEnergy * 0.8);
      const points = 80;
      const step = width / points;

      // Glow backdrop
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

      // Mirror secondary line
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
      // Rotating vinyl / radial spectrum ring
      const centerX = width / 2;
      const centerY = height * 0.72;
      const baseRadius = height * 0.12 * (1 + bassEnergy * 0.1);
      const spikes = 64;
      const angleStep = (Math.PI * 2) / spikes;

      // Outer radial frequency bars
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

      // Center vinyl record grooves
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vinyl label center
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = primaryColor;
      ctx.fill();

      // Center spindle hole
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else if (effect === 'particle-burst') {
      // Starburst rays pulsing to the beat
      const centerX = width / 2;
      const centerY = height * 0.75;
      const rays = 32;
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2;
        const freqIdx = Math.floor((i / rays) * 32);
        const intensity = (frequencyData[freqIdx] || 0) / 255;
        const length = (width * 0.15) * (0.3 + intensity * 0.7);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length);
        ctx.strokeStyle = `rgba(${theme === 'warm-amber' ? '245, 158, 11' : '56, 189, 248'}, ${0.15 + intensity * 0.5})`;
        ctx.lineWidth = 2 + intensity * 4;
        ctx.stroke();
      }
    } else {
      // Acoustic Minimal: elegant subtle center line that breathes
      const baseY = height * 0.76;
      ctx.beginPath();
      ctx.moveTo(width * 0.15, baseY);
      const segments = 60;
      const step = (width * 0.7) / segments;
      for (let i = 0; i <= segments; i++) {
        const x = width * 0.15 + i * step;
        const freqIdx = Math.floor(Math.abs(i - segments / 2) / (segments / 2) * 24);
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

    // Previous Line (Fading out above)
    if (currentLyricState.prev) {
      const prevText = currentLyricState.prev.text;
      const prevFontSize = Math.round(height * 0.038);
      ctx.font = `italic 500 ${prevFontSize}px ${fontName}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prevText, width / 2, lyricsCenterY - height * 0.12);
    }

    // Active Line (Large, High Contrast, Centered, with Glow)
    if (currentLyricState.active) {
      const activeText = currentLyricState.active.text;
      const activeFontSize = Math.round(height * 0.058);

      // Extract chords if embedded and chords toggle is enabled
      const rawHasChords = /\[([A-G][#b]?[^\]]*)\]/.test(activeText);
      const displayLyric = activeText.replace(CHORD_BRACKET_REGEX, '').trim();

      // Text Shadow for cinematic clarity on YouTube
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;

      // Draw Main Lyric
      ctx.font = `600 ${activeFontSize}px ${fontName}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayLyric, width / 2, lyricsCenterY);

      // Render Chords directly above if requested
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
      // Intro / Instrumental Placeholder
      const introFontSize = Math.round(height * 0.045);
      ctx.font = `italic 500 ${introFontSize}px ${fontName}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`♫ ${song.title} ♫`, width / 2, lyricsCenterY);
    }

    // Next Line (Preview below)
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

      // Song Title
      const titleSize = Math.round(height * 0.036);
      ctx.font = `bold ${titleSize}px ${fontName}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(song.title, badgeX, badgeY);

      // Meta Line: Artist · Key · Tempo
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

      // Background track
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, pY, width, 8);

      // Filled progress
      ctx.fillStyle = primaryColor;
      ctx.fillRect(0, pY, width * progressRatio, 8);

      // Time indicator
      const timeStr = `${formatTime(currentTime)} / ${formatTime(duration)}`;
      const timeFontSize = Math.round(height * 0.02);
      ctx.font = `600 ${timeFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(timeStr, width * 0.95, pY - 10);
      ctx.restore();
    }
  }, [
    resolution,
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
    song,
    isPlaying,
    resolvedAudioUrl
  ]);

  // Animation Loop
  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      renderFrame();
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderFrame]);

  // Audio Duration Listener
  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (isRecording && duration > 0) {
        setRecordingProgress(Math.min(100, Math.round((audioRef.current.currentTime / duration) * 100)));
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (isRecording) {
      stopRecording();
    }
  };

  // Recording Engine (MediaRecorder capturing Canvas + Web Audio)
  const startRecording = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setupAudioGraph();
    setRecordedBlob(null);
    setRecordedVideoUrl(null);
    setDriveUploadSuccess(null);
    setDriveUploadError(null);
    recordedChunksRef.current = [];

    // Ensure audio starts from beginning for clean render
    handleSeek(0);

    try {
      // 30 FPS canvas video capture stream
      const canvasStream = canvas.captureStream(30);

      // Mix audio tracks into stream
      let combinedStream: MediaStream;
      if (mediaStreamDestRef.current && mediaStreamDestRef.current.stream.getAudioTracks().length > 0) {
        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...mediaStreamDestRef.current.stream.getAudioTracks()
        ]);
      } else {
        combinedStream = canvasStream;
      }

      // Select best supported MIME type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      let selectedMime = 'video/webm';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: RESOLUTION_PRESETS[resolution].bitrate
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(recordedChunksRef.current, { type: selectedMime });
        const videoUrl = URL.createObjectURL(finalBlob);
        setRecordedBlob(finalBlob);
        setRecordedVideoUrl(videoUrl);
        setIsRecording(false);
        setActiveTab('export');
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // 1-second chunks
      setIsRecording(true);
      setRecordingProgress(0);

      // Start playback
      if (audioRef.current && resolvedAudioUrl) {
        void audioRef.current.play();
        setIsPlaying(true);
      } else {
        setIsPlaying(true);
      }
    } catch (err: any) {
      console.error('Error starting video recording:', err);
      alert(`No se pudo iniciar la grabación del vídeo: ${err.message}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  // Download Recorded Video File
  const handleDownloadVideo = () => {
    if (!recordedBlob) return;
    const cleanTitle = song.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `${cleanTitle}-visualizador-${resolution}.webm`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(recordedBlob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Save to Google Drive
  const handleSaveToDrive = async () => {
    if (!recordedBlob) return;

    setIsUploadingToDrive(true);
    setDriveUploadError(null);
    setDriveUploadSuccess(null);

    try {
      if (!GoogleDriveService.isConnected()) {
        await GoogleDriveService.signInWithGoogle();
      }

      const cleanTitle = song.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const filename = `${cleanTitle}-visualizador-${resolution}.webm`;

      const result = await GoogleDriveService.uploadVideo(recordedBlob, filename, {
        songTitle: song.title,
        description: `Vídeo oficial para YouTube de "${song.title}" (${resolution}) generado con Cancionero de versos perdidos`
      });

      setDriveUploadSuccess(`Vídeo guardado con éxito en Google Drive: "${result.name}"`);
    } catch (err: any) {
      console.error('Error uploading video to Google Drive:', err);
      setDriveUploadError(err.message || 'Error al guardar en Google Drive.');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Upload Custom Local Audio
  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAudioFile(file);
    }
  };

  // Upload Custom Background Image
  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomBgUrl(url);
      setTheme('custom-image');
    }
  };

  // Helper formatting mm:ss
  function formatTime(sec: number): string {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const selectedResConfig = RESOLUTION_PRESETS[resolution];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-visualizer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
    >
      <div className="relative w-full max-w-6xl max-h-[96vh] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]">
        
        {/* Hidden Audio Element */}
        {resolvedAudioUrl && (
          <audio
            ref={audioRef}
            src={resolvedAudioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleAudioEnded}
            muted={isMuted}
          />
        )}

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="video-visualizer-title" className="font-serif text-lg font-bold text-[var(--text-primary)]">
                  Generador de Vídeo para YouTube
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                  {resolution} (16:9)
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Visualización sincronizada de letra, espectro de audio y efectos · <strong>{song.title}</strong>
              </p>
            </div>
          </div>

          {/* Close & Navigation */}
          <div className="flex items-center gap-2">
            {allSongs.length > 1 && onSelectOtherSong && (
              <select
                value={song.id}
                onChange={(e) => {
                  const target = allSongs.find(s => s.id === e.target.value);
                  if (target) onSelectOtherSong(target);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              >
                {allSongs.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={onClose}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Lienzo y Previsualización</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configuración y Parámetros</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'export'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Exportar y Guardar {recordedBlob && '✓'}</span>
            </button>
          </div>

          {/* Quick Resolution Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-1 rounded-lg border border-[var(--border-subtle)]">
            <span className="text-[11px] text-[var(--text-muted)] font-mono px-1.5">Resolución:</span>
            {(['1080p', '720p', '360p'] as VideoResolution[]).map(res => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  resolution === res
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* 1. Preview Tab: Interactive 16:9 Canvas & Playback Bar */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* 16:9 Canvas Container */}
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] flex items-center justify-center group">
                <canvas
                  ref={canvasRef}
                  width={selectedResConfig.width}
                  height={selectedResConfig.height}
                  className="w-full h-full object-contain"
                />

                {/* Live Recording Badge */}
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white font-mono text-xs font-bold shadow-lg animate-pulse backdrop-blur-md">
                    <span className="w-2.5 h-2.5 rounded-full bg-white" />
                    <span>GRABANDO VÍDEO ({recordingProgress}%)</span>
                  </div>
                )}

                {/* Overlaid Play/Pause on Canvas hover */}
                {!isRecording && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                      {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                    </div>
                  </button>
                )}
              </div>

              {/* Playback & Seek Controls */}
              <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Play/Pause & Time */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="w-11 h-11 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] flex items-center justify-center transition-all shadow-md cursor-pointer shrink-0"
                    title={isPlaying ? 'Pausar' : 'Reproducir'}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => handleSeek(0)}
                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface)] transition-colors cursor-pointer shrink-0"
                    title="Reiniciar desde el inicio"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <div className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                    <span className="text-[var(--text-primary)] font-bold">{formatTime(currentTime)}</span>
                    <span> / {formatTime(duration)}</span>
                  </div>
                </div>

                {/* Progress Scrubber */}
                <div className="flex-1 max-w-xl flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.5"
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    className="w-full accent-[var(--accent-primary)] cursor-pointer"
                  />
                </div>

                {/* Record Action / Sound Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                    title={isMuted ? 'Activar sonido' : 'Silenciar altavoz'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Film className="w-4 h-4" />
                      <span>Grabar Vídeo</span>
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 shadow-md flex items-center gap-2 transition-all cursor-pointer border border-zinc-600 animate-pulse"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Detener Grabación</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Informative Audio Source Note */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Music className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span className="text-[var(--text-secondary)]">
                    {audioSourceType === 'drive' && 'Maqueta privada sincronizada desde Google Drive'}
                    {audioSourceType === 'custom' && `Pista de audio personalizada: ${customAudioFile?.name}`}
                    {audioSourceType === 'url' && 'Pista de audio vinculada a la canción'}
                    {audioSourceType === 'synthetic' && 'Generador acústico procedimental (no hay archivo de audio adjunto)'}
                  </span>
                </div>

                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)] rounded-lg border border-[var(--accent-border)] cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir otra pista de audio</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleCustomAudioUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* 2. Settings Tab: Customization Parameters */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Resolution Setting (Mandatory 1080p, 720p, 360p) */}
              <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                      <Film className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span>Tamaño y Calidad de Visualización (YouTube 16:9)</span>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      1080p es la resolución recomendada por YouTube para una nitidez cristalina de las letras.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">
                    Por defecto: 1080p
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {(['1080p', '720p', '360p'] as VideoResolution[]).map(res => {
                    const cfg = RESOLUTION_PRESETS[res];
                    const isSelected = resolution === res;
                    return (
                      <button
                        key={res}
                        onClick={() => setResolution(res)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20 shadow-xs'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-[var(--text-primary)]">{res}</span>
                          {res === '1080p' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                              Estándar
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-[var(--text-muted)] block">
                          {cfg.width} × {cfg.height}
                        </span>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-tight">
                          {cfg.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visualizer Effect Style */}
              <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
                <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Efecto de Audio Reactivo</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Algoritmo visual que responde a las frecuencias de guitarra, voz y dinámica rítmica.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {EFFECT_OPTIONS.map(opt => {
                    const isSelected = effect === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setEffect(opt.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20 shadow-xs'
                            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                        }`}
                      >
                        <span className="font-bold text-xs text-[var(--text-primary)] block mb-1">
                          {opt.name}
                        </span>
                        <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background Theme */}
              <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>Atmósfera y Fondo Visual</span>
                  </h3>
                  <label className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Cargar Imagen Propia</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
                  {THEME_OPTIONS.map(thm => {
                    const isSelected = theme === thm.id;
                    return (
                      <button
                        key={thm.id}
                        onClick={() => setTheme(thm.id)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                          isSelected
                            ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30'
                            : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${thm.gradient} shadow-inner border border-white/20`} />
                        <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate max-w-full">
                          {thm.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Typography & Overlays */}
              <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
                <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <Type className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Tipografía y Elementos de Pantalla</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Font Family */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      Estilo de Fuente de la Letra
                    </label>
                    <div className="flex gap-2">
                      {[
                        { id: 'serif', label: 'Serif Poético' },
                        { id: 'sans', label: 'Sans Limpio' },
                        { id: 'mono', label: 'Monospace' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setFontStyle(f.id as LyricFontStyle)}
                          className={`flex-1 py-2 text-xs rounded-lg border font-medium cursor-pointer transition-colors ${
                            fontStyle === f.id
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)]'
                              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Watermark Branding */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      Marca de Agua / Canal de YouTube
                    </label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="@tonygb · Cancionero"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-6 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showChords}
                      onChange={(e) => setShowChords(e.target.checked)}
                      className="rounded accent-[var(--accent-primary)]"
                    />
                    <span className="text-[var(--text-secondary)]">Mostrar cifrado de acordes sobre la letra</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showMetadataBadge}
                      onChange={(e) => setShowMetadataBadge(e.target.checked)}
                      className="rounded accent-[var(--accent-primary)]"
                    />
                    <span className="text-[var(--text-secondary)]">Cartela de título, autor y tono (superior izquierda)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showProgressBar}
                      onChange={(e) => setShowProgressBar(e.target.checked)}
                      className="rounded accent-[var(--accent-primary)]"
                    />
                    <span className="text-[var(--text-secondary)]">Barra de progreso de audio inferior</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 3. Export & Save Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6 max-w-2xl mx-auto py-4">
              {recordedVideoUrl ? (
                <div className="p-6 rounded-3xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] shadow-sm space-y-5 animate-fadeIn">
                  <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[var(--text-primary)]">
                        ¡Vídeo renderizado con éxito!
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        Resolución: {selectedResConfig.width}x{selectedResConfig.height} ({resolution}) · Peso: {Math.round((recordedBlob?.size || 0) / 1024 / 1024 * 10) / 10} MB
                      </p>
                    </div>
                  </div>

                  {/* Video Player Preview */}
                  <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-md">
                    <video
                      src={recordedVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      onClick={handleDownloadVideo}
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Vídeo para YouTube</span>
                    </button>

                    <button
                      onClick={handleSaveToDrive}
                      disabled={isUploadingToDrive}
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>
                        {isUploadingToDrive ? 'Subiendo a Google Drive...' : 'Guardar en Google Drive'}
                      </span>
                    </button>
                  </div>

                  {/* Google Drive Status Messages */}
                  {driveUploadSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{driveUploadSuccess}</span>
                    </div>
                  )}

                  {driveUploadError && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-fadeIn">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>{driveUploadError}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center rounded-3xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
                    <Film className="w-8 h-8" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                    Aún no has grabado el vídeo de la canción
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                    Puedes ajustar los parámetros en la pestaña anterior y pulsar "Grabar Vídeo". El sistema capturará el lienzo a {resolution} junto con el audio sincronizado.
                  </p>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-md"
                  >
                    Ir a la Previsualización
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Youtube className="w-4 h-4 text-red-500 shrink-0" />
            <span>Formato 16:9 optimizado para subida directa a YouTube Studio.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={() => {
                setActiveTab('preview');
                if (!isRecording) {
                  startRecording();
                } else {
                  stopRecording();
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${
                isRecording
                  ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>{isRecording ? 'Detener Grabación' : 'Grabar Vídeo YouTube (1080p)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
