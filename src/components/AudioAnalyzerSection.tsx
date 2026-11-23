import React, { useState, useRef, useEffect } from 'react';
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
  Wand2,
  SlidersHorizontal,
  Timer,
  BarChart3,
  Cpu,
  Download,
  Activity,
  Undo2
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
  externalAudioFile
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

  // Dedicated Tempo (web-audio-beat-detector) states
  const [tempoAnalysis, setTempoAnalysis] = useState<TempoAnalysis | null>(null);
  const [isCalculatingTempo, setIsCalculatingTempo] = useState<boolean>(false);
  const [tempoError, setTempoError] = useState<string | null>(null);
  const [minTempo, setMinTempo] = useState<number>(60);
  const [maxTempo, setMaxTempo] = useState<number>(180);
  const [showTempoSettings, setShowTempoSettings] = useState<boolean>(false);

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

        // 2b. Estimate musical meter (2/4, 3/4, 4/4, 6/8) using pre-calculated beats & onsets
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

      // 3. Analyze Key & Scale with Essentia.js WASM via Web Worker (con beats para alineación armónica)
      void analyzeKey(audioBuffer, detectedBeats);

      // 4. Analyze real Musical Structure (SSM + Checkerboard Novelty) via Web Worker
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

  const handleExportChordsJSON = () => {
    if (!keyAnalysis?.chords || keyAnalysis.chords.length === 0) return;
    const baseName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'chords';
    const jsonStr = exportChordsToJSON(keyAnalysis.chords, baseName);
    downloadChordExport(jsonStr, `${baseName}_acordes.json`, 'application/json');
  };

  const handleExportChordsCSV = () => {
    if (!keyAnalysis?.chords || keyAnalysis.chords.length === 0) return;
    const baseName = file?.name ? file.name.replace(/\.[^/.]+$/, '') : 'chords';
    const csvStr = exportChordsToCSV(keyAnalysis.chords);
    downloadChordExport(csvStr, `${baseName}_acordes.csv`, 'text/csv');
  };

  const handleExportChordsMIDI = (overrideChords?: ChordSegment[], overrideSections?: MusicalSection[]) => {
    const sourceChords = overrideChords || keyAnalysis?.chords || savedAudioAnalysis?.chords;
    if (!sourceChords || sourceChords.length === 0) return;

    const respelledChords: ChordSegment[] = sourceChords.map(seg => ({
      ...seg,
      chord: respellChord(seg.chord, accidentalPreference)
    }));
    const sectionsList = overrideSections || structureAnalysis?.sections || analysisResult?.sections || savedAudioAnalysis?.sections;
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
  };

  const handleSeek = (targetTime: number) => {
    if (playerRef.current && decodedAudioBuffer) {
      playerRef.current.seek(targetTime);
    } else if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
    setCurrentTime(targetTime);
  };

  const handleFileSelected = (selectedFile: File) => {
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

    if (onAudioFileSelected) {
      onAudioFileSelected(selectedFile);
    }

    // Auto calculate tempo & beat offset, onsets and key in background
    void handleCalculateTempo(selectedFile);
  };

  useEffect(() => {
    if (externalAudioFile && externalAudioFile !== file) {
      handleFileSelected(externalAudioFile);
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
    let raw = currentKey || analysisResult?.key || 'Am';
    if (keyAnalysis) {
      raw = keyAnalysis.scale === 'minor'
        ? (keyAnalysis.key.endsWith('m') ? keyAnalysis.key : `${keyAnalysis.key}m`)
        : keyAnalysis.key.replace(/m$/, '');
    }
    return respellChord(raw, accidentalPreference);
  };

  const handleApplyOnlyTempo = () => {
    if (!tempoAnalysis) return;
    onApplyDetection({
      tempo: tempoAnalysis.bpm,
      key: getEffectiveKey(),
      timeSignature: meterAnalysis?.meter || analysisResult?.timeSignature || '4/4',
      tuning: analysisResult?.tuning || 'Estándar (EADGBE)',
      audioUrl: audioUrl || undefined,
      chordProgression: analysisResult?.chordProgression,
      suggestedLyricsChords: analysisResult?.suggestedLyricsChords,
      tempoOffset: tempoAnalysis.offset
    });
    setAppliedTempo(true);
    setTimeout(() => setAppliedTempo(false), 2500);
  };

  const handleApplyOnlyMeter = () => {
    if (!meterAnalysis) return;
    onApplyDetection({
      tempo: tempoAnalysis?.bpm || analysisResult?.tempo || 120,
      key: getEffectiveKey(),
      timeSignature: meterAnalysis.meter,
      tuning: analysisResult?.tuning || 'Estándar (EADGBE)',
      audioUrl: audioUrl || undefined,
      chordProgression: getChordProgressionSummary(),
      suggestedLyricsChords: analysisResult?.suggestedLyricsChords,
      tempoOffset: tempoAnalysis?.offset ?? analysisResult?.tempoOffset,
      chords: keyAnalysis?.chords || undefined
    });
    setAppliedMeter(true);
    setTimeout(() => setAppliedMeter(false), 2500);
  };

  const getChordProgressionSummary = (): string | undefined => {
    if (keyAnalysis?.chords && keyAnalysis.chords.length > 0) {
      const seq: string[] = [];
      for (const s of keyAnalysis.chords) {
        const chordName = respellChord(s.chord, accidentalPreference);
        if (seq.length === 0 || seq[seq.length - 1] !== chordName) {
          seq.push(chordName);
        }
      }
      return seq.slice(0, 8).join(' - ');
    }
    return analysisResult?.chordProgression;
  };

  const handleApplyOnlyKey = () => {
    if (!keyAnalysis) return;
    const key = getEffectiveKey();
    const chordProgression = getChordProgressionSummary();
    onApplyDetection({
      tempo: tempoAnalysis?.bpm || analysisResult?.tempo || 120,
      key,
      timeSignature: meterAnalysis?.meter || analysisResult?.timeSignature || '4/4',
      tuning: analysisResult?.tuning || 'Estándar (EADGBE)',
      audioUrl: audioUrl || undefined,
      chordProgression,
      suggestedLyricsChords: analysisResult?.suggestedLyricsChords,
      tempoOffset: tempoAnalysis?.offset ?? analysisResult?.tempoOffset,
      chords: keyAnalysis?.chords || undefined
    });
    setAppliedKey(true);
    setTimeout(() => setAppliedKey(false), 2500);
  };

  const handleApplyAll = () => {
    if (!analysisResult && !tempoAnalysis && !keyAnalysis && !meterAnalysis) return;

    const chordsList = keyAnalysis?.chords || (analysisResult?.chords ? analysisResult.chords.map(c => ({
      startTime: c.seconds ?? 0,
      endTime: (c.seconds ?? 0) + 4,
      chord: c.chord,
      confidence: 0.85
    })) : undefined);

    const effectiveSections =
      structureAnalysis?.sections && structureAnalysis.sections.length > 0
        ? structureAnalysis.sections
        : analysisResult?.sections;

    const completeAudioAnalysis: SavedAudioAnalysis = {
      analyzedAt: new Date().toISOString(),
      source: analysisResult?.source || (keyAnalysis ? 'essentia_wasm' : 'client_dsp'),
      tempo: tempoAnalysis?.bpm || analysisResult?.tempo || 120,
      tempoConfidence: tempoAnalysis ? 0.95 : analysisResult?.tempoConfidence,
      tempoOffset: tempoAnalysis?.offset ?? analysisResult?.tempoOffset,
      rawTempo: tempoAnalysis?.tempo ?? analysisResult?.rawTempo,
      key: getEffectiveKey(),
      scale: keyAnalysis?.scale === 'minor' ? 'Menor' : keyAnalysis?.scale === 'major' ? 'Mayor' : analysisResult?.scale,
      timeSignature: meterAnalysis?.meter || analysisResult?.timeSignature || '4/4',
      tuning: analysisResult?.tuning || 'Estándar (EADGBE)',
      detuningCents: keyAnalysis?.detuningCents ?? analysisResult?.detuningCents,
      referenceA4Hz: keyAnalysis?.referenceA4Hz ?? analysisResult?.referenceA4Hz,
      durationSeconds: duration || analysisResult?.durationSeconds,
      chordProgression: getChordProgressionSummary(),
      chords: chordsList,
      sections: effectiveSections,
      musicalNotes: analysisResult?.musicalNotes || (keyAnalysis ? `Tonalidad ${getEffectiveKey()} analizada con Essentia WASM.` : undefined)
    };

    onApplyDetection({
      tempo: tempoAnalysis?.bpm || analysisResult?.tempo || 120,
      key: getEffectiveKey(),
      timeSignature: meterAnalysis?.meter || analysisResult?.timeSignature || '4/4',
      tuning: analysisResult?.tuning || 'Estándar (EADGBE)',
      audioUrl: audioUrl || undefined,
      chordProgression: getChordProgressionSummary(),
      suggestedLyricsChords: analysisResult?.suggestedLyricsChords,
      tempoOffset: tempoAnalysis?.offset ?? analysisResult?.tempoOffset,
      chords: chordsList,
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

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4 text-xs transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
            <Wand2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                Detector Automático de Audio (MP3 / WAV)
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>DSP Local & Beat Worker</span>
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Sube tu maqueta grabada para calcular tempo, BPMs, tonalidad, compás y progresión de acordes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-mono">
          <button
            type="button"
            onClick={() => setIsTunerOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)] font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Afinador
          </button>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cero secretos expuestos</span>
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Saved Audio Analysis Card (when song already has audio analysis saved) */}
      {savedAudioAnalysis && !file && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-2xs">
                <Music className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-serif font-bold text-xs text-[var(--text-primary)]">
                    Análisis de Audio Guardado en la Canción
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-semibold">
                    {savedAudioAnalysis.chords?.length || 0} acordes detectados
                  </span>
                  {savedAudioAnalysis.analyzedAt && (
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      ({new Date(savedAudioAnalysis.analyzedAt).toLocaleDateString('es-ES')})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Tono: <strong className="text-[var(--accent-primary)] font-mono">{savedAudioAnalysis.key}</strong>
                  {savedAudioAnalysis.scale && ` (${savedAudioAnalysis.scale})`} · Tempo: <strong className="font-mono">{savedAudioAnalysis.tempo} BPM</strong> · Compás: <strong className="font-mono">{savedAudioAnalysis.timeSignature || '4/4'}</strong>
                  {savedAudioAnalysis.chordProgression && (
                    <span className="hidden sm:inline font-mono text-[var(--text-muted)]"> · {savedAudioAnalysis.chordProgression}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {savedAudioAnalysis.chords && savedAudioAnalysis.chords.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleExportChordsMIDI(savedAudioAnalysis.chords, savedAudioAnalysis.sections)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] hover:text-[var(--accent-primary)] border border-[var(--border-subtle)] flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Exportar los acordes detectados en un archivo MIDI (.mid)"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>MIDI</span>
                </button>
              )}

              {onInsertChordsIntoLyrics && savedAudioAnalysis.chords && savedAudioAnalysis.chords.length > 0 && (
                <button
                  type="button"
                  onClick={() => onInsertChordsIntoLyrics(savedAudioAnalysis.chords!, savedAudioAnalysis.sections)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Insertar automáticamente los acordes detectados en las sílabas y secciones de la letra"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Insertar acordes en sílabas</span>
                </button>
              )}

              {canUndoInsertChords && onUndoInsertChords && (
                <button
                  type="button"
                  onClick={onUndoInsertChords}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Deshacer el cambio de letra y restaurar la versión anterior"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Deshacer</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drop zone & file selector */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`p-4 sm:p-6 rounded-xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-2 cursor-pointer ${
          file
            ? 'bg-[var(--accent-subtle)]/40 border-[var(--accent-border)]'
            : 'bg-[var(--bg-modal)]/60 border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface)]'
        }`}
        onClick={() => !file && fileInputRef.current?.click()}
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
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-text)] flex items-center justify-center shrink-0 shadow-sm">
                <FileAudio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-xs text-[var(--text-primary)] truncate max-w-xs sm:max-w-md">
                  {file.name}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                  <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <span>·</span>
                  <span className="uppercase text-[var(--accent-primary)] font-semibold">{file.name.split('.').pop()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {audioUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayback();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pausar' : 'Escuchar'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setAudioUrl('');
                  setAnalysisResult(null);
                  setStructureAnalysis(null);
                  resetKeyAnalysis();
                  if (audioRef.current) audioRef.current.pause();
                }}
                className="px-2.5 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Quitar archivo"
              >
                Cambiar
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunAnalysis();
                }}
                disabled={isAnalyzing}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{analysisResult ? 'Reanalizar Audio' : 'Analizar Audio (DSP Local)'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : driveFileId ? (
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-sm">
                <FileAudio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-xs text-[var(--text-primary)] truncate max-w-xs sm:max-w-md">
                    {driveFileName || 'Maqueta guardada en Google Drive'}
                  </p>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold shrink-0">
                    Google Drive (Privada)
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Maqueta almacenada de forma privada. Puedes reanalizarla directamente sin volver a subirla.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onReanalyzeDriveAudio && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onReanalyzeDriveAudio();
                  }}
                  disabled={isDriveLoading}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDriveLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                      <span>Cargando de Drive...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Reanalizar maqueta de Drive</span>
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
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Subir otra
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
              <Upload className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <p className="font-semibold text-xs text-[var(--text-primary)]">
                Arrastra o haz clic para subir tu maqueta en <span className="text-[var(--accent-primary)] font-mono">.mp3</span> o <span className="text-[var(--accent-primary)] font-mono">.wav</span>
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Se almacenará de forma privada en tu Google Drive y se analizará automáticamente
              </p>
            </div>
          </>
        )}
      </div>

      {/* Hidden audio element for playback preview and timing synchronization */}
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

      {/* Visualización interactiva de Beat Timeline (Waveform, Onsets, Beat Grid, Estructura SSM y Acordes en Canvas) */}
      {file && (
        <BeatTimeline
          audioBuffer={decodedAudioBuffer}
          beatAnalysis={beatAnalysis}
          chords={keyAnalysis?.chords}
          sections={structureAnalysis?.sections ?? analysisResult?.sections ?? savedAudioAnalysis?.sections ?? null}
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
      )}

      {/* Sección / Tarjeta "Tempo" con BPM, offset del primer beat, estado de carga, error y recalcular */}
      {file && (
        <div className="p-4 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] space-y-3 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                <Gauge className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif font-bold text-xs text-[var(--text-primary)]">
                  Sección Tempo & Primer Beat
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold">
                  web-audio-beat-detector
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setShowTempoSettings(!showTempoSettings)}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs flex items-center gap-1 ${
                  showTempoSettings
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]'
                }`}
                title="Configurar rango de búsqueda de BPM"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono">{minTempo}-{maxTempo}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCalculateTempo()}
                disabled={isCalculatingTempo}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Recalcular BPM y offset del primer beat con Web Audio"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${isCalculatingTempo ? 'animate-spin' : ''}`} />
                <span>{isCalculatingTempo ? 'Calculando...' : 'Recalcular'}</span>
              </button>
            </div>
          </div>

          {/* Configuración de Rango (minTempo y maxTempo) */}
          {showTempoSettings && (
            <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center gap-3 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Rango esperado:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--text-muted)] font-mono text-[11px]">Mín:</span>
                <input
                  type="number"
                  min={40}
                  max={200}
                  value={minTempo}
                  onChange={(e) => setMinTempo(Math.max(30, Number(e.target.value) || 60))}
                  className="w-16 px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono text-center text-xs"
                />
                <span className="text-[var(--text-muted)] font-mono text-[11px]">BPM</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--text-muted)] font-mono text-[11px]">Máx:</span>
                <input
                  type="number"
                  min={80}
                  max={300}
                  value={maxTempo}
                  onChange={(e) => setMaxTempo(Math.max(minTempo + 10, Number(e.target.value) || 180))}
                  className="w-16 px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono text-center text-xs"
                />
                <span className="text-[var(--text-muted)] font-mono text-[11px]">BPM</span>
              </div>
              <button
                type="button"
                onClick={() => handleCalculateTempo(file, minTempo, maxTempo)}
                disabled={isCalculatingTempo}
                className="ml-auto px-2.5 py-1 rounded bg-[var(--accent-primary)] text-[var(--accent-text)] text-[11px] font-semibold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                Aplicar y recalcular
              </button>
            </div>
          )}

          {/* Estado de carga */}
          {isCalculatingTempo && (
            <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center gap-2.5 text-xs text-[var(--accent-primary)] animate-pulse">
              <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Detectando pulsos rítmicos y calculando offset del primer beat en segundo plano...</span>
            </div>
          )}

          {/* Estado de error */}
          {tempoError && !isCalculatingTempo && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Error al estimar tempo</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{tempoError}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCalculateTempo()}
                className="text-[11px] underline hover:no-underline font-medium shrink-0 cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Valores: BPM y Offset */}
          {tempoAnalysis && !isCalculatingTempo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
              <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-[var(--accent-primary)]" />
                    <span>Tempo Detectado</span>
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                      {tempoAnalysis.bpm}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">BPM</span>
                    {tempoAnalysis.tempo && Math.abs(tempoAnalysis.tempo - tempoAnalysis.bpm) > 0.05 && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)] opacity-75" title="Tempo continuo exacto">
                        ({tempoAnalysis.tempo})
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplyOnlyTempo}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    appliedTempo
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-[var(--accent-subtle)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-text)] border border-[var(--accent-border)]'
                  }`}
                  title="Usar este BPM en el formulario"
                >
                  {appliedTempo ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>¡Aplicado!</span>
                    </>
                  ) : (
                    <span>Usar BPM</span>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--accent-primary)]" />
                  <span>Offset del Primer Beat</span>
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold font-mono text-[var(--accent-primary)]">
                    {tempoAnalysis.offset.toFixed(3)}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-muted)]">s</span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] opacity-80">
                    ({Math.round(tempoAnalysis.offset * 1000)} ms)
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Desfase temporal exacto hasta el primer golpe rítmico
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sección / Tarjeta "Compás & Métrica" con estimación de Downbeats y Heurística */}
      {file && (
        <div className="p-4 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] space-y-3 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif font-bold text-xs text-[var(--text-primary)]">
                  Sección Compás & Métrica
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5" />
                  <span>Heurística de Downbeats & Beat Grid</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* Selector de corrección manual de compás */}
              <div className="flex items-center gap-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-0.5 text-xs font-mono shadow-2xs flex-wrap">
                <span className="px-2 text-[10px] text-[var(--text-muted)] font-semibold hidden sm:inline">Ajuste:</span>
                {COMMON_TIME_SIGNATURES_LIST.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleManualMeterChange(m)}
                    className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      meterAnalysis?.meter === m
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]'
                    }`}
                    title={`Corregir manualmente a compás ${m}`}
                  >
                    {m}
                  </button>
                ))}
                <select
                  aria-label="Seleccionar compás irregular o compuesto"
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
                  className={`px-1.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors focus:outline-none ${
                    meterAnalysis && UNCOMMON_TIME_SIGNATURES_LIST.includes(meterAnalysis.meter)
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title="Compases irregulares o compuestos (5/4, 7/4, 5/8, 7/8, 9/8, 12/8)"
                >
                  <option value="" disabled className="bg-[var(--bg-modal)] text-[var(--text-muted)]">
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
          </div>

          {/* Estado de carga */}
          {isAnalyzingBeats && (
            <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center gap-2.5 text-xs text-[var(--accent-primary)] animate-pulse">
              <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Estimando compás musical y alineando downbeats sobre la rejilla de pulsos...</span>
            </div>
          )}

          {/* Valores: Compás, Confianza y Downbeats */}
          {meterAnalysis && !isAnalyzingBeats && (
            <div className="space-y-3 pt-0.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[var(--accent-primary)]" />
                      <span>Compás Estimado</span>
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                      <span className="text-2xl font-bold font-mono text-[var(--accent-primary)]">
                        {meterAnalysis.meter}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {getMeterDescription(meterAnalysis.meter)}
                      </span>
                      {meterAnalysis.grouping && !['2', '3', '4'].includes(meterAnalysis.grouping) && (
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 font-semibold"
                          title="Subdivisión acentual detectada dentro del compás"
                        >
                          {meterAnalysis.grouping}
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold">
                        {meterAnalysis.confidence === 1.0 ? 'Ajuste manual' : `${Math.round(meterAnalysis.confidence * 100)}% conf.`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyOnlyMeter}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer border shrink-0 ${
                      appliedMeter
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-[var(--accent-subtle)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-text)] border border-[var(--accent-border)]'
                    }`}
                    title="Usar este compás en el formulario de la canción"
                  >
                    {appliedMeter ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>¡Aplicado!</span>
                      </>
                    ) : (
                      <span>Usar Compás</span>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    <span>Downbeats & Rejilla de Compases</span>
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                    <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {meterAnalysis.barCount || meterAnalysis.downbeats.length}
                    </span>
                    <span className="text-xs font-medium text-[var(--text-muted)]">compases calculados</span>
                    {meterAnalysis.gridMode === 'subdivision2x' && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                        Subdivisión corcheas
                      </span>
                    )}
                    {meterAnalysis.gridMode === 'subdivision3x' && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
                        Subdivisión ternaria
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Cada compás comienza en un downbeat acentuado resaltado en verde en la línea de tiempo
                  </p>
                </div>
              </div>

              {/* Nota sobre limitaciones esperadas */}
              <div className="p-2.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] leading-relaxed">
                💡 <strong>Nota técnica de estimación:</strong> El compás se infiere evaluando autocorrelación periódica (incluyendo métricas asimétricas y de amalgama: 2/4, 3/4, 4/4, 5/4, 7/4, 5/8, 6/8, 7/8, 9/8, 12/8), subdivisión de corcheas, picos de energía acústica en bajos/ataques y sincronía con cambios de acordes. <em>En interpretaciones con rubato, cambios constantes de métrica o directos sin metrónomo, utiliza los controles de ajuste superior para fijar el compás deseado.</em>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sección / Tarjeta "Tonalidad & Escala" con Essentia.js WASM */}
      {file && (
        <div className="p-4 rounded-xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] space-y-3 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--accent-subtle)] text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif font-bold text-xs text-[var(--text-primary)]">
                  Sección Tonalidad & Escala
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" />
                  <span>essentia.js WASM Worker</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleToggleAccidentalPreference}
                className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--accent-primary)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                title={`Preferencia enarmónica activa: ${accidentalPreference === 'flats' ? 'Bemoles (♭)' : 'Sostenidos (♯)'}. Pulsa para alternar.`}
              >
                <span>{accidentalPreference === 'flats' ? '♭ Bemoles' : '♯ Sostenidos'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (decodedAudioBuffer) {
                    void analyzeKey(decodedAudioBuffer, beatAnalysis?.beats);
                  } else if (file) {
                    void handleCalculateTempo(file);
                  }
                }}
                disabled={isAnalyzingKey}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Recalcular tonalidad con Essentia WebAssembly"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${isAnalyzingKey ? 'animate-spin' : ''}`} />
                <span>{isAnalyzingKey ? 'Analizando...' : 'Recalcular'}</span>
              </button>
            </div>
          </div>

          {/* Estado de carga */}
          {isAnalyzingKey && (
            <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center gap-2.5 text-xs text-[var(--accent-primary)] animate-pulse">
              <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Calculando cromagrama armónico (HPCP) y estimando tonalidad en Web Worker WASM...</span>
            </div>
          )}

          {/* Estado de error */}
          {keyError && !isAnalyzingKey && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Error al estimar tonalidad con Essentia</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{keyError}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (decodedAudioBuffer) void analyzeKey(decodedAudioBuffer);
                  else if (file) void handleCalculateTempo(file);
                }}
                className="text-[11px] underline hover:no-underline font-medium shrink-0 cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Resultado de Tonalidad, Escala y Cromagrama */}
          {keyAnalysis && !isAnalyzingKey && (
            <div className="space-y-3 pt-0.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-[var(--accent-primary)]" />
                      <span>Tonalidad Estimada</span>
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-bold font-mono text-[var(--accent-primary)]">
                        {getEffectiveKey()}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Escala {keyAnalysis.scale === 'minor' ? 'Menor' : 'Mayor'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold">
                        {Math.round(keyAnalysis.confidence * 100)}% conf.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyOnlyKey}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      appliedKey
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-[var(--accent-subtle)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-text)] border border-[var(--accent-border)]'
                    }`}
                    title="Usar esta tonalidad en el formulario"
                  >
                    {appliedKey ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>¡Aplicado!</span>
                      </>
                    ) : (
                      <span>Usar Tono</span>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-[var(--accent-primary)]" />
                    <span>Algoritmo MIR & Calibración A4</span>
                  </span>
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate font-mono">
                    {keyAnalysis.algorithm}
                  </p>
                  <p className="text-[10px] font-mono text-[var(--text-muted)]">
                    {typeof keyAnalysis.referenceA4Hz === 'number'
                      ? `Calibración A4: ${keyAnalysis.referenceA4Hz.toFixed(1)} Hz (${(keyAnalysis.detuningCents ?? 0) >= 0 ? '+' : ''}${keyAnalysis.detuningCents ?? 0} cents)`
                      : 'Procesado 100% en el navegador con WebAssembly en hilo secundario'}
                  </p>
                </div>
              </div>

              {/* Cromagrama HPCP (12 Clases de Altura) */}
              {keyAnalysis.chroma && keyAnalysis.chroma.length === 12 && (
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Cromagrama Armónico (HPCP de 12 clases de tono)</span>
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Nota tónica detectada: <strong className="text-[var(--accent-primary)]">{keyAnalysis.key}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-1 pt-1 items-end h-20 bg-[var(--bg-modal)] p-2 rounded-lg border border-[var(--border-subtle)]">
                    {(accidentalPreference === 'flats' ? CHROMATIC_NOTES_FLATS : CHROMATIC_NOTES_SHARPS).map((note, idx) => {
                      const value = keyAnalysis.chroma[idx] ?? 0;
                      const heightPercent = Math.max(6, Math.round(value * 100));
                      const rootPitch = respellChord(keyAnalysis.key.replace(/m$/, ''), accidentalPreference);
                      const isRoot = note === rootPitch;

                      return (
                        <div key={note} className="flex flex-col items-center justify-end h-full group" title={`${note}: ${(value * 100).toFixed(1)}%`}>
                          <div className="w-full flex items-end justify-center h-12">
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className={`w-full max-w-[14px] rounded-t transition-all ${
                                isRoot
                                  ? 'bg-[var(--accent-primary)] shadow-xs'
                                  : 'bg-[var(--accent-subtle)] group-hover:bg-[var(--accent-primary)]/60'
                              }`}
                            />
                          </div>
                          <span
                            className={`text-[9px] font-mono mt-1 font-semibold ${
                              isRoot ? 'text-[var(--accent-primary)] scale-110' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {note}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Progresión Continua de Acordes (Essentia ChordsDetection) */}
              {keyAnalysis.chords && keyAnalysis.chords.length > 0 && (
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                    <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                      <Music className="w-3.5 h-3.5 text-purple-500" />
                      <span>Progresión Armónica Continua (ChordsDetection frame a frame)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {keyAnalysis.chords.length} cambios
                      </span>
                      <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-2">
                        <button
                          type="button"
                          onClick={handleExportChordsJSON}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] border border-[var(--border-subtle)] transition-colors flex items-center gap-1 cursor-pointer"
                          title="Descargar acordes en formato JSON estructurado"
                        >
                          <Download className="w-2.5 h-2.5" />
                          <span>JSON</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportChordsCSV}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] border border-[var(--border-subtle)] transition-colors flex items-center gap-1 cursor-pointer"
                          title="Descargar acordes en formato CSV tabular"
                        >
                          <Download className="w-2.5 h-2.5" />
                          <span>CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportChordsMIDI()}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--bg-modal)] hover:bg-[var(--accent-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] border border-[var(--border-subtle)] transition-colors flex items-center gap-1 cursor-pointer"
                          title="Descargar progresión armónica como archivo MIDI (.mid)"
                        >
                          <Download className="w-2.5 h-2.5 text-emerald-500" />
                          <span>MIDI</span>
                        </button>
                        {onInsertChordsIntoLyrics && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onInsertChordsIntoLyrics(
                                  keyAnalysis.chords!,
                                  structureAnalysis?.sections ?? analysisResult?.sections
                                )
                              }
                              className="px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/40 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Insertar esta progresión de acordes automáticamente en las sílabas y secciones correspondientes de la letra"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Insertar en sílabas</span>
                            </button>
                            {canUndoInsertChords && onUndoInsertChords && (
                              <button
                                type="button"
                                onClick={onUndoInsertChords}
                                className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Deshacer el cambio de letra y restaurar la versión anterior"
                              >
                                <Undo2 className="w-2.5 h-2.5 text-amber-500" />
                                <span>Deshacer</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {keyAnalysis.chords.map((chordSeg, idx) => {
                      const isActive = currentTime >= chordSeg.startTime && currentTime < chordSeg.endTime;
                      const displayedChord = respellChord(chordSeg.chord, accidentalPreference);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSeek(chordSeg.startTime)}
                          className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-xs scale-105 ring-1 ring-purple-400'
                              : 'bg-[var(--bg-modal)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-purple-400/60'
                          }`}
                          title={`Saltar a ${displayedChord} en ${chordSeg.startTime.toFixed(1)}s (Confianza: ${Math.round((chordSeg.confidence ?? chordSeg.strength ?? 0.8) * 100)}%)`}
                        >
                          <span className="text-[9px] opacity-70">
                            {Math.floor(chordSeg.startTime / 60)}:{(chordSeg.startTime % 60).toFixed(0).padStart(2, '0')}
                          </span>
                          <strong className="text-xs">{displayedChord}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Estructura Musical Detectada (Matriz de Autosimilitud SSM) */}
              {structureAnalysis?.sections && structureAnalysis.sections.length > 0 && (
                <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                    <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-teal-500" />
                      <span>Estructura Musical Detectada (Matriz de Autosimilitud)</span>
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      {structureAnalysis.sections.length} secciones
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {structureAnalysis.sections.map((sec) => {
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
                      const fmt = (s: number) =>
                        `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => handleSeek(sec.startTime)}
                          className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                            isActive
                              ? 'bg-teal-600 text-white border-teal-500 shadow-xs scale-105'
                              : `bg-[var(--bg-modal)] ${badgeTone} hover:bg-[var(--bg-surface)]`
                          }`}
                          title={`${sec.label} (${fmt(sec.startTime)} - ${fmt(sec.endTime)}) · Confianza ${Math.round(sec.confidence * 100)}%`}
                        >
                          <span className="text-[9px] opacity-75">
                            {fmt(sec.startTime)}–{fmt(sec.endTime)}
                          </span>
                          <strong>{sec.label}</strong>
                          {sec.isVocal === false && (
                            <span className="text-[9px] opacity-80 font-normal">· Inst.</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analysis in progress status */}
      {isAnalyzing && (
        <div className="p-3.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center gap-3 text-xs text-[var(--accent-primary)] animate-pulse">
          <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
          <span>{progressMessage || 'Procesando armonía y pulso musical...'}</span>
        </div>
      )}

      {/* Analysis Results Card */}
      {analysisResult && (
        <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-modal)] border border-[var(--accent-border)] space-y-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-xs text-[var(--text-primary)]">
                Resultado de Detección Musical
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                {analysisResult.source === 'gemini_ai' ? '✨ Modelo IA Gemini 3.8 Flash' : '⚡ Web Audio DSP Local'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {((analysisResult.chords && analysisResult.chords.length > 0) || (keyAnalysis?.chords && keyAnalysis.chords.length > 0)) && (
                <button
                  type="button"
                  onClick={() => {
                    if (keyAnalysis?.chords && keyAnalysis.chords.length > 0) {
                      handleExportChordsMIDI(keyAnalysis.chords, structureAnalysis?.sections ?? analysisResult.sections);
                    } else if (analysisResult.chords && analysisResult.chords.length > 0) {
                      const mapped: ChordSegment[] = analysisResult.chords.map((c, idx, arr) => {
                        const start = typeof c.seconds === 'number' ? c.seconds : idx * 3.0;
                        const nextStart = arr[idx + 1]?.seconds;
                        const end = typeof nextStart === 'number' ? nextStart : start + 3.0;
                        return { startTime: start, endTime: end, chord: c.chord, confidence: 0.95 };
                      });
                      handleExportChordsMIDI(mapped, analysisResult.sections ?? structureAnalysis?.sections);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-[var(--bg-surface)] hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] hover:text-[var(--accent-primary)] border border-[var(--border-subtle)]"
                  title="Exportar secuencia armónica a archivo MIDI (.mid)"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>MIDI</span>
                </button>
              )}

              {onInsertChordsIntoLyrics && ((analysisResult.chords && analysisResult.chords.length > 0) || (keyAnalysis?.chords && keyAnalysis.chords.length > 0)) && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const chordsToInsert: ChordSegment[] = [];
                      if (analysisResult.chords && analysisResult.chords.length > 0) {
                        analysisResult.chords.forEach((c, idx, arr) => {
                          const start = typeof c.seconds === 'number' ? c.seconds : idx * 3.0;
                          const nextStart = arr[idx + 1]?.seconds;
                          const end = typeof nextStart === 'number' ? nextStart : start + 3.0;
                          chordsToInsert.push({
                            startTime: start,
                            endTime: end,
                            chord: c.chord,
                            confidence: 0.95
                          });
                        });
                      } else if (keyAnalysis?.chords && keyAnalysis.chords.length > 0) {
                        chordsToInsert.push(...keyAnalysis.chords);
                      }
                      if (chordsToInsert.length > 0) {
                        onInsertChordsIntoLyrics(
                          chordsToInsert,
                          analysisResult.sections ?? structureAnalysis?.sections
                        );
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                    title="Insertar acordes detectados automáticamente en las sílabas exactas de la letra"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Insertar en sílabas ({analysisResult.chords?.length || keyAnalysis?.chords?.length})</span>
                  </button>
                  {canUndoInsertChords && onUndoInsertChords && (
                    <button
                      type="button"
                      onClick={onUndoInsertChords}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                      title="Deshacer la inserción de acordes en la letra"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Deshacer</span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyAll}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                  applied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]'
                }`}
              >
                {applied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>¡Aplicado al Formulario!</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Aplicar datos al formulario</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Metric Badges Grid: Tempo, Key, Scale, Meter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* BPM */}
            <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                <Gauge className="w-3 h-3 text-[var(--accent-primary)]" />
                <span>Tempo / BPM</span>
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
                  {analysisResult.tempo}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">BPM</span>
              </div>
              {analysisResult.tempoOffset !== undefined && (
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  Offset: {analysisResult.tempoOffset.toFixed(3)}s
                </div>
              )}
            </div>

            {/* Key */}
            <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-[var(--accent-primary)]" />
                  <span>Tonalidad (Key)</span>
                </span>
                {keyAnalysis && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-semibold">
                    Essentia
                  </span>
                )}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-[var(--accent-primary)]">
                  {keyAnalysis ? getEffectiveKey() : analysisResult.key}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {keyAnalysis
                    ? (keyAnalysis.scale === 'minor' ? 'Menor' : 'Mayor')
                    : (analysisResult.key.endsWith('m') ? 'Menor' : 'Mayor')}
                </span>
              </div>
            </div>

            {/* Scale */}
            <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                <Layers className="w-3 h-3 text-[var(--accent-primary)]" />
                <span>Escala</span>
              </span>
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {keyAnalysis
                  ? (keyAnalysis.scale === 'minor' ? 'Menor Natural' : 'Mayor Natural')
                  : (analysisResult.scale || 'Natural')}
              </p>
            </div>

            {/* Compás */}
            <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[var(--accent-primary)]" />
                <span>Compás / Métrica</span>
              </span>
              <p className="text-sm font-bold font-mono text-[var(--text-primary)]">
                {analysisResult.timeSignature || '4/4'}
              </p>
            </div>
          </div>

          {/* Chord Progression */}
          {analysisResult.chordProgression && (
            <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1.5">
              <span className="text-[11px] font-medium text-[var(--text-secondary)] block">
                Progresión de acordes principal detectada:
              </span>
              <div className="font-mono text-sm font-bold text-[var(--accent-primary)] tracking-wide">
                {analysisResult.chordProgression}
              </div>
            </div>
          )}

          {/* Detected Chords Sequence */}
          {analysisResult.chords && analysisResult.chords.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-[var(--text-secondary)] block">
                Secuencia armónica detectada en el audio:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {analysisResult.chords.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-xs shadow-xs"
                  >
                    <span className="text-[10px] text-[var(--text-muted)]">{c.timestamp}</span>
                    <strong className="text-[var(--accent-primary)] font-bold">{c.chord}</strong>
                    {c.section && (
                      <span className="text-[10px] text-[var(--text-muted)] font-sans italic">
                        ({c.section})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes & Style */}
          {analysisResult.musicalNotes && (
            <p className="text-[11px] text-[var(--text-muted)] italic leading-relaxed pt-1">
              💡 {analysisResult.musicalNotes}
            </p>
          )}
        </div>
      )}

      {/* Security note */}
      <div className="text-[10px] text-[var(--text-muted)] flex items-start gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.2" />
        <span>
          <strong>Seguridad y Privacidad</strong>: El análisis de audio utiliza secrets del entorno en el servidor (<code className="font-mono">GEMINI_API_KEY</code>). Ninguna clave queda expuesta en el repositorio público ni en el navegador. En despliegues estáticos (GitHub Pages), se activa automáticamente el motor local Web Audio API DSP sin requerir claves externas.
        </span>
      </div>

      {isTunerOpen && (
        <ChromaticTunerModal
          initialTuning={analysisResult?.tuning}
          initialA4Hz={keyAnalysis?.referenceA4Hz ?? analysisResult?.referenceA4Hz ?? 440}
          onClose={() => setIsTunerOpen(false)}
        />
      )}
    </div>
  );
};
