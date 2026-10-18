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

  const getContainerVariantStyle = () => {
    switch (variant) {
      case 'white':
        return styles.btnWhite;
      case 'dark':
        return styles.btnDark;
      case 'outline':
        return styles.btnOutline;
      case 'primary':
      default:
        return styles.btnPrimary;
    }
  };

  const getTextVariantStyle = () => {
    switch (variant) {
      case 'white':
        return styles.textWhite;
      case 'dark':
        return styles.textDark;
      case 'outline':
        return styles.textOutline;
      case 'primary':
      default:
        return styles.textPrimary;
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
        getContainerVariantStyle(),
        (disabled || loading) && styles.disabled,
        style,
        animStyle,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'white' ? theme.colors.bg : theme.colors.ivory}
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, getTextVariantStyle(), textStyle]}>
            {label}
          </Text>
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
    minHeight: 38,
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
  btnPrimary: {
    backgroundColor: theme.colors.accent,
  },
  btnWhite: {
    backgroundColor: '#FFFFFF',
  },
  btnDark: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderGlass,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  text: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  textPrimary: {
    color: theme.colors.ivory,
  },
  textWhite: {
    color: '#0B0B0C',
  },
  textDark: {
    color: theme.colors.textPrimary,
  },
  textOutline: {
    color: theme.colors.accent,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default PillButton;
