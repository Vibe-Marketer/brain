import { create } from 'zustand';

export type AdminDetailType = 'ticket' | 'user';

export interface AdminDetail {
  type: AdminDetailType;
  id: string;
}

interface AdminDetailState {
  /** The entity currently open in the admin detail surface, or null when closed. */
  detail: AdminDetail | null;
  openTicket: (id: string) => void;
  openUser: (id: string) => void;
  close: () => void;
}

export const useAdminDetailStore = create<AdminDetailState>()((set) => ({
  detail: null,
  openTicket: (id: string) => set({ detail: { type: 'ticket', id } }),
  openUser: (id: string) => set({ detail: { type: 'user', id } }),
  close: () => set({ detail: null }),
}));
