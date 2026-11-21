import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Hand } from 'lucide-react';
import {
  PrecisionMetronome,
  TapTempoTracker,
  MetronomeBeatEvent,
  getBeatsPerBar
} from '../lib/audio/metronome';

interface MetronomeWidgetProps {
  bpm: number;
  timeSignature?: string;
  onBpmChange?: (bpm: number) => void;
  compact?: boolean;
}

export const MetronomeWidget: React.FC<MetronomeWidgetProps> = ({
  bpm,
  timeSignature = '4/4',
  onBpmChange,
  compact = false
}) => {
  const [localBpm, setLocalBpm] = useState<number>(Math.max(35, Math.min(260, bpm || 96)));
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeBeat, setActiveBeat] = useState<number>(-1);
  const [tapCount, setTapCount] = useState<number>(0);

  const metronomeRef = useRef<PrecisionMetronome | null>(null);
  const tapTrackerRef = useRef<TapTempoTracker>(new TapTempoTracker());

  useEffect(() => {
    const clamped = Math.max(35, Math.min(260, Math.round(bpm) || 96));
    setLocalBpm(clamped);
    metronomeRef.current?.setBpm(clamped);
  }, [bpm]);

  useEffect(() => {
    metronomeRef.current?.setTimeSignature(timeSignature);
  }, [timeSignature]);

  useEffect(() => {
    const met = new PrecisionMetronome({
      bpm: localBpm,
      timeSignature,
      onBeat: (ev: MetronomeBeatEvent) => {
        setActiveBeat(ev.beatIndex);
      },
      onStateChange: (running) => {
        setIsRunning(running);
        if (!running) setActiveBeat(-1);
      }
    });
    metronomeRef.current = met;

    return () => {
      met.dispose();
      metronomeRef.current = null;
    };
  }, []);

  const beatsPerBar = getBeatsPerBar(timeSignature);

  const updateBpm = (next: number) => {
    const clamped = Math.max(35, Math.min(260, Math.round(next)));
    setLocalBpm(clamped);
    metronomeRef.current?.setBpm(clamped);
    onBpmChange?.(clamped);
  };

  const handleToggle = () => {
    metronomeRef.current?.setBpm(localBpm);
    metronomeRef.current?.setTimeSignature(timeSignature);
    metronomeRef.current?.toggle();
  };

  const handleTap = () => {
    const res = tapTrackerRef.current.tap();
    setTapCount(res.tapCount);
    if (res.bpm !== null) {
      updateBpm(res.bpm);
    }
  };

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] ${
        compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
          isRunning
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)]'
        }`}
        title={isRunning ? 'Detener metrónomo' : `Iniciar metrónomo (${localBpm} BPM · ${timeSignature})`}
      >
        {isRunning ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
        <span>{isRunning ? 'Parar' : 'Metrónomo'}</span>
      </button>

      {/* Beat indicator dots */}
      <div className="flex items-center gap-1 px-1" aria-label={`Compás ${timeSignature}`}>
        {Array.from({ length: beatsPerBar }, (_, idx) => {
          const isActive = isRunning && activeBeat === idx;
          const isDownbeat = idx === 0;
          return (
            <span
              key={idx}
              className={`rounded-full transition-transform duration-75 ${
                isDownbeat ? 'w-2.5 h-2.5' : 'w-2 h-2'
              } ${
                isActive
                  ? isDownbeat
                    ? 'bg-[var(--accent-primary)] scale-125'
                    : 'bg-emerald-500 scale-115'
                  : 'bg-[var(--border-medium)]'
              }`}
            />
          );
        })}
      </div>

      {/* BPM Stepper */}
      <div className="flex items-center gap-1 font-mono">
        <button
          type="button"
          onClick={() => updateBpm(localBpm - 2)}
          className="w-5 h-5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          title="Bajar 2 BPM"
        >
          -
        </button>
        <span className="min-w-[54px] text-center font-bold tabular-nums text-[var(--text-primary)]">
          {localBpm} BPM
        </span>
        <button
          type="button"
          onClick={() => updateBpm(localBpm + 2)}
          className="w-5 h-5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          title="Subir 2 BPM"
        >
          +
        </button>
      </div>

      {/* Tap Tempo */}
      <button
        type="button"
        onClick={handleTap}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:text-[var(--accent-primary)] text-[var(--text-secondary)] font-medium whitespace-nowrap transition-colors cursor-pointer active:scale-95"
        title="Pulsa rítmicamente para marcar el tempo (Tap Tempo)"
      >
        <Hand className="w-3 h-3" />
        <span>Tap{tapCount > 1 ? ` (${tapCount})` : ''}</span>
      </button>
    </div>
  );
};
