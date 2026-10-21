import { create } from 'zustand';

export interface SheetState {
  /** True while any sheet is on screen. */
  isSheetOpen: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * The sheets are drawn inside the screen rather than in a native modal
 * window, so the tab bar has to step out of the way while one is open.
 * See `src/components/ui/SheetOverlay.tsx` for why.
 */
export const useSheetStore = create<SheetState>((set) => ({
  isSheetOpen: false,
  setOpen: (open) => set({ isSheetOpen: open }),
}));

export default useSheetStore;
