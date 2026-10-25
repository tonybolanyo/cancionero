import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, ExternalLink, X, KeyRound, UploadCloud } from 'lucide-react';

export interface ToastData {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  commitHash?: string;
  commitUrl?: string;
  targetRepo?: string;
  requiresPermissions?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface GitNotificationToastProps {
  toast: ToastData | null;
  onDismiss: () => void;
}

export const GitNotificationToast: React.FC<GitNotificationToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;

    // Default duration: 8s for warnings/errors (gives time to read), 6s for success
    const duration = toast.durationMs || (toast.type === 'success' ? 6000 : 9000);
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const getBorderAndBg = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-[var(--bg-modal)] border-emerald-500/40 text-[var(--text-primary)] shadow-emerald-500/10';
      case 'warning':
        return 'bg-[var(--bg-modal)] border-amber-500/40 text-[var(--text-primary)] shadow-amber-500/10';
      case 'error':
        return 'bg-[var(--bg-modal)] border-red-500/40 text-[var(--text-primary)] shadow-red-500/10';
      default:
        return 'bg-[var(--bg-modal)] border-[var(--border-subtle)] text-[var(--text-primary)]';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-slideUp pointer-events-auto">
      <div
        className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-md transition-all flex items-start gap-3.5 ${getBorderAndBg()}`}
        role="alert"
      >
        {getIcon()}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-serif font-bold text-sm tracking-tight text-[var(--text-primary)] flex items-center gap-1.5">
              <span>{toast.title}</span>
              {toast.commitHash && (
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary)] font-semibold">
                  {toast.commitHash}
                </span>
              )}
            </h4>
            <button
              onClick={onDismiss}
              className="p-1 -mr-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
              title="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed select-text">
            {toast.message}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {toast.commitUrl && (
              <a
                href={toast.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] hover:opacity-80 font-medium transition-opacity"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Ver en GitHub</span>
              </a>
            )}

            {toast.requiresPermissions && toast.onAction && (
              <button
                onClick={() => {
                  toast.onAction?.();
                  onDismiss();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-medium transition-colors cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>{toast.actionLabel || 'Cambiar permisos del token'}</span>
              </button>
            )}

            {toast.targetRepo && !toast.commitUrl && (
              <span className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                <UploadCloud className="w-3 h-3" />
                <span>{toast.targetRepo}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
