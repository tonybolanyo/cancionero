import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Upload,
  Music,
  Sparkles,
  Gauge,
  KeyRound,
  Layers,
  Clock,
  Check,
  AlertCircle,
  FileAudio,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
  BarChart3,
  Cpu,
  Download,
  Activity,
  Undo2,
  ChevronDown,
  ChevronUp,
  Info,
  Repeat,
  ArrowRight
} from 'lucide-react';
import { AudioAnalysisResult } from '../utils/webAudioAnalyzer';
import { AudioAnalysisService } from '../services/audioAnalysisService';
import { SavedAudioAnalysis } from '../types/song';
import { TempoAnalysis, analyzeTempo, decodeAudioBuffer } from '../lib/audio/tempo';
import { BeatAnalysis, analyzeBeatsAndOnsets } from '../lib/audio/onsets';
import { useKeyAnalysis } from '../hooks/useKeyAnalysis';
import { BeatTimeline } from './BeatTimeline';
import { ChordSegment, exportChordsToJSON, exportChordsToCSV, downloadChordExport } from '../lib/audio/chords';
import { PitchShiftPlayer, AudioEqMode } from '../lib/audio/pitchShiftPlayer';
import { AccidentalPreference, respellChord, isValidPlayableAudioUrl } from '../utils/markdownParser';
import {
  MeterAnalysis,
  estimateMeter,
  recalculateDownbeats,
  TimeSignature,
  COMMON_TIME_SIGNATURES_LIST,
  UNCOMMON_TIME_SIGNATURES_LIST,
  getMeterDescription,
  computeMedianBeatInterval
} from '../lib/audio/meter';
import type { MusicalSection, StructureAnalysisResult } from '../lib/audio/structure';
import { analyzeStructureWithWorker } from '../lib/audio/structureWorkerClient';
import { ChromaticTunerModal } from './ChromaticTunerModal';
import {
  buildTimedChordEventsFromSegments,
  exportChordsToMidiBytes,
  downloadMidiFile
} from '../lib/music/midiExporter';

const CHROMATIC_NOTES_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_NOTES_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

type AnalyzerTab = 'chords' | 'rhythm' | 'advanced';

interface AudioAnalyzerSectionProps {
  onApplyDetection: (data: {
    tempo: number;
    key: string;
    timeSignature: string;
    tuning?: string;
    audioUrl?: string;
    chordProgression?: string;
    suggestedLyricsChords?: string;
    tempoOffset?: number;
    chords?: ChordSegment[];
    audioAnalysis?: SavedAudioAnalysis;
  }) => void;
  onInsertChordsIntoLyrics?: (chords: ChordSegment[], sections?: MusicalSection[]) => void;
  canUndoInsertChords?: boolean;
  onUndoInsertChords?: () => void;
  savedAudioAnalysis?: SavedAudioAnalysis;
  currentKey?: string;
  currentTempo?: string;
  currentAudioUrl?: string;
  driveFileId?: string;
  driveFileName?: string;
  onAudioFileSelected?: (file: File) => void;
  onReanalyzeDriveAudio?: () => Promise<void>;
  isDriveLoading?: boolean;
  externalAudioFile?: File | null;
  embedded?: boolean;
  onRequestAudioUpload?: () => void;
}

