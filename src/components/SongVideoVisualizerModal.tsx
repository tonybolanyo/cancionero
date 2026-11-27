import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Video,
  Film,
  Sliders,
  Volume2,
  VolumeX,
  Upload,
  Music,
  Youtube
} from 'lucide-react';
import { Song } from '../types/song';
import { useAuth } from '../context/AuthContext';
import { useKeyboardShortcuts, SHORTCUT_PRIORITY } from '../hooks/useKeyboardShortcuts';
import {
  formatFileSize,
  formatVideoTime,
  RESOLUTION_PRESETS,
  EFFECT_OPTIONS,
  THEME_OPTIONS
} from '../lib/video/presets';
import { useVideoVisualizerRecorder } from '../lib/video/useVideoVisualizerRecorder';
import type {
  VideoResolution,
  ResolutionConfig,
  VisualizerEffect,
  EffectOption,
  BackgroundTheme,
  ThemeOption,
  LyricFontStyle
} from '../lib/video/types';
import { VisualizerSettingsTab } from './video/VisualizerSettingsTab';
import { VisualizerExportTab } from './video/VisualizerExportTab';
import { AccessibleModal } from './modals/AccessibleModal';

export { formatFileSize, RESOLUTION_PRESETS, EFFECT_OPTIONS, THEME_OPTIONS };
export type {
  VideoResolution,
  ResolutionConfig,
  VisualizerEffect,
  EffectOption,
  BackgroundTheme,
  ThemeOption,
  LyricFontStyle
};

export interface SongVideoVisualizerWorkspaceProps {
  song: Song;
  onClose?: () => void;
  allSongs?: Song[];
  onSelectOtherSong?: (song: Song) => void;
  mode?: 'modal' | 'page';
}

interface SongVideoVisualizerModalProps {
  song: Song;
  onClose: () => void;
  allSongs?: Song[];
  onSelectOtherSong?: (song: Song) => void;
}

