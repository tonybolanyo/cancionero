import React, { useState, useEffect } from 'react';
import { X, Music, Download, AlertCircle, Check, Loader } from 'lucide-react';
import { Song, SongStatus } from '../types/song';
import { StorageService } from '../services/storageService';
import { GitHubSyncService } from '../services/githubSyncService';
import { useAuth } from '../context/AuthContext';

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

export const SpotifyAlbumImportModal: React.FC<SpotifyAlbumImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingSongs
}) => {
  const { token, isAuthor } = useAuth();
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

      // Optionally push to GitHub if authenticated
      if (token && isAuthor) {
        try {
          for (const song of newSongs) {
            await GitHubSyncService.pushSongFile(
              song,
              `feat(songs): add "${song.title}" from album "${albumData.title}"`,
              token
            );
          }
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
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar las canciones');
      setImportStatus('idle');
    }
  };

  if (!isOpen) return null;

  if (!isAuthor) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md">
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-4">
            <AlertCircle size={24} />
            <h2 className="text-lg font-semibold">Acceso restringido</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Solo los autores pueden importar canciones de discos de Spotify.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Music className="text-blue-500" size={24} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Importar Disco de Spotify
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            aria-label="Cerrar"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {importStatus === 'done' && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Check className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-green-800 dark:text-green-300">
                  ¡Canciones importadas exitosamente!
                </p>
              </div>
            </div>
          )}

          {!albumData ? (
            <>
              {/* Spotify URL Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL de Spotify del Disco
                </label>
                <input
                  type="url"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/album/..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Puedes extraer la URL directamente del navegador de Spotify
                </p>
              </div>

              {spotifyUrl && !manualMode && (
                <button
                  onClick={handleExtractSpotifyData}
                  disabled={isLoading}
                  className="w-full mb-6 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition flex items-center justify-center gap-2"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre del Disco
                  </label>
                  <input
                    type="text"
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                    placeholder="ej: Cartas sin sello"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Artista
                    </label>
                    <input
                      type="text"
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="ej: Tony Bolaño"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Año
                    </label>
                    <input
                      type="number"
                      value={albumYear}
                      onChange={(e) => setAlbumYear(parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Canciones (una por línea)
                  </label>
                  <textarea
                    value={songsList}
                    onChange={(e) => setSongsList(e.target.value)}
                    placeholder="Me quedo&#10;Cinco años y un faro&#10;Boleros y verdades&#10;..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={8}
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Puedes pegar la lista de Spotify o escribir los nombres manualmente
                  </p>
                </div>

                <button
                  onClick={handleParseSongs}
                  disabled={!albumTitle || !artistName || !songsList}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Music size={18} />
                  Revisar Canciones
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Album Info */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {albumData.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {albumData.artist} ({albumData.year})
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  {albumData.songs.length} canciones disponibles
                </p>
              </div>

              {/* Songs List */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                          ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 opacity-60'
                          : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-blue-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={`song-${index}`}
                        checked={selectedSongs.has(index.toString())}
                        onChange={() => handleToggleSong(index.toString())}
                        disabled={alreadyExists || importStatus === 'processing'}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <label
                        htmlFor={`song-${index}`}
                        className="flex-1 cursor-pointer text-gray-900 dark:text-white select-none disabled:cursor-not-allowed"
                      >
                        <span className="text-sm font-medium">{song.title}</span>
                        {alreadyExists && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
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
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={() => {
              if (albumData) {
                setAlbumData(null);
                setSelectedSongs(new Set());
              } else {
                onClose();
              }
            }}
            disabled={importStatus === 'processing'}
            className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-900 dark:text-white rounded-lg transition font-medium"
          >
            {albumData ? 'Atrás' : 'Cancelar'}
          </button>

          {albumData && (
            <button
              onClick={handleImportSongs}
              disabled={selectedSongs.size === 0 || importStatus === 'processing'}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition font-medium flex items-center justify-center gap-2"
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
                  {selectedSongs.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
