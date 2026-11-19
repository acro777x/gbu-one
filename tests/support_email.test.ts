/**
 * The support mailbox must be ONE address, defined once.
 *
 * On 2026-11-19 the owner created the real mailbox support@gbuone.space.
 * Before that, the old placeholder had been copied into the About screen,
 * the landing page and two places in the worker's User-Agent, so a student
 * could send a bug report to an address nobody read.
 *
 * This test fails if a stale address comes back or if a surface hard-codes
 * the mailbox instead of using the shared constant.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

import { SUPPORT_EMAIL, WORKER_USER_AGENT } from '../src/lib/contact';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'apk', '.expo', 'docs'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('support contact', () => {
  it('is the real mailbox', () => {
    expect(SUPPORT_EMAIL).toBe('support@gbuone.space');
  });

  it('appears in the worker User-Agent', () => {
    expect(WORKER_USER_AGENT).toContain(SUPPORT_EMAIL);
    expect(WORKER_USER_AGENT).toMatch(/^GBUOne-Worker\/1\.0/);
  });

  it('is not duplicated as a literal outside the shared module', () => {
    const files = walk(ROOT).filter(
      (file) =>
        /\.(ts|tsx|html)$/.test(file) &&
        !file.endsWith(join('src', 'lib', 'contact.ts')) &&
        !file.includes(join('tests', 'support_email.test.ts')),
    );
    const stale: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (/student\.gbuone@gmail\.com/.test(source)) stale.push(relative(ROOT, file));
    }
    expect(stale).toEqual([]);
  });
});
