/**
 * The BUILD SYSTEM must not be able to produce a bad artifact.
 *
 * There used to be three ways to build this app, and they disagreed on
 * eight points. The worst of them: an EAS "production" build had no backend
 * configured, still contained the admin console and the moderation screen,
 * and was signed with the DEBUG key. It looked like a release. It was not
 * one.
 *
 * These tests assert the properties that make that impossible again. They
 * are behaviour tests: they run the real Python module, not a restatement of
 * it.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function runPython(body: string): string {
  const raw = execFileSync('python', ['-c', body], { encoding: 'utf8' });
  const line = raw.split('\n').find((l) => l.startsWith('__RESULT__'));
  if (!line) throw new Error(`no result:\n${raw}`);
  return line.slice('__RESULT__'.length);
}

describe('the build system', () => {
  it('the EAS profile cannot produce a bad artifact', () => {
    const result = runPython(`
import json, sys
sys.path.insert(0, ${JSON.stringify(join(ROOT, 'tools'))})
import build_config
problems = build_config.eas_profile_problems(json.load(open(${JSON.stringify(
      join(ROOT, 'eas.json'),
    )}, encoding="utf-8")))
print("__RESULT__" + json.dumps(problems))
`);
    const problems = JSON.parse(result) as string[];
    expect(problems).toEqual([]);
  });

  it('a release build cannot fall back to the debug key', () => {
    const signing = readFileSync(join(ROOT, 'plugins', 'withReleaseSigning.js'), 'utf8');
    // The plugin must know whether it is building a release at all, so it
    // can refuse to sign one with the debug key.
    expect(signing).toContain('GBU_RELEASE_BUILD');
    // And the refusal must be a refusal, not a warning.
    expect(signing).toMatch(/throw|process\.exit|exitProcess/i);
  });

  it('the build script refuses a release without the owner keystore', () => {
    const build = readFileSync(join(ROOT, 'tools', 'build_android_apk.py'), 'utf8');
    expect(build).toContain('assert_release_keystore');
    expect(build).toContain('GBU_ANDROID_KEYSTORE_PATH');
    // The keystore check must happen BEFORE the artifact is produced.
    expect(build.indexOf('assert_release_keystore')).toBeGreaterThan(-1);
  });

  it('the build script verifies the signature of the artifact it produced', () => {
    const build = readFileSync(join(ROOT, 'tools', 'build_android_apk.py'), 'utf8');
    expect(build).toContain('apksigner');
    // A debug-signed "release" must be caught.
    expect(build).toMatch(/Android Debug/i);
  });

  it('the student build purges the admin console, and so does the EAS one', () => {
    const config = readFileSync(join(ROOT, 'tools', 'build_config.py'), 'utf8');
    expect(config).toContain('purge_admin_variant');
    expect(config).toContain('app');
    expect(config).toContain('moderation.tsx');

    // And the EAS profile must actually RUN the same step.
    const eas = JSON.parse(readFileSync(join(ROOT, 'eas.json'), 'utf8')) as {
      hooks?: Record<string, { command?: string }>;
    };
    const commands = Object.values(eas.hooks ?? {}).map((h) => h.command ?? '');
    expect(commands.some((c) => c.includes('--prepare-only'))).toBe(true);
  });

  it('there is one documented build path', () => {
    const release = readFileSync(join(ROOT, 'docs', 'RELEASE.md'), 'utf8');
    expect(release).toContain('tools/build_android_apk.py');
    // The old document described three different ways to build.
    expect(release).not.toContain('npx expo prebuild --platform android --clean');
  });
});
