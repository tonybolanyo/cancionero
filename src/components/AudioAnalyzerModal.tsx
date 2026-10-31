import React, { useState } from 'react';
import { X, Sparkles, Wand2, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { AudioAnalyzerSection } from './AudioAnalyzerSection';

interface AudioAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSongFromAudio?: (data: {
    tempo: number;
    key: string;
    timeSignature: string;
    tuning?: string;
    audioUrl?: string;
    chordProgression?: string;
    suggestedLyricsChords?: string;
    tempoOffset?: number;
  }) => void;
}

export const AudioAnalyzerModal: React.FC<AudioAnalyzerModalProps> = ({
  isOpen,
  onClose,
  onCreateSongFromAudio
}) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleApplyDetection = (data: {
    tempo: number;
    key: string;
    timeSignature: string;
    tuning?: string;
    audioUrl?: string;
    chordProgression?: string;
    suggestedLyricsChords?: string;
    tempoOffset?: number;
  }) => {
    if (onCreateSongFromAudio) {
      onCreateSongFromAudio(data);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 md:p-6 bg-black/85 backdrop-blur-sm overflow-hidden animate-fadeIn">
      <div className={`relative w-full flex flex-col rounded-xl sm:rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)] transition-all duration-200 ${
        isMaximized
          ? 'w-[99vw] max-w-[99vw] h-[98vh] max-h-[98vh]'
          : 'max-w-5xl xl:max-w-6xl 2xl:max-w-7xl 3xl:max-w-[2200px] 4xl:max-w-[2800px] h-[94vh] max-h-[94vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] shadow-sm">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                  Laboratorio de Audio: Detección Musical
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>MP3 / WAV</span>
                </span>
                {isMaximized && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
                    Estudio 4K
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Detección automática de Tempo (BPMs), Tonalidad, Escala y Acordes para canciones acústicas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
              title={isMaximized ? 'Restaurar tamaño normal' : 'Modo Pantalla Completa 4K'}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer transition-colors"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--bg-surface)] space-y-4">
          <AudioAnalyzerSection
            onApplyDetection={handleApplyDetection}
          />
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-modal)] flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)] text-[11px]">
            Los datos analizados pueden transferirse automáticamente a la ficha de una nueva canción
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
