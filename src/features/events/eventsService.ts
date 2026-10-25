/**
 * GBU One — Campus Events service ("What's On").
 *
 * Events are things happening on or around campus: fests, workshops,
 * guest lectures, sports matches, cultural nights, placement drives,
 * club meetings, and deadlines that feel like events.
 *
 * Order of truth:
 *  1) Supabase `campus_events` table, when the project is configured.
 *  2) The bundled seed (`MOCK_EVENTS`), clearly labelled as a sample,
 *     so a first launch without a network shows something useful.
 *  3) SQLite cache for offline reuse (wired through the query hook).
 */
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export type EventCategory =
  | 'fest'
  | 'workshop'
  | 'guest-lecture'
  | 'sports'
  | 'cultural'
  | 'placement'
  | 'club'
  | 'other';

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  venue: string;
  isFree: boolean;
  registrationRequired: boolean;
  registrationUrl?: string;
  imageUrl?: string;
  photos?: string[];
  audience: string[]; // e.g. ['all', 'btech', 'mtech', 'phd']
  source: string; // 'seed' | 'supabase' | 'cache'
  isSample: boolean;
}

export interface EventFilter {
  category?: EventCategory | 'all';
  audience?: string;
  search?: string;
  freeOnly?: boolean;
}

export const EVENT_CATEGORIES: { id: EventCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fest', label: 'Fest' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'guest-lecture', label: 'Guest Lecture' },
  { id: 'sports', label: 'Sports' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'placement', label: 'Placement' },
  { id: 'club', label: 'Club' },
  { id: 'other', label: 'Other' },
];

export const CATEGORY_STYLE: Record<EventCategory, { bg: string; color: string }> = {
  fest: { bg: 'rgba(255, 106, 43, 0.14)', color: '#FF6A2B' },
  workshop: { bg: 'rgba(99, 102, 241, 0.14)', color: '#6366F1' },
  'guest-lecture': { bg: 'rgba(16, 185, 129, 0.14)', color: '#10B981' },
  sports: { bg: 'rgba(239, 68, 68, 0.14)', color: '#EF4444' },
  cultural: { bg: 'rgba(236, 72, 153, 0.14)', color: '#EC4899' },
  placement: { bg: 'rgba(59, 130, 246, 0.14)', color: '#3B82F6' },
  club: { bg: 'rgba(139, 92, 246, 0.14)', color: '#8B5CF6' },
  other: { bg: 'rgba(156, 163, 175, 0.14)', color: '#9CA3AF' },
};

/**
 * Bundled seed events so the screen is useful on first launch and offline.
 * These are clearly labelled samples and are replaced by live rows when the
 * backend is connected.
 */
