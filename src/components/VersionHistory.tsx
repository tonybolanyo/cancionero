import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  GitCommit as GitCommitIcon,
  RotateCcw,
  Copy,
  Check,
  FileCode,
  FileText,
  Calendar,
  User,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Song } from '../types/song';
import { StorageService, SongVersionRecord } from '../services/storageService';
import { songToMarkdown, markdownToSong } from '../utils/markdownParser';
import { GitHubSyncService, PushResult } from '../services/githubSyncService';
import { useAuth } from '../context/AuthContext';

interface VersionHistoryProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onRestoreSong: (restoredSong: Song, pushResult?: PushResult) => void;
  isAuthor: boolean;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  song,
  isOpen,
  onClose,
  onRestoreSong,
  isAuthor
}) => {
  const { token } = useAuth();
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);
  const [viewTab, setViewTab] = useState<'diff' | 'lyrics' | 'raw'>('diff');
  const [copied, setCopied] = useState<boolean>(false);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  const songId = song?.id || '';
  const songUpdatedAt = song?.updatedAt || '';

  const historyRecords: SongVersionRecord[] = useMemo(() => {
    if (!songId) return [];
    return StorageService.getSongVersionHistory(songId);
  }, [songId, songUpdatedAt]);

  const selectedRecord = historyRecords[selectedRecordIndex] || historyRecords[0];
  const currentMarkdown = useMemo(() => {
    return song ? songToMarkdown(song) : '';
  }, [song]);

  // Compute line-by-line diff
  const diffLines = useMemo(() => {
    if (!selectedRecord) return [];

    const currentLines = currentMarkdown.split('\n');
    const selectedLines = selectedRecord.markdown.split('\n');

    // Simple line comparison
    const lines: Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }> = [];

    // If viewing the current version
    if (selectedRecord.isCurrent) {
      return currentLines.map(line => ({ type: 'unchanged' as const, text: line }));
    }

    // Compare selected historical version against current version
    const maxLen = Math.max(currentLines.length, selectedLines.length);
    for (let i = 0; i < maxLen; i++) {
      const cur = currentLines[i];
      const hist = selectedLines[i];

      if (cur === hist) {
        if (cur !== undefined) {
          lines.push({ type: 'unchanged', text: cur });
        }
      } else {
        if (hist !== undefined) {
          lines.push({ type: 'removed', text: hist });
        }
        if (cur !== undefined) {
          lines.push({ type: 'added', text: cur });
        }
      }
    }

    return lines;
  }, [selectedRecord, currentMarkdown]);

  if (!isOpen || !song) return null;

  // Strict author-only gate
  if (!isAuthor) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="p-6 rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-[var(--accent-primary)] mx-auto" />
          <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
            Acceso Restringido al Autor
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            El historial de versiones y la visualización de commits de control de versiones solo están disponibles en Modo Autor autenticado.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const handleRestore = async () => {
    if (!selectedRecord) return;
    const confirmRestore = confirm(
      `¿Deseas restaurar la canción a la versión del commit [${selectedRecord.commit.hash}] "${selectedRecord.commit.message}"? Se creará un nuevo commit de restauración en Git.`
    );
    if (!confirmRestore) return;

    const restored = StorageService.restoreSongVersion(
      song.id,
      selectedRecord.markdown,
      selectedRecord.commit.hash
    );

    let pushRes: PushResult | undefined;
    if (GitHubSyncService.isAutoCommitEnabled() && token) {
      setRestoreNotice('Haciendo Push de la versión restaurada a GitHub...');
      try {
        pushRes = await GitHubSyncService.pushSongFile(
          restored,
          `revert(song): restaurar "${restored.title}" al commit [${selectedRecord.commit.hash}]`,
          token
        );
      } catch (e) {
        console.warn('Push on restore failed', e);
      }
    }

    onRestoreSong(restored, pushRes);
    setRestoreNotice(`Canción restaurada exitosamente a la versión [${selectedRecord.commit.hash}].`);
    setTimeout(() => {
      setRestoreNotice(null);
      onClose();
    }, 1500);
  };

  const handleCopyMarkdown = () => {
    if (!selectedRecord) return;
    navigator.clipboard.writeText(selectedRecord.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm overflow-hidden">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)] transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                  Historial de Versiones Git
                </h3>
                <span className="text-[11px] font-mono text-[var(--accent-primary)] font-semibold px-2 py-0.5 rounded bg-[var(--accent-subtle)] border border-[var(--accent-border)]">
                  Solo Autor
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Canción: <strong className="text-[var(--text-primary)]">{song.title}</strong> · Archivo <code className="text-[var(--accent-primary)] font-mono">songs/{song.id}.md</code>
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

        {/* Notice banner */}
        {restoreNotice && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300 font-medium">
            {restoreNotice}
          </div>
        )}

        {/* Split Body: Left Commit Timeline, Right Diff & Preview */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden bg-[var(--bg-surface)]">
          {/* Left Column: Commits Timeline (md:col-span-5) */}
          <div className="md:col-span-5 border-r border-[var(--border-subtle)] flex flex-col overflow-y-auto p-4 space-y-2 bg-[var(--bg-surface-subtle)]">
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold px-1 py-1">
              Revisiones en el Repositorio ({historyRecords.length})
            </div>

            {historyRecords.map((record, index) => {
              const isSelected = selectedRecordIndex === index;
              const dateFormatted = new Date(record.commit.timestamp).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={`${record.commit.hash}-${index}`}
                  onClick={() => setSelectedRecordIndex(index)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[var(--bg-modal)] border-[var(--accent-primary)] shadow-sm'
                      : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold">
                      {record.commit.hash}
                    </span>
                    {record.isCurrent ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        ● Versión Actual
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Snapshot anterior
                      </span>
                    )}
                  </div>

                  {/* Commit message summary */}
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] leading-snug mb-2 line-clamp-2">
                    {record.commit.message}
                  </h4>

                  {/* Metadata: Date and author */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>{dateFormatted}</span>
                    </span>
                    <span className="truncate max-w-[120px] font-mono">
                      {record.commit.author.split('<')[0].trim()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Diff / Lyrics / Raw Preview (md:col-span-7) */}
          <div className="md:col-span-7 flex flex-col overflow-hidden bg-[var(--bg-surface)]">
            {/* View Switcher Header */}
            <div className="flex items-center justify-between p-3.5 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewTab('diff')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    viewTab === 'diff'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Comparativa Diff
                </button>
                <button
                  onClick={() => setViewTab('lyrics')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    viewTab === 'lyrics'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Letra & Acordes
                </button>
                <button
                  onClick={() => setViewTab('raw')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    viewTab === 'raw'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-text)] font-semibold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Markdown Fuente</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyMarkdown}
                  className="p-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-[var(--text-secondary)] transition-colors cursor-pointer flex items-center gap-1"
                  title="Copiar contenido de este commit"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
                </button>

                {!selectedRecord?.isCurrent && (
                  <button
                    onClick={handleRestore}
                    className="px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    title="Restaurar la canción a este punto de la historia"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar versión</span>
                  </button>
                )}
              </div>
            </div>

            {/* Selected Version Summary Ribbon */}
            <div className="p-3 px-4 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)] truncate">
                Commit <strong className="font-mono text-[var(--accent-primary)] font-semibold">[{selectedRecord?.commit.hash}]</strong>: {selectedRecord?.commit.message}
              </span>
              <span className="text-[var(--text-muted)] font-mono text-[11px] shrink-0 ml-3">
                {new Date(selectedRecord?.commit.timestamp || '').toLocaleDateString('es-ES')}
              </span>
            </div>

            {/* Main Content Pane */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs select-text">
              {/* Tab 1: Line-by-line Diff */}
              {viewTab === 'diff' && (
                <div className="space-y-0.5">
                  <div className="mb-3 p-2 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-sans text-[11px] text-[var(--text-muted)] flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>+ Verde:</span> Añadido en versión actual
                    </span>
                    <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold">
                      <span>- Rojo:</span> Presente en commit seleccionado
                    </span>
                  </div>

                  {diffLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`py-0.5 px-2 rounded flex gap-2 leading-relaxed ${
                        line.type === 'added'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : line.type === 'removed'
                          ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
                      }`}
                    >
                      <span className="w-4 select-none shrink-0 font-bold opacity-60">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className="break-all whitespace-pre-wrap">{line.text || ' '}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Clean Lyrics */}
              {viewTab === 'lyrics' && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] font-serif text-sm leading-relaxed text-[var(--text-primary)] space-y-2 whitespace-pre-wrap">
                  {markdownToSong(selectedRecord.markdown, song.id).lyrics}
                </div>
              )}

              {/* Tab 3: Raw Markdown Source */}
              {viewTab === 'raw' && (
                <pre className="p-4 rounded-xl bg-[var(--bg-code)] border border-[var(--border-subtle)] text-[11px] leading-relaxed text-[var(--text-primary)] overflow-x-auto">
                  {selectedRecord.markdown}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-modal)] flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">
            Control de Versiones Git local · Los cambios se guardan automáticamente en tu repositorio
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
