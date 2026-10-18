import React from 'react';
import { StyleSheet, Pressable, ViewStyle, StyleProp, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../lib/theme';

export interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accentBorder?: boolean;
  glow?: boolean;
  variant?: 'default' | 'elevated' | 'accent' | 'subtle';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  contentStyle,
  onPress,
  accentBorder = false,
  glow = false,
  variant = 'default',
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withTiming(0.98, { duration: 120 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withTiming(1, { duration: 120 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Determine gradient colors based on variant & state
  const gradientColors: [string, string, ...string[]] = accentBorder || variant === 'accent'
    ? ['rgba(255, 106, 43, 0.16)', 'rgba(22, 22, 24, 0.90)', 'rgba(255, 106, 43, 0.04)']
    : variant === 'elevated'
    ? ['rgba(255, 255, 255, 0.12)', 'rgba(26, 26, 29, 0.88)', 'rgba(18, 18, 20, 0.96)']
    : variant === 'subtle'
    ? ['rgba(255, 255, 255, 0.05)', 'rgba(18, 18, 20, 0.70)']
    : ['rgba(255, 255, 255, 0.09)', 'rgba(22, 22, 24, 0.86)', 'rgba(15, 15, 17, 0.92)'];

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      style={[
        styles.cardOuter,
        accentBorder && styles.cardAccentBorder,
        glow && styles.cardGlow,
        style,
        animatedStyle,
      ]}
    >
      {/* Ambient background glow if requested */}
      {glow && <View style={styles.ambientGlow} />}

      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.gradientContent, contentStyle]}
      >
        {/* Subtle glass top highlight rim */}
        <View style={styles.topRimHighlight} pointerEvents="none" />
        {children}
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(20, 20, 23, 0.82)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  gradientContent: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.card,
    position: 'relative',
  },
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  ambientGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 106, 43, 0.16)',
  },
  cardAccentBorder: {
    borderColor: 'rgba(255, 106, 43, 0.65)',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  cardGlow: {
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 8,
  },
});

export default GlassCard;
