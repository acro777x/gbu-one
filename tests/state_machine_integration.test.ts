/**
 * The typed state machines must not rot.
 *
 * `src/state/*` holds six state machines that model the app's implicit
 * lifecycles. Five of them were, for a long time, modules that nothing
 * imported: they had their own passing tests, which made it look as if the
 * app ran on them. It did not.
 *
 * This test makes the situation explicit and keeps it honest:
 *
 *  - a machine that declares itself INTEGRATED must really be imported by
 *    at least one production module, or this test fails;
 *  - a machine that declares itself NOT WIRED IN must really have no
 *    production importer, so nobody can "wire it in" without also
 *    updating the declaration and the tests that go with it.
 *
 * The point is not to force every machine to be integrated today. It is to
 * make the gap visible instead of hiding it behind a green test run.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'apk', '.expo'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const stateDir = join(ROOT, 'src', 'state');
const machines = readdirSync(stateDir)
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'types.ts')
  .map((f) => ({
    file: f,
    path: join(stateDir, f),
    source: readFileSync(join(stateDir, f), 'utf8'),
  }));

const productionFiles = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'app')),
].filter((p) => !p.startsWith(stateDir));

describe('typed state machines', () => {
  it('there is at least one machine to check', () => {
    expect(machines.length).toBeGreaterThanOrEqual(5);
  });

  it.each(machines.map((m) => [m.file, m] as const))(
    '%s declares its integration status, and the declaration is true',
    (_file, machine) => {
      const declaredIntegrated = /INTEGRATION STATUS:\s*\*\*WIRED IN\.\*\*/.test(
        machine.source,
      );
      const declaredNotWired =
        /INTEGRATION STATUS:\s*\*\*NOT YET WIRED IN\.\*\*/.test(machine.source);

      expect(
        declaredIntegrated || declaredNotWired,
      ).toBe(true);
      if (!declaredIntegrated && !declaredNotWired) {
        throw new Error(
          `${machine.file} must declare "INTEGRATION STATUS: **WIRED IN.**" or "**NOT YET WIRED IN.**"`,
        );
      }

      // Is any production module importing it?
      const moduleName = machine.file.replace(/\.ts$/, '');
      const importers = productionFiles.filter((p) => {
        const text = readFileSync(p, 'utf8');
        return (
          new RegExp(`from ['"][^'"]*${moduleName}['"]`).test(text) ||
          new RegExp(`from ['"][^'"]*/state['"]`).test(text)
        );
      });

      if (declaredIntegrated) {
        expect(importers.length).toBeGreaterThan(0);
        if (importers.length === 0) {
          throw new Error(
            `${machine.file} says it is WIRED IN, but no production module imports it`,
          );
        }
      } else {
        expect(importers).toEqual([]);
        if (importers.length > 0) {
          throw new Error(
            `${machine.file} says it is NOT YET WIRED IN, but ${importers
              .map((p) => relative(ROOT, p))
              .join(', ')} imports it. Update the declaration and the tests that go with it.`,
          );
        }
      }
    },
  );
});
