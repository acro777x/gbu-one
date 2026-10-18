import React from 'react';
import { StyleSheet, Pressable, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../../lib/theme';

export interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accentBorder?: boolean;
  glow?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  onPress,
  accentBorder = false,
  glow = false,
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

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      style={[
        styles.card,
        accentBorder && styles.cardAccentBorder,
        glow && styles.cardGlow,
        style,
        animatedStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(22, 22, 24, 0.85)',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },
  cardAccentBorder: {
    borderColor: theme.colors.accent,
  },
  cardGlow: {
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
});

export default GlassCard;
