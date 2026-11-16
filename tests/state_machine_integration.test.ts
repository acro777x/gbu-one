/**
 * The typed state machines must not rot.
 *
 * `src/state/*` holds the state machines that model the app's explicit
 * lifecycles. Four of them used to be modules that nothing imported: they
 * had their own passing tests, which made it look as if the app ran on
 * them. It did not.
 *
 * This test makes the situation explicit and keeps it honest:
 *
 *  - every machine in `src/state` has to be imported by at least one
 *    production module, or this test fails.
 *
 * A machine that is not wired in is dead code: it is a specification that
 * nothing reads, and the lifecycle it describes is implemented somewhere
 * else (or nowhere at all). There used to be a second state -
 * "NOT YET WIRED IN" - for those, and it is gone: four machines sat in
 * that state for weeks, together 1,850 lines of code and 33 KB of tests
 * that proved nothing about the running app. They were deleted, and the
 * lifecycles they described live in the feature modules today.
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
    expect(machines.length).toBeGreaterThanOrEqual(1);
  });

  it.each(machines.map((m) => [m.file, m] as const))(
    '%s is imported by the app that runs',
    (_file, machine) => {
      // Is any production module importing it?
      const moduleName = machine.file.replace(/\.ts$/, '');
      const importers = productionFiles.filter((p) => {
        const text = readFileSync(p, 'utf8');
        return (
          new RegExp(`from ['"][^'"]*${moduleName}['"]`).test(text) ||
          new RegExp(`from ['"][^'"]*/state['"]`).test(text)
        );
      });

      expect(importers.length).toBeGreaterThan(0);
      if (importers.length === 0) {
        throw new Error(
          `${machine.file} is imported by nothing: it is dead code. Wire it into the ` +
            'app, or delete it - a machine that nothing reads only pretends to be ' +
            'a feature.',
        );
      }
    },
  );

  it('no machine may declare itself as not wired in', () => {
    const unwired = machines.filter((machine) =>
      /INTEGRATION STATUS:\s*\*\*NOT YET WIRED IN\.\*\*/.test(machine.source),
    );
    expect(unwired.map((machine) => machine.file)).toEqual([]);
  });

  it('the auth machine is the one the app runs', () => {
    const auth = machines.find((machine) => machine.file === 'authMachine.ts');
    expect(auth).toBeDefined();
    expect(
      /INTEGRATION STATUS:\s*\*\*WIRED IN\.\*\*/.test(auth?.source ?? ''),
    ).toBe(true);
  });
});
