import React from 'react';
import { StyleSheet, Pressable, ViewStyle, StyleProp, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
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
  children, style, contentStyle, onPress, accentBorder = false, glow = false, variant = 'default',
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const surface = variant === 'subtle' ? theme.colors.surfaceMuted : theme.colors.surface;
  const borderColor = accentBorder || variant === 'accent' ? `${theme.colors.accent}88` : theme.colors.borderGlass;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => onPress && (scale.value = withTiming(0.985, { duration: 120 }))}
      onPressOut={() => onPress && (scale.value = withTiming(1, { duration: 160 }))}
      disabled={!onPress}
      style={[styles.card, { backgroundColor: surface, borderColor }, glow && styles.glow, style, animatedStyle]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {glow && <View pointerEvents="none" style={styles.ambientGlow} />}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#344054',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  content: { padding: theme.spacing.lg, position: 'relative' },
  glow: { shadowColor: theme.colors.accent, shadowOpacity: 0.16, shadowRadius: 18, elevation: 5 },
  ambientGlow: {
    position: 'absolute', top: -30, right: -30, width: 130, height: 130,
    borderRadius: 65, backgroundColor: theme.colors.accentGlow,
  },
});

export default GlassCard;
