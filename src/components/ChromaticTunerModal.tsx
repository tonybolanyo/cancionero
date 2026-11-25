import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, X, CheckCircle2 } from 'lucide-react';
import { detectPitchYIN, PitchDetectionResult } from '../lib/audio/tuning';
import { GUITAR_TUNINGS } from '../lib/music/chordDiagrams';
import { playReferenceNote, midiToFrequency } from '../lib/audio/chordSynth';
import { useKeyboardShortcuts, SHORTCUT_PRIORITY } from '../hooks/useKeyboardShortcuts';

interface ChromaticTunerModalProps {
  initialTuning?: string;
  initialA4Hz?: number;
  onClose: () => void;
}

const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function formatMidiNote(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${MIDI_NOTE_NAMES[pc]}${octave}`;
}

export const ChromaticTunerModal: React.FC<ChromaticTunerModalProps> = ({
  initialTuning,
  initialA4Hz = 440,
  onClose
}) => {
  const [referenceA4Hz, setReferenceA4Hz] = useState<number>(initialA4Hz || 440);
  const [selectedTuningId, setSelectedTuningId] = useState<string>(() => {
    const lower = (initialTuning || '').toLowerCase();
    if (lower.includes('drop d')) return 'drop_d';
    if (lower.includes('dadgad')) return 'dadgad';
    if (lower.includes('medio tono')) return 'half_down';
    if (lower.includes('open g')) return 'open_g';
    if (lower.includes('open d')) return 'open_d';
    return 'standard';
  });
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [pitch, setPitch] = useState<PitchDetectionResult | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const a4Ref = useRef<number>(referenceA4Hz);

  const { register, unregister } = useKeyboardShortcuts();

  useEffect(() => {
    a4Ref.current = referenceA4Hz;
  }, [referenceA4Hz]);

  const stopMicrophone = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        void audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    setIsListening(false);
  }, []);

  const handleClose = useCallback(() => {
    stopMicrophone();
    onClose();
  }, [stopMicrophone, onClose]);

  useEffect(() => {
    register('chromatic-tuner-escape', {
      key: 'Escape',
      priority: SHORTCUT_PRIORITY.MODAL + 1,
      description: 'Cerrar afinador cromático',
      callback: () => {
        handleClose();
        return true;
      },
    });
    return () => unregister('chromatic-tuner-escape');
  }, [register, unregister, handleClose]);

  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, [stopMicrophone]);

  const startMicrophone = async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Tu navegador no permite acceso al micrófono para afinar.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      setIsListening(true);

      const tick = () => {
        if (!streamRef.current) return;
        analyser.getFloatTimeDomainData(buffer);
        const detected = detectPitchYIN(buffer, ctx.sampleRate, a4Ref.current);
        if (detected) {
          setPitch(detected);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      stopMicrophone();
      setMicError(err?.message || 'No se concedió permiso para usar el micrófono.');
    }
  };

  const activeTuning = GUITAR_TUNINGS.find(t => t.id === selectedTuningId) || GUITAR_TUNINGS[0];
  const isInTune = pitch !== null && Math.abs(pitch.cents) <= 5;
  const clampedCents = pitch ? Math.max(-50, Math.min(50, pitch.cents)) : 0;
  const needlePercent = 50 + clampedCents; // 0% = -50c, 50% = 0c, 100% = +50c

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Afinador Cromático de Precisión"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="font-serif font-bold text-lg text-[var(--text-primary)]">
              Afinador Cromático YIN
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Detección por micrófono 100% local · Calibración A4 = {referenceA4Hz} Hz
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopMicrophone();
              onClose();
            }}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
            aria-label="Cerrar afinador"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Calibration & Tuning Preset Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-muted)]">Afinación:</span>
              <select
                value={selectedTuningId}
                onChange={(e) => setSelectedTuningId(e.target.value)}
                className="px-2 py-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium cursor-pointer"
              >
                {GUITAR_TUNINGS.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)] font-mono">
              {[432, 440, 442].map(hz => (
                <button
                  key={hz}
                  type="button"
                  onClick={() => setReferenceA4Hz(hz)}
                  className={`px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                    referenceA4Hz === hz
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-bold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {hz} Hz
                </button>
              ))}
            </div>
          </div>

          {/* Pitch Meter */}
          <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-center space-y-4">
            <div className="flex items-baseline justify-center gap-2">
              <span
                className={`font-mono text-5xl font-bold tracking-tight ${
                  !pitch
                    ? 'text-[var(--text-muted)]'
                    : isInTune
                    ? 'text-emerald-500'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                {pitch ? `${pitch.noteName}${pitch.octave}` : '--'}
              </span>
              {pitch && (
                <span className="font-mono text-sm text-[var(--text-muted)]">
                  {pitch.frequencyHz.toFixed(1)} Hz
                </span>
              )}
            </div>

            {/* Cents bar */}
            <div className="space-y-1.5">
              <div className="relative h-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
                {/* Center sweet spot */}
                <div className="absolute left-1/2 top-0 bottom-0 w-3 -translate-x-1/2 bg-emerald-500/20" />
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-emerald-500" />
                {pitch && (
                  <div
                    style={{ left: `${needlePercent}%` }}
                    className={`absolute top-0.5 bottom-0.5 w-2.5 -translate-x-1/2 rounded-full transition-all duration-75 ${
                      isInTune ? 'bg-emerald-500' : 'bg-[var(--accent-primary)]'
                    }`}
                  />
                )}
              </div>
              <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)]">
                <span>-50 ♭</span>
                <span className={`font-bold ${isInTune ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>
                  {pitch
                    ? isInTune
                      ? 'Afinado ✓'
                      : `${pitch.cents > 0 ? `+${pitch.cents}` : pitch.cents} cents`
                    : isListening
                    ? 'Toca una cuerda...'
                    : 'Pulsa Activar Micrófono'}
                </span>
                <span>+50 ♯</span>
              </div>
            </div>

            {micError && (
              <p className="text-xs text-rose-500 font-medium">{micError}</p>
            )}

            <button
              type="button"
              onClick={isListening ? stopMicrophone : startMicrophone}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Detener Micrófono' : 'Activar Micrófono'}</span>
            </button>
          </div>

          {/* Reference Strings (click to hear Karplus-Strong tone) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Cuerdas de referencia ({activeTuning.label})</span>
              <span>Pulsa para oír tono</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {activeTuning.openMidi.map((midi, idx) => {
                const freq = midiToFrequency(midi, referenceA4Hz);
                const label = formatMidiNote(midi);
                const matchesDetected = pitch && pitch.midi === midi && Math.abs(pitch.cents) <= 12;
                return (
                  <button
                    key={`${midi}-${idx}`}
                    type="button"
                    onClick={() => playReferenceNote(freq)}
                    className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                      matchesDetected
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-300'
                        : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[var(--text-primary)]'
                    }`}
                    title={`Escuchar ${label} (${freq.toFixed(1)} Hz)`}
                  >
                    <div className="font-mono font-bold text-xs flex items-center justify-center gap-1">
                      <span>{label}</span>
                      {matchesDetected ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Volume2 className="w-2.5 h-2.5 opacity-60" />
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                      {freq.toFixed(0)} Hz
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
