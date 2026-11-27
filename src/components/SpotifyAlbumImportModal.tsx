import React, { useState, useEffect } from 'react';
import { X, Music, Download, AlertCircle, Check, Loader } from 'lucide-react';
import { Song, SongStatus } from '../types/song';
import { StorageService } from '../services/storageService';
import { GitHubSyncService } from '../services/githubSyncService';
import { useAuth } from '../context/AuthContext';
import { AccessibleModal } from './modals/AccessibleModal';

export interface SpotifyAlbumImportWorkspaceProps {
  onImport: (songs: Song[]) => void;
  existingSongs: Song[];
  onClose?: () => void;
  onComplete?: () => void;
  mode?: 'modal' | 'page';
}

interface SpotifyAlbumImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (songs: Song[]) => void;
  existingSongs: Song[];
}

interface AlbumData {
  id: string;
  title: string;
  artist: string;
  year: number;
  spotifyUrl: string;
  songs: AlbumSong[];
}

interface AlbumSong {
  title: string;
  artist?: string;
  duration?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const SpotifyAlbumImportWorkspace: React.FC<SpotifyAlbumImportWorkspaceProps> = ({
  onImport,
  existingSongs,
  onClose,
  onComplete,
  mode = 'page'
}) => {
  const { token, isAuthenticated, isAuthor } = useAuth();
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumYear, setAlbumYear] = useState(new Date().getFullYear());
  const [songsList, setSongsList] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [albumData, setAlbumData] = useState<AlbumData | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'done'>('idle');

  const existingSongIds = new Set(existingSongs.map(s => slugify(s.title)));

  const handleExtractSpotifyData = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Extract album ID from Spotify URL
      const urlMatch = spotifyUrl.match(/album\/([a-zA-Z0-9]+)/);
      if (!urlMatch) {
        throw new Error('URL de Spotify inválida. Por favor, usa un enlace de disco válido.');
      }

      const albumId = urlMatch[1];

