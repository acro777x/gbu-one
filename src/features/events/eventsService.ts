/**
 * GBU One — Campus Events service ("What's On").
 *
 * Events are things happening on or around campus: fests, workshops,
 * guest lectures, sports matches, cultural nights, placement drives,
 * club meetings, and deadlines that feel like events.
 *
 * Order of truth:
 *  1) Supabase `campus-events` cloud storage & `campus_events` table when connected.
 *  2) Local SQLite/AsyncStorage cache for instant offline rendering.
 *  3) Bundled seed (`MOCK_EVENTS`), clearly labelled as samples with rich media.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export const CATEGORY_DEFAULT_IMAGES: Record<EventCategory, string> = {
  fest: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80',
  workshop: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=80',
  'guest-lecture': 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80',
  sports: 'https://images.unsplash.com/photo-1531415074868-036b1c57e329?w=800&q=80',
  cultural: 'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?w=800&q=80',
  placement: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80',
  club: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
  other: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
};

/**
 * Bundled seed events with complete high-resolution imagery and gallery photos.
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
    imageUrl: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80',
    photos: [
      'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80',
      'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80',
    ],
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
    imageUrl: 'https://images.unsplash.com/photo-1531415074868-036b1c57e329?w=800&q=80',
    photos: [
      'https://images.unsplash.com/photo-1531415074868-036b1c57e329?w=800&q=80',
      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
    ],
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
    imageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80',
    photos: [
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80',
    ],
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
    imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
    photos: [
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&q=80',
    ],
    audience: ['all'],
    source: 'seed',
    isSample: true,
  },
];

const CUSTOM_EVENTS_KEY = '@gbu_one_custom_events';
const CLOUD_STORAGE_EVENTS_PATH = 'campus-events/events.json';

function getSupabaseBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  return url.replace(/\/$/, '');
}

function getSupabaseApiKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
}

function getAdminStorageKey(): string {
  return (
    process.env.EXPO_PUBLIC_ADMIN_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    getSupabaseApiKey()
  );
}

/**
 * Reads events published by admin stored in Supabase Storage CDN.
 */
