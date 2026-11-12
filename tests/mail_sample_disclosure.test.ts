/**
 * The bundled mail inbox must never be presented as the university's own.
 *
 * The university does not publish a student webmail and the app does not
 * connect to one. The bundled inbox is written to look completely real: a
 * placement drive with a CTC package and a named recruiter, a mid-semester
 * detention notice, a hostel circular. A student who read that and believed
 * it would skip studying, or believe a job offer existed.
 *
 * So the screen has to say what it is - both on the list and on the
 * message itself.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { INITIAL_STUDENT_EMAILS } from '../src/features/mail/mailService';

const ROOT = join(__dirname, '..');
const mailScreen = readFileSync(join(ROOT, 'app', 'mail.tsx'), 'utf8');

describe('the bundled mail inbox is labelled as a sample', () => {
  it('every seeded email is flagged as sample data', () => {
    expect(INITIAL_STUDENT_EMAILS.length).toBeGreaterThan(0);
    const notFlagged = INITIAL_STUDENT_EMAILS.filter((email) => email.isSample !== true);
    expect(
      notFlagged.map((email) => email.id),
    ).toEqual([]);
  });

  it('the inbox screen shows an unmistakable sample banner', () => {
    expect(mailScreen).toMatch(/SAMPLE DATA/);
    // The banner must be announced to a screen-reader user, not just drawn.
    expect(mailScreen).toMatch(/accessibilityRole=["']alert["']/);
    expect(mailScreen).toMatch(/accessibilityLiveRegion=["']polite["']/);
    // And it must say the university did not send these.
    expect(mailScreen).toMatch(/does not publish a student webmail/i);
  });

  it('the message reader marks the message it is showing', () => {
    // The list banner can be scrolled away; the reader cannot.
    expect(mailScreen).toMatch(/activeEmail\.isSample/);
    expect(mailScreen).toMatch(/no university sent this message/i);
  });
});
