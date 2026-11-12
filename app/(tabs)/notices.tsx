import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, X, Info, AlertCircle, RefreshCw } from 'lucide-react-native';
import { NoticeCard, Chip, PillButton, EmptyState } from '../../src/components/ui';
import { NoticeItem, filterNotices } from '../../src/features/notices/noticeService';
import { useNoticesQuery } from '../../src/features/notices/useNoticesQuery';
import { useNoticesStatusStore } from '../../src/features/notices/noticesStatus';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';

// "For me" is a separate chip (it is not a category), so it is not listed here.
const CATEGORIES = ['datesheet', 'fees', 'scholarship', 'hostel', 'exam', 'result', 'event', 'placement'];

export default function NoticesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  // N99-style removable filters: several can be active at once.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [forMeOnly, setForMeOnly] = useState(false);

  // Offline-first: renders instantly from SQLite cache (or bundled archive on
  // first launch), then refreshes from the university in the background.
  const {
    data: notices = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useNoticesQuery();

  // Where the list on screen came from. The app says so out loud rather than
  // passing the bundled archive off as the university's live notices.
  const noticeStatus = useNoticesStatusStore((state) => state);
  const isLive = noticeStatus.source === 'live';

  const availableSchools = useMemo(() => {
    const schools = new Set<string>();
    for (const n of notices) {
      for (const s of n.audience?.schools ?? []) schools.add(s.toUpperCase());
    }
    return [...schools].sort();
  }, [notices]);

  const filteredNotices = useMemo(
    () =>
      filterNotices(notices, {
        categories: selectedCategories,
        schools: selectedSchools,
        forMe: forMeOnly,
        query: searchQuery,
      }),
    [notices, selectedCategories, selectedSchools, forMeOnly, searchQuery],
  );

  const toggleInList = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const activeFilterCount =
    selectedCategories.length + selectedSchools.length + (forMeOnly ? 1 : 0);

  const onRefresh = () => {
    void refetch();
  };

  const handleOpenNotice = useCallback((notice: NoticeItem) => {
    router.push({ pathname: '/notice/[id]', params: { id: notice.id } });
  }, []);

  const renderNoticeItem = useCallback(
    ({ item: n }: { item: NoticeItem }) => (
      <NoticeCard
        id={n.id}
        category={n.category}
        title={n.cleanTitle}
        source={n.source.toUpperCase()}
        date={new Date(n.postedAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          // The bundled archive spans more than one year, so the year has to
          // be on the card or the list is ambiguous.
          year: 'numeric',
        })}
        importance={n.importance}
        deadlineBadge={n.deadlineAt ? 'Deadline' : undefined}
        threadUpdateCount={n.threadUpdateCount}
        onPress={() => handleOpenNotice(n)}
      />
    ),
    [handleOpenNotice],
  );

  const headerSubtitle = useMemo(() => {
    if (isFetching) return 'Syncing official GBU sources…';
    if (noticeStatus.source === 'live') {
      return 'Live from gbu.ac.in and exams.gbu.ac.in • auto-updated every 15 min';
    }
    if (noticeStatus.source === 'cache') {
      return 'Showing the copy saved on this phone • pull to refresh';
    }
    return 'Bundled archive — the university pages could not be reached';
  }, [isFetching, noticeStatus.source]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notices</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{headerSubtitle}</Text>
      </View>

      {/* The banner appears once the refresh has finished, so it never
          flashes while the screen is still painting the saved copy. */}
      {!isLive && !isFetching ? (
        <View style={[styles.sampleBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
          <Info size={15} color={colors.warning} style={{ marginRight: 8 }} />
          <Text style={[styles.sampleBannerText, { color: colors.textPrimary }]}>
            {noticeStatus.source === 'sample'
              ? 'These notices come from the archive bundled with the app. They were captured earlier and were not fetched from the university just now. Pull to refresh once you are online.'
              : 'These notices come from the copy saved on this phone. Pull to refresh to fetch the latest from the university.'}
            {noticeStatus.reason ? ` (${noticeStatus.reason})` : ''}
          </Text>
        </View>
      ) : null}

      {/* A failed refresh must not look like a normal screen. */}
      {isError ? (
        <View style={[styles.errorBanner, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
          <AlertCircle size={15} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.errorBannerText, { color: colors.textPrimary }]}>
            {`Could not reach the university: ${error instanceof Error ? error.message : String(error)}`}
          </Text>
          <PillButton
            label="Retry"
            onPress={onRefresh}
            variant="outline"
            size="sm"
            style={styles.retryButton}
            icon={<RefreshCw size={14} color={colors.accent} style={{ marginRight: 4 }} />}
          />
        </View>
      ) : null}

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notices, exams, fee dates..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

        {/* Filter Chips - N99 style: removable, several active at once */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <Chip
              key="for-me"
              label="For me"
              selected={forMeOnly}
              onPress={() => setForMeOnly((v) => !v)}
              onRemove={forMeOnly ? () => setForMeOnly(false) : undefined}
              style={styles.filterChip}
            />

            {CATEGORIES.map((cat) => {
              const label =
                cat === 'datesheet'
                  ? 'Date Sheet'
                  : cat.charAt(0).toUpperCase() + cat.slice(1);
              const selected = selectedCategories.includes(cat);
              return (
                <Chip
                  key={cat}
                  label={label}
                  selected={selected}
                  onPress={() => setSelectedCategories((prev) => toggleInList(prev, cat))}
                  onRemove={
                    selected ? () => setSelectedCategories((prev) => prev.filter((c) => c !== cat)) : undefined
                  }
                  style={styles.filterChip}
                />
              );
            })}

            {availableSchools.map((school) => {
              const selected = selectedSchools.includes(school);
              return (
                <Chip
                  key={school}
                  label={school}
                  selected={selected}
                  onPress={() => setSelectedSchools((prev) => toggleInList(prev, school))}
                  onRemove={
                    selected ? () => setSelectedSchools((prev) => prev.filter((s) => s !== school)) : undefined
                  }
                  style={styles.filterChip}
                />
              );
            })}
          </ScrollView>

          {activeFilterCount > 0 && (
            <Pressable
              onPress={() => {
                setSelectedCategories([]);
                setSelectedSchools([]);
                setForMeOnly(false);
              }}
              style={styles.clearFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <Text style={styles.clearFiltersText}>Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}</Text>
            </Pressable>
          )}
        </View>


      {/* Notices List */}
      <FlatList
        data={filteredNotices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(120, 100 + insets.bottom) }]}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No notices found"
            description="Try clearing your search query or selecting a different category filter."
          />
        }
        renderItem={renderNoticeItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  sampleBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.card,
    borderWidth: 1,
  },
  sampleBannerText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.card,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  retryButton: {
    marginLeft: 8,
  },
  searchSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    paddingHorizontal: 14,
    // 48 so the input inside is at least 44dp tall.
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    height: '100%',
  },
  filterSection: {
    paddingBottom: theme.spacing.xs,
  },
  filterScroll: {
    paddingHorizontal: theme.spacing.lg,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 0,
  },
  clearFilters: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  clearFiltersText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: theme.colors.accent,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
});
