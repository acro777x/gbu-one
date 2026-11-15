/**
 * Apply `supabase/schema.sql` to the live Supabase project.
 *
 * This is the ALTERNATIVE to pasting the file into the Supabase SQL editor.
 * It is much less error-prone for a 950-line script, and it can be re-run at
 * any time because the schema is idempotent.
 *
 * It needs the project's DATABASE PASSWORD, which is NOT in `.env` (the app
 * never needs it - it talks to Supabase over HTTP). Get it from:
 *
 *   Supabase dashboard -> Project Settings -> Database -> Connection string
 *   -> URI -> the part after the colon, before the "@"
 *
 * Then either:
 *
 *   set DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@HOST:5432/postgres
 *   node tools/apply_schema.js
 *
 * or pass it in the environment as SUPABASE_DB_PASSWORD together with
 * SUPABASE_DB_HOST (the pooler host) and SUPABASE_DB_PROJECT_REF.
 *
 * The script:
 *   1. reads supabase/schema.sql,
 *   2. runs it in ONE transaction, so a failure leaves the database exactly
 *      as it was - a half-applied schema is worse than none,
 *   3. verifies the result with the same checks as tools/check_schema.js.
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const { Client } = require('pg');

const ROOT = join(__dirname, '..');

function readEnv() {
  const env = {};
  try {
    const text = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    // .env is optional here: everything can come from the environment.
  }
  return env;
}

function resolveConnection(env) {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const url = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL || '';
  const projectRef = url.replace(/^https?:\/\//, '').split('.')[0];
  const password = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD;
  const host =
    process.env.SUPABASE_DB_HOST ||
    env.SUPABASE_DB_HOST ||
    (projectRef ? `db.${projectRef}.supabase.co` : '');
  const port = process.env.SUPABASE_DB_PORT || '5432';

  if (!password || !host) return null;
  const user = `postgres.${projectRef}`;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/postgres`;
}

async function main() {
  const env = { ...readEnv(), ...process.env };
  const connectionString = resolveConnection(env);

  if (!connectionString) {
    console.error('No database connection.');
    console.error('');
    console.error('Set DATABASE_URL, or SUPABASE_DB_PASSWORD (+ SUPABASE_DB_HOST).');
    console.error('The password is in Supabase -> Project Settings -> Database ->');
    console.error('Connection string -> URI, after the colon and before the "@".');
    console.error('');
    console.error('If you would rather paste it yourself, follow');
    console.error('docs/SUPABASE_PASTE_GUIDE.md instead - it takes five minutes.');
    process.exit(2);
  }

  const sql = readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf8');
  console.log(
    `Applying supabase/schema.sql (${sql.split('\n').length} lines) in ONE transaction...`,
  );

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  try {
    await client.connect();
  } catch (error) {
    console.error('Could not connect:', error.message);
    process.exit(2);
  }

  try {
    await client.query('BEGIN;');
    await client.query(sql);
    await client.query('COMMIT;');
    console.log('Committed.');
  } catch (error) {
    console.error('The schema failed:', error.message);
    try {
      await client.query('ROLLBACK;');
      console.error('Rolled back - the database is unchanged.');
    } catch {
      console.error('The rollback also failed; the transaction will abort on disconnect.');
    }
    await client.end().catch(() => {});
    process.exit(1);
  }

  await client.end().catch(() => {});

  console.log('');
  console.log('Now verifying...');
  const { execFileSync } = require('child_process');
  try {
    execFileSync(process.execPath, [join(__dirname, 'check_schema.js')], {
      stdio: 'inherit',
    });
  } catch {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
