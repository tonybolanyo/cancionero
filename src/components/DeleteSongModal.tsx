import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, GitCommit, UploadCloud, Music, FileText } from 'lucide-react';
import { Song } from '../types/song';
import { StorageService } from '../services/storageService';
import { GitHubSyncService, PushResult } from '../services/githubSyncService';
import { useAuth } from '../context/AuthContext';

interface DeleteSongModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteSuccess: (deletedSong: Song, updatedSongs: Song[], pushResult?: PushResult) => void;
}

export const DeleteSongModal: React.FC<DeleteSongModalProps> = ({
  song,
  isOpen,
  onClose,
  onDeleteSuccess,
}) => {
  const { token } = useAuth();
  const [autoCommit, setAutoCommit] = useState(true);
  const [autoPush, setAutoPush] = useState<boolean>(() =>
    GitHubSyncService.isAutoCommitEnabled()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !song) return null;

  const defaultCommitMessage = `delete: eliminar canción "${song.title}" (songs/${song.id}.md)`;

  const handleDelete = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Delete from local storage and update git commits
      const result = StorageService.deleteSong(song.id, autoCommit);

      if (!result.success) {
        setErrorMessage('No se pudo eliminar la canción del almacenamiento local.');
        setIsProcessing(false);
        return;
      }

      let pushResult: PushResult | undefined;

      // 2. If remote sync requested and token is present, delete from GitHub
      if (autoCommit && autoPush && token?.trim()) {
        const commitMsg = defaultCommitMessage;

        // Delete remote markdown file
        await GitHubSyncService.deleteRemoteFile(
          `songs/${song.id}.md`,
          commitMsg,
          token
        );

        // Update remote catalog.json
        pushResult = await GitHubSyncService.pushFullCatalog(
          result.songs,
          `chore(catalog): actualizar catálogo tras eliminar "${song.title}"`,
          token
        );
      }

      // Revoke audio object url if local blob was attached
      if (song.audioUrl && song.audioUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(song.audioUrl);
        } catch {}
      }

      onDeleteSuccess(song, result.songs, pushResult);
      onClose();
    } catch (err: any) {
      setErrorMessage('Error inesperado al eliminar la canción: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--bg-modal)] border border-red-500/30 shadow-2xl overflow-hidden text-[var(--text-primary)] transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-red-500/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Eliminar Canción Completa
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Esta acción no se puede deshacer
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            ¿Estás seguro de que deseas eliminar permanentemente la obra{' '}
            <strong className="text-[var(--text-primary)] font-semibold">"{song.title}"</strong>?
          </p>

          {/* Song Summary Card */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">{song.title}</span>
              <span className="font-mono text-[11px] text-[var(--accent-primary)] font-semibold">
                Tono {song.key} · {song.year}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-muted)] font-mono text-[11px]">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>songs/{song.id}.md</span>
            </div>
            {song.audioUrl && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] pt-1 border-t border-[var(--border-subtle)]/50">
                <Music className="w-3.5 h-3.5 shrink-0" />
                <span>Incluye pista de audio local que también será liberada</span>
              </div>
            )}
          </div>

          {/* Git & GitHub Options */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer font-medium text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={autoCommit}
                onChange={(e) => setAutoCommit(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 border-[var(--border-subtle)] focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Registrar commit Git de eliminación en el historial</span>
              </span>
            </label>

            {autoCommit && (
              <label className="flex items-center gap-2.5 pl-6 cursor-pointer font-medium text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={autoPush}
                  onChange={(e) => setAutoPush(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 border-[var(--border-subtle)] focus:ring-0"
                />
                <span className="flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-blue-500" />
                  <span>Eliminar también del repositorio remoto en GitHub</span>
                </span>
              </label>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Definitivamente</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
