import React from 'react';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { AudioAnalyzerSection } from '../components/AudioAnalyzerSection';
import { useAppNavigation } from '../context/NavigationContext';

import { ChordSegment } from '../lib/audio/chords';
import { SavedAudioAnalysis } from '../types/song';

interface AudioAnalyzerPageProps {
  onCreateSongFromAudio?: (data: {
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
}

export const AudioAnalyzerPage: React.FC<AudioAnalyzerPageProps> = ({
  onCreateSongFromAudio
}) => {
  const { goBack, navigate } = useAppNavigation();

  const handleApplyDetection = (data: {
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
  }) => {
    if (onCreateSongFromAudio) {
      onCreateSongFromAudio(data);
    } else {
      navigate({ name: 'song-new' });
    }
  };

  return (
    <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => goBack({ name: 'catalog' })}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al catálogo</span>
        </button>
      </div>

      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-1 flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5" />
          <span>Laboratorio Acústico</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
          Detector de Audio Musical & Transcriptor
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Carga un archivo de audio (MP3, WAV, M4A) para analizar tempo, compás, tonalidad y acordes con Web Audio DSP y Gemini AI.
        </p>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-8 shadow-sm">
        <AudioAnalyzerSection
          onApplyDetection={handleApplyDetection}
        />
      </div>
    </div>
  );
};
