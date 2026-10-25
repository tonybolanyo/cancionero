import React, { useState, useRef } from 'react';
import {
  X,
  GitBranch,
  GitCommit as GitCommitIcon,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  FolderArchive,
  Terminal,
  History,
  UploadCloud,
  Send,
  Save,
  ExternalLink
} from 'lucide-react';
import { Song, GitCommit, GitStatusSummary } from '../types/song';
import { StorageService } from '../services/storageService';
import { generateGitRepositoryZip } from '../utils/markdownParser';
import { useAuth } from '../context/AuthContext';
import { GitHubSyncService, RemoteConfig } from '../services/githubSyncService';

interface GitSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  onSongsUpdated: (songs: Song[]) => void;
}

export const GitSyncModal: React.FC<GitSyncModalProps> = ({
  isOpen,
  onClose,
  songs,
  onSongsUpdated
}) => {
  const { user, token } = useAuth();
  const defaultAuthor = user ? `${user.name} <${user.email || 'tony@tonygb.com'}>` : 'Tony <tony@tonygb.com>';

  const [activeTab, setActiveTab] = useState<'status' | 'history' | 'export' | 'import' | 'remote'>('status');
  const [commitMessage, setCommitMessage] = useState('');
  const [authorName, setAuthorName] = useState(defaultAuthor);
  const [autoPushAfterCommit, setAutoPushAfterCommit] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [autoCommitGlobal, setAutoCommitGlobal] = useState<boolean>(() =>
    GitHubSyncService.isAutoCommitEnabled()
  );

  const handleToggleAutoCommit = (enabled: boolean) => {
    setAutoCommitGlobal(enabled);
    GitHubSyncService.setAutoCommitEnabled(enabled);
    setNotification({
      message: enabled
        ? 'Auto-Commit y Auto-Push activado. Cada cambio de canción se enviará automáticamente a GitHub.'
        : 'Auto-Commit y Auto-Push desactivado.',
      type: 'success'
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig>(() =>
    GitHubSyncService.getRemoteConfig(user?.login)
  );
  const [remoteOwnerInput, setRemoteOwnerInput] = useState(remoteConfig.owner);
  const [remoteRepoInput, setRemoteRepoInput] = useState(remoteConfig.repo);
  const [remoteBranchInput, setRemoteBranchInput] = useState(remoteConfig.branch);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdFileInputRef = useRef<HTMLInputElement>(null);

  const gitStatus: GitStatusSummary = StorageService.getGitStatus();
  const commits: GitCommit[] = StorageService.getCommits();
  const unpushedCount = StorageService.getUnpushedCommitsCount();
  const lastPushTime = GitHubSyncService.getLastPushTime();

  if (!isOpen) return null;

  const handleCreateCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) {
      setNotification({ message: 'Por favor escribe un mensaje de commit descriptivo.', type: 'error' });
      return;
    }

    const currentMsg = commitMessage.trim();
    const { commit } = StorageService.createGitCommit(currentMsg, authorName);
    setCommitMessage('');

    if (autoPushAfterCommit) {
      setIsPushing(true);
      try {
        const pushResult = await GitHubSyncService.pushFullCatalog(
          songs,
          `feat(sync): [${commit.hash}] ${currentMsg}`,
          token,
          remoteConfig
        );
        setNotification({
          message: `Commit [${commit.hash}] registrado y Push a GitHub completado: ${pushResult.message}`,
          type: pushResult.success ? 'success' : 'error'
        });
      } catch (err: any) {
        setNotification({
          message: `Commit [${commit.hash}] guardado, pero ocurrió un problema al hacer push: ${err.message}`,
          type: 'error'
        });
      } finally {
        setIsPushing(false);
      }
    } else {
      setNotification({
        message: `Commit registrado con éxito: [${commit.hash}] "${commit.message}". Recuerda hacer Push para enviarlo a GitHub.`,
        type: 'success'
      });
    }
    setTimeout(() => setNotification(null), 6000);
  };

  const handleManualPush = async () => {
    setIsPushing(true);
    setNotification(null);
    try {
      const pushResult = await GitHubSyncService.pushFullCatalog(
        songs,
        `sync: sincronización manual del cancionero (${songs.length} temas)`,
        token,
        remoteConfig
      );
      setNotification({
        message: pushResult.message,
        type: pushResult.success ? 'success' : 'error'
      });
    } catch (err: any) {
      setNotification({
        message: 'Error al ejecutar push: ' + err.message,
        type: 'error'
      });
    } finally {
      setIsPushing(false);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleSaveRemoteConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: RemoteConfig = {
      owner: remoteOwnerInput.trim().toLowerCase(),
      repo: remoteRepoInput.trim(),
      branch: remoteBranchInput.trim() || 'main'
    };
    GitHubSyncService.saveRemoteConfig(updated);
    setRemoteConfig(updated);
    setNotification({
      message: `Configuración remota guardada: ${updated.owner}/${updated.repo}@${updated.branch}`,
      type: 'success'
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDownloadZip = async () => {
    try {
      const blob = await generateGitRepositoryZip(songs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cancionero-git-repo-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setNotification({
        message: 'Repositorio Git descargado con éxito (.zip con todos los archivos Markdown y JSON).',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({ message: 'Error al empaquetar el repositorio: ' + err.message, type: 'error' });
    }
  };

  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(songs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = StorageService.importFromJson(content);
      if (res.success) {
        const updated = StorageService.getSongs();
        onSongsUpdated(updated);
        setNotification({
          message: `Se importaron/actualizaron ${res.count} canciones desde el archivo JSON.`,
          type: 'success'
        });
      } else {
        setNotification({ message: 'Error: ' + res.error, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleMdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const res = StorageService.importFromMarkdown(file.name, content);
        if (res.success) {
          const updated = StorageService.getSongs();
          onSongsUpdated(updated);
        }
      };
      reader.readAsText(file);
    });

    setNotification({
      message: `Procesando archivos Markdown subidos...`,
      type: 'success'
    });
    setTimeout(() => {
      setNotification({
        message: `Archivos Markdown sincronizados con el cancionero local.`,
        type: 'success'
      });
    }, 800);
    e.target.value = '';
  };

  const handleResetCatalog = () => {
    if (confirm('¿Restablecer el repertorio al catálogo inicial de demostración? Se conservarán los archivos predeterminados.')) {
      const reset = StorageService.resetToDefault();
      onSongsUpdated(reset);
      setNotification({ message: 'Catálogo restaurado a los temas iniciales.', type: 'success' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)] transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                Sincronización Git & Archivos Locales
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Almacenamiento sin base de datos: cada canción es un archivo Markdown (.md) versionado
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-[var(--border-subtle)] bg-[var(--bg-modal)] overflow-x-auto">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'status'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Estado del Repositorio ({gitStatus.isClean ? 'Limpio' : `${gitStatus.modified.length + gitStatus.created.length} pendientes`})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial de Commits ({commits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Repositorio</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'import'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar Archivos</span>
          </button>
          <button
            onClick={() => setActiveTab('remote')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'remote'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Comandos Git Remotos</span>
          </button>
        </div>

        {/* Notification banner */}
        {notification && (
          <div className={`mx-4 sm:mx-6 mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
              : 'bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Tab 1: Repository Status & Commit Form */}
        {activeTab === 'status' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Rama principal: <strong className="text-[var(--text-primary)]">main</strong>
                </span>
                {gitStatus.isClean ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Árbol de trabajo limpio (Sin cambios pendientes)
                  </span>
                ) : (
                  <span className="text-xs font-medium text-[var(--accent-primary)] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Cambios sin commit en archivos locales
                  </span>
                )}
              </div>

              {/* Changed files list */}
              <div className="space-y-1.5 text-xs font-mono">
                {gitStatus.modified.map(file => (
                  <div key={file} className="flex items-center justify-between p-2 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-[var(--accent-primary)]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">M</span>
                      <span>{file}</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] font-sans">Modificado</span>
                  </div>
                ))}

                {gitStatus.created.map(file => (
                  <div key={file} className="flex items-center justify-between p-2 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-emerald-600 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">A</span>
                      <span>{file}</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] font-sans">Nuevo tema añadido</span>
                  </div>
                ))}

                {gitStatus.deleted.map(file => (
                  <div key={file} className="flex items-center justify-between p-2 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-red-500">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">D</span>
                      <span>{file}</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] font-sans">Eliminado</span>
                  </div>
                ))}

                {gitStatus.isClean && (
                  <p className="text-xs text-[var(--text-muted)] italic font-sans py-2">
                    Todos los temas ({songs.length} archivos .md) están sincronizados con el último commit registrado.
                  </p>
                )}
              </div>
            </div>

            {/* Commit Form */}
            <form onSubmit={handleCreateCommit} className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold">
                Registrar nuevo Git Commit
              </h4>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)] block">
                  Mensaje del commit (describir cambios en letras, acordes o maquetas)
                </label>
                <input
                  type="text"
                  required
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Ej. feat: agrega estribillo alternativo y acordes a 'Laberintos de Otoño'"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
                />
              </div>

              {/* Push option checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={autoPushAfterCommit}
                    onChange={(e) => setAutoPushAfterCommit(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent-primary)] border-[var(--border-subtle)] focus:ring-0"
                  />
                  <span className="flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Ejecutar operación <strong>"push"</strong> a GitHub automáticamente tras el commit (git push origin {remoteConfig.branch})</span>
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Autor del commit
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isPushing}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isPushing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                        <span>Haciendo Commit y Push...</span>
                      </>
                    ) : (
                      <>
                        <GitCommitIcon className="w-4 h-4" />
                        <span>{autoPushAfterCommit ? 'Hacer Commit y Push a Remoto 🚀' : 'Hacer Commit Local'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Remote Push & Sync Card */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4" />
                    <span>Sincronización Remota (GitHub Push)</span>
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Repositorio: <strong className="text-[var(--text-primary)] font-mono">{remoteConfig.owner}/{remoteConfig.repo}</strong> en rama <strong className="text-[var(--text-primary)] font-mono">{remoteConfig.branch}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualPush}
                    disabled={isPushing}
                    className="py-2 px-3 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                    title="Enviar cambios al repositorio GitHub"
                  >
                    {isPushing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                        <span>Haciendo Push...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Hacer Push ahora</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                <div>
                  <span>Commits locales pendientes de Push: </span>
                  <span className={`font-mono font-bold ${unpushedCount > 0 ? 'text-[var(--accent-primary)]' : 'text-emerald-500'}`}>
                    {unpushedCount} {unpushedCount === 1 ? 'commit' : 'commits'}
                  </span>
                </div>
                {lastPushTime && (
                  <div>
                    Último push: {new Date(lastPushTime).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Auto-Commit & Auto-Push Configuration & Destination Card */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                      Auto-Commit & Auto-Push a GitHub
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Sube automáticamente cada cambio a tu repositorio remoto
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCommitGlobal}
                    onChange={(e) => handleToggleAutoCommit(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                  <span className="ml-2 text-xs font-medium text-[var(--text-primary)]">
                    {autoCommitGlobal ? 'Activado' : 'Desactivado'}
                  </span>
                </label>
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)] space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-[var(--text-primary)] shrink-0">📍 ¿Dónde hace push?</span>
                  <div className="text-[var(--text-secondary)] space-y-1">
                    <p>
                      Los commits se suben directamente al repositorio de GitHub:
                    </p>
                    <div className="font-mono text-[11px] p-1.5 rounded bg-[var(--bg-code)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-between">
                      <span>https://github.com/{remoteConfig.owner}/{remoteConfig.repo} (rama: {remoteConfig.branch})</span>
                      <a
                        href={`https://github.com/${remoteConfig.owner}/${remoteConfig.repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] ml-2"
                        title="Abrir repositorio en GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Archivos sincronizados: <code className="font-mono text-[var(--text-primary)]">songs/*.md</code> (una por canción) y el índice <code className="font-mono text-[var(--text-primary)]">catalog.json</code>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1.5 border-t border-[var(--border-subtle)]">
                  <span className="font-semibold text-[var(--text-primary)] shrink-0">🔐 Permisos del Token:</span>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Para que GitHub permita hacer Push mediante su API REST, tu Personal Access Token debe tener el permiso <strong className="text-[var(--accent-primary)] font-mono">repo</strong> (o para fine-grained tokens: permiso en repositorio <code className="font-mono">cancionero</code> de <strong className="text-[var(--accent-primary)] font-mono">Contents: Read and write</strong>).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Commit History */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[var(--bg-surface)]">
            <p className="text-xs text-[var(--text-muted)]">
              Historial de revisiones del cancionero. Haz clic en un commit para ver los archivos modificados.
            </p>

            <div className="space-y-2">
              {commits.map((c) => (
                <div
                  key={c.hash}
                  onClick={() => setSelectedCommit(selectedCommit?.hash === c.hash ? null : c)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedCommit?.hash === c.hash
                      ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)]'
                      : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] font-semibold">
                        {c.hash}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {c.message}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(c.timestamp).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
                    <span>{c.author}</span>
                    <span>{c.filesChanged?.length || 1} archivo(s)</span>
                  </div>

                  {selectedCommit?.hash === c.hash && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs font-mono space-y-1">
                      <span className="text-[var(--text-muted)] block font-sans">Archivos incluidos en este snapshot:</span>
                      {c.filesChanged?.map(f => (
                        <div key={f} className="text-[var(--accent-primary)] pl-2">
                          · {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Export Repository */}
        {activeTab === 'export' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full ZIP download */}
              <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] mb-3">
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <h4 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1">
                    Repositorio Completo (.zip)
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Descarga un archivo ZIP listo para descomprimir e iniciar un repositorio Git en tu ordenador.
                    Incluye la carpeta <code className="text-[var(--accent-primary)] font-semibold">songs/*.md</code>, <code className="text-[var(--accent-primary)] font-semibold">catalog.json</code>, <code className="text-[var(--accent-primary)] font-semibold">README.md</code> y <code className="text-[var(--accent-primary)] font-semibold">.gitignore</code>.
                  </p>
                </div>
                <button
                  onClick={handleDownloadZip}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Repositorio ZIP</span>
                </button>
              </div>

              {/* JSON export */}
              <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] mb-3">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1">
                    Catálogo Completo (catalog.json)
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Exporta la base de datos completa en formato JSON estructurado con metadatos de acordes, tonalidades, BPM y enlaces a Spotify, YouTube y SoundCloud.
                  </p>
                </div>
                <button
                  onClick={handleDownloadJson}
                  className="w-full py-2.5 px-4 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar catalog.json</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[var(--text-primary)] block">
                  Restablecer catálogo a canciones de demostración
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Recarga las 6 canciones predeterminadas con letras, maquetas y acordes.
                </span>
              </div>
              <button
                onClick={handleResetCatalog}
                className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              >
                Restablecer
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Import Files */}
        {activeTab === 'import' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
            <p className="text-xs text-[var(--text-secondary)]">
              Sube tus propios archivos desde tu disco duro o repositorio Git para sincronizarlos con la aplicación:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Import Markdown */}
              <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                    Importar Archivos Markdown (.md)
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    Sube uno o varios archivos <code className="text-[var(--accent-primary)] font-semibold">.md</code> con encabezado YAML. Se añadirán o actualizarán en tu repertorio automáticamente.
                  </p>
                </div>
                <input
                  type="file"
                  ref={mdFileInputRef}
                  onChange={handleMdUpload}
                  accept=".md,.markdown,.txt"
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => mdFileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Seleccionar archivos .md</span>
                </button>
              </div>

              {/* Import JSON */}
              <div className="p-5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                    Importar Catálogo JSON
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    Sube un archivo <code className="text-[var(--accent-primary)] font-semibold">catalog.json</code> o copia de seguridad previa para fusionar canciones.
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleJsonUpload}
                  accept=".json"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Seleccionar archivo .json</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Remote Git Configuration & Direct Push */}
        {activeTab === 'remote' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
            {/* Interactive Remote Repo Config Form */}
            <form onSubmit={handleSaveRemoteConfig} className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4" />
                  <span>Configuración del Repositorio Remoto (GitHub)</span>
                </h4>
                <a
                  href={`https://github.com/${remoteConfig.owner}/${remoteConfig.repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] flex items-center gap-1"
                >
                  <span>Abrir en GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Usuario / Organización
                  </label>
                  <input
                    type="text"
                    required
                    value={remoteOwnerInput}
                    onChange={(e) => setRemoteOwnerInput(e.target.value)}
                    placeholder="tonygb"
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Nombre del Repositorio
                  </label>
                  <input
                    type="text"
                    required
                    value={remoteRepoInput}
                    onChange={(e) => setRemoteRepoInput(e.target.value)}
                    placeholder="cancionero"
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-primary)] block">
                    Rama (Branch)
                  </label>
                  <input
                    type="text"
                    required
                    value={remoteBranchInput}
                    onChange={(e) => setRemoteBranchInput(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  className="py-2 px-3 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar configuración remota</span>
                </button>

                <button
                  type="button"
                  onClick={handleManualPush}
                  disabled={isPushing}
                  className="py-2 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isPushing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
                      <span>Haciendo Push...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Hacer Push ahora a {remoteConfig.owner}/{remoteConfig.repo}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold">
                Comandos Git en Terminal (Alternativa local)
              </h4>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Si prefieres trabajar desde tu ordenador con la consola o VS Code:
              </p>

              <div className="p-4 rounded-xl bg-[var(--bg-code)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] space-y-2 select-all leading-relaxed">
                <div className="text-[var(--text-muted)]"># 1. Comprueba o vincula el repositorio remoto</div>
                <div className="text-[var(--accent-primary)] font-semibold">git remote add origin https://github.com/{remoteConfig.owner}/{remoteConfig.repo}.git</div>
                <div className="text-[var(--accent-primary)] font-semibold">git branch -M {remoteConfig.branch}</div>
                <div className="text-[var(--text-muted)]"># 2. Registra los cambios y haz Push</div>
                <div className="text-[var(--accent-primary)] font-semibold">git add songs/*.md catalog.json</div>
                <div className="text-[var(--accent-primary)] font-semibold">git commit -m "update: sincronizar letras y canciones"</div>
                <div className="text-[var(--accent-primary)] font-semibold">git push -u origin {remoteConfig.branch}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
              💡 <strong>Push automático</strong>: Al crear commits en la pestaña <em>Estado</em> o al editar canciones, puedes marcar la casilla <strong>"Hacer Push a GitHub tras el commit"</strong> para que los cambios se suban automáticamente a tu rama remota.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-modal)] flex justify-end">
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
