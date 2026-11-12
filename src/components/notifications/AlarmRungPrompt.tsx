/**
 * GBU One - the prompt that appears when a class alarm rang.
 *
 * It offers the two things a student wants at that moment: push the alarm
 * back ten minutes, or clear it. The bell and the sheet animate in with the
 * app's own motion, so it reads as part of the app rather than a system
 * dialog.
 *
 * Two things are deliberate:
 *
 *  1. **A stray tap must not dismiss the alarm.** The sheet's backdrop is
 *     inert, and the close control is labelled with the ACTION it performs
 *     ("Dismiss the class alarm") so a screen reader says what will happen.
 *  2. **A screen reader has to be told.** The alarm can ring while the
 *     student is somewhere else in the app, so the sheet announces itself
 *     and carries a live region.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, AccessibilityInfo } from 'react-native';
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
import { formatLeadTimeVerbose } from '../../features/notifications/notificationPreferences';
import type { RingedAlarm } from '../../features/notifications/useClassAlarmLifecycle';

export interface AlarmRungPromptProps {
  /** The alarm that rang, or null when there is nothing to answer. */
  alarm: RingedAlarm | null;
  /** Pushes the alarm back ten minutes. */
  onSnooze: () => void;
  /** Clears the alarm. */
  onDismiss: () => void;
  /** The last thing that went wrong, e.g. a snooze that could not be armed. */
  error?: string | null;
}

export const AlarmRungPrompt: React.FC<AlarmRungPromptProps> = ({
  alarm,
  onSnooze,
  onDismiss,
  error,
}) => {
  const { colors } = useAppTheme();
  const bellScale = useSharedValue(0.6);
  const bellRotate = useSharedValue(-12);
  const titleOpacity = useSharedValue(0);
  const titleShift = useSharedValue(12);
  const announcedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!alarm) return;
    bellScale.value = withSpring(1, motion.spring.bouncy);
    bellRotate.value = withSpring(0, motion.spring.snappy);
    titleOpacity.value = withTiming(1, { duration: 220 });
    titleShift.value = withSpring(0, motion.spring.snappy);
  }, [alarm, bellScale, bellRotate, titleOpacity, titleShift]);

  /**
   * Tell the student the alarm rang.
   *
   * The alarm can ring while the student is reading something else, and the
   * sheet is not necessarily on screen at that moment, so the announcement
   * is made explicitly. It is made once per alarm, not on every render.
   */
  useEffect(() => {
    if (!alarm) return;
    const key = `${alarm.reminder.slotId}:${alarm.reminder.fireAt}`;
    if (announcedFor.current === key) return;
    announcedFor.current = key;
    const lead = alarm.reminder.leadMinutes;
    const when =
      lead > 0
        ? `${formatLeadTimeVerbose(lead)} before it starts`
        : 'the class starts now';
    try {
      AccessibilityInfo.announceForAccessibility(
        `Class alarm. ${alarm.subject}, ${when}.`,
      );
    } catch {
      // A platform without the announcement API simply does not announce.
    }
  }, [alarm]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bellScale.value }, { rotate: `${bellRotate.value}deg` }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleShift.value }],
  }));

  if (!alarm) return null;

  const lead = alarm.reminder.leadMinutes;
  const leadText =
    lead > 0
      ? ` The alarm rang ${formatLeadTimeVerbose(lead)} before it starts.`
      : ' The alarm rang as the class started.';

  return (
    <SheetOverlay
      visible
      onClose={onDismiss}
      title="Class alarm"
      // A tap on the backdrop must not throw the alarm away: the student
      // answers it with Snooze or Dismiss, on purpose.
      dismissOnBackdropPress={false}
      closeLabel="Dismiss the class alarm"
    >
      <View style={styles.body} accessibilityLiveRegion="assertive">
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
          <Text
            style={[styles.subject, { color: colors.textPrimary }]}
            accessibilityRole="header"
          >
            {alarm.subject}
          </Text>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            {alarm.reminder.start} class.{leadText}
          </Text>
          {alarm.delivered === false ? (
            <Text style={[styles.detail, { color: colors.textTertiary }]}>
              The app did not see this notification arrive, so the alarm may
              not have been delivered.
            </Text>
          ) : null}
        </Animated.View>

        {error ? (
          <Text
            style={[styles.error, { color: colors.danger }]}
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}

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
  error: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
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
