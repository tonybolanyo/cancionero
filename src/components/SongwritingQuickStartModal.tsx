import React, { useState, useRef } from 'react';
import {
  PenTool,
  Mic,
  Music,
  UploadCloud,
  FileAudio,
  Sparkles,
  ArrowRight,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SONGWRITING_TEMPLATES } from '../utils/songwriterHelper';

interface SongwritingQuickStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWithLyrics: () => void;
  onStartWithAudioFile: (file: File) => void;
  onStartWithTemplate: (template: typeof SONGWRITING_TEMPLATES[0]) => void;
}

export const SongwritingQuickStartModal: React.FC<SongwritingQuickStartModalProps> = ({
  isOpen,
  onClose,
  onStartWithLyrics,
  onStartWithAudioFile,
  onStartWithTemplate
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('classic-author');
  const [mode, setMode] = useState<'options' | 'template_picker'>('options');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac)$/i.test(droppedFile.name)) {
        setSelectedFile(droppedFile);
        onStartWithAudioFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onStartWithAudioFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Taller de Creación de Canción
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                ¿Cómo deseas empezar tu nueva composición hoy?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {mode === 'options' ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Escribir Letra */}
              <button
                onClick={() => {
                  onStartWithLyrics();
                  onClose();
                }}
                className="p-5 text-left rounded-xl bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-subtle)]/20 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-surface-subtle)] group-hover:bg-[var(--accent-primary)] group-hover:text-[var(--accent-text)] text-[var(--accent-primary)] flex items-center justify-center mb-3 transition-colors">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <h4 className="font-serif font-bold text-base text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                    1. Escribir Letra Primero
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                    Comienza desde tus versos, poesía o acordes con un editor limpio, paleta de acordes en 1 clic y transporte tonal.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] mt-4 pt-3 border-t border-[var(--border-subtle)]">
                  <span>Abrir Taller de Letras</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Option 2: Subir Audio */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-5 text-left rounded-xl border-2 transition-all cursor-pointer group flex flex-col justify-between ${
                  dragActive
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)]/40 scale-[1.01]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-subtle)]/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div>
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-surface-subtle)] group-hover:bg-[var(--accent-primary)] group-hover:text-[var(--accent-text)] text-[var(--accent-primary)] flex items-center justify-center mb-3 transition-colors">
                    <Mic className="w-5 h-5" />
                  </div>
                  <h4 className="font-serif font-bold text-base text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                    2. Subir Nota de Voz o Audio
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                    Arrastra tu maqueta (.mp3, .wav, .m4a). Detecta tono y tempo (BPM) y transcribe tu voz cantada automáticamente.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] mt-4 pt-3 border-t border-[var(--border-subtle)]">
                  <UploadCloud className="w-4 h-4" />
                  <span>Arrastrar o Elegir Archivo</span>
                </div>
              </div>
            </div>

            {/* Option 3: Usar Estructura / Plantilla */}
            <div className="pt-2">
              <button
                onClick={() => setMode('template_picker')}
                className="w-full p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)]">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      ¿Necesitas inspiración? Usar estructura de canción clásica
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Plantillas preparadas con Intro, Estrofas, Estribillo y acordes de guitarra
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>
        ) : (
          /* Template Picker View */
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Elige una plantilla para tu composición:
              </span>
              <button
                onClick={() => setMode('options')}
                className="text-xs text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                ← Volver a opciones
              </button>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {SONGWRITING_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedTemplateId === tmpl.id
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)]/30 shadow-xs'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-medium)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[var(--text-primary)]">
                        {tmpl.title}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {tmpl.description}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary)] shrink-0">
                      Tono {tmpl.key} · {tmpl.tempo} BPM
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] font-mono text-[var(--text-muted)] truncate bg-[var(--bg-surface-subtle)] p-2 rounded">
                    {tmpl.lyrics.split('\n').slice(0, 3).join(' · ')}...
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setMode('options')}
                className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const tmpl = SONGWRITING_TEMPLATES.find(t => t.id === selectedTemplateId) || SONGWRITING_TEMPLATES[0];
                  onStartWithTemplate(tmpl);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-sm flex items-center gap-2"
              >
                <span>Usar esta estructura</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
