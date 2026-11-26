import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  Columns,
  Cpu,
  Hand,
  HelpCircle,
  Mic,
  Pause,
  Play,
  Save,
  Sliders,
  Sparkles,
  Undo2,
  UploadCloud,
  Wand2
} from 'lucide-react';
import { SongStatus } from '../../types/song';
import { AccidentalPreference } from '../../utils/markdownParser';

export type EditorWorkbenchTab = 'lyrics.md' | 'audio-studio.dsp' | 'sync.lrc' | 'metadata.json';

export const COMMON_KEYS_MAJOR = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'];
export const COMMON_KEYS_MINOR = ['Am', 'Em', 'Dm', 'Bm', 'F#m', 'C#m', 'Gm'];
export const COMMON_TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/4', '5/8', '7/8', '9/8', '12/8'];

export interface SongExportActionsProps {
  menuBarRef: React.RefObject<HTMLDivElement | null>;
  openMenu: string | null;
  onSetOpenMenu: (menu: string | null) => void;
  onNavigateBack: () => void;
  title: string;
  onTitleChange: (val: string) => void;
  completenessPercent: number;
  status: SongStatus;
  onStatusChange: (status: SongStatus) => void;
  keySignature: string;
  onKeyChange: (val: string) => void;
  tempo: string;
  onTempoChange: (val: string) => void;
  timeSignature: string;
  onTimeSignatureChange: (val: string) => void;
  accidentalPreference: AccidentalPreference;
  onTransposeLyrics: (delta: number) => void;
  onToggleAccidentals: () => void;
  onTapTempo: () => void;
  tapCount: number;
  onOpenTuner: () => void;
  audioUrl: string;
  isPlayingLocalAudio: boolean;
  onToggleLocalAudio: () => void;
  audioCurrentTime: number;
  onRequestAudioUpload: () => void;
  onRequestChordProImport: () => void;
  showStandPreview: boolean;
  onToggleStandPreview: () => void;
  onExportPdf: () => void;
  onExportChordPro: () => void;
  onExportMidi: () => void;
  onSubmit: () => void;
  isPushing: boolean;
  onInsertSection: (section: string) => void;
  hasDetectedChords: boolean;
  detectedChordsCount: number;
  onInsertDetectedChords: () => void;
  canUndoChordInsertion: boolean;
  onUndoChordInsertion: () => void;
  onStripChords: () => void;
  onCopyLyricsToLrc: () => void;
  onOpenAudioStudio: () => void;
  onSelectTranscriptionEngine: (engine: 'local_whisper' | 'backend_gemini') => void;
  onOpenSyncAssistant: () => void;
  onOpenShortcutsModal: () => void;
}

