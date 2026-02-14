import { create } from 'zustand';

interface FilterState {
  from: string | undefined;
  to: string | undefined;
  setRange: (from: string | undefined, to: string | undefined) => void;
  clearRange: () => void;
}

/** Global date-range filter shared across all dashboard pages. */
export const useFilterStore = create<FilterState>((set) => ({
  from: undefined,
  to: undefined,
  setRange: (from, to) => set({ from, to }),
  clearRange: () => set({ from: undefined, to: undefined }),
}));
