/**
 * Unit Tests for Campus Events Service & Photo Pipeline
 * Verifies image fallbacks, deduplication, photo array normalization,
 * date sorting, and category filters.
 */

import {
  deduplicateEvents,
  filterEvents,
  sortEventsByDate,
  upcomingEvents,
  CATEGORY_DEFAULT_IMAGES,
  CATEGORY_STYLE,
  MOCK_EVENTS,
  type CampusEvent,
  createCampusEvent,
  listCampusEvents,
} from '../src/features/events/eventsService';

describe('Campus Events Service & Deduplication', () => {
  it('covers all standard categories with valid styles and fallback images', () => {
    const expectedCategories = [
      'fest',
      'workshop',
      'guest-lecture',
      'sports',
      'cultural',
      'placement',
      'club',
      'other',
    ];

    for (const cat of expectedCategories) {
      expect(CATEGORY_DEFAULT_IMAGES[cat as keyof typeof CATEGORY_DEFAULT_IMAGES]).toBeDefined();
      expect(CATEGORY_DEFAULT_IMAGES[cat as keyof typeof CATEGORY_DEFAULT_IMAGES]).toMatch(/^https?:\/\//);
      expect(CATEGORY_STYLE[cat as keyof typeof CATEGORY_STYLE]).toBeDefined();
      expect(CATEGORY_STYLE[cat as keyof typeof CATEGORY_STYLE].color).toMatch(/^#[0-9A-Fa-f]{6}/);
    }
  });

  it('guarantees bundled seed events have high-resolution images and photos', () => {
    expect(MOCK_EVENTS.length).toBeGreaterThanOrEqual(4);
    for (const ev of MOCK_EVENTS) {
      expect(ev.imageUrl).toBeDefined();
      expect(ev.imageUrl).toMatch(/^https?:\/\//);
      expect(Array.isArray(ev.photos)).toBe(true);
      expect(ev.photos!.length).toBeGreaterThanOrEqual(1);
      expect(ev.isSample).toBe(true);
    }
  });

  it('deduplicates events by ID, prioritizing non-sample over sample', () => {
    const sampleEvent: CampusEvent = {
      id: 'evt_dup',
      title: 'Sample Version',
      description: 'Seed event',
      category: 'fest',
      startDate: '2026-11-01T10:00:00.000Z',
      endDate: '2026-11-01T18:00:00.000Z',
      venue: 'Main Ground',
      isFree: true,
      registrationRequired: false,
      audience: ['all'],
      source: 'seed',
      isSample: true,
    };

    const liveEvent: CampusEvent = {
      id: 'evt_dup',
      title: 'Live Official Version',
      description: 'Admin published event',
      category: 'fest',
      startDate: '2026-11-01T10:00:00.000Z',
      endDate: '2026-11-01T18:00:00.000Z',
      venue: 'Main Ground',
      isFree: true,
      registrationRequired: false,
      audience: ['all'],
      source: 'supabase',
      isSample: false,
    };

    const deduped = deduplicateEvents([sampleEvent, liveEvent]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].title).toBe('Live Official Version');
    expect(deduped[0].isSample).toBe(false);
  });

  it('always populates imageUrl and photos with valid fallbacks when missing', () => {
    const bareEvent: CampusEvent = {
      id: 'evt_bare',
      title: 'Bare Event',
      description: 'Event with no photos',
      category: 'sports',
      startDate: '2026-11-10T09:00:00.000Z',
      endDate: '2026-11-10T17:00:00.000Z',
      venue: 'Indoor Stadium',
      isFree: true,
      registrationRequired: false,
      audience: ['all'],
      source: 'academic-calendar',
      isSample: false,
    };

    const result = deduplicateEvents([bareEvent]);
    expect(result).toHaveLength(1);
    expect(result[0].imageUrl).toBe(CATEGORY_DEFAULT_IMAGES.sports);
    expect(result[0].photos).toEqual([CATEGORY_DEFAULT_IMAGES.sports]);
  });

  it('filters events by category correctly', () => {
    const fests = filterEvents(MOCK_EVENTS, { category: 'fest' });
    expect(fests.length).toBeGreaterThan(0);
    expect(fests.every((e) => e.category === 'fest')).toBe(true);

    const workshops = filterEvents(MOCK_EVENTS, { category: 'workshop' });
    expect(workshops.every((e) => e.category === 'workshop')).toBe(true);

    const all = filterEvents(MOCK_EVENTS, { category: 'all' });
    expect(all).toHaveLength(MOCK_EVENTS.length);
  });

  it('searches events by title and description case-insensitively', () => {
    const matchTitle = filterEvents(MOCK_EVENTS, { search: 'React Native' });
    expect(matchTitle.length).toBeGreaterThanOrEqual(1);
    expect(matchTitle[0].title).toContain('React Native');

    const matchDesc = filterEvents(MOCK_EVENTS, { search: 'hackathons' });
    expect(matchDesc.length).toBeGreaterThanOrEqual(1);
    expect(matchDesc[0].description).toContain('hackathons');
  });

  it('filters events by freeOnly flag', () => {
    const testEvents: CampusEvent[] = [
      { ...MOCK_EVENTS[0], id: 'e1', isFree: true },
      { ...MOCK_EVENTS[1], id: 'e2', isFree: false },
    ];
    const freeOnly = filterEvents(testEvents, { freeOnly: true });
    expect(freeOnly).toHaveLength(1);
    expect(freeOnly[0].id).toBe('e1');
  });

  it('sorts events ascending by startDate', () => {
    const unsorted: CampusEvent[] = [
      { ...MOCK_EVENTS[0], id: 'e_later', startDate: '2026-12-01T00:00:00.000Z' },
      { ...MOCK_EVENTS[0], id: 'e_earlier', startDate: '2026-10-01T00:00:00.000Z' },
    ];
    const sorted = sortEventsByDate(unsorted);
    expect(sorted[0].id).toBe('e_earlier');
    expect(sorted[1].id).toBe('e_later');
  });

  it('returns only upcoming events based on reference date', () => {
    const mixed: CampusEvent[] = [
      { ...MOCK_EVENTS[0], id: 'past', endDate: '2026-10-15T00:00:00.000Z' },
      { ...MOCK_EVENTS[0], id: 'future', endDate: '2026-11-20T00:00:00.000Z' },
    ];
    const upcoming = upcomingEvents(mixed, '2026-10-26');
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe('future');
  });

  it('preserves multiple photo URLs and sets hero image on custom event creation', async () => {
    const photos = [
      'https://images.unsplash.com/photo-1',
      'https://images.unsplash.com/photo-2',
      'https://images.unsplash.com/photo-3',
    ];
    const result = await createCampusEvent({
      title: 'Annual Sports Meet 2026',
      description: 'Track and field events.',
      category: 'sports',
      startDate: '2026-11-15T09:00:00.000Z',
      endDate: '2026-11-17T18:00:00.000Z',
      venue: 'Main Sports Complex',
      isFree: true,
      registrationRequired: false,
      photos,
      audience: ['all'],
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBeDefined();

    const events = await listCampusEvents();
    const created = events.find((e) => e.id === result.id);
    expect(created).toBeDefined();
    expect(created?.title).toBe('Annual Sports Meet 2026');
    expect(created?.photos).toHaveLength(3);
    expect(created?.photos?.[0]).toBe(photos[0]);
    expect(created?.imageUrl).toBe(photos[0]);
  });
});
