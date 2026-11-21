import React, { useMemo } from 'react';
import { Volume2, Guitar, Piano, Sparkles, Music } from 'lucide-react';
import {
  ChordVoicing,
  FrettedVoicing,
  PianoVoicing,
  InstrumentType,
  CapoSuggestion,
  getChordVoicing,
  resolveGuitarTuning,
  suggestOptimalCapo,
  chordShapeWithCapo
} from '../lib/music/chordDiagrams';
import { chordToFunctionalSymbol } from '../lib/music/harmonyEngine';
import { playChordPreview } from '../lib/audio/chordSynth';
import { AccidentalPreference } from '../utils/markdownParser';

export type HarmonicNotationView = 'chords' | 'roman' | 'nashville';

interface FrettedSvgProps {
  voicing: FrettedVoicing;
  compact?: boolean;
}

const FrettedDiagramSvg: React.FC<FrettedSvgProps> = ({ voicing, compact = false }) => {
  const numStrings = voicing.frets.length;
  const numFrets = 4;
  const width = compact ? (numStrings === 4 ? 74 : 96) : numStrings === 4 ? 90 : 114;
  const height = compact ? 92 : 110;
  const padLeft = 18;
  const padRight = 10;
  const padTop = 20;
  const padBottom = 16;

  const gridW = width - padLeft - padRight;
  const gridH = height - padTop - padBottom;
  const stringStep = gridW / Math.max(1, numStrings - 1);
  const fretStep = gridH / numFrets;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={compact ? 'w-[84px] h-[86px]' : 'w-[108px] h-[106px]'}
      aria-label={`Diagrama de ${voicing.chord}`}
    >
      {/* Nut or base fret label */}
      {voicing.baseFret <= 1 ? (
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft + gridW}
          y2={padTop}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
        />
      ) : (
        <text
          x={padLeft - 6}
          y={padTop + fretStep * 0.7}
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="end"
          fill="var(--accent-primary)"
        >
          {voicing.baseFret}fr
        </text>
      )}

      {/* Horizontal fret wires */}
      {Array.from({ length: numFrets + 1 }, (_, f) => (
        <line
          key={`fret-${f}`}
          x1={padLeft}
          y1={padTop + f * fretStep}
          x2={padLeft + gridW}
          y2={padTop + f * fretStep}
          stroke="var(--border-medium)"
          strokeWidth={f === 0 && voicing.baseFret > 1 ? 1.5 : 1}
        />
      ))}

      {/* Vertical strings */}
      {Array.from({ length: numStrings }, (_, s) => (
        <line
          key={`str-${s}`}
          x1={padLeft + s * stringStep}
          y1={padTop}
          x2={padLeft + s * stringStep}
          y2={padTop + gridH}
          stroke="var(--text-muted)"
          strokeWidth={1 + (numStrings - s) * 0.14}
          opacity={0.75}
        />
      ))}

      {/* Optional Barre indicator */}
      {voicing.barre && voicing.barre >= voicing.baseFret && (
        (() => {
          const relFret = voicing.barre - voicing.baseFret + 1;
          if (relFret < 1 || relFret > numFrets) return null;
          const firstIdx = voicing.frets.findIndex(f => f === voicing.barre);
          let lastIdx = -1;
          for (let i = voicing.frets.length - 1; i >= 0; i--) {
            if (voicing.frets[i] === voicing.barre) {
              lastIdx = i;
              break;
            }
          }
          if (firstIdx < 0 || lastIdx <= firstIdx) return null;
          const y = padTop + (relFret - 0.5) * fretStep;
          return (
            <line
              x1={padLeft + firstIdx * stringStep}
              y1={y}
              x2={padLeft + lastIdx * stringStep}
              y2={y}
              stroke="var(--accent-primary)"
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.85}
            />
          );
        })()
      )}

      {/* Finger dots + O / X markers */}
      {voicing.frets.map((fret, s) => {
        const x = padLeft + s * stringStep;
        if (fret === -1) {
          return (
            <text
              key={`x-${s}`}
              x={x}
              y={padTop - 6}
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
              fill="var(--text-muted)"
            >
              ×
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle
              key={`o-${s}`}
              cx={x}
              cy={padTop - 9}
              r={3.2}
              fill="none"
              stroke="var(--text-secondary)"
              strokeWidth={1.3}
            />
          );
        }
        const relFret = fret - voicing.baseFret + 1;
        if (relFret < 1 || relFret > numFrets) return null;
        const y = padTop + (relFret - 0.5) * fretStep;
        return (
          <circle
            key={`dot-${s}`}
            cx={x}
            cy={y}
            r={compact ? 4.1 : 4.6}
            fill="var(--accent-primary)"
          />
        );
      })}

      {/* String tuning letters at bottom */}
      {voicing.stringNames.map((name, s) => (
        <text
          key={`lbl-${s}`}
          x={padLeft + s * stringStep}
          y={height - 3}
          fontSize="7.5"
          fontFamily="monospace"
          textAnchor="middle"
          fill="var(--text-muted)"
        >
          {name}
        </text>
      ))}
    </svg>
  );
};

