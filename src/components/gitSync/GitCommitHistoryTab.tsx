import React from 'react';
import { GitCommit } from '../../types/song';

export interface GitCommitHistoryTabProps {
  commits: GitCommit[];
  selectedCommit: GitCommit | null;
  onSelectCommit: (commit: GitCommit | null) => void;
}

export const GitCommitHistoryTab: React.FC<GitCommitHistoryTabProps> = ({
  commits,
  selectedCommit,
  onSelectCommit
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[var(--bg-surface)]">
      <p className="text-xs text-[var(--text-muted)]">
        Historial de revisiones del cancionero. Haz clic en un commit para ver los archivos modificados.
      </p>

      <div className="space-y-2">
        {commits.map((c) => (
          <div
            key={c.hash}
            onClick={() => onSelectCommit(selectedCommit?.hash === c.hash ? null : c)}
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
                <span className="text-xs font-semibold text-[var(--text-primary)]">{c.message}</span>
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
                {c.filesChanged?.map((f) => (
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
  );
};
