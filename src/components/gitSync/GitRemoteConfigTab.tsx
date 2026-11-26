import React from 'react';
import { ExternalLink, Save, UploadCloud } from 'lucide-react';
import { RemoteConfig } from '../../services/githubSyncService';

export interface GitRemoteConfigTabProps {
  remoteConfig: RemoteConfig;
  remoteOwnerInput: string;
  onRemoteOwnerInputChange: (val: string) => void;
  remoteRepoInput: string;
  onRemoteRepoInputChange: (val: string) => void;
  remoteBranchInput: string;
  onRemoteBranchInputChange: (val: string) => void;
  isPushing: boolean;
  onSaveRemoteConfig: (e: React.FormEvent) => void;
  onManualPush: () => void;
}

export const GitRemoteConfigTab: React.FC<GitRemoteConfigTabProps> = ({
  remoteConfig,
  remoteOwnerInput,
  onRemoteOwnerInputChange,
  remoteRepoInput,
  onRemoteRepoInputChange,
  remoteBranchInput,
  onRemoteBranchInputChange,
  isPushing,
  onSaveRemoteConfig,
  onManualPush
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
      <form
        onSubmit={onSaveRemoteConfig}
        className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-4"
      >
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
              onChange={(e) => onRemoteOwnerInputChange(e.target.value)}
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
              onChange={(e) => onRemoteRepoInputChange(e.target.value)}
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
              onChange={(e) => onRemoteBranchInputChange(e.target.value)}
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
            onClick={onManualPush}
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
                <span>
                  Hacer Push ahora a {remoteConfig.owner}/{remoteConfig.repo}
                </span>
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
          <div className="text-[var(--accent-primary)] font-semibold">
            git remote add origin https://github.com/{remoteConfig.owner}/{remoteConfig.repo}.git
          </div>
          <div className="text-[var(--accent-primary)] font-semibold">git branch -M {remoteConfig.branch}</div>
          <div className="text-[var(--text-muted)]"># 2. Registra los cambios y haz Push</div>
          <div className="text-[var(--accent-primary)] font-semibold">git add songs/*.md catalog.json</div>
          <div className="text-[var(--accent-primary)] font-semibold">
            git commit -m "update: sincronizar letras y canciones"
          </div>
          <div className="text-[var(--accent-primary)] font-semibold">
            git push -u origin {remoteConfig.branch}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
        💡 <strong>Push automático</strong>: Al crear commits en la pestaña <em>Estado</em> o al editar canciones, puedes marcar la casilla{' '}
        <strong>"Hacer Push a GitHub tras el commit"</strong> para que los cambios se suban automáticamente a tu rama remota.
      </div>
    </div>
  );
};