interface PianoSvgProps {
  voicing: PianoVoicing;
  compact?: boolean;
}

const WHITE_KEY_PCS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const BLACK_KEY_OFFSETS: Array<{ pc: number; afterWhiteIndex: number }> = [
  { pc: 1, afterWhiteIndex: 0 }, // C#
  { pc: 3, afterWhiteIndex: 1 }, // D#
  { pc: 6, afterWhiteIndex: 3 }, // F#
  { pc: 8, afterWhiteIndex: 4 }, // G#
  { pc: 10, afterWhiteIndex: 5 } // A#
];

const PianoDiagramSvg: React.FC<PianoSvgProps> = ({ voicing, compact = false }) => {
  const numOctaves = 2;
  const totalWhite = 7 * numOctaves;
  const whiteW = compact ? 10 : 12;
  const whiteH = compact ? 42 : 50;
  const blackW = compact ? 6.4 : 7.5;
  const blackH = compact ? 25 : 30;
  const width = totalWhite * whiteW + 2;
  const height = whiteH + 4;

  // Map chord MIDI notes above octave C4 (60) so inversions/extensions show cleanly across 2 octaves
  const activeMidiSet = new Set(
    voicing.midiNotes.slice(1).map(m => ((m - 60) % 24 + 24) % 24)
  );
  const bassPc = voicing.bassPitchClass;
  const activePcSet = new Set(voicing.pitchClasses);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={compact ? 'w-[128px] h-[44px]' : 'w-[154px] h-[52px]'}
      aria-label={`Acorde de piano ${voicing.chord}`}
    >
      {/* White keys */}
      {Array.from({ length: totalWhite }, (_, i) => {
        const oct = Math.floor(i / 7);
        const pc = WHITE_KEY_PCS[i % 7];
        const semi = oct * 12 + pc;
        const isActive = activeMidiSet.has(semi) || (oct === 0 && activePcSet.has(pc));
        const isBass = oct === 0 && pc === bassPc;
        const x = 1 + i * whiteW;
        return (
          <g key={`wk-${i}`}>
            <rect
              x={x}
              y={1}
              width={whiteW - 1}
              height={whiteH}
              rx={1.5}
              fill={isActive ? 'var(--accent-primary)' : isBass ? 'var(--accent-subtle)' : '#fafaf9'}
              stroke="var(--border-medium)"
              strokeWidth={0.8}
            />
            {isActive && (
              <circle
                cx={x + (whiteW - 1) / 2}
                cy={whiteH - 7}
                r={2.2}
                fill="#ffffff"
              />
            )}
          </g>
        );
      })}

      {/* Black keys */}
      {Array.from({ length: numOctaves }, (_, oct) =>
        BLACK_KEY_OFFSETS.map(({ pc, afterWhiteIndex }) => {
          const semi = oct * 12 + pc;
          const isActive = activeMidiSet.has(semi) || (oct === 0 && activePcSet.has(pc));
          const x = 1 + (oct * 7 + afterWhiteIndex + 1) * whiteW - blackW / 2 - 0.5;
          return (
            <g key={`bk-${oct}-${pc}`}>
              <rect
                x={x}
                y={1}
                width={blackW}
                height={blackH}
                rx={1.2}
                fill={isActive ? 'var(--accent-primary)' : '#1c1917'}
                stroke="#0c0a09"
                strokeWidth={0.6}
              />
              {isActive && (
                <circle
                  cx={x + blackW / 2}
                  cy={blackH - 5.5}
                  r={1.8}
                  fill="#ffffff"
                />
              )}
            </g>
          );
        })
      )}
    </svg>
  );
};

