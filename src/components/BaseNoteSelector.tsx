import React from 'react';
import { Music } from 'lucide-react';

interface BaseNoteSelectorProps {
  selectedNote: string;
  onNoteChange: (note: string) => void;
  showSharps?: boolean;
}

export const BaseNoteSelector: React.FC<BaseNoteSelectorProps> = ({
  selectedNote,
  onNoteChange,
  showSharps = true
}) => {
  const notes = showSharps 
    ? ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    : ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 mb-4">
        <Music className="w-5 h-5 text-[var(--accent-primary)]" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Selecciona la Nota Base
        </h3>
      </div>
      
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
        {notes.map((note) => (
          <button
            key={note}
            type="button"
            onClick={() => onNoteChange(note)}
            className={`py-3 px-2 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer ${
              selectedNote === note
                ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] shadow-md scale-105'
                : 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
            }`}
          >
            {note}
          </button>
        ))}
      </div>

      {/* Alternative notation toggle */}
      <div className="mt-4 p-3 bg-[var(--bg-surface-subtle)] rounded-xl border border-[var(--border-subtle)]">
        <p className="text-sm text-[var(--text-secondary)]">
          Nota seleccionada: <span className="font-bold text-[var(--accent-primary)]">{selectedNote}</span>
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Notación alternativa: <span className="font-mono">{
            showSharps && selectedNote.includes('#')
              ? flatNotes[notes.indexOf(selectedNote)]
              : selectedNote
          }</span>
        </p>
      </div>
    </div>
  );
};
