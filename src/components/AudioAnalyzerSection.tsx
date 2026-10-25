import React, { useState, useRef } from 'react';
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
  Wand2
} from 'lucide-react';
import { AudioAnalysisResult } from '../utils/webAudioAnalyzer';
import { AudioAnalysisService } from '../services/audioAnalysisService';

interface AudioAnalyzerSectionProps {
  onApplyDetection: (data: {
    tempo: number;
    key: string;
    timeSignature: string;
    tuning?: string;
    audioUrl?: string;
    chordProgression?: string;
    suggestedLyricsChords?: string;
  }) => void;
  currentKey?: string;
  currentTempo?: string;
  currentAudioUrl?: string;
}

export const AudioAnalyzerSection: React.FC<AudioAnalyzerSectionProps> = ({
  onApplyDetection,
  currentKey,
  currentTempo,
  currentAudioUrl
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>(currentAudioUrl || '');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AudioAnalysisResult | null>(null);
  const [applied, setApplied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFileSelected = (selectedFile: File) => {
    setError(null);
    setApplied(false);
    setAnalysisResult(null);

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
  };

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
    } catch (err: any) {
      setError(err.message || 'Error al analizar el archivo de audio.');
    } finally {
      setIsAnalyzing(false);
      setProgressMessage('');
    }
  };

  const handleApplyAll = () => {
    if (!analysisResult) return;

    onApplyDetection({
      tempo: analysisResult.tempo,
      key: analysisResult.key,
      timeSignature: analysisResult.timeSignature || '4/4',
      tuning: analysisResult.tuning || 'Estándar (EADGBE)',
      audioUrl: audioUrl || undefined,
      chordProgression: analysisResult.chordProgression,
      suggestedLyricsChords: analysisResult.suggestedLyricsChords
    });

    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const togglePlayback = () => {
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
                <span>IA & DSP</span>
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Sube tu maqueta grabada para calcular tempo, BPMs, tonalidad, compás y progresión de acordes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Cero secretos expuestos</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
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
                    <span>{analysisResult ? 'Reanalizar Audio' : 'Detectar con IA / DSP'}</span>
                  </>
                )}
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
                Archivos locales de audio de cualquier duración
              </p>
            </div>
          </>
        )}
      </div>

      {/* Hidden audio element for playback preview */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
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
            </div>

            {/* Key */}
            <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-[var(--accent-primary)]" />
                <span>Tonalidad (Key)</span>
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-[var(--accent-primary)]">
                  {analysisResult.key}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {analysisResult.key.endsWith('m') ? 'Menor' : 'Mayor'}
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
                {analysisResult.scale || 'Natural'}
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
    </div>
  );
};
