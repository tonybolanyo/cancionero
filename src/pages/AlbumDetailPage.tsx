import React, { useState } from 'react';
import {
  Disc,
  ArrowLeft,
  Calendar,
  User,
  Clock,
  Music,
  ExternalLink,
  Edit3,
  Trash2,
  Plus,
  Play,
  Pause,
  ChevronRight,
  FileText,
  Share2,
  Check
} from 'lucide-react';
import { Album } from '../types/album';
import { Song } from '../types/song';
import { useAppNavigation } from '../context/NavigationContext';
import { useAuth } from '../context/AuthContext';
import { isValidPlayableAudioUrl } from '../utils/markdownParser';
import { isSafeExternalUrl } from '../utils/authConfig';

interface AlbumDetailPageProps {
  album: Album;
  songs: Song[];
  onEditAlbum?: (album: Album) => void;
  onDeleteAlbum?: (album: Album) => void;
  onSelectSong?: (song: Song) => void;
}

export const AlbumDetailPage: React.FC<AlbumDetailPageProps> = ({
  album,
  songs,
  onEditAlbum,
  onDeleteAlbum,
  onSelectSong
}) => {
  const { navigate, goBack } = useAppNavigation();
  const { isAuthor } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Map songId to catalog Song
  const songMap = new Map<string, Song>();
  songs.forEach(s => songMap.set(s.id, s));

  // Calculate total duration if tracks have durations
  const totalDurationText = React.useMemo(() => {
    let totalSeconds = 0;
    let validCount = 0;
    album.tracks?.forEach(t => {
      const durationStr = t.duration || (t.songId ? songMap.get(t.songId)?.duration : undefined);
      if (durationStr) {
        const parts = durationStr.split(':').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          totalSeconds += parts[0] * 60 + parts[1];
          validCount++;
        }
      }
    });
    if (totalSeconds === 0) return null;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins} min ${secs > 0 ? `${secs} s` : ''}`;
  }, [album.tracks, songMap]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handlePlayAudio = (trackId: string, audioUrl?: string) => {
    if (!isValidPlayableAudioUrl(audioUrl)) return;

    if (playingTrackId === trackId && audioElement) {
      audioElement.pause();
      setPlayingTrackId(null);
      setAudioElement(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    try {
      const audio = new Audio(audioUrl);
      audio.onerror = () => {
        console.warn('Audio preview playback error for track:', trackId);
        setPlayingTrackId(null);
        setAudioElement(null);
      };
      audio.onended = () => {
        setPlayingTrackId(null);
        setAudioElement(null);
      };
      audio.play().then(() => {
        setPlayingTrackId(trackId);
        setAudioElement(audio);
      }).catch(err => {
        console.warn('Error playing audio preview', err);
        setPlayingTrackId(null);
        setAudioElement(null);
      });
    } catch (err) {
      console.warn('Could not initialize audio player', err);
    }
  };

  return (
    <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 animate-fade-in">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => goBack({ name: 'albums' })}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver al catálogo</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-medium)] transition-colors cursor-pointer"
            title="Copiar enlace directo al álbum"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Enlace copiado' : 'Compartir'}</span>
          </button>

          {isAuthor && onEditAlbum && (
            <button
              onClick={() => onEditAlbum(album)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Álbum</span>
            </button>
          )}

          {isAuthor && onDeleteAlbum && (
            <button
              onClick={() => onDeleteAlbum(album)}
              className="p-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              title="Eliminar álbum"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Album Header Block */}
      <header className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[320px_1fr] gap-6 sm:gap-10 items-start mb-12">
        {/* Cover / Vinyl graphic */}
        <div className="relative aspect-square w-full max-w-[320px] mx-auto md:mx-0 rounded-2xl overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 border border-[var(--border-subtle)] shadow-xl flex items-center justify-center p-4">
          {album.coverImage ? (
            <img
              src={album.coverImage}
              alt={`Portada del álbum ${album.title}`}
              className="w-full h-full object-cover rounded-xl"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="relative w-full h-full rounded-full bg-stone-900 border-4 border-stone-800 flex items-center justify-center shadow-2xl">
              <div className="absolute inset-4 rounded-full border border-stone-700/30" />
              <div className="absolute inset-8 rounded-full border border-stone-700/30" />
              <div className="absolute inset-12 rounded-full border border-stone-700/40" />
              <div className="absolute inset-16 rounded-full border border-stone-700/40" />
              <div className="w-20 h-20 rounded-full bg-[var(--accent-primary)] text-[var(--accent-text)] flex flex-col items-center justify-center shadow-lg p-2 text-center">
                <Disc className="w-7 h-7 mb-0.5 animate-spin-slow opacity-90" />
                <span className="text-[9px] font-mono tracking-tighter truncate max-w-[65px]">{album.title}</span>
              </div>
            </div>
          )}
        </div>

        {/* Album Metadata & Content */}
        <div className="flex flex-col justify-center">
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--accent-primary)] font-semibold mb-2">
            Álbum de Estudio
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] tracking-tight mb-3">
            {album.title}
          </h1>

          {/* Unboxed Metadata (Zero-Pill discipline) */}
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-[var(--text-muted)] mb-5">
            {album.artist && (
              <>
                <span className="font-medium text-[var(--text-primary)]">{album.artist}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {album.year && (
              <>
                <span className="font-mono tabular-nums">{album.year}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="font-mono tabular-nums">{album.tracks?.length || 0} canciones</span>
            {totalDurationText && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{totalDurationText}</span>
              </>
            )}
          </div>

          {/* Streaming Platforms Links */}
          <div className="flex flex-wrap items-center gap-2.5 mb-6">
            {isSafeExternalUrl(album.spotifyUrl) && (
              <a
                href={album.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30 text-xs font-medium transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                <span>Spotify</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}

            {isSafeExternalUrl(album.appleMusicUrl) && (
              <a
                href={album.appleMusicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FA243C]/10 hover:bg-[#FA243C]/20 text-[#FA243C] border border-[#FA243C]/30 text-xs font-medium transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.62 1.35-.57.65-1.06 1.71-.93 2.73 1 .08 2.02-.48 2.63-1.23z" />
                </svg>
                <span>Apple Music</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}

            {isSafeExternalUrl(album.youtubeUrl) && (
              <a
                href={album.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FF0000]/10 hover:bg-[#FF0000]/20 text-[#FF0000] border border-[#FF0000]/30 text-xs font-medium transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span>YouTube</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}

            {isSafeExternalUrl(album.soundcloudUrl) && (
              <a
                href={album.soundcloudUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FF5500]/10 hover:bg-[#FF5500]/20 text-[#FF5500] border border-[#FF5500]/30 text-xs font-medium transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M11.56 8.87V17h9.8c1.46 0 2.64-1.18 2.64-2.63 0-1.42-1.12-2.58-2.53-2.63-.3-.88-1.14-1.51-2.13-1.51-.31 0-.6.07-.86.19C17.9 8.21 15.89 6.5 13.5 6.5c-.7 0-1.37.15-1.94.41v1.96zM1.44 13.88C1.2 13.88 1 14.08 1 14.32v1.86c0 .24.2.44.44.44s.44-.2.44-.44v-1.86c0-.24-.2-.44-.44-.44zm1.75-1.22c-.24 0-.44.2-.44.44v3.08c0 .24.2.44.44.44s.44-.2.44-.44V13.1c0-.24-.2-.44-.44-.44zm1.75-1.32c-.24 0-.44.2-.44.44v4.4c0 .24.2.44.44.44s.44-.2.44-.44v-4.4c0-.24-.2-.44-.44-.44zm1.75.14c-.24 0-.44.2-.44.44v4.26c0 .24.2.44.44.44s.44-.2.44-.44v-4.26c0-.24-.2-.44-.44-.44zm1.75-.84c-.24 0-.44.2-.44.44v5.1c0 .24.2.44.44.44s.44-.2.44-.44v-5.1c0-.24-.2-.44-.44-.44zm1.75-1.05c-.24 0-.44.2-.44.44v6.15c0 .24.2.44.44.44s.44-.2.44-.44V10.03c0-.24-.2-.44-.44-.44z" />
                </svg>
                <span>SoundCloud</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
          </div>

          {/* Publication Notes / Acerca de */}
          {album.notes && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4.5 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed shadow-sm">
              <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Notas de publicación</span>
              </div>
              <p className="whitespace-pre-line">{album.notes}</p>
            </div>
          )}
        </div>
      </header>

      {/* Tracklist Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Listado de Canciones
            </h2>
            <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
              ({album.tracks?.length || 0})
            </span>
          </div>

          {isAuthor && onEditAlbum && (
            <button
              onClick={() => onEditAlbum(album)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gestionar pistas del álbum</span>
            </button>
          )}
        </div>

        {album.tracks && album.tracks.length > 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-sm">
            <div className="divide-y divide-[var(--border-subtle)]">
              {album.tracks.map((track, idx) => {
                const song = track.songId ? songMap.get(track.songId) : undefined;
                const orderFormatted = String(track.order || idx + 1).padStart(2, '0');
                const duration = track.duration || song?.duration;
                const isPlaying = playingTrackId === (track.id || track.songId || `t-${idx}`);

                return (
                  <div
                    key={track.id || `${track.title}-${idx}`}
                    className="p-3.5 sm:p-4 hover:bg-[var(--bg-surface-elevated)] transition-colors flex items-center justify-between gap-3 group"
                  >
                    {/* Track Number & Title */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-6 font-mono text-xs tabular-nums text-[var(--text-muted)] text-right shrink-0">
                        {orderFormatted}
                      </span>

                      {/* Play preview button if song has audio */}
                      {isValidPlayableAudioUrl(song?.audioUrl) && (
                        <button
                          onClick={() => handlePlayAudio(track.id || track.songId || `t-${idx}`, song?.audioUrl)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            isPlaying
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-text)]'
                              : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-text)]'
                          }`}
                          title={isPlaying ? 'Pausar audio' : 'Reproducir audio de muestra'}
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                        </button>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                            {track.title}
                          </span>
                          {song?.key && (
                            <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                              [{song.key}]
                            </span>
                          )}
                        </div>

                        {/* Subtitle / info */}
                        {song?.tuning && (
                          <div className="text-[11px] text-[var(--text-muted)] truncate hidden sm:block">
                            {song.tuning}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side: Duration + Enlace a la ficha de la canción */}
                    <div className="flex items-center gap-4 shrink-0">
                      {duration && (
                        <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                          {duration}
                        </span>
                      )}

                      {/* Enlace directo a la ficha de la canción */}
                      {song ? (
                        <button
                          onClick={() => {
                            if (onSelectSong) {
                              onSelectSong(song);
                            } else {
                              navigate({ name: 'song-detail', songId: song.id });
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-text)] hover:bg-[var(--accent-primary)] border border-[var(--accent-border)] hover:border-transparent rounded-lg transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          title={`Ver letra, acordes y ficha completa de ${song.title}`}
                        >
                          <span>Ver ficha</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        isAuthor && (
                          <button
                            onClick={() => navigate({ name: 'song-new', initialAlbumId: album.id })}
                            className="px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface-subtle)] rounded transition-colors cursor-pointer"
                            title="Crear ficha en el catálogo"
                          >
                            + Ficha
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <Music className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)] mb-3">Este álbum no tiene canciones añadidas todavía.</p>
            {isAuthor && onEditAlbum && (
              <button
                onClick={() => onEditAlbum(album)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                Añadir canciones al álbum
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
