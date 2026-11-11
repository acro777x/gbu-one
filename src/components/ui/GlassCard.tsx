import React from 'react';
import { StyleSheet, Pressable, ViewStyle, StyleProp, View, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';
import { useReduceMotion } from '../../lib/useReduceMotion';

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
  /**
   * What a screen reader announces for the card. Without it the card is
   * announced as a bare "button" followed by a pile of disconnected text.
   */
  accessibilityLabel?: string;
  /** A short hint about what happens on activation. */
  accessibilityHint?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The default label for a pressable card: the plain text it contains.
 *
 * Cards built out of views (an icon plus a couple of labels) have no plain
 * text to offer, so the card is left accessible as a single group and the
 * screen reader reads its content in order.
 */
function deriveLabel(children: React.ReactNode): string | undefined {
  const text = React.Children.toArray(children)
    .filter((child) => typeof child === 'string' || typeof child === 'number')
    .map((child) => String(child))
    .join(' ')
    .trim();
  return text.length > 0 ? text : undefined;
}

interface PressableCardProps extends GlassCardProps {
  onPress: () => void;
  surface: string;
  borderColor: string;
  isDark: boolean;
  colors: any;
}

/**
 * NOTE ON MEMOISATION
 *
 * This component used to be wrapped in `React.memo`, but every caller
 * builds its children inline, so `children` is a brand new element on every
 * render and the shallow compare could never succeed: the memo cost a
 * comparison and saved nothing. Worse, comparing `children` by identity
 * would have to be dropped to make the memo useful, and then a card whose
 * text changed would keep showing the old text.
 *
 * The memo is therefore gone on purpose. The card re-renders with its
 * parent, which is what happened before anyway.
 */
const PressableGlassCard: React.FC<PressableCardProps> = ({
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
  accessibilityLabel,
  accessibilityHint,
}) => {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const label = accessibilityLabel ?? deriveLabel(children);

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      unstable_pressDelay={delayPressIn ?? 90}
      onPressIn={() => {
        if (reduceMotion) return;
        scale.value = withTiming(0.985, { duration: 100 });
      }}
      onPressOut={() => {
        if (reduceMotion) return;
        scale.value = withTiming(1, { duration: 140 });
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[
        styles.card,
        // The ambient glow lives outside the card, so the card must not clip
        // its children when the glow is on.
        !glow && styles.cardClip,
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
};

export const GlassCard: React.FC<GlassCardProps> = ({
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
  accessibilityLabel,
  accessibilityHint,
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
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {children}
      </PressableGlassCard>
    );
  }

  return (
    <View
      style={[
        styles.card,
        !glow && styles.cardClip,
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
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
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
  /**
   * The rounded corners clip the card's content. The glow variant opts out,
   * because its ambient circle is drawn outside the card.
   */
  cardClip: {
    overflow: 'hidden',
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
