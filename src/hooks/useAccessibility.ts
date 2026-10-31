import { useEffect, useRef, useCallback } from 'react';

export const useAccessibility = () => {
  const focusTrapRef = useRef<HTMLDivElement>(null);

  const setAriaLive = useCallback((
    element: HTMLElement,
    message: string,
    politeness: 'polite' | 'assertive' = 'polite'
  ) => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', politeness);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('role', 'status');
    liveRegion.textContent = message;
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    element.appendChild(liveRegion);

    setTimeout(() => {
      liveRegion.remove();
    }, 3000);
  }, []);

  const manageFocus = useCallback((element: HTMLElement | null) => {
    if (element) {
      const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }
  }, []);

  const trapFocus = useCallback((element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }, []);

  const skipLink = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return {
    focusTrapRef,
    setAriaLive,
    manageFocus,
    trapFocus,
    skipLink,
  };
};

export const createAccessibleButton = (
  onClick: () => void,
  label: string,
  ariaLabel?: string,
  disabled = false
) => ({
  role: 'button',
  tabIndex: disabled ? -1 : 0,
  'aria-label': ariaLabel || label,
  'aria-disabled': disabled,
  onClick,
  onKeyDown: (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onClick();
    }
  },
});
