import { fetchAcademicCalendar } from '../worker/academicCalendar';

async function main() {
  const result = await fetchAcademicCalendar();
  console.log('ok:', result.ok, 'source:', result.source, 'reason:', result.reason ?? '-');
  for (const event of result.events) {
    console.log(
      `  ${event.semester.padEnd(8)} ${(event.startDate ?? '?').padEnd(11)} ${(event.endDate ?? '').padEnd(11)} ${event.name}`,
    );
  }
}

void main();
