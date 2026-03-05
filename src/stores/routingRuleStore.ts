import { create } from 'zustand';

/**
 * Routing Rule Store — UI-only state for the routing rules slide-over panel.
 */

interface RoutingRuleStoreState {
  isSlideOverOpen: boolean;
  activeRuleId: string | null;

  openSlideOver: (ruleId: string | null) => void;
  closeSlideOver: () => void;
}

export const useRoutingRuleStore = create<RoutingRuleStoreState>()((set) => ({
  isSlideOverOpen: false,
  activeRuleId: null,

  openSlideOver: (ruleId: string | null) =>
    set({ isSlideOverOpen: true, activeRuleId: ruleId }),

  closeSlideOver: () =>
    set({ isSlideOverOpen: false, activeRuleId: null }),
}));
