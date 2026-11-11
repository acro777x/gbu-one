import { create } from 'zustand';

export interface SheetState {
  /** True while at least one sheet is on screen. */
  isSheetOpen: boolean;
  /** How many sheets are currently on screen. */
  openCount: number;
  /**
   * Registers a sheet that is on screen and returns the callback that
   * unregisters it again.
   *
   * Several screens render two or three sheets at once, so the open state
   * has to be a COUNT and not a single boolean: with a boolean, closing one
   * sheet would re-show the floating tab bar while another sheet was still
   * open and still receiving touches.
   */
  register: () => () => void;
  /** Removes one sheet from the open set. */
  unregister: () => void;
  /**
   * Legacy single-slot setter. It still works, but it cannot describe two
   * sheets at once — prefer `register`/`unregister`.
   */
  setOpen: (open: boolean) => void;
  /** Whether the legacy single slot is open. */
  legacyOpen: boolean;
}

/**
 * The sheets are drawn inside the screen rather than in a native modal
 * window, so the tab bar has to step out of the way while one is open.
 * See `src/components/ui/SheetOverlay.tsx` for why.
 */
export const useSheetStore = create<SheetState>((set, get) => ({
  isSheetOpen: false,
  openCount: 0,
  legacyOpen: false,

  register: () => {
    set((state) => ({
      openCount: state.openCount + 1,
      isSheetOpen: true,
    }));

    let released = false;
    return () => {
      // Guard against a double release: the sheet unmounts and its cleanup
      // runs again in React's strict mode double-invocation.
      if (released) return;
      released = true;
      get().unregister();
    };
  },

  unregister: () =>
    set((state) => {
      const openCount = Math.max(0, state.openCount - 1);
      return {
        openCount,
        isSheetOpen: openCount > 0 || state.legacyOpen,
      };
    }),

  setOpen: (open) =>
    set((state) => ({
      legacyOpen: open,
      isSheetOpen: open || state.openCount > 0,
    })),
}));

export default useSheetStore;
