import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
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
  const { colors, isDark } = useAppTheme();
  const systemReduce = useReduceMotion();
  const effectiveReduce = reduceMotion ?? systemReduce;

  const [showWordmark, setShowWordmark] = useState(isWarmStart);
  const [showTagline, setShowTagline] = useState(isWarmStart);
  const containerOpacity = useSharedValue(1);
  const hasFinishedRef = useRef(false);

  const triggerFinish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    onFinish();
  };

  const finishHandoff = () => {
    if (hasFinishedRef.current) return;
    containerOpacity.value = withTiming(0, { duration: 280 }, (finished) => {
      if (finished) {
        runOnJS(triggerFinish)();
      }
    });
    setTimeout(() => {
      triggerFinish();
    }, 320);
  };

  useEffect(() => {
    if (isWarmStart) {
      const timer = setTimeout(finishHandoff, 700);
      return () => clearTimeout(timer);
    }

    // Cold start timings:
    // 150ms: Wordmark starts rising
    const wordmarkTimer = setTimeout(() => {
      setShowWordmark(true);
    }, 150);

    // 350ms: Tagline typewriter starts
    const taglineTimer = setTimeout(() => {
      setShowTagline(true);
    }, 350);

    // 1250ms: Streamlined, punchy splash sequence
    const handoffTimer = setTimeout(() => {
      finishHandoff();
    }, 1250);

    return () => {
      clearTimeout(wordmarkTimer);
      clearTimeout(taglineTimer);
      clearTimeout(handoffTimer);
    };
  }, [isWarmStart]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const handleTapToSkip = () => {
    finishHandoff();
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.bg }, animatedContainerStyle]}>
      {/* Dedicated Skip Pill in Top-Right Corner */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[
            styles.skipPill,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.surfaceMuted,
              borderColor: colors.borderGlass,
            },
          ]}
          onPress={finishHandoff}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          accessibilityLabel="Skip intro animation"
        >
          <Text style={[styles.skipPillText, { color: colors.textPrimary }]}>Skip →</Text>
        </TouchableOpacity>
      </View>

      <Pressable style={styles.pressableArea} onPress={handleTapToSkip}>
        {/* Animated Brand Mark: clean orange mark on light mode, dark mark on dark mode */}
        <AnimatedLogo
          size={144}
          mode={isWarmStart ? 'static' : 'intro'}
          glow
          variant={isDark ? 'dark' : 'light'}
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
              speed={24}
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
  topBar: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 100000,
  },
  skipPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
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
