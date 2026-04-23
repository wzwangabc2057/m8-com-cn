import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  apiKey: string | null;
  siteId: string | null;
  setApiKey: (key: string) => void;
  setSiteId: (id: string) => void;
  logout: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: null,
      siteId: null,
      setApiKey: (key) => set({ apiKey: key }),
      setSiteId: (id) => set({ siteId: id }),
      logout: () => set({ apiKey: null, siteId: null }),
    }),
    {
      name: 'cms-storage',
    }
  )
);