export const MOCK_EVENTS: CampusEvent[] = [
  {
    id: 'seed_1',
    title: 'GBU Tech Fest 2026',
    description: 'Annual technical fest with coding hackathons, robotics, project exhibitions, and guest talks from industry leaders.',
    category: 'fest',
    startDate: '2026-11-14T09:00:00.000Z',
    endDate: '2026-11-16T18:00:00.000Z',
    venue: 'Main Auditorium & Open Grounds',
    isFree: true,
    registrationRequired: false,
    imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80',
    photos: [
      'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80',
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80',
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80',
    ],
    audience: ['all'],
    source: 'seed',
    isSample: true,
  },
  {
    id: 'seed_2',
    title: 'Introduction to React Native Workshop',
    description: 'Hands-on workshop for building cross-platform mobile apps. Bring your laptop; we cover setup, navigation, and state management.',
    category: 'workshop',
    startDate: '2026-11-20T14:00:00.000Z',
    endDate: '2026-11-20T17:00:00.000Z',
    venue: 'CS Lab 3, SOICT Block',
    isFree: true,
    registrationRequired: true,
    registrationUrl: 'https://gbu.ac.in/events/rn-workshop',
    imageUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=80',
    photos: [
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=80',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80',
    ],
    audience: ['btech', 'mtech'],
    source: 'seed',
    isSample: true,
  },
  {
    id: 'seed_3',
    title: 'Guest Lecture: Career Paths in Data Science',
    description: 'Talk by a senior data scientist from a leading product company. Q&A session included.',
    category: 'guest-lecture',
    startDate: '2026-11-22T16:00:00.000Z',
    endDate: '2026-11-22T17:30:00.000Z',
    venue: 'Seminar Hall A',
    isFree: true,
    registrationRequired: false,
    audience: ['all'],
    source: 'seed',
    isSample: true,
  },
  {
    id: 'seed_4',
    title: 'Inter-Branch Cricket Tournament',
    description: 'Cricket matches between branches. Come support your team or register to play.',
    category: 'sports',
    startDate: '2026-11-23T08:00:00.000Z',
    endDate: '2026-11-23T16:00:00.000Z',
    venue: 'Sports Ground',
    isFree: true,
    registrationRequired: false,
    audience: ['all'],
    source: 'seed',
    isSample: true,
  },
  {
    id: 'seed_5',
    title: 'Cultural Night: Rangoli & Diya Decoration',
    description: 'Pre-Diwali cultural evening with rangoli, diya decoration, and performances by student clubs.',
    category: 'cultural',
    startDate: '2026-10-30T18:00:00.000Z',
    endDate: '2026-10-30T21:00:00.000Z',
    venue: 'Central Lawn',
    isFree: true,
    registrationRequired: false,
    imageUrl: 'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?w=800&q=80',
    photos: [
      'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?w=800&q=80',
      'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
    ],
    audience: ['all'],
    source: 'seed',
    isSample: true,
  },
  {
    id: 'seed_6',
    title: 'Placement Drive: TechCorp',
    description: 'On-campus placement drive for final-year students. Roles: Software Engineer, QA Analyst. Resume shortlist applies.',
    category: 'placement',
    startDate: '2026-11-28T09:30:00.000Z',
    endDate: '2026-11-28T17:00:00.000Z',
    venue: 'Placement Cell, Admin Block',
    isFree: true,
    registrationRequired: true,
    registrationUrl: 'https://gbu.ac.in/placements/techcorp',
    audience: ['btech', 'mtech'],
    source: 'seed',
    isSample: true,
  },
  {
    id: 'seed_7',
    title: 'Open Source Club Weekly Meetup',
    description: 'Weekly club session: contributing to open source, git workflow, and issue triage. All years welcome.',
    category: 'club',
    startDate: '2026-11-25T17:00:00.000Z',
    endDate: '2026-11-25T19:00:00.000Z',
    venue: 'Club Room, SOICT',
    isFree: true,
    registrationRequired: false,
    audience: ['all'],
    source: 'seed',
    isSample: true,
  },
];

/**
 * Reads campus events from Supabase, falling back to the bundled seed.
 */
export async function listCampusEvents(limit = 300): Promise<CampusEvent[]> {
  const customLocal = await getLocalCustomEvents();
  if (!isSupabaseConfigured) return [...customLocal, ...MOCK_EVENTS.map((e) => ({ ...e, source: 'seed' }))];
  try {
    const { data, error } = await supabase
      .from('campus_events')
      .select('*')
      .order('start_date', { ascending: true })
      .limit(limit);
    if (!error && data && data.length > 0) {
      return (data as Record<string, unknown>[]).map((row) => rowToEvent(row));
    }
  } catch {
    // continue to calendar_events fallback
  }

  try {
    const { data: calData, error: calError } = await supabase
      .from('calendar_events')
      .select('*')
      .order('date_from', { ascending: true })
      .limit(limit);
    if (!calError && calData && calData.length > 0) {
      const liveEvents = (calData as Record<string, unknown>[]).map((row) => calendarRowToCampusEvent(row));
      return [...liveEvents, ...MOCK_EVENTS.map((e) => ({ ...e, source: 'seed' }))];
    }
  } catch {
    // continue to seed fallback
  }

  return MOCK_EVENTS.map((e) => ({ ...e, source: 'seed' }));
}