export const AudioAnalyzerSection: React.FC<AudioAnalyzerSectionProps> = ({
  onApplyDetection,
  onInsertChordsIntoLyrics,
  canUndoInsertChords,
  onUndoInsertChords,
  savedAudioAnalysis,
  currentKey,
  currentTempo,
  currentAudioUrl,
  driveFileId,
  driveFileName,
  onAudioFileSelected,
  onReanalyzeDriveAudio,
  isDriveLoading,
  externalAudioFile,
  embedded = false,
  onRequestAudioUpload
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>(currentAudioUrl || '');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysisResult | null>(null);
  const [applied, setApplied] = useState<boolean>(false);
  const [appliedTempo, setAppliedTempo] = useState<boolean>(false);
  const [appliedKey, setAppliedKey] = useState<boolean>(false);
  const [appliedMeter, setAppliedMeter] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // UI Navigation & Menus
  const [activeTab, setActiveTab] = useState<AnalyzerTab>('chords');
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showChromaChart, setShowChromaChart] = useState<boolean>(false);
  const [isTimelineVisible, setIsTimelineVisible] = useState<boolean>(true);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Dedicated Tempo (web-audio-beat-detector) states
  const [tempoAnalysis, setTempoAnalysis] = useState<TempoAnalysis | null>(null);
  const [isCalculatingTempo, setIsCalculatingTempo] = useState<boolean>(false);
  const [tempoError, setTempoError] = useState<string | null>(null);
  const [minTempo, setMinTempo] = useState<number>(60);
  const [maxTempo, setMaxTempo] = useState<number>(180);

  // Onsets & Beat Grid (@audio/beat) states
  const [decodedAudioBuffer, setDecodedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [beatAnalysis, setBeatAnalysis] = useState<BeatAnalysis | null>(null);
  const [isAnalyzingBeats, setIsAnalyzingBeats] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Key & Scale estimation with Essentia.js WASM Web Worker
  const {
    keyAnalysis,
    isAnalyzingKey,
    keyError,
    analyzeKey,
    resetKeyAnalysis
  } = useKeyAnalysis();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pitch-Shifting, Speed, Loop, EQ & Enharmonic Preference states
  const [pitchShiftSemitones, setPitchShiftSemitones] = useState<number>(0);
  const [preserveTempo, setPreserveTempo] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [eqMode, setEqMode] = useState<AudioEqMode>('normal');
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [isTunerOpen, setIsTunerOpen] = useState<boolean>(false);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');
  const playerRef = useRef<PitchShiftPlayer | null>(null);

  // Meter & Downbeats estimation state
  const [meterAnalysis, setMeterAnalysis] = useState<MeterAnalysis | null>(null);

  // Musical Structure Analysis (Self-Similarity Matrix in Web Worker)
  const [structureAnalysis, setStructureAnalysis] = useState<StructureAnalysisResult | null>(null);
  const [isAnalyzingStructure, setIsAnalyzingStructure] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  useEffect(() => {
    const el = timelineContainerRef.current;
    if (!el || !file) {
      setIsTimelineVisible(false);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setIsTimelineVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTimelineVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [file]);

  useEffect(() => {
    if (decodedAudioBuffer) {
      if (!playerRef.current) {
        playerRef.current = new PitchShiftPlayer({
          semitones: pitchShiftSemitones,
          preserveTempo: preserveTempo,
          playbackRate,
          eqMode,
          onTimeUpdate: (t) => setCurrentTime(t),
          onEnded: () => setIsPlaying(false),
          onStateChange: (playing) => setIsPlaying(playing)
        });
      }
      playerRef.current.setBuffer(decodedAudioBuffer);
    }
  }, [decodedAudioBuffer]);

  // Refine meter estimation and SSM structure when chords become available from keyAnalysis
  useEffect(() => {
    if (decodedAudioBuffer && beatAnalysis && beatAnalysis.beats.length > 0) {
      if (meterAnalysis?.confidence !== 1.0) {
        try {
          const refined = estimateMeter({
            beats: beatAnalysis.beats,
            onsets: beatAnalysis.onsets,
            audioBuffer: decodedAudioBuffer,
            bpm: beatAnalysis.tempo,
            chords: keyAnalysis?.chords
          });
          setMeterAnalysis(refined);
        } catch (err) {
          console.warn('Refined meter error:', err);
        }
      }
    }

    if (decodedAudioBuffer && keyAnalysis?.chords && keyAnalysis.chords.length > 0) {
      let cancelled = false;
      setIsAnalyzingStructure(true);
      analyzeStructureWithWorker({
        audioBuffer: decodedAudioBuffer,
        options: {
          beats: beatAnalysis?.beats,
          downbeats: meterAnalysis?.downbeats,
          chords: keyAnalysis.chords,
          duration: decodedAudioBuffer.duration
        }
      })
        .then(structRes => {
          if (!cancelled) {
            setStructureAnalysis(structRes);
          }
        })
        .catch(err => {
          console.warn('Refined structure analysis warning:', err);
        })
        .finally(() => {
          if (!cancelled) {
            setIsAnalyzingStructure(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [keyAnalysis?.chords]);

  const handleManualMeterChange = (newMeter: TimeSignature) => {
    if (!beatAnalysis || beatAnalysis.beats.length === 0) return;
    const beatIOI = computeMedianBeatInterval(beatAnalysis.beats, beatAnalysis.tempo);
    let gridMode: 'beat' | 'subdivision2x' | 'subdivision3x' = 'beat';
    if (meterAnalysis?.meter === newMeter && meterAnalysis.gridMode) {
      gridMode = meterAnalysis.gridMode;
    } else if ((newMeter === '5/8' || newMeter === '7/8') && beatIOI >= 0.36) {
      gridMode = 'subdivision2x';
    }

    const newDownbeats = recalculateDownbeats(
      beatAnalysis.beats,
      newMeter,
      meterAnalysis?.phase ?? 0,
      { gridMode }
    );
    setMeterAnalysis({
      meter: newMeter,
      confidence: 1.0,
      downbeats: newDownbeats,
      barCount: newDownbeats.length,
      phase: meterAnalysis?.phase ?? 0,
      grouping: meterAnalysis?.meter === newMeter ? meterAnalysis.grouping : undefined,
      gridMode,
      candidates: meterAnalysis?.candidates
    });
  };

  const handlePitchShiftChange = (semitones: number) => {
    const clamped = Math.max(-12, Math.min(12, semitones));
    setPitchShiftSemitones(clamped);
    playerRef.current?.setPitch(clamped);
  };

  const handleTogglePreserveTempo = () => {
    setPreserveTempo(prev => {
      const next = !prev;
      playerRef.current?.setPreserveTempo(next);
      return next;
    });
  };

  const handleToggleAccidentalPreference = () => {
    setAccidentalPreference(prev => prev === 'sharps' ? 'flats' : 'sharps');
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    playerRef.current?.setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleEqModeChange = (mode: AudioEqMode) => {
    setEqMode(mode);
    playerRef.current?.setEqMode(mode);
  };

  const handleSetLoopA = () => {
    const t = Number(currentTime.toFixed(2));
    setLoopStart(t);
    const nextEnd = loopEnd !== null && loopEnd > t + 0.2 ? loopEnd : null;
    setLoopEnd(nextEnd);
    playerRef.current?.setLoop(t, nextEnd);
  };

  const handleSetLoopB = () => {
    const t = Number(currentTime.toFixed(2));
    const start = loopStart ?? 0;
    const end = t > start + 0.2 ? t : Math.min(duration || 60, start + 4);
    setLoopStart(start);
    setLoopEnd(end);
    playerRef.current?.setLoop(start, end);
  };

  const handleClearLoop = () => {
    setLoopStart(null);
    setLoopEnd(null);
    playerRef.current?.clearLoop();
  };

  const handleCalculateTempo = async (overrideFile?: File, customMin?: number, customMax?: number) => {
    const targetFile = overrideFile || file;
    if (!targetFile) return;

    setIsCalculatingTempo(true);
    setIsAnalyzingBeats(true);
    setTempoError(null);

    let ctx: AudioContext | null = null;
    try {
      const { audioBuffer, audioContext } = await decodeAudioBuffer(targetFile);
      ctx = audioContext;
      setDecodedAudioBuffer(audioBuffer);
      setDuration(audioBuffer.duration);

      const minT = customMin ?? minTempo;
      const maxT = customMax ?? maxTempo;

      // 1. Analyze tempo & beat offset with web-audio-beat-detector
      const res = await analyzeTempo(audioBuffer, {
        minTempo: minT,
        maxTempo: maxT
      });
      setTempoAnalysis(res);
      setAnalysisResult(prev =>
        prev
          ? {
              ...prev,
              tempo: res.bpm,
              tempoOffset: res.offset,
              rawTempo: res.tempo
            }
          : null
      );

      // 2. Analyze onsets and beat grid with @audio/beat via Web Worker
      let detectedBeats: number[] | undefined;
      let detectedDownbeats: number[] | undefined;
      try {
        const beats = await analyzeBeatsAndOnsets(audioBuffer, {
          minBpm: minT,
          maxBpm: maxT
        });
        setBeatAnalysis(beats);
        detectedBeats = beats.beats;

        // 2b. Estimate musical meter
        try {
          const estimatedMeter = estimateMeter({
            beats: beats.beats,
            onsets: beats.onsets,
            audioBuffer,
            bpm: beats.tempo
          });
          setMeterAnalysis(estimatedMeter);
          detectedDownbeats = estimatedMeter.downbeats;
        } catch (meterErr: any) {
          console.warn('Meter estimation warning:', meterErr);
        }
      } catch (beatErr: any) {
        console.warn('Onsets / Beat grid analysis warning:', beatErr);
      }

      // 3. Analyze Key & Scale with Essentia.js WASM via Web Worker
      void analyzeKey(audioBuffer, detectedBeats);

      // 4. Analyze Musical Structure via Web Worker
      setIsAnalyzingStructure(true);
      void analyzeStructureWithWorker({
        audioBuffer,
        options: {
          beats: detectedBeats,
          downbeats: detectedDownbeats,
          duration: audioBuffer.duration
        }
      })
        .then(structRes => {
          setStructureAnalysis(structRes);
        })
        .catch(structErr => {
          console.warn('Structure analysis warning:', structErr);
        })
        .finally(() => {
          setIsAnalyzingStructure(false);
        });
    } catch (err: any) {
      setTempoError(err.message || 'Error al calcular tempo y offset del primer beat.');
    } finally {
      if (ctx && ctx.state !== 'closed') {
        try {
          await ctx.close();
        } catch {}
      }
      setIsCalculatingTempo(false);
      setIsAnalyzingBeats(false);
    }
  };

  // Unified effective chords & sections across engines (Essentia -> Gemini/AI -> Saved)
  const effectiveChords = useMemo<ChordSegment[]>(() => {
    if (keyAnalysis?.chords && keyAnalysis.chords.length > 0) {
      return keyAnalysis.chords;
    }
    if (analysisResult?.chords && analysisResult.chords.length > 0) {
      return analysisResult.chords.map((c, idx, arr) => {
        const start = typeof c.seconds === 'number' ? c.seconds : idx * 3.0;
        const nextStart = arr[idx + 1]?.seconds;
        const end = typeof nextStart === 'number' ? nextStart : start + 3.0;
        return {
          startTime: start,
          endTime: end,
          chord: c.chord,
          confidence: 0.9
        };
      });
    }
    if (savedAudioAnalysis?.chords && savedAudioAnalysis.chords.length > 0) {
      return savedAudioAnalysis.chords;
    }
    return [];
  }, [keyAnalysis?.chords, analysisResult?.chords, savedAudioAnalysis?.chords]);

  const effectiveSections = useMemo<MusicalSection[]>(() => {
    if (structureAnalysis?.sections && structureAnalysis.sections.length > 0) {
      return structureAnalysis.sections;
    }
    if (analysisResult?.sections && analysisResult.sections.length > 0) {
      return analysisResult.sections;
    }
    if (savedAudioAnalysis?.sections && savedAudioAnalysis.sections.length > 0) {
      return savedAudioAnalysis.sections;
    }
    return [];
  }, [structureAnalysis?.sections, analysisResult?.sections, savedAudioAnalysis?.sections]);

  const handleExportChordsJSON = () => {
    if (effectiveChords.length === 0) return;
    const baseName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'chords';
    const jsonStr = exportChordsToJSON(effectiveChords, baseName);
    downloadChordExport(jsonStr, `${baseName}_acordes.json`, 'application/json');
    setShowExportMenu(false);
  };

  const handleExportChordsCSV = () => {
    if (effectiveChords.length === 0) return;
    const baseName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'chords';
    const csvStr = exportChordsToCSV(effectiveChords);
    downloadChordExport(csvStr, `${baseName}_acordes.csv`, 'text/csv');
    setShowExportMenu(false);
  };

  const handleExportChordsMIDI = (overrideChords?: ChordSegment[], overrideSections?: MusicalSection[]) => {
    const sourceChords = overrideChords || effectiveChords;
    if (!sourceChords || sourceChords.length === 0) return;

    const respelledChords: ChordSegment[] = sourceChords.map(seg => ({
      ...seg,
      chord: respellChord(seg.chord, accidentalPreference)
    }));
    const sectionsList = overrideSections || effectiveSections;
    const events = buildTimedChordEventsFromSegments(respelledChords, sectionsList);
    if (events.length === 0) return;

    const baseName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'acordes-detectados';
    const bpm =
      tempoAnalysis?.bpm ||
      analysisResult?.tempo ||
      savedAudioAnalysis?.tempo ||
      (currentTempo ? parseInt(currentTempo, 10) : 96) ||
      96;
    const meter =
      meterAnalysis?.meter ||
      analysisResult?.timeSignature ||
      savedAudioAnalysis?.timeSignature ||
      '4/4';

    const midiBytes = exportChordsToMidiBytes(events, {
      title: baseName,
      tempo: bpm,
      timeSignature: meter,
      instrument: 'guitar',
      tuning: analysisResult?.tuning || savedAudioAnalysis?.tuning
    });
    downloadMidiFile(midiBytes, `${baseName}_acordes.mid`);
    setShowExportMenu(false);
  };

  const handleSeek = (targetTime: number) => {
    if (playerRef.current && decodedAudioBuffer) {
      playerRef.current.seek(targetTime);
    } else if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
    setCurrentTime(targetTime);
  };

  const handleFileSelected = (selectedFile: File, notifyParent: boolean = true) => {
    setError(null);
    setApplied(false);
    setAppliedTempo(false);
    setAppliedKey(false);
    setAppliedMeter(false);
    setAnalysisResult(null);
    setTempoAnalysis(null);
    setTempoError(null);
    setDecodedAudioBuffer(null);
    setBeatAnalysis(null);
    setMeterAnalysis(null);
    setStructureAnalysis(null);
    setIsAnalyzingStructure(false);
    resetKeyAnalysis();
    setCurrentTime(0);
    setLoopStart(null);
    setLoopEnd(null);
    if (playerRef.current) {
      playerRef.current.clearLoop();
      playerRef.current.pause();
      playerRef.current.seek(0);
    }

    const validExtensions = ['.mp3', '.wav'];
    const hasValidExt = validExtensions.some(ext =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt && !selectedFile.type.includes('audio')) {
      setError('Por favor selecciona un archivo con extensión .mp3 o .wav');
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setAudioUrl(objectUrl);

    if (notifyParent && onAudioFileSelected) {
      onAudioFileSelected(selectedFile);
    }

    // Auto calculate tempo & beat offset, onsets and key in background
    void handleCalculateTempo(selectedFile);
  };

  useEffect(() => {
    if (externalAudioFile && externalAudioFile !== file) {
      handleFileSelected(externalAudioFile, false);
    } else if (!externalAudioFile && embedded && file) {
      setFile(null);
      setAudioUrl(currentAudioUrl || '');
    }
  }, [externalAudioFile]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleRunAnalysis = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setApplied(false);
    setProgressMessage('Preparando archivo...');

    try {
      const result = await AudioAnalysisService.analyzeAudio(file, (stage, msg) => {
        setProgressMessage(msg);
      });

      setAnalysisResult(result);
      if (result.sections && result.sections.length > 0 && !structureAnalysis) {
        setStructureAnalysis({
          sections: result.sections,
          noveltyCurve: [],
          boundaries: result.sections.map(s => s.startTime),
          algorithm: 'Self-Similarity Matrix (SSM) + Checkerboard Novelty'
        });
      }
      if (result.tempoOffset !== undefined) {
        setTempoAnalysis({
          bpm: result.tempo,
          offset: result.tempoOffset,
          tempo: result.rawTempo ?? result.tempo
        });
      } else if (!tempoAnalysis) {
        void handleCalculateTempo(file);
      }
    } catch (err: any) {
      setError(err.message || 'Error al analizar el archivo de audio.');
    } finally {
      setIsAnalyzing(false);
      setProgressMessage('');
    }
  };

  const getEffectiveKey = () => {
    let raw = analysisResult?.key || savedAudioAnalysis?.key || currentKey || 'Am';
    if (keyAnalysis) {
      raw = keyAnalysis.scale === 'minor'
        ? (keyAnalysis.key.endsWith('m') ? keyAnalysis.key : `${keyAnalysis.key}m`)
        : keyAnalysis.key.replace(/m$/, '');
    }
    return respellChord(raw, accidentalPreference);
  };

  const getChordProgressionSummary = (): string | undefined => {
    if (effectiveChords.length > 0) {
      const seq: string[] = [];
      for (const s of effectiveChords) {
        const chordName = respellChord(s.chord, accidentalPreference);
        if (seq.length === 0 || seq[seq.length - 1] !== chordName) {
          seq.push(chordName);
        }
      }
      return seq.slice(0, 8).join(' - ');
    }
    return analysisResult?.chordProgression || savedAudioAnalysis?.chordProgression;
  };

  const handleApplyOnlyTempo = () => {
    const bpm = tempoAnalysis?.bpm ?? analysisResult?.tempo ?? savedAudioAnalysis?.tempo;
    if (!bpm) return;
    onApplyDetection({
      tempo: bpm,
      key: getEffectiveKey(),
      timeSignature: meterAnalysis?.meter || analysisResult?.timeSignature || savedAudioAnalysis?.timeSignature || '4/4',
      tuning: analysisResult?.tuning || savedAudioAnalysis?.tuning || 'Estándar (EADGBE)',
      audioUrl: audioUrl || undefined,
      chordProgression: getChordProgressionSummary(),
      suggestedLyricsChords: analysisResult?.suggestedLyricsChords,
      tempoOffset: tempoAnalysis?.offset ?? analysisResult?.tempoOffset
    });
    setAppliedTempo(true);
    setTimeout(() => setAppliedTempo(false), 2500);
  };

  const handleApplyOnlyMeter = () => {
    const meter = meterAnalysis?.meter ?? analysisResult?.timeSignature ?? savedAudioAnalysis?.timeSignature;
    if (!meter) return;
    onApplyDetection({
      tempo: tempoAnalysis?.bpm || analysisResult?.tempo || savedAudioAnalysis?.tempo || 120,
      key: getEffectiveKey(),
      timeSignature: meter,
      tuning: analysisResult?.tuning || savedAudioAnalysis?.tuning || 'Estándar (EADGBE)',
      audioUrl: audioUrl || undefined,
      chordProgression: getChordProgressionSummary(),
      suggestedLyricsChords: analysisResult?.suggestedLyricsChords,
      tempoOffset: tempoAnalysis?.offset ?? analysisResult?.tempoOffset,
      chords: effectiveChords.length > 0 ? effectiveChords : undefined
    });
    setAppliedMeter(true);
    setTimeout(() => setAppliedMeter(false), 2500);
  };

  const handleApplyOnlyKey = () => {
    if (!keyAnalysis && !analysisResult?.key && !savedAudioAnalysis?.key) return;
    const key = getEffectiveKey();
    onApplyDetection({
      tempo: tempoAnalysis?.bpm || analysisResult?.tempo || savedAudioAnalysis?.tempo || 120,
      key,
      timeSignature: meterAnalysis?.meter || analysisResult?.timeSignature || savedAudioAnalysis?.timeSignature || '4/4',
      tuning: analysisResult?.tuning || savedAudioAnalysis?.tuning || 'Estándar (EADGBE)',
      audioUrl: audioUrl || undefined,
      chordProgression: getChordProgressionSummary(),
      suggestedLyricsChords: analysisResult?.suggestedLyricsChords,
      tempoOffset: tempoAnalysis?.offset ?? analysisResult?.tempoOffset,
      chords: effectiveChords.length > 0 ? effectiveChords : undefined
    });
    setAppliedKey(true);
    setTimeout(() => setAppliedKey(false), 2500);
  };

  const handleApplyAll = () => {
    if (!analysisResult && !tempoAnalysis && !keyAnalysis && !meterAnalysis && !savedAudioAnalysis) return;

    const resolvedTempo: number = tempoAnalysis?.bpm || analysisResult?.tempo || savedAudioAnalysis?.tempo || 120;
    const resolvedKey: string = getEffectiveKey();
    const resolvedTimeSignature: string = meterAnalysis?.meter || analysisResult?.timeSignature || savedAudioAnalysis?.timeSignature || '4/4';

    const completeAudioAnalysis: SavedAudioAnalysis = {
      analyzedAt: new Date().toISOString(),
      source: analysisResult?.source || (keyAnalysis ? 'essentia_wasm' : savedAudioAnalysis?.source || 'client_dsp'),
      tempo: resolvedTempo,
      tempoConfidence: tempoAnalysis ? 0.95 : analysisResult?.tempoConfidence ?? savedAudioAnalysis?.tempoConfidence,
      tempoOffset: tempoAnalysis?.offset ?? analysisResult?.tempoOffset ?? savedAudioAnalysis?.tempoOffset,
      rawTempo: tempoAnalysis?.tempo ?? analysisResult?.rawTempo ?? savedAudioAnalysis?.rawTempo,
      key: resolvedKey,
      scale: keyAnalysis?.scale === 'minor' ? 'Menor' : keyAnalysis?.scale === 'major' ? 'Mayor' : (analysisResult?.scale || savedAudioAnalysis?.scale),
      timeSignature: resolvedTimeSignature,
      tuning: analysisResult?.tuning || savedAudioAnalysis?.tuning || 'Estándar (EADGBE)',
      detuningCents: keyAnalysis?.detuningCents ?? analysisResult?.detuningCents ?? savedAudioAnalysis?.detuningCents,
      referenceA4Hz: keyAnalysis?.referenceA4Hz ?? analysisResult?.referenceA4Hz ?? savedAudioAnalysis?.referenceA4Hz,
      durationSeconds: duration || analysisResult?.durationSeconds || savedAudioAnalysis?.durationSeconds,
      chordProgression: getChordProgressionSummary(),
      chords: effectiveChords.length > 0 ? effectiveChords : undefined,
      sections: effectiveSections.length > 0 ? effectiveSections : undefined,
      musicalNotes: analysisResult?.musicalNotes || savedAudioAnalysis?.musicalNotes || (keyAnalysis ? `Tonalidad ${resolvedKey} analizada con Essentia WASM.` : undefined)
    };

    onApplyDetection({
      tempo: resolvedTempo,
      key: resolvedKey,
      timeSignature: resolvedTimeSignature,
      tuning: completeAudioAnalysis.tuning,
      audioUrl: audioUrl || undefined,
      chordProgression: completeAudioAnalysis.chordProgression,
      suggestedLyricsChords: analysisResult?.suggestedLyricsChords,
      tempoOffset: completeAudioAnalysis.tempoOffset,
      chords: effectiveChords.length > 0 ? effectiveChords : undefined,
      audioAnalysis: completeAudioAnalysis
    });

    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const togglePlayback = () => {
    if (playerRef.current && decodedAudioBuffer) {
      if (isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Playback error', err);
      });
    }
  };

  // Derived display values for the unified Summary Card
  const displayTempo = tempoAnalysis?.bpm ?? analysisResult?.tempo ?? savedAudioAnalysis?.tempo ?? null;
  const displayOffset = tempoAnalysis?.offset ?? analysisResult?.tempoOffset ?? savedAudioAnalysis?.tempoOffset;
  const displayMeter = meterAnalysis?.meter ?? (analysisResult?.timeSignature as TimeSignature | undefined) ?? (savedAudioAnalysis?.timeSignature as TimeSignature | undefined) ?? null;
  const displayKey = (keyAnalysis || analysisResult?.key || savedAudioAnalysis?.key) ? getEffectiveKey() : null;
  const displayScale = keyAnalysis
    ? (keyAnalysis.scale === 'minor' ? 'Menor Natural' : 'Mayor Natural')
    : (analysisResult?.scale || savedAudioAnalysis?.scale || null);
  const progressionSummary = getChordProgressionSummary();

  const isAnyLocalAnalyzing = isCalculatingTempo || isAnalyzingBeats || isAnalyzingKey || isAnalyzingStructure;
  const hasAnyAnalysisData = Boolean(
    tempoAnalysis ||
    meterAnalysis ||
    keyAnalysis ||
    analysisResult ||
    (!file && savedAudioAnalysis)
  );

  const formatClock = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeChordIndex = effectiveChords.findIndex(c => currentTime >= c.startTime && currentTime < c.endTime);
  const activeChordNow = activeChordIndex >= 0 ? effectiveChords[activeChordIndex] : undefined;
  const nextChordNow = (() => {
    if (effectiveChords.length === 0) return undefined;
    if (activeChordIndex >= 0) {
      const currentName = respellChord(effectiveChords[activeChordIndex].chord, accidentalPreference);
      for (let i = activeChordIndex + 1; i < effectiveChords.length; i++) {
        if (respellChord(effectiveChords[i].chord, accidentalPreference) !== currentName) {
          return effectiveChords[i];
        }
      }
      return undefined;
    }
    return effectiveChords.find(c => c.startTime > currentTime);
  })();
  const activeSectionNow = effectiveSections.find(s => currentTime >= s.startTime && currentTime < s.endTime);
  const hasPlayableAudio = Boolean(file || isValidPlayableAudioUrl(audioUrl));
  const showMobileMiniPlayer = hasPlayableAudio && !isTunerOpen && (!file || !isTimelineVisible);

  return (
    <div className={`space-y-4 text-xs transition-colors duration-200 ${showMobileMiniPlayer ? 'pb-20 sm:pb-0' : ''}`}>
      {/* Compact Header (hidden when embedded in SongEditorPage to avoid duplicate titles) */}
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-subtle)]">
          <div className="min-w-0">
            <h4 className="font-serif font-bold text-sm sm:text-base text-[var(--text-primary)]">
              Análisis musical del audio
            </h4>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">
              Tempo, compás, tonalidad y progresión armónica en un solo panel
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsTunerOpen(true)}
            className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Afinador
          </button>
        </div>
      )}

      {/* Unified Error States */}
      {(error || tempoError || keyError) && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300 space-y-1.5 text-xs">
          {error && (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span className="flex-1">{error}</span>
            </div>
          )}
          {tempoError && !isCalculatingTempo && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>Ritmo: {tempoError}</span>
              </span>
              <button
                type="button"
                onClick={() => handleCalculateTempo()}
                className="underline font-semibold cursor-pointer shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}
          {keyError && !isAnalyzingKey && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>Tonalidad: {keyError}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (decodedAudioBuffer) void analyzeKey(decodedAudioBuffer);
                  else if (file) void handleCalculateTempo(file);
                }}
                className="underline font-semibold cursor-pointer shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Unified Audio Source / Dropzone (when standalone) OR Compact Action Bar (when embedded) */}
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
          {file ? (
            <>
              <span className="text-xs text-[var(--text-secondary)]">
                Audio listo para análisis armónico y rítmico
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTunerOpen(true)}
                  className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Afinador
                </button>
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  className="min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                      <span>Analizando…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{analysisResult ? 'Reanalizar IA' : 'Análisis completo IA'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : driveFileId ? (
            <>
              <span className="text-xs text-[var(--text-secondary)] truncate">
                Maqueta en Drive: <strong className="text-[var(--text-primary)]">{driveFileName || 'Audio privado'}</strong>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTunerOpen(true)}
                  className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Afinador
                </button>
                {onReanalyzeDriveAudio && (
                  <button
                    type="button"
                    onClick={() => void onReanalyzeDriveAudio()}
                    disabled={isDriveLoading}
                    className="min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isDriveLoading ? 'Cargando…' : 'Reanalizar de Drive'}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-[var(--text-secondary)]">
                Sube una maqueta en el panel superior para analizar tempo, tonalidad y acordes.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTunerOpen(true)}
                  className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Afinador
                </button>
                {onRequestAudioUpload && (
                  <button
                    type="button"
                    onClick={onRequestAudioUpload}
                    className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir audio</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !file && !driveFileId && fileInputRef.current?.click()}
          className={`p-3.5 sm:p-4 rounded-xl border transition-colors ${
            file || driveFileId
              ? 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)]'
              : 'border-2 border-dashed bg-[var(--bg-modal)]/60 border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface)] cursor-pointer text-center flex flex-col items-center justify-center gap-2 py-6'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelected(e.target.files[0]);
              }
            }}
            accept=".mp3,.wav,audio/mp3,audio/wav,audio/mpeg"
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] flex items-center justify-center shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase text-[var(--accent-primary)] font-semibold">
                      {file.name.split('.').pop()}
                    </span>
                    {duration > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatClock(duration)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunAnalysis();
                  }}
                  disabled={isAnalyzing}
                  className="min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                      <span>Analizando…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{analysisResult ? 'Reanalizar IA' : 'Análisis completo'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setAudioUrl('');
                    setAnalysisResult(null);
                    setTempoAnalysis(null);
                    setBeatAnalysis(null);
                    setMeterAnalysis(null);
                    setStructureAnalysis(null);
                    resetKeyAnalysis();
                    if (audioRef.current) audioRef.current.pause();
                  }}
                  className="min-h-[40px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer font-medium whitespace-nowrap"
                  title="Quitar archivo"
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : driveFileId ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                    {driveFileName || 'Maqueta guardada en Google Drive'}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Google Drive privado · Lista para reanalizar sin volver a subirla
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onReanalyzeDriveAudio && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onReanalyzeDriveAudio();
                    }}
                    disabled={isDriveLoading}
                    className="min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {isDriveLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                        <span>Cargando…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Reanalizar de Drive</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                >
                  Subir otra
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)]">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-xs sm:text-sm text-[var(--text-primary)]">
                  Arrastra o pulsa para subir tu maqueta (.mp3 o .wav)
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Se analiza automáticamente al seleccionarla
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden audio element for playback preview */}
      {isValidPlayableAudioUrl(audioUrl) && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            console.warn('Error en el elemento de audio de AudioAnalyzerSection:', e);
            setIsPlaying(false);
          }}
          className="hidden"
        />
      )}

      {/* Single Unified Progress Banner */}
      {(isAnalyzing || isAnyLocalAnalyzing) && (
        <div className="px-3.5 py-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center gap-2.5 text-xs text-[var(--accent-primary)]">
          <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="truncate font-medium">
            {isAnalyzing
              ? (progressMessage || 'Procesando armonía, estructura y ritmo…')
              : isCalculatingTempo
              ? 'Calculando tempo y primer pulso…'
              : isAnalyzingKey
              ? 'Detectando tonalidad y progresión de acordes…'
              : 'Mapeando estructura y compases…'}
          </span>
        </div>
      )}

      {/* =====================================================================
          1. INTERACTIVE BEAT TIMELINE (Waveform, Chords, Practice Tools)
         ===================================================================== */}
      {file && (
        <div ref={timelineContainerRef}>
          <BeatTimeline
            audioBuffer={decodedAudioBuffer}
            beatAnalysis={beatAnalysis}
            chords={effectiveChords.length > 0 ? effectiveChords : undefined}
            sections={effectiveSections.length > 0 ? effectiveSections : null}
            currentTime={currentTime}
            duration={duration || (decodedAudioBuffer?.duration ?? 0)}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            onTogglePlay={togglePlayback}
            isLoading={isAnalyzingBeats || isAnalyzingKey || isAnalyzingStructure}
            onRecalculate={() => handleCalculateTempo(file)}
            onExportJSON={handleExportChordsJSON}
            onExportCSV={handleExportChordsCSV}
            onExportMIDI={() => handleExportChordsMIDI()}
            pitchShiftSemitones={pitchShiftSemitones}
            onPitchShiftChange={handlePitchShiftChange}
            preserveTempo={preserveTempo}
            onTogglePreserveTempo={handleTogglePreserveTempo}
            accidentalPreference={accidentalPreference}
            onToggleAccidentalPreference={handleToggleAccidentalPreference}
            meter={meterAnalysis?.meter}
            downbeats={meterAnalysis?.downbeats}
            onMeterChange={handleManualMeterChange}
            playbackRate={playbackRate}
            onPlaybackRateChange={handlePlaybackRateChange}
            loopStart={loopStart}
            loopEnd={loopEnd}
            onSetLoopA={handleSetLoopA}
            onSetLoopB={handleSetLoopB}
            onClearLoop={handleClearLoop}
            eqMode={eqMode}
            onEqModeChange={handleEqModeChange}
          />
        </div>
      )}

      {/* =====================================================================
          2. UNIFIED SUMMARY CARD (4 KPI Grid + Primary Actions)
         ===================================================================== */}
      {hasAnyAnalysisData && (
        <div className="rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] overflow-visible">
          {/* Summary Header & Primary CTAs */}
          <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h5 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                  Resumen musical
                </h5>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {!file && savedAudioAnalysis
                    ? `Guardado en la canción${savedAudioAnalysis.analyzedAt ? ` · ${new Date(savedAudioAnalysis.analyzedAt).toLocaleDateString('es-ES')}` : ''}`
                    : analysisResult?.source === 'gemini_ai'
                    ? 'Análisis completo IA'
                    : 'Detección automática'}
                </span>
              </div>
              {progressionSummary && (
                <p className="text-[11px] font-mono text-[var(--text-secondary)] truncate mt-0.5">
                  Progresión: <strong className="text-[var(--text-primary)]">{progressionSummary}</strong>
                </p>
              )}
            </div>

            {/* Primary Action Cluster */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {effectiveChords.length > 0 && (
                <div className="relative" ref={exportMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowExportMenu(prev => !prev)}
                    className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Exportar</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 mt-1.5 w-40 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-medium)] shadow-lg py-1 z-30">
                      <button
                        type="button"
                        onClick={() => handleExportChordsMIDI()}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                      >
                        <span>Archivo MIDI</span>
                        <span className="font-mono text-[10px] text-emerald-500">.mid</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportChordsCSV}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                      >
                        <span>Tabla CSV</span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">.csv</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportChordsJSON}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer"
                      >
                        <span>Datos JSON</span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">.json</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {onInsertChordsIntoLyrics && effectiveChords.length > 0 && (
                <button
                  type="button"
                  onClick={() => onInsertChordsIntoLyrics(effectiveChords, effectiveSections)}
                  className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  title="Insertar los acordes detectados en las sílabas de la letra"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Insertar acordes ({effectiveChords.length})</span>
                </button>
              )}

              {canUndoInsertChords && onUndoInsertChords && (
                <button
                  type="button"
                  onClick={onUndoInsertChords}
                  className="min-h-[40px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/35 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                  title="Deshacer inserción de acordes"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Deshacer</span>
                </button>
              )}

              {(analysisResult || tempoAnalysis || keyAnalysis || meterAnalysis) && (
                <button
                  type="button"
                  onClick={handleApplyAll}
                  className={`min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    applied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]'
                  }`}
                >
                  {applied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>¡Aplicado!</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Aplicar a la canción</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 4-Metric Hairline Grid (2x2 Mobile, 4-col Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)]">
            {/* KPI 1: Tempo */}
            <div className="p-3.5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Tempo</span>
                </span>
                {displayTempo !== null && (
                  <button
                    type="button"
                    onClick={handleApplyOnlyTempo}
                    className={`text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      appliedTempo ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--accent-primary)] hover:underline'
                    }`}
                  >
                    {appliedTempo ? '¡Usado!' : 'Usar'}
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                    {displayTempo ?? '—'}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-muted)]">BPM</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5 truncate">
                  {typeof displayOffset === 'number'
                    ? `1.er golpe: ${displayOffset.toFixed(2)}s`
                    : isCalculatingTempo
                    ? 'Calculando…'
                    : 'Sin offset'}
                </p>
              </div>
            </div>

            {/* KPI 2: Key & Scale */}
            <div className="p-3.5 flex flex-col justify-between gap-2 border-l border-[var(--border-subtle)] lg:border-l-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Tonalidad</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleAccidentalPreference}
                    className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[10px] font-mono font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer whitespace-nowrap"
                    title="Alternar entre sostenidos (♯) y bemoles (♭)"
                  >
                    {accidentalPreference === 'flats' ? '♭' : '♯'}
                  </button>
                  {displayKey && (
                    <button
                      type="button"
                      onClick={handleApplyOnlyKey}
                      className={`text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                        appliedKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--accent-primary)] hover:underline'
                      }`}
                    >
                      {appliedKey ? '¡Usado!' : 'Usar'}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-[var(--accent-primary)]">
                    {displayKey ?? '—'}
                  </span>
                  {displayScale && (
                    <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
                      {displayScale}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
                  {keyAnalysis
                    ? `${Math.round(keyAnalysis.confidence * 100)}% confianza`
                    : isAnalyzingKey
                    ? 'Analizando…'
                    : 'Escala armónica'}
                </p>
              </div>
            </div>

            {/* KPI 3: Meter */}
            <div className="p-3.5 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Compás</span>
                </span>
                {displayMeter && (
                  <button
                    type="button"
                    onClick={handleApplyOnlyMeter}
                    className={`text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      appliedMeter ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--accent-primary)] hover:underline'
                    }`}
                  >
                    {appliedMeter ? '¡Usado!' : 'Usar'}
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                    {displayMeter ?? '—'}
                  </span>
                  {displayMeter && (
                    <span className="text-[11px] text-[var(--text-secondary)] truncate">
                      {getMeterDescription(displayMeter)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
                  {meterAnalysis
                    ? (meterAnalysis.confidence === 1.0
                        ? `Manual · ${meterAnalysis.barCount || meterAnalysis.downbeats.length} compases`
                        : `${Math.round(meterAnalysis.confidence * 100)}% conf. · ${meterAnalysis.barCount || meterAnalysis.downbeats.length} compases`)
                    : isAnalyzingBeats
                    ? 'Estimando…'
                    : 'Métrica base'}
                </p>
              </div>
            </div>

            {/* KPI 4: Chords & Structure */}
            <div className="p-3.5 flex flex-col justify-between gap-2 border-l border-[var(--border-subtle)] lg:border-l-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  <span>Armonía</span>
                </span>
                {activeChordNow && (
                  <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-300">
                    {respellChord(activeChordNow.chord, accidentalPreference)}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                    {effectiveChords.length}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">acordes</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums mt-0.5">
                  {effectiveSections.length > 0
                    ? `${effectiveSections.length} secciones detectadas`
                    : isAnalyzingStructure
                    ? 'Detectando secciones…'
                    : 'Segmentos armónicos'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. UNIFIED TABBED DETAILS (Chords & Structure | Rhythm & Meter | Advanced)
         ===================================================================== */}
      {(file || hasAnyAnalysisData) && (
        <div className="rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] overflow-hidden">
          {/* Segmented Tab Header */}
          <div
            role="tablist"
            aria-label="Detalles del análisis de audio"
            className="grid grid-cols-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'chords'}
              onClick={() => setActiveTab('chords')}
              className={`min-h-[42px] sm:min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'chords'
                  ? 'bg-[var(--bg-modal)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Music className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span className="truncate">Acordes y Secciones</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'rhythm'}
              onClick={() => setActiveTab('rhythm')}
              className={`min-h-[42px] sm:min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'rhythm'
                  ? 'bg-[var(--bg-modal)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Ritmo y Compás</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'advanced'}
              onClick={() => setActiveTab('advanced')}
              className={`min-h-[42px] sm:min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'advanced'
                  ? 'bg-[var(--bg-modal)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
              <span className="truncate">Avanzado</span>
            </button>
          </div>

          {/* Tab Panels */}
          <div className="p-3.5 sm:p-4 space-y-4">
            {/* TAB 1: CHORDS & STRUCTURE */}
            {activeTab === 'chords' && (
              <div className="space-y-4">
                {/* Musical Sections */}
                {effectiveSections.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-primary)]">
                        Estructura de la canción
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                        {effectiveSections.length} partes · Pulsa para saltar
                      </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {effectiveSections.map((sec) => {
                        const isActive = currentTime >= sec.startTime && currentTime < sec.endTime;
                        const badgeTone =
                          sec.type === 'Intro'
                            ? 'border-indigo-400/50 text-indigo-600 dark:text-indigo-300'
                            : sec.type === 'Estribillo'
                            ? 'border-amber-400/60 text-amber-600 dark:text-amber-300'
                            : sec.type === 'Puente'
                            ? 'border-pink-400/60 text-pink-600 dark:text-pink-300'
                            : sec.type === 'Instrumental' || sec.type === 'Outro'
                            ? 'border-slate-400/60 text-slate-600 dark:text-slate-300'
                            : 'border-teal-400/50 text-teal-600 dark:text-teal-300';

                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => handleSeek(sec.startTime)}
                            className={`min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-2 border whitespace-nowrap ${
                              isActive
                                ? 'bg-teal-600 text-white border-teal-500'
                                : `bg-[var(--bg-surface-subtle)] ${badgeTone} hover:bg-[var(--bg-surface)]`
                            }`}
                          >
                            <span className="text-[10px] opacity-75 tabular-nums">
                              {formatClock(sec.startTime)}
                            </span>
                            <span>{sec.label}</span>
                            {sec.isVocal === false && (
                              <span className="text-[10px] opacity-75 font-normal">Inst.</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Unified Chords Sequence */}
                {effectiveChords.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-[var(--text-primary)]">
                        Secuencia de acordes ({effectiveChords.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleAccidentalPreference}
                          className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] cursor-pointer whitespace-nowrap"
                        >
                          {accidentalPreference === 'flats' ? '♭ Bemoles' : '♯ Sostenidos'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5 max-h-60 overflow-y-auto pr-1">
                      {effectiveChords.map((chordSeg, idx) => {
                        const isActive = currentTime >= chordSeg.startTime && currentTime < chordSeg.endTime;
                        const displayedChord = respellChord(chordSeg.chord, accidentalPreference);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSeek(chordSeg.startTime)}
                            className={`min-h-[44px] sm:min-h-[38px] px-2 py-1.5 rounded-lg font-mono transition-colors cursor-pointer flex flex-col items-center justify-center border ${
                              isActive
                                ? 'bg-purple-600 text-white border-purple-500'
                                : 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-purple-400/60'
                            }`}
                            title={`Saltar a ${displayedChord} (${chordSeg.startTime.toFixed(1)}s)`}
                          >
                            <strong className="text-xs sm:text-sm leading-tight">{displayedChord}</strong>
                            <span className="text-[10px] opacity-70 tabular-nums">
                              {formatClock(chordSeg.startTime)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                    {isAnalyzingKey
                      ? 'Detectando progresión armónica…'
                      : 'No hay segmentos de acordes detectados todavía.'}
                  </div>
                )}

                {/* Musical Notes from AI Analysis (if any) */}
                {analysisResult?.musicalNotes && (
                  <div className="pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {analysisResult.musicalNotes}
                  </div>
                )}

                {/* Optional Collapsible Chromagram */}
                {keyAnalysis?.chroma && keyAnalysis.chroma.length === 12 && (
                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setShowChromaChart(prev => !prev)}
                      className="flex items-center justify-between w-full text-left text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer py-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>Perfil armónico por nota (12 tonos)</span>
                      </span>
                      {showChromaChart ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showChromaChart && (
                      <div className="grid grid-cols-12 gap-1 mt-2 items-end h-20 bg-[var(--bg-surface-subtle)] p-2 rounded-lg border border-[var(--border-subtle)]">
                        {(accidentalPreference === 'flats' ? CHROMATIC_NOTES_FLATS : CHROMATIC_NOTES_SHARPS).map((note, idx) => {
                          const value = keyAnalysis.chroma[idx] ?? 0;
                          const heightPercent = Math.max(6, Math.round(value * 100));
                          const rootPitch = respellChord(keyAnalysis.key.replace(/m$/, ''), accidentalPreference);
                          const isRoot = note === rootPitch;

                          return (
                            <div key={note} className="flex flex-col items-center justify-end h-full" title={`${note}: ${(value * 100).toFixed(1)}%`}>
                              <div className="w-full flex items-end justify-center h-12">
                                <div
                                  style={{ height: `${heightPercent}%` }}
                                  className={`w-full max-w-[14px] rounded-t ${
                                    isRoot ? 'bg-[var(--accent-primary)]' : 'bg-[var(--accent-primary)]/30'
                                  }`}
                                />
                              </div>
                              <span
                                className={`text-[9px] font-mono mt-1 font-semibold ${
                                  isRoot ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                                }`}
                              >
                                {note}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: RHYTHM & METER */}
            {activeTab === 'rhythm' && (
              <div className="space-y-4">
                {/* Manual Meter Adjustment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h6 className="font-semibold text-xs text-[var(--text-primary)]">
                        Ajuste manual de compás
                      </h6>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Corrige la métrica si la canción tiene rubato o cambios de acento
                      </p>
                    </div>
                    {!beatAnalysis && file && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Esperando rejilla de pulsos…
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {COMMON_TIME_SIGNATURES_LIST.map(m => (
                      <button
                        key={m}
                        type="button"
                        disabled={!beatAnalysis}
                        onClick={() => handleManualMeterChange(m)}
                        className={`min-h-[42px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg font-mono text-xs font-semibold cursor-pointer transition-colors border disabled:opacity-40 whitespace-nowrap ${
                          meterAnalysis?.meter === m
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-border)]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}

                    <select
                      aria-label="Seleccionar compás irregular o compuesto"
                      disabled={!beatAnalysis}
                      value={
                        meterAnalysis && UNCOMMON_TIME_SIGNATURES_LIST.includes(meterAnalysis.meter)
                          ? meterAnalysis.meter
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          handleManualMeterChange(e.target.value as TimeSignature);
                        }
                      }}
                      className={`min-h-[42px] sm:min-h-[34px] px-3 py-1.5 rounded-lg font-mono text-xs font-semibold cursor-pointer border disabled:opacity-40 focus:outline-none ${
                        meterAnalysis && UNCOMMON_TIME_SIGNATURES_LIST.includes(meterAnalysis.meter)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <option value="" disabled>
                        Irregular…
                      </option>
                      {UNCOMMON_TIME_SIGNATURES_LIST.map(m => (
                        <option key={m} value={m} className="bg-[var(--bg-modal)] text-[var(--text-primary)]">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tempo Range Search & Beat Stats */}
                <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h6 className="font-semibold text-xs text-[var(--text-primary)]">
                      Rango de búsqueda de BPM
                    </h6>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <span>Mín</span>
                        <input
                          type="number"
                          min={40}
                          max={200}
                          value={minTempo}
                          onChange={(e) => setMinTempo(Math.max(30, Number(e.target.value) || 60))}
                          className="w-16 min-h-[38px] sm:min-h-[32px] px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-mono tabular-nums text-center text-xs"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <span>Máx</span>
                        <input
                          type="number"
                          min={80}
                          max={300}
                          value={maxTempo}
                          onChange={(e) => setMaxTempo(Math.max(minTempo + 10, Number(e.target.value) || 180))}
                          className="w-16 min-h-[38px] sm:min-h-[32px] px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-mono tabular-nums text-center text-xs"
                        />
                      </label>
                      {file && (
                        <button
                          type="button"
                          onClick={() => handleCalculateTempo(file, minTempo, maxTempo)}
                          disabled={isCalculatingTempo}
                          className="min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {isCalculatingTempo ? 'Calculando…' : 'Recalcular ritmo'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Beat & Offset Telemetry */}
                  <div className="space-y-1.5 text-xs">
                    <h6 className="font-semibold text-xs text-[var(--text-primary)]">
                      Datos de rejilla rítmica
                    </h6>
                    <div className="grid grid-cols-2 gap-2 font-mono tabular-nums text-[11px] bg-[var(--bg-surface-subtle)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                      <div>
                        <span className="text-[var(--text-muted)] block">Offset 1.er beat</span>
                        <strong className="text-[var(--text-primary)]">
                          {typeof displayOffset === 'number'
                            ? `${displayOffset.toFixed(3)}s (${Math.round(displayOffset * 1000)} ms)`
                            : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block">Pulsos / Ataques</span>
                        <strong className="text-[var(--text-primary)]">
                          {beatAnalysis
                            ? `${beatAnalysis.beats.length} / ${beatAnalysis.onsets.length}`
                            : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ADVANCED */}
            {activeTab === 'advanced' && (
              <div className="space-y-4">
                {file && (
                  <div className="space-y-2">
                    <h6 className="font-semibold text-xs text-[var(--text-primary)]">
                      Recalcular motores individuales
                    </h6>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCalculateTempo(file)}
                        disabled={isCalculatingTempo}
                        className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${isCalculatingTempo ? 'animate-spin' : ''}`} />
                        <span>Recalcular ritmo y estructura</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (decodedAudioBuffer) {
                            void analyzeKey(decodedAudioBuffer, beatAnalysis?.beats);
                          } else {
                            void handleCalculateTempo(file);
                          }
                        }}
                        disabled={isAnalyzingKey}
                        className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 text-purple-500 ${isAnalyzingKey ? 'animate-spin' : ''}`} />
                        <span>Recalcular tonalidad y acordes</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Calibration & Technical Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Calibración A4 y motor armónico</span>
                    </span>
                    <p className="font-mono text-[var(--text-secondary)]">
                      {keyAnalysis?.algorithm || (analysisResult?.source === 'gemini_ai' ? 'Análisis IA multimodal' : 'Web Audio DSP local')}
                    </p>
                    <p className="font-mono text-[var(--text-muted)] tabular-nums">
                      {typeof (keyAnalysis?.referenceA4Hz ?? analysisResult?.referenceA4Hz ?? savedAudioAnalysis?.referenceA4Hz) === 'number'
                        ? `A4 = ${(keyAnalysis?.referenceA4Hz ?? analysisResult?.referenceA4Hz ?? savedAudioAnalysis?.referenceA4Hz)!.toFixed(1)} Hz (${((keyAnalysis?.detuningCents ?? analysisResult?.detuningCents ?? savedAudioAnalysis?.detuningCents ?? 0) >= 0 ? '+' : '')}${keyAnalysis?.detuningCents ?? analysisResult?.detuningCents ?? savedAudioAnalysis?.detuningCents ?? 0} cents)`
                        : 'Referencia estándar A4 = 440.0 Hz'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Notas de estimación</span>
                    </span>
                    <p className="text-[var(--text-muted)] leading-relaxed">
                      El análisis combina detección local en tu navegador (beats, downbeats, cromagrama y matriz de autosimilitud) y análisis completo bajo demanda. En temas con rubato libre, ajusta el compás en la pestaña Ritmo.
                    </p>
                  </div>
                </div>

                {/* Security & Privacy */}
                <div className="flex items-start gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    El procesamiento DSP se ejecuta localmente en tu navegador y el análisis en servidor protege las credenciales en variables de entorno sin exponerlas al cliente.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Mini-Player (shown on mobile when main timeline is scrolled out of view or unavailable) */}
      {showMobileMiniPlayer && (
        <div
          role="region"
          aria-label="Controles rápidos de reproducción"
          className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-header)] backdrop-blur-md border-t border-[var(--border-medium)] shadow-lg px-3 py-1.5 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-sm font-bold text-purple-600 dark:text-purple-300 tabular-nums shrink-0">
                  {activeChordNow
                    ? respellChord(activeChordNow.chord, accidentalPreference)
                    : '—'}
                </span>
                {nextChordNow && (
                  <span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold text-[var(--text-muted)] tabular-nums shrink-0">
                    <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>{respellChord(nextChordNow.chord, accidentalPreference)}</span>
                  </span>
                )}
                {activeSectionNow && (
                  <>
                    <span className="text-[var(--text-muted)] shrink-0" aria-hidden="true">·</span>
                    <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
                      {activeSectionNow.label}
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] leading-tight">
                <span className="text-[var(--text-primary)] font-semibold">{formatClock(currentTime)}</span>
                {duration > 0 && <span> / {formatClock(duration)}</span>}
              </div>
            </div>
          </div>

          {file && decodedAudioBuffer && (
            <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-0.5 shrink-0 font-mono text-xs">
              <span className="px-1.5 text-[var(--text-muted)] flex items-center" aria-hidden="true">
                <Repeat className="w-3.5 h-3.5 text-emerald-500" />
              </span>
              <button
                type="button"
                onClick={handleSetLoopA}
                aria-label="Marcar punto A de bucle"
                className={`min-h-[44px] min-w-[40px] px-2 rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  loopStart !== null
                    ? 'bg-emerald-600 text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)]'
                }`}
              >
                A
              </button>
              <button
                type="button"
                onClick={handleSetLoopB}
                aria-label="Marcar punto B de bucle"
                className={`min-h-[44px] min-w-[40px] px-2 rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  loopEnd !== null
                    ? 'bg-emerald-600 text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)]'
                }`}
              >
                B
              </button>
              {(loopStart !== null || loopEnd !== null) && (
                <button
                  type="button"
                  onClick={handleClearLoop}
                  aria-label="Quitar bucle A-B"
                  className="min-h-[44px] min-w-[36px] px-1.5 rounded-lg font-bold text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isTunerOpen && (
        <ChromaticTunerModal
          initialTuning={analysisResult?.tuning || savedAudioAnalysis?.tuning}
          initialA4Hz={keyAnalysis?.referenceA4Hz ?? analysisResult?.referenceA4Hz ?? savedAudioAnalysis?.referenceA4Hz ?? 440}
          onClose={() => setIsTunerOpen(false)}
        />
      )}
    </div>
  );
};
