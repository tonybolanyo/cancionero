import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  GitBranch,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Terminal,
  History,
  ShieldCheck
} from 'lucide-react';
import { Song, GitCommit, GitStatusSummary } from '../types/song';
import { StorageService, SongBackupPoint } from '../services/storageService';
import { generateGitRepositoryZip } from '../utils/markdownParser';
import { useAuth } from '../context/AuthContext';
import { GitHubSyncService, RemoteConfig } from '../services/githubSyncService';
import { GitStatusTab } from './gitSync/GitStatusTab';
import { GitCommitHistoryTab } from './gitSync/GitCommitHistoryTab';
import { GitExportTab, GitImportTab } from './gitSync/GitExportImportTab';
import { GitRemoteConfigTab } from './gitSync/GitRemoteConfigTab';
import { GitBackupsTab } from './gitSync/GitBackupsTab';

export interface GitSyncWorkspaceProps {
  songs: Song[];
  onSongsUpdated: (songs: Song[]) => void;
  onClose?: () => void;
  mode?: 'modal' | 'page';
}

export const GitSyncWorkspace: React.FC<GitSyncWorkspaceProps> = ({
  songs,
  onSongsUpdated,
  onClose,
  mode = 'page'
}) => {
  const { user, token } = useAuth();
  const defaultAuthor = user ? `${user.name} <${user.email || 'tony@tonygb.com'}>` : 'Tony <tony@tonygb.com>';

  const [activeTab, setActiveTab] = useState<'status' | 'history' | 'export' | 'import' | 'remote' | 'backups'>('status');
  const [commitMessage, setCommitMessage] = useState('');
  const [authorName, setAuthorName] = useState(defaultAuthor);
  const [autoPushAfterCommit, setAutoPushAfterCommit] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [backupPoints, setBackupPoints] = useState<SongBackupPoint[]>(() =>
    StorageService.getBackupPoints()
  );
  const [manualBackupName, setManualBackupName] = useState('');
  const [selectedBackup, setSelectedBackup] = useState<SongBackupPoint | null>(null);

  useEffect(() => {
    let active = true;
    StorageService.init()
      .then(() => {
        if (active) {
          setBackupPoints(StorageService.getBackupPoints());
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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

  const handleCreateCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) {
      setNotification({ message: 'Por favor escribe un mensaje de commit descriptivo.', type: 'error' });
      return;
    }

    const currentMsg = commitMessage.trim();
    const priorUnpushedFiles = StorageService.getUnpushedChangedFiles(lastPushTime);

    if (autoPushAfterCommit) {
      StorageService.createBackupPoint(
        `Backup automático previo al push de [commit] "${currentMsg}"`,
        'pre_sync'
      );
      setBackupPoints(StorageService.getBackupPoints());
    }

    const { commit } = StorageService.createGitCommit(currentMsg, authorName);
    setCommitMessage('');

    if (autoPushAfterCommit) {
      setIsPushing(true);
      try {
        const filesToSync = Array.from(
          new Set([...(commit.filesChanged || []), ...priorUnpushedFiles])
        );
        const pushResult = await GitHubSyncService.pushFullCatalog(
          songs,
          `feat(sync): [${commit.hash}] ${currentMsg}`,
          token,
          remoteConfig,
          { changedFiles: filesToSync }
        );
        setNotification({
          message: pushResult.success
            ? `Commit [${commit.hash}] registrado y Push atómico a GitHub completado: ${pushResult.message}`
            : `Commit [${commit.hash}] guardado localmente, pero el Push a GitHub falló: ${pushResult.message}`,
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
    StorageService.createBackupPoint(
      `Backup automático previo al push manual hacia ${remoteConfig.owner}/${remoteConfig.repo} (${songs.length} temas)`,
      'pre_sync'
    );
    setBackupPoints(StorageService.getBackupPoints());

    setIsPushing(true);
    setNotification(null);
    try {
      const currentStatus = StorageService.getGitStatus();
      const unpushedFiles = StorageService.getUnpushedChangedFiles(lastPushTime);
      const filesToSync = Array.from(
        new Set([
          ...currentStatus.modified,
          ...currentStatus.created,
          ...currentStatus.deleted,
          ...unpushedFiles
        ])
      );
      const pushResult = await GitHubSyncService.pushFullCatalog(
        songs,
        `sync: sincronización atómica del cancionero (${songs.length} temas)`,
        token,
        remoteConfig,
        {
          changedFiles: filesToSync,
          deletedPaths: currentStatus.deleted
        }
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

  const handlePullFromRemote = async (forceReload = false) => {
    setIsPushing(true);
    setNotification(null);

    try {
      const result = await GitHubSyncService.syncCatalogFromRemote(token, remoteConfig, { forceReload });
      if (result.songs && !result.notModified) {
        onSongsUpdated(result.songs);
      }
      setNotification({
        message: result.message,
        type: result.success ? 'success' : 'error'
      });
    } catch (err: any) {
      setNotification({
        message: 'Error al sincronizar desde GitHub: ' + err.message,
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
        setBackupPoints(StorageService.getBackupPoints());
        setNotification({
          message: `Se importaron/actualizaron ${res.count} canciones desde el archivo JSON. Se guardó un punto de restauración automático.`,
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

    StorageService.createBackupPoint(
      `Backup automático previo a importar ${files.length} archivo(s) Markdown`,
      'pre_import_md'
    );
    setBackupPoints(StorageService.getBackupPoints());

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
      message: `Procesando archivos Markdown subidos... Punto de restauración guardado.`,
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
    if (confirm('¿Restablecer el repertorio al catálogo inicial de demostración? Se creará automáticamente un backup de seguridad.')) {
      const reset = StorageService.resetToDefault();
      onSongsUpdated(reset);
      setBackupPoints(StorageService.getBackupPoints());
      setNotification({ message: 'Catálogo restaurado a los temas iniciales. Punto de seguridad creado.', type: 'success' });
    }
  };

  const handleCreateManualBackup = (e: React.FormEvent) => {
    e.preventDefault();
    const name = manualBackupName.trim() || `Backup manual (${new Date().toLocaleTimeString('es-ES')})`;
    const bp = StorageService.createBackupPoint(name, 'manual');
    setBackupPoints(StorageService.getBackupPoints());
    setManualBackupName('');
    setNotification({
      message: `Punto de restauración "${bp.name}" creado con éxito (${bp.songCount} canciones).`,
      type: 'success'
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRestoreBackup = (point: SongBackupPoint) => {
    const confirmed = window.confirm(
      `¿Confirmas restaurar el cancionero completo al punto "${point.name}" (${point.songCount} canciones)?\n\n` +
        `Se creará automáticamente un snapshot de seguridad del estado actual antes de aplicar la reversión.`
    );
    if (!confirmed) return;

    const res = StorageService.restoreBackupPoint(point.id);
    if (res.success && res.songs) {
      onSongsUpdated(res.songs);
      setBackupPoints(StorageService.getBackupPoints());
      setNotification({
        message: `Cancionero revertido con éxito a "${point.name}" (${res.songs.length} temas). Se ha registrado el commit en Git.`,
        type: 'success'
      });
    } else {
      setNotification({
        message: `Error al revertir: ${res.error || 'Error desconocido'}`,
        type: 'error'
      });
    }
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDownloadBackupJson = (point: SongBackupPoint) => {
    const blob = new Blob([point.songsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-cancionero-${point.id.slice(0, 16)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteBackup = (backupId: string) => {
    if (window.confirm('¿Deseas eliminar este punto de restauración?')) {
      StorageService.deleteBackupPoint(backupId);
      setBackupPoints(StorageService.getBackupPoints());
      if (selectedBackup?.id === backupId) setSelectedBackup(null);
      setNotification({
        message: 'Punto de restauración eliminado.',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleClearAllBackups = () => {
    if (window.confirm('¿Seguro que deseas eliminar todos los puntos de restauración? Esta acción no se puede deshacer.')) {
      StorageService.clearAllBackups();
      setBackupPoints([]);
      setSelectedBackup(null);
      setNotification({ message: 'Todos los puntos de restauración han sido borrados.', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const isModal = mode === 'modal';

  return (
    <div
      className={
        isModal
          ? 'relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden text-[var(--text-primary)] transition-colors duration-200'
          : 'w-full flex flex-col rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm overflow-hidden text-[var(--text-primary)] transition-colors duration-200'
      }
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border-subtle)] ${
          isModal ? 'bg-[var(--bg-modal)]' : 'bg-[var(--bg-surface-subtle)]/60'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)]">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            {isModal ? (
              <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
                Sincronización Git & Archivos Locales
              </h3>
            ) : (
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                Sincronización Git & Archivos Locales
              </h1>
            )}
            <p className="text-xs text-[var(--text-muted)]">
              Almacenamiento sin base de datos: cada canción es un archivo Markdown (.md) versionado
            </p>
          </div>
        </div>

        {isModal && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
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
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'backups'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Puntos de Restauración</span>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                backupPoints.length > 0
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-bold'
                  : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'
              }`}
            >
              {backupPoints.length}
            </span>
          </button>
        </div>

        {/* Notification banner */}
        {notification && (
          <div
            className={`mx-4 sm:mx-6 mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                : 'bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {activeTab === 'status' && (
          <GitStatusTab
            songsCount={songs.length}
            gitStatus={gitStatus}
            remoteConfig={remoteConfig}
            commitMessage={commitMessage}
            onCommitMessageChange={setCommitMessage}
            autoPushAfterCommit={autoPushAfterCommit}
            onAutoPushAfterCommitChange={setAutoPushAfterCommit}
            authorName={authorName}
            onAuthorNameChange={setAuthorName}
            isPushing={isPushing}
            onCreateCommit={handleCreateCommit}
            onPullFromRemote={handlePullFromRemote}
            onManualPush={handleManualPush}
            unpushedCount={unpushedCount}
            lastPushTime={lastPushTime}
            autoCommitGlobal={autoCommitGlobal}
            onToggleAutoCommit={handleToggleAutoCommit}
          />
        )}

        {activeTab === 'history' && (
          <GitCommitHistoryTab
            commits={commits}
            selectedCommit={selectedCommit}
            onSelectCommit={setSelectedCommit}
          />
        )}

        {activeTab === 'export' && (
          <GitExportTab
            onDownloadZip={handleDownloadZip}
            onDownloadJson={handleDownloadJson}
            onResetCatalog={handleResetCatalog}
          />
        )}

        {activeTab === 'import' && (
          <GitImportTab
            backupCount={backupPoints.length}
            onGoToBackups={() => setActiveTab('backups')}
            mdFileInputRef={mdFileInputRef}
            fileInputRef={fileInputRef}
            onMdUpload={handleMdUpload}
            onJsonUpload={handleJsonUpload}
          />
        )}

        {activeTab === 'remote' && (
          <GitRemoteConfigTab
            remoteConfig={remoteConfig}
            remoteOwnerInput={remoteOwnerInput}
            onRemoteOwnerInputChange={setRemoteOwnerInput}
            remoteRepoInput={remoteRepoInput}
            onRemoteRepoInputChange={setRemoteRepoInput}
            remoteBranchInput={remoteBranchInput}
            onRemoteBranchInputChange={setRemoteBranchInput}
            isPushing={isPushing}
            onSaveRemoteConfig={handleSaveRemoteConfig}
            onManualPush={handleManualPush}
          />
        )}

        {activeTab === 'backups' && (
          <GitBackupsTab
            songsCount={songs.length}
            backupPoints={backupPoints}
            manualBackupName={manualBackupName}
            onManualBackupNameChange={setManualBackupName}
            selectedBackup={selectedBackup}
            onSelectBackup={setSelectedBackup}
            onCreateManualBackup={handleCreateManualBackup}
            onClearAllBackups={handleClearAllBackups}
            onRestoreBackup={handleRestoreBackup}
            onDownloadBackupJson={handleDownloadBackupJson}
            onDeleteBackup={handleDeleteBackup}
          />
        )}

      {/* Footer */}
      {isModal && onClose && (
        <div className="p-4 sm:p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-modal)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
};

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
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-hidden"
    >
      <GitSyncWorkspace
        songs={songs}
        onSongsUpdated={onSongsUpdated}
        onClose={onClose}
        mode="modal"
      />
    </div>
  );
};
