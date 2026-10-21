/**
 * Checks the app's class-code mapping against the codes the university
 * actually publishes.
 *
 *   npx ts-node tools/probe_class_mapping.ts <schd39.json>
 *
 * The JSON is the raw schedule download (an array of API rows). The probe
 * reports, for every published class code, the code the app asks the API
 * for - which is what decides whether a student sees their own timetable.
 */
import fs from 'fs';
import {
  parseGBUClassCode,
  PROGRAMME_DIRECTORY,
  type RawGBUTimetableItem,
} from '../src/features/timetable/timetableProvider';

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: probe_class_mapping.ts <schd39.json>');
    process.exitCode = 1;
    return;
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as RawGBUTimetableItem[];
  console.log('records', rows.length);

  const published = new Map<string, { count: number; sections: Set<string> }>();
  for (const row of rows) {
    const code = String(row.SectionName ?? '').trim();
    if (!code) continue;
    const entry = published.get(code) ?? { count: 0, sections: new Set<string>() };
    entry.count++;
    const section = String(row.abbr ?? '').trim();
    if (section) entry.sections.add(section);
    published.set(code, entry);
  }

  const known = new Set(PROGRAMME_DIRECTORY.map((p) => p.code));
  const problems: string[] = [];

  console.log(`\n${published.size} distinct class codes published:`);
  const sorted = [...published.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [code, info] of sorted) {
    const parsed = parseGBUClassCode(code);
    const isKnown = known.has(parsed.programmeCode);
    if (!isKnown) {
      problems.push(
        `${code} -> programme "${parsed.programmeCode}" (${info.count} rows) is not in PROGRAMME_DIRECTORY`,
      );
    }
    console.log(
      `  ${code.padEnd(14)} ${String(info.count).padStart(4)} | ` +
        `-> ${parsed.programmeCode}-${parsed.year} ${parsed.section} | ` +
        `${isKnown ? '' : 'UNKNOWN PROGRAMME'}`,
    );
  }

  console.log(`\n${problems.length} code(s) map to an unknown programme:`);
  for (const line of problems) console.log(`  ${line}`);
}

main();
