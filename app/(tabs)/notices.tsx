import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Linking,
} from 'react-native';
import { Search, Share2, BellRing, X, ExternalLink } from 'lucide-react-native';
import { NoticeCard, Chip, BottomSheet, PillButton, EmptyState } from '../../src/components/ui';
import { MOCK_NOTICES, NoticeItem } from '../../src/features/notices/noticeService';
import { theme } from '../../src/lib/theme';

const CATEGORIES = ['All', 'For me', 'datesheet', 'fees', 'scholarship', 'hostel', 'exam', 'event'];

export default function NoticesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeNotice, setActiveNotice] = useState<NoticeItem | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filteredNotices = MOCK_NOTICES.filter((n) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      n.cleanTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' ||
      (selectedCategory === 'For me' && (n.importance >= 2 || n.audience.all)) ||
      n.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  const handleOpenNotice = (notice: NoticeItem) => {
    setActiveNotice(notice);
    setSheetVisible(true);
  };

  const handleShare = async () => {
    if (activeNotice) {
      try {
        await Share.share({
          message: `[GBU One] ${activeNotice.cleanTitle}\nLink: ${activeNotice.fileUrl}`,
        });
      } catch (err) {
        // ignore
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notices</Text>
        <Text style={styles.headerSub}>Aggregated from test.gbu.ac.in & exams portal</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notices, exams, fee dates..."
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Chips (N99-style) */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat === 'datesheet' ? 'Date Sheet' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              selected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
              onRemove={selectedCategory === cat && cat !== 'All' ? () => setSelectedCategory('All') : undefined}
              style={styles.filterChip}
            />
          ))}
        </ScrollView>
      </View>

      {/* Notices List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {filteredNotices.length === 0 ? (
          <EmptyState
            title="No notices found"
            description="Try clearing your search query or selecting a different category filter."
          />
        ) : (
          filteredNotices.map((n) => (
            <NoticeCard
              key={n.id}
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
          ))
        )}
      </ScrollView>

      {/* Notice Detail Bottom Sheet (N99 warm/cream glass style) */}
      <BottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={activeNotice?.category?.toUpperCase()}
      >
        {activeNotice && (
          <View style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>{activeNotice.cleanTitle}</Text>
            <Text style={styles.sheetMeta}>
              Posted by {activeNotice.source.toUpperCase()} • {new Date(activeNotice.postedAt).toLocaleDateString()}
            </Text>

            <View style={styles.sheetSummaryCard}>
              <Text style={styles.sheetSummaryHeader}>ORIGINAL NOTICE DETAILS</Text>
              <Text style={styles.sheetRawTitle}>{activeNotice.title}</Text>
              {activeNotice.threadUpdateCount ? (
                <Text style={styles.sheetThreadNote}>
                  • This notice has been extended or updated {activeNotice.threadUpdateCount} times.
                </Text>
              ) : null}
            </View>

            {/* Actions */}
            <View style={styles.sheetActions}>
              <PillButton
                label="View Original"
                onPress={() => {
                  if (activeNotice?.fileUrl) {
                    Linking.openURL(activeNotice.fileUrl).catch(() => {});
                  }
                }}
                variant="white"
                size="sm"
                icon={<ExternalLink size={15} color="#0B0B0C" style={{ marginRight: 6 }} />}
                style={{ flex: 1, marginRight: 6 }}
              />
              <PillButton
                label="Share"
                onPress={handleShare}
                variant="outline"
                size="sm"
                icon={<Share2 size={15} color={theme.colors.ivory} style={{ marginRight: 6 }} />}
                style={{ flex: 1, marginRight: 6 }}
              />
              <PillButton
                label="Remind"
                onPress={() => setSheetVisible(false)}
                variant="primary"
                size="sm"
                icon={<BellRing size={15} color={theme.colors.ivory} style={{ marginRight: 6 }} />}
                style={{ flex: 1 }}
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
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: theme.colors.ivory,
  },
  headerSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.ivory,
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
    color: theme.colors.ivory,
    lineHeight: 24,
    marginBottom: 4,
  },
  sheetMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  sheetSummaryCard: {
    backgroundColor: '#0F0F11',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginBottom: 20,
  },
  sheetSummaryHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sheetRawTitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  sheetThreadNote: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.warning,
    marginTop: 8,
  },
  sheetActions: {
    flexDirection: 'row',
  },
});
