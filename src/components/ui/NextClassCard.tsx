import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MapPin, Clock, BookOpen } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { useAppTheme } from '../../lib/ThemeContext';
import { theme } from '../../lib/theme';

export interface NextClassCardProps {
  subject?: string;
  room?: string;
  time?: string;
  timeLeftBadge?: string;
  progressPercent?: number; // 0..100
  faculty?: string;
  onPress?: () => void;
}

export const NextClassCard: React.FC<NextClassCardProps> = ({
  subject,
  room,
  time,
  timeLeftBadge,
  progressPercent = 0,
  faculty,
  onPress,
}) => {
  const { colors } = useAppTheme();

  if (!subject) {
    return (
      <GlassCard style={styles.card} onPress={onPress}>
        <View style={styles.emptyContainer}>
          <BookOpen size={24} color={colors.accent} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No more classes today</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            You're all caught up with your schedule.
          </Text>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.card} onPress={onPress} glow>
      {/* Top row: Next Class label + Time Left badge */}
      <View style={styles.topRow}>
        <View style={[styles.pillLabel, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.pillLabelText, { color: colors.accent }]}>NEXT CLASS</Text>
        </View>
        {timeLeftBadge && (
          <View style={[styles.badge, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
            <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{timeLeftBadge}</Text>
          </View>
        )}
      </View>

      {/* Main Info */}
      <Text style={[styles.subject, { color: colors.textPrimary }]} numberOfLines={1}>
        {subject}
      </Text>

      <View style={styles.detailsRow}>
        {room && (
          <View style={styles.detailItem}>
            <MapPin size={14} color={colors.accent} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>{room}</Text>
          </View>
        )}
        {time && (
          <View style={styles.detailItem}>
            <Clock size={14} color={colors.accent} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>{time}</Text>
          </View>
        )}
      </View>

      {/* Bottom Row: Faculty & Progress Indicator */}
      <View style={styles.bottomRow}>
        {faculty ? (
          <Text style={[styles.facultyText, { color: colors.textSecondary }]} numberOfLines={1}>
            {faculty}
          </Text>
        ) : (
          <View />
        )}
        {progressPercent > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, Math.max(0, progressPercent))}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
          </View>
        )}
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  pillLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillLabelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  subject: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    marginBottom: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  detailText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    marginLeft: 4,
  },
  facultyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  progressContainer: {
    width: 80,
    marginLeft: 12,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  emptyTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 2,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
});

export default NextClassCard;
