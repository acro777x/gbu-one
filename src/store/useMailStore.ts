import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { StudentEmail, INITIAL_STUDENT_EMAILS } from '../features/mail/mailService';
import { zustandStorage } from '../lib/storage';

export interface MailActionResult {
  success: boolean;
  error?: string;
  // This build has no mail-sending backend, so nothing ever leaves the device.
  sent: boolean;
}

export interface MailState {
  emails: StudentEmail[];
  activeCategory: 'all' | 'official' | 'academics' | 'placements' | 'hostel';
  searchQuery: string;
  selectedEmail: StudentEmail | null;

  // Actions
  setCategory: (category: 'all' | 'official' | 'academics' | 'placements' | 'hostel') => void;
  setSearchQuery: (query: string) => void;
  selectEmail: (email: StudentEmail | null) => void;
  markAsRead: (emailId: string) => void;
  markAllAsRead: () => void;
  toggleStar: (emailId: string) => void;
  deleteEmail: (emailId: string) => void;
  sendReply: (emailId: string, replyText: string) => MailActionResult;
  forwardEmail: (emailId: string, recipient: string, note: string) => MailActionResult;
  getUnreadCount: () => number;
}

const formatStamp = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const useMailStore = create<MailState>()(
  persist(
    (set, get) => ({
      emails: INITIAL_STUDENT_EMAILS,
      activeCategory: 'all',
  searchQuery: '',
  selectedEmail: null,

  setCategory: (category) => set({ activeCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectEmail: (email) => {
    set({ selectedEmail: email });
    if (email && email.isUnread) {
      get().markAsRead(email.id);
    }
  },

  markAsRead: (emailId: string) => {
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === emailId ? { ...e, isUnread: false } : e
      ),
      selectedEmail:
        state.selectedEmail?.id === emailId
          ? { ...state.selectedEmail, isUnread: false }
          : state.selectedEmail,
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      emails: state.emails.map((e) => ({ ...e, isUnread: false })),
      selectedEmail: state.selectedEmail
        ? { ...state.selectedEmail, isUnread: false }
        : null,
    }));
  },

  toggleStar: (emailId: string) => {
    set((state) => ({
      emails: state.emails.map((e) =>
        e.id === emailId ? { ...e, isStarred: !e.isStarred } : e
      ),
      selectedEmail:
        state.selectedEmail?.id === emailId
          ? { ...state.selectedEmail, isStarred: !state.selectedEmail.isStarred }
          : state.selectedEmail,
    }));
  },

  deleteEmail: (emailId: string) => {
    set((state) => ({
      emails: state.emails.filter((e) => e.id !== emailId),
      selectedEmail:
        state.selectedEmail?.id === emailId ? null : state.selectedEmail,
    }));
  },

  sendReply: (emailId: string, replyText: string): MailActionResult => {
    const trimmedReply = replyText.trim();
    if (!trimmedReply) {
      return { success: false, error: 'Write a reply before sending.', sent: false };
    }

    const target = get().emails.find((e) => e.id === emailId);
    if (!target) {
      return { success: false, error: 'That email is no longer in your inbox.', sent: false };
    }

    set((state) => ({
      emails: state.emails.map((e) => {
        if (e.id === emailId) {
          return {
            ...e,
            body: `${e.body}\n\n--- Your Reply (${formatStamp()}) ---\n${trimmedReply}`,
          };
        }
        return e;
      }),
    }));
    return { success: true, sent: false };
  },

  forwardEmail: (emailId: string, recipient: string, note: string): MailActionResult => {
    const trimmedRecipient = recipient.trim();
    if (!trimmedRecipient) {
      return { success: false, error: 'Enter a recipient to forward to.', sent: false };
    }

    const target = get().emails.find((e) => e.id === emailId);
    if (!target) {
      return { success: false, error: 'That email is no longer in your inbox.', sent: false };
    }

    const noteBlock = note.trim() ? `\n${note.trim()}` : '';
    set((state) => ({
      emails: state.emails.map((e) => {
        if (e.id === emailId) {
          return {
            ...e,
            body: `${e.body}\n\n--- Forwarded to ${trimmedRecipient} (${formatStamp()}) ---${noteBlock}`,
          };
        }
        return e;
      }),
    }));
    return { success: true, sent: false };
  },

  getUnreadCount: () => {
    return get().emails.filter((e) => e.isUnread).length;
  },
    }),
    {
      name: '@gbu_one_mail',
      storage: createJSONStorage(() => zustandStorage),
      // Persist read/star state + local replies; transient UI state excluded.
      partialize: (state) =>
        ({
          emails: state.emails,
          activeCategory: state.activeCategory,
        }) as MailState,
    }
  )
);
