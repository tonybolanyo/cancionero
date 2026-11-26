import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Song } from '../../types/song';
import { GoogleDriveService } from '../../services/googleDriveService';
import { getDiatonicChordsForKey } from '../../utils/songwriterHelper';
import {
  deriveVisualizerLyrics,
  parseSongDurationSeconds,
  RESOLUTION_PRESETS,
  sanitizeVideoFilename
} from './presets';
import { createInitialParticles, renderVisualizerFrame } from './canvasRenderer';
import {
  BackgroundTheme,
  LyricFontStyle,
  LyricFrameState,
  Particle,
  VideoResolution,
  VisualizerEffect
} from './types';

export interface UseVideoVisualizerRecorderParams {
  song: Song;
  isAuthor: boolean;
  resolution: VideoResolution;
  effect: VisualizerEffect;
  theme: BackgroundTheme;
  fontStyle: LyricFontStyle;
  showChords: boolean;
  showMetadataBadge: boolean;
  showProgressBar: boolean;
  watermarkText: string;
  customBgUrl: string | null;
  onRecordingComplete: () => void;
}

export function useVideoVisualizerRecorder({
  song,
  isAuthor,
  resolution,
  effect,
  theme,
  fontStyle,
  showChords,
  showMetadataBadge,
  showProgressBar,
  watermarkText,
  customBgUrl,
  onRecordingComplete
}: UseVideoVisualizerRecorderParams) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const parsedSongDuration = useMemo<number>(
    () => parseSongDurationSeconds(song.duration),
    [song.duration]
  );

  const [duration, setDuration] = useState<number>(parsedSongDuration);
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

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const mediaStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const monitorGainNodeRef = useRef<GainNode | null>(null);
  const keepAliveSourceRef = useRef<ConstantSourceNode | AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const peakCapsRef = useRef<number[]>([]);
  const customImgElementRef = useRef<HTMLImageElement | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const durationRef = useRef<number>(parsedSongDuration);
  const currentTimeRef = useRef<number>(0);
  const beatIndexRef = useRef<number>(-1);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!audioRef.current?.duration) {
      setDuration(parsedSongDuration);
    }
  }, [parsedSongDuration]);

  const syncedLyrics = useMemo(
    () => deriveVisualizerLyrics(song, showChords),
    [song, showChords]
  );

  // Resolve Audio Source
  useEffect(() => {
    if (!isAuthor) return;

    let isCancelled = false;
    let driveObjUrl: string | null = null;

    const resolveAudio = async () => {
      setIsLoadingAudio(true);
      setAudioError(null);

      try {
        if (customAudioFile) {
          const url = URL.createObjectURL(customAudioFile);
          driveObjUrl = url;
          if (!isCancelled) {
            setResolvedAudioUrl(url);
            setAudioSourceType('custom');
          }
          return;
        }

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
          } catch (driveErr) {
            console.warn('Google Drive audio unavailable:', driveErr);
          }
        }

        if (song.audioUrl && !song.audioUrl.startsWith('gdrive://') && !song.audioUrl.startsWith('blob:')) {
          if (!isCancelled) {
            setResolvedAudioUrl(song.audioUrl);
            setAudioSourceType('url');
          }
          return;
        }

        if (!isCancelled) {
          setResolvedAudioUrl('');
          setAudioSourceType('synthetic');
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setAudioError(err instanceof Error ? err.message : 'No se pudo cargar el audio.');
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
  }, [song.audioUrl, song.driveFileId, customAudioFile, isAuthor]);

  // Load custom background image
  useEffect(() => {
    if (!customBgUrl) {
      customImgElementRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = customBgUrl;
    img.onload = () => {
      customImgElementRef.current = img;
    };

    return () => {
      if (customBgUrl.startsWith('blob:')) {
        URL.revokeObjectURL(customBgUrl);
      }
    };
  }, [customBgUrl]);

  // Initialize Particles
  useEffect(() => {
    particlesRef.current = createInitialParticles(resolution, 90);
    peakCapsRef.current = new Array(64).fill(0);
  }, [resolution]);

  // Web Audio Context & Analyser Node Setup
  const setupAudioGraph = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        analyserRef.current = analyser;
      }

      if (!mediaStreamDestRef.current) {
        const mediaStreamDest = ctx.createMediaStreamDestination();
        mediaStreamDestRef.current = mediaStreamDest;

        try {
          if (typeof ctx.createConstantSource === 'function') {
            const keepAlive = ctx.createConstantSource();
            keepAlive.offset.value = 0.0;
            keepAlive.connect(mediaStreamDest);
            keepAlive.start();
            keepAliveSourceRef.current = keepAlive;
          } else {
            const silentBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            const silentSource = ctx.createBufferSource();
            silentSource.buffer = silentBuffer;
            silentSource.loop = true;
            silentSource.connect(mediaStreamDest);
            silentSource.start();
            keepAliveSourceRef.current = silentSource;
          }
        } catch (e) {
          console.warn('Keep-alive audio source initialization failed:', e);
        }
      }

      if (!monitorGainNodeRef.current && analyserRef.current) {
        const monitorGain = ctx.createGain();
        monitorGain.gain.value = isMuted ? 0 : 1;
        analyserRef.current.connect(monitorGain);
        monitorGain.connect(ctx.destination);
        monitorGainNodeRef.current = monitorGain;
      }

      if (analyserRef.current && mediaStreamDestRef.current) {
        try {
          analyserRef.current.connect(mediaStreamDestRef.current);
        } catch {
          // already connected
        }
      }

      if (audioRef.current && !sourceNodeRef.current && analyserRef.current) {
        try {
          const source = ctx.createMediaElementSource(audioRef.current);
          source.connect(analyserRef.current);
          sourceNodeRef.current = source;
        } catch (mediaElemErr) {
          console.warn('Could not connect media element to Web Audio:', mediaElemErr);
        }
      }
    } catch (err) {
      console.warn('AudioContext setup error (user interaction may be required):', err);
    }
  }, [isMuted]);

  useEffect(() => {
    if (monitorGainNodeRef.current && audioContextRef.current) {
      try {
        monitorGainNodeRef.current.gain.setValueAtTime(
          isMuted ? 0 : 1,
          audioContextRef.current.currentTime
        );
      } catch {
        // ignore audio context timing error
      }
    }
  }, [isMuted]);

  useEffect(() => {
    if (!isAuthor) return;
    if (resolvedAudioUrl && audioRef.current) {
      setupAudioGraph();
    }
  }, [resolvedAudioUrl, setupAudioGraph, isAuthor]);

  const getChordFrequencies = useCallback((chordName: string): number[] => {
    const noteFreqs: Record<string, number> = {
      'C': 130.81, 'C#': 138.59, 'Db': 138.59, 'D': 146.83, 'D#': 155.56, 'Eb': 155.56,
      'E': 164.81, 'F': 174.61, 'F#': 185.00, 'Gb': 185.00, 'G': 196.00, 'G#': 207.65,
      'Ab': 207.65, 'A': 220.00, 'A#': 233.08, 'Bb': 233.08, 'B': 246.94
    };

    const match = chordName.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return [110, 164.81, 220, 329.63];

    const root = match[1];
    const modifier = match[2] || '';
    const rootFreq = noteFreqs[root] || 130.81;
    const isMinor = modifier.includes('m') && !modifier.includes('maj');
    const is7th = modifier.includes('7');

    const thirdMult = isMinor ? 1.1892 : 1.2599;
    const fifthMult = 1.4983;
    const seventhMult = is7th ? 1.7818 : 2.0;

    return [
      rootFreq * 0.5,
      rootFreq,
      rootFreq * thirdMult,
      rootFreq * fifthMult,
      rootFreq * seventhMult
    ];
  }, []);

  const playProceduralAcousticBeat = useCallback((timeSeconds: number) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state !== 'running') return;

    const tempo = song.tempo || 96;
    const secondsPerBeat = 60 / tempo;
    const currentBeat = Math.floor(timeSeconds / secondsPerBeat);

    if (currentBeat === beatIndexRef.current) return;
    beatIndexRef.current = currentBeat;

    const diatonic = getDiatonicChordsForKey(song.key);
    const progression = diatonic.length >= 4
      ? [diatonic[0], diatonic[4] || diatonic[1], diatonic[5] || diatonic[2], diatonic[3] || diatonic[1]]
      : ['Am', 'F', 'C', 'G'];

    const chordIndex = Math.floor(currentBeat / 4) % progression.length;
    const currentChord = progression[chordIndex];
    const freqs = getChordFrequencies(currentChord);

    const stepInBar = currentBeat % 4;
    const noteFreq = freqs[stepInBar % freqs.length];

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = stepInBar === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(noteFreq, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.45);

      const now = ctx.currentTime;
      const noteGain = stepInBar === 0 ? 0.16 : 0.10;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(noteGain, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(filter);
      filter.connect(gain);

      if (analyserRef.current) gain.connect(analyserRef.current);
      if (mediaStreamDestRef.current) gain.connect(mediaStreamDestRef.current);
      if (monitorGainNodeRef.current) gain.connect(monitorGainNodeRef.current);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch {
      // Audio scheduling guard
    }
  }, [song.tempo, song.key, getChordFrequencies]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      } catch (err) {
        console.warn('requestData error:', err);
      }
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('MediaRecorder stop error:', err);
      }
    }
  }, []);

  const togglePlay = async () => {
    setupAudioGraph();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.warn('Could not resume AudioContext:', e);
      }
    }

    if (audioRef.current && resolvedAudioUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (err) {
          console.warn('Playback error:', err);
          setIsPlaying(true);
        }
      }
    } else {
      setIsPlaying(prev => !prev);
    }
  };

  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 100;
    const timer = window.setInterval(() => {
      const dur = durationRef.current || 180;

      if (!audioRef.current || !resolvedAudioUrl) {
        setCurrentTime(prevTime => {
          const nextTime = Math.round((prevTime + intervalMs / 1000) * 10) / 10;
          playProceduralAcousticBeat(nextTime);

          if (isRecordingRef.current && dur > 0) {
            const prog = Math.min(100, Math.max(0, Math.round((nextTime / dur) * 100)));
            setRecordingProgress(prog);
          }

          if (nextTime >= dur) {
            if (isRecordingRef.current) {
              stopRecording();
            } else {
              setIsPlaying(false);
            }
            return dur;
          }

          return nextTime;
        });
      } else {
        const cur = audioRef.current.currentTime;
        if (isRecordingRef.current && dur > 0) {
          const prog = Math.min(100, Math.max(0, Math.round((cur / dur) * 100)));
          setRecordingProgress(prog);
          if (cur >= dur - 0.25 || audioRef.current.ended) {
            stopRecording();
          }
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, resolvedAudioUrl, playProceduralAcousticBeat, stopRecording]);

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (audioRef.current && resolvedAudioUrl) {
      audioRef.current.currentTime = newTime;
    }
    const dur = durationRef.current || 180;
    if (dur > 0) {
      setRecordingProgress(Math.min(100, Math.max(0, Math.round((newTime / dur) * 100))));
    }
  };

  const currentLyricState = useMemo<LyricFrameState>(() => {
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

    return {
      active: activeIdx >= 0 ? syncedLyrics[activeIdx] : null,
      prev: activeIdx > 0 ? syncedLyrics[activeIdx - 1] : null,
      next: activeIdx + 1 < syncedLyrics.length ? syncedLyrics[activeIdx + 1] : null,
      activeIndex: activeIdx
    };
  }, [syncedLyrics, currentTime]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderVisualizerFrame({
      canvas,
      analyser: analyserRef.current,
      customImage: customImgElementRef.current,
      particles: particlesRef.current,
      peakCaps: peakCapsRef.current,
      isPlaying,
      hasRealAudio: Boolean(resolvedAudioUrl),
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
    });
  }, [
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
    if (!isAuthor) return;

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
  }, [renderFrame, isAuthor]);

  useEffect(() => {
    return () => {
      if (recordedVideoUrl && recordedVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore cleanup stop failure
        }
      }
      if (keepAliveSourceRef.current) {
        try {
          keepAliveSourceRef.current.stop();
        } catch {
          // ignore
        }
        keepAliveSourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
      setDuration(Math.round(audioRef.current.duration * 10) / 10);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      setCurrentTime(cur);
      const dur = durationRef.current || 180;
      if (isRecordingRef.current && dur > 0) {
        setRecordingProgress(Math.min(100, Math.max(0, Math.round((cur / dur) * 100))));
      }
      if (isRecordingRef.current && dur > 0 && cur >= dur - 0.25) {
        stopRecording();
      }
    }
  };

  const handleAudioEnded = () => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      setIsPlaying(false);
    }
  };

  const startRecording = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setupAudioGraph();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (err) {
        console.warn('AudioContext resume error:', err);
      }
    }

    setRecordedBlob(null);
    setRecordedVideoUrl(null);
    setDriveUploadSuccess(null);
    setDriveUploadError(null);
    recordedChunksRef.current = [];

    handleSeek(0);
    setRecordingProgress(0);

    try {
      renderFrame();
      const canvasStream = canvas.captureStream(30);

      let combinedStream: MediaStream;
      const audioTracks = mediaStreamDestRef.current?.stream.getAudioTracks() || [];
      if (audioTracks.length > 0) {
        combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...audioTracks
        ]);
      } else {
        combinedStream = canvasStream;
      }

      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4'
      ];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const options: MediaRecorderOptions = {
        videoBitsPerSecond: RESOLUTION_PRESETS[resolution].bitrate
      };
      if (selectedMime) {
        options.mimeType = selectedMime;
      }

      const recorder = new MediaRecorder(combinedStream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalType = selectedMime || 'video/webm';
        const finalBlob = new Blob(recordedChunksRef.current, { type: finalType });
        const videoUrl = URL.createObjectURL(finalBlob);
        setRecordedBlob(finalBlob);
        setRecordedVideoUrl(videoUrl);
        setIsRecording(false);
        isRecordingRef.current = false;
        onRecordingComplete();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(500);
      isRecordingRef.current = true;
      setIsRecording(true);

      if (audioRef.current && resolvedAudioUrl) {
        try {
          await audioRef.current.play();
        } catch (playErr) {
          console.warn('Playback error during recording:', playErr);
        }
      }
      setIsPlaying(true);
    } catch (err: unknown) {
      console.error('Error starting video recording:', err);
      setAudioError(
        `No se pudo iniciar la grabación del vídeo: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const handleDownloadVideo = () => {
    if (!recordedBlob) return;
    const filename = sanitizeVideoFilename(song.title, resolution, recordedBlob.type);
    const a = document.createElement('a');
    const url = URL.createObjectURL(recordedBlob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSaveToDrive = async () => {
    if (!recordedBlob) return;

    setIsUploadingToDrive(true);
    setDriveUploadError(null);
    setDriveUploadSuccess(null);

    try {
      if (!GoogleDriveService.isConnected()) {
        await GoogleDriveService.signInWithGoogle();
      }

      const filename = sanitizeVideoFilename(song.title, resolution, recordedBlob.type);

      const result = await GoogleDriveService.uploadVideo(recordedBlob, filename, {
        songTitle: song.title,
        description: `Vídeo oficial para YouTube de "${song.title}" (${resolution}) generado con Cancionero de versos perdidos`
      });

      setDriveUploadSuccess(`Vídeo guardado con éxito en Google Drive: "${result.name}"`);
    } catch (err: unknown) {
      console.error('Error uploading video to Google Drive:', err);
      setDriveUploadError(err instanceof Error ? err.message : 'Error al guardar en Google Drive.');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAudioFile(file);
    }
  };

  return {
    canvasRef,
    audioRef,
    isPlaying,
    currentTime,
    duration,
    isMuted,
    setIsMuted,
    resolvedAudioUrl,
    audioSourceType,
    customAudioFile,
    isLoadingAudio,
    audioError,
    setAudioError,
    setIsPlaying,
    isRecording,
    recordingProgress,
    recordedBlob,
    recordedVideoUrl,
    isUploadingToDrive,
    driveUploadSuccess,
    driveUploadError,
    togglePlay,
    handleSeek,
    startRecording,
    stopRecording,
    handleDownloadVideo,
    handleSaveToDrive,
    handleCustomAudioUpload,
    handleLoadedMetadata,
    handleTimeUpdate,
    handleAudioEnded
  };
}
