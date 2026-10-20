import React from 'react';
import { StyleSheet, View, Text, Modal, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppTheme } from '../../lib/ThemeContext';
import { radius, spacing } from '../../lib/theme';

export interface TimetableChangeModalProps {
  visible: boolean;
  classKey: string;
  changeMessage: string;
  changeType?: 'moved' | 'room_changed' | 'added' | 'removed';
  onDismiss: () => void;
  onViewTimetable?: () => void;
}

export const TimetableChangeModal: React.FC<TimetableChangeModalProps> = ({
  visible,
  classKey,
  changeMessage,
  changeType = 'moved',
  onDismiss,
  onViewTimetable,
}) => {
  const { colors } = useAppTheme();

  if (!visible) return null;

  const handleView = () => {
    onDismiss();
    if (onViewTimetable) {
      onViewTimetable();
    } else {
      router.push('/(tabs)/timetable');
    }
  };

  const getBadgeInfo = () => {
    switch (changeType) {
      case 'room_changed':
        return {
          title: 'ROOM RESCHEDULED',
          icon: 'business-outline' as const,
          color: colors.warning,
          bg: colors.warningSoft,
        };
      case 'added':
        return {
          title: 'NEW CLASS ADDED',
          icon: 'add-circle-outline' as const,
          color: colors.success,
          bg: colors.successSoft,
        };
      case 'removed':
        return {
          title: 'CLASS CANCELLED',
          icon: 'close-circle-outline' as const,
          color: colors.danger,
          bg: colors.dangerSoft,
        };
      default:
        return {
          title: 'TIMETABLE RESCHEDULED',
          icon: 'time-outline' as const,
          color: colors.accent,
          bg: colors.accentSoft,
        };
    }
  };

  const badge = getBadgeInfo();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <Animated.View
          entering={SlideInUp.springify().damping(16).stiffness(160)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderGlass,
            },
          ]}
        >
          {/* Top Badge */}
          <View style={styles.headerRow}>
            <View style={[styles.badgeContainer, { backgroundColor: badge.bg }]}>
              <Ionicons name={badge.icon} size={14} color={badge.color} style={styles.badgeIcon} />
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.title}</Text>
            </View>
            <View style={[styles.classChip, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.classChipText, { color: colors.textSecondary }]}>{classKey}</Text>
            </View>
          </View>

          {/* Change Content */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>Class Schedule Updated</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{changeMessage}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onDismiss}
              style={[
                styles.button,
                styles.secondaryButton,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Dismiss</Text>
            </Pressable>

            <Pressable
              onPress={handleView}
              style={[styles.button, styles.primaryButton, { backgroundColor: colors.accentFill }]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onAccent }]}>View Schedule</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onAccent} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.chip,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  classChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.chip,
  },
  classChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 19,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  secondaryButton: {
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  primaryButton: {},
  primaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
});
