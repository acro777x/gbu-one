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
import { execFileSync } from 'child_process';
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

  it('no client source file implements an offline admin bypass', () => {
    // The "emergency master key" compared a PIN that was inlined into the
    // APK, so anybody who unpacked the binary owned the admin console.
    // The path was deleted; these assertions keep it deleted.
    const forbidden = [
      /verifyAdminCredentials/,
      /getMasterAdminPin/,
      /getMasterAdminMfaKey/,
      /offline_emergency/,
      /emergency_admin/,
    ];
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      for (const pattern of forbidden) {
        if (pattern.test(file.text)) offenders.push(`${file.path}  ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the production master PIN appears nowhere in the repository source', () => {
    // The PIN that used to be shipped inside the APK must never come back,
    // not even as a "test fixture".
    const walkAll = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.git', 'dist', 'apk', '.expo'].includes(name)) continue;
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) walkAll(full, out);
        else if (/\.(ts|tsx|js|jsx|py|sql|md)$/.test(name)) out.push(full);
      }
      return out;
    };
    const offenders = walkAll(ROOT)
      .map((p) => ({ path: relative(ROOT, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }))
      .filter((f) => /\b852096\b/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('no client source file hard-codes a service-role JWT', () => {
    const offenders = sourceFiles
      .filter((f) => /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // The build sanitiser, exercised for real.
  //
  // A regression test, not a text assertion: the sanitiser once dropped
  // EXPO_PUBLIC_SUPABASE_ANON_KEY because its NAME contains "KEY", which
  // meant a release build shipped with NO anon key at all - the app would
  // have had no backend and would have silently run offline forever, with
  // no error anywhere. A name-based rule must never override a value that
  // is provably safe.
  // ---------------------------------------------------------------------
  const sanitiser = readFileSync(join(ROOT, 'tools', 'build_android_apk.py'), 'utf8');

  function classify(name: string, value: string): { action: string; reason: string } {
    // The sanitiser is a small, self-contained module. It is executed with
    // the real interpreter so the test proves the REAL behaviour, not a
    // restatement of it.
    const script = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("b", ${JSON.stringify(
      join(ROOT, 'tools', 'build_android_apk.py'),
    )})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps(m.classify_env_line(${JSON.stringify(`${name}=${value}`)})))
`;
    const out = execFileSync('python', ['-c', script], { encoding: 'utf8' });
    // The Python function returns a (action, reason) tuple, which JSON
    // serialises as a two-element array.
    const parsed = JSON.parse(out);
    return { action: parsed[0], reason: parsed[1] };
  }

  it('keeps a Supabase PUBLISHABLE key even though its name contains "KEY"', () => {
    const result = classify(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'sb_publishable_abcdefghijklmnopqrstuvwxyz0123456789',
    );
    expect(result.action).toBe('keep');
  });

  it('drops a Supabase SECRET key whatever it is called', () => {
    for (const name of [
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'SOMETHING_ELSE',
      'EXPO_PUBLIC_ADMIN_SERVICE_ROLE_KEY',
    ]) {
      const result = classify(name, 'sb_secret_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
      expect(['drop', 'secret-anon']).toContain(result.action);
    }
  });

  it('drops a credential-shaped variable that is not a recognised Supabase key', () => {
    expect(classify('EXPO_PUBLIC_ADMIN_PIN', '123456').action).toBe('drop');
    expect(classify('EXPO_PUBLIC_ADMIN_PASSWORD', 'hunter2').action).toBe('drop');
    expect(classify('SUPABASE_SERVICE_ROLE_KEY', 'plain-text-value').action).toBe('drop');
  });

  it('keeps an empty optional credential, because an empty value is not a secret', () => {
    expect(classify('EXPO_PUBLIC_ADMIN_PIN', '').action).toBe('keep');
    expect(classify('FCM_SERVER_KEY', '').action).toBe('keep');
  });

  it('the sanitiser checks the VALUE before the NAME', () => {
    // The ordering is the whole point: a publishable key must survive a
    // name-based rule.
    const valueIndex = sanitiser.indexOf('SUPABASE_PUBLISHABLE_PREFIXES:');
    const nameIndex = sanitiser.indexOf('if SECRET_NAME_RE.search(name):');
    expect(valueIndex).toBeGreaterThan(-1);
    expect(nameIndex).toBeGreaterThan(-1);
    expect(valueIndex).toBeLessThan(nameIndex);
  });

  // ---------------------------------------------------------------------
  // The three build paths, exercised for real.
  // ---------------------------------------------------------------------
  function sanitise(
    env: string,
    release: boolean,
    allowSecretAnon = false,
  ): { ok: boolean; out?: string; error?: string } {
    const script = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("b", ${JSON.stringify(
      join(ROOT, 'tools', 'build_android_apk.py'),
    )})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
env = ${JSON.stringify(env)}
try:
    print("__RESULT__" + json.dumps({"ok": True, "out": m.sanitise_env_for_client(env, ${release ? 'True' : 'False'}, ${allowSecretAnon ? 'True' : 'False'})}))
except SystemExit as e:
    print("__RESULT__" + json.dumps({"ok": False, "error": str(e)}))
`;
    const raw = execFileSync('python', ['-c', script], { encoding: 'utf8' });
    // The sanitiser prints its warnings to stdout, so the JSON is taken from
    // the marked line rather than from the whole output.
    const line = raw.split('\n').find((l: string) => l.startsWith('__RESULT__'));
    if (!line) throw new Error(`the sanitiser produced no result:\n${raw}`);
    return JSON.parse(line.slice('__RESULT__'.length));
  }

  const SECRET_ENV = [
    'APP_ENV=production',
    'SUPABASE_SERVICE_ROLE_KEY=sb_secret_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_secret_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    'EXPO_PUBLIC_TIMETABLE_API_URL=https://mygbu.in',
  ].join('\n');

  const PUBLISHABLE_ENV = [
    'APP_ENV=production',
    'SUPABASE_SERVICE_ROLE_KEY=sb_secret_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_abcdefghijklmnopqrstuvwxyz0123456789',
    'EXPO_PUBLIC_TIMETABLE_API_URL=https://mygbu.in',
  ].join('\n');

  it('refuses a RELEASE build that would ship a secret key', () => {
    const result = sanitise(SECRET_ENV, true);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('REFUSING TO BUILD');
  });

  it('ships the publishable key in a RELEASE build, and drops the secret one', () => {
    const result = sanitise(PUBLISHABLE_ENV, true);
    expect(result.ok).toBe(true);
    expect(result.out).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_');
    expect(result.out).not.toContain('sb_secret_');
  });

  it('keeps a working key in a DEBUG build so the app can be tested', () => {
    // A debug build with no backend cannot be tested at all. The artifact is
    // named "debug" and must never be published; a release build is
    // refused outright.
    const result = sanitise(SECRET_ENV, false);
    expect(result.ok).toBe(true);
    expect(result.out).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_secret_');
    // The worker-only secret must still never reach a client bundle.
    expect(result.out).not.toContain('SUPABASE_SERVICE_ROLE_KEY=sb_secret_');
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
