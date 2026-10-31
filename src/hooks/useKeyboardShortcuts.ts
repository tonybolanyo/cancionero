import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  callback: () => void;
  description: string;
}

const SHORTCUTS: Record<string, KeyboardShortcut> = {};

export const useKeyboardShortcuts = () => {
  const register = useCallback((id: string, shortcut: KeyboardShortcut) => {
    SHORTCUTS[id] = shortcut;
  }, []);

  const unregister = useCallback((id: string) => {
    delete SHORTCUTS[id];
  }, []);

  const getShortcuts = useCallback(() => Object.values(SHORTCUTS), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of Object.values(SHORTCUTS)) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = (shortcut.ctrlKey ?? false) === (e.ctrlKey || e.metaKey);
        const shiftMatch = (shortcut.shiftKey ?? false) === e.shiftKey;
        const altMatch = (shortcut.altKey ?? false) === e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.callback();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { register, unregister, getShortcuts };
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
