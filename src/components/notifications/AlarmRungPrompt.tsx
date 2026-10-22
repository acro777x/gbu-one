/**
 * GBU One - the prompt that appears when a class alarm rang.
 *
 * It offers the two things a student wants at that moment: push the alarm
 * back ten minutes, or clear it. The bell and the sheet animate in with the
 * app's own motion, so it reads as part of the app rather than a system
 * dialog.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Bell, AlarmClockPlus, X } from 'lucide-react-native';
import { SheetOverlay } from '../ui/SheetOverlay';
import { PillButton } from '../ui';
import { useAppTheme } from '../../lib/ThemeContext';
import { motion } from '../../lib/motion';
import { theme } from '../../lib/theme';
import type { RingedAlarm } from '../../features/notifications/useClassAlarmLifecycle';

export interface AlarmRungPromptProps {
  /** The alarm that rang, or null when there is nothing to answer. */
  alarm: RingedAlarm | null;
  /** Pushes the alarm back ten minutes. */
  onSnooze: () => void;
  /** Clears the alarm. */
  onDismiss: () => void;
}

export const AlarmRungPrompt: React.FC<AlarmRungPromptProps> = ({
  alarm,
  onSnooze,
  onDismiss,
}) => {
  const { colors } = useAppTheme();
  const bellScale = useSharedValue(0.6);
  const bellRotate = useSharedValue(-12);
  const titleOpacity = useSharedValue(0);
  const titleShift = useSharedValue(12);

  useEffect(() => {
    if (!alarm) return;
    bellScale.value = withSpring(1, motion.spring.bouncy);
    bellRotate.value = withSpring(0, motion.spring.snappy);
    titleOpacity.value = withTiming(1, { duration: 220 });
    titleShift.value = withSpring(0, motion.spring.snappy);
  }, [alarm, bellScale, bellRotate, titleOpacity, titleShift]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bellScale.value }, { rotate: `${bellRotate.value}deg` }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleShift.value }],
  }));

  if (!alarm) return null;

  return (
    <SheetOverlay visible onClose={onDismiss} title="Class alarm">
      <View style={styles.body}>
        <Animated.View
          style={[
            styles.bell,
            { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            bellStyle,
          ]}
        >
          <Bell size={30} color={colors.accent} />
        </Animated.View>

        <Animated.View style={textStyle}>
          <Text style={[styles.subject, { color: colors.textPrimary }]}>
            {alarm.subject}
          </Text>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            {alarm.reminder.start} class - the alarm rang
            {alarm.reminder.leadMinutes > 0
              ? ` ${alarm.reminder.leadMinutes} minutes before it starts.`
              : '.'}
          </Text>
        </Animated.View>

        <View style={styles.actions}>
          <PillButton
            label="Snooze 10 min"
            onPress={onSnooze}
            variant="primary"
            size="md"
            icon={<AlarmClockPlus size={16} color={colors.onAccent} style={{ marginRight: 6 }} />}
            style={styles.action}
          />
          <PillButton
            label="Dismiss"
            onPress={onDismiss}
            variant="white"
            size="md"
            icon={<X size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />}
            style={styles.action}
          />
        </View>
      </View>
    </SheetOverlay>
  );
};

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  bell: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  subject: {
    fontFamily: 'Poppins-Bold',
    fontSize: 19,
    textAlign: 'center',
  },
  detail: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    alignSelf: 'stretch',
  },
  action: {
    flex: 1,
  },
});

export default AlarmRungPrompt;
