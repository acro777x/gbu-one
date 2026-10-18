import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { motion } from '../../lib/motion';
import { theme } from '../../lib/theme';

export interface LetterRiseProps {
  text: string;
  delay?: number;
  stagger?: number;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  reduceMotion?: boolean;
  onDone?: () => void;
}

interface AnimatedLetterProps {
  char: string;
  index: number;
  delay: number;
  stagger: number;
  style?: TextStyle;
  reduceMotion: boolean;
  isLast: boolean;
  onDone?: () => void;
}

const AnimatedLetter: React.FC<AnimatedLetterProps> = ({
  char,
  index,
  delay,
  stagger,
  style,
  reduceMotion,
  isLast,
  onDone,
}) => {
  const translateY = useSharedValue(reduceMotion ? 0 : 28);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
      if (isLast && onDone) onDone();
      return;
    }

    const totalDelay = delay + index * stagger;
    opacity.value = withDelay(totalDelay, withTiming(1, { duration: 200 }));
    translateY.value = withDelay(
      totalDelay,
      withSpring(0, motion.spring.snappy, (finished) => {
        if (finished && isLast && onDone) {
          runOnJS(onDone)();
        }
      }),
    );
  }, [delay, index, stagger, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.charContainer}>
      <Animated.Text style={[styles.char, style, animStyle]}>
        {char === ' ' ? '\u00A0' : char}
      </Animated.Text>
    </View>
  );
};

export const LetterRise: React.FC<LetterRiseProps> = ({
  text,
  delay = 0,
  stagger = motion.stagger.letter,
  style,
  containerStyle,
  reduceMotion = false,
  onDone,
}) => {
  const words = (text || '').split(' ');
  let runningIndex = 0;
  const totalLetters = (text || '').replace(/\s+/g, '').length;

  return (
    <View style={[styles.container, containerStyle]} accessible accessibilityLabel={text}>
      {words.map((word, wIdx) => {
        const letters = Array.from(word);
        return (
          <View key={`w-${wIdx}-${word}`} style={styles.wordWrapper}>
            {letters.map((char, lIdx) => {
              const currentIdx = runningIndex++;
              return (
                <AnimatedLetter
                  key={`c-${wIdx}-${lIdx}-${char}`}
                  char={char}
                  index={currentIdx}
                  delay={delay}
                  stagger={stagger}
                  style={style}
                  reduceMotion={reduceMotion}
                  isLast={currentIdx === totalLetters - 1}
                  onDone={onDone}
                />
              );
            })}
            {wIdx < words.length - 1 && <Text style={[styles.char, style]}>{' '}</Text>}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  wordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  charContainer: {
    overflow: 'hidden',
  },
  char: {
    color: theme.colors.textPrimary,
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
  },
});

export default LetterRise;
