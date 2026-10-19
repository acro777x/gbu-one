import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  SharedValue,
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

interface AnimatedCharProps {
  char: string;
  index: number;
  revealedCount: SharedValue<number>;
  style?: StyleProp<TextStyle>;
  reduceMotion: boolean;
}

const AnimatedChar: React.FC<AnimatedCharProps> = ({
  char,
  index,
  revealedCount,
  style,
  reduceMotion,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    if (reduceMotion) {
      return { opacity: 1 };
    }
    return {
      opacity: revealedCount.value >= index + 1 ? 1 : 0,
    };
  });

  return (
    <Animated.Text style={[styles.text, style, animatedStyle]}>
      {char}
    </Animated.Text>
  );
};

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
  const revealedCount = useSharedValue(effectiveReduce ? text.length : 0);

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
  }, [isDone]);

  useEffect(() => {
    if (effectiveReduce) {
      revealedCount.value = text.length;
      handleComplete();
      return;
    }

    revealedCount.value = 0;
    setIsDone(false);

    revealedCount.value = withDelay(
      delay,
      withTiming(
        text.length,
        {
          duration: text.length * speed,
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
      cancelAnimation(revealedCount);
    };
  }, [text, speed, delay, effectiveReduce, handleComplete]);

  const animatedCursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  // Structure characters into words to allow normal line wrapping
  const words = useMemo(() => {
    let globalIndex = 0;
    const splitWords = text.split(' ');
    return splitWords.map((word, wIdx) => {
      const chars = word.split('').map((char) => {
        const item = { char, index: globalIndex };
        globalIndex++;
        return item;
      });

      const hasSpace = wIdx < splitWords.length - 1;
      const spaceIndex = hasSpace ? globalIndex++ : -1;

      return {
        chars,
        hasSpace,
        spaceIndex,
      };
    });
  }, [text]);

  return (
    <View style={styles.container} accessible accessibilityLabel={text}>
      <View style={styles.textRow}>
        {words.map((w, wIdx) => (
          <View key={`w_${wIdx}`} style={styles.wordRow}>
            {w.chars.map((c) => (
              <AnimatedChar
                key={`c_${c.index}`}
                char={c.char}
                index={c.index}
                revealedCount={revealedCount}
                style={style}
                reduceMotion={effectiveReduce}
              />
            ))}
            {w.hasSpace && (
              <AnimatedChar
                char=" "
                index={w.spaceIndex}
                revealedCount={revealedCount}
                style={style}
                reduceMotion={effectiveReduce}
              />
            )}
          </View>
        ))}
        {cursor && !isDone && (
          <Animated.Text style={[styles.cursor, style, animatedCursorStyle]}>
            |
          </Animated.Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordRow: {
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
    marginLeft: 1,
  },
});

export default TypeWriter;
