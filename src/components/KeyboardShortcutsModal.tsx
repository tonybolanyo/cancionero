import React from 'react';
import { X } from 'lucide-react';
import { GLOBAL_SHORTCUTS, formatShortcutKey } from '../hooks/useKeyboardShortcuts';
import { AccessibleModal } from './modals/AccessibleModal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const categories = [
    {
      title: 'Gestión de Canciones',
      shortcuts: [
        GLOBAL_SHORTCUTS.newSong,
        GLOBAL_SHORTCUTS.save,
        GLOBAL_SHORTCUTS.publishSong,
      ],
    },
    {
      title: 'Navegación',
      shortcuts: [
        GLOBAL_SHORTCUTS.openSearch,
        GLOBAL_SHORTCUTS.closeModal,
      ],
    },
    {
      title: 'Apariencia',
      shortcuts: [
        GLOBAL_SHORTCUTS.toggleTheme,
      ],
    },
    {
      title: 'Sincronización',
      shortcuts: [
        GLOBAL_SHORTCUTS.toggleGitSync,
      ],
    },
    {
      title: 'Edición',
      shortcuts: [
        GLOBAL_SHORTCUTS.undo,
        GLOBAL_SHORTCUTS.redo,
      ],
    },
  ];

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      titleId="shortcuts-title"
      backdropClassName="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      panelClassName="bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-2xl shadow-[var(--modal-shadow)] max-w-2xl w-full max-h-[90vh] overflow-y-auto text-[var(--text-primary)]"
    >
      <div className="sticky top-0 bg-[var(--bg-modal)] border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between">
        <h2
          id="shortcuts-title"
          className="font-serif text-xl font-bold text-[var(--text-primary)]"
        >
          Atajos de Teclado
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer"
          aria-label="Cerrar"
          title="Cerrar (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-8 bg-[var(--bg-surface)]">
        {categories.map((category) => (
          <div key={category.title}>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
              {category.title}
            </h3>
            <div className="space-y-2">
              {category.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.description}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <span className="text-[var(--text-primary)]">
                    {shortcut.description}
                  </span>
                  <kbd className="px-3 py-1 text-sm font-mono bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded text-[var(--text-secondary)]">
                    {formatShortcutKey(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[var(--bg-surface-subtle)] border-t border-[var(--border-subtle)] px-6 py-4 text-sm text-[var(--text-secondary)]">
        <p>Presiona <kbd className="px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-xs font-mono">Esc</kbd> para cerrar este diálogo.</p>
      </div>
    </AccessibleModal>
  );
};
