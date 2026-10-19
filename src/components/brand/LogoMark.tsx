/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
import { StyleProp, ViewStyle, Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { LOGO_PATHS } from './logoPaths';
import { useAppTheme } from '../../lib/ThemeContext';

export interface LogoMarkProps {
  size?: number;
  mono?: boolean;
  monoColor?: string;
  numeralColor?: string;
  variant?: 'mark' | 'tile' | 'vector';
  style?: StyleProp<ViewStyle>;
}

// Pre-resolved image assets for instantaneous offline rendering
const MARK_IMAGE = require('../../../assets/brand/mark-square.png');
const TILE_DARK_IMAGE = require('../../../assets/brand/logo-tile-dark.png');
const TILE_LIGHT_IMAGE = require('../../../assets/brand/logo-tile-light.png');

export const LogoMark: React.FC<LogoMarkProps> = ({
  size = 64,
  mono = false,
  monoColor,
  numeralColor,
  variant = 'mark',
  style,
}) => {
  const { colors, isDark } = useAppTheme();
  const effectiveMonoColor = monoColor || colors.logoNumeralFill;
  const effectiveNumeralColor = numeralColor || colors.logoNumeralFill;

  // Use authentic vector asset when monochrome is explicitly requested (e.g. status/tray/themed icon)
  if (mono || variant === 'vector') {
    return (
      <Svg
        viewBox={LOGO_PATHS.viewBox}
        width={size}
        height={size}
        style={style}
        fill="none"
      >
        <Defs>
          <LinearGradient id="gbuRingGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={LOGO_PATHS.colors.ringGradStart} />
            <Stop offset="50%" stopColor={LOGO_PATHS.colors.ringGradMid} />
            <Stop offset="100%" stopColor={LOGO_PATHS.colors.ringGradEnd} />
          </LinearGradient>
        </Defs>

        {/* Ring Ribbon A */}
        <Path
          d={LOGO_PATHS.ribbonA.d}
          fill={mono ? effectiveMonoColor : 'url(#gbuRingGrad)'}
        />

        {/* Ring Ribbon B */}
        <Path
          d={LOGO_PATHS.ribbonB.d}
          fill={mono ? effectiveMonoColor : 'url(#gbuRingGrad)'}
        />

        {/* Dome & Finial */}
        <Path
          d={LOGO_PATHS.domeFinial.d}
          fill={mono ? effectiveMonoColor : LOGO_PATHS.colors.dome}
        />

        {/* Numeral 1 */}
        <Path
          d={LOGO_PATHS.numeralOne.d}
          fill={mono ? (monoColor || '#0B0B0C') : effectiveNumeralColor}
        />
      </Svg>
    );
  }

  // Authentic tile format with the user's exact lighting, frame, and glow
  if (variant === 'tile') {
    const tileSource = isDark ? TILE_DARK_IMAGE : TILE_LIGHT_IMAGE;
    return (
      <View style={[{ width: size, height: size }, styles.center, style]}>
        <Image
          source={tileSource}
          style={{ width: size, height: size, borderRadius: size * 0.22 }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    );
  }

  // Authentic mark (transparent background with user's genuine glossy ring, dome and numeral)
  return (
    <View style={[{ width: size, height: size }, styles.center, style]}>
      <Image
        source={MARK_IMAGE}
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
