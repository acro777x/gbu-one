/**
 * Every screen must use the safe-area-context SafeAreaView.
 *
 * React Native's own SafeAreaView does nothing on Android. Since the app
 * targets API 35 (edge-to-edge), a screen that imports it from 'react-native'
 * draws its header UNDER the status bar: on the 16 KB emulator the onboarding
 * logo covered the clock and "Skip" covered the status icons.
 *
 * This guard fails the build if a screen goes back to the wrong import.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'apk', '.expo'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('safe area', () => {
  it('no screen imports SafeAreaView from react-native', () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, 'app'))) {
      const source = readFileSync(file, 'utf8');
      // A multi-line import from 'react-native' that names SafeAreaView.
      const rnImport = /import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"]/.exec(source);
      if (rnImport && /\bSafeAreaView\b/.test(rnImport[1])) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
