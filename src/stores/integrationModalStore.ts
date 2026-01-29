import { create } from 'zustand';
import type { IntegrationPlatform } from '@/hooks/useIntegrationSync';

interface IntegrationModalState {
  isOpen: boolean;
  platform: IntegrationPlatform | null;
  openModal: (platform: IntegrationPlatform) => void;
  closeModal: () => void;
}

export const useIntegrationModalStore = create<IntegrationModalState>((set) => ({
  isOpen: false,
  platform: null,

  openModal: (platform) => {
    set({
      isOpen: true,
      platform,
    });
  },

  closeModal: () => {
    set({
      isOpen: false,
      platform: null,
    });
  },
}));
