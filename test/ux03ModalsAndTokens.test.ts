import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AccessibleModal,
  ConfirmDialog,
  getFocusableElements,
  useConfirmDialog,
  useDialogFocusManagement
} from '../src/components/modals';

const readFile = (relPath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf-8');

function walkSrc(dir: string): string[] {
  const entries = fs.readdirSync(path.resolve(process.cwd(), dir), { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkSrc(rel));
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      files.push(rel);
    }
  }
  return files;
}

describe('UX-03: Unified CSS design tokens & accessible dialogs replacing native confirm/alert', () => {
  describe('AccessibleModal and ConfirmDialog exports and focus helpers', () => {
    it('exports AccessibleModal, ConfirmDialog, useConfirmDialog, useDialogFocusManagement, and getFocusableElements', () => {
      assert.equal(typeof AccessibleModal, 'function');
      assert.equal(typeof ConfirmDialog, 'function');
      assert.equal(typeof useConfirmDialog, 'function');
      assert.equal(typeof useDialogFocusManagement, 'function');
      assert.equal(typeof getFocusableElements, 'function');
    });

    it('getFocusableElements safely returns [] for null containers and filters disabled/hidden/tabindex=-1 elements', () => {
      assert.deepEqual(getFocusableElements(null), []);

      const fakeButtonActive = {
        hasAttribute: () => false,
        getAttribute: () => null,
        tabIndex: 0
      };
      const fakeButtonDisabled = {
        hasAttribute: (attr: string) => attr === 'disabled',
        getAttribute: () => null,
        tabIndex: 0
      };
      const fakeAriaHidden = {
        hasAttribute: () => false,
        getAttribute: (attr: string) => (attr === 'aria-hidden' ? 'true' : null),
        tabIndex: 0
      };
      const fakeNegativeTab = {
        hasAttribute: () => false,
        getAttribute: () => null,
        tabIndex: -1
      };

      const fakeContainer = {
        querySelectorAll: () => [
          fakeButtonActive,
          fakeButtonDisabled,
          fakeAriaHidden,
          fakeNegativeTab
        ]
      } as unknown as HTMLElement;

      const result = getFocusableElements(fakeContainer);
      assert.equal(result.length, 1);
      assert.equal(result[0], fakeButtonActive as unknown as HTMLElement);
    });

    it('AccessibleModal implements role="dialog", aria-modal="true", focus trap, and Escape stack', () => {
      const modalSrc = readFile('src/components/modals/AccessibleModal.tsx');
      assert.ok(modalSrc.includes('role="dialog"'));
      assert.ok(modalSrc.includes('aria-modal="true"'));
      assert.ok(modalSrc.includes('openModalStack'));
      assert.ok(modalSrc.includes("e.key === 'Tab'"));
      assert.ok(modalSrc.includes("e.key === 'Escape'"));
      assert.ok(modalSrc.includes('restoreTarget.focus()'));
    });

    it('ConfirmDialog renders through AccessibleModal with semantic variants and focusable Cancel default for destructive actions', () => {
      const confirmSrc = readFile('src/components/modals/ConfirmDialog.tsx');
      assert.ok(confirmSrc.includes('<AccessibleModal'));
      assert.ok(confirmSrc.includes('initialFocusRef={initialFocusRef}'));
      assert.ok(confirmSrc.includes("variant === 'danger' || variant === 'warning' ? cancelButtonRef : confirmButtonRef"));
      assert.ok(confirmSrc.includes('--state-error-'));
      assert.ok(confirmSrc.includes('--state-warning-'));
    });
  });

  describe('No native window.confirm or window.alert dialogs remain in src/', () => {
    it('contains zero confirm()/window.confirm() or alert()/window.alert() calls in src/', () => {
      const files = walkSrc('src');
      const violations: string[] = [];

      for (const file of files) {
        const content = readFile(file);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const codeBeforeComment = line.split('//')[0];
          if (/\b(window\.)?(confirm|alert)\s*\(/.test(codeBeforeComment)) {
            violations.push(`${file}:${idx + 1}: ${line.trim()}`);
          }
        });
      }

      assert.deepEqual(violations, []);
    });

    it('replaces confirm flows in useAlbumsManager, AppModals, VersionHistory, GitSyncModal, and SongEditorPage', () => {
      const albumsHook = readFile('src/hooks/useAlbumsManager.ts');
      assert.ok(albumsHook.includes('pendingDeleteAlbum'));
      assert.ok(albumsHook.includes('confirmDeleteAlbum'));

      const appModals = readFile('src/components/modals/AppModals.tsx');
      assert.ok(appModals.includes('<ConfirmDialog'));

      const versionHistory = readFile('src/components/VersionHistory.tsx');
      assert.ok(versionHistory.includes('isRestoreConfirmOpen'));
      assert.ok(versionHistory.includes('<ConfirmDialog'));

      const gitSync = readFile('src/components/GitSyncModal.tsx');
      assert.ok(gitSync.includes('useConfirmDialog'));
      assert.ok(gitSync.includes('<ConfirmDialog'));

      const editorPage = readFile('src/pages/SongEditorPage.tsx');
      assert.ok(editorPage.includes('useConfirmDialog'));
      assert.ok(editorPage.includes('<ConfirmDialog'));
    });
  });

  describe('All modals expose accessible dialog semantics and focus management', () => {
    const accessibleModalBackedFiles = [
      'src/components/modals/ConfirmDialog.tsx',
      'src/components/DeleteSongModal.tsx',
      'src/components/RenameFileModal.tsx',
      'src/components/GitHubAuthModal.tsx',
      'src/components/KeyboardShortcutsModal.tsx',
      'src/components/SongwritingQuickStartModal.tsx',
      'src/components/SpotifyAlbumImportModal.tsx',
      'src/components/GitSyncModal.tsx',
      'src/components/VersionHistory.tsx',
      'src/components/SongVideoVisualizerModal.tsx',
      'src/components/Mp3MetadataComparisonModal.tsx',
      'src/components/LrcSyncAssistant.tsx',
      'src/components/ChromaticTunerModal.tsx',
      'src/components/SyncedLyrics.tsx',
      'src/components/editor/SongExportActions.tsx'
    ];

    it('wraps all application modal components in AccessibleModal', () => {
      for (const file of accessibleModalBackedFiles) {
        const content = readFile(file);
        assert.ok(
          content.includes('<AccessibleModal'),
          `${file} should render via <AccessibleModal>`
        );
      }
    });

    it('gives StageModeOverlay and MobileNavDrawer role="dialog", aria-modal="true", and focus management', () => {
      const stageSrc = readFile('src/components/StageModeOverlay.tsx');
      assert.ok(stageSrc.includes('role="dialog"'));
      assert.ok(stageSrc.includes('aria-modal="true"'));
      assert.ok(stageSrc.includes('useDialogFocusManagement'));

      const drawerSrc = readFile('src/components/layout/MobileNavDrawer.tsx');
      assert.ok(drawerSrc.includes('role="dialog"'));
      assert.ok(drawerSrc.includes('aria-modal="true"'));
      assert.ok(drawerSrc.includes('returnFocusRef'));
    });
  });

  describe('CSS design token unification across pages, modals, and dictionary views', () => {
    it('defines every var(--...) token used in src/ inside src/index.css', () => {
      const indexCss = readFile('src/index.css');
      const definedVars = new Set(
        Array.from(indexCss.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)).map((m) => m[1])
      );

      assert.ok(indexCss.includes('@custom-variant dark'));

      const files = walkSrc('src');
      const undefinedUsages: string[] = [];

      for (const file of files) {
        const content = readFile(file);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          for (const match of line.matchAll(/var\((--[a-zA-Z0-9_-]+)\)/g)) {
            if (!definedVars.has(match[1])) {
              undefinedUsages.push(`${file}:${idx + 1}: ${match[1]}`);
            }
          }
        });
      }

      assert.deepEqual(undefinedUsages, []);
    });

    it('eliminates hardcoded light/gray/blue theme classes from migrated dictionary pages and modals', () => {
      const migratedFiles = [
        'src/pages/ScaleDictionaryPage.tsx',
        'src/pages/ChordDictionaryDemoPage.tsx',
        'src/components/SpotifyAlbumImportModal.tsx',
        'src/components/KeyboardShortcutsModal.tsx',
        'src/components/BaseNoteSelector.tsx',
        'src/components/ScaleQuiz.tsx',
        'src/components/ScaleSuggestions.tsx',
        'src/components/ScaleFretboard.tsx',
        'src/components/AudioToScale.tsx',
        'src/components/Footer.tsx'
      ];

      for (const file of migratedFiles) {
        const content = readFile(file);
        assert.equal(
          /\b(bg-white|bg-gray-|dark:bg-gray-|bg-blue-600|bg-blue-50)\b/.test(content),
          false,
          `${file} should not use hardcoded bg-white/gray/blue-600 classes`
        );
      }
    });
  });
});
