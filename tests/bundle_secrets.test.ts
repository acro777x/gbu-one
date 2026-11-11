/**
 * The client bundle must never carry a credential.
 *
 * Expo inlines every `EXPO_PUBLIC_*` environment variable into the JavaScript
 * bundle at build time. The shipped public APK really did contain the
 * project's Supabase SECRET key (`sb_secret_...`), because the build
 * sanitiser only removed variables whose NAME matched and the anon key was
 * named `EXPO_PUBLIC_SUPABASE_ANON_KEY` while holding a secret value.
 *
 * These tests are the guard so that cannot happen again:
 *
 *   1. no file under `src/` or `app/` may read a credential-shaped variable,
 *   2. the build script must refuse a release build that would inline one,
 *   3. the build script must check the VALUE, not just the variable name,
 *   4. `.env.example` must not document a credential as an app variable.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'apk') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

const sourceFiles = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'app')),
].map((p) => ({ path: relative(ROOT, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));

describe('client bundle secret hygiene', () => {
  it('no client source file reads a credential-shaped environment variable', () => {
    // A service-role / secret key bypasses every row level security policy,
    // so a client that holds one is a client that owns the database.
    const forbidden = [
      /process\.env\.EXPO_PUBLIC_ADMIN_SERVICE_ROLE_KEY/,
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
      /process\.env\.EXPO_PUBLIC_ADMIN_PIN/,
      /process\.env\.EXPO_PUBLIC_ADMIN_MFA_KEY/,
      /process\.env\.EXPO_PUBLIC_ADMIN_PASSWORD/,
      /process\.env\.EXPO_PUBLIC_ADMIN_EMAIL/,
      /process\.env\.GBU_ADMIN_PASSWORD/,
      /process\.env\.GBU_ADMIN_EMAIL/,
    ];

    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const pattern of forbidden) {
        if (pattern.test(file.text)) offenders.push(`${file.path}  ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no client source file hard-codes a Supabase secret key', () => {
    const offenders = sourceFiles
      .filter((f) => /sb_secret_[A-Za-z0-9_-]{8,}/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('no client source file hard-codes a service-role JWT', () => {
    const offenders = sourceFiles
      .filter((f) => /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('the build script refuses to inline a secret key, by VALUE not by name', () => {
    const build = readFileSync(join(ROOT, 'tools', 'build_android_apk.py'), 'utf8');
    // The value-based rule is the one that matters: it does not care what
    // the variable is called.
    expect(build).toContain('sb_secret_');
    expect(build).toContain('SUPABASE_SECRET_PREFIXES');
    expect(build).toContain('classify_env_line');
    expect(build).toContain('REFUSING TO BUILD');
    // The refusal must apply to a release build.
    expect(build).toMatch(/if release and not allow_secret_anon/);
  });

  it('the build script strips the secret from the ADMIN build too', () => {
    const build = readFileSync(join(ROOT, 'tools', 'build_android_apk.py'), 'utf8');
    // The admin console authenticates with its own Supabase account and
    // relies on RLS, so it needs the secret key no more than the student
    // build does.
    const adminBlock = build.slice(build.indexOf('if is_admin:'), build.indexOf('if is_admin:') + 900);
    expect(adminBlock).toContain('sanitise_env_for_client');
    expect(adminBlock).not.toMatch(/shutil\.copy2\(env_file/);
  });

  it('the build script asserts the build copy is clean afterwards', () => {
    const build = readFileSync(join(ROOT, 'tools', 'build_android_apk.py'), 'utf8');
    expect(build).toContain('still contains');
    expect(build).toContain('SUPABASE_SECRET_PREFIXES');
  });

  it('.env.example does not offer a credential as an app variable', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
    // The publishable anon key is the one legitimate EXPO_PUBLIC_* key.
    const allowedPublic = new Set(['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_URL']);
    for (const line of example.split('\n')) {
      const name = line.split('=')[0].trim();
      if (!name || name.startsWith('#')) continue;
      if (allowedPublic.has(name)) continue;
      expect(name).not.toMatch(/EXPO_PUBLIC_.*(SECRET|PASSWORD|PIN|TOKEN|KEY)/i);
    }
    // The worker-only key must be labelled as such.
    expect(example).toMatch(/SUPABASE_SERVICE_ROLE_KEY[\s\S]{0,200}never in the app/i);
    // And the anon key must be labelled publishable.
    expect(example).toMatch(/PUBLISHABLE/i);
  });
});
