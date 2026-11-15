/**
 * The row level security audit.
 *
 * It asks the DATABASE what a real client can do, by switching to the very
 * role PostgREST uses for an anonymous request and for a signed-in student.
 * That is the only way to test a policy honestly - the REST API always goes
 * through as the service role, which bypasses row level security entirely
 * and therefore proves nothing.
 *
 * It needs the database password. It is READ-ONLY: every statement runs in a
 * transaction that is rolled back.
 *
 *   set DATABASE_URL=postgresql://...
 *   node tools/rls_audit.js
 */
const { Client } = require('pg');
const { readFileSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  let env = {};
  try {
    const text = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    // .env is optional here.
  }
  const ref = (env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL || '')
    .replace(/^https?:\/\//, '')
    .split('.')[0];
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) return null;
  const region = process.env.SUPABASE_DB_REGION || 'ap-south-1';
  return `postgresql://${encodeURIComponent(`postgres.${ref}`)}:${encodeURIComponent(
    password,
  )}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
}

const STUDENT = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'student@example.com',
  role: 'authenticated',
};

/** Each case: whether a client of this role must be ALLOWED or FORBIDDEN. */
const CASES = [
  {
    role: 'anon',
    claims: { role: 'anon' },
    name: 'an anonymous client',
    must: [
      ['read APPROVED papers', "select count(*)::int as n from public.pyq_papers where status='approved'", 'n', 'allowed', (v) => v > 0],
      ['read PENDING papers (the moderation queue)', "select count(*)::int as n from public.pyq_papers where status<>'approved'", 'n', 'forbidden', (v) => v === 0],
      ['read the moderator allowlist', 'select count(*)::int as n from public.moderators', 'n', 'forbidden', (v) => v === 0],
      ['read student reports', 'select count(*)::int as n from public.reports', 'n', 'forbidden', (v) => v === 0],
      ['read the worker log', 'select count(*)::int as n from public.worker_runs', 'n', 'forbidden', (v) => v === 0],
      ['read the push ledger', 'select count(*)::int as n from public.results_push_log', 'n', 'forbidden', (v) => v === 0],
      ['write a campus event', "insert into public.campus_events (title,start_date,end_date) values ('probe','2026-01-01','2026-01-02')", null, 'forbidden'],
      ['write a notice', "insert into public.notices (source,source_id,title,clean_title,posted_at) values ('probe','probe-1','t','t',now())", null, 'forbidden'],
      ['write into the worker log', "insert into public.worker_runs (source,status) values ('probe','ok')", null, 'forbidden'],
      ['write a report', "insert into public.reports (reporter_id,reason) values (null,'probe')", null, 'forbidden'],
      ['write into the dead pyq_reports table', "insert into public.pyq_reports (paper_id,reason) values (null,'probe')", null, 'forbidden'],
    ],
  },
  {
    role: 'anon',
    claims: { role: 'anon' },
    name: 'a guest uploading a question paper',
    must: [
      ['queue a paper as pending', "insert into public.pyq_papers (school,programme_code,semester,subject_code,subject_name,year,exam_type,file_path,status,uploader_student_id) values ('S','P','I','C','C',2026,'End Sem','f.pdf','pending','GBU-PROBE')", null, 'allowed'],
      ['but NOT change a paper they can see', "update public.pyq_papers set subject_name='hacked' where status='approved'", null, 'forbidden'],
    ],
  },
  {
    role: 'authenticated',
    claims: STUDENT,
    name: 'a signed-in student who is not a moderator',
    must: [
      ['read the moderator allowlist', 'select count(*)::int as n from public.moderators', 'n', 'forbidden', (v) => v === 0],
      ['read somebody else\'s report', "select count(*)::int as n from public.reports where reporter_email<>'student@example.com'", 'n', 'forbidden', (v) => v === 0],
      ['write a campus event', "insert into public.campus_events (title,start_date,end_date) values ('probe','2026-01-01','2026-01-02')", null, 'forbidden'],
      ['write a notice', "insert into public.notices (source,source_id,title,clean_title,posted_at) values ('probe','probe-2','t','t',now())", null, 'forbidden'],
      ['change a paper they can see', "update public.pyq_papers set subject_name='hacked' where status='approved'", null, 'forbidden'],
      ['add a moderator', "insert into public.moderators (email,role) values ('probe@example.invalid','owner')", null, 'forbidden'],
      ['but CAN queue their own paper', "insert into public.pyq_papers (school,programme_code,semester,subject_code,subject_name,year,exam_type,file_path,status,uploader_id,uploader_student_id) values ('S','P','I','C','C',2026,'End Sem','f.pdf','pending','11111111-1111-4111-8111-111111111111','GBU-PROBE2')", null, 'allowed'],
    ],
  },
];

async function main() {
  const url = databaseUrl();
  if (!url) {
    console.error('Set DATABASE_URL or SUPABASE_DB_PASSWORD to run the audit.');
    process.exit(2);
  }
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  await client.connect();
  const q = async (sql, params) => (await client.query(sql, params)).rows;

  let failures = 0;
  let checks = 0;

  for (const group of CASES) {
    console.log(`\n=== ${group.name} (role: ${group.role}) ===`);
    for (const [label, sql, field, mode, check] of group.must) {
      checks += 1;
      await q('begin');
      let ok = false;
      let detail = '';
      try {
        await q(`set local role ${group.role}`);
        await q("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify(group.claims),
        ]);
        const rows = await q(sql);
        if (field) {
          // A count query always returns exactly one row; the VALUE is what
          // matters, not the number of rows.
          const value = rows[0]?.[field];
          ok = check ? Boolean(check(value)) : value === 0;
          detail = ` -> ${value}`;
        } else if (mode === 'forbidden' && sql.trim().toLowerCase().startsWith('update')) {
          // An UPDATE that matches nothing raises NO error, so "no error"
          // proves nothing. The row has to be read back to see whether it
          // actually changed. `reset role` returns the session to the
          // superuser without ending the transaction.
          await q('reset role');
          const after = await q(
            "select count(*)::int as n from public.pyq_papers where subject_name='hacked'",
          );
          const changed = after[0].n;
          ok = changed === 0;
          detail = ` -> ${changed} row(s) changed`;
        } else {
          // A write. It must have been accepted (forbidden) or refused.
          // An INSERT without RETURNING returns no rows, so "no rows" says
          // nothing - only the absence of an error does.
          ok = mode === 'forbidden' ? false : true;
          detail = ' -> accepted';
        }
      } catch (error) {
        const refused =
          error.message.includes('row-level security') ||
          error.message.includes('does not exist');
        if (mode === 'forbidden') {
          ok = refused;
          detail = ` -> refused (${error.message.slice(0, 44)})`;
        } else {
          ok = false;
          detail = ` -> REFUSED but should have been allowed: ${error.message.slice(0, 48)}`;
        }
      }
      await q('rollback').catch(() => {});
      if (!ok) failures += 1;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(46)}${detail}`);
    }
  }

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('The audit could not run:', error.message);
  process.exit(2);
});
