import { useMailStore } from '../src/store/useMailStore';
import { INITIAL_STUDENT_EMAILS } from '../src/features/mail/mailService';

describe('GBU Webmail & Student Communications Store', () => {
  beforeEach(() => {
    useMailStore.setState({
      emails: [...INITIAL_STUDENT_EMAILS],
      activeCategory: 'all',
      searchQuery: '',
      selectedEmail: null,
    });
  });

  it('loads initial realistic GBU student communications', () => {
    const state = useMailStore.getState();
    expect(state.emails.length).toBeGreaterThan(0);
    expect(state.emails.some((e) => e.senderEmail.includes('gbu.ac.in'))).toBe(true);
    expect(state.getUnreadCount()).toBeGreaterThan(0);
  });

  it('filters emails by category correctly', () => {
    const store = useMailStore.getState();
    store.setCategory('placements');
    expect(useMailStore.getState().activeCategory).toBe('placements');

    const placementMails = useMailStore
      .getState()
      .emails.filter((e) => e.category === 'placements');
    expect(placementMails.length).toBeGreaterThan(0);
    expect(placementMails.every((e) => e.category === 'placements')).toBe(true);
  });

  it('marks individual email as read and updates unread count', () => {
    const initialUnread = useMailStore.getState().getUnreadCount();
    const targetEmail = useMailStore.getState().emails.find((e) => e.isUnread);
    expect(targetEmail).toBeDefined();

    useMailStore.getState().markAsRead(targetEmail!.id);
    const updatedTarget = useMailStore
      .getState()
      .emails.find((e) => e.id === targetEmail!.id);
    expect(updatedTarget?.isUnread).toBe(false);
    expect(useMailStore.getState().getUnreadCount()).toBe(initialUnread - 1);
  });

  it('marks all emails as read', () => {
    useMailStore.getState().markAllAsRead();
    expect(useMailStore.getState().getUnreadCount()).toBe(0);
    expect(useMailStore.getState().emails.every((e) => !e.isUnread)).toBe(true);
  });

  it('toggles star on email', () => {
    const email = useMailStore.getState().emails[0];
    const initialStarred = email.isStarred;

    useMailStore.getState().toggleStar(email.id);
    let updated = useMailStore.getState().emails.find((e) => e.id === email.id);
    expect(updated?.isStarred).toBe(!initialStarred);

    useMailStore.getState().toggleStar(email.id);
    updated = useMailStore.getState().emails.find((e) => e.id === email.id);
    expect(updated?.isStarred).toBe(initialStarred);
  });

  it('supports sending reply with validation', () => {
    const email = useMailStore.getState().emails[0];
    const emptyResult = useMailStore.getState().sendReply(email.id, '   ');
    expect(emptyResult.success).toBe(false);

    const validResult = useMailStore
      .getState()
      .sendReply(email.id, 'Thank you Sir, I will bring my original documents.');
    expect(validResult.success).toBe(true);

    const updated = useMailStore.getState().emails.find((e) => e.id === email.id);
    expect(updated?.body).toContain('--- Your Reply');
    expect(updated?.body).toContain('Thank you Sir, I will bring my original documents.');
  });

  it('supports forwarding email with validation', () => {
    const email = useMailStore.getState().emails[0];
    const emptyResult = useMailStore.getState().forwardEmail(email.id, '', '');
    expect(emptyResult.success).toBe(false);

    const validResult = useMailStore
      .getState()
      .forwardEmail(email.id, 'classrep@gbu.ac.in', 'FYI for class noticeboard');
    expect(validResult.success).toBe(true);
  });

  it('deletes email from inbox', () => {
    const email = useMailStore.getState().emails[0];
    const initialCount = useMailStore.getState().emails.length;

    useMailStore.getState().deleteEmail(email.id);
    expect(useMailStore.getState().emails.length).toBe(initialCount - 1);
    expect(
      useMailStore.getState().emails.find((e) => e.id === email.id),
    ).toBeUndefined();
  });
});
