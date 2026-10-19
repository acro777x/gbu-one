import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { LogoMark } from './LogoMark';
import { motion } from '../../lib/motion';
import { useReduceMotion } from '../../lib/useReduceMotion';

export interface AnimatedLogoProps {
  size?: number;
  mode?: 'intro' | 'loading' | 'static';
  glow?: boolean;
  variant?: 'mark' | 'tile';
  reduceMotion?: boolean;
  onAnimationComplete?: () => void;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  size = 120,
  mode = 'intro',
  glow = true,
  variant = 'mark',
  reduceMotion,
  onAnimationComplete,
}) => {
  const systemReduce = useReduceMotion();
  const effectiveReduce = reduceMotion ?? systemReduce;

  const opacity = useSharedValue(mode === 'static' || effectiveReduce ? 1 : 0);
  const scale = useSharedValue(mode === 'static' || effectiveReduce ? 1 : 0.82);
  const glowOpacity = useSharedValue(mode === 'static' || effectiveReduce ? (glow ? 0.28 : 0) : 0);
  const glowScale = useSharedValue(mode === 'static' || effectiveReduce ? 1 : 0.85);

  useEffect(() => {
    if (effectiveReduce || mode === 'static') {
      opacity.value = 1;
      scale.value = 1;
      glowOpacity.value = glow ? 0.28 : 0;
      glowScale.value = 1;
      onAnimationComplete?.();
      return;
    }

    if (mode === 'loading') {
      opacity.value = 1;
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200, easing: motion.easing.inOut }),
          withTiming(1, { duration: 1200, easing: motion.easing.inOut }),
        ),
        -1,
        true,
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(glow ? 0.38 : 0, { duration: 1200, easing: motion.easing.inOut }),
          withTiming(glow ? 0.15 : 0, { duration: 1200, easing: motion.easing.inOut }),
        ),
        -1,
        true,
      );
      return;
    }

    // Intro entrance animation
    opacity.value = 0;
    scale.value = 0.82;
    glowOpacity.value = 0;
    glowScale.value = 0.8;

    // Fade in
    opacity.value = withTiming(1, { duration: 450, easing: motion.easing.out });

    // Snappy spring scale
    scale.value = withDelay(
      80,
      withSpring(
        1,
        { damping: 15, stiffness: 160, mass: 0.9 },
        (finished) => {
          if (finished && onAnimationComplete) {
            runOnJS(onAnimationComplete)();
          }
        },
      ),
    );

    // Glow pulse in
    glowOpacity.value = withDelay(
      120,
      withTiming(glow ? 0.35 : 0, { duration: 550, easing: motion.easing.out }),
    );
    glowScale.value = withDelay(
      120,
      withSpring(1.05, { damping: 14, stiffness: 150 }),
    );
  }, [mode, effectiveReduce, glow, onAnimationComplete]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {glow && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowCircle,
            {
              width: size * 1.5,
              height: size * 1.5,
              borderRadius: size * 0.75,
            },
            glowAnimatedStyle,
          ]}
        />
      )}
      <Animated.View style={markStyle}>
        <LogoMark size={size} variant={variant} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 106, 43, 0.28)',
    shadowColor: '#FF6A2B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 36,
    elevation: 10,
  },
});

export default AnimatedLogo;
