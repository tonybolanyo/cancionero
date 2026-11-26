import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AudioAnalysisResult } from '../utils/webAudioAnalyzer';
import { AudioAnalysisService } from '../services/audioAnalysisService';
import { SavedAudioAnalysis } from '../types/song';
import { TempoAnalysis, analyzeTempo, decodeAudioBuffer } from '../lib/audio/tempo';
import { BeatAnalysis, analyzeBeatsAndOnsets } from '../lib/audio/onsets';
import { useKeyAnalysis } from './useKeyAnalysis';
import { ChordSegment, exportChordsToJSON, exportChordsToCSV, downloadChordExport } from '../lib/audio/chords';
import { PitchShiftPlayer, AudioEqMode } from '../lib/audio/pitchShiftPlayer';
import { AccidentalPreference, respellChord, isValidPlayableAudioUrl } from '../utils/markdownParser';
import {
  MeterAnalysis,
  estimateMeter,
  recalculateDownbeats,
  TimeSignature,
  computeMedianBeatInterval
} from '../lib/audio/meter';
import type { MusicalSection, StructureAnalysisResult } from '../lib/audio/structure';
import { analyzeStructureWithWorker } from '../lib/audio/structureWorkerClient';
import {
  buildTimedChordEventsFromSegments,
  exportChordsToMidiBytes,
  downloadMidiFile
} from '../lib/music/midiExporter';

export const CHROMATIC_NOTES_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHROMATIC_NOTES_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export type AnalyzerTab = 'chords' | 'rhythm' | 'advanced';

export function formatAnalyzerClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface UseAudioAnalyzerWorkflowParams {
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
  savedAudioAnalysis?: SavedAudioAnalysis;
  currentKey?: string;
  currentTempo?: string;
  currentAudioUrl?: string;
  onAudioFileSelected?: (file: File) => void;
  externalAudioFile?: File | null;
  embedded?: boolean;
}

