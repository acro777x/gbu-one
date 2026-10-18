import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MapPin, Clock, BookOpen } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
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
  if (!subject) {
    return (
      <GlassCard style={styles.card} onPress={onPress}>
        <View style={styles.emptyContainer}>
          <BookOpen size={24} color={theme.colors.accent} />
          <Text style={styles.emptyTitle}>No more classes today</Text>
          <Text style={styles.emptySubtitle}>You're all caught up with your schedule.</Text>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.card} onPress={onPress} glow>
      {/* Top row: Next Class label + Time Left badge */}
      <View style={styles.topRow}>
        <View style={styles.pillLabel}>
          <Text style={styles.pillLabelText}>NEXT CLASS</Text>
        </View>
        {timeLeftBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{timeLeftBadge}</Text>
          </View>
        )}
      </View>

      {/* Main Info */}
      <Text style={styles.subject} numberOfLines={1}>
        {subject}
      </Text>

      <View style={styles.detailsRow}>
        {room && (
          <View style={styles.detailItem}>
            <MapPin size={14} color={theme.colors.accent} />
            <Text style={styles.detailText}>{room}</Text>
          </View>
        )}

        {time && (
          <View style={styles.detailItem}>
            <Clock size={14} color={theme.colors.textSecondary} />
            <Text style={styles.detailText}>{time}</Text>
          </View>
        )}

        {faculty && (
          <Text style={styles.facultyText} numberOfLines={1}>
            • {faculty}
          </Text>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progressPercent))}%` }]} />
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
  pillLabel: {
    backgroundColor: 'rgba(255, 106, 43, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
  },
  pillLabelText: {
    color: theme.colors.accent,
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#202024',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.chip,
  },
  badgeText: {
    color: theme.colors.ivory,
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  subject: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: theme.colors.ivory,
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
    color: theme.colors.textSecondary,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    marginLeft: 4,
  },
  facultyText: {
    color: theme.colors.textSecondary,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  emptyTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: theme.colors.ivory,
    marginTop: 8,
    marginBottom: 2,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});

export default NextClassCard;
