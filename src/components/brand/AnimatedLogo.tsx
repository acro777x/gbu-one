import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LogoMark } from './LogoMark';
import { motion } from '../../lib/motion';

export interface AnimatedLogoProps {
  size?: number;
  mode?: 'intro' | 'loading' | 'static';
  glow?: boolean;
  reduceMotion?: boolean;
  onAnimationComplete?: () => void;
}

/**
 * Animates the finished mark as a single asset. The previous implementation
 * applied strokeDasharray to filled polygon paths, which revealed the logo as
 * broken geometry. Branding should never be reconstructed by the animation.
 */
export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  size = 120,
  mode = 'intro',
  glow = true,
  reduceMotion = false,
  onAnimationComplete,
}) => {
  const opacity = useSharedValue(mode === 'static' || reduceMotion ? 1 : 0);
  const scale = useSharedValue(mode === 'static' || reduceMotion ? 1 : 0.88);
  const glowOpacity = useSharedValue(mode === 'static' || reduceMotion ? 0.16 : 0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || mode === 'static') {
      opacity.value = 1;
      scale.value = 1;
      glowOpacity.value = glow ? 0.16 : 0;
      onAnimationComplete?.();
      return;
    }

    if (mode === 'loading') {
      opacity.value = 1;
      scale.value = withRepeat(
        withSequence(
          withTiming(1.035, { duration: 1200, easing: motion.easing.inOut }),
          withTiming(1, { duration: 1200, easing: motion.easing.inOut }),
        ),
        -1,
        true,
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(glow ? 0.28 : 0, { duration: 1200, easing: motion.easing.inOut }),
          withTiming(glow ? 0.1 : 0, { duration: 1200, easing: motion.easing.inOut }),
        ),
        -1,
        true,
      );
      return;
    }

    opacity.value = 0;
    scale.value = 0.88;
    glowOpacity.value = 0;
    rotation.value = 0;
    glowOpacity.value = withTiming(glow ? 0.2 : 0, { duration: 260 });
    opacity.value = withDelay(100, withTiming(1, { duration: 420, easing: motion.easing.out }));
    scale.value = withDelay(100, withTiming(1, { duration: 620, easing: motion.easing.out }));
    rotation.value = withTiming(360, { duration: 900, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        rotation.value = 0;
      }
    });
    const timer = setTimeout(() => onAnimationComplete?.(), 760);
    return () => clearTimeout(timer);
  }, [mode, reduceMotion, glow]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotation.value * 0.08}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {glow && (
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { width: size * 1.45, height: size * 1.45, borderRadius: size }, glowStyle]}
        />
      )}
      <Animated.View style={markStyle}>
        <LogoMark size={size} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { justifyContent: 'center', alignItems: 'center' },
  glow: {
    position: 'absolute',
    backgroundColor: '#E85B22',
    shadowColor: '#E85B22',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
});

export default AnimatedLogo;
