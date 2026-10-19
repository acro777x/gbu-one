import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { AnimatedLogo } from './AnimatedLogo';
import { LetterRise } from '../motion/LetterRise';
import { TypeWriter } from '../motion/TypeWriter';
import { OfficialSeal } from './OfficialSeal';
import { useAppTheme } from '../../lib/ThemeContext';
import { useReduceMotion } from '../../lib/useReduceMotion';
import { theme } from '../../lib/theme';

export interface SplashScreenViewProps {
  isWarmStart?: boolean;
  reduceMotion?: boolean;
  onFinish: () => void;
}

export const SplashScreenView: React.FC<SplashScreenViewProps> = ({
  isWarmStart = false,
  reduceMotion,
  onFinish,
}) => {
  const { colors } = useAppTheme();
  const systemReduce = useReduceMotion();
  const effectiveReduce = reduceMotion ?? systemReduce;

  const [showWordmark, setShowWordmark] = useState(isWarmStart || effectiveReduce);
  const [showTagline, setShowTagline] = useState(isWarmStart || effectiveReduce);
  const containerOpacity = useSharedValue(1);
  const hasFinishedRef = useRef(false);

  const triggerFinish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    onFinish();
  };

  const finishHandoff = () => {
    if (hasFinishedRef.current) return;
    containerOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(triggerFinish)();
      }
    });
    setTimeout(() => {
      triggerFinish();
    }, 280);
  };

  useEffect(() => {
    if (effectiveReduce) {
      const timer = setTimeout(finishHandoff, 350);
      return () => clearTimeout(timer);
    }

    if (isWarmStart) {
      const timer = setTimeout(finishHandoff, 650);
      return () => clearTimeout(timer);
    }

    // Cold start timings:
    // 250ms: Wordmark starts rising
    const wordmarkTimer = setTimeout(() => {
      setShowWordmark(true);
    }, 250);

    // 650ms: Tagline typewriter starts
    const taglineTimer = setTimeout(() => {
      setShowTagline(true);
    }, 650);

    // 1950ms: Handoff fades out and navigates
    const handoffTimer = setTimeout(() => {
      finishHandoff();
    }, 1950);

    return () => {
      clearTimeout(wordmarkTimer);
      clearTimeout(taglineTimer);
      clearTimeout(handoffTimer);
    };
  }, [isWarmStart, effectiveReduce]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const handleTapToSkip = () => {
    finishHandoff();
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.bg }, animatedContainerStyle]}>
      <Pressable style={styles.pressableArea} onPress={handleTapToSkip}>
        {/* Animated Brand Mark */}
        <AnimatedLogo
          size={144}
          mode={isWarmStart ? 'static' : 'intro'}
          glow
          variant="tile"
          reduceMotion={effectiveReduce}
        />

        {/* Live Wordmark: Poppins Bold "GBU" ivory/dark + "One" orange */}
        <View style={styles.wordmarkContainer}>
          {showWordmark && (
            <View style={styles.wordmarkRow}>
              <LetterRise
                text="GBU "
                style={[styles.wordmarkGBU, { color: colors.textPrimary }]}
                stagger={24}
                reduceMotion={effectiveReduce}
              />
              <LetterRise
                text="One"
                style={[styles.wordmarkOne, { color: colors.accent }]}
                stagger={24}
                delay={70}
                reduceMotion={effectiveReduce}
              />
            </View>
          )}
        </View>

        {/* Tagline Typewriter: "Everything GBU. One app." */}
        <View style={styles.taglineContainer}>
          {showTagline && (
            <TypeWriter
              text="Everything GBU. One app."
              speed={32}
              style={[styles.taglineText, { color: colors.textSecondary }]}
              reduceMotion={effectiveReduce}
            />
          )}
        </View>

        {/* Reserved Official Seal Slot */}
        <OfficialSeal />

        {/* Skip hint */}
        <Text style={[styles.skipHint, { color: colors.textTertiary }]}>Tap anywhere to skip</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
  },
  pressableArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  wordmarkContainer: {
    marginTop: 22,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmarkGBU: {
    fontFamily: 'Poppins-Bold',
    fontSize: 32,
    letterSpacing: -0.5,
  },
  wordmarkOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 32,
    letterSpacing: -0.5,
  },
  taglineContainer: {
    marginTop: 10,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taglineText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    letterSpacing: -0.1,
  },
  skipHint: {
    position: 'absolute',
    bottom: 40,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
});

export default SplashScreenView;
