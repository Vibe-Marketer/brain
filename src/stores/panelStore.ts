import { create } from 'zustand';

export type PanelType = 
  | 'workspace-detail'
  | 'call-detail'
  | 'insight-detail'
  | 'filter-tool'
  | 'ai-assistant'
  | 'inspector'
  | null;

interface PanelState {
  isPanelOpen: boolean;
  panelType: PanelType;
  panelData: any;
  isPinned: boolean;
  panelHistory: Array<{ type: PanelType; data: any }>;
  
  // Actions
  openPanel: (type: PanelType, data?: any) => void;
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

  openPanel: (type, data = null) => {
    const current = get();
    
    // Add current panel to history if it exists
    if (current.panelType) {
      set({
        panelHistory: [
          ...current.panelHistory,
          { type: current.panelType, data: current.panelData }
        ]
      });
    }

    set({
      isPanelOpen: true,
      panelType: type,
      panelData: data
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
