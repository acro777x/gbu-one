import React, { useEffect } from 'react';
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

export interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  bottomOffset?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  visible,
  onDismiss,
  duration = 2500,
  bottomOffset = 96,
}) => {
  const { colors, isDark } = useAppTheme();
  const translateY = useSharedValue(60);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, motion.spring.snappy);
      opacity.value = withTiming(1, { duration: 200 });

      // Auto dismiss
      const timer = setTimeout(() => {
        translateY.value = withTiming(60, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(onDismiss)();
          }
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.value = 60;
      opacity.value = 0;
    }
  }, [visible, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { bottom: bottomOffset }, animatedStyle]}
      pointerEvents="none"
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
        <Text style={[styles.text, { color: colors.textPrimary }]}>{message}</Text>
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
