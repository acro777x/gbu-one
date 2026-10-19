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
import { theme } from '../../lib/theme';

export interface SplashScreenViewProps {
  isWarmStart?: boolean;
  reduceMotion?: boolean;
  onFinish: () => void;
}

export const SplashScreenView: React.FC<SplashScreenViewProps> = ({
  isWarmStart = false,
  reduceMotion = false,
  onFinish,
}) => {
  const [showWordmark, setShowWordmark] = useState(isWarmStart || reduceMotion);
  const [showTagline, setShowTagline] = useState(isWarmStart || reduceMotion);
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
    }, 300);
  };

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(finishHandoff, 400);
      return () => clearTimeout(timer);
    }

    if (isWarmStart) {
      const timer = setTimeout(finishHandoff, 700);
      return () => clearTimeout(timer);
    }

    // Cold start timings:
    // 1000ms: Wordmark starts
    const wordmarkTimer = setTimeout(() => {
      setShowWordmark(true);
    }, 1000);

    // 1500ms: Tagline typewriter starts
    const taglineTimer = setTimeout(() => {
      setShowTagline(true);
    }, 1500);

    // 2200ms: Handoff fades out and navigates
    const handoffTimer = setTimeout(() => {
      finishHandoff();
    }, 2250);

    return () => {
      clearTimeout(wordmarkTimer);
      clearTimeout(taglineTimer);
      clearTimeout(handoffTimer);
    };
  }, [isWarmStart, reduceMotion]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const handleTapToSkip = () => {
    finishHandoff();
  };

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <Pressable style={styles.pressableArea} onPress={handleTapToSkip}>
        {/* Animated Brand Mark */}
        <AnimatedLogo
          size={140}
          mode={isWarmStart ? 'static' : 'intro'}
          glow
          reduceMotion={reduceMotion}
        />

        {/* Live Wordmark: Poppins Bold "GBU" ivory + "One" orange */}
        <View style={styles.wordmarkContainer}>
          {showWordmark && (
            <View style={styles.wordmarkRow}>
              <LetterRise
                text="GBU "
                style={styles.wordmarkGBU}
                stagger={28}
                reduceMotion={reduceMotion}
              />
              <LetterRise
                text="One"
                style={styles.wordmarkOne}
                stagger={28}
                delay={90}
                reduceMotion={reduceMotion}
              />
            </View>
          )}
        </View>

        {/* Tagline Typewriter: "Everything GBU. One app." */}
        <View style={styles.taglineContainer}>
          {showTagline && (
            <TypeWriter
              text="Everything GBU. One app."
              speed={35}
              style={styles.taglineText}
              reduceMotion={reduceMotion}
            />
          )}
        </View>

        {/* Reserved Official Seal Slot */}
        <OfficialSeal />

        {/* Skip hint */}
        <Text style={styles.skipHint}>Tap anywhere to skip</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg,
    zIndex: 99999,
  },
  pressableArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  wordmarkContainer: {
    marginTop: theme.spacing.lg,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmarkGBU: {
    fontFamily: 'Poppins-Bold',
    fontSize: 32,
    color: theme.colors.ivory,
    letterSpacing: -0.5,
  },
  wordmarkOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 32,
    color: theme.colors.accent,
    letterSpacing: -0.5,
  },
  taglineContainer: {
    marginTop: theme.spacing.xs,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
  },
  skipHint: {
    position: 'absolute',
    bottom: 40,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
});

export default SplashScreenView;
