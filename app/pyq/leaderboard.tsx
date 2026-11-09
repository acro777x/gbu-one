import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Share2,
  Trophy,
  Award,
  Sparkles,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react-native';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Avatar } from '../../src/components/ui/Avatar';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Chip } from '../../src/components/ui/Chip';
import { PillButton } from '../../src/components/ui/PillButton';
import { PyqLeaderboardPodium } from '../../src/components/pyq/PyqLeaderboardPodium';
import {
  getLeaderboard,
  shareLeaderboard,
  DEFAULT_LEADERBOARD_SEED,
  type LeaderboardEntry,
  type CurrentUserParam,
} from '../../src/features/pyq/pyqLeaderboard';

const SCHOOL_FILTER_CHIPS = [
  'All',
  'SOICT',
  'SOE',
  'SOBT',
  'SOM',
  'SOLJG',
  'SOHSS',
  'SOVSAS',
] as const;

type SchoolChip = (typeof SCHOOL_FILTER_CHIPS)[number];

interface ContributorRowProps {
  item: LeaderboardEntry;
  isCurrent: boolean;
  isDark: boolean;
  colors: any;
}

const ContributorRow = React.memo<ContributorRowProps>(({ item, isCurrent, isDark, colors }) => {
  const rankEmoji =
    item.rank === 1 ? '👑' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;

  const medalBg =
    item.rank === 1
      ? 'rgba(245, 158, 11, 0.16)'
      : item.rank === 2
      ? 'rgba(148, 163, 184, 0.16)'
      : item.rank === 3
      ? 'rgba(217, 119, 6, 0.16)'
      : isDark
      ? 'rgba(255, 255, 255, 0.05)'
      : colors.surfaceMuted;

  const medalBorder =
    item.rank === 1
      ? '#F59E0B'
      : item.rank === 2
      ? '#94A3B8'
      : item.rank === 3
      ? '#D97706'
      : colors.borderGlass;

  return (
    <View
      style={[
        styles.entryCard,
        {
          backgroundColor: isCurrent ? colors.accentSoft : isDark ? 'rgba(255,255,255,0.03)' : colors.surface,
          borderColor: isCurrent ? colors.accent : colors.borderGlass,
        },
      ]}
    >
      {/* Rank Badge */}
      <View style={[styles.rankBox, { backgroundColor: medalBg, borderColor: medalBorder }]}>
        <Text
          style={[
            styles.rankText,
            { color: item.rank <= 3 ? '#F59E0B' : colors.textSecondary },
          ]}
        >
          {rankEmoji}
        </Text>
      </View>

      {/* Contributor Avatar */}
      <View style={styles.avatarWrap}>
        <Avatar
          name={item.name}
          avatarId={item.avatarId}
          size={40}
        />
        {item.isOfficialAdmin && (
          <View style={[styles.adminShieldBadge, { backgroundColor: colors.accent }]}>
            <ShieldCheck size={9} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Contributor Meta */}
      <View style={styles.entryInfo}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.entryName,
              { color: colors.textPrimary, fontWeight: isCurrent ? '700' : '600' },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.isOfficialAdmin && (
            <View style={[styles.roleTag, { backgroundColor: colors.accent }]}>
              <Text style={styles.roleTagText}>Official Admin</Text>
            </View>
          )}
          {isCurrent && (
            <View style={[styles.roleTag, { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: 1 }]}>
              <Text style={[styles.roleTagText, { color: colors.accent }]}>You</Text>
            </View>
          )}
        </View>

        <Text style={[styles.entrySub, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.uniqueStudentId} {item.school ? `• ${item.school}` : ''}
        </Text>
      </View>

      {/* Points & Uploads */}
      <View style={styles.entryStats}>
        <Text style={[styles.entryPoints, { color: colors.accent }]}>
          {item.points.toLocaleString()} pts
        </Text>
        <Text style={[styles.entryUploads, { color: colors.textTertiary }]}>
          {item.isOfficialAdmin ? 'Verified Library' : `${item.uploadsCount} papers`}
        </Text>
      </View>
    </View>
  );
});

export default function PyqLeaderboardScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [selectedSchool, setSelectedSchool] = useState<SchoolChip>('All');
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() =>
    DEFAULT_LEADERBOARD_SEED.map((item) => ({ ...item })),
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const leaderboardUser = useMemo<CurrentUserParam | undefined>(
    () =>
      user
        ? {
            id: user.id,
            name: user.name,
            avatarId: user.avatarId ?? undefined,
            uniqueStudentId:
              user.uniqueStudentId || user.rollNo || `GBU-${user.id.slice(0, 6).toUpperCase()}`,
            school: user.classSelection?.school,
          }
        : undefined,
    [
      user?.id,
      user?.name,
      user?.avatarId,
      user?.uniqueStudentId,
      user?.rollNo,
      user?.classSelection?.school,
    ],
  );

  const loadLeaderboardData = useCallback(async () => {
    try {
      const data = await getLeaderboard(leaderboardUser);
      setEntries(data);
    } catch {
      // Graceful fallback to initial seed
    }
  }, [leaderboardUser]);

  useEffect(() => {
    void loadLeaderboardData();
  }, [loadLeaderboardData, refreshTrigger]);

  const myRank = leaderboardUser?.id
    ? entries.find((e) => e.id === leaderboardUser.id)?.rank
    : undefined;

  const handleShare = useCallback(async () => {
    await shareLeaderboard(entries, myRank);
  }, [entries, myRank]);

  const filteredEntries = useMemo(() => {
    if (selectedSchool === 'All') return entries;
    const target = selectedSchool.toUpperCase();
    return entries.filter((e) => {
      const sch = (e.school || '').toUpperCase();
      if (target === 'SOLJG') {
        return sch === 'SOLJG' || sch === 'SOL';
      }
      return sch === target;
    });
  }, [entries, selectedSchool]);

  const renderContributorItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <ContributorRow
        item={item}
        isCurrent={leaderboardUser?.id === item.id}
        isDark={isDark}
        colors={colors}
      />
    ),
    [colors, isDark, leaderboardUser?.id],
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.listHeaderContainer}>
        {/* Animated Podium Component */}
        <PyqLeaderboardPodium
          currentUser={leaderboardUser}
          refreshTrigger={refreshTrigger}
          entries={entries}
          hideActionRow={true}
        />

        {/* Guide Card: How Contributors Earn Points */}
        <GlassCard style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <View style={styles.guideTitleRow}>
              <Award size={18} color={colors.accent} />
              <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
                How Contributors Earn Points
              </Text>
            </View>
            <View style={[styles.pointsBadge, { backgroundColor: colors.accentSoft }]}>
              <Sparkles size={11} color={colors.accent} style={{ marginRight: 3 }} />
              <Text style={[styles.pointsBadgeText, { color: colors.accent }]}>+50 pts / paper</Text>
            </View>
          </View>

          <Text style={[styles.guideDesc, { color: colors.textSecondary }]}>
            Submit your mid-sem, end-sem, or back-paper question papers. Once verified by student
            moderators, +50 points are credited directly to your profile and student ID!
          </Text>

          <View style={styles.guidePerksRow}>
            <View style={styles.guidePerkItem}>
              <CheckCircle2 size={13} color={colors.success} style={{ marginRight: 4 }} />
              <Text style={[styles.guidePerkText, { color: colors.textSecondary }]}>
                Climb Semester Ranks
              </Text>
            </View>
            <View style={styles.guidePerkItem}>
              <CheckCircle2 size={13} color={colors.success} style={{ marginRight: 4 }} />
              <Text style={[styles.guidePerkText, { color: colors.textSecondary }]}>
                Help GBU Juniors
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Department / School Filter Chips */}
        <View style={styles.schoolFilterSection}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            Filter by Department / School
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.schoolChipScroll}
          >
            {SCHOOL_FILTER_CHIPS.map((chip) => {
              const active = selectedSchool === chip;
              return (
                <Chip
                  key={chip}
                  label={chip}
                  selected={active}
                  onPress={() => setSelectedSchool(chip)}
                  style={styles.schoolChip}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {selectedSchool === 'All' ? 'All Contributors' : `${selectedSchool} Contributors`}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {filteredEntries.length} {filteredEntries.length === 1 ? 'student' : 'students'}
          </Text>
        </View>
      </View>
    ),
    [
      leaderboardUser,
      refreshTrigger,
      colors,
      selectedSchool,
      filteredEntries.length,
    ],
  );

  const renderFooter = useCallback(
    () => (
      <View style={styles.footerContainer}>
        {/* Full Share Ranking Action */}
        <PillButton
          label="Share Leaderboard Rankings"
          variant="primary"
          size="md"
          icon={<Share2 size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
          onPress={handleShare}
          style={styles.shareLeaderboardBtn}
        />

        <Text style={[styles.footerHint, { color: colors.textTertiary }]}>
          Every verified upload helps Gautam Buddha University students prepare better.
        </Text>
      </View>
    ),
    [colors, handleShare],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Top Header with Back Navigation */}
      <View style={[styles.topHeader, { borderBottomColor: colors.borderGlass }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/(tabs)/pyq');
            }
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.headerBackBtn}
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            PYQ Contributor Leaderboard
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            Recognizing Gautam Buddha University contributors
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share leaderboard rankings"
          style={[styles.headerShareBtn, { backgroundColor: colors.accentSoft }]}
        >
          <Share2 size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Main Contributors FlatList */}
      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderContributorItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Trophy size={36} color={colors.textTertiary} style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No contributors for {selectedSchool} yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Be the first to contribute a past question paper from {selectedSchool} and claim Rank #1!
            </Text>
            <PillButton
              label="Contribute PYQ"
              variant="primary"
              size="sm"
              icon={<UploadCloud size={14} color={colors.onAccent} style={{ marginRight: 4 }} />}
              onPress={() => router.push('/(tabs)/pyq')}
              style={{ marginTop: 14 }}
            />
          </View>
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(40, insets.bottom + 24) },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  headerShareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  listHeaderContainer: {
    paddingBottom: 8,
  },
  guideCard: {
    marginVertical: 10,
    padding: 14,
    borderRadius: 16,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  guideTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guideTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pointsBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  guideDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  guidePerksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  guidePerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guidePerkText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  schoolFilterSection: {
    marginTop: 12,
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    marginBottom: 8,
  },
  schoolChipScroll: {
    gap: 6,
  },
  schoolChip: {
    marginBottom: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
  },
  sectionCount: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 56,
  },
  rankBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  adminShieldBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryInfo: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  entryName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  roleTagText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9.5,
    color: '#FFFFFF',
  },
  entrySub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  entryStats: {
    alignItems: 'flex-end',
  },
  entryPoints: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  entryUploads: {
    fontFamily: 'Inter-Regular',
    fontSize: 10.5,
    marginTop: 2,
  },
  footerContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  shareLeaderboardBtn: {
    width: '100%',
  },
  footerHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
