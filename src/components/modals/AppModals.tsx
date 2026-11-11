import React from 'react';
import { Song } from '../../types/song';
import { PushResult } from '../../services/githubSyncService';
import { SONGWRITING_TEMPLATES } from '../../utils/songwriterHelper';
import { ToastData, GitNotificationToast } from '../GitNotificationToast';
import { GitHubAuthModal } from '../GitHubAuthModal';
import { RenameFileModal } from '../RenameFileModal';
import { DeleteSongModal } from '../DeleteSongModal';
import { VersionHistory } from '../VersionHistory';
import { KeyboardShortcutsModal } from '../KeyboardShortcutsModal';
import { SongwritingQuickStartModal } from '../SongwritingQuickStartModal';
import { SongVideoVisualizerModal } from '../SongVideoVisualizerModal';

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

      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsOpen}
        onClose={onCloseKeyboardShortcuts}
      />

      <SongwritingQuickStartModal
        isOpen={isQuickStartOpen}
        onClose={onCloseQuickStart}
        onStartWithLyrics={onStartWithLyrics}
        onStartWithAudioFile={onStartWithAudioFile}
        onStartWithTemplate={onStartWithTemplate}
      />

      <GitNotificationToast
        toast={gitToast}
        onDismiss={onDismissGitToast}
      />

      {isVisualizerModalOpen && visualizerSong && (
        <SongVideoVisualizerModal
          song={visualizerSong}
          allSongs={songs}
          onSelectOtherSong={onSelectOtherSong}
          onClose={onCloseVisualizer}
        />
      )}
    </>
  );
};
