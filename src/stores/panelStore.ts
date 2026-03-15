import { create } from 'zustand';
import type { PanelType, PanelData, PanelHistoryEntry } from '@/types/panel';

// Re-export PanelType for backward compatibility
export type { PanelType } from '@/types/panel';

interface PanelState {
  isPanelOpen: boolean;
  panelType: PanelType;
  panelData: PanelData;
  isPinned: boolean;
  panelHistory: PanelHistoryEntry[];
  
  // Actions
  openPanel: (type: PanelType, data?: PanelData) => void;
  closePanel: () => void;
  togglePin: () => void;
  goBack: () => void;
  clearHistory: () => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  isPanelOpen: false,
  panelType: null,
  panelData: null,
  isPinned: false,
  panelHistory: [],

  openPanel: (type: PanelType, data: PanelData = null) => {
    const current = get();

    // Build updated history: append current panel if one exists, then cap at 10
    const updatedHistory = current.panelType
      ? [...current.panelHistory, { type: current.panelType, data: current.panelData }].slice(-10)
      : current.panelHistory;

    // Single atomic update to avoid one-frame visual glitches
    set({
      isPanelOpen: true,
      panelType: type,
      panelData: data,
      panelHistory: updatedHistory,
    });
  },

  closePanel: () => {
    const current = get();
    
    // Don't close if pinned
    if (current.isPinned) return;

    set({
      isPanelOpen: false,
      panelType: null,
      panelData: null,
      panelHistory: []
    });
  },

  togglePin: () => {
    set((state) => ({ isPinned: !state.isPinned }));
  },

  goBack: () => {
    const current = get();
    const history = current.panelHistory;

    if (history.length === 0) {
      // No history, just close
      set({
        isPanelOpen: false,
        panelType: null,
        panelData: null
      });
      return;
    }

    // Pop last item from history
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    set({
      panelType: previous.type,
      panelData: previous.data,
      panelHistory: newHistory
    });
  },

  clearHistory: () => {
    set({ panelHistory: [] });
  }
}));
