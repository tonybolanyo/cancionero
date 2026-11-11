import { useState, useCallback } from 'react';
import { Song } from '../types/song';
import { ToastData } from '../components/GitNotificationToast';

export function useAppModals() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isQuickStartOpen, setIsQuickStartOpen] = useState<boolean>(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState<boolean>(false);
  const [historySong, setHistorySong] = useState<Song | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [renamingSong, setRenamingSong] = useState<Song | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [deletingSong, setDeletingSong] = useState<Song | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [visualizerSong, setVisualizerSong] = useState<Song | null>(null);
  const [isVisualizerModalOpen, setIsVisualizerModalOpen] = useState<boolean>(false);
  const [gitToast, setGitToast] = useState<ToastData | null>(null);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const openQuickStart = useCallback(() => setIsQuickStartOpen(true), []);
  const closeQuickStart = useCallback(() => setIsQuickStartOpen(false), []);

  const openKeyboardShortcuts = useCallback(() => setIsKeyboardShortcutsOpen(true), []);
  const closeKeyboardShortcuts = useCallback(() => setIsKeyboardShortcutsOpen(false), []);

  const openHistory = useCallback((song: Song) => {
    setHistorySong(song);
    setIsHistoryModalOpen(true);
  }, []);
  const closeHistory = useCallback(() => {
    setIsHistoryModalOpen(false);
    setHistorySong(null);
  }, []);

  const openRename = useCallback((song: Song) => {
    setRenamingSong(song);
    setIsRenameModalOpen(true);
  }, []);
  const closeRename = useCallback(() => {
    setIsRenameModalOpen(false);
    setRenamingSong(null);
  }, []);

  const openDelete = useCallback((song: Song) => {
    setDeletingSong(song);
    setIsDeleteModalOpen(true);
  }, []);
  const closeDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
    setDeletingSong(null);
  }, []);

  const openVisualizer = useCallback((song: Song) => {
    setVisualizerSong(song);
    setIsVisualizerModalOpen(true);
  }, []);
  const closeVisualizer = useCallback(() => {
    setIsVisualizerModalOpen(false);
    setVisualizerSong(null);
  }, []);

  const closeAllModals = useCallback(() => {
    if (isHistoryModalOpen) closeHistory();
    if (isRenameModalOpen) closeRename();
    if (isDeleteModalOpen) closeDelete();
    if (isAuthModalOpen) closeAuthModal();
    if (isKeyboardShortcutsOpen) closeKeyboardShortcuts();
    if (isVisualizerModalOpen) closeVisualizer();
    if (isQuickStartOpen) closeQuickStart();
  }, [
    isHistoryModalOpen,
    isRenameModalOpen,
    isDeleteModalOpen,
    isAuthModalOpen,
    isKeyboardShortcutsOpen,
    isVisualizerModalOpen,
    isQuickStartOpen,
    closeHistory,
    closeRename,
    closeDelete,
    closeAuthModal,
    closeKeyboardShortcuts,
    closeVisualizer,
    closeQuickStart
  ]);

  return {
    // Auth Modal
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,

    // Quick Start
    isQuickStartOpen,
    openQuickStart,
    closeQuickStart,
    pendingAudioFile,
    setPendingAudioFile,

    // Keyboard Shortcuts
    isKeyboardShortcutsOpen,
    openKeyboardShortcuts,
    closeKeyboardShortcuts,

    // History
    historySong,
    isHistoryModalOpen,
    openHistory,
    closeHistory,

    // Rename
    renamingSong,
    isRenameModalOpen,
    openRename,
    closeRename,

    // Delete
    deletingSong,
    isDeleteModalOpen,
    openDelete,
    closeDelete,

    // Visualizer
    visualizerSong,
    setVisualizerSong,
    isVisualizerModalOpen,
    openVisualizer,
    closeVisualizer,

    // Git Toast
    gitToast,
    setGitToast,

    // Close all (for Escape shortcut)
    closeAllModals
  };
}
