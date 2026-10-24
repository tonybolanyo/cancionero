import React, { useState, useEffect } from 'react';
import { X, FileText, Check, AlertCircle, ArrowRight, UploadCloud, GitCommit } from 'lucide-react';
import { Song } from '../types/song';
import { StorageService } from '../services/storageService';
import { GitHubSyncService } from '../services/githubSyncService';
import { useAuth } from '../context/AuthContext';

interface RenameFileModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onRenameSuccess: (renamedSong: Song, updatedSongs: Song[]) => void;
}

export const RenameFileModal: React.FC<RenameFileModalProps> = ({
  song,
  isOpen,
  onClose,
  onRenameSuccess,
}) => {
  const { token } = useAuth();
  const [newSlug, setNewSlug] = useState('');
  const [autoCommit, setAutoCommit] = useState(true);
  const [autoPush, setAutoPush] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (song) {
      setNewSlug(song.id);
      setErrorMessage(null);
    }
  }, [song, isOpen]);

  if (!isOpen || !song) return null;

  const sanitizeSlug = (input: string) => {
    return input
      .toLowerCase()
      .replace(/\.md$/i, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleSlugFromTitle = () => {
    if (song?.title) {
      const derived = song.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setNewSlug(derived);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeSlug(newSlug);

    if (!clean) {
      setErrorMessage('Introduce un nombre de archivo válido.');
      return;
    }

    if (clean === song.id) {
      onClose();
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = StorageService.renameSongFile(song.id, clean, autoCommit);

      if (!result.success || !result.renamedSong) {
        setErrorMessage(result.error || 'Error al renombrar el archivo.');
        setIsProcessing(false);
        return;
      }

      // If user chose to push to remote GitHub repository
      if (autoCommit && autoPush) {
        const commitMsg = `refactor(files): renombrar 'songs/${song.id}.md' a 'songs/${clean}.md'`;
        
        // 1. Push the new file to GitHub
        await GitHubSyncService.pushSongFile(
          result.renamedSong,
          commitMsg,
          token
        );

        // 2. Delete the old file path on GitHub if token is available
        await GitHubSyncService.deleteRemoteFile(
          `songs/${song.id}.md`,
          `chore(files): eliminar ruta anterior tras renombrar a 'songs/${clean}.md'`,
          token
        );
      }

      onRenameSuccess(result.renamedSong, result.songs);
      onClose();
    } catch (err: any) {
      setErrorMessage('Ocurrió un error inesperado: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const cleanPreview = sanitizeSlug(newSlug) || 'nuevo-nombre';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)] transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
                Renombrar archivo Markdown
              </h3>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-xs">
                {song.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 bg-[var(--bg-surface)]">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-500 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Current vs New comparison */}
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2 text-xs font-mono">
            <div className="text-[var(--text-muted)] text-[11px] font-sans">Ruta de archivo actual:</div>
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span>songs/</span>
              <span className="font-bold text-[var(--text-primary)]">{song.id}.md</span>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[var(--accent-primary)]">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Nueva ruta destino:</span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span>songs/</span>
              <span className="font-bold text-[var(--accent-primary)]">{cleanPreview}.md</span>
            </div>
          </div>

          {/* Input field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Nuevo nombre del archivo (sin extensión .md):
              </label>
              <button
                type="button"
                onClick={handleSlugFromTitle}
                className="text-[11px] text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                Generar desde el título
              </button>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3 font-mono text-xs text-[var(--text-muted)]">
                songs/
              </span>
              <input
                type="text"
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="ejemplo-mi-cancion"
                className="w-full pl-16 pr-12 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
              />
              <span className="absolute right-3 font-mono text-xs text-[var(--text-muted)]">
                .md
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Solo letras minúsculas, números y guiones. Se mantendrá el contenido y los acordes intactos.
            </p>
          </div>

          {/* Git operations checkboxes */}
          <div className="p-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={autoCommit}
                onChange={(e) => setAutoCommit(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--accent-primary)] border-[var(--border-subtle)] focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Registrar commit Git automático tras renombrar</span>
              </span>
            </label>

            {autoCommit && (
              <label className="flex items-center gap-2 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] pl-6">
                <input
                  type="checkbox"
                  checked={autoPush}
                  onChange={(e) => setAutoPush(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--accent-primary)] border-[var(--border-subtle)] focus:ring-0"
                />
                <span className="flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Hacer Push a GitHub tras el commit (git push)</span>
                </span>
              </label>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isProcessing || !newSlug.trim()}
              className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar Renombrado</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
