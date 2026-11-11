/**
 * GBU One — Offline-first SQLite cache (expo-sqlite, sync API).
 * Tables: notices_cache, timetable_cache, kv_meta.
 * UI reads here FIRST (instant render); TanStack Query refreshes from the
 * network and rewrites the cache. No-op in Jest (no native module).
 */
import type { NoticeItem } from '../features/notices/noticeService';
import type { Timetable } from '../features/timetable/timetableProvider';
import type { CampusEvent } from '../features/events/eventsService';

let SQLite: typeof import('expo-sqlite') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SQLite = require('expo-sqlite');
} catch {
  SQLite = null;
}

export const isSqliteAvailable = (): boolean => SQLite !== null;

type Db = {
  runSync: (sql: string, params?: unknown[]) => void;
  getAllSync: <T>(sql: string, params?: unknown[]) => T[];
  getFirstSync: <T>(sql: string, params?: unknown[]) => T | null;
};

let db: Db | null = null;
let dbUnavailableWarned = false;

// Bumped whenever the local schema changes. `PRAGMA user_version` is the
// only migration mechanism a plain SQLite file has, and without it a schema
// change can never reach the devices that already have the database.
const SCHEMA_VERSION = 2;

function getDb(): Db | null {
  if (!SQLite) return null;
  if (!db) {
    try {
      db = SQLite.openDatabaseSync('gbu-one.db') as unknown as Db;

      // WAL keeps a read from blocking a write (the UI reads the cache while
      // a refresh is writing to it). The old default journal mode made the
      // screen throw SQLITE_BUSY under exactly that pattern.
      try {
        db.runSync('PRAGMA journal_mode = WAL;');
        db.runSync('PRAGMA foreign_keys = ON;');
      } catch {
        // PRAGMAs are best effort - a device that refuses WAL still works.
      }

      db.runSync(`CREATE TABLE IF NOT EXISTS notices_cache (
        source_id TEXT PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL,
        clean_title TEXT NOT NULL, posted_at TEXT NOT NULL, file_url TEXT NOT NULL,
        file_type TEXT NOT NULL DEFAULT 'pdf', category TEXT NOT NULL DEFAULT 'other',
        audience TEXT NOT NULL DEFAULT '{}', importance INTEGER NOT NULL DEFAULT 0,
        deadline_at TEXT, payload TEXT NOT NULL, updated_at INTEGER NOT NULL);`);
      db.runSync(`CREATE TABLE IF NOT EXISTS timetable_cache (
        class_key TEXT NOT NULL, session_id TEXT NOT NULL,
        payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (class_key, session_id));`);
      db.runSync(`CREATE TABLE IF NOT EXISTS campus_events_cache (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other', start_date TEXT NOT NULL,
        end_date TEXT NOT NULL, venue TEXT NOT NULL DEFAULT '',
        is_free INTEGER NOT NULL DEFAULT 1, registration_required INTEGER NOT NULL DEFAULT 0,
        registration_url TEXT, image_url TEXT, audience TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'seed', is_sample INTEGER NOT NULL DEFAULT 1,
        payload TEXT NOT NULL, updated_at INTEGER NOT NULL);`);

      db.runSync(`CREATE TABLE IF NOT EXISTS kv_meta (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);`);

      // The two hot reads are `ORDER BY posted_at DESC` and
      // `ORDER BY start_date ASC` over the whole table. Without an index
      // both are a full scan plus a sort on every screen open.
      try {
        db.runSync('CREATE INDEX IF NOT EXISTS notices_cache_posted_at_idx ON notices_cache (posted_at DESC);');
        db.runSync('CREATE INDEX IF NOT EXISTS campus_events_cache_start_date_idx ON campus_events_cache (start_date ASC);');
      } catch {
        // An index is an optimisation, never a correctness requirement.
      }

      migrateLocalSchema(db);
    } catch {
      db = null;
      if (!dbUnavailableWarned) {
        dbUnavailableWarned = true;
        console.warn(
          '[gbu-one] the offline cache is unavailable; the app will run without it.',
        );
      }
      return null;
    }
  }
  return db;
}