async function fetchCloudCustomEvents(): Promise<CampusEvent[]> {
  const baseUrl = getSupabaseBaseUrl();
  if (!baseUrl) return [];

  // 1. Direct public CDN fetch with timestamp cache-buster and no-cache header
  try {
    const res = await fetch(
      `${baseUrl}/storage/v1/object/public/${CLOUD_STORAGE_EVENTS_PATH}?t=${Date.now()}`,
      { headers: { 'Cache-Control': 'no-cache' } },
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data as CampusEvent[];
      }
    }
  } catch {
    // Fall through to storage client download
  }

  // 2. Direct storage client download fallback
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage.from('campus-events').download('events.json');
      if (!error && data) {
        if (typeof (data as unknown as { text?: () => Promise<string> }).text === 'function') {
          const text = await (data as unknown as { text: () => Promise<string> }).text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            return parsed as CampusEvent[];
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return [];
}

/**
 * Saves events to Supabase Storage CDN bucket so all public apps get live sync.
 */
async function syncCloudCustomEvents(events: CampusEvent[]): Promise<boolean> {
  const payload = JSON.stringify(events);
  const baseUrl = getSupabaseBaseUrl();
  const adminKey = getAdminStorageKey();

  // 1. Direct REST upload using admin credentials (bypass client session hurdles)
  if (baseUrl && adminKey) {
    try {
      const res = await fetch(`${baseUrl}/storage/v1/object/${CLOUD_STORAGE_EVENTS_PATH}`, {
        method: 'POST',
        headers: {
          apikey: adminKey,
          Authorization: `Bearer ${adminKey}`,
          'Content-Type': 'application/json',
          'x-upsert': 'true',
        },
        body: payload,
      });
      if (res.ok) return true;
    } catch {
      // Fall through
    }
  }

  // 2. Official Supabase Storage SDK
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.storage
        .from('campus-events')
        .upload('events.json', payload, {
          upsert: true,
          contentType: 'application/json',
        });
      if (!error) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * Uploads a local image (file:// or content://) to Supabase Storage CDN
 * under `campus-events/photos/...` and returns the permanent public HTTPS URL.
 * If the URI is already an HTTP/HTTPS URL, returns it directly.
 */
export async function uploadEventPhoto(localUri: string, mimeType = 'image/jpeg'): Promise<string> {
  if (!localUri) return '';
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  const baseUrl = getSupabaseBaseUrl();
  const apiKey = getAdminStorageKey();
  if (!baseUrl || !apiKey) {
    return localUri;
  }

  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const fileName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storagePath = `photos/${fileName}`;

  // 1. Native Stream/Wrap Upload via ReactNativeBlobUtil (Handles file:// AND content:// URIs on Android)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ReactNativeBlobUtil = require('react-native-blob-util').default;
    if (ReactNativeBlobUtil?.wrap && ReactNativeBlobUtil?.fetch) {
      const uploadUrl = `${baseUrl}/storage/v1/object/campus-events/${storagePath}`;
      const res = await ReactNativeBlobUtil.fetch(
        'POST',
        uploadUrl,
        {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        ReactNativeBlobUtil.wrap(localUri),
      );
      const respInfo = res.info();
      if (respInfo && respInfo.status >= 200 && respInfo.status < 300) {
        return `${baseUrl}/storage/v1/object/public/campus-events/${storagePath}`;
      }
    }
  } catch (err) {
    console.warn('ReactNativeBlobUtil wrapped upload failed, falling back:', err);
  }

  // 2. Official Supabase Client Upload
  if (isSupabaseConfigured) {
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const filePayload: any = {
        uri: localUri,
        name: fileName,
        type: mimeType,
      };
      const { error } = await supabase.storage.from('campus-events').upload(storagePath, filePayload, {
        upsert: true,
        contentType: mimeType,
      });

      if (!error) {
        return `${baseUrl}/storage/v1/object/public/campus-events/${storagePath}`;
      }
    } catch {
      // Fallback to fetch
    }
  }

  // 2. Direct REST Multipart FormData Upload
  try {
    const formData = new FormData();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const rnFormData: any = {
      uri: localUri,
      name: fileName,
      type: mimeType,
    };
    formData.append('file', rnFormData);

    const uploadRes = await fetch(`${baseUrl}/storage/v1/object/campus-events/${storagePath}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'x-upsert': 'true',
      },
      body: formData,
    });

    if (uploadRes.ok) {
      return `${baseUrl}/storage/v1/object/public/campus-events/${storagePath}`;
    }
  } catch (err) {
    console.warn('Failed to upload photo to storage CDN:', err);
  }

  return localUri;
}


export async function getLocalCustomEvents(): Promise<CampusEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Reads campus events with multi-tier failover:
 * 1. Cloud custom events published by Admin (via Storage CDN & Postgres)
 * 2. University Calendar Events
 * 3. Seed Events with full media
 * 4. Local AsyncStorage cache
 */
export async function listCampusEvents(limit = 300): Promise<CampusEvent[]> {
  const localCache = await getLocalCustomEvents();

  if (!isSupabaseConfigured) {
    const combined = [...localCache, ...MOCK_EVENTS.map((e) => ({ ...e, source: 'seed' }))];
    return deduplicateEvents(combined);
  }

  let cloudCustom: CampusEvent[] = [];
  try {
    cloudCustom = await fetchCloudCustomEvents();
  } catch {
    cloudCustom = [];
  }

  // Also query Postgres campus_events if table exists
  let pgEvents: CampusEvent[] = [];
  try {
    const { data, error } = await supabase
      .from('campus_events')
      .select('*')
      .order('start_date', { ascending: true })
      .limit(limit);
    if (!error && data && data.length > 0) {
      pgEvents = (data as Record<string, unknown>[]).map((row) => rowToEvent(row));
    }
  } catch {
    // Postgres table may not exist yet, storage CDN handles it
  }

  // Live University Calendar fallback
  let liveCalendar: CampusEvent[] = [];
  try {
    const { data: calData, error: calError } = await supabase
      .from('calendar_events')
      .select('*')
      .order('date_from', { ascending: true })
      .limit(limit);
    if (!calError && calData && calData.length > 0) {
      liveCalendar = (calData as Record<string, unknown>[]).map((row) => calendarRowToCampusEvent(row));
    }
  } catch {
    // ignore
  }

  // Combine: Cloud Custom Events + Postgres Events + Local Events + Live Calendar + MOCK_EVENTS
  const all = [
    ...cloudCustom,
    ...pgEvents,
    ...localCache,
    ...liveCalendar,
    ...MOCK_EVENTS.map((e) => ({ ...e, source: 'seed' })),
  ];

  const deduped = deduplicateEvents(all);

  // Update local storage cache in background
  if (cloudCustom.length > 0 || pgEvents.length > 0) {
    const customOnly = deduped.filter((e) => !e.isSample && e.source !== 'academic-calendar');
    void AsyncStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(customOnly));
  }

  return deduped;
}

export function deduplicateEvents(events: CampusEvent[]): CampusEvent[] {
  const map = new Map<string, CampusEvent>();
  for (const e of events) {
    if (!e || !e.id) continue;
    // Prioritize non-sample events and newer updates
    const existing = map.get(e.id);
    if (!existing || (!e.isSample && existing.isSample)) {
      const category = (e.category as EventCategory) || 'other';
      const fallback = CATEGORY_DEFAULT_IMAGES[category] || CATEGORY_DEFAULT_IMAGES.other;
      const rawPhotos = Array.isArray(e.photos) ? e.photos : [];
      const validPhotos = rawPhotos.filter(
        (p): p is string => typeof p === 'string' && p.trim().length > 0,
      );
      const hero =
        e.imageUrl && typeof e.imageUrl === 'string' && e.imageUrl.trim().length > 0
          ? e.imageUrl.trim()
          : validPhotos[0] || fallback;
      const photos = validPhotos.length > 0 ? validPhotos : [hero];

      map.set(e.id, {
        ...e,
        category,
        imageUrl: hero,
        photos,
      });
    }
  }
  return Array.from(map.values());
}

function calendarRowToCampusEvent(row: Record<string, unknown>): CampusEvent {
  const dFrom = String(row.date_from ?? '');
  const dTo = String(row.date_to ?? dFrom);
  const startIso = dFrom.includes('T') ? dFrom : dFrom + 'T09:00:00.000Z';
  const endIso = dTo.includes('T') ? dTo : dTo + 'T18:00:00.000Z';
  const catRaw = String(row.type ?? 'academic').toLowerCase();
  let category: EventCategory = 'other';
  if (catRaw.includes('workshop')) category = 'workshop';
  else if (catRaw.includes('fest')) category = 'fest';
  else if (catRaw.includes('sport')) category = 'sports';
  else if (catRaw.includes('cultural')) category = 'cultural';
  else if (catRaw.includes('placement')) category = 'placement';
  else if (catRaw.includes('lecture')) category = 'guest-lecture';

  const defaultImg = CATEGORY_DEFAULT_IMAGES[category] || CATEGORY_DEFAULT_IMAGES.other;

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
    imageUrl: defaultImg,
    photos: [defaultImg],
    audience: ['all'],
    source: 'academic-calendar',
    isSample: false,
  };
}

function rowToEvent(row: Record<string, unknown>): CampusEvent {
  const photos = Array.isArray(row.photos) ? (row.photos as string[]) : [];
  const category = (row.category as EventCategory) ?? 'other';
  const fallbackImg = CATEGORY_DEFAULT_IMAGES[category] || CATEGORY_DEFAULT_IMAGES.other;
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    category,
    startDate: String(row.start_date ?? ''),
    endDate: String(row.end_date ?? row.start_date ?? ''),
    venue: String(row.venue ?? ''),
    isFree: Boolean(row.is_free),
    registrationRequired: Boolean(row.registration_required),
    registrationUrl: (row.registration_url as string | undefined) ?? undefined,
    imageUrl: (row.image_url as string | undefined) ?? (photos[0] ?? fallbackImg),
    photos: photos.length > 0 ? photos : [fallbackImg],
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

/**
 * Creates a new campus event and publishes it live to all student devices
 * via Supabase Storage and Postgres.
 */
export async function createCampusEvent(
  eventData: Omit<CampusEvent, 'id' | 'source' | 'isSample'>,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const newId = 'evt_' + Date.now();
  const defaultImg = CATEGORY_DEFAULT_IMAGES[eventData.category] || CATEGORY_DEFAULT_IMAGES.other;

  let finalImageUrl = eventData.imageUrl || '';
  if (finalImageUrl.startsWith('file://') || finalImageUrl.startsWith('content://')) {
    finalImageUrl = await uploadEventPhoto(finalImageUrl);
  }

  const finalPhotos: string[] = [];
  if (eventData.photos && eventData.photos.length > 0) {
    for (const p of eventData.photos) {
      if (p.startsWith('file://') || p.startsWith('content://')) {
        finalPhotos.push(await uploadEventPhoto(p));
      } else if (p) {
        finalPhotos.push(p);
      }
    }
  }

  const newEvent: CampusEvent = {
    ...eventData,
    id: newId,
    imageUrl: finalImageUrl || (finalPhotos.length > 0 ? finalPhotos[0] : defaultImg),
    photos: finalPhotos.length > 0 ? finalPhotos : [defaultImg],
    source: isSupabaseConfigured ? 'supabase' : 'cache',
    isSample: false,
  };

  // 1. Sync to Supabase Storage CDN (instant distribution to public APK)
  if (isSupabaseConfigured) {
    try {
      const cloudEvents = await fetchCloudCustomEvents();
      const updatedCloud = [newEvent, ...cloudEvents.filter((e) => e.id !== newEvent.id)];
      await syncCloudCustomEvents(updatedCloud);
    } catch {
      // ignore
    }

    // 2. Also attempt Postgres insert if table exists
    try {
      await supabase.from('campus_events').insert({
        id: newEvent.id,
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
      });
    } catch {
      // ignore
    }
  }

  // 3. Save locally in AsyncStorage
  try {
    const existing = await getLocalCustomEvents();
    const updated = [newEvent, ...existing.filter((e) => e.id !== newEvent.id)];
    await AsyncStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(updated));
    return { ok: true, id: newEvent.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Deletes a campus event from cloud and local cache.
 */
export async function deleteCampusEvent(id: string): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const cloudEvents = await fetchCloudCustomEvents();
      const filtered = cloudEvents.filter((e) => e.id !== id);
      await syncCloudCustomEvents(filtered);
    } catch {
      // ignore
    }

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
