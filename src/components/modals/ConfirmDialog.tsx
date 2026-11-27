import React, { useCallback, useId, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, ShieldAlert, X } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';

export type ConfirmDialogVariant = 'default' | 'warning' | 'danger';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  zIndexClass?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  isProcessing = false,
  onConfirm,
  onCancel,
  zIndexClass = 'z-[70]'
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const initialFocusRef =
    variant === 'danger' || variant === 'warning' ? cancelButtonRef : confirmButtonRef;

  const iconContainerClass =
    variant === 'danger'
      ? 'bg-[var(--state-error-bg)] text-[var(--state-error-text)] border-[var(--state-error-border)]'
      : variant === 'warning'
      ? 'bg-[var(--state-warning-bg)] text-[var(--state-warning-text)] border-[var(--state-warning-border)]'
      : 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]';

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-hover-bg)] text-[var(--button-primary-text)]';

  const renderIcon = () => {
    if (variant === 'danger') return <ShieldAlert className="w-5 h-5" aria-hidden="true" />;
    if (variant === 'warning') return <AlertTriangle className="w-5 h-5" aria-hidden="true" />;
    return <HelpCircle className="w-5 h-5" aria-hidden="true" />;
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={isProcessing ? () => {} : onCancel}
      titleId={titleId}
      ariaDescribedBy={descriptionId}
      closeOnBackdropClick={!isProcessing}
      closeOnEscape={!isProcessing}
      initialFocusRef={initialFocusRef}
      zIndexClass={zIndexClass}
      panelClassName="relative w-full max-w-md rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-[var(--modal-shadow)] overflow-hidden text-[var(--text-primary)] transition-colors duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/60">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconContainerClass}`}
          >
            {renderIcon()}
          </div>
          <h3 id={titleId} className="font-serif text-base sm:text-lg font-bold text-[var(--text-primary)] leading-snug">
            {title}
          </h3>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          aria-label="Cerrar diálogo"
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer disabled:opacity-40 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 bg-[var(--bg-modal)]">
        <div
          id={descriptionId}
          className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line"
        >
          {message}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] border border-[var(--button-secondary-border)] hover:bg-[var(--button-secondary-hover-bg)] transition-colors cursor-pointer disabled:opacity-50"
        >
          {cancelLabel}
        </button>

        <button
          ref={confirmButtonRef}
          type="button"
          onClick={onConfirm}
          disabled={isProcessing}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2 ${confirmButtonClass}`}
        >
          {isProcessing && (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          <span>{confirmLabel}</span>
        </button>
      </div>
    </AccessibleModal>
  );
};

export interface ConfirmRequestOptions {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void | Promise<void>;
}

export function useConfirmDialog() {
  const [state, setState] = useState<(ConfirmRequestOptions & { isOpen: boolean }) | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const requestConfirm = useCallback((options: ConfirmRequestOptions) => {
    setState({ ...options, isOpen: true });
  }, []);

  const closeConfirm = useCallback(() => {
    if (isProcessing) return;
    setState(null);
  }, [isProcessing]);

  const handleConfirm = useCallback(async () => {
    if (!state) return;
    try {
      setIsProcessing(true);
      await state.onConfirm();
      setState(null);
    } finally {
      setIsProcessing(false);
    }
  }, [state]);

  const confirmDialogProps: ConfirmDialogProps = {
    isOpen: Boolean(state?.isOpen),
    title: state?.title || '',
    message: state?.message || '',
    confirmLabel: state?.confirmLabel,
    cancelLabel: state?.cancelLabel,
    variant: state?.variant,
    isProcessing,
    onConfirm: handleConfirm,
    onCancel: closeConfirm
  };

  return {
    requestConfirm,
    closeConfirm,
    confirmDialogProps
  };
}
