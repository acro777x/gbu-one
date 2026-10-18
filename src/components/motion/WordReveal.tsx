import React, { useEffect } from 'react';
import { View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { motion } from '../../lib/motion';
import { theme } from '../../lib/theme';

export interface WordRevealProps {
  text: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  reduceMotion?: boolean;
  onDone?: () => void;
}

interface AnimatedWordProps {
  word: string;
  index: number;
  delay: number;
  stagger: number;
  duration: number;
  style?: TextStyle;
  reduceMotion: boolean;
  isLast: boolean;
  onDone?: () => void;
}

const AnimatedWord: React.FC<AnimatedWordProps> = ({
  word,
  index,
  delay,
  stagger,
  duration,
  style,
  reduceMotion,
  isLast,
  onDone,
}) => {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 12);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      if (isLast && onDone) onDone();
      return;
    }

    const totalDelay = delay + index * stagger;
    opacity.value = withDelay(totalDelay, withTiming(1, { duration, easing: motion.easing.out }));
    translateY.value = withDelay(
      totalDelay,
      withTiming(0, { duration, easing: motion.easing.out }, (finished) => {
        if (finished && isLast && onDone) {
          runOnJS(onDone)();
        }
      }),
    );
  }, [delay, index, stagger, duration, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.word, style, animStyle]}>
      {word}{' '}
    </Animated.Text>
  );
};

export const WordReveal: React.FC<WordRevealProps> = ({
  text,
  delay = 0,
  stagger = motion.stagger.word,
  duration = motion.duration.md,
  style,
  containerStyle,
  reduceMotion = false,
  onDone,
}) => {
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <View style={[styles.container, containerStyle]} accessible accessibilityLabel={text}>
      {words.map((w, idx) => (
        <AnimatedWord
          key={`${w}-${idx}`}
          word={w}
          index={idx}
          delay={delay}
          stagger={stagger}
          duration={duration}
          style={style}
          reduceMotion={reduceMotion}
          isLast={idx === words.length - 1}
          onDone={onDone}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  word: {
    color: theme.colors.textPrimary,
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
});

export default WordReveal;
