import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleSheet, View } from 'react-native';
import { theme } from '../../lib/theme';

export interface CountUpProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  style?: TextStyle;
  reduceMotion?: boolean;
  onDone?: () => void;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 1000,
  suffix = '',
  prefix = '',
  decimals = 0,
  style,
  reduceMotion = false,
  onDone,
}) => {
  const [current, setCurrent] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setCurrent(value);
      onDone?.();
      return;
    }

    const start = 0;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = start + (value - start) * eased;
      setCurrent(nextVal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCurrent(value);
        onDone?.();
      }
    };

    const handle = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(handle);
  }, [value, duration, reduceMotion]);

  const formatted = `${prefix}${current.toFixed(decimals)}${suffix}`;

  return (
    <View accessible accessibilityLabel={`${prefix}${value.toFixed(decimals)}${suffix}`}>
      <Text style={[styles.text, style]}>{formatted}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  text: {
    color: theme.colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
});

export default CountUp;
