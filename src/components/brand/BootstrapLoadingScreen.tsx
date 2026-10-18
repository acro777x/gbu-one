import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AnimatedLogo } from './AnimatedLogo';
import { WordReveal } from '../motion/WordReveal';
import { theme } from '../../lib/theme';

export interface BootstrapLoadingScreenProps {
  onComplete?: () => void;
  reduceMotion?: boolean;
}

const STATUS_MESSAGES = [
  'Checking notices…',
  'Syncing your timetable…',
  'Finding your PYQs…',
  'Almost there…',
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const BootstrapLoadingScreen: React.FC<BootstrapLoadingScreenProps> = ({
  onComplete,
  reduceMotion = false,
}) => {
  const [statusIndex, setStatusIndex] = useState(0);
  const shimmerProgress = useSharedValue(-SCREEN_WIDTH * 0.6);

  useEffect(() => {
    // Progress line shimmer
    shimmerProgress.value = withRepeat(
      withTiming(SCREEN_WIDTH * 0.6, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );

    // Status text cycle
    const interval = setInterval(() => {
      setStatusIndex((prev) => {
        if (prev < STATUS_MESSAGES.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          onComplete?.();
          return prev;
        }
      });
    }, 1400);

    return () => clearInterval(interval);
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerProgress.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Centre: Logo mark with breathing loop */}
      <View style={styles.logoContainer}>
        <AnimatedLogo size={140} mode="loading" glow reduceMotion={reduceMotion} />
      </View>

      {/* Thin 2px progress line */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressShimmer, shimmerStyle]} />
      </View>

      {/* Status text with WordReveal */}
      <View style={styles.statusContainer}>
        <WordReveal
          key={STATUS_MESSAGES[statusIndex]}
          text={STATUS_MESSAGES[statusIndex]}
          style={styles.statusText}
          duration={300}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  logoContainer: {
    marginBottom: theme.spacing.xxl,
  },
  progressTrack: {
    width: 180,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
  },
  progressShimmer: {
    width: 60,
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 1,
  },
  statusContainer: {
    minHeight: 24,
    alignItems: 'center',
  },
  statusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default BootstrapLoadingScreen;