export const SongVideoVisualizerWorkspace: React.FC<SongVideoVisualizerWorkspaceProps> = ({
  song,
  onClose,
  allSongs = [],
  onSelectOtherSong,
  mode = 'page'
}) => {
  const { isAuthor } = useAuth();
  const { register, unregister } = useKeyboardShortcuts();

  // Configuration States
  const [resolution, setResolution] = useState<VideoResolution>('1080p');
  const [effect, setEffect] = useState<VisualizerEffect>('spectrum-bars');
  const [theme, setTheme] = useState<BackgroundTheme>('warm-amber');
  const [fontStyle, setFontStyle] = useState<LyricFontStyle>('serif');
  const [showChords, setShowChords] = useState<boolean>(false);
  const [showMetadataBadge, setShowMetadataBadge] = useState<boolean>(true);
  const [showProgressBar, setShowProgressBar] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>('Tony GB · Cancionero de autor');
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'settings' | 'export'>('preview');

  const recorder = useVideoVisualizerRecorder({
    song,
    isAuthor,
    resolution,
    effect,
    theme,
    fontStyle,
    showChords,
    showMetadataBadge,
    showProgressBar,
    watermarkText,
    customBgUrl,
    onRecordingComplete: () => setActiveTab('export')
  });

  // Register Escape only when rendered as a modal overlay
  useEffect(() => {
    if (!isAuthor || mode !== 'modal' || !onClose) return;

    register('video-visualizer-escape', {
      key: 'Escape',
      priority: SHORTCUT_PRIORITY.MODAL + 1,
      description: 'Cerrar visualizador de vídeo',
      when: () => isAuthor && mode === 'modal',
      callback: () => {
        onClose();
        return true;
      }
    });

    return () => unregister('video-visualizer-escape');
  }, [isAuthor, mode, register, unregister, onClose]);

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomBgUrl(url);
      setTheme('custom-image');
    }
  };

  const selectedResConfig = RESOLUTION_PRESETS[resolution];
  const isModal = mode === 'modal';

  // If not author, prevent rendering video generator (after all hooks to obey Rules of Hooks)
  if (!isAuthor) {
    return null;
  }

  return (
    <div
      className={
        isModal
          ? 'relative w-full max-w-6xl max-h-[96vh] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]'
          : 'w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm flex flex-col overflow-hidden text-[var(--text-primary)]'
      }
    >
      {/* Hidden Audio Element */}
      {recorder.resolvedAudioUrl && (
        <audio
          ref={recorder.audioRef}
          src={recorder.resolvedAudioUrl}
          crossOrigin="anonymous"
          playsInline
          onTimeUpdate={recorder.handleTimeUpdate}
          onLoadedMetadata={recorder.handleLoadedMetadata}
          onEnded={recorder.handleAudioEnded}
          onError={(e) => {
            console.warn('Error en el elemento de audio de SongVideoVisualizerModal:', e);
            recorder.setIsPlaying(false);
            recorder.setAudioError('No se pudo cargar la pista de audio para el visualizador.');
          }}
        />
      )}

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
            {isModal ? (
              <h2 id="video-visualizer-title" className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Generador de Vídeo para YouTube
              </h2>
            ) : (
              <h1 id="video-visualizer-title" className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                Generador de Vídeo para YouTube
              </h1>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)]">
              {resolution} (16:9)
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Visualización sincronizada de letra, espectro de audio y efectos · <strong>{song.title}</strong>
          </p>
        </div>
      </div>

      {/* Close & Navigation */}
      <div className="flex items-center gap-2">
        {allSongs.length > 1 && onSelectOtherSong && (
          <select
            value={song.id}
            onChange={(e) => {
              const target = allSongs.find(s => s.id === e.target.value);
              if (target) onSelectOtherSong(target);
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] focus:outline-none cursor-pointer"
          >
            {allSongs.map(s => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}

        {isModal && onClose && (
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
            title="Cerrar modal"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>

        {/* Tabs Bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Lienzo y Previsualización</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configuración y Parámetros</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'export'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Exportar y Guardar {recorder.recordedBlob && '✓'}</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-1 rounded-lg border border-[var(--border-subtle)]">
            <span className="text-[11px] text-[var(--text-muted)] font-mono px-1.5">Resolución:</span>
            {(['1080p', '720p', '360p'] as VideoResolution[]).map(res => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  resolution === res
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] flex items-center justify-center group">
                <canvas
                  ref={recorder.canvasRef}
                  width={selectedResConfig.width}
                  height={selectedResConfig.height}
                  className="w-full h-full object-contain"
                />

                {recorder.isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white font-mono text-xs font-bold shadow-lg animate-pulse backdrop-blur-md">
                    <span className="w-2.5 h-2.5 rounded-full bg-white" />
                    <span>GRABANDO VÍDEO ({recorder.recordingProgress}%)</span>
                  </div>
                )}

                {!recorder.isRecording && (
                  <button
                    onClick={recorder.togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label={recorder.isPlaying ? 'Pausar' : 'Reproducir'}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                      {recorder.isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                    </div>
                  </button>
                )}
              </div>

              <div className="bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={recorder.togglePlay}
                    className="w-11 h-11 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] flex items-center justify-center transition-all shadow-md cursor-pointer shrink-0"
                    title={recorder.isPlaying ? 'Pausar' : 'Reproducir'}
                  >
                    {recorder.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => recorder.handleSeek(0)}
                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface)] transition-colors cursor-pointer shrink-0"
                    title="Reiniciar desde el inicio"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <div className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                    <span className="text-[var(--text-primary)] font-bold">{formatVideoTime(recorder.currentTime)}</span>
                    <span> / {formatVideoTime(recorder.duration)}</span>
                  </div>
                </div>

                <div className="flex-1 max-w-xl flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max={recorder.duration || 100}
                    step="0.5"
                    value={recorder.currentTime}
                    onChange={(e) => recorder.handleSeek(parseFloat(e.target.value))}
                    className="w-full accent-[var(--accent-primary)] cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => recorder.setIsMuted(!recorder.isMuted)}
                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                    title={recorder.isMuted ? 'Activar sonido' : 'Silenciar altavoz'}
                  >
                    {recorder.isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  {!recorder.isRecording ? (
                    <button
                      onClick={recorder.startRecording}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Film className="w-4 h-4" />
                      <span>Grabar Vídeo</span>
                    </button>
                  ) : (
                    <button
                      onClick={recorder.stopRecording}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 shadow-md flex items-center gap-2 transition-all cursor-pointer border border-zinc-600 animate-pulse"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Detener Grabación</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Music className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span className="text-[var(--text-secondary)]">
                    {recorder.isLoadingAudio && 'Cargando pista de audio...'}
                    {!recorder.isLoadingAudio && recorder.audioError && recorder.audioError}
                    {!recorder.isLoadingAudio && !recorder.audioError && recorder.audioSourceType === 'drive' && 'Maqueta privada sincronizada desde Google Drive'}
                    {!recorder.isLoadingAudio && !recorder.audioError && recorder.audioSourceType === 'custom' && `Pista de audio personalizada: ${recorder.customAudioFile?.name}`}
                    {!recorder.isLoadingAudio && !recorder.audioError && recorder.audioSourceType === 'url' && 'Pista de audio vinculada a la canción'}
                    {!recorder.isLoadingAudio && !recorder.audioError && recorder.audioSourceType === 'synthetic' && 'Generador acústico procedimental (no hay archivo de audio adjunto)'}
                  </span>
                </div>

                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-subtle)] rounded-lg border border-[var(--accent-border)] cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir otra pista de audio</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={recorder.handleCustomAudioUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <VisualizerSettingsTab
              resolution={resolution}
              onChangeResolution={setResolution}
              effect={effect}
              onChangeEffect={setEffect}
              theme={theme}
              onChangeTheme={setTheme}
              onCustomImageUpload={handleCustomImageUpload}
              fontStyle={fontStyle}
              onChangeFontStyle={setFontStyle}
              watermarkText={watermarkText}
              onChangeWatermarkText={setWatermarkText}
              showChords={showChords}
              onChangeShowChords={setShowChords}
              showMetadataBadge={showMetadataBadge}
              onChangeShowMetadataBadge={setShowMetadataBadge}
              showProgressBar={showProgressBar}
              onChangeShowProgressBar={setShowProgressBar}
            />
          )}

          {activeTab === 'export' && (
            <VisualizerExportTab
              resolution={resolution}
              recordedBlob={recorder.recordedBlob}
              recordedVideoUrl={recorder.recordedVideoUrl}
              isUploadingToDrive={recorder.isUploadingToDrive}
              driveUploadSuccess={recorder.driveUploadSuccess}
              driveUploadError={recorder.driveUploadError}
              onDownloadVideo={recorder.handleDownloadVideo}
              onSaveToDrive={recorder.handleSaveToDrive}
              onGoToPreview={() => setActiveTab('preview')}
            />
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Youtube className="w-4 h-4 text-red-500 shrink-0" />
            <span>Formato 16:9 optimizado para subida directa a YouTube Studio.</span>
          </div>

          <div className="flex items-center gap-2.5">
            {isModal && onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('preview');
                if (!recorder.isRecording) {
                  void recorder.startRecording();
                } else {
                  recorder.stopRecording();
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${
                recorder.isRecording
                  ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>{recorder.isRecording ? 'Detener Grabación' : `Grabar Vídeo YouTube (${resolution})`}</span>
            </button>
          </div>
        </div>
    </div>
  );
};

export const SongVideoVisualizerModal: React.FC<SongVideoVisualizerModalProps> = ({
  song,
  onClose,
  allSongs = [],
  onSelectOtherSong
}) => {
  const { isAuthor } = useAuth();

  return (
    <AccessibleModal
      isOpen={isAuthor}
      onClose={onClose}
      titleId="video-visualizer-title"
      zIndexClass="z-50"
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
      panelClassName="relative w-full max-w-6xl flex items-center justify-center focus:outline-none"
    >
      <SongVideoVisualizerWorkspace
        song={song}
        onClose={onClose}
        allSongs={allSongs}
        onSelectOtherSong={onSelectOtherSong}
        mode="modal"
      />
    </AccessibleModal>
  );
};
