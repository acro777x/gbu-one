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

export interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  visible,
  onDismiss,
  duration = 2500,
}) => {
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
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <View style={styles.pill}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    backgroundColor: '#202024',
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    color: theme.colors.textPrimary,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
});

export default Toast;
