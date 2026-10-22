/**
 * GBU One - the row that says the class alarm is on.
 *
 * It is not a plain pill: the bell rings once when the alarm goes on, the
 * row settles in with the app's own spring, and everything is in the app's
 * accent colour rather than a stock green.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BellRing } from 'lucide-react-native';
import { useAppTheme } from '../../lib/ThemeContext';
import { motion } from '../../lib/motion';
import { theme } from '../../lib/theme';

export interface AlarmStateRowProps {
  /** The text, e.g. "Alarm set 1 hour before". */
  label: string;
  /** Clears the alarm. */
  onCancel: () => void;
}

export const AlarmStateRow: React.FC<AlarmStateRowProps> = ({ label, onCancel }) => {
  const { colors } = useAppTheme();
  const enter = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    enter.value = withSpring(1, motion.spring.snappy);
    // The bell gives one ring when the alarm goes on.
    ring.value = withSequence(
      withTiming(-14, { duration: 130 }),
      withTiming(12, { duration: 130 }),
      withTiming(-7, { duration: 110 }),
      withTiming(0, { duration: 110 }),
    );
  }, [enter, ring]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 10 }, { scale: 0.98 + enter.value * 0.02 }],
  }));

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.row,
        { backgroundColor: colors.accentSoft, borderColor: colors.accent },
        rowStyle,
      ]}
    >
      <Animated.View style={bellStyle}>
        <BellRing size={16} color={colors.accent} />
      </Animated.View>

      <Text style={[styles.label, { color: colors.accent }]}>{label}</Text>

      <TouchableOpacity
        onPress={onCancel}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Cancel the alarm. ${label}`}
        style={styles.cancel}
      >
        <Text style={[styles.cancelText, { color: colors.accent }]}>Cancel</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: theme.spacing.sm,
  },
  label: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  cancel: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
});

export default AlarmStateRow;
