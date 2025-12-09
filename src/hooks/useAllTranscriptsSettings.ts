import { useState, useEffect, useCallback } from 'react';

export interface AllTranscriptsSettings {
  name: string;
  icon: string;
}

const STORAGE_KEY = 'all-transcripts-settings';
const DEFAULT_SETTINGS: AllTranscriptsSettings = {
  name: 'All Transcripts',
  icon: 'file-text', // RiFileTextLine
};

/**
 * Hook to manage customizable settings for the "All Transcripts" view
 * Persists to localStorage
 */
export function useAllTranscriptsSettings() {
  const [settings, setSettings] = useState<AllTranscriptsSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Defensive typing: only use values if they're valid strings
        const name = typeof parsed?.name === 'string' ? parsed.name : DEFAULT_SETTINGS.name;
        const icon = typeof parsed?.icon === 'string' ? parsed.icon : DEFAULT_SETTINGS.icon;
        setSettings({ name, icon });
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  }, []);

  // Update settings and persist to localStorage
  const updateSettings = useCallback((newSettings: Partial<AllTranscriptsSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    defaultSettings: DEFAULT_SETTINGS,
  };
}
