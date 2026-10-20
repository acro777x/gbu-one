import { readFileSync } from 'fs';
import { join } from 'path';
import { useMailStore } from '../src/store/useMailStore';
import { INITIAL_STUDENT_EMAILS } from '../src/features/mail/mailService';

// The mail screen has no component test harness in this repo, so its copy is
// asserted from the source to prove the UI never claims more than the store did.
const mailScreenSource = readFileSync(join(__dirname, '..', 'app', 'mail.tsx'), 'utf8');

describe('Mail store honesty', () => {
  beforeEach(() => {
    useMailStore.setState({
      emails: [...INITIAL_STUDENT_EMAILS],
      activeCategory: 'all',
      searchQuery: '',
      selectedEmail: null,
    });
  });

  it('never reports a forward as sent', () => {
    const email = useMailStore.getState().emails[0];

    const result = useMailStore
      .getState()
      .forwardEmail(email.id, 'classrep@gbu.ac.in', 'FYI for the noticeboard');

    expect(result.success).toBe(true);
    expect(result.sent).toBe(false);
  });

  it('records the forward in the local email so the student can see it happened', () => {
    const email = useMailStore.getState().emails[0];
    const bodyBefore = email.body;

    const result = useMailStore
      .getState()
      .forwardEmail(email.id, 'classrep@gbu.ac.in', 'FYI for the noticeboard');

    expect(result.success).toBe(true);

    const updated = useMailStore.getState().emails.find((e) => e.id === email.id);
    expect(updated?.body).not.toBe(bodyBefore);
    expect(updated?.body).toContain('Forwarded to classrep@gbu.ac.in');
    expect(updated?.body).toContain('FYI for the noticeboard');
  });

  it('refuses a forward with no recipient and leaves the email untouched', () => {
    const email = useMailStore.getState().emails[0];
    const bodyBefore = email.body;

    const result = useMailStore.getState().forwardEmail(email.id, '   ', '');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.sent).toBe(false);

    const updated = useMailStore.getState().emails.find((e) => e.id === email.id);
    expect(updated?.body).toBe(bodyBefore);
  });

  it('refuses a forward for an email that is no longer in the inbox', () => {
    const result = useMailStore
      .getState()
      .forwardEmail('mail-does-not-exist', 'classrep@gbu.ac.in', '');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.sent).toBe(false);
  });

  it('never reports a reply as sent but still stores it locally', () => {
    const email = useMailStore.getState().emails[0];

    const result = useMailStore
      .getState()
      .sendReply(email.id, 'Thank you sir, I will bring my original documents.');

    expect(result.success).toBe(true);
    expect(result.sent).toBe(false);

    const updated = useMailStore.getState().emails.find((e) => e.id === email.id);
    expect(updated?.body).toContain('--- Your Reply');
    expect(updated?.body).toContain('Thank you sir, I will bring my original documents.');
  });

  it('refuses an empty reply', () => {
    const email = useMailStore.getState().emails[0];
    const bodyBefore = email.body;

    const result = useMailStore.getState().sendReply(email.id, '   ');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.sent).toBe(false);

    const updated = useMailStore.getState().emails.find((e) => e.id === email.id);
    expect(updated?.body).toBe(bodyBefore);
  });

  it('shows the student that the reply was only saved locally', () => {
    expect(mailScreenSource).toContain(
      'Reply saved locally. Sending is not available in this build.'
    );
    expect(mailScreenSource).not.toContain('Reply dispatched successfully');
  });

  it('shows the student that the forward was only saved locally', () => {
    expect(mailScreenSource).toContain(
      'Forward saved locally. Sending is not available in this build.'
    );
    expect(mailScreenSource).not.toContain('Forwarded to ${forwardRecipient}');
  });

  it('does not claim an attachment was downloaded', () => {
    expect(mailScreenSource).not.toContain('Downloaded ${att.name}');
    expect(mailScreenSource).toContain('is listed only');
  });
});
