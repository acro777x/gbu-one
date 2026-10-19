import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleSheet, View, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { theme } from '../../lib/theme';
import { useReduceMotion } from '../../lib/useReduceMotion';

export interface TypeWriterProps {
  text: string;
  speed?: number; // ms per char
  delay?: number;
  cursor?: boolean;
  style?: StyleProp<TextStyle>;
  reduceMotion?: boolean;
  onDone?: () => void;
}

export const TypeWriter: React.FC<TypeWriterProps> = ({
  text,
  speed = 45,
  delay = 0,
  cursor = true,
  style,
  reduceMotion,
  onDone,
}) => {
  const systemReduce = useReduceMotion();
  const effectiveReduce = reduceMotion ?? systemReduce;

  const [displayedText, setDisplayedText] = useState(effectiveReduce ? text : '');
  const [isDone, setIsDone] = useState(effectiveReduce);
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    if (isDone) {
      cancelAnimation(cursorOpacity);
      cursorOpacity.value = withTiming(0, { duration: 600 });
      return;
    }

    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0, { duration: 400 }),
      ),
      -1,
      true,
    );
  }, [isDone]);

  useEffect(() => {
    if (effectiveReduce) {
      setDisplayedText(text);
      setIsDone(true);
      onDone?.();
      return;
    }

    setDisplayedText('');
    setIsDone(false);

    let currentIndex = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startTimeout = setTimeout(() => {
      interval = setInterval(() => {
        if (currentIndex < text.length) {
          currentIndex++;
          setDisplayedText(text.slice(0, currentIndex));
        } else {
          if (interval) clearInterval(interval);
          setIsDone(true);
          onDone?.();
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, delay, effectiveReduce]);

  const animatedCursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <View style={styles.container} accessible accessibilityLabel={text}>
      <Text style={[styles.text, style]}>
        {displayedText}
        {cursor && !isDone && (
          <Animated.Text style={[styles.cursor, style, animatedCursorStyle]}>
            |
          </Animated.Text>
        )}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: theme.colors.textPrimary,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  cursor: {
    color: theme.colors.accent,
    fontFamily: 'Inter-Regular',
  },
});

export default TypeWriter;
