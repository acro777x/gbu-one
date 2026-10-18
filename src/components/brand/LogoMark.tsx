import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { LOGO_PATHS } from './logoPaths';

export interface LogoMarkProps {
  size?: number;
  mono?: boolean;
  monoColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const LogoMark: React.FC<LogoMarkProps> = ({
  size = 64,
  mono = false,
  monoColor = '#F8F8F6',
  style,
}) => {
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
        fill={mono ? monoColor : 'url(#gbuRingGrad)'}
      />

      {/* Ring Ribbon B */}
      <Path
        d={LOGO_PATHS.ribbonB.d}
        fill={mono ? monoColor : 'url(#gbuRingGrad)'}
      />

      {/* Dome & Finial */}
      <Path
        d={LOGO_PATHS.domeFinial.d}
        fill={mono ? monoColor : LOGO_PATHS.colors.dome}
      />

      {/* Numeral 1 */}
      <Path
        d={LOGO_PATHS.numeralOne.d}
        fill={mono ? '#0B0B0C' : LOGO_PATHS.colors.numeral}
      />
    </Svg>
  );
};

export default LogoMark;
