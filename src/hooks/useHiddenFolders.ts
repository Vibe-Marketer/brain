import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'callvault-hidden-folders';

/**
 * Hook to manage hidden folders with localStorage persistence.
 * Hidden folders are excluded from the "All Transcripts" view.
 */
export function useHiddenFolders() {
  const [hiddenFolders, setHiddenFolders] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist to localStorage whenever hiddenFolders changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...hiddenFolders]));
    } catch {
      // Ignore storage errors
    }
  }, [hiddenFolders]);

  const toggleHidden = useCallback((folderId: string) => {
    setHiddenFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const isHidden = useCallback((folderId: string) => {
    return hiddenFolders.has(folderId);
  }, [hiddenFolders]);

  return {
    hiddenFolders,
    toggleHidden,
    isHidden,
    hiddenCount: hiddenFolders.size,
  };
}