export interface ChordDiagramCardProps {
  chord: string;
  instrument: InstrumentType;
  tuning?: string;
  soundingChord?: string;
  functionalLabel?: string;
  highlighted?: boolean;
  compact?: boolean;
  onSelect?: (chord: string) => void;
}

export const ChordDiagramCard: React.FC<ChordDiagramCardProps> = ({
  chord,
  instrument,
  tuning,
  soundingChord,
  functionalLabel,
  highlighted = false,
  compact = false,
  onSelect
}) => {
  const voicing: ChordVoicing = useMemo(
    () => getChordVoicing(chord, instrument, tuning),
    [chord, instrument, tuning]
  );

  const handleClick = () => {
    playChordPreview(soundingChord || chord, instrument, tuning);
    onSelect?.(chord);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group flex flex-col items-center rounded-xl border transition-all cursor-pointer shrink-0 ${
        compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5'
      } ${
        highlighted
          ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)] shadow-sm'
          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface-subtle)]'
      }`}
      title={`Pulsa para escuchar ${soundingChord || chord} (${instrument})`}
    >
      <div className="w-full flex items-center justify-between gap-1.5 mb-1">
        <span className="font-mono font-bold text-xs text-[var(--accent-primary)]">
          {chord}
        </span>
        <Volume2 className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
      </div>

      {functionalLabel && (
        <span className="text-[10px] font-mono text-[var(--text-muted)] mb-1">
          {functionalLabel}
        </span>
      )}

      {voicing.instrument === 'piano' ? (
        <PianoDiagramSvg voicing={voicing} compact={compact} />
      ) : (
        <FrettedDiagramSvg voicing={voicing} compact={compact} />
      )}

      {soundingChord && soundingChord !== chord && (
        <span className="mt-1 text-[10px] font-mono text-[var(--text-muted)]">
          Suena: {soundingChord}
        </span>
      )}
    </button>
  );
};

export interface SongChordsBarProps {
  chords: string[];
  soundingKey: string;
  tuning?: string;
  capoFret: number;
  onCapoChange: (fret: number) => void;
  instrument: InstrumentType;
  onInstrumentChange: (instrument: InstrumentType) => void;
  notationView: HarmonicNotationView;
  onNotationViewChange: (view: HarmonicNotationView) => void;
  accidentalPreference: AccidentalPreference;
  activeChord?: string | null;
  onChordSelect?: (chord: string) => void;
  compact?: boolean;
}

export const SongChordsBar: React.FC<SongChordsBarProps> = ({
  chords,
  soundingKey,
  tuning,
  capoFret,
  onCapoChange,
  instrument,
  onInstrumentChange,
  notationView,
  onNotationViewChange,
  accidentalPreference,
  activeChord,
  onChordSelect,
  compact = false
}) => {
  const tuningSpec = useMemo(() => resolveGuitarTuning(tuning), [tuning]);
  const capoSuggestions: CapoSuggestion[] = useMemo(
    () => suggestOptimalCapo(chords, soundingKey, accidentalPreference),
    [chords, soundingKey, accidentalPreference]
  );

  const bestCapo = capoSuggestions[0];
  const showOptimalSuggestion =
    instrument === 'guitar' &&
    bestCapo &&
    bestCapo.capoFret > 0 &&
    bestCapo.openChordCount > (capoSuggestions.find(c => c.capoFret === 0)?.openChordCount ?? 0);

  if (chords.length === 0) return null;

  return (
    <div className="mb-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Header Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 min-w-0">
          <Music className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <span className="font-serif font-bold text-sm text-[var(--text-primary)]">
            Acordes del Tema
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            · {chords.length} {chords.length === 1 ? 'acorde' : 'acordes'}
            {instrument === 'guitar' && ` · ${tuningSpec.label}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Instrument Selector */}
          <div className="flex items-center bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => onInstrumentChange('guitar')}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap flex items-center gap-1 transition-colors cursor-pointer ${
                instrument === 'guitar'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Guitar className="w-3.5 h-3.5" />
              <span>Guitarra</span>
            </button>
            <button
              type="button"
              onClick={() => onInstrumentChange('ukulele')}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer ${
                instrument === 'ukulele'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Ukelele
            </button>
            <button
              type="button"
              onClick={() => onInstrumentChange('piano')}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap flex items-center gap-1 transition-colors cursor-pointer ${
                instrument === 'piano'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Piano className="w-3.5 h-3.5" />
              <span>Piano</span>
            </button>
          </div>

          {/* Harmonic Notation View Switcher */}
          <div className="flex items-center bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => onNotationViewChange('chords')}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer ${
                notationView === 'chords'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Mostrar cifrado americano (Am, G, C...)"
            >
              Cifrado
            </button>
            <button
              type="button"
              onClick={() => onNotationViewChange('roman')}
              className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors cursor-pointer ${
                notationView === 'roman'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Vista en grados romanos (i, bVII, bVI, V7)"
            >
              I - V - vi
            </button>
            <button
              type="button"
              onClick={() => onNotationViewChange('nashville')}
              className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors cursor-pointer ${
                notationView === 'nashville'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] font-semibold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Sistema Nashville (1, 5, 6m, 4)"
            >
              Nashville
            </button>
          </div>

          {/* Capo selector (Guitar / Ukulele) */}
          {instrument !== 'piano' && (
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg px-2 py-1">
              <span className="text-[11px] font-mono text-[var(--text-muted)] whitespace-nowrap">Cejilla:</span>
              <select
                value={capoFret}
                onChange={(e) => onCapoChange(Number(e.target.value))}
                className="bg-transparent text-xs font-mono font-bold text-[var(--accent-primary)] focus:outline-none cursor-pointer"
                aria-label="Seleccionar traste de cejilla"
              >
                <option value={0}>Sin cejilla</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(f => (
                  <option key={f} value={f}>
                    Traste {f}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Optimal Capo Suggestion Banner */}
      {showOptimalSuggestion && capoFret !== bestCapo.capoFret && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
            <span>
              Sugerencia cómoda: <strong>{bestCapo.summary}</strong> ({bestCapo.openChordCount}/{bestCapo.totalUniqueChords} acordes abiertos)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onCapoChange(bestCapo.capoFret)}
            className="px-2.5 py-1 rounded bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold text-[11px] whitespace-nowrap cursor-pointer hover:bg-[var(--accent-hover)] transition-colors"
          >
            Aplicar cejilla {bestCapo.capoFret}
          </button>
        </div>
      )}

      {capoFret > 0 && instrument !== 'piano' && (
        <div className="text-xs font-mono text-[var(--text-secondary)]">
          Tono real: <strong className="text-[var(--text-primary)]">{soundingKey}</strong> · Cejilla en <strong>{capoFret}.º traste</strong> → Posturas tocadas en{' '}
          <strong className="text-[var(--accent-primary)]">
            {chordShapeWithCapo(soundingKey, capoFret, accidentalPreference)}
          </strong>
        </div>
      )}

      {/* Chord Diagrams Strip */}
      <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1">
        {chords.map((soundingChord) => {
          const shapeChord =
            capoFret > 0 && instrument !== 'piano'
              ? chordShapeWithCapo(soundingChord, capoFret, accidentalPreference)
              : soundingChord;
          const functionalLabel =
            notationView !== 'chords'
              ? chordToFunctionalSymbol(soundingChord, soundingKey, notationView)
              : chordToFunctionalSymbol(soundingChord, soundingKey, 'roman');

          return (
            <ChordDiagramCard
              key={soundingChord}
              chord={shapeChord}
              soundingChord={soundingChord}
              instrument={instrument}
              tuning={tuning}
              functionalLabel={functionalLabel}
              highlighted={activeChord === soundingChord || activeChord === shapeChord}
              compact={compact}
              onSelect={onChordSelect}
            />
          );
        })}
      </div>
    </div>
  );
};
