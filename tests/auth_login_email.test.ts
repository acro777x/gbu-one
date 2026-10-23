/**
 * The login box takes a roll number or an email address.
 *
 * Students sign in with their roll number (mapped onto the student domain); the
 * owner and moderators sign in with the email on their GBU One account, which
 * is how the moderation queue is reachable at all (docs/ADMIN_MODERATION.md).
 */
import { toLoginEmail } from '../src/store/useAuthStore';

describe('login identity', () => {
  it('maps a roll number onto the student domain', () => {
    expect(toLoginEmail('22/BCS/048')).toBe('22bcs048@gbu.ac.in');
    expect(toLoginEmail('  22 BCS 048 ')).toBe('22bcs048@gbu.ac.in');
  });

  it('uses an email address as it is, lower-cased', () => {
    expect(toLoginEmail('Owner@GBUOne.test')).toBe('owner@gbuone.test');
    expect(toLoginEmail(' ashish@example.com ')).toBe('ashish@example.com');
  });

  it('never turns an email into a student address', () => {
    expect(toLoginEmail('a.b+c@example.com')).toBe('a.b+c@example.com');
  });
});