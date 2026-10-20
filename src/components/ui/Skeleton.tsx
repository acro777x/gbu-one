import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../lib/ThemeContext';
import { useReduceMotion } from '../../lib/useReduceMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const { colors, isDark } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const translateX = useSharedValue(-200);

  useEffect(() => {
    if (reduceMotion) return;
    translateX.value = withRepeat(
      withTiming(400, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

      const shimmerColors = isDark
        ? (['transparent', 'rgba(255, 255, 255, 0.12)', 'transparent'] as const)
        : (['transparent', 'rgba(0, 0, 0, 0.08)', 'transparent'] as const);


  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.skeletonBg,
        },
        style,
      ]}
    >
      {!reduceMotion && (
        <Animated.View style={[styles.shimmer, animatedStyle]}>
          <LinearGradient
            colors={shimmerColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default Skeleton;
