import React, { useEffect, useState, useCallback } from 'react';
import { TextStyle, StyleSheet, View, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../lib/theme';
import { useReduceMotion } from '../../lib/useReduceMotion';

export interface TypeWriterProps {
  text: string;
  speed?: number; // ms per char
  delay?: number;
  cursor?: boolean;
  style?: StyleProp<TextStyle>;
  /**
   * Forces the motion off (or on). Left out, the OS "reduce motion" setting
   * decides - the prop always wins, the OS setting is the default.
   */
  reduceMotion?: boolean;
  onDone?: () => void;
}

/**
 * GBU One - the typewriter.
 *
 * The whole string is ONE text node. It used to be one node per character
 * inside a wrapping row, which meant the line broke in the middle of a word
 * as soon as the characters were laid out, and that the reveal could not
 * follow the text the reader actually sees. One node keeps the line breaking
 * the reader's business and lets the reveal move as a single block.
 */
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

  const [isDone, setIsDone] = useState(effectiveReduce);
  const cursorOpacity = useSharedValue(1);
  const reveal = useSharedValue(effectiveReduce ? 1 : 0);

  const handleComplete = useCallback(() => {
    setIsDone(true);
    onDone?.();
  }, [onDone]);

  useEffect(() => {
    if (isDone) {
      cancelAnimation(cursorOpacity);
      cursorOpacity.value = withTiming(0, { duration: 400 });
      return;
    }

    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 350 }),
        withTiming(0, { duration: 350 }),
      ),
      -1,
      true,
    );
  }, [isDone, cursorOpacity]);

  useEffect(() => {
    if (effectiveReduce) {
      reveal.value = 1;
      setIsDone(true);
      handleComplete();
      return;
    }

    reveal.value = 0;
    setIsDone(false);

    reveal.value = withDelay(
      delay,
      withTiming(
        1,
        {
          duration: Math.max(1, text.length * speed),
          easing: Easing.linear,
        },
        (finished) => {
          if (finished) {
            runOnJS(handleComplete)();
          }
        },
      ),
    );

    return () => {
      cancelAnimation(reveal);
    };
  }, [text, speed, delay, effectiveReduce, handleComplete, reveal]);

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 6 }],
  }));

  const animatedCursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  return (
    <View style={styles.container} accessible accessibilityLabel={text}>
      <Animated.Text style={[styles.text, style, animatedTextStyle]}>
        {text}
        {cursor && !isDone ? (
          <Animated.Text style={[styles.cursor, animatedCursorStyle]}>|</Animated.Text>
        ) : null}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: theme.colors.textPrimary,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  cursor: {
    color: theme.colors.accent,
    fontFamily: 'Inter-Regular',
    marginLeft: 1,
  },
});

export default TypeWriter;
