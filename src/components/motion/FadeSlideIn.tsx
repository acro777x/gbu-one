import React, { useEffect } from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '../../lib/motion';
import { useReduceMotion } from '../../lib/useReduceMotion';

export interface FadeSlideInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  reduceMotion?: boolean;
}

export const FadeSlideIn: React.FC<FadeSlideInProps> = ({
  children,
  delay = 0,
  duration = 350,
  distance = 16,
  direction = 'up',
  style,
  reduceMotion,
}) => {
  const systemReduce = useReduceMotion();
  const effectiveReduce = reduceMotion ?? systemReduce;

  const initialTranslate =
    direction === 'up'
      ? distance
      : direction === 'down'
      ? -distance
      : 0;

  const opacity = useSharedValue(effectiveReduce ? 1 : 0);
  const translateY = useSharedValue(effectiveReduce ? 0 : initialTranslate);

  useEffect(() => {
    if (effectiveReduce) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    opacity.value = withDelay(delay, withTiming(1, { duration }));
    translateY.value = withDelay(delay, withSpring(0, motion.spring.snappy));
  }, [delay, duration, effectiveReduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

export default FadeSlideIn;
