/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
import { StyleProp, ViewStyle, Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../lib/ThemeContext';

export interface LogoMarkProps {
  size?: number;
  mono?: boolean;
  monoColor?: string;
  numeralColor?: string;
  variant?: 'mark' | 'tile' | 'vector' | 'dark' | 'light' | 'transparent';
  style?: StyleProp<ViewStyle>;
}

// Pre-resolved image assets for instantaneous offline rendering
const MARK_LIGHT_IMAGE = require('../../../assets/brand/mark-light.png');
const MARK_DARK_IMAGE = require('../../../assets/brand/mark-dark.png');
const TILE_DARK_IMAGE = require('../../../assets/brand/logo-tile-dark.png');

export const LogoMark: React.FC<LogoMarkProps> = ({
  size = 64,
  mono = false,
  monoColor,
  numeralColor: _numeralColor,
  variant = 'mark',
  style,
}) => {
  const { colors, isDark } = useAppTheme();
  const effectiveMonoColor = monoColor || colors.logoNumeralFill;

  // Monochrome tint mode (for system status, tray, or monochrome badges)
  if (mono) {
    return (
      <View style={[{ width: size, height: size }, styles.center, style]}>
        <Image
          source={MARK_LIGHT_IMAGE}
          style={{ width: size, height: size, tintColor: effectiveMonoColor }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    );
  }

  // Dark tile format with dark frame and glow (only for explicit 'tile' variant)
  if (variant === 'tile') {
    const tileSource = isDark ? TILE_DARK_IMAGE : MARK_LIGHT_IMAGE;
    return (
      <View style={[{ width: size, height: size }, styles.center, style]}>
        <Image
          source={tileSource}
          style={{ width: size, height: size, borderRadius: isDark ? size * 0.22 : 0 }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    );
  }

  // Authentic mark: in light mode, NEVER show the black circle! Use MARK_LIGHT_IMAGE (pure orange ribbon on transparent)
  const effectiveMarkSource =
    variant === 'dark'
      ? MARK_DARK_IMAGE
      : variant === 'light'
        ? MARK_LIGHT_IMAGE
        : isDark
          ? MARK_DARK_IMAGE
          : MARK_LIGHT_IMAGE;

  return (
    <View style={[{ width: size, height: size }, styles.center, style]}>
      <Image
        source={effectiveMarkSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LogoMark;
