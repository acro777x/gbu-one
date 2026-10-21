/**
 * Regenerates the bundled offline class catalogue from a saved copy of the
 * Samay API response.
 *
 *   npx ts-node tools/gen_fallback_catalogue.ts <schd39.json> [out.ts]
 *
 * The bundled catalogue in `src/features/timetable/classCatalogue.ts` is only
 * the offline fallback. The app prefers the live list; this script refreshes
 * the fallback after the university adds or removes a section.
 */
import fs from 'fs';

interface RawRow {
  SectionName?: string;
  Code?: string;
  program_name?: string;
  school?: string;
}

interface Group {
  code: string;
  apiCode: string;
  name: string;
  school: string;
  sections: string[];
}

const ROMAN = /^[IVX]{1,5}$/;

function parsePublished(section: string): {
  programmeCode: string;
  year: string;
  sectionLetter: string;
} {
  const raw = section.trim();
  const tokens = raw.split(/[\s-]+/).filter(Boolean);
  const upper = tokens.map((token) => token.toUpperCase());

  let yearIndex = -1;
  for (let i = upper.length - 1; i >= 0; i -= 1) {
    if (!ROMAN.test(upper[i])) continue;
    const trailing = upper.slice(i + 1);
    if (trailing.length === 0 || (trailing.length === 1 && /^[A-Z]$/.test(trailing[0]))) {
      yearIndex = i;
    }
    break;
  }

  if (yearIndex < 0) {
    return { programmeCode: raw, year: '', sectionLetter: 'General' };
  }

  const letter = upper.length === yearIndex + 2 ? tokens[yearIndex + 1] : '';
  return {
    programmeCode: tokens.slice(0, yearIndex).join('-'),
    year: upper[yearIndex],
    sectionLetter: letter ? letter.toUpperCase() : 'General',
  };
}

function romanValue(roman: string): number {
  const values: Record<string, number> = { I: 1, V: 5, X: 10 };
  let total = 0;
  let previous = 0;
  for (let i = roman.length - 1; i >= 0; i -= 1) {
    const value = values[roman[i]] ?? 0;
    total += value < previous ? -value : value;
    if (value >= previous) previous = value;
  }
  return total;
}

function main(): void {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input) {
    console.error('usage: gen_fallback_catalogue.ts <schd39.json> [out.ts]');
    process.exitCode = 1;
    return;
  }

  const rows = JSON.parse(fs.readFileSync(input, 'utf8')) as RawRow[];
  const groups = new Map<string, Group & { names: Map<string, number>; schools: Map<string, number>; codes: Map<string, number>; sectionSet: Set<string> }>();

  for (const row of rows) {
    const section = (row.SectionName ?? '').trim();
    if (!section) continue;
    const code = parsePublished(section).programmeCode;
    if (!code) continue;

    let group = groups.get(code);
    if (!group) {
      group = {
        code,
        apiCode: '',
        name: '',
        school: '',
        names: new Map(),
        schools: new Map(),
        codes: new Map(),
        sectionSet: new Set(),
        sections: [],
      };
      groups.set(code, group);
    }

    const bump = (map: Map<string, number>, value: string): void => {
      if (!value) return;
      map.set(value, (map.get(value) ?? 0) + 1);
    };
    bump(group.names, (row.program_name ?? '').trim());
    bump(group.schools, (row.school ?? '').trim());
    bump(group.codes, (row.Code ?? '').trim());
    group.sectionSet.add(section);
  }

  const majority = (map: Map<string, number>): string => {
    let best = '';
    let bestCount = 0;
    for (const [value, count] of map) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  };

  const groups2: Group[] = [...groups.values()]
    .map((group) => ({
      code: group.code,
      apiCode: majority(group.codes),
      name: majority(group.names),
      school: majority(group.schools),
      sections: [...group.sectionSet].sort((a, b) => {
        const left = parsePublished(a);
        const right = parsePublished(b);
        const byYear = romanValue(left.year) - romanValue(right.year);
        return byYear !== 0 ? byYear : a.localeCompare(b);
      }),
    }))
    .sort((a, b) => (a.school + a.name).localeCompare(b.school + b.name));

  const quote = (value: string): string =>
    `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

  let text = '';
  for (const group of groups2) {
    text += '  {\n';
    text += `    code: ${quote(group.code)},\n`;
    text += `    apiCode: ${quote(group.apiCode)},\n`;
    text += `    name: ${quote(group.name.replace(/\s+/g, ' ').trim())},\n`;
    text += `    school: ${quote(group.school)},\n`;
    text += `    sections: [${group.sections.map(quote).join(', ')}],\n`;
    text += '  },\n';
  }

  if (output) {
    fs.writeFileSync(output, text, 'utf8');
    console.error(`wrote ${groups2.length} programmes to ${output}`);
  } else {
    process.stdout.write(text);
  }
}

main();
