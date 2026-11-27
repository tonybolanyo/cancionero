import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

// Track stacked open dialogs so nested modals (e.g. ConfirmDialog over a modal)
// trap focus and handle Escape strictly for the topmost active dialog.
const openModalStack: symbol[] = [];
let scrollLockCount = 0;
let previousBodyOverflow: string | null = null;

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.tabIndex < 0) return false;
    return true;
  });
}

export interface UseDialogFocusManagementOptions {
  isOpen: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
  onClose?: () => void;
  closeOnEscape?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  lockBodyScroll?: boolean;
}

export function useDialogFocusManagement({
  isOpen,
  panelRef,
  onClose,
  closeOnEscape = true,
  initialFocusRef,
  returnFocusRef,
  lockBodyScroll = true
}: UseDialogFocusManagementOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closeOnEscapeRef = useRef(closeOnEscape);
  closeOnEscapeRef.current = closeOnEscape;

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const modalId = Symbol('accessible-modal');
    openModalStack.push(modalId);

    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (lockBodyScroll && document.body) {
      if (scrollLockCount === 0) {
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
      scrollLockCount += 1;
    }

    const focusTimer = window.setTimeout(() => {
      if (openModalStack[openModalStack.length - 1] !== modalId) return;
      const panel = panelRef.current;
      if (!panel) return;

      const requestedInitial = initialFocusRef?.current;
      if (requestedInitial && panel.contains(requestedInitial)) {
        requestedInitial.focus();
        return;
      }

      const focusables = getFocusableElements(panel);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (openModalStack[openModalStack.length - 1] !== modalId) return;

      if (e.key === 'Escape' && closeOnEscapeRef.current) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        onCloseRef.current?.();
        return;
      }

      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;

        const focusables = getFocusableElements(panel);
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || !panel.contains(active) || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || !panel.contains(active) || active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);

      const idx = openModalStack.lastIndexOf(modalId);
      if (idx !== -1) {
        openModalStack.splice(idx, 1);
      }

      if (lockBodyScroll && document.body) {
        scrollLockCount = Math.max(0, scrollLockCount - 1);
        if (scrollLockCount === 0) {
          document.body.style.overflow = previousBodyOverflow ?? '';
          previousBodyOverflow = null;
        }
      }

      const restoreTarget = returnFocusRef?.current || previouslyFocused;
      if (
        restoreTarget &&
        typeof restoreTarget.focus === 'function' &&
        document.contains(restoreTarget)
      ) {
        restoreTarget.focus();
      }
    };
  }, [isOpen, panelRef, initialFocusRef, returnFocusRef, lockBodyScroll]);
}

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  titleId?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  zIndexClass?: string;
  backdropClassName?: string;
  panelClassName?: string;
  usePortal?: boolean;
  lockBodyScroll?: boolean;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  isOpen,
  onClose,
  children,
  titleId,
  ariaLabel,
  ariaDescribedBy,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  initialFocusRef,
  returnFocusRef,
  zIndexClass = 'z-50',
  backdropClassName,
  panelClassName,
  usePortal = true,
  lockBodyScroll = true
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fallbackTitleId = useId();
  const mouseDownOnBackdropRef = useRef(false);

  useDialogFocusManagement({
    isOpen,
    panelRef,
    onClose,
    closeOnEscape,
    initialFocusRef,
    returnFocusRef,
    lockBodyScroll
  });

  if (!isOpen) return null;

  const resolvedBackdropClass =
    backdropClassName ||
    `fixed inset-0 ${zIndexClass} flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn`;

  const resolvedPanelClass =
    panelClassName ||
    'relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-subtle)] shadow-[var(--modal-shadow)] text-[var(--text-primary)] overflow-hidden transition-colors duration-200';

  const modalNode = (
    <div
      className={resolvedBackdropClass}
      onMouseDown={(e) => {
        mouseDownOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (closeOnBackdropClick && mouseDownOnBackdropRef.current && e.target === e.currentTarget) {
          onClose();
        }
        mouseDownOnBackdropRef.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId || fallbackTitleId}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={resolvedPanelClass}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (usePortal && typeof document !== 'undefined' && document.body) {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
};