      // Call the Spotify API wrapper endpoint (you would need to implement this in your backend)
      // For now, we'll provide a manual entry mode
      setManualMode(true);
      setError('Por favor, completa los detalles del disco manualmente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la URL de Spotify');
    } finally {
      setIsLoading(false);
    }
  };

  const handleParseSongs = () => {
    setError(null);
    const lines = songsList
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      setError('Por favor, ingresa al menos una canción.');
      return;
    }

    const songs: AlbumSong[] = lines.map((title, index) => ({
      title,
      artist: artistName || undefined
    }));

    const newAlbum: AlbumData = {
      id: slugify(albumTitle),
      title: albumTitle,
      artist: artistName,
      year: albumYear,
      spotifyUrl,
      songs
    };

    setAlbumData(newAlbum);
    setSelectedSongs(new Set(songs.map((_, i) => i.toString())));
  };

  const handleToggleSong = (index: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSongs(newSelected);
  };

  const handleImportSongs = async () => {
    if (!albumData) return;

    setImportStatus('processing');
    setError(null);

    try {
      const newSongs: Song[] = [];
      const now = new Date().toISOString();

      for (const index of selectedSongs) {
        const idx = parseInt(index);
        const albumSong = albumData.songs[idx];
        const songSlug = slugify(albumSong.title);

        // Check if song already exists
        if (existingSongIds.has(songSlug)) {
          console.log(`Skipping existing song: ${albumSong.title}`);
          continue;
        }

        const newSong: Song = {
          id: songSlug,
          title: albumSong.title,
          status: 'draft' as SongStatus,
          year: albumData.year,
          genre: 'Canción de Autor',
          key: '',
          lyrics: `## Estrofa 1\n\n## Estribillo\n`,
          spotifyUrl: albumData.spotifyUrl,
          notes: `Del disco '${albumData.title}' de ${albumData.artist}`,
          tags: [slugify(albumData.title), 'acústico'],
          createdAt: now,
          updatedAt: now
        };

        newSongs.push(newSong);
      }

      if (newSongs.length === 0) {
        setError('No hay nuevas canciones para importar. Todas ya existen en la base de datos.');
        setImportStatus('idle');
        return;
      }

      // Save songs to localStorage
      for (const song of newSongs) {
        StorageService.upsertSong(song);
      }

      // Optionally push to GitHub atomically if authenticated
      if ((isAuthenticated || token) && isAuthor) {
        try {
          await GitHubSyncService.pushFullCatalog(
            StorageService.getSongs(),
            `feat(songs): import ${newSongs.length} song(s) from album "${albumData.title}"`,
            token,
            undefined,
            { changedFiles: newSongs.map(s => `songs/${s.id}.md`) }
          );
        } catch (gitErr) {
          console.warn('Could not push to GitHub:', gitErr);
        }
      }

      setImportStatus('done');
      onImport(newSongs);

      // Reset form after successful import
      setTimeout(() => {
        setSpotifyUrl('');
        setManualMode(false);
        setAlbumTitle('');
        setArtistName('');
        setSongsList('');
        setAlbumData(null);
        setSelectedSongs(new Set());
        setImportStatus('idle');
        (onComplete ?? onClose)?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar las canciones');
      setImportStatus('idle');
    }
  };

  const isModal = mode === 'modal';

  return (
    <div
      className={
        isModal
          ? 'bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-2xl shadow-[var(--modal-shadow)] w-full max-w-2xl overflow-hidden text-[var(--text-primary)]'
          : 'w-full max-w-3xl mx-auto rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm overflow-hidden text-[var(--text-primary)]'
      }
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-6 border-b border-[var(--border-subtle)] ${
          isModal ? 'bg-[var(--bg-modal)]' : 'bg-[var(--bg-surface-subtle)]/60'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
            <Music size={18} />
          </div>
          {isModal ? (
            <h2 id="spotify-import-modal-title" className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Importar Disco de Spotify
            </h2>
          ) : (
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Importar Disco de Spotify
            </h1>
          )}
        </div>
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] rounded-lg transition cursor-pointer"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className={isModal ? 'p-6 max-h-[70vh] overflow-y-auto bg-[var(--bg-surface)]' : 'p-6'}>
          {error && (
            <div className="mb-4 p-4 bg-[var(--state-error-bg)] border border-[var(--state-error-border)] text-[var(--state-error-text)] rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {importStatus === 'done' && (
            <div className="mb-4 p-4 bg-[var(--state-success-bg)] border border-[var(--state-success-border)] text-[var(--state-success-text)] rounded-xl">
              <div className="flex items-start gap-3">
                <Check className="shrink-0 mt-0.5" size={20} />
                <p className="text-sm font-medium">
                  ¡Canciones importadas exitosamente!
                </p>
              </div>
            </div>
          )}

          {!albumData ? (
            <>
              {/* Spotify URL Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  URL de Spotify del Disco
                </label>
                <input
                  type="url"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/album/..."
                  className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:border-[var(--input-border-focus)]"
                  disabled={isLoading}
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Puedes extraer la URL directamente del navegador de Spotify
                </p>
              </div>

              {spotifyUrl && !manualMode && (
                <button
                  type="button"
                  onClick={handleExtractSpotifyData}
                  disabled={isLoading}
                  className="w-full mb-6 px-4 py-2.5 bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover-bg)] disabled:bg-[var(--button-primary-disabled-bg)] disabled:text-[var(--button-primary-disabled-text)] text-[var(--button-primary-text)] font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      Procesar URL
                    </>
                  )}
                </button>
              )}

              {/* Manual Entry */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Nombre del Disco
                  </label>
                  <input
                    type="text"
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                    placeholder="ej: Cartas sin sello"
                    className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:border-[var(--input-border-focus)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Artista
                    </label>
                    <input
                      type="text"
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="ej: Tony Bolaño"
                      className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:border-[var(--input-border-focus)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Año
                    </label>
                    <input
                      type="number"
                      value={albumYear}
                      onChange={(e) => setAlbumYear(parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--input-text)] font-mono focus:outline-none focus:border-[var(--input-border-focus)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Canciones (una por línea)
                  </label>
                  <textarea
                    value={songsList}
                    onChange={(e) => setSongsList(e.target.value)}
                    placeholder="Me quedo&#10;Cinco años y un faro&#10;Boleros y verdades&#10;..."
                    className="w-full px-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:border-[var(--input-border-focus)] font-mono text-sm"
                    rows={8}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Puedes pegar la lista de Spotify o escribir los nombres manualmente
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleParseSongs}
                  disabled={!albumTitle || !artistName || !songsList}
                  className="w-full px-4 py-2.5 bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover-bg)] disabled:bg-[var(--button-primary-disabled-bg)] disabled:text-[var(--button-primary-disabled-text)] text-[var(--button-primary-text)] font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Music size={18} />
                  Revisar Canciones
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Album Info */}
              <div className="mb-6 p-4 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-xl">
                <h3 className="font-serif font-semibold text-[var(--text-primary)] mb-1">
                  {albumData.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  {albumData.artist} ({albumData.year})
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">
                  {albumData.songs.length} canciones disponibles
                </p>
              </div>

              {/* Songs List */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                  Selecciona las canciones a importar:
                </h4>
                {albumData.songs.map((song, index) => {
                  const songSlug = slugify(song.title);
                  const alreadyExists = existingSongIds.has(songSlug);

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                        alreadyExists
                          ? 'bg-[var(--bg-surface-subtle)]/50 border-[var(--border-subtle)] opacity-60'
                          : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={`song-${index}`}
                        checked={selectedSongs.has(index.toString())}
                        onChange={() => handleToggleSong(index.toString())}
                        disabled={alreadyExists || importStatus === 'processing'}
                        className="w-4 h-4 accent-[var(--accent-primary)] rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <label
                        htmlFor={`song-${index}`}
                        className="flex-1 cursor-pointer text-[var(--text-primary)] select-none"
                      >
                        <span className="text-sm font-medium">{song.title}</span>
                        {alreadyExists && (
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            (ya existe)
                          </span>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

      {/* Footer */}
      {(albumData || (isModal && onClose)) && (
        <div
          className={`flex gap-3 p-6 border-t border-[var(--border-subtle)] ${
            isModal ? 'bg-[var(--bg-modal)]' : 'bg-[var(--bg-surface-subtle)]/60'
          }`}
        >
          {(albumData || onClose) && (
            <button
              type="button"
              onClick={() => {
                if (albumData) {
                  setAlbumData(null);
                  setSelectedSongs(new Set());
                } else {
                  onClose?.();
                }
              }}
              disabled={importStatus === 'processing'}
              className="flex-1 px-4 py-2 bg-[var(--button-secondary-bg)] hover:bg-[var(--button-secondary-hover-bg)] border border-[var(--button-secondary-border)] disabled:opacity-50 text-[var(--button-secondary-text)] rounded-lg transition font-medium cursor-pointer"
            >
              {albumData ? 'Atrás' : 'Cancelar'}
            </button>
          )}

          {albumData && (
            <button
              type="button"
              onClick={handleImportSongs}
              disabled={selectedSongs.size === 0 || importStatus === 'processing'}
              className="flex-1 px-4 py-2 bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover-bg)] disabled:bg-[var(--button-primary-disabled-bg)] disabled:text-[var(--button-primary-disabled-text)] text-[var(--button-primary-text)] rounded-lg transition font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {importStatus === 'processing' ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Importar {selectedSongs.size} canción
                  {selectedSongs.size !== 1 ? 'es' : ''}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const SpotifyAlbumImportModal: React.FC<SpotifyAlbumImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingSongs
}) => {
  const { isAuthor } = useAuth();

  if (!isOpen) return null;

  if (!isAuthor) {
    return (
      <AccessibleModal
        isOpen={isOpen}
        onClose={onClose}
        titleId="spotify-import-restricted-title"
        backdropClassName="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        panelClassName="bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-[var(--modal-shadow)] text-[var(--text-primary)]"
      >
        <div className="flex items-center gap-3 text-[var(--accent-primary)] mb-4">
          <AlertCircle size={24} />
          <h2 id="spotify-import-restricted-title" className="font-serif text-lg font-bold text-[var(--text-primary)]">
            Acceso restringido
          </h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Solo los autores pueden importar canciones de discos de Spotify.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2 bg-[var(--button-secondary-bg)] hover:bg-[var(--button-secondary-hover-bg)] border border-[var(--button-secondary-border)] text-[var(--button-secondary-text)] rounded-lg transition font-medium cursor-pointer"
        >
          Cerrar
        </button>
      </AccessibleModal>
    );
  }

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      titleId="spotify-import-modal-title"
      backdropClassName="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 overflow-y-auto p-3 sm:p-6"
      panelClassName="relative w-full max-w-2xl flex justify-center"
    >
      <SpotifyAlbumImportWorkspace
        onImport={onImport}
        existingSongs={existingSongs}
        onClose={onClose}
        mode="modal"
      />
    </AccessibleModal>
  );
};
