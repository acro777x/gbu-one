import { StyleSheet, View, Text } from 'react-native';
import { Clock } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { theme } from '../../lib/theme';

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
  return (
    <GlassCard style={styles.card} onPress={onPress}>
      {/* Top row: Category, Importance Dot, Deadline */}
      <View style={styles.topRow}>
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{category}</Text>
          </View>
          {importance > 1 && (
            <View style={styles.importanceDot} />
          )}
        </View>

        {deadlineBadge && (
          <View style={styles.deadlineBadge}>
            <Clock size={12} color={theme.colors.warning} />
            <Text style={styles.deadlineText}>{deadlineBadge}</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {/* Bottom meta row: Source, Date, Thread count */}
      <View style={styles.bottomRow}>
        <Text style={styles.metaText}>{source} • {date}</Text>
        {threadUpdateCount && threadUpdateCount > 1 ? (
          <View style={styles.threadBadge}>
            <Text style={styles.threadText}>Updated {threadUpdateCount} times</Text>
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
  },
  categoryText: {
    color: theme.colors.accent,
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  importanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
    marginLeft: 6,
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 184, 61, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
  },
  deadlineText: {
    color: theme.colors.warning,
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginLeft: 4,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.ivory,
    marginBottom: theme.spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  threadBadge: {
    backgroundColor: 'rgba(255, 106, 43, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  threadText: {
    color: theme.colors.accent,
    fontFamily: 'Inter-Medium',
    fontSize: 10,
  },
});

export default NoticeCard;
