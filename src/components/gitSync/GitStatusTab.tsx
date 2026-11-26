import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  GitCommit as GitCommitIcon,
  UploadCloud
} from 'lucide-react';
import { GitStatusSummary, Song } from '../../types/song';
import { GitHubSyncService, RemoteConfig } from '../../services/githubSyncService';

export interface GitStatusTabProps {
  songsCount: number;
  gitStatus: GitStatusSummary;
  remoteConfig: RemoteConfig;
  commitMessage: string;
  onCommitMessageChange: (val: string) => void;
  autoPushAfterCommit: boolean;
  onAutoPushAfterCommitChange: (val: boolean) => void;
  authorName: string;
  onAuthorNameChange: (val: string) => void;
  isPushing: boolean;
  onCreateCommit: (e: React.FormEvent) => void;
  onPullFromRemote: (forceReload: boolean) => void;
  onManualPush: () => void;
  unpushedCount: number;
  lastPushTime: string | null;
  autoCommitGlobal: boolean;
  onToggleAutoCommit: (enabled: boolean) => void;
}

export const GitStatusTab: React.FC<GitStatusTabProps> = ({
  songsCount,
  gitStatus,
  remoteConfig,
  commitMessage,
  onCommitMessageChange,
  autoPushAfterCommit,
  onAutoPushAfterCommitChange,
  authorName,
  onAuthorNameChange,
  isPushing,
  onCreateCommit,
  onPullFromRemote,
  onManualPush,
  unpushedCount,
  lastPushTime,
  autoCommitGlobal,
  onToggleAutoCommit
}) => {
  return (
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

        <div className="space-y-1.5 text-xs font-mono">
          {gitStatus.modified.map((file) => (
            <div
              key={file}
              className="flex items-center justify-between p-2 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-[var(--accent-primary)]"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">M</span>
                <span>{file}</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-sans">Modificado</span>
            </div>
          ))}

          {gitStatus.created.map((file) => (
            <div
              key={file}
              className="flex items-center justify-between p-2 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-emerald-600 dark:text-emerald-300"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">A</span>
                <span>{file}</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-sans">Nuevo tema añadido</span>
            </div>
          ))}

          {gitStatus.deleted.map((file) => (
            <div
              key={file}
              className="flex items-center justify-between p-2 rounded bg-[var(--bg-modal)] border border-[var(--border-subtle)] text-red-500"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">D</span>
                <span>{file}</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-sans">Eliminado</span>
            </div>
          ))}

          {gitStatus.isClean && (
            <p className="text-xs text-[var(--text-muted)] italic font-sans py-2">
              Todos los temas ({songsCount} archivos .md) están sincronizados con el último commit registrado.
            </p>
          )}
        </div>
      </div>

      {/* Commit Form */}
      <form
        onSubmit={onCreateCommit}
        className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4"
      >
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
            onChange={(e) => onCommitMessageChange(e.target.value)}
            placeholder="Ej. feat: agrega estribillo alternativo y acordes a 'Laberintos de Otoño'"
            className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] font-mono shadow-sm"
          />
        </div>

        <div className="pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={autoPushAfterCommit}
              onChange={(e) => onAutoPushAfterCommitChange(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--accent-primary)] border-[var(--border-subtle)] focus:ring-0"
            />
            <span className="flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>
                Ejecutar operación <strong>"push"</strong> a GitHub automáticamente tras el commit (git push origin{' '}
                {remoteConfig.branch})
              </span>
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
              onChange={(e) => onAuthorNameChange(e.target.value)}
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
              Repositorio: <strong className="text-[var(--text-primary)] font-mono">{remoteConfig.owner}/{remoteConfig.repo}</strong> en rama{' '}
              <strong className="text-[var(--text-primary)] font-mono">{remoteConfig.branch}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => onPullFromRemote(e.shiftKey)}
              disabled={isPushing}
              className="py-2 px-3 text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="Traer la versión remota desde GitHub (Valida con cabeceras ETag 304 / no-cache. Mantén Shift al hacer clic para forzar recarga completa)"
            >
              {isPushing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Sincronizar desde GitHub</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onManualPush}
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
          <div className="flex items-center gap-3">
            <div>
              <span>Commits locales pendientes: </span>
              <span className={`font-mono font-bold ${unpushedCount > 0 ? 'text-[var(--accent-primary)]' : 'text-emerald-500'}`}>
                {unpushedCount} {unpushedCount === 1 ? 'commit' : 'commits'}
              </span>
            </div>
            {GitHubSyncService.getCatalogETag() && (
              <div
                className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] opacity-80"
                title={`ETag activo: ${GitHubSyncService.getCatalogETag()}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span className="font-mono">
                  ETag: {GitHubSyncService.getCatalogETag()?.replace(/"/g, '').substring(0, 12)}...
                </span>
              </div>
            )}
            {GitHubSyncService.getRemoteSha() && (
              <div
                className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] opacity-80"
                title={`SHA remoto de catalog.json: ${GitHubSyncService.getRemoteSha()}`}
              >
                <span className="font-mono">SHA: {GitHubSyncService.getRemoteSha()?.substring(0, 7)}</span>
              </div>
            )}
          </div>
          {lastPushTime && (
            <div>
              Último push:{' '}
              {new Date(lastPushTime).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
      </div>

      {/* Auto-Commit & Auto-Push Configuration */}
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
              onChange={(e) => onToggleAutoCommit(e.target.checked)}
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
              <p>Los commits se suben directamente al repositorio de GitHub:</p>
              <div className="font-mono text-[11px] p-1.5 rounded bg-[var(--bg-code)] border border-[var(--border-subtle)] text-[var(--accent-primary)] flex items-center justify-between">
                <span>
                  https://github.com/{remoteConfig.owner}/{remoteConfig.repo} (rama: {remoteConfig.branch})
                </span>
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
                Commits atómicos (Git Data API):{' '}
                <code className="font-mono text-[var(--text-primary)]">songs/*.md</code>,{' '}
                <code className="font-mono text-[var(--text-primary)]">catalog.json</code> y{' '}
                <code className="font-mono text-[var(--text-primary)]">albums.json</code> en una única transacción.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-1.5 border-t border-[var(--border-subtle)]">
            <span className="font-semibold text-[var(--text-primary)] shrink-0">🔐 Permisos del Token:</span>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Para que GitHub permita hacer Push mediante su API REST, tu Personal Access Token debe tener el permiso{' '}
              <strong className="text-[var(--accent-primary)] font-mono">repo</strong> (o para fine-grained tokens: permiso en repositorio{' '}
              <code className="font-mono">cancionero</code> de{' '}
              <strong className="text-[var(--accent-primary)] font-mono">Contents: Read and write</strong>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
