/**
 * GBU One — Campus Events ("What's On").
 * Shows fests, workshops, guest lectures, sports, cultural nights,
 * placement drives and club meetups happening on or around campus.
 * Offline-first: renders cached/seed data instantly, refreshes in background.
 */
import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  TextInput,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, Calendar, Ticket, Image as ImageIcon, X, Sparkles } from 'lucide-react-native';
import { GlassCard, Chip, EmptyState, PillButton } from '../src/components/ui';
import {
  filterEvents,
  sortEventsByDate,
  upcomingEvents,
  EVENT_CATEGORIES,
  CATEGORY_STYLE,
  type CampusEvent,
} from '../src/features/events/eventsService';
import { useEventsQuery } from '../src/features/events/useEventsQuery';
import { theme } from '../src/lib/theme';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, DATE_OPTIONS);
  } catch {
    return iso;
  }
}

export default function EventsScreen() {
  const { data: allEvents, isLoading, isFetching } = useEventsQuery();

  const [category, setCategory] = useState<typeof EVENT_CATEGORIES[0]['id']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null>(null);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const filteredByFilter = filterEvents(allEvents, {
      category,
      search: searchQuery || undefined,
      freeOnly,
    });
    return sortEventsByDate(filteredByFilter);
  }, [allEvents, category, searchQuery, freeOnly]);

  const upcoming = upcomingEvents(filtered);

  const handleOpenEvent = (event: CampusEvent) => {
    if (Platform.OS !== 'web') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Haptics = require('expo-haptics');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }
    setSelectedEvent(event);
  };

  const closeDetail = () => setSelectedEvent(null);

  const renderEventCard = (event: CampusEvent) => {
    const style = CATEGORY_STYLE[event.category];
    const today = new Date().toISOString().slice(0, 10);
    const startsTodayOrFuture = event.startDate >= today;
    const isOngoing = startsTodayOrFuture && event.endDate >= today;

    return (
      <GlassCard
        key={event.id}
        onPress={() => handleOpenEvent(event)}
        variant={event.isSample ? 'subtle' : 'default'}
        style={styles.eventCard}
      >
        {event.imageUrl ? (
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.cardBannerImage}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.cardTop}>
          <View style={styles.categoryBadgeContainer}>
            <View
              style={[styles.categoryBadge, { backgroundColor: style.bg, borderColor: style.color }]}
            />
            <Text style={[styles.categoryBadgeText, { color: style.color }]}>
              {event.category.charAt(0).toUpperCase() + event.category.slice(1).replace('-', ' ')}
            </Text>
          </View>
          {event.isSample && (
            <View style={styles.samplePill}>
              <Text style={styles.sampleText}>Sample</Text>
            </View>
          )}
        </View>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <View style={styles.eventMeta}>
          <View style={styles.metaItem}>
            <Calendar size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
              {formatDate(event.startDate)}{event.endDate !== event.startDate ? ` â€¢ ${formatDate(event.endDate)}` : ''}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ticket size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{event.venue}</Text>
          </View>
          {event.registrationRequired && (
            <View style={[styles.metaItem, { marginLeft: theme.spacing.sm }]}>
              <Ticket size={14} color={theme.colors.warning} />
              <Text style={[styles.metaText, { color: theme.colors.warning }]}>Registration required</Text>
            </View>
          )}
        </View>
        <View style={styles.actionRow}>
          <PillButton
            label={isOngoing ? 'Going on now' : 'Upcoming'}
            onPress={() => handleOpenEvent(event)}
            variant="outline"
            size="sm"
          />
        </View>
      </GlassCard>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <View style={styles.backIcon} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>What's On</Text>
          <Text style={styles.headerSub}>
            Campus events, workshops, fests &amp; more
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={18} color={theme.colors.textSecondary} />
          <TextInput
            placeholder="Search events…"
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            returnKeyType="done"
            onSubmitEditing={() => {}}
          />
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {EVENT_CATEGORIES.map((chip) => {
            const selected = category === chip.id;
            return (
              <Chip
                key={chip.id}
                label={chip.label}
                selected={selected}
                onPress={() => setCategory(chip.id)}
              />
            );
          })}
          <Chip
            label={freeOnly ? 'Free only âœ“' : 'Free only'}
            selected={freeOnly}
            onPress={() => setFreeOnly(!freeOnly)}
          />
        </ScrollView>
      </View>
      {/* List */}
      <View style={styles.listContainer}>
        {isLoading && !allEvents ? (
          <View style={styles.skeletonList}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard} />
            ))}
          </View>
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={<Calendar size={40} color={theme.colors.textTertiary} />}
            title={searchQuery || category !== 'all' || freeOnly ? 'No events match' : 'Nothing on right now'}
            description={
              searchQuery || category !== 'all' || freeOnly
                ? 'Try another category, clear the search, or turn off "Free only".'
                : 'Check back soon — new campus events are added regularly.'
            }
            actionLabel="Clear filters"
            onAction={() => {
              setCategory('all');
              setSearchQuery('');
              setFreeOnly(false);
            }}
          />
        ) : (
          <FlatList
            data={upcoming}
            renderItem={({ item }) => renderEventCard(item)}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.flatListContent}
            ListEmptyComponent={undefined}
          />
        )}
      </View>
      {/* Event detail overlay */}
      {selectedEvent && (
        <TouchableOpacity style={styles.overlayBackdrop} onPress={closeDetail} accessibilityLabel="Close event details">
          <View style={styles.overlaySheet} pointerEvents="box-none">
            <TouchableOpacity
              onPress={closeDetail}
              style={[styles.closeBtn, { backgroundColor: theme.colors.surfaceRaised }]}
              accessibilityLabel="Close"
            >
              <View style={styles.closeIcon} />
            </TouchableOpacity>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <GlassCard style={styles.detailCard} variant="elevated">
                <View style={styles.detailHeader}>
                  <View
                    style={[
                      styles.detailCategoryBadge,
                      { backgroundColor: CATEGORY_STYLE[selectedEvent.category].bg },
                    ]}
                  >
                    <Text style={[styles.detailCategoryText, { color: CATEGORY_STYLE[selectedEvent.category].color }]}>
                      {selectedEvent.category.charAt(0).toUpperCase() + selectedEvent.category.slice(1).replace('-', ' ')}
                    </Text>
                  </View>
                  {selectedEvent.isSample && (
                    <View style={styles.detailSamplePill}>
                      <Text style={styles.detailSampleText}>Sample</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.detailTitle}>{selectedEvent.title}</Text>
                <View style={styles.detailMetaRow}>
                  <View style={styles.detailMetaItem}>
                    <Calendar size={16} color={theme.colors.textSecondary} />
                    <View style={styles.detailMetaTextCol}>
                      <Text style={styles.detailMetaLabel}>Date</Text>
                      <Text style={styles.detailMetaValue}>
                        {formatDate(selectedEvent.startDate)}{selectedEvent.endDate !== selectedEvent.startDate ? ` — ${formatDate(selectedEvent.endDate)}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailMetaItem}>
                    <Ticket size={16} color={theme.colors.textSecondary} />
                    <View style={styles.detailMetaTextCol}>
                      <Text style={styles.detailMetaLabel}>Venue</Text>
                      <Text style={styles.detailMetaValue}>{selectedEvent.venue}</Text>
                    </View>
                  </View>
                  <View style={styles.detailMetaItem}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>
                        {selectedEvent.isFree ? 'Free' : 'Paid'}
                      </Text>
                    </View>
                    <View style={styles.detailMetaTextCol}>
                      <Text style={styles.detailMetaLabel}>Cost</Text>
                      <Text style={styles.detailMetaValue}>{selectedEvent.isFree ? 'No entry fee' : 'Ticket required'}</Text>
                    </View>
                  </View>
                </View>
                {selectedEvent.imageUrl ? (
                  <Image
                    source={{ uri: selectedEvent.imageUrl }}
                    style={styles.detailHeroImage}
                    resizeMode="cover"
                  />
                ) : null}

                <Text style={styles.detailSectionTitle}>About</Text>
                <Text style={styles.detailDescription}>{selectedEvent.description}</Text>

                {selectedEvent.photos && selectedEvent.photos.length > 0 ? (
                  <View style={styles.photosSection}>
                    <View style={styles.photosHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ImageIcon size={16} color={theme.colors.accent} />
                        <Text style={styles.detailSectionTitle}>Event Photos & Highlights</Text>
                      </View>
                      <View style={styles.photosCountBadge}>
                        <Text style={styles.photosCountText}>{selectedEvent.photos.length} photos</Text>
                      </View>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScroll}>
                      {selectedEvent.photos.map((photoUrl, idx) => (
                        <TouchableOpacity
                          key={photoUrl + idx}
                          activeOpacity={0.85}
                          onPress={() => setActivePhoto(photoUrl)}
                          style={styles.photoThumbWrapper}
                          accessibilityLabel={`View photo ${idx + 1}`}
                        >
                          <Image source={{ uri: photoUrl }} style={styles.photoThumb} resizeMode="cover" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                {selectedEvent.registrationRequired && selectedEvent.registrationUrl && (
                  <View style={styles.registrationSection}>
                    <PillButton
                      label="Register now"
                      onPress={() => {
                        void router.push({ pathname: '/pdf', params: { id: selectedEvent.registrationUrl, title: selectedEvent.title } });
                      }}
                      size="sm"
                    />
                    <Text style={styles.hintText}>
                      Opens the registration page in the in-app viewer.
                    </Text>
                  </View>
                )}
                <View style={styles.detailFooter}>
                  <Text style={styles.detailFooterText}>
                    {selectedEvent.source === 'supabase' ? 'From GBU One backend' : 'Bundled sample event — live data appears once the backend is connected.'}
                  </Text>
                </View>
              </GlassCard>
            </ScrollView>
          </View>
        </TouchableOpacity>
      )}
      {isFetching && (
        <View style={styles.refreshBanner}>
          <View style={styles.refreshSpinner} />
          <Text style={styles.refreshText}>Updating events…</Text>
        </View>
      )}

      {/* Full-Screen Photo Viewer Overlay (Pure View overlay, no native Modal) */}
      {activePhoto ? (
        <View style={[StyleSheet.absoluteFill, styles.photoViewerBackdrop, { zIndex: 9999 }]}>
          <SafeAreaView style={styles.photoViewerSafeArea}>
            <View style={styles.photoViewerHeader}>
              <TouchableOpacity
                onPress={() => setActivePhoto(null)}
                style={styles.photoCloseBtn}
                accessibilityLabel="Close photo viewer"
              >
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.photoViewerTitle}>Campus Event Memory</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.photoViewerBody}>
              <Image
                source={{ uri: activePhoto }}
                style={styles.fullScreenPhoto}
                resizeMode="contain"
              />
            </View>
          </SafeAreaView>
        </View>
      ) : null}
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    borderRadius: theme.radius.avatar,
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    borderRadius: theme.radius.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    paddingHorizontal: theme.spacing.md,
  },
  filtersContainer: {
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  filterScroll: {
    paddingVertical: theme.spacing.xs,
  },
  listContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  skeletonList: {
    gap: theme.spacing.md,
  },
  skeletonCard: {
    height: 140,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.skeletonBg,
  },
  flatListContent: {
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  overlaySheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    padding: theme.spacing.lg,
    maxHeight: '85%',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.avatar,
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.surfaceRaised,
  },
  closeIcon: {
    width: 20,
    height: 20,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xxl,
  },
  detailCard: {
    marginBottom: theme.spacing.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  detailCategoryBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailCategoryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  detailSamplePill: {
    backgroundColor: theme.colors.warningSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  detailSampleText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.warning,
  },
  detailTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  detailMetaRow: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  detailMetaItem: {
    gap: theme.spacing.xs,
  },
  detailMetaTextCol: {
    gap: 2,
  },
  detailMetaLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  detailMetaValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  metaPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  metaPillText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  detailSectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  detailDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  registrationSection: {
    marginTop: theme.spacing.lg,
  },
  hintText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.xs,
  },
  detailFooter: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  detailFooterText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  eventCard: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  categoryBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  categoryBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  samplePill: {
    backgroundColor: theme.colors.warningSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  sampleText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.warning,
  },
  eventTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  actionRow: {
    justifyContent: 'center',
  },
  refreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.accentSoft,
  },
  refreshSpinner: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: 8,
  },
  refreshText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.accentFill,
  },

  cardBannerImage: {
    width: '100%',
    height: 130,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  detailHeroImage: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  photosSection: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  photosCountBadge: {
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  photosCountText: {
    fontSize: 11,
    fontFamily: theme.typography.captionMedium.fontFamily,
    color: theme.colors.textSecondary,
  },
  galleryScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  photoThumbWrapper: {
    width: 120,
    height: 90,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoViewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
  },
  photoViewerSafeArea: {
    flex: 1,
  },
  photoViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  photoCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: theme.typography.sectionHeader.fontFamily,
  },
  photoViewerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  fullScreenPhoto: {
    width: '100%',
    height: '100%',
  },
});
