import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import {
  Share2,
  Trophy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Award,
} from 'lucide-react-native';
import { useAppTheme } from '../../lib/ThemeContext';
import { Avatar } from '../ui/Avatar';
import { GlassCard } from '../ui/GlassCard';
import {
  getLeaderboard,
  shareLeaderboard,
  DEFAULT_LEADERBOARD_SEED,
  type LeaderboardEntry,
  type CurrentUserParam,
} from '../../features/pyq/pyqLeaderboard';

export interface PyqLeaderboardPodiumProps {
  currentUser?: CurrentUserParam;
  refreshTrigger?: number | string;
  onLeaderboardLoaded?: (entries: LeaderboardEntry[]) => void;
  hideActionRow?: boolean;
  entries?: LeaderboardEntry[];
}

export const PyqLeaderboardPodium: React.FC<PyqLeaderboardPodiumProps> = ({
  currentUser,
  refreshTrigger,
  onLeaderboardLoaded,
  hideActionRow = false,
  entries: propEntries,
}) => {
  const { colors, isDark } = useAppTheme();
  const [internalEntries, setInternalEntries] = useState<LeaderboardEntry[]>(() =>
    DEFAULT_LEADERBOARD_SEED.map((item) => ({ ...item })),
  );
  const entries = propEntries || internalEntries;
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animated pulse for Rank 1 Gold Crown
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.9,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim, glowAnim]);

  const loadData = useCallback(async () => {
    if (propEntries) return;
    try {
      const data = await getLeaderboard(currentUser);
      setInternalEntries(data);
      if (onLeaderboardLoaded) {
        onLeaderboardLoaded(data);
      }
    } catch {
      // Non-fatal fallback
    } finally {
      setLoading(false);
    }
  }, [
    propEntries,
    currentUser?.id,
    currentUser?.name,
    currentUser?.avatarId,
    currentUser?.uniqueStudentId,
    currentUser?.school,
    currentUser?.points,
    currentUser?.uploadsCount,
    onLeaderboardLoaded,
  ]);

  useEffect(() => {
    if (!propEntries) {
      void loadData();
    }
  }, [loadData, refreshTrigger, propEntries]);

  if (loading && entries.length === 0) {
    return null;
  }

  const top1 = entries.find((e) => e.rank === 1);
  const top2 = entries.find((e) => e.rank === 2);
  const top3 = entries.find((e) => e.rank === 3);

  const myRank = currentUser?.id
    ? entries.find((e) => e.id === currentUser.id)?.rank
    : undefined;

  const handleShare = async () => {
    await shareLeaderboard(entries, myRank);
  };

  const renderPodiumPillar = (
    entry: LeaderboardEntry | undefined,
    rank: 1 | 2 | 3,
  ) => {
    if (!entry) return <View key={`empty_pillar_${rank}`} style={styles.emptyPillar} />;

    const isRank1 = rank === 1;
    const isRank2 = rank === 2;
    const isRank3 = rank === 3;

    // Crown colors and metadata
    const crownColor = isRank1 ? '#F59E0B' : isRank2 ? '#94A3B8' : '#D97706';
    const crownEmoji = isRank1 ? '👑' : isRank2 ? '🥈' : '🥉';
    const rankLabel = isRank1 ? 'Gold #1' : isRank2 ? 'Silver #2' : 'Bronze #3';

    return (
      <View
        key={`podium_rank_${rank}_${entry.id}`}
        style={[
          styles.podiumColumn,
          isRank1 ? styles.podiumColumnCenter : styles.podiumColumnSide,
        ]}
      >
        {/* Crown Badge */}
        {isRank1 ? (
          <Animated.View
            style={[
              styles.crownBadgeWrap,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.crownGlowAura,
                {
                  opacity: glowAnim,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View
              style={[
                styles.crownBadge,
                {
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  borderColor: '#F59E0B',
                },
              ]}
            >
              <Text style={styles.crownEmojiText}>{crownEmoji}</Text>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.crownBadgeWrap}>
            <View
              style={[
                styles.crownBadge,
                {
                  backgroundColor: isRank2
                    ? 'rgba(148, 163, 184, 0.18)'
                    : 'rgba(217, 119, 6, 0.18)',
                  borderColor: crownColor,
                },
              ]}
            >
              <Text style={styles.crownEmojiText}>{crownEmoji}</Text>
            </View>
          </View>
        )}

        {/* Avatar */}
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: crownColor,
              borderWidth: isRank1 ? 2.5 : 1.5,
              padding: isRank1 ? 3 : 2,
            },
          ]}
        >
          <Avatar
            name={entry.name}
            avatarId={entry.avatarId}
            size={isRank1 ? 46 : 38}
          />
          {entry.isOfficialAdmin && (
            <View style={[styles.adminShieldPill, { backgroundColor: colors.accent }]}>
              <ShieldCheck size={10} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Name */}
        <Text
          style={[
            styles.podiumName,
            { color: colors.textPrimary, fontWeight: isRank1 ? '700' : '600' },
          ]}
          numberOfLines={1}
        >
          {entry.name}
        </Text>

        {/* Student ID */}
        <Text style={[styles.podiumStudentId, { color: colors.textTertiary }]} numberOfLines={1}>
          {entry.uniqueStudentId}
        </Text>

        {/* Points Pill */}
        <View
          style={[
            styles.podiumPointsPill,
            {
              backgroundColor: isRank1
                ? 'rgba(245, 158, 11, 0.15)'
                : colors.surfaceMuted,
              borderColor: isRank1 ? 'rgba(245, 158, 11, 0.4)' : colors.borderGlass,
            },
          ]}
        >
          <Text
            style={[
              styles.podiumPointsText,
              { color: isRank1 ? '#F59E0B' : colors.textSecondary },
            ]}
          >
            {entry.points} pts
          </Text>
        </View>

        {/* Uploads Tag */}
        <Text style={[styles.podiumUploadsTag, { color: colors.textTertiary }]}>
          {entry.isOfficialAdmin ? 'Central Admin' : `${entry.uploadsCount} papers`}
        </Text>
      </View>
    );
  };

  return (
    <GlassCard style={styles.cardContainer}>
      {/* Header Banner */}
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Trophy size={18} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            PYQ Contributor Podium
          </Text>
          <View style={[styles.badgeLive, { backgroundColor: colors.accentSoft }]}>
            <Sparkles size={11} color={colors.accent} style={{ marginRight: 3 }} />
            <Text style={[styles.badgeLiveText, { color: colors.accent }]}>+50 pts / upload</Text>
          </View>
        </View>

        {myRank !== undefined && (
          <View style={[styles.myRankBadge, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.myRankText, { color: colors.accent }]}>
              My Rank: #{myRank}
            </Text>
          </View>
        )}
      </View>

      {/* Top 3 Podium: Rank 2 (Left), Rank 1 (Center), Rank 3 (Right) */}
      <View style={styles.podiumRow}>
        {renderPodiumPillar(top2, 2)}
        {renderPodiumPillar(top1, 1)}
        {renderPodiumPillar(top3, 3)}
      </View>

      {/* Action Buttons: Share Ranking & View Full Leaderboard */}
      {!hideActionRow && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
            onPress={handleShare}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Share leaderboard rankings"
          >
            <Share2 size={14} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.actionBtnText, { color: colors.accent }]}>Share Ranking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.expandBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderGlass }]}
            onPress={() => setIsExpanded((prev) => !prev)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Hide full leaderboard' : 'View full leaderboard'}
          >
            <Text style={[styles.actionBtnText, { color: colors.textSecondary, marginRight: 4 }]}>
              {isExpanded ? 'Hide Leaderboard' : 'View Full Leaderboard'}
            </Text>
            {isExpanded ? (
              <ChevronUp size={15} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={15} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Expanded Full Leaderboard View */}
      {!hideActionRow && isExpanded && (
        <View style={[styles.expandedContainer, { borderTopColor: colors.borderGlass }]}>
          <Text style={[styles.expandedHeader, { color: colors.textSecondary }]}>
            All Contributors ({entries.length})
          </Text>
          {entries.map((item) => {
            const isCurrent = currentUser?.id === item.id;
            const rankEmoji =
              item.rank === 1 ? '👑' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;

            return (
              <View
                key={`full_entry_${item.id}`}
                style={[
                  styles.entryRow,
                  isCurrent && {
                    backgroundColor: colors.accentSoft,
                    borderColor: colors.accent,
                    borderWidth: 1,
                  },
                ]}
              >
                {/* Rank Number / Medal */}
                <View style={styles.entryRankBox}>
                  <Text style={[styles.entryRankText, { color: item.rank <= 3 ? '#F59E0B' : colors.textSecondary }]}>
                    {rankEmoji}
                  </Text>
                </View>

                {/* Avatar */}
                <Avatar
                  name={item.name}
                  avatarId={item.avatarId}
                  size={32}
                  style={{ marginRight: 10 }}
                />

                {/* Contributor Details */}
                <View style={styles.entryDetails}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                      <View style={[styles.adminTag, { backgroundColor: colors.accent }]}>
                        <Text style={styles.adminTagText}>Admin</Text>
                      </View>
                    )}
                    {isCurrent && (
                      <View style={[styles.adminTag, { backgroundColor: colors.accentSoft }]}>
                        <Text style={[styles.adminTagText, { color: colors.accent }]}>You</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.entryStudentId, { color: colors.textTertiary }]}>
                    {item.uniqueStudentId} {item.school ? `• ${item.school}` : ''}
                  </Text>
                </View>

                {/* Score & Uploads */}
                <View style={styles.entryScoreBox}>
                  <Text style={[styles.entryPoints, { color: colors.textPrimary }]}>
                    {item.points} pts
                  </Text>
                  <Text style={[styles.entryUploads, { color: colors.textTertiary }]}>
                    {item.uploadsCount} {item.uploadsCount === 1 ? 'paper' : 'papers'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeLiveText: {
    fontSize: 10,
    fontWeight: '600',
  },
  myRankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  myRankText: {
    fontSize: 11,
    fontWeight: '700',
  },
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 4,
    marginBottom: 12,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  podiumColumnCenter: {
    marginTop: -8,
  },
  podiumColumnSide: {
    marginTop: 6,
  },
  emptyPillar: {
    flex: 1,
  },
  crownBadgeWrap: {
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  crownGlowAura: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
  },
  crownBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownEmojiText: {
    fontSize: 14,
  },
  avatarRing: {
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 6,
  },
  adminShieldPill: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  podiumName: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
    maxWidth: 96,
  },
  podiumStudentId: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 5,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    maxWidth: 96,
  },
  podiumPointsPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 2,
  },
  podiumPointsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  podiumUploadsTag: {
    fontSize: 9,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  shareBtn: {},
  expandBtn: {},
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  expandedHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  entryRankBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  entryRankText: {
    fontSize: 13,
    fontWeight: '700',
  },
  entryDetails: {
    flex: 1,
    marginRight: 8,
  },
  entryName: {
    fontSize: 13,
  },
  entryStudentId: {
    fontSize: 11,
    marginTop: 1,
  },
  adminTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  adminTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  entryScoreBox: {
    alignItems: 'flex-end',
  },
  entryPoints: {
    fontSize: 13,
    fontWeight: '700',
  },
  entryUploads: {
    fontSize: 10,
    marginTop: 1,
  },
});