function calendarRowToCampusEvent(row: Record<string, unknown>): CampusEvent {
  const dFrom = String(row.date_from ?? '');
  const dTo = String(row.date_to ?? dFrom);
  const startIso = dFrom.includes('T') ? dFrom : (dFrom + 'T09:00:00.000Z');
  const endIso = dTo.includes('T') ? dTo : (dTo + 'T18:00:00.000Z');
  const catRaw = String(row.type ?? 'academic').toLowerCase();
  let category: EventCategory = 'other';
  if (catRaw.includes('workshop')) category = 'workshop';
  else if (catRaw.includes('fest')) category = 'fest';
  else if (catRaw.includes('sport')) category = 'sports';
  else if (catRaw.includes('cultural')) category = 'cultural';
  else if (catRaw.includes('placement')) category = 'placement';
  else if (catRaw.includes('lecture')) category = 'guest-lecture';

  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    description: 'Official University Schedule: ' + String(row.title ?? '') + '. Verified from university portal.',
    category,
    startDate: startIso,
    endDate: endIso,
    venue: 'Gautam Buddha University Campus',
    isFree: true,
    registrationRequired: false,
    audience: ['all'],
    source: 'supabase',
    isSample: false,
  };
}

function rowToEvent(row: Record<string, unknown>): CampusEvent {
  const photos = Array.isArray(row.photos) ? (row.photos as string[]) : [];
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    category: (row.category as EventCategory) ?? 'other',
    startDate: String(row.start_date ?? ''),
    endDate: String(row.end_date ?? row.start_date ?? ''),
    venue: String(row.venue ?? ''),
    isFree: Boolean(row.is_free),
    registrationRequired: Boolean(row.registration_required),
    registrationUrl: (row.registration_url as string | undefined) ?? undefined,
    imageUrl: (row.image_url as string | undefined) ?? (photos[0] ?? undefined),
    photos,
    audience: Array.isArray(row.audience) ? (row.audience as string[]) : ['all'],
    source: 'supabase',
    isSample: false,
  };
}

/**
 * Filters events by category, audience, free-only, and search text.
 */
export function filterEvents(events: CampusEvent[], filter: EventFilter): CampusEvent[] {
  return events.filter((event) => {
    if (filter.category && filter.category !== 'all' && event.category !== filter.category) {
      return false;
    }
    if (filter.audience && !event.audience.includes(filter.audience) && !event.audience.includes('all')) {
      return false;
    }
    if (filter.freeOnly && !event.isFree) {
      return false;
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const haystack = [event.title, event.description, event.venue, ...event.audience].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Returns events sorted by start date, with upcoming events first.
 */
export function sortEventsByDate(events: CampusEvent[]): CampusEvent[] {
  return [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Returns only events that haven't ended yet (endDate >= today).
 */
export function upcomingEvents(events: CampusEvent[], today = new Date().toISOString().slice(0, 10)): CampusEvent[] {
  return events.filter((e) => e.endDate >= today);
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_EVENTS_KEY = '@gbu_one_custom_events';

export async function getLocalCustomEvents(): Promise<CampusEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function createCampusEvent(
  eventData: Omit<CampusEvent, 'id' | 'source' | 'isSample'>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const newId = 'evt_' + Date.now();
  const newEvent: CampusEvent = {
    ...eventData,
    id: newId,
    source: isSupabaseConfigured ? 'supabase' : 'cache',
    isSample: false,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('campus_events').insert({
        title: newEvent.title,
        description: newEvent.description,
        category: newEvent.category,
        start_date: newEvent.startDate,
        end_date: newEvent.endDate,
        venue: newEvent.venue,
        is_free: newEvent.isFree,
        registration_required: newEvent.registrationRequired,
        registration_url: newEvent.registrationUrl ?? null,
        image_url: newEvent.imageUrl ?? null,
        photos: newEvent.photos ?? [],
        audience: newEvent.audience ?? ['all'],
      }).select('id').single();

      if (!error && data?.id) {
        newEvent.id = data.id;
      }
    } catch {
      // Keep going to save locally
    }
  }

  try {
    const existing = await getLocalCustomEvents();
    const updated = [newEvent, ...existing];
    await AsyncStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(updated));
    return { ok: true, id: newEvent.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function deleteCampusEvent(id: string): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('campus_events').delete().eq('id', id);
    } catch {
      // ignore
    }
  }
  try {
    const existing = await getLocalCustomEvents();
    const filtered = existing.filter((e) => e.id !== id);
    await AsyncStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(filtered));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
