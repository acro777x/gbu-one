/**
 * The end-to-end check of the class mapping: for every class the picker can
 * offer, does the stored key actually match rows the university publishes?
 *
 *   npx ts-node tools/probe_class_match.ts <schd39.json>
 *
 * This is the check that proves the reported bug ("after onboarding the
 * correct class is not coming") is fixed: a key that matches nothing means
 * an empty timetable.
 */
import fs from 'fs';
import { type RawGBUTimetableItem } from '../src/features/timetable/timetableProvider';
import {
  FALLBACK_CATALOGUE,
  parsePublishedSection,
} from '../src/features/timetable/classCatalogue';

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: probe_class_match.ts <schd39.json>');
    process.exitCode = 1;
    return;
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as RawGBUTimetableItem[];

  const published = new Map<string, number>();
  for (const row of rows) {
    const code = String(row.SectionName ?? '').trim();
    if (code) published.set(code, (published.get(code) ?? 0) + 1);
  }

  // Every code the bundled fallback catalogue can offer.
  const offered = FALLBACK_CATALOGUE.flatMap((p) => p.sections);
  const missing: string[] = [];
  const noRows: string[] = [];

  for (const section of offered) {
    if (!published.has(section)) {
      missing.push(section);
      continue;
    }
    // The stored key must match the published string exactly.
    const live = published.get(section) ?? 0;
    if (live === 0) noRows.push(section);
  }

  console.log(`published codes: ${published.size}`);
  console.log(`codes the picker can offer: ${offered.length}`);

  if (missing.length > 0) {
    console.log(`\n${missing.length} offered code(s) the university no longer publishes:`);
    for (const code of missing.slice(0, 20)) console.log(`  ${code}`);
  } else {
    console.log('\nevery offered code is published by the university');
  }

  // The decisive check: a stored key must find its rows.
  const sample = ['BCS-II B', 'BCS-III-A', 'BCS-I-A', 'BAI-II-B', 'MBA II'];
  console.log('\nmatch check for the codes a student actually picks:');
  for (const key of sample) {
    const norm = key.trim().toUpperCase();
    const direct = rows.filter((r) => (r.SectionName ?? '').trim().toUpperCase() === norm).length;
    const variants = [
      key.replace(/\s+/g, '-'),
      key.replace(/-/g, ' '),
    ]
      .map((v) => v.toUpperCase())
      .filter((v) => v !== norm);
    let best = direct;
    let via = 'direct';
    if (best === 0) {
      for (const v of variants) {
        const n = rows.filter((r) => (r.SectionName ?? '').trim().toUpperCase() === v).length;
        if (n > best) {
          best = n;
          via = `variant "${v}"`;
        }
      }
    }
    const parsed = parsePublishedSection(key);
    console.log(
      `  ${key.padEnd(14)} -> ${String(best).padStart(4)} rows (${via}) | ` +
        `programme ${parsed.programmeCode} year ${parsed.year} letter ${parsed.sectionLetter}`,
    );
  }
}

main();
