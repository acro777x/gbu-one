import React from 'react';
import { StyleSheet, Pressable, ViewStyle, StyleProp, View, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

export interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** A long press opens the card's detail in place instead of the sheet. */
  onLongPress?: () => void;
  delayLongPress?: number;
  delayPressIn?: number;
  accentBorder?: boolean;
  glow?: boolean;
  variant?: 'default' | 'elevated' | 'accent' | 'subtle';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableCardProps extends GlassCardProps {
  onPress: () => void;
  surface: string;
  borderColor: string;
  isDark: boolean;
  colors: any;
}

const PressableGlassCard: React.FC<PressableCardProps> = React.memo(({
  children,
  style,
  contentStyle,
  onPress,
  onLongPress,
  delayLongPress,
  delayPressIn,
  glow = false,
  surface,
  borderColor,
  isDark,
  colors,
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      unstable_pressDelay={delayPressIn ?? 90}
      onPressIn={() => (scale.value = withTiming(0.985, { duration: 100 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 140 }))}
      accessibilityRole="button"
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor,
          shadowColor: isDark ? '#000000' : colors.borderStrong,
        },
        glow && { shadowColor: colors.accent, shadowOpacity: 0.16, shadowRadius: 18, elevation: 5 },
        style,
        animatedStyle,
      ]}
    >
      {glow && (
        <View
          pointerEvents="none"
          style={[styles.ambientGlow, { backgroundColor: colors.accentGlow }]}
        />
      )}
      {contentStyle ? <View style={contentStyle}>{children}</View> : children}
    </AnimatedPressable>
  );
});

export const GlassCard: React.FC<GlassCardProps> = React.memo(({
  children,
  style,
  contentStyle,
  onPress,
  onLongPress,
  delayLongPress,
  delayPressIn,
  accentBorder = false,
  glow = false,
  variant = 'default',
}) => {
  const { colors, isDark } = useAppTheme();

  const surface =
    variant === 'subtle'
      ? colors.surfaceMuted
      : variant === 'elevated'
      ? colors.surfaceRaised
      : colors.surface;

  const borderColor =
    accentBorder || variant === 'accent'
      ? colors.accent
      : colors.borderGlass;

  if (onPress) {
    return (
      <PressableGlassCard
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        delayPressIn={delayPressIn}
        style={style}
        contentStyle={contentStyle}
        accentBorder={accentBorder}
        glow={glow}
        variant={variant}
        surface={surface}
        borderColor={borderColor}
        isDark={isDark}
        colors={colors}
      >
        {children}
      </PressableGlassCard>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor,
          shadowColor: isDark ? '#000000' : colors.borderStrong,
        },
        glow && { shadowColor: colors.accent, shadowOpacity: 0.16, shadowRadius: 18, elevation: 5 },
        style,
      ]}
    >
      {glow && (
        <View
          pointerEvents="none"
          style={[styles.ambientGlow, { backgroundColor: colors.accentGlow }]}
        />
      )}
      {contentStyle ? <View style={contentStyle}>{children}</View> : children}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 0,
      },
    }),
    padding: theme.spacing.lg,
  },
  ambientGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
});

export default GlassCard;
