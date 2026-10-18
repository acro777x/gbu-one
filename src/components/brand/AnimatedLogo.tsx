import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LOGO_PATHS } from './logoPaths';
import { motion } from '../../lib/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface AnimatedLogoProps {
  size?: number;
  mode?: 'intro' | 'loading' | 'static';
  glow?: boolean;
  reduceMotion?: boolean;
  onAnimationComplete?: () => void;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  size = 120,
  mode = 'intro',
  glow = true,
  reduceMotion = false,
  onAnimationComplete,
}) => {
  // Shared animation values
  const ribbonAProgress = useSharedValue(mode === 'intro' ? 0 : 1);
  const ribbonBProgress = useSharedValue(mode === 'intro' ? 0 : 1);
  const fillOpacity = useSharedValue(mode === 'intro' ? 0 : 1);
  const markScale = useSharedValue(mode === 'intro' ? 0.92 : 1);
  const domeTranslateY = useSharedValue(mode === 'intro' ? 14 : 0);
  const domeOpacity = useSharedValue(mode === 'intro' ? 0 : 1);
  const numeralScale = useSharedValue(mode === 'intro' ? 0.85 : 1);
  const numeralOpacity = useSharedValue(mode === 'intro' ? 0 : 1);
  const glowOpacity = useSharedValue(mode === 'intro' ? 0 : 0.3);
  const ringRotation = useSharedValue(0);
  const rippleScale = useSharedValue(0.8);
  const rippleOpacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || mode === 'static') {
      ribbonAProgress.value = 1;
      ribbonBProgress.value = 1;
      fillOpacity.value = 1;
      markScale.value = 1;
      domeTranslateY.value = 0;
      domeOpacity.value = 1;
      numeralScale.value = 1;
      numeralOpacity.value = 1;
      glowOpacity.value = glow ? 0.3 : 0;
      if (onAnimationComplete) {
        onAnimationComplete();
      }
      return;
    }

    if (mode === 'loading') {
      // Continuous gentle rotation and breathing
      fillOpacity.value = 1;
      domeOpacity.value = 1;
      numeralOpacity.value = 1;
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.45, { duration: 1200, easing: motion.easing.inOut }),
          withTiming(0.2, { duration: 1200, easing: motion.easing.inOut }),
        ),
        -1,
        true,
      );
      numeralScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200, easing: motion.easing.inOut }),
          withTiming(1.0, { duration: 1200, easing: motion.easing.inOut }),
        ),
        -1,
        true,
      );
      ringRotation.value = withRepeat(
        withTiming(360, { duration: 6000, easing: Easing.linear }),
        -1,
        false,
      );
      return;
    }

    if (mode === 'intro') {
      // Reset
      ribbonAProgress.value = 0;
      ribbonBProgress.value = 0;
      fillOpacity.value = 0;
      markScale.value = 0.92;
      domeTranslateY.value = 14;
      domeOpacity.value = 0;
      numeralScale.value = 0.85;
      numeralOpacity.value = 0;
      glowOpacity.value = 0;

      // 1. Glow fades in 0-250ms
      glowOpacity.value = withTiming(0.35, { duration: 250, easing: motion.easing.out });

      // 2. Ring ribbons stroke draw 250-950ms (staggered 120ms)
      ribbonAProgress.value = withDelay(
        250,
        withTiming(1, { duration: 700, easing: motion.easing.out }),
      );
      ribbonBProgress.value = withDelay(
        370,
        withTiming(1, { duration: 700, easing: motion.easing.out }),
      );

      // 3. Fill fades in + spring scale 800-1100ms
      fillOpacity.value = withDelay(
        800,
        withTiming(1, { duration: 300, easing: motion.easing.out }),
      );
      markScale.value = withDelay(
        800,
        withSpring(1, motion.spring.soft),
      );

      // 4. Dome rises 550-950ms
      domeOpacity.value = withDelay(
        550,
        withTiming(1, { duration: 350, easing: motion.easing.out }),
      );
      domeTranslateY.value = withDelay(
        550,
        withSpring(0, motion.spring.soft),
      );

      // 5. Numeral 1 scales in 850-1150ms
      numeralOpacity.value = withDelay(
        850,
        withTiming(1, { duration: 250, easing: motion.easing.out }),
      );
      numeralScale.value = withDelay(
        850,
        withSpring(1, motion.spring.snappy, (finished) => {
          if (finished && onAnimationComplete) {
            runOnJS(onAnimationComplete)();
          }
        }),
      );

      // 6. Ripple at 1100ms
      rippleOpacity.value = withDelay(
        1100,
        withSequence(
          withTiming(0.4, { duration: 100 }),
          withTiming(0, { duration: 500, easing: motion.easing.out }),
        ),
      );
      rippleScale.value = withDelay(
        1100,
        withTiming(1.3, { duration: 600, easing: motion.easing.out }),
      );
    }
  }, [mode, reduceMotion]);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: markScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  const domeStyle = useAnimatedStyle(() => ({
    opacity: domeOpacity.value,
    transform: [{ translateY: domeTranslateY.value }],
  }));

  const numeralStyle = useAnimatedStyle(() => ({
    opacity: numeralOpacity.value,
    transform: [{ scale: numeralScale.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));

  // Animated path props for stroke-draw
  const animatedRibbonAProps = useAnimatedProps(() => {
    const len = LOGO_PATHS.ribbonA.length;
    return {
      strokeDashoffset: len * (1 - ribbonAProgress.value),
      fillOpacity: fillOpacity.value,
    };
  });

  const animatedRibbonBProps = useAnimatedProps(() => {
    const len = LOGO_PATHS.ribbonB.length;
    return {
      strokeDashoffset: len * (1 - ribbonBProgress.value),
      fillOpacity: fillOpacity.value,
    };
  });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {/* Code-driven soft radial glow layer */}
      {glow && (
        <Animated.View
          style={[
            styles.glowLayer,
            {
              width: size * 1.5,
              height: size * 1.5,
              borderRadius: (size * 1.5) / 2,
            },
            glowStyle,
          ]}
        />
      )}

      {/* Ripple ring layer */}
      <Animated.View
        style={[
          styles.rippleLayer,
          {
            width: size * 1.1,
            height: size * 1.1,
            borderRadius: (size * 1.1) / 2,
          },
          rippleStyle,
        ]}
      />

      {/* Mark layers */}
      <Animated.View style={[styles.markContainer, { width: size, height: size }, containerStyle]}>
        {/* Ring ribbons (rotating in loading mode) */}
        <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
          <Svg viewBox={LOGO_PATHS.viewBox} width={size} height={size} fill="none">
            <Defs>
              <LinearGradient id="animRingGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={LOGO_PATHS.colors.ringGradStart} />
                <Stop offset="50%" stopColor={LOGO_PATHS.colors.ringGradMid} />
                <Stop offset="100%" stopColor={LOGO_PATHS.colors.ringGradEnd} />
              </LinearGradient>
            </Defs>

            {/* Ribbon A */}
            <AnimatedPath
              d={LOGO_PATHS.ribbonA.d}
              fill="url(#animRingGrad)"
              stroke="url(#animRingGrad)"
              strokeWidth={3}
              strokeDasharray={LOGO_PATHS.ribbonA.length}
              animatedProps={animatedRibbonAProps}
            />

            {/* Ribbon B */}
            <AnimatedPath
              d={LOGO_PATHS.ribbonB.d}
              fill="url(#animRingGrad)"
              stroke="url(#animRingGrad)"
              strokeWidth={3}
              strokeDasharray={LOGO_PATHS.ribbonB.length}
              animatedProps={animatedRibbonBProps}
            />
          </Svg>
        </Animated.View>

        {/* Dome & Finial (rises with spring) */}
        <Animated.View style={[StyleSheet.absoluteFill, domeStyle]}>
          <Svg viewBox={LOGO_PATHS.viewBox} width={size} height={size} fill="none">
            <Path d={LOGO_PATHS.domeFinial.d} fill={LOGO_PATHS.colors.dome} />
          </Svg>
        </Animated.View>

        {/* Numeral 1 (scales in from center with spring) */}
        <Animated.View style={[StyleSheet.absoluteFill, numeralStyle]}>
          <Svg viewBox={LOGO_PATHS.viewBox} width={size} height={size} fill="none">
            <Path d={LOGO_PATHS.numeralOne.d} fill={LOGO_PATHS.colors.numeral} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  markContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowLayer: {
    position: 'absolute',
    backgroundColor: '#FF6A2B',
    shadowColor: '#FF6A2B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 28,
    elevation: 15,
  },
  rippleLayer: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FC6C1E',
  },
});

export default AnimatedLogo;
