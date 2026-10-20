import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

export interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'white' | 'dark' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PillButton: React.FC<PillButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const { colors } = useAppTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withTiming(0.96, { duration: 100 });
    }
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  /** The background of the button for the current variant and palette. */
  const containerStyle = (): ViewStyle => {
    switch (variant) {
      case 'white':
        return { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong };
      case 'dark':
        return { backgroundColor: colors.textPrimary };
      case 'outline':
        return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent };
      case 'primary':
      default:
        return { backgroundColor: colors.accentFill };
    }
  };

  /** The label colour, chosen for contrast against the background above. */
  const labelColor = (): string => {
    switch (variant) {
      case 'white':
        return colors.textPrimary;
      case 'dark':
        return colors.bg;
      case 'outline':
        return colors.accent;
      case 'primary':
      default:
        return colors.onAccent;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      case 'md':
      default:
        return styles.sizeMd;
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.button,
        getSizeStyle(),
        containerStyle(),
        (disabled || loading) && styles.disabled,
        style,
        animStyle,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor()} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: labelColor() }, textStyle]}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    minHeight: 48,
    minWidth: 44,
  },
  sizeSm: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    minHeight: 44,
  },
  sizeMd: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 12,
    minHeight: 48,
  },
  sizeLg: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 16,
    minHeight: 56,
  },
  text: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PillButton;
