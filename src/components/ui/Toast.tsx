import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { motion } from '../../lib/motion';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';
import { useReduceMotion } from '../../lib/useReduceMotion';

export interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  bottomOffset?: number;
}

/**
 * GBU One — the toast.
 *
 * The toast used to be a single slot: a second toast overwrote the first one
 * and the auto-dismiss timer was keyed on `[visible, duration]`, so
 * replacing the message mid-flight did not restart the timer (a toast shown
 * at t = 2.4 s disappeared 0.1 s later).
 *
 * It is a queue now: a message that arrives while another one is on screen
 * waits its turn instead of replacing it, and every message gets the full
 * duration on screen.
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  visible,
  onDismiss,
  duration = 2500,
  bottomOffset = 96,
}) => {
  const { colors, isDark } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const translateY = useSharedValue(60);
  const opacity = useSharedValue(0);

  /** The message that is on screen right now. */
  const [current, setCurrent] = useState<string | null>(null);
  /** The messages that are waiting for their turn. */
  const [pending, setPending] = useState<string[]>([]);

  const currentRef = useRef<string | null>(null);
  const pendingRef = useRef<string[]>([]);
  /**
   * The dismiss callback is kept in a ref instead of being a dependency of
   * the timer effect: callers pass an inline arrow (`() => setVisible(false)`),
   * and putting it in the dependency list would restart the timer on every
   * render of the parent, so the toast would never dismiss itself.
   */
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // A message that arrives while another one is on screen joins the queue.
  useEffect(() => {
    if (!visible) return;
    if (!message) return;
    if (currentRef.current === message) return;
    if (pendingRef.current.includes(message)) return;
    pendingRef.current = [...pendingRef.current, message];
    setPending(pendingRef.current);
  }, [message, visible]);

  // The head of the queue moves onto the screen.
  useEffect(() => {
    if (!visible) {
      pendingRef.current = [];
      currentRef.current = null;
      setPending([]);
      setCurrent(null);
      return;
    }
    if (currentRef.current !== null) return;
    if (pendingRef.current.length === 0) return;
    const next = pendingRef.current[0];
    pendingRef.current = pendingRef.current.slice(1);
    currentRef.current = next;
    setPending(pendingRef.current);
    setCurrent(next);
  }, [visible, pending, current]);

  // The entrance animation of whatever is on screen.
  useEffect(() => {
    if (current === null) {
      translateY.value = reduceMotion ? 0 : 60;
      opacity.value = 0;
      return;
    }
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
      return;
    }
    translateY.value = withSpring(0, motion.spring.snappy);
    opacity.value = withTiming(1, { duration: 200 });
  }, [current, reduceMotion, translateY, opacity]);

  // The auto-dismiss timer. It is keyed on the message, so a new message
  // gets the full duration.
  useEffect(() => {
    if (!visible || current === null) return;

    const timer = setTimeout(() => {
      const finish = () => {
        currentRef.current = null;
        setCurrent(null);
        // Nothing else is waiting: the toast is done.
        if (pendingRef.current.length === 0) {
          onDismissRef.current();
        }
      };

      if (reduceMotion) {
        finish();
        return;
      }

      translateY.value = withTiming(60, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(finish)();
        }
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, current, duration, reduceMotion, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible || current === null) return null;

  return (
    <Animated.View
      style={[styles.container, { bottom: bottomOffset }, animatedStyle]}
      pointerEvents="none"
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={current}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.borderGlass,
            shadowColor: isDark ? '#000000' : colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.text, { color: colors.textPrimary }]}>{current}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  text: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
});

export default Toast;
