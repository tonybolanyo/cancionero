import React from 'react';
import { Square, Volume2 } from 'lucide-react';
import { parseLyricLine } from '../../utils/markdownParser';
import { SectionProgression } from '../../lib/music/midiExporter';

export interface SongDetailLyricsRendererProps {
  transposedLyrics: string;
  showChords: boolean;
  chordPosition: 'above' | 'inline';
  fontSize: 'sm' | 'base' | 'lg';
  sectionProgressions: SectionProgression[];
  playingProgressionId: string | null;
  activeProgressionStep: { id: string; index: number } | null;
  onToggleProgression: (progId: string, chords: string[]) => void;
  onInlineChordClick: (soundingChord: string) => void;
  formatDisplayedChord: (soundingChord: string) => string;
}

export const SongDetailLyricsRenderer: React.FC<SongDetailLyricsRendererProps> = ({
  transposedLyrics,
  showChords,
  chordPosition,
  fontSize,
  sectionProgressions,
  playingProgressionId,
  activeProgressionStep,
  onToggleProgression,
  onInlineChordClick,
  formatDisplayedChord
}) => {
  const lines = transposedLyrics.split('\n');
  let currentSecId = 'section-0';
  let chordIndexInSec = 0;

  return (
    <div className="max-w-3xl">
      {lines.map((line, idx) => {
        if (line.startsWith('##') || line.startsWith('#')) {
          const headingTitle = line.replace(/^#+\s*/, '').trim();
          const matchedSec = sectionProgressions.find(
            (s) => s.title.toLowerCase() === headingTitle.toLowerCase()
          );
          currentSecId = matchedSec?.id || `heading-${idx}`;
          chordIndexInSec = 0;
          const isPlayingThisSec = matchedSec && playingProgressionId === matchedSec.id;

          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 mt-6 mb-2 border-b border-[var(--border-subtle)] pb-1"
            >
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold">
                {headingTitle}
              </h4>
              {showChords && matchedSec && matchedSec.chords.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleProgression(matchedSec.id, matchedSec.chords)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    isPlayingThisSec
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold'
                      : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                  }`}
                  title={
                    isPlayingThisSec
                      ? 'Detener progresión de la sección'
                      : `Escuchar progresión (${matchedSec.chords.join(' - ')})`
                  }
                >
                  {isPlayingThisSec ? (
                    <Square className="w-2.5 h-2.5 fill-current" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                  <span>{isPlayingThisSec ? 'Detener' : 'Oír sección'}</span>
                </button>
              )}
            </div>
          );
        }

        if (!line.trim()) {
          return <div key={idx} className="h-4" />;
        }

        if (showChords && /\[([A-G][#b]?[^\]]*)\]/.test(line)) {
          if (chordPosition === 'above') {
            const segments = parseLyricLine(line);
            return (
              <div key={idx} className="flex flex-wrap items-end my-1 font-mono leading-none">
                {segments.map((segment, sIdx) => {
                  const chord = segment.chord;
                  const text = segment.text;
                  const displayChord = chord ? formatDisplayedChord(chord) : '';
                  let isStepActive = false;
                  if (chord) {
                    const thisChordIdx = chordIndexInSec;
                    chordIndexInSec++;
                    isStepActive =
                      activeProgressionStep !== null &&
                      activeProgressionStep.id === currentSecId &&
                      activeProgressionStep.index === thisChordIdx;
                  }
                  return (
                    <span key={sIdx} className="inline-flex flex-col mr-1">
                      {chord ? (
                        <button
                          type="button"
                          onClick={() => onInlineChordClick(chord)}
                          className={`text-left text-xs font-bold hover:underline select-none h-4 cursor-pointer rounded px-0.5 transition-colors ${
                            isStepActive
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                              : 'text-[var(--accent-primary)]'
                          }`}
                          title={`Oír y ver diagrama de ${chord}`}
                        >
                          {displayChord}
                        </button>
                      ) : (
                        <span className="text-xs font-bold select-none h-4">{'\u00A0'}</span>
                      )}
                      <span
                        className={`font-serif text-[var(--text-primary)] leading-normal ${
                          fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'
                        }`}
                      >
                        {text || '\u00A0'}
                      </span>
                    </span>
                  );
                })}
              </div>
            );
          }

          const parts = line.split(/(\[[A-G][#b]?[^\]]*\])/g);
          return (
            <p
              key={idx}
              className="leading-relaxed font-mono text-[var(--text-primary)] flex flex-wrap items-baseline gap-1 my-1"
            >
              {parts.map((part, pIdx) => {
                if (part.startsWith('[') && part.endsWith(']')) {
                  const chordSymbol = part.slice(1, -1);
                  const thisChordIdx = chordIndexInSec;
                  chordIndexInSec++;
                  const isStepActive =
                    activeProgressionStep !== null &&
                    activeProgressionStep.id === currentSecId &&
                    activeProgressionStep.index === thisChordIdx;
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => onInlineChordClick(chordSymbol)}
                      className={`inline-block px-1.5 py-0.5 rounded font-mono font-semibold text-xs border -translate-y-1 mx-0.5 select-none cursor-pointer transition-colors ${
                        isStepActive
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)]'
                          : 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)] border-[var(--accent-border)]'
                      }`}
                      title={`Oír y ver diagrama de ${chordSymbol}`}
                    >
                      {formatDisplayedChord(chordSymbol)}
                    </button>
                  );
                }
                return (
                  <span
                    key={pIdx}
                    className={`font-serif text-[var(--text-primary)] ${
                      fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'
                    }`}
                  >
                    {part}
                  </span>
                );
              })}
            </p>
          );
        }

        const cleanLine = line.replace(/\[[^\]]+\]/g, '');
        return (
          <p
            key={idx}
            className={`leading-relaxed font-serif text-[var(--text-secondary)] my-1 ${
              fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'
            }`}
          >
            {cleanLine}
          </p>
        );
      })}
    </div>
  );
};
