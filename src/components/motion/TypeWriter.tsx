import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../../lib/theme';

export interface TypeWriterProps {
  text: string;
  speed?: number; // ms per char
  delay?: number;
  cursor?: boolean;
  style?: TextStyle;
  reduceMotion?: boolean;
  onDone?: () => void;
}

export const TypeWriter: React.FC<TypeWriterProps> = ({
  text,
  speed = 45,
  delay = 0,
  cursor = true,
  style,
  reduceMotion = false,
  onDone,
}) => {
  const [displayedText, setDisplayedText] = useState(reduceMotion ? text : '');
  const [isDone, setIsDone] = useState(reduceMotion);
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0, { duration: 400 }),
      ),
      -1,
      true,
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayedText(text);
      setIsDone(true);
      onDone?.();
      return;
    }

    setDisplayedText('');
    setIsDone(false);

    let currentIndex = 0;
    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          currentIndex++;
          setDisplayedText(text.slice(0, currentIndex));
        } else {
          clearInterval(interval);
          setIsDone(true);
          onDone?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, delay, reduceMotion]);

  const animatedCursorStyle = useAnimatedStyle(() => ({
    opacity: isDone ? withTiming(0, { duration: 800 }) : cursorOpacity.value,
  }));

  return (
    <View style={styles.container} accessible accessibilityLabel={text}>
      <Text style={[styles.text, style]}>
        {displayedText}
        {cursor && (
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
    fontSize: 15,
  },
  cursor: {
    color: theme.colors.accent,
    fontWeight: 'bold',
  },
});

export default TypeWriter;
