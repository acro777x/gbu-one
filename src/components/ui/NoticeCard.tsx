import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Clock } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { useAppTheme } from '../../lib/ThemeContext';
import { spacing, radius } from '../../lib/theme';

export interface NoticeCardProps {
  id: string;
  category: string;
  title: string;
  source: string;
  date: string;
  importance?: number; // 1-3
  deadlineBadge?: string;
  threadUpdateCount?: number;
  onPress: () => void;
}

export const NoticeCard: React.FC<NoticeCardProps> = ({
  category,
  title,
  source,
  date,
  importance = 1,
  deadlineBadge,
  threadUpdateCount,
  onPress,
}) => {
  const { colors, isDark } = useAppTheme();

  return (
    <GlassCard style={styles.card} onPress={onPress}>
      {/* Top row: Category, Importance Dot, Deadline */}
      <View style={styles.topRow}>
        <View style={styles.categoryRow}>
          <View style={[styles.categoryBadge, { backgroundColor: `${colors.accent}15` }]}>
            <Text style={[styles.categoryText, { color: colors.accent }]}>{category}</Text>
          </View>
          {importance > 1 && (
            <View style={[styles.importanceDot, { backgroundColor: colors.accent }]} />
          )}
        </View>

        {deadlineBadge && (
          <View style={[styles.deadlineBadge, { backgroundColor: isDark ? 'rgba(245, 184, 61, 0.16)' : 'rgba(245, 184, 61, 0.12)' }]}>
            <Clock size={12} color={colors.warning} />
            <Text style={[styles.deadlineText, { color: colors.warning }]}>{deadlineBadge}</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
        {title}
      </Text>

      {/* Bottom meta row: Source, Date, Thread count */}
      <View style={styles.bottomRow}>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>{source} • {date}</Text>
        {threadUpdateCount && threadUpdateCount > 1 ? (
          <View style={[styles.threadBadge, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.threadText, { color: colors.accent }]}>Updated {threadUpdateCount} times</Text>
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.chip,
  },
  categoryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  importanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.chip,
  },
  deadlineText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginLeft: 4,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  threadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  threadText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
});

export default NoticeCard;
