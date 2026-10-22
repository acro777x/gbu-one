import { create } from 'zustand';

export type NoticeSource = 'live' | 'cache' | 'sample';

export interface NoticesStatus {
  /** Where the notices on screen came from. */
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
 */
export const useNoticesStatusStore = create<NoticesStatusState>((set) => ({
  source: 'sample',
  set: (status) => set(status),
}));

export default useNoticesStatusStore;
