import React from 'react';
import { BeatAnalysis } from '../../lib/audio/onsets';
import {
  COMMON_TIME_SIGNATURES_LIST,
  MeterAnalysis,
  TimeSignature,
  UNCOMMON_TIME_SIGNATURES_LIST
} from '../../lib/audio/meter';

export interface AnalyzerRhythmTabProps {
  file: File | null;
  beatAnalysis: BeatAnalysis | null;
  meterAnalysis: MeterAnalysis | null;
  minTempo: number;
  maxTempo: number;
  onMinTempoChange: (val: number) => void;
  onMaxTempoChange: (val: number) => void;
  isCalculatingTempo: boolean;
  displayOffset?: number;
  onManualMeterChange: (meter: TimeSignature) => void;
  onRecalculateTempoRange: (file: File, minTempo: number, maxTempo: number) => void;
}

export const AnalyzerRhythmTab: React.FC<AnalyzerRhythmTabProps> = ({
  file,
  beatAnalysis,
  meterAnalysis,
  minTempo,
  maxTempo,
  onMinTempoChange,
  onMaxTempoChange,
  isCalculatingTempo,
  displayOffset,
  onManualMeterChange,
  onRecalculateTempoRange
}) => {
  return (
    <div className="space-y-4">
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
          {COMMON_TIME_SIGNATURES_LIST.map((m) => (
            <button
              key={m}
              type="button"
              disabled={!beatAnalysis}
              onClick={() => onManualMeterChange(m)}
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
                onManualMeterChange(e.target.value as TimeSignature);
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
            {UNCOMMON_TIME_SIGNATURES_LIST.map((m) => (
              <option key={m} value={m} className="bg-[var(--bg-modal)] text-[var(--text-primary)]">
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

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
                onChange={(e) => onMinTempoChange(Math.max(30, Number(e.target.value) || 60))}
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
                onChange={(e) => onMaxTempoChange(Math.max(minTempo + 10, Number(e.target.value) || 180))}
                className="w-16 min-h-[38px] sm:min-h-[32px] px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-mono tabular-nums text-center text-xs"
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => onRecalculateTempoRange(file, minTempo, maxTempo)}
                disabled={isCalculatingTempo}
                className="min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isCalculatingTempo ? 'Calculando…' : 'Recalcular ritmo'}
              </button>
            )}
          </div>
        </div>

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
                {beatAnalysis ? `${beatAnalysis.beats.length} / ${beatAnalysis.onsets.length}` : '—'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
