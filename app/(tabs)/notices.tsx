import React, { useState, useMemo } from 'react';
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
  Share,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, Share2, BellRing, X, ExternalLink } from 'lucide-react-native';
import { NoticeCard, Chip, BottomSheet, PillButton, EmptyState } from '../../src/components/ui';
import { NoticeItem, filterNotices } from '../../src/features/notices/noticeService';
import { useNoticesQuery } from '../../src/features/notices/useNoticesQuery';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';

// "For me" is a separate chip (it is not a category), so it is not listed here.
const CATEGORIES = ['datesheet', 'fees', 'scholarship', 'hostel', 'exam', 'event'];

export default function NoticesScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  // N99-style removable filters: several can be active at once.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [forMeOnly, setForMeOnly] = useState(false);
  const [activeNotice, setActiveNotice] = useState<NoticeItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Offline-first: renders instantly from SQLite cache (or bundled seed on
  // first launch), then refreshes from Supabase in the background.
  const { data: notices = [], isFetching, refetch } = useNoticesQuery();

  const availableSchools = useMemo(() => {
    const schools = new Set<string>();
    for (const n of notices) {
      for (const s of n.audience.schools ?? []) schools.add(s.toUpperCase());
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

  const handleOpenNotice = (notice: NoticeItem) => {
    setActiveNotice(notice);
    router.push({ pathname: '/notice/[id]', params: { id: notice.id } });
  };

  const handleShare = async () => {
    if (activeNotice) {
      try {
        await Share.share({
          message: `[GBU One] ${activeNotice.cleanTitle}\nLink: ${activeNotice.fileUrl}`,
        });
      } catch {
        // ignore
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notices</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
          {isFetching
            ? 'Syncing official GBU sources…'
            : 'Official GBU, exams, hostel & council circulars • auto-updated every 15 min'}
        </Text>
      </View>

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
        renderItem={({ item: n }) => (
          <NoticeCard
            id={n.id}
            category={n.category}
            title={n.cleanTitle}
            source={n.source.toUpperCase()}
            date={new Date(n.postedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
            importance={n.importance}
            deadlineBadge={n.deadlineAt ? 'Deadline' : undefined}
            threadUpdateCount={n.threadUpdateCount}
            onPress={() => handleOpenNotice(n)}
          />
        )}
      />

      {/* Notice Detail Bottom Sheet */}
      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={activeNotice?.category?.toUpperCase()}
      >
        {activeNotice && (
          <View style={styles.sheetBody}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>{activeNotice.cleanTitle}</Text>
            <Text style={[styles.sheetMeta, { color: colors.textSecondary }]}>
              Posted by {activeNotice.source.toUpperCase()} • {new Date(activeNotice.postedAt).toLocaleDateString()}
            </Text>

            <View style={[styles.sheetSummaryCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}>
              <Text style={[styles.sheetSummaryHeader, { color: colors.accent }]}>ORIGINAL NOTICE DETAILS</Text>
              <Text style={[styles.sheetRawTitle, { color: colors.textPrimary }]}>{activeNotice.title}</Text>
              {activeNotice.threadUpdateCount ? (
                <Text style={[styles.sheetThreadNote, { color: colors.warning }]}>
                  • This notice has been extended or updated {activeNotice.threadUpdateCount} times.
                </Text>
              ) : null}
            </View>

            {/* Non-overlapping Actions Bar */}
            <View style={styles.sheetActions}>
              <PillButton
                label="Original"
                onPress={() => {
                  if (activeNotice?.fileUrl) {
                    Linking.openURL(activeNotice.fileUrl).catch(() => {});
                  }
                }}
                variant={isDark ? 'dark' : 'white'}
                size="sm"
                icon={<ExternalLink size={14} color={colors.textPrimary} style={{ marginRight: 4 }} />}
                style={styles.sheetActionButton}
              />
              <PillButton
                label="Share"
                onPress={handleShare}
                variant="outline"
                size="sm"
                icon={<Share2 size={14} color={colors.accent} style={{ marginRight: 4 }} />}
                style={styles.sheetActionButton}
              />
              <PillButton
                label="Remind"
                onPress={() => setSheetVisible(false)}
                variant="primary"
                size="sm"
                icon={<BellRing size={14} color={colors.onAccent} style={{ marginRight: 4 }} />}
                style={styles.sheetActionButton}
              />
            </View>
          </View>
        )}
      </BottomSheet>
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
    height: 44,
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
    minHeight: 32,
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
  sheetBody: {
    paddingVertical: 8,
  },
  sheetTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 4,
  },
  sheetMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginBottom: 16,
  },
  sheetSummaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  sheetSummaryHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sheetRawTitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  sheetThreadNote: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    marginTop: 8,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetActionButton: {
    flex: 1,
    minWidth: 90,
  },
});