export const SongExportActions: React.FC<SongExportActionsProps> = ({
  menuBarRef,
  openMenu,
  onSetOpenMenu,
  onNavigateBack,
  title,
  onTitleChange,
  completenessPercent,
  status,
  onStatusChange,
  keySignature,
  onKeyChange,
  tempo,
  onTempoChange,
  timeSignature,
  onTimeSignatureChange,
  accidentalPreference,
  onTransposeLyrics,
  onToggleAccidentals,
  onTapTempo,
  tapCount,
  onOpenTuner,
  audioUrl,
  isPlayingLocalAudio,
  onToggleLocalAudio,
  audioCurrentTime,
  onRequestAudioUpload,
  onRequestChordProImport,
  showStandPreview,
  onToggleStandPreview,
  onExportPdf,
  onExportChordPro,
  onExportMidi,
  onSubmit,
  isPushing,
  onInsertSection,
  hasDetectedChords,
  detectedChordsCount,
  onInsertDetectedChords,
  canUndoChordInsertion,
  onUndoChordInsertion,
  onStripChords,
  onCopyLyricsToLrc,
  onOpenAudioStudio,
  onSelectTranscriptionEngine,
  onOpenSyncAssistant,
  onOpenShortcutsModal
}) => {
  return (
    <>
      {/* ROW 1: DESKTOP APPLICATION MENU BAR */}
      <div
        ref={menuBarRef}
        className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] px-3 py-1 flex items-center justify-between text-xs select-none"
      >
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onNavigateBack}
            className="px-2 py-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1 mr-1"
            title="Volver al catálogo (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Catálogo</span>
          </button>

          <span className="font-mono text-[11px] font-semibold text-[var(--accent-primary)] hidden md:inline border-r border-[var(--border-subtle)] pr-2">
            Studio
          </span>

          {/* Menu: ARCHIVO */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onSetOpenMenu(openMenu === 'archivo' ? null : 'archivo')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                openMenu === 'archivo'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                  : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              Archivo
            </button>
            {openMenu === 'archivo' && (
              <div className="absolute left-0 top-full mt-1 w-56 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onSubmit();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Guardar Cambios</span>
                  <kbd className="font-mono text-[10px] opacity-70">Ctrl+S</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange('published');
                    onSubmit();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Guardar y Publicar</span>
                  <kbd className="font-mono text-[10px] opacity-70">Ctrl+Shift+S</kbd>
                </button>
                <div className="h-px bg-[var(--border-subtle)] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onExportPdf();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Exportar PDF para Atril</span>
                  <kbd className="font-mono text-[10px] opacity-70">PDF</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportChordPro();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Exportar ChordPro</span>
                  <kbd className="font-mono text-[10px] opacity-70">.cho</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportMidi();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Exportar Progresión MIDI</span>
                  <kbd className="font-mono text-[10px] opacity-70">.mid</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRequestChordProImport();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Importar ChordPro...</span>
                  <kbd className="font-mono text-[10px] opacity-70">.cho</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRequestAudioUpload();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Cargar Archivo de Audio...</span>
                  <kbd className="font-mono text-[10px] opacity-70">MP3/WAV</kbd>
                </button>
                <div className="h-px bg-[var(--border-subtle)] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onNavigateBack();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-between cursor-pointer"
                >
                  <span>Cerrar / Descartar</span>
                  <kbd className="font-mono text-[10px] opacity-70">Esc</kbd>
                </button>
              </div>
            )}
          </div>

          {/* Menu: EDITAR */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onSetOpenMenu(openMenu === 'editar' ? null : 'editar')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                openMenu === 'editar'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                  : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              Editar
            </button>
            {openMenu === 'editar' && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onInsertSection('Intro');
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                >
                  Insertar Sección Intro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInsertSection('Estribillo');
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                >
                  Insertar Sección Estribillo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInsertSection('Puente');
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                >
                  Insertar Sección Puente
                </button>
                <div className="h-px bg-[var(--border-subtle)] my-1" />
                {canUndoChordInsertion && (
                  <button
                    type="button"
                    onClick={() => {
                      onUndoChordInsertion();
                      onSetOpenMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Deshacer inserción de acordes</span>
                    </div>
                    <kbd className="font-mono text-[10px]">Ctrl+Z</kbd>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onStripChords();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 cursor-pointer"
                >
                  Limpiar todos los acordes [C]
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCopyLyricsToLrc();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] cursor-pointer"
                >
                  Copiar Letra a LRC (sin acordes)
                </button>
              </div>
            )}
          </div>

          {/* Menu: MÚSICA */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onSetOpenMenu(openMenu === 'musica' ? null : 'musica')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                openMenu === 'musica'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                  : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              Música
            </button>
            {openMenu === 'musica' && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                {hasDetectedChords && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onInsertDetectedChords();
                        onSetOpenMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Insertar acordes en sílabas</span>
                      </div>
                      <span className="font-mono text-[10px]">({detectedChordsCount})</span>
                    </button>
                    {canUndoChordInsertion && (
                      <button
                        type="button"
                        onClick={() => {
                          onUndoChordInsertion();
                          onSetOpenMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Deshacer inserción de acordes</span>
                        </div>
                      </button>
                    )}
                    <div className="h-px bg-[var(--border-subtle)] my-1" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onTransposeLyrics(1);
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Subir +1 Semitono</span>
                  <kbd className="font-mono text-[10px]">+1</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTransposeLyrics(-1);
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Bajar -1 Semitono</span>
                  <kbd className="font-mono text-[10px]">-1</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleAccidentals();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Alternar # / b</span>
                  <span className="font-mono text-[10px] font-bold">
                    {accidentalPreference === 'sharps' ? 'Activo: #' : 'Activo: b'}
                  </span>
                </button>
                <div className="h-px bg-[var(--border-subtle)] my-1" />
                <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Tonalidades Populares
                </div>
                <div className="grid grid-cols-4 gap-1 px-2 py-1">
                  {[...COMMON_KEYS_MAJOR.slice(0, 4), ...COMMON_KEYS_MINOR.slice(0, 4)].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        onKeyChange(k);
                        onSetOpenMenu(null);
                      }}
                      className={`px-1.5 py-1 text-center font-mono rounded text-[11px] font-bold ${
                        keySignature === k
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                          : 'hover:bg-[var(--bg-surface-subtle)]'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Menu: AUDIO */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onSetOpenMenu(openMenu === 'audio' ? null : 'audio')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                openMenu === 'audio'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                  : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              Audio
            </button>
            {openMenu === 'audio' && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onOpenAudioStudio();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center gap-2 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Abrir Estudio DSP</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleLocalAudio();
                    onSetOpenMenu(null);
                  }}
                  disabled={!audioUrl}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer disabled:opacity-40"
                >
                  <span>{isPlayingLocalAudio ? 'Pausar Audio' : 'Reproducir Audio'}</span>
                  <kbd className="font-mono text-[10px] opacity-70">Espacio</kbd>
                </button>
                <div className="h-px bg-[var(--border-subtle)] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    onSelectTranscriptionEngine('local_whisper');
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Transcribir con Whisper Local</span>
                  </div>
                  <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">100% Privado</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectTranscriptionEngine('backend_gemini');
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Mic className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Transcribir con Gemini AI</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-70">Nube</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu: ATRIL */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onSetOpenMenu(openMenu === 'vista' ? null : 'vista')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                openMenu === 'vista'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                  : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              Atril
            </button>
            {openMenu === 'vista' && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onToggleStandPreview();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>{showStandPreview ? 'Ocultar Vista Dividida' : 'Activar Vista Dividida'}</span>
                  <kbd className="font-mono text-[10px] opacity-70">Ctrl+B</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenSyncAssistant();
                    onSetOpenMenu(null);
                  }}
                  disabled={!audioUrl}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer disabled:opacity-40"
                >
                  <span>Asistente Tap-to-Sync</span>
                  <kbd className="font-mono text-[10px] opacity-70">LRC</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExportPdf();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Imprimir Cancionero PDF</span>
                  <kbd className="font-mono text-[10px] opacity-70">Ctrl+P</kbd>
                </button>
              </div>
            )}
          </div>

          {/* Menu: AYUDA */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onSetOpenMenu(openMenu === 'ayuda' ? null : 'ayuda')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                openMenu === 'ayuda'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                  : 'hover:bg-[var(--bg-surface)] text-[var(--text-primary)]'
              }`}
            >
              Ayuda
            </button>
            {openMenu === 'ayuda' && (
              <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl z-50 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onOpenShortcutsModal();
                    onSetOpenMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)] flex items-center justify-between cursor-pointer"
                >
                  <span>Atajos de Teclado</span>
                  <kbd className="font-mono text-[10px] opacity-70">?</kbd>
                </button>
                <div className="px-3 py-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] mt-1">
                  Escribe acordes entre corchetes: <code>[Am] verso cantado...</code> para que se posicionen sobre la sílaba exacta en el atril.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 max-w-sm truncate text-[var(--text-secondary)] font-mono text-[11px]">
          <span className="opacity-60 hidden md:inline">canciones/</span>
          <span className="text-[var(--text-primary)] font-bold truncate">
            {title.trim() || 'nueva-cancion.md'}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${completenessPercent >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            title={`Completitud: ${completenessPercent}%`}
          />
        </div>
      </div>

      {/* ROW 2: DOCKED ACTION TOOLBAR RIBBON */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-3 py-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1 max-w-md">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Título de la composición..."
            className="font-serif font-bold text-sm sm:text-base bg-transparent border-b border-[var(--border-subtle)] hover:border-[var(--accent-primary)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)] w-full px-1 py-0.5 truncate"
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={isPushing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-md transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            title="Guardar canción (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isPushing ? 'Guardando...' : 'Guardar'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <div className="flex items-center bg-[var(--bg-surface-subtle)] rounded-md border border-[var(--border-subtle)] px-2 py-1 gap-1">
            <span className="text-[11px] text-[var(--text-muted)] font-medium">Tono:</span>
            <input
              type="text"
              value={keySignature}
              onChange={(e) => onKeyChange(e.target.value)}
              className="w-10 font-mono font-bold text-xs bg-transparent text-[var(--accent-primary)] text-center focus:outline-none"
              placeholder="Am"
            />
          </div>

          <div className="flex items-center bg-[var(--bg-surface-subtle)] rounded-md border border-[var(--border-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => onTransposeLyrics(-1)}
              className="px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Bajar medio tono (-1)"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => onTransposeLyrics(1)}
              className="px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Subir medio tono (+1)"
            >
              +1
            </button>
            <button
              type="button"
              onClick={onToggleAccidentals}
              className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Alternar sostenidos (#) o bemoles (b)"
            >
              {accidentalPreference === 'sharps' ? '#' : 'b'}
            </button>
          </div>

          <div className="flex items-center bg-[var(--bg-surface-subtle)] rounded-md border border-[var(--border-subtle)] px-2 py-1 gap-1">
            <span className="text-[11px] text-[var(--text-muted)] font-medium">BPM:</span>
            <input
              type="number"
              value={tempo}
              onChange={(e) => onTempoChange(e.target.value)}
              className="w-11 font-mono text-xs bg-transparent text-[var(--text-primary)] text-center focus:outline-none"
              placeholder="96"
            />
            <button
              type="button"
              onClick={onTapTempo}
              className="ml-0.5 px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-[10px] font-mono font-semibold text-[var(--accent-primary)] flex items-center gap-1 cursor-pointer active:scale-95"
              title="Pulsa al ritmo del tema para medir el BPM (Tap Tempo)"
            >
              <Hand className="w-2.5 h-2.5" />
              <span>Tap{tapCount > 1 ? ` ${tapCount}` : ''}</span>
            </button>
          </div>

          <select
            value={timeSignature}
            onChange={(e) => onTimeSignatureChange(e.target.value)}
            className="bg-[var(--bg-surface-subtle)] rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs font-mono text-[var(--text-secondary)] focus:outline-none cursor-pointer"
          >
            {COMMON_TIME_SIGNATURES.map((ts) => (
              <option key={ts} value={ts}>
                {ts}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onOpenTuner}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--accent-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] whitespace-nowrap cursor-pointer"
            title="Abrir afinador cromático YIN"
          >
            <Sliders className="w-3 h-3" />
            <span>Afinador</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {audioUrl ? (
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-subtle)] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-xs">
              <button
                type="button"
                onClick={onToggleLocalAudio}
                className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-text)] flex items-center justify-center cursor-pointer shadow-2xs"
                title="Reproducir / Pausar maqueta (Espacio)"
              >
                {isPlayingLocalAudio ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 ml-0.5" />}
              </button>
              <span className="font-mono tabular-nums text-[11px] text-[var(--text-muted)]">
                {Math.floor(audioCurrentTime / 60)}:{Math.floor(audioCurrentTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRequestAudioUpload}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Cargar archivo de audio o maqueta"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cargar Audio</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleStandPreview}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
              showStandPreview
                ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)] font-semibold'
                : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Alternar vista dividida del atril (Ctrl+B)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split Atril</span>
          </button>

          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            title="Generar Cancionero imprimible en PDF listo para atril"
          >
            <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as SongStatus)}
            className={`text-xs font-semibold px-2 py-1 rounded-md border cursor-pointer focus:outline-none ${
              status === 'published'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : status === 'draft'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'bg-stone-500/10 border-stone-500/30 text-stone-700 dark:text-stone-300'
            }`}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicada</option>
            <option value="private">Inédita</option>
          </select>
        </div>
      </div>
    </>
  );
};

export const EditorShortcutsDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="font-serif font-bold text-sm text-[var(--text-primary)]">
            Atajos de Teclado del Estudio
          </h3>
        </div>
        <button type="button" onClick={onClose} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
          ✕
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
          <span>Guardar canción</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">
            Ctrl + S
          </kbd>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
          <span>Alternar Vista Dividida Atril</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">
            Ctrl + B
          </kbd>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
          <span>Reproducir / Pausar audio</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">
            Espacio
          </kbd>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
          <span>Exportar Cancionero PDF</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">
            Ctrl + P
          </kbd>
        </div>
        <div className="flex items-center justify-between py-1">
          <span>Cerrar menús desplegables</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-mono text-[10px] font-bold">
            Esc
          </kbd>
        </div>
      </div>

      <div className="pt-2 text-right">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent-primary)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] cursor-pointer"
        >
          Entendido
        </button>
      </div>
    </div>
  </div>
);
