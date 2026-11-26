import React from 'react';
import {
  BookmarkPlus,
  Calendar,
  FileJson,
  Layers,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { SongBackupPoint } from '../../services/storageService';

export interface GitBackupsTabProps {
  songsCount: number;
  backupPoints: SongBackupPoint[];
  manualBackupName: string;
  onManualBackupNameChange: (val: string) => void;
  selectedBackup: SongBackupPoint | null;
  onSelectBackup: (point: SongBackupPoint | null) => void;
  onCreateManualBackup: (e: React.FormEvent) => void;
  onClearAllBackups: () => void;
  onRestoreBackup: (point: SongBackupPoint) => void;
  onDownloadBackupJson: (point: SongBackupPoint) => void;
  onDeleteBackup: (backupId: string) => void;
}

const REASON_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  pre_sync: {
    label: 'Pre-Sincronización Git',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  },
  pre_import_json: {
    label: 'Pre-Importación JSON',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
  },
  pre_import_md: {
    label: 'Pre-Importación MD',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
  },
  pre_reset: {
    label: 'Pre-Restablecimiento',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
  },
  manual: {
    label: 'Manual',
    badgeClass: 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]'
  }
};

export const GitBackupsTab: React.FC<GitBackupsTabProps> = ({
  songsCount,
  backupPoints,
  manualBackupName,
  onManualBackupNameChange,
  selectedBackup,
  onSelectBackup,
  onCreateManualBackup,
  onClearAllBackups,
  onRestoreBackup,
  onDownloadBackupJson,
  onDeleteBackup
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[var(--bg-surface)]">
      <div className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center gap-2 text-[var(--accent-primary)]">
          <ShieldCheck className="w-4 h-4" />
          <h4 className="text-xs font-mono uppercase tracking-wider font-semibold">
            Puntos de Restauración y Prevención de Conflictos
          </h4>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Cada vez que sincronizas con GitHub, importas archivos Markdown o JSON, o restableces el repertorio, el sistema genera automáticamente una instantánea (backup) de todas tus canciones. Puedes revertir el cancionero a cualquiera de estos puntos en caso de error o conflicto sin perder tus datos.
        </p>
      </div>

      <form
        onSubmit={onCreateManualBackup}
        className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--accent-primary)] font-semibold flex items-center gap-1.5">
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Crear Punto de Restauración Manual</span>
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">{songsCount} temas actuales</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={manualBackupName}
            onChange={(e) => onManualBackupNameChange(e.target.value)}
            placeholder="Nota o motivo del backup (ej. 'Antes de retocar acordes y tonalidades')"
            className="flex-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] shadow-sm"
          />
          <button
            type="submit"
            className="py-2 px-4 text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Snapshot</span>
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            Historial de Puntos Guardados ({backupPoints.length})
          </h4>
          {backupPoints.length > 0 && (
            <button
              type="button"
              onClick={onClearAllBackups}
              className="text-[11px] text-[var(--text-muted)] hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Vaciar historial</span>
            </button>
          )}
        </div>

        {backupPoints.length === 0 ? (
          <div className="p-8 rounded-xl bg-[var(--bg-surface-subtle)] border border-dashed border-[var(--border-subtle)] text-center space-y-2">
            <ShieldCheck className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
            <p className="text-xs font-medium text-[var(--text-primary)]">
              No hay puntos de restauración guardados aún.
            </p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-md mx-auto">
              Los puntos se crearán automáticamente cada vez que importes canciones, sincronices con GitHub o puedes crear uno manualmente arriba.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backupPoints.map((point) => {
              const isSelected = selectedBackup?.id === point.id;
              const dateObj = new Date(point.timestamp);
              const dateFormatted = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : point.timestamp;
              const reasonMeta = REASON_CONFIG[point.reason] || REASON_CONFIG.manual;

              return (
                <div
                  key={point.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-[var(--bg-surface-elevated)] border-[var(--accent-primary)] shadow-md'
                      : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${reasonMeta.badgeClass} font-semibold`}
                        >
                          {reasonMeta.label}
                        </span>
                        <span className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dateFormatted}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                          {point.songCount} {point.songCount === 1 ? 'canción' : 'canciones'}
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-[var(--text-primary)] break-words">
                        {point.name}
                      </h5>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRestoreBackup(point)}
                        title="Revertir todo el cancionero a este punto"
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revertir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDownloadBackupJson(point)}
                        title="Descargar snapshot como archivo JSON"
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer"
                      >
                        <FileJson className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectBackup(isSelected ? null : point)}
                        title="Ver lista de canciones contenidas en este snapshot"
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-primary)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteBackup(point.id)}
                        title="Eliminar este punto de restauración"
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
                        <span>Canciones en este snapshot ({point.songsSummary?.length || point.songCount}):</span>
                        <span>ID: {point.id.slice(0, 18)}</span>
                      </div>

                      <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 p-2 rounded-lg bg-[var(--bg-modal)] border border-[var(--border-subtle)]">
                        {point.songsSummary && point.songsSummary.length > 0 ? (
                          point.songsSummary.map((s) => (
                            <div
                              key={s.id}
                              className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] flex items-center gap-1.5"
                            >
                              <span className="font-medium text-[var(--text-primary)]">{s.title}</span>
                              {s.key && (
                                <span className="font-mono text-[10px] text-[var(--accent-primary)] font-semibold">
                                  [{s.key}]
                                </span>
                              )}
                              <span className="text-[10px] text-[var(--text-muted)]">
                                ({s.status === 'completed' ? 'final' : s.status === 'in_progress' ? 'en progreso' : 'borrador'})
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[var(--text-muted)] italic">
                            No hay desglose disponible para este punto antiguo.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