/**
 * Brings an already-installed database up to SCHEMA_VERSION. Every step must
 * be idempotent, because the file survives an app upgrade.
 */
function migrateLocalSchema(d: Db): void {
  let version = 0;
  try {
    const row = d.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
    version = Number(row?.user_version ?? 0) || 0;
  } catch {
    version = 0;
  }
  if (version >= SCHEMA_VERSION) return;

  try {
    if (version < 2) {
      // v2: the index statements above, plus the notices_cache columns added
      // after v1 shipped. SQLite has no IF NOT EXISTS for a column, so the
      // statements are guarded by a try.
      try {
        d.runSync('CREATE INDEX IF NOT EXISTS notices_cache_posted_at_idx ON notices_cache (posted_at DESC);');
      } catch {
        // already there
      }
      try {
        d.runSync('CREATE INDEX IF NOT EXISTS campus_events_cache_start_date_idx ON campus_events_cache (start_date ASC);');
      } catch {
        // already there
      }
    }
    d.runSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  } catch {
    // A failed migration must not stop the app from starting.
  }
}

/** Closes the handle. Used by the tests and by a hot reload. */
export function closeDb(): void {
  if (!db) return;
  try {
    (db as unknown as { closeSync?: () => void }).closeSync?.();
  } catch {
    // ignore
  }
  db = null;
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readCachedNotices(limit = 300): NoticeItem[] {
  const d = getDb();
  if (!d) return [];
  try {
    const rows = d.getAllSync<{ payload: string }>(
      'SELECT payload FROM notices_cache ORDER BY posted_at DESC LIMIT ?;', [limit]);
    return rows
      .map((r) => safeJsonParse<NoticeItem | null>(r.payload, null))
      .filter((n): n is NoticeItem => !!n && typeof n.sourceId === 'string')
      .map((n) => ({
        ...n,
        audience: (n.audience && typeof n.audience === 'object') ? n.audience : { all: true, schools: [] },
      }));
  } catch {
    return [];
  }
}


export function writeCachedNotices(notices: NoticeItem[]): void {
  const d = getDb();
  if (!d || notices.length === 0) return;
  try {
    const now = Date.now();
    for (const n of notices) {
      d.runSync(
        `INSERT INTO notices_cache
           (source_id, source, title, clean_title, posted_at, file_url, file_type,
            category, audience, importance, deadline_at, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(source_id) DO UPDATE SET
           title=excluded.title, clean_title=excluded.clean_title,
           posted_at=excluded.posted_at, file_url=excluded.file_url,
           file_type=excluded.file_type, category=excluded.category,
           audience=excluded.audience, importance=excluded.importance,
           deadline_at=excluded.deadline_at, payload=excluded.payload,
           updated_at=excluded.updated_at;`,
        [n.sourceId, n.source, n.title, n.cleanTitle, n.postedAt, n.fileUrl,
         n.fileType, n.category, JSON.stringify(n.audience ?? {}), n.importance,
         n.deadlineAt ?? null, JSON.stringify(n), now]);
    }
  } catch {
    // cache writes must never crash the UI
  }
}

export function deleteCachedNotice(sourceId: string): void {
  const d = getDb();
  if (!d || !sourceId) return;
  try {
    d.runSync('DELETE FROM notices_cache WHERE source_id = ?;', [sourceId]);
  } catch {
    // ignore
  }
}

export function getNoticesCacheTime(): number | null {
  const d = getDb();
  if (!d) return null;
  try {
    const row = d.getFirstSync<{ updated_at: number }>(
      'SELECT MAX(updated_at) AS updated_at FROM notices_cache;');
    return row?.updated_at ?? null;
  } catch {
    return null;
  }
}

export function readCachedTimetable(classKey: string, sessionId: string): Timetable | null {
  const d = getDb();
  if (!d) return null;
  try {
    const row = d.getFirstSync<{ payload: string }>(
      'SELECT payload FROM timetable_cache WHERE class_key = ? AND session_id = ?;',
      [classKey.trim().toUpperCase(), sessionId]);
    if (!row) return null;
    return safeJsonParse<Timetable | null>(row.payload, null);
  } catch {
    return null;
  }
}

export function writeCachedTimetable(classKey: string, sessionId: string, tt: Timetable): void {
  const d = getDb();
  if (!d) return;
  try {
    d.runSync(
      `INSERT INTO timetable_cache (class_key, session_id, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(class_key, session_id) DO UPDATE SET
         payload=excluded.payload, updated_at=excluded.updated_at;`,
      [classKey.trim().toUpperCase(), sessionId, JSON.stringify(tt), Date.now()]);
  } catch {
    // ignore
  }
}

export function readMeta(key: string): string | null {
  const d = getDb();
  if (!d) return null;
  try {
    const row = d.getFirstSync<{ value: string }>(
      'SELECT value FROM kv_meta WHERE key = ?;', [key]);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function writeMeta(key: string, value: string): void {
  const d = getDb();
  if (!d) return;
  try {
    d.runSync(
      `INSERT INTO kv_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;`,
      [key, value, Date.now()]);
  } catch {
    // ignore
  }
}

export function readCachedEvents(limit = 300): CampusEvent[] {
  const d = getDb();
  if (!d) return [];
  try {
    const rows = d.getAllSync<{ payload: string }>(
      'SELECT payload FROM campus_events_cache ORDER BY start_date ASC LIMIT ?;',
      [limit]);
    return rows
      .map((r) => safeJsonParse<CampusEvent | null>(r.payload, null))
      .filter((e): e is CampusEvent => !!e && typeof e.id === 'string');
  } catch {
    return [];
  }
}

export function deleteCachedEvent(id: string): void {
  const d = getDb();
  if (!d || !id) return;
  try {
    d.runSync('DELETE FROM campus_events_cache WHERE id = ?;', [id]);
  } catch {
    // ignore
  }
}

export function writeCachedEvents(events: CampusEvent[]): void {
  const d = getDb();
  if (!d) return;
  try {
    const now = Date.now();
    const activeIds = events.map((e) => e.id).filter(Boolean);
    if (activeIds.length > 0) {
      const placeholders = activeIds.map(() => '?').join(',');
      d.runSync(
        `DELETE FROM campus_events_cache WHERE id NOT IN (${placeholders});`,
        activeIds,
      );
    } else {
      d.runSync('DELETE FROM campus_events_cache;');
    }
    for (const e of events) {
      d.runSync(
        `INSERT INTO campus_events_cache
           (id, title, description, category, start_date, end_date, venue,
            is_free, registration_required, registration_url, image_url,
            audience, source, is_sample, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, description=excluded.description,
           category=excluded.category, start_date=excluded.start_date,
           end_date=excluded.end_date, venue=excluded.venue,
           is_free=excluded.is_free, registration_required=excluded.registration_required,
           registration_url=excluded.registration_url, image_url=excluded.image_url,
           audience=excluded.audience, source=excluded.source,
           is_sample=excluded.is_sample, payload=excluded.payload,
           updated_at=excluded.updated_at;`,
        [e.id, e.title, e.description, e.category, e.startDate, e.endDate,
         e.venue, e.isFree ? 1 : 0, e.registrationRequired ? 1 : 0,
         e.registrationUrl ?? null, e.imageUrl ?? null,
         JSON.stringify(e.audience), e.source, e.isSample ? 1 : 0,
         JSON.stringify(e), now]);
    }
  } catch {
    // cache writes must never crash the UI
  }
}
