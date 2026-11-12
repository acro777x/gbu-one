import { create } from 'zustand';

export type NoticeSource = 'live' | 'cache' | 'sample';

export interface NoticesStatus {
  /**
   * Where the notices on screen came from:
   *  - `live`  : the university's own pages or the database answered.
   *  - `cache` : the phone is showing its own saved copy.
   *  - `sample`: the bundled archive, which is NOT live university data.
   */
  source: NoticeSource;
  /** Why the live pages could not be used, when they could not. */
  reason?: string;
  /** How many notices the live pages delivered. */
  liveCount?: number;
  /** The pages that answered. */
  sources?: string[];
}

interface NoticesStatusState extends NoticesStatus {
  set: (status: NoticesStatus) => void;
}

/**
 * Where the notices on screen came from. The app says so out loud rather
 * than passing the bundled sample off as the university's notices.
 *
 * The screen trusts this store, not the per-row flags: the flags describe a
 * single notice, while the store describes the whole list.
 */
export const useNoticesStatusStore = create<NoticesStatusState>((set) => ({
  // Before the first refresh the screen paints from the phone's own cache,
  // so that is what the status says until the network answers.
  source: 'cache',
  set: (status) => set(status),
}));

export default useNoticesStatusStore;
