import { create } from 'zustand';
import { StudentEmail, INITIAL_STUDENT_EMAILS } from '../features/mail/mailService';

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
  sendReply: (emailId: string, replyText: string) => { success: boolean };
  forwardEmail: (emailId: string, recipient: string, note: string) => { success: boolean };
  getUnreadCount: () => number;
}

export const useMailStore = create<MailState>((set, get) => ({
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

  sendReply: (emailId: string, replyText: string) => {
    if (!replyText.trim()) return { success: false };
    // Optimistically update
    set((state) => ({
      emails: state.emails.map((e) => {
        if (e.id === emailId) {
          return {
            ...e,
            body: `${e.body}\n\n--- Your Reply (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) ---\n${replyText}`,
          };
        }
        return e;
      }),
    }));
    return { success: true };
  },

  forwardEmail: (_emailId: string, recipient: string, _note: string) => {
    if (!recipient.trim()) return { success: false };
    return { success: true };
  },

  getUnreadCount: () => {
    return get().emails.filter((e) => e.isUnread).length;
  },
}));
