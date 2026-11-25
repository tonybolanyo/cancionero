import React, { createContext, useContext, useEffect, useCallback, useRef, useMemo } from 'react';

export const SHORTCUT_PRIORITY = {
  MODAL: 300,
  OVERLAY: 200,
  NAVIGATION: 100,
  DEFAULT: 0,
} as const;

export type ShortcutPriority = (typeof SHORTCUT_PRIORITY)[keyof typeof SHORTCUT_PRIORITY] | number;

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  callback: () => boolean | void;
  description: string;
  priority?: ShortcutPriority;
  when?: () => boolean;
  allowInEditable?: boolean;
}

export interface KeyboardShortcutsContextValue {
  register: (id: string, shortcut: KeyboardShortcut) => void;
  unregister: (id: string) => void;
  getShortcuts: () => KeyboardShortcut[];
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
    getAttribute?: (name: string) => string | null;
    closest?: (selector: string) => unknown;
  };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (el.isContentEditable === true) {
    return true;
  }
  if (typeof el.getAttribute === 'function') {
    const contentEditable = el.getAttribute('contenteditable');
    if (contentEditable === '' || contentEditable === 'true' || contentEditable === 'plaintext-only') {
      return true;
    }
  }
  if (
    typeof el.closest === 'function' &&
    el.closest('[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')
  ) {
    return true;
  }
  return false;
}

export function hasActiveModalDialog(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.body?.dataset?.modalOpen === 'true') {
    return true;
  }
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
}

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  target: EventTarget | null;
  defaultPrevented?: boolean;
  preventDefault: () => void;
  stopImmediatePropagation?: () => void;
}

export function dispatchKeyboardShortcuts(
  shortcuts: Iterable<KeyboardShortcut>,
  e: ShortcutKeyEvent
): boolean {
  if (e.defaultPrevented) {
    return false;
  }

  const eventKey = typeof e.key === 'string' ? e.key.toLowerCase() : '';
  if (!eventKey) {
    return false;
  }

  const editable = isEditableTarget(e.target);
  const candidates: KeyboardShortcut[] = [];

  for (const shortcut of shortcuts) {
    if (editable && !shortcut.allowInEditable) {
      continue;
    }

    const keyMatch = eventKey === shortcut.key.toLowerCase();
    const ctrlMatch = (shortcut.ctrlKey ?? false) === Boolean(e.ctrlKey || e.metaKey);
    const shiftMatch = (shortcut.shiftKey ?? false) === Boolean(e.shiftKey);
    const altMatch = (shortcut.altKey ?? false) === Boolean(e.altKey);

    if (!keyMatch || !ctrlMatch || !shiftMatch || !altMatch) {
      continue;
    }

    if (shortcut.when && !shortcut.when()) {
      continue;
    }

    candidates.push(shortcut);
  }

  if (candidates.length === 0) {
    return false;
  }

  // Higher priority executes first: active modal (300) > overlay (200) > navigation (100) > default (0)
  candidates.sort(
    (a, b) => (b.priority ?? SHORTCUT_PRIORITY.DEFAULT) - (a.priority ?? SHORTCUT_PRIORITY.DEFAULT)
  );

  for (const shortcut of candidates) {
    const result = shortcut.callback();
    if (result !== false) {
      e.preventDefault();
      if (eventKey === 'escape' && typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      return true;
    }
  }

  return false;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shortcutsRef = useRef<Map<string, KeyboardShortcut>>(new Map());

  const register = useCallback((id: string, shortcut: KeyboardShortcut) => {
    shortcutsRef.current.set(id, shortcut);
  }, []);

  const unregister = useCallback((id: string) => {
    shortcutsRef.current.delete(id);
  }, []);

  const getShortcuts = useCallback(() => Array.from(shortcutsRef.current.values()), []);

  useEffect(() => {
    const shortcuts = shortcutsRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      dispatchKeyboardShortcuts(shortcuts.values(), e);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      shortcuts.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ register, unregister, getShortcuts }),
    [register, unregister, getShortcuts]
  );

  return React.createElement(KeyboardShortcutsContext.Provider, { value }, children);
};

export const useKeyboardShortcuts = (): KeyboardShortcutsContextValue => {
  const ctx = useContext(KeyboardShortcutsContext);
  const localShortcutsRef = useRef<Map<string, KeyboardShortcut>>(new Map());

  const localRegister = useCallback((id: string, shortcut: KeyboardShortcut) => {
    localShortcutsRef.current.set(id, shortcut);
  }, []);

  const localUnregister = useCallback((id: string) => {
    localShortcutsRef.current.delete(id);
  }, []);

  const localGetShortcuts = useCallback(
    () => Array.from(localShortcutsRef.current.values()),
    []
  );

  useEffect(() => {
    if (ctx) return;

    const shortcuts = localShortcutsRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      dispatchKeyboardShortcuts(shortcuts.values(), e);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      shortcuts.clear();
    };
  }, [ctx]);

  if (ctx) {
    return ctx;
  }

  return {
    register: localRegister,
    unregister: localUnregister,
    getShortcuts: localGetShortcuts,
  };
};

export const GLOBAL_SHORTCUTS = {
  newSong: {
    key: 'n',
    ctrlKey: true,
    description: 'Crear nueva canción',
  },
  openSearch: {
    key: '/',
    description: 'Abrir búsqueda',
  },
  toggleTheme: {
    key: 't',
    ctrlKey: true,
    description: 'Cambiar tema',
  },
  toggleGitSync: {
    key: 'g',
    ctrlKey: true,
    description: 'Sincronizar con Git',
  },
  showKeyboardShortcuts: {
    key: '?',
    shiftKey: true,
    description: 'Mostrar atajos de teclado',
  },
  closeModal: {
    key: 'Escape',
    description: 'Cerrar modal',
    priority: SHORTCUT_PRIORITY.MODAL,
  },
  undo: {
    key: 'z',
    ctrlKey: true,
    description: 'Deshacer',
  },
  redo: {
    key: 'z',
    ctrlKey: true,
    shiftKey: true,
    description: 'Rehacer',
  },
  save: {
    key: 's',
    ctrlKey: true,
    description: 'Guardar',
  },
  publishSong: {
    key: 'p',
    ctrlKey: true,
    shiftKey: true,
    description: 'Publicar canción',
  },
};

export const formatShortcutKey = (shortcut: typeof GLOBAL_SHORTCUTS[keyof typeof GLOBAL_SHORTCUTS]): string => {
  const parts: string[] = [];
  if ('ctrlKey' in shortcut && shortcut.ctrlKey) parts.push('Ctrl');
  if ('shiftKey' in shortcut && shortcut.shiftKey) parts.push('Shift');
  if ('altKey' in shortcut && shortcut.altKey) parts.push('Alt');

  const key = shortcut.key === 'Escape' ? 'Esc' : shortcut.key.toUpperCase();
  parts.push(key);

  return parts.join('+');
};
