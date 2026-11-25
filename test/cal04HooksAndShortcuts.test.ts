import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isEditableTarget,
  dispatchKeyboardShortcuts,
  SHORTCUT_PRIORITY,
  KeyboardShortcut,
} from '../src/hooks/useKeyboardShortcuts';

describe('CAL-04: Hooks rules, listener cleanup & keyboard shortcut priorities', () => {
  describe('isEditableTarget', () => {
    it('returns true for INPUT, TEXTAREA, SELECT elements (case-insensitive)', () => {
      assert.equal(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget), true);
      assert.equal(isEditableTarget({ tagName: 'textarea' } as unknown as EventTarget), true);
      assert.equal(isEditableTarget({ tagName: 'SELECT' } as unknown as EventTarget), true);
    });

    it('returns true for contentEditable elements and descendants', () => {
      assert.equal(
        isEditableTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
        true
      );
      assert.equal(
        isEditableTarget({
          tagName: 'DIV',
          getAttribute: (name: string) => (name === 'contenteditable' ? 'true' : null),
        } as unknown as EventTarget),
        true
      );
      assert.equal(
        isEditableTarget({
          tagName: 'SPAN',
          closest: () => ({}),
        } as unknown as EventTarget),
        true
      );
    });

    it('returns false for non-editable targets and null', () => {
      assert.equal(isEditableTarget(null), false);
      assert.equal(
        isEditableTarget({
          tagName: 'DIV',
          isContentEditable: false,
          getAttribute: () => null,
          closest: () => null,
        } as unknown as EventTarget),
        false
      );
      assert.equal(
        isEditableTarget({ tagName: 'BUTTON', isContentEditable: false } as unknown as EventTarget),
        false
      );
    });
  });

  describe('dispatchKeyboardShortcuts editable filtering', () => {
    it('ignores shortcuts triggered inside INPUT, TEXTAREA, SELECT and contentEditable by default', () => {
      let called = 0;
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'n',
          ctrlKey: true,
          description: 'New song',
          callback: () => {
            called++;
          },
        },
        {
          key: 'Escape',
          description: 'Close modal',
          callback: () => {
            called++;
          },
        },
      ];

      const targets = [
        { tagName: 'INPUT' },
        { tagName: 'TEXTAREA' },
        { tagName: 'SELECT' },
        { tagName: 'DIV', isContentEditable: true },
      ];

      for (const target of targets) {
        let prevented = false;
        const handledN = dispatchKeyboardShortcuts(shortcuts, {
          key: 'n',
          ctrlKey: true,
          target: target as unknown as EventTarget,
          preventDefault: () => {
            prevented = true;
          },
        });
        assert.equal(handledN, false);
        assert.equal(prevented, false);

        const handledEsc = dispatchKeyboardShortcuts(shortcuts, {
          key: 'Escape',
          target: target as unknown as EventTarget,
          preventDefault: () => {
            prevented = true;
          },
        });
        assert.equal(handledEsc, false);
        assert.equal(prevented, false);
      }

      assert.equal(called, 0);
    });

    it('executes shortcuts when target is non-editable and prevents default', () => {
      let called = 0;
      let prevented = false;
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'n',
          ctrlKey: true,
          description: 'New song',
          callback: () => {
            called++;
          },
        },
      ];

      const handled = dispatchKeyboardShortcuts(shortcuts, {
        key: 'n',
        ctrlKey: true,
        target: { tagName: 'BODY' } as unknown as EventTarget,
        preventDefault: () => {
          prevented = true;
        },
      });

      assert.equal(handled, true);
      assert.equal(called, 1);
      assert.equal(prevented, true);
    });
  });

  describe('Escape priority resolution (active modal > overlay > back navigation)', () => {
    it('executes active modal before overlay and navigation regardless of registration order', () => {
      const log: string[] = [];
      let modalOpen = true;
      let overlayOpen = true;

      // Intentionally register lowest priority first to prove sorting works
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'Escape',
          priority: SHORTCUT_PRIORITY.NAVIGATION,
          description: 'Go back',
          when: () => !modalOpen && !overlayOpen,
          callback: () => {
            log.push('navigation');
          },
        },
        {
          key: 'Escape',
          priority: SHORTCUT_PRIORITY.OVERLAY,
          description: 'Close stage overlay',
          when: () => overlayOpen,
          callback: () => {
            log.push('overlay');
            overlayOpen = false;
          },
        },
        {
          key: 'Escape',
          priority: SHORTCUT_PRIORITY.MODAL,
          description: 'Close active modal',
          when: () => modalOpen,
          callback: () => {
            log.push('modal');
            modalOpen = false;
          },
        },
      ];

      const nonEditable = { tagName: 'DIV' } as unknown as EventTarget;

      // 1st Escape: closes modal only
      let stopImmediate = 0;
      dispatchKeyboardShortcuts(shortcuts, {
        key: 'Escape',
        target: nonEditable,
        preventDefault: () => {},
        stopImmediatePropagation: () => {
          stopImmediate++;
        },
      });
      assert.deepEqual(log, ['modal']);
      assert.equal(stopImmediate, 1);

      // 2nd Escape: closes overlay only
      dispatchKeyboardShortcuts(shortcuts, {
        key: 'Escape',
        target: nonEditable,
        preventDefault: () => {},
        stopImmediatePropagation: () => {
          stopImmediate++;
        },
      });
      assert.deepEqual(log, ['modal', 'overlay']);
      assert.equal(stopImmediate, 2);

      // 3rd Escape: triggers back navigation
      dispatchKeyboardShortcuts(shortcuts, {
        key: 'Escape',
        target: nonEditable,
        preventDefault: () => {},
        stopImmediatePropagation: () => {
          stopImmediate++;
        },
      });
      assert.deepEqual(log, ['modal', 'overlay', 'navigation']);
      assert.equal(stopImmediate, 3);
    });

    it('falls through when higher-priority callback returns false and respects defaultPrevented', () => {
      const log: string[] = [];
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'Escape',
          priority: SHORTCUT_PRIORITY.MODAL,
          description: 'Modal noop',
          callback: () => false,
        },
        {
          key: 'Escape',
          priority: SHORTCUT_PRIORITY.NAVIGATION,
          description: 'Back',
          callback: () => {
            log.push('navigation');
          },
        },
      ];

      dispatchKeyboardShortcuts(shortcuts, {
        key: 'Escape',
        target: { tagName: 'BODY' } as unknown as EventTarget,
        preventDefault: () => {},
      });
      assert.deepEqual(log, ['navigation']);

      dispatchKeyboardShortcuts(shortcuts, {
        key: 'Escape',
        target: { tagName: 'BODY' } as unknown as EventTarget,
        defaultPrevented: true,
        preventDefault: () => {},
      });
      assert.deepEqual(log, ['navigation']);
    });
  });

  describe('Static React hook & listener invariants', () => {
    it('SongVideoVisualizerModal has no conditional return null before hooks', () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/SongVideoVisualizerModal.tsx'),
        'utf-8'
      );
      const returnNullIdx = src.indexOf('return null;');
      const lastHookIdx = Math.max(
        src.lastIndexOf('useState('),
        src.lastIndexOf('useState<'),
        src.lastIndexOf('useMemo('),
        src.lastIndexOf('useMemo<'),
        src.lastIndexOf('useCallback('),
        src.lastIndexOf('useEffect('),
        src.lastIndexOf('useRef('),
        src.lastIndexOf('useRef<')
      );
      assert.ok(returnNullIdx > -1, 'Expected return null guard in SongVideoVisualizerModal');
      assert.ok(lastHookIdx > -1, 'Expected React hooks in SongVideoVisualizerModal');
      assert.ok(
        returnNullIdx > lastHookIdx,
        'Conditional return null must appear after all React hooks'
      );
    });

    it('useKeyboardShortcuts does not define a module-level mutable SHORTCUTS singleton', () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), 'src/hooks/useKeyboardShortcuts.ts'),
        'utf-8'
      );
      assert.equal(/const\s+SHORTCUTS\s*:/.test(src), false);
    });

    it('SongEditorPage keydown useEffect has an explicit dependency array', () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), 'src/pages/SongEditorPage.tsx'),
        'utf-8'
      );
      const match = src.match(
        /window\.addEventListener\('keydown',\s*handleKeyDown\);[\s\S]*?return\s*\(\)\s*=>\s*window\.removeEventListener\('keydown',\s*handleKeyDown\);\s*\},\s*\[[^\]]+\]\)/
      );
      assert.ok(match, 'SongEditorPage keydown useEffect must specify an explicit dependency array');
    });

    it('SongDetailPage memoizes togglePlayAudio and includes it in keydown dependencies', () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), 'src/pages/SongDetailPage.tsx'),
        'utf-8'
      );
      assert.ok(
        /const\s+togglePlayAudio\s*=\s*useCallback\(/.test(src),
        'togglePlayAudio should be memoized with useCallback'
      );
      const match = src.match(
        /window\.addEventListener\('keydown',\s*handleKeyDown\);[\s\S]*?return\s*\(\)\s*=>\s*window\.removeEventListener\('keydown',\s*handleKeyDown\);\s*\},\s*\[[^\]]*togglePlayAudio[^\]]*\]\)/
      );
      assert.ok(match, 'SongDetailPage keydown useEffect must depend on togglePlayAudio');
    });
  });
});
