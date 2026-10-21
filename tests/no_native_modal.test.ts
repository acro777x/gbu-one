/**
 * A React Native `Modal` does not work in this app on Android: the modal
 * window is created and painted, but its content view is measured without
 * constraints, so the window has no touchable region. The sheet was
 * invisible, every tap fell through to the screen underneath and the back
 * button left the app.
 *
 * The sheets use `src/components/ui/SheetOverlay.tsx` instead, so any new
 * `Modal` has to be a deliberate, reviewed decision.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

const SOURCE_ROOTS = ['app', 'src'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('no native Modal', () => {
  const files = SOURCE_ROOTS.flatMap((root) => sourceFiles(path.join(ROOT, root)));

  it('finds the app source', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('does not import Modal from react-native', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      const importLine = text.match(/import\s*{([^}]*)}\s*from\s*'react-native'/);
      if (!importLine) continue;
      const names = importLine[1]
        .split(',')
        .map((name) => name.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      if (names.includes('Modal')) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the sheet overlay and the tab bar in step', () => {
    const overlay = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'ui', 'SheetOverlay.tsx'),
      'utf8',
    );
    expect(overlay).toContain('useSheetStore');
    expect(overlay).toContain('BackHandler');

    const tabs = fs.readFileSync(path.join(ROOT, 'app', '(tabs)', '_layout.tsx'), 'utf8');
    expect(tabs).toContain('isSheetOpen');
  });
});
