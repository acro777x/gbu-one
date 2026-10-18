import React, { useEffect } from 'react';
import { View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../lib/theme';

export interface ShimmerTextProps {
  text: string;
  duration?: number;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  reduceMotion?: boolean;
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  text,
  duration = 1800,
  style,
  containerStyle,
  reduceMotion = false,
}) => {
  const translateX = useSharedValue(-120);

  useEffect(() => {
    if (reduceMotion) {
      translateX.value = 0;
      return;
    }

    translateX.value = withRepeat(
      withTiming(160, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [duration, reduceMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.container, containerStyle]} accessible accessibilityLabel={text}>
      <Animated.Text style={[styles.baseText, style]}>
        {text}
      </Animated.Text>
      {!reduceMotion && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  baseText: {
    color: theme.colors.accent,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  shimmerOverlay: {
    width: 60,
    height: '100%',
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});

export default ShimmerText;