export function useAudioAnalyzerWorkflow({
  onApplyDetection,
  savedAudioAnalysis,
  currentKey,
  currentTempo,
  currentAudioUrl,
  onAudioFileSelected,
  externalAudioFile,
  embedded = false
}: UseAudioAnalyzerWorkflowParams) {
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

  const [activeTab, setActiveTab] = useState<AnalyzerTab>('chords');
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showChromaChart, setShowChromaChart] = useState<boolean>(false);
  const [isTimelineVisible, setIsTimelineVisible] = useState<boolean>(true);
  const [followActiveChord, setFollowActiveChord] = useState<boolean>(true);
  const [activeKpiEditor, setActiveKpiEditor] = useState<'key' | 'meter' | null>(null);
  const [manualKeyOverride, setManualKeyOverride] = useState<string | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const chordButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<PitchShiftPlayer | null>(null);

  // Tempo & Beats states
  const [tempoAnalysis, setTempoAnalysis] = useState<TempoAnalysis | null>(null);
  const [isCalculatingTempo, setIsCalculatingTempo] = useState<boolean>(false);
  const [tempoError, setTempoError] = useState<string | null>(null);
  const [minTempo, setMinTempo] = useState<number>(60);
  const [maxTempo, setMaxTempo] = useState<number>(180);
  const [decodedAudioBuffer, setDecodedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [beatAnalysis, setBeatAnalysis] = useState<BeatAnalysis | null>(null);
  const [isAnalyzingBeats, setIsAnalyzingBeats] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const {
    keyAnalysis,
    isAnalyzingKey,
    keyError,
    analyzeKey,
    resetKeyAnalysis
  } = useKeyAnalysis();

  const [pitchShiftSemitones, setPitchShiftSemitones] = useState<number>(0);
  const [preserveTempo, setPreserveTempo] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [eqMode, setEqMode] = useState<AudioEqMode>('normal');
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [isTunerOpen, setIsTunerOpen] = useState<boolean>(false);
  const [accidentalPreference, setAccidentalPreference] = useState<AccidentalPreference>('sharps');

  const [meterAnalysis, setMeterAnalysis] = useState<MeterAnalysis | null>(null);
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
      ([entry]) => setIsTimelineVisible(entry.isIntersecting),
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
          preserveTempo,
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
        .then((structRes) => {
          if (!cancelled) setStructureAnalysis(structRes);
        })
        .catch((err) => {
          console.warn('Refined structure analysis warning:', err);
        })
        .finally(() => {
          if (!cancelled) setIsAnalyzingStructure(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [keyAnalysis?.chords]);

  const handleManualMeterChange = (newMeter: TimeSignature) => {
    if (!beatAnalysis || beatAnalysis.beats.length === 0) {
      setMeterAnalysis({
        meter: newMeter,
        confidence: 1.0,
        downbeats: [],
        barCount: 0,
        phase: 0,
        candidates: meterAnalysis?.candidates
      });
      return;
    }
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
    setPreserveTempo((prev) => {
      const next = !prev;
      playerRef.current?.setPreserveTempo(next);
      return next;
    });
  };

  const handleToggleAccidentalPreference = () => {
    setAccidentalPreference((prev) => (prev === 'sharps' ? 'flats' : 'sharps'));
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

      const res = await analyzeTempo(audioBuffer, { minTempo: minT, maxTempo: maxT });
      setTempoAnalysis(res);
      setAnalysisResult((prev) =>
        prev
          ? {
              ...prev,
              tempo: res.bpm,
              tempoOffset: res.offset,
              rawTempo: res.tempo
            }
          : null
      );

      let detectedBeats: number[] | undefined;
      let detectedDownbeats: number[] | undefined;
      try {
        const beats = await analyzeBeatsAndOnsets(audioBuffer, { minBpm: minT, maxBpm: maxT });
        setBeatAnalysis(beats);
        detectedBeats = beats.beats;

        try {
          const estimatedMeter = estimateMeter({
            beats: beats.beats,
            onsets: beats.onsets,
            audioBuffer,
            bpm: beats.tempo
          });
          setMeterAnalysis(estimatedMeter);
          detectedDownbeats = estimatedMeter.downbeats;
        } catch (meterErr) {
          console.warn('Meter estimation warning:', meterErr);
        }
      } catch (beatErr) {
        console.warn('Onsets / Beat grid analysis warning:', beatErr);
      }

      void analyzeKey(audioBuffer, detectedBeats);

      setIsAnalyzingStructure(true);
      void analyzeStructureWithWorker({
        audioBuffer,
        options: {
          beats: detectedBeats,
          downbeats: detectedDownbeats,
          duration: audioBuffer.duration
        }
      })
        .then((structRes) => setStructureAnalysis(structRes))
        .catch((structErr) => console.warn('Structure analysis warning:', structErr))
        .finally(() => setIsAnalyzingStructure(false));
    } catch (err: unknown) {
      setTempoError(err instanceof Error ? err.message : 'Error al calcular tempo y offset del primer beat.');
    } finally {
      if (ctx && ctx.state !== 'closed') {
        try {
          await ctx.close();
        } catch {
          // ignore close error
        }
      }
      setIsCalculatingTempo(false);
      setIsAnalyzingBeats(false);
    }
  };

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

  const groupedChordSections = useMemo(() => {
    if (effectiveChords.length === 0) return [];
    if (effectiveSections.length === 0) {
      return [
        {
          id: 'all-chords',
          label: null as string | null,
          startTime: effectiveChords[0].startTime,
          endTime: effectiveChords[effectiveChords.length - 1].endTime,
          items: effectiveChords.map((chord, idx) => ({ chord, globalIdx: idx }))
        }
      ];
    }

    const groups = effectiveSections.map((sec) => ({
      id: sec.id,
      label: sec.label as string | null,
      startTime: sec.startTime,
      endTime: sec.endTime,
      items: [] as Array<{ chord: ChordSegment; globalIdx: number }>
    }));

    const leadingItems: Array<{ chord: ChordSegment; globalIdx: number }> = [];

    effectiveChords.forEach((chord, idx) => {
      const mid = (chord.startTime + chord.endTime) / 2;
      if (mid < effectiveSections[0].startTime) {
        leadingItems.push({ chord, globalIdx: idx });
        return;
      }
      let targetIdx = effectiveSections.findIndex(
        (sec, sIdx) =>
          mid >= sec.startTime &&
          (sIdx === effectiveSections.length - 1 ? true : mid < sec.endTime)
      );
      if (targetIdx === -1) targetIdx = groups.length - 1;
      groups[targetIdx].items.push({ chord, globalIdx: idx });
    });

    const nonEmpty = groups.filter((g) => g.items.length > 0);
    if (leadingItems.length > 0) {
      return [
        {
          id: 'leading-chords',
          label: 'Inicio' as string | null,
          startTime: leadingItems[0].chord.startTime,
          endTime: effectiveSections[0].startTime,
          items: leadingItems
        },
        ...nonEmpty
      ];
    }
    return nonEmpty;
  }, [effectiveChords, effectiveSections]);

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

    const respelledChords: ChordSegment[] = sourceChords.map((seg) => ({
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
    setManualKeyOverride(null);
    setActiveKpiEditor(null);
    resetKeyAnalysis();
    setCurrentTime(0);
    setLoopStart(null);
    setLoopEnd(null);
    if (playerRef.current) {
      playerRef.current.clearLoop();
      playerRef.current.pause();
      playerRef.current.seek(0);
    }

    const validExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    const lowerName = selectedFile.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!hasValidExt && !selectedFile.type.startsWith('audio/')) {
      setError('Por favor selecciona un archivo de audio (.mp3, .wav, .m4a, .aac o .ogg)');
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setAudioUrl(objectUrl);

    if (notifyParent && onAudioFileSelected) {
      onAudioFileSelected(selectedFile);
    }

    void handleCalculateTempo(selectedFile);
  };

  const handleClearFile = () => {
    setFile(null);
    setAudioUrl('');
    setAnalysisResult(null);
    setTempoAnalysis(null);
    setBeatAnalysis(null);
    setMeterAnalysis(null);
    setStructureAnalysis(null);
    setManualKeyOverride(null);
    setActiveKpiEditor(null);
    resetKeyAnalysis();
    if (audioRef.current) audioRef.current.pause();
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
      const result = await AudioAnalysisService.analyzeAudio(file, (_stage, msg) => {
        setProgressMessage(msg);
      });

      setAnalysisResult(result);
      if (result.sections && result.sections.length > 0 && !structureAnalysis) {
        setStructureAnalysis({
          sections: result.sections,
          noveltyCurve: [],
          boundaries: result.sections.map((s) => s.startTime),
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al analizar el archivo de audio.');
    } finally {
      setIsAnalyzing(false);
      setProgressMessage('');
    }
  };

  const getEffectiveKey = () => {
    if (manualKeyOverride) {
      return respellChord(manualKeyOverride, accidentalPreference);
    }
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
      scale: manualKeyOverride
        ? (manualKeyOverride.endsWith('m') ? 'Menor' : 'Mayor')
        : keyAnalysis?.scale === 'minor'
        ? 'Menor'
        : keyAnalysis?.scale === 'major'
        ? 'Mayor'
        : (analysisResult?.scale || savedAudioAnalysis?.scale),
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
      if (isPlaying) playerRef.current.pause();
      else playerRef.current.play();
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error', err);
      });
    }
  };

  const displayTempo = tempoAnalysis?.bpm ?? analysisResult?.tempo ?? savedAudioAnalysis?.tempo ?? null;
  const displayOffset = tempoAnalysis?.offset ?? analysisResult?.tempoOffset ?? savedAudioAnalysis?.tempoOffset;
  const displayMeter = meterAnalysis?.meter ?? (analysisResult?.timeSignature as TimeSignature | undefined) ?? (savedAudioAnalysis?.timeSignature as TimeSignature | undefined) ?? null;
  const displayKey = (manualKeyOverride || keyAnalysis || analysisResult?.key || savedAudioAnalysis?.key) ? getEffectiveKey() : null;
  const displayScale = manualKeyOverride
    ? (manualKeyOverride.endsWith('m') ? 'Menor Natural' : 'Mayor Natural')
    : keyAnalysis
    ? (keyAnalysis.scale === 'minor' ? 'Menor Natural' : 'Mayor Natural')
    : (analysisResult?.scale || savedAudioAnalysis?.scale || null);
  const progressionSummary = getChordProgressionSummary();

  const isAnyLocalAnalyzing = isCalculatingTempo || isAnalyzingBeats || isAnalyzingKey || isAnalyzingStructure;
  const hasAnyAnalysisData = Boolean(
    tempoAnalysis ||
    meterAnalysis ||
    keyAnalysis ||
    analysisResult ||
    manualKeyOverride ||
    (!file && savedAudioAnalysis)
  );

  const activeChordIndex = effectiveChords.findIndex((c) => currentTime >= c.startTime && currentTime < c.endTime);
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
    return effectiveChords.find((c) => c.startTime > currentTime);
  })();
  const activeSectionNow = effectiveSections.find((s) => currentTime >= s.startTime && currentTime < s.endTime);
  const hasPlayableAudio = Boolean(file || isValidPlayableAudioUrl(audioUrl));
  const showMobileMiniPlayer = hasPlayableAudio && !isTunerOpen && (!file || !isTimelineVisible);

  useEffect(() => {
    if (!isPlaying || !followActiveChord || activeTab !== 'chords' || activeChordIndex < 0) return;
    const activeBtn = chordButtonRefs.current.get(activeChordIndex);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeChordIndex, isPlaying, followActiveChord, activeTab]);

  return {
    file,
    audioUrl,
    isPlaying,
    setIsPlaying,
    isAnalyzing,
    progressMessage,
    analysisResult,
    applied,
    appliedTempo,
    appliedKey,
    appliedMeter,
    error,
    activeTab,
    setActiveTab,
    showExportMenu,
    setShowExportMenu,
    showChromaChart,
    setShowChromaChart,
    followActiveChord,
    setFollowActiveChord,
    activeKpiEditor,
    setActiveKpiEditor,
    manualKeyOverride,
    setManualKeyOverride,
    exportMenuRef,
    timelineContainerRef,
    chordButtonRefs,
    fileInputRef,
    audioRef,
    tempoAnalysis,
    isCalculatingTempo,
    tempoError,
    minTempo,
    setMinTempo,
    maxTempo,
    setMaxTempo,
    decodedAudioBuffer,
    beatAnalysis,
    isAnalyzingBeats,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    keyAnalysis,
    isAnalyzingKey,
    keyError,
    analyzeKey,
    pitchShiftSemitones,
    preserveTempo,
    playbackRate,
    eqMode,
    loopStart,
    loopEnd,
    isTunerOpen,
    setIsTunerOpen,
    accidentalPreference,
    meterAnalysis,
    isAnalyzingStructure,
    effectiveChords,
    effectiveSections,
    groupedChordSections,
    displayTempo,
    displayOffset,
    displayMeter,
    displayKey,
    displayScale,
    progressionSummary,
    isAnyLocalAnalyzing,
    hasAnyAnalysisData,
    activeChordIndex,
    activeChordNow,
    nextChordNow,
    activeSectionNow,
    showMobileMiniPlayer,
    handleManualMeterChange,
    handlePitchShiftChange,
    handleTogglePreserveTempo,
    handleToggleAccidentalPreference,
    handlePlaybackRateChange,
    handleEqModeChange,
    handleSetLoopA,
    handleSetLoopB,
    handleClearLoop,
    handleCalculateTempo,
    handleExportChordsJSON,
    handleExportChordsCSV,
    handleExportChordsMIDI,
    handleSeek,
    handleFileSelected,
    handleClearFile,
    handleDrop,
    handleRunAnalysis,
    handleApplyOnlyTempo,
    handleApplyOnlyMeter,
    handleApplyOnlyKey,
    handleApplyAll,
    togglePlayback
  };
}
