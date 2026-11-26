import React from 'react';
import { Cloud, Lock, Pause, Play, Repeat, Sparkles } from 'lucide-react';
import { Song } from '../../types/song';
import { AudioEqMode } from '../../lib/audio/pitchShiftPlayer';

export interface SongDetailAudioPlayerProps {
  song: Song;
  isAuthor: boolean;
  resolvedAudioUrl: string;
  useDspPlayer: boolean;
  semitones: number;
  syncAudioPitch: boolean;
  onToggleSyncAudioPitch: () => void;
  onEditSong: (song: Song) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlayingAudio: boolean;
  onTogglePlayAudio: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onAudioEnded: () => void;
  onAudioError: (msg: string) => void;
  currentTime: number;
  duration: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  playbackRate: number;
  onSpeedChange: (rate: number) => void;
  loopStart: number | null;
  loopEnd: number | null;
  onSetLoopA: () => void;
  onSetLoopB: () => void;
  onClearLoop: () => void;
  eqMode: AudioEqMode;
  onEqModeChange: (mode: AudioEqMode) => void;
  isLoadingDriveAudio: boolean;
  driveAudioError: string | null;
  driveTokenStatus: string;
  onLoginWithGoogle: () => Promise<unknown> | void;
}

const formatAudioTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const SongDetailAudioPlayer: React.FC<SongDetailAudioPlayerProps> = ({
  song,
  isAuthor,
  resolvedAudioUrl,
  useDspPlayer,
  semitones,
  syncAudioPitch,
  onToggleSyncAudioPitch,
  onEditSong,
  audioRef,
  isPlayingAudio,
  onTogglePlayAudio,
  onTimeUpdate,
  onLoadedMetadata,
  onAudioEnded,
  onAudioError,
  currentTime,
  duration,
  onSeek,
  playbackRate,
  onSpeedChange,
  loopStart,
  loopEnd,
  onSetLoopA,
  onSetLoopB,
  onClearLoop,
  eqMode,
  onEqModeChange,
  isLoadingDriveAudio,
  driveAudioError,
  driveTokenStatus,
  onLoginWithGoogle
}) => {
  const isProtectedPrivateMaqueta =
    !isAuthor &&
    Boolean(
      song.driveFileId ||
        song.isPrivateDemo ||
        (song.audioUrl && (song.audioUrl.startsWith('gdrive://') || song.audioUrl.startsWith('blob:')))
    );

  return (
    <>
      {isProtectedPrivateMaqueta && (
        <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-[var(--text-primary)] block">
                Maqueta acústica de autor protegida
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                Grabación íntima guardada en Google Drive. Inicia sesión como autor para escucharla.
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-1 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)] self-start sm:self-auto">
            Privada (Solo autor)
          </span>
        </div>
      )}

      {isAuthor && resolvedAudioUrl && (
        <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-2 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 min-w-0">
              <Cloud className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <span className="font-semibold text-[var(--text-primary)] truncate">
                {song.driveFileName || 'Pista de Ensayo'}
              </span>
              {useDspPlayer && (
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  · DSP Web Audio{' '}
                  {syncAudioPitch && semitones !== 0
                    ? `(${semitones > 0 ? `+${semitones}` : semitones} st)`
                    : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => onEditSong(song)}
              className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Reanalizar en Taller</span>
            </button>
          </div>

          <audio
            ref={audioRef}
            src={!useDspPlayer ? resolvedAudioUrl : undefined}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onEnded={onAudioEnded}
            onError={(e) => {
              if (!useDspPlayer) {
                console.warn('Error en la reproducción de audio en SongDetailPage:', e);
                onAudioError('No se pudo reproducir la pista de audio.');
              }
            }}
          />

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={onTogglePlayAudio}
              className="w-10 h-10 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-text)] flex items-center justify-center transition-all shadow-md shrink-0 cursor-pointer"
            >
              {isPlayingAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="flex-1 w-full space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.05"
                value={currentTime}
                onChange={onSeek}
                className="w-full accent-[var(--accent-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                <span>{formatAudioTime(currentTime)}</span>
                {loopStart !== null && (
                  <span className="text-[var(--accent-primary)] font-semibold">
                    Bucle A-B: {formatAudioTime(loopStart)} →{' '}
                    {loopEnd !== null ? formatAudioTime(loopEnd) : '...'}
                  </span>
                )}
                <span>{formatAudioTime(duration)}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)] font-mono">
              <span className="text-[11px] text-[var(--text-muted)] px-1.5">Velocidad:</span>
              {[0.6, 0.75, 0.85, 1.0, 1.15, 1.25].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onSpeedChange(rate)}
                  className={`px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                    playbackRate === rate
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-bold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)] font-mono">
              <Repeat className="w-3 h-3 text-[var(--accent-primary)] ml-1.5" />
              <button
                type="button"
                onClick={onSetLoopA}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                  loopStart !== null
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-bold'
                    : 'text-[var(--text-secondary)]'
                }`}
                title="Marcar punto A del bucle en el tiempo actual"
              >
                {loopStart !== null ? `A ${formatAudioTime(loopStart)}` : 'Marcar A'}
              </button>
              <button
                type="button"
                onClick={onSetLoopB}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                  loopEnd !== null
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-bold'
                    : 'text-[var(--text-secondary)]'
                }`}
                title="Marcar punto B del bucle en el tiempo actual"
              >
                {loopEnd !== null ? `B ${formatAudioTime(loopEnd)}` : 'Marcar B'}
              </button>
              {(loopStart !== null || loopEnd !== null) && (
                <button
                  type="button"
                  onClick={onClearLoop}
                  className="px-1.5 py-0.5 rounded text-[11px] text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                  title="Limpiar bucle A-B"
                >
                  ×
                </button>
              )}
            </div>

            {useDspPlayer && (
              <div className="flex flex-wrap items-center gap-1 bg-[var(--bg-surface-subtle)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
                {(
                  [
                    { id: 'normal', label: 'Normal' },
                    { id: 'vocal_cut', label: 'Atenuar voz' },
                    { id: 'bass_isolate', label: 'Solo bajo' },
                    { id: 'guitar_focus', label: 'Guitarra' }
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onEqModeChange(item.id)}
                    className={`px-2 py-0.5 rounded text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                      eqMode === item.id
                        ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onToggleSyncAudioPitch}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono whitespace-nowrap cursor-pointer border ${
                    syncAudioPitch
                      ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)] font-semibold'
                      : 'border-transparent text-[var(--text-muted)]'
                  }`}
                  title="Sincronizar tono del audio con la transposición de la letra"
                >
                  {syncAudioPitch ? 'Tono ligado' : 'Audio original'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isAuthor && isLoadingDriveAudio && (
        <div className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs flex items-center gap-2.5 animate-pulse text-[var(--text-muted)]">
          <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
          <span>Cargando maqueta segura desde Google Drive...</span>
        </div>
      )}

      {isAuthor && driveAudioError && (
        <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 shrink-0" />
            <span>{driveAudioError}</span>
          </div>
          <button
            type="button"
            onClick={() => void onLoginWithGoogle()}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0"
          >
            {driveTokenStatus === 'expired' ? 'Renovar sesión de Drive' : 'Conectar Google Drive'}
          </button>
        </div>
      )}
    </>
  );
};
