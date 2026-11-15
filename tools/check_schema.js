/**
 * Is the new schema in the live Supabase project?
 *
 * READ-ONLY. It only ever reads.
 *
 * The app code now targets the schema in `supabase/schema.sql`, but the live
 * database may still be running the old one. When it is, the admin console's
 * "Initial Setup", the What's-On screen, the compulsory-update screen, PYQ
 * uploads and the student report list all fail at runtime - and the app does
 * not crash, it falls back to bundled data. So this check is worth running
 * after every paste.
 *
 * Usage:
 *   node tools/check_schema.js
 *
 * It reads the connection details from `.env`:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');

function readEnv() {
  const env = {};
  let text = '';
  try {
    text = readFileSync(join(ROOT, '.env'), 'utf8');
  } catch {
    console.error('No .env found. Create one from .env.example.');
    process.exit(2);
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
  return env;
}

// Everything the schema in supabase/schema.sql adds.
const TABLES = [
  'admin_claims',
  'campus_events',
  'app_versions',
  'results_push_log',
];
const FUNCTIONS = [
  'is_moderator',
  'is_owner',
  'claim_initial_admin',
  'has_any_moderator',
  'set_moderator',
  'remove_moderator',
];
const COLUMNS = [
  ['pyq_papers', 'uploader_student_id'],
  ['pyq_papers', 'uploader_name'],
  ['pyq_papers', 'uploader_avatar'],
  ['pyq_papers', 'file_size_bytes'],
  ['reports', 'reporter_student_id'],
  ['reports', 'reporter_name'],
  ['reports', 'reporter_email'],
  ['reports', 'type'],
  ['reports', 'category'],
  ['reports', 'status'],
  ['reports', 'admin_response'],
];

async function main() {
  const env = readEnv();
  const url = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.');
    process.exit(2);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  let missing = 0;

  console.log('NEW TABLES');
  for (const table of TABLES) {
    const { error } = await sb.from(table).select('*').limit(1);
    const gone = Boolean(error);
    if (gone) missing += 1;
    console.log(`  ${gone ? 'MISSING' : 'PRESENT'}  ${table}`);
  }

  console.log('\nNEW FUNCTIONS');
  for (const fn of FUNCTIONS) {
    const { error } = await sb.rpc(
      fn,
      fn === 'set_moderator' || fn === 'remove_moderator'
        ? { target_email: 'probe@example.invalid', target_role: 'moderator' }
        : {},
    );
    const gone = Boolean(error && /Could not find the function/i.test(error.message));
    if (gone) missing += 1;
    console.log(`  ${gone ? 'MISSING' : 'PRESENT'}  ${fn}()`);
  }

  console.log('\nNEW COLUMNS');
  for (const [table, column] of COLUMNS) {
    const { error } = await sb.from(table).select(column).limit(1);
    const gone = Boolean(error);
    if (gone) missing += 1;
    console.log(`  ${gone ? 'MISSING' : 'PRESENT'}  ${table}.${column}`);
  }

  console.log('\nVIEW AND BUCKET');
  const view = await sb.from('pyq_contributor_points').select('*').limit(1);
  const viewGone = Boolean(view.error);
  if (viewGone) missing += 1;
  console.log(`  ${viewGone ? 'MISSING' : 'PRESENT'}  view pyq_contributor_points`);

  const buckets = await sb.storage.listBuckets();
  const names = (buckets.data || []).map((b) => b.id);
  const bucketGone = !names.includes('pyq-files');
  if (bucketGone) missing += 1;
  console.log(`  ${bucketGone ? 'MISSING' : 'PRESENT'}  bucket pyq-files`);
  console.log(`  buckets present: ${names.sort().join(', ')}`);

  console.log('\nTHE PRIVATE BUCKET MUST STAY PRIVATE');
  for (const bucket of names) {
    const found = (buckets.data || []).find((b) => b.id === bucket);
    const flag = bucket === 'pyq-pending' ? (found?.public ? 'PUBLIC - WRONG' : 'private - correct') : '';
    if (flag) console.log(`  ${bucket}: ${flag}`);
  }

  console.log('');
  if (missing === 0) {
    console.log('RESULT: the new schema IS live. Nothing to do.');
  } else {
    console.log(`RESULT: the new schema is NOT live yet - ${missing} thing(s) missing.`);
    console.log('Follow docs/SUPABASE_PASTE_GUIDE.md.');
  }
  process.exit(missing === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('The check could not run:', error.message);
  process.exit(2);
});
