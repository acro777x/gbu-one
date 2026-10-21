import { collectCalendarRows } from '../worker/calendarJob';

async function main() {
  const result = await collectCalendarRows();
  console.log('ok:', result.ok);
  console.log('events:', result.events.length, 'slots:', result.slots.length);
  console.log('reasons:', result.reasons);
  for (const event of result.events.slice(0, 6)) {
    console.log(`  ${event.date_from} -> ${event.date_to} [${event.type}] ${event.title}`);
  }
}

void main();
