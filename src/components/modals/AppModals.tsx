import React, { Suspense, lazy } from 'react';
import { Song } from '../../types/song';
import { PushResult } from '../../services/githubSyncService';
import { SONGWRITING_TEMPLATES } from '../../utils/songwriterHelper';
import { ToastData, GitNotificationToast } from '../GitNotificationToast';

// Lazy-loaded heavy modals so they stay out of the initial bundle
const GitHubAuthModal = lazy(() =>
  import('../GitHubAuthModal').then((m) => ({ default: m.GitHubAuthModal }))
);
const RenameFileModal = lazy(() =>
  import('../RenameFileModal').then((m) => ({ default: m.RenameFileModal }))
);
const DeleteSongModal = lazy(() =>
  import('../DeleteSongModal').then((m) => ({ default: m.DeleteSongModal }))
);
const VersionHistory = lazy(() =>
  import('../VersionHistory').then((m) => ({ default: m.VersionHistory }))
);
const KeyboardShortcutsModal = lazy(() =>
  import('../KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal }))
);
const SongwritingQuickStartModal = lazy(() =>
  import('../SongwritingQuickStartModal').then((m) => ({ default: m.SongwritingQuickStartModal }))
);
const SongVideoVisualizerModal = lazy(() =>
  import('../SongVideoVisualizerModal').then((m) => ({ default: m.SongVideoVisualizerModal }))
);

export interface AppModalsProps {
  // Auth Modal
  isAuthModalOpen: boolean;
  onCloseAuthModal: () => void;

  // Version History
  isHistoryModalOpen: boolean;
  historySong: Song | null;
  onCloseHistoryModal: () => void;
  onSongRestored: (song: Song, pushResult?: PushResult) => void;
  isAuthor: boolean;

  // Rename Song
  isRenameModalOpen: boolean;
  renamingSong: Song | null;
  onCloseRenameModal: () => void;
  onRenameSuccess: (renamedSong: Song, updatedSongs: Song[], pushResult?: PushResult) => void;

  // Delete Song
  isDeleteModalOpen: boolean;
  deletingSong: Song | null;
  onCloseDeleteModal: () => void;
  onDeleteSuccess: (deletedSong: Song, updatedSongs: Song[], pushResult?: PushResult) => void;

  // Keyboard Shortcuts
  isKeyboardShortcutsOpen: boolean;
  onCloseKeyboardShortcuts: () => void;

  // Quick Start
  isQuickStartOpen: boolean;
  onCloseQuickStart: () => void;
  onStartWithLyrics: () => void;
  onStartWithAudioFile: (file: File) => void;
  onStartWithTemplate: (template: typeof SONGWRITING_TEMPLATES[0]) => void;

  // Git Notification Toast
  gitToast: ToastData | null;
  onDismissGitToast: () => void;

  // Video Visualizer
  isVisualizerModalOpen: boolean;
  visualizerSong: Song | null;
  songs: Song[];
  onSelectOtherSong: (song: Song) => void;
  onCloseVisualizer: () => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  isAuthModalOpen,
  onCloseAuthModal,

  isHistoryModalOpen,
  historySong,
  onCloseHistoryModal,
  onSongRestored,
  isAuthor,

  isRenameModalOpen,
  renamingSong,
  onCloseRenameModal,
  onRenameSuccess,

  isDeleteModalOpen,
  deletingSong,
  onCloseDeleteModal,
  onDeleteSuccess,

  isKeyboardShortcutsOpen,
  onCloseKeyboardShortcuts,

  isQuickStartOpen,
  onCloseQuickStart,
  onStartWithLyrics,
  onStartWithAudioFile,
  onStartWithTemplate,

  gitToast,
  onDismissGitToast,

  isVisualizerModalOpen,
  visualizerSong,
  songs,
  onSelectOtherSong,
  onCloseVisualizer
}) => {
  return (
    <>
      <Suspense fallback={null}>
        {isAuthModalOpen && (
          <GitHubAuthModal
            isOpen={isAuthModalOpen}
            onClose={onCloseAuthModal}
          />
        )}

        {isHistoryModalOpen && historySong && (
          <VersionHistory
            song={historySong}
            isOpen={isHistoryModalOpen}
            onClose={onCloseHistoryModal}
            onRestoreSong={onSongRestored}
            isAuthor={isAuthor}
          />
        )}

        {isRenameModalOpen && renamingSong && (
          <RenameFileModal
            song={renamingSong}
            isOpen={isRenameModalOpen}
            onClose={onCloseRenameModal}
            onRenameSuccess={onRenameSuccess}
          />
        )}

        {isDeleteModalOpen && deletingSong && (
          <DeleteSongModal
            song={deletingSong}
            isOpen={isDeleteModalOpen}
            onClose={onCloseDeleteModal}
            onDeleteSuccess={onDeleteSuccess}
          />
        )}

        {isKeyboardShortcutsOpen && (
          <KeyboardShortcutsModal
            isOpen={isKeyboardShortcutsOpen}
            onClose={onCloseKeyboardShortcuts}
          />
        )}

        {isQuickStartOpen && (
          <SongwritingQuickStartModal
            isOpen={isQuickStartOpen}
            onClose={onCloseQuickStart}
            onStartWithLyrics={onStartWithLyrics}
            onStartWithAudioFile={onStartWithAudioFile}
            onStartWithTemplate={onStartWithTemplate}
          />
        )}

        {isVisualizerModalOpen && visualizerSong && (
          <SongVideoVisualizerModal
            song={visualizerSong}
            allSongs={songs}
            onSelectOtherSong={onSelectOtherSong}
            onClose={onCloseVisualizer}
          />
        )}
      </Suspense>

      <GitNotificationToast
        toast={gitToast}
        onDismiss={onDismissGitToast}
      />
    </>
  );
};
