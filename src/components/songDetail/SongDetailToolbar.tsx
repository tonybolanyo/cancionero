import React from 'react';
import { Check, Copy, RotateCcw, ScrollText, Square, Volume2 } from 'lucide-react';
import { AccidentalPreference } from '../../utils/markdownParser';
import { MetronomeWidget } from '../MetronomeWidget';
import { SectionProgression } from '../../lib/music/midiExporter';

export type SongDetailTab = 'lyrics' | 'synced_lyrics' | 'markdown' | 'notes';

export interface SongDetailToolbarProps {
  activeTab: SongDetailTab;
  onTabChange: (tab: SongDetailTab) => void;
  currentKey: string;
  semitones: number;
  onTranspose: (delta: number) => void;
  onResetTranspose: () => void;
  accidentalPreference: AccidentalPreference;
  onToggleAccidentalPreference: () => void;
  showChords: boolean;
  onToggleShowChords: () => void;
  chordPosition: 'above' | 'inline';
  onChordPositionChange: (pos: 'above' | 'inline') => void;
  fontSize: 'sm' | 'base' | 'lg';
  onFontSizeChange: (size: 'sm' | 'base' | 'lg') => void;
  tempo?: number;
  timeSignature?: string;
  isAutoScrolling: boolean;
  onToggleAutoScroll: () => void;
  scrollSpeed: number;
  onScrollSpeedChange: (speed: number) => void;
  sectionProgressions: SectionProgression[];
  playingProgressionId: string | null;
  onToggleProgression: (progId: string, chords: string[]) => void;
  copied: boolean;
  onCopyLyrics: () => void;
}

export const SongDetailToolbar: React.FC<SongDetailToolbarProps> = ({
  activeTab,
  onTabChange,
  currentKey,
  semitones,
  onTranspose,
  onResetTranspose,
  accidentalPreference,
  onToggleAccidentalPreference,
  showChords,
  onToggleShowChords,
  chordPosition,
  onChordPositionChange,
  fontSize,
  onFontSizeChange,
  tempo,
  timeSignature,
  isAutoScrolling,
  onToggleAutoScroll,
  scrollSpeed,
  onScrollSpeedChange,
  sectionProgressions,
  playingProgressionId,
  onToggleProgression,
  copied,
  onCopyLyrics
}) => {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface-subtle)] rounded-lg">
        {(
          [
            { id: 'lyrics', label: 'Letra y Acordes' },
            { id: 'synced_lyrics', label: 'Letras Sincronizadas (LRC)' },
            { id: 'notes', label: 'Notas y Contexto' },
            { id: 'markdown', label: 'Markdown' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'lyrics' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg px-2 py-1">
            <span className="text-xs text-[var(--text-muted)] font-mono">Tono:</span>
            <button
              onClick={() => onTranspose(-1)}
              className="w-6 h-6 flex items-center justify-center rounded text-xs hover:bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
              title="Bajar medio tono (-1)"
            >
              -1
            </button>
            <span className="font-mono font-bold text-xs px-1 text-[var(--accent-primary)]">
              {currentKey}
            </span>
            <button
              onClick={() => onTranspose(1)}
              className="w-6 h-6 flex items-center justify-center rounded text-xs hover:bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
              title="Subir medio tono (+1)"
            >
              +1
            </button>
            {semitones !== 0 && (
              <button
                onClick={onResetTranspose}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer ml-1"
                title="Restablecer tono original"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={onToggleAccidentalPreference}
            className="px-2 py-1 text-xs font-mono rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            title="Alternar sostenidos (#) y bemoles (b)"
          >
            {accidentalPreference === 'sharps' ? '#' : 'b'}
          </button>

          <button
            onClick={onToggleShowChords}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
              showChords
                ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {showChords ? 'Acordes activados' : 'Sin acordes'}
          </button>

          {showChords && (
            <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
              <button
                onClick={() => onChordPositionChange('above')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer ${
                  chordPosition === 'above'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium shadow-sm'
                    : 'text-[var(--text-muted)]'
                }`}
                title="Acordes sobre la letra"
              >
                Arriba
              </button>
              <button
                onClick={() => onChordPositionChange('inline')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer ${
                  chordPosition === 'inline'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium shadow-sm'
                    : 'text-[var(--text-muted)]'
                }`}
                title="Acordes en línea [Am]"
              >
                En línea
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
            {(['sm', 'base', 'lg'] as const).map((size) => (
              <button
                key={size}
                onClick={() => onFontSizeChange(size)}
                className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors cursor-pointer ${
                  fontSize === size
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-sm'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {size === 'sm' ? 'A-' : size === 'lg' ? 'A+' : 'A'}
              </button>
            ))}
          </div>

          <MetronomeWidget bpm={tempo || 96} timeSignature={timeSignature || '4/4'} compact />

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleAutoScroll}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                isAutoScrolling
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
              title="Desplazamiento automático para leer la letra y tocar en atril"
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>{isAutoScrolling ? 'Pausar Scroll' : 'Auto-Scroll'}</span>
            </button>
            {isAutoScrolling && (
              <select
                value={scrollSpeed}
                onChange={(e) => onScrollSpeedChange(Number(e.target.value))}
                className="px-1.5 py-1 text-xs font-mono rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] cursor-pointer"
                aria-label="Velocidad de autodesplazamiento"
              >
                <option value={0.7}>0.7x</option>
                <option value={1}>1x</option>
                <option value={1.3}>1.3x</option>
              </select>
            )}
          </div>

          {showChords && sectionProgressions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const allChords = sectionProgressions.flatMap((s) => s.chords);
                onToggleProgression('__full_song__', allChords);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                playingProgressionId === '__full_song__'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--accent-primary)]'
              }`}
              title="Reproducir la progresión completa de acordes del tema al tempo configurado"
            >
              {playingProgressionId === '__full_song__' ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              )}
              <span>{playingProgressionId === '__full_song__' ? 'Detener' : 'Oír progresión'}</span>
            </button>
          )}

          <button
            onClick={onCopyLyrics}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-medium)] transition-colors whitespace-nowrap cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiada' : 'Copiar letra'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
