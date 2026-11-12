/**
 * The class catalogue must match what the university actually publishes.
 *
 * The catalogue is the list a student picks their section from. A section
 * that is missing from it cannot be selected at all, so the student sees an
 * empty timetable and believes the university publishes nothing for them.
 *
 * Two real examples were found this way:
 *   - `DAM-I` (Ph.D. Applied Mathematics) was missing, so every Ph.D.
 *     Applied Mathematics student was locked out of their own timetable;
 *   - a section whose published name is spelled differently from the
 *     catalogue's would never match.
 *
 * The live API is the source of truth. This test needs the network, so it
 * is skipped when the API cannot be reached - the offline catalogue checks
 * still run.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

const TIMETABLE_API =
  process.env.EXPO_PUBLIC_TIMETABLE_API_URL || 'https://mygbu.in/schd/api.php';

const catalogueSource = readFileSync(
  join(ROOT, 'src', 'features', 'timetable', 'classCatalogue.ts'),
  'utf8',
);

/** Every section code the catalogue publishes, in its original spelling. */
function catalogueSections(): Set<string> {
  const out = new Set<string>();
  const re = /sections:\s*\[([^\]]*)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(catalogueSource)) !== null) {
    for (const raw of match[1].split(',')) {
      const value = raw
        .trim()
        .replace(/^['"]|['"],?$/g, '')
        .replace(/,$/, '')
        .trim();
      if (value) out.add(value);
    }
  }
  return out;
}

describe('class catalogue vs the published timetable', () => {
  it('every catalogue entry has a code, a name and at least one section', () => {
    const entries = catalogueSource.match(
      /code:\s*'[^']+',\s*\n\s*apiCode:\s*'[^']+',\s*\n\s*name:\s*'[^']+',\s*\n\s*school:\s*'[A-Z]+',\s*\n\s*sections:\s*\[[^\]]+\]/g,
    );
    expect(entries).not.toBeNull();
    expect(entries!.length).toBeGreaterThan(40);
    for (const entry of entries!) {
      expect(entry).toMatch(/sections:\s*\[[^\]]+\]/);
    }
  });

  it('offers the two schools that publish a result sheet but no timetable', () => {
    // The examination portal publishes `soljg.pdf` and `sobsc.pdf`, so a
    // law or basic-science student must be able to pick their school -
    // otherwise they can never watch for their own result.
    const catalogue = readFileSync(
      join(ROOT, 'src', 'features', 'timetable', 'classCatalogue.ts'),
      'utf8',
    );
    for (const school of ['SOL', 'SOBSC']) {
      expect(catalogue).toContain(`school: '${school}'`);
    }
    // Their section list must be empty: there is no timetable to read the
    // sections from, and an invented section would put the student in the
    // wrong class.
    expect(catalogue).toMatch(/code: 'SOL',[\s\S]{0,200}sections: \[\]/);
    expect(catalogue).toMatch(/code: 'SOBSC',[\s\S]{0,200}sections: \[\]/);
  });

  it('covers every section the university publishes', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let published: string[] = [];
    try {
      const response = await fetch(`${TIMETABLE_API}?schd=39`, {
        headers: {
          // GBU blocks the default fetch User-Agent.
          'User-Agent': 'GBUOne-Audit/1.0 (student project; contact: info@gbu.ac.in)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = (await response.json()) as Array<{ SectionName?: string }>;
      published = [
        ...new Set(
          rows
            .map((r) => (r.SectionName || '').trim())
            .filter((n) => n.length > 0),
        ),
      ];
    } catch {
      // Offline or the university is down: the catalogue checks above still
      // run, and the drift is reported in the next run instead.
      console.warn(
        '[catalogue] the timetable API could not be reached; the live cross-check was skipped.',
      );
      return;
    } finally {
      clearTimeout(timer);
    }

    expect(published.length).toBeGreaterThan(100);

    const catalogue = catalogueSections();
    // `BACK-PAPERS` is a pseudo-section the university publishes for
    // backlog classes. It is not a programme, so it is deliberately not
    // offered in the picker.
    const notOffered = new Set(['BACK-PAPERS']);
    const missing = published
      .filter((s) => !catalogue.has(s) && !notOffered.has(s))
      .sort();

    expect(
      missing,
    ).toEqual([]);
    if (missing.length > 0) {
      throw new Error(
        `these published sections are missing from the class catalogue, so a student cannot select them: ${missing.join(', ')}`,
      );
    }
  }, 45_000);
});
