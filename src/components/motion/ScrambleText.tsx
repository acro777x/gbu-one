import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleSheet, View } from 'react-native';
import { theme } from '../../lib/theme';

export interface ScrambleTextProps {
  text: string;
  duration?: number;
  delay?: number;
  style?: TextStyle;
  reduceMotion?: boolean;
  onDone?: () => void;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';

export const ScrambleText: React.FC<ScrambleTextProps> = ({
  text,
  duration = 800,
  delay = 0,
  style,
  reduceMotion = false,
  onDone,
}) => {
  const [output, setOutput] = useState(reduceMotion ? text : '');

  useEffect(() => {
    if (reduceMotion) {
      setOutput(text);
      onDone?.();
      return;
    }

    let intervalId: any;
    const timeoutId = setTimeout(() => {
      const length = text.length;
      let frame = 0;
      const totalFrames = Math.max(1, Math.floor(duration / 35));

      intervalId = setInterval(() => {
        frame++;
        const progress = frame / totalFrames;
        const revealedChars = Math.floor(progress * length);

        let scrambled = '';
        for (let i = 0; i < length; i++) {
          if (text[i] === ' ') {
            scrambled += ' ';
          } else if (i < revealedChars) {
            scrambled += text[i];
          } else {
            scrambled += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
        }

        setOutput(scrambled);

        if (frame >= totalFrames) {
          clearInterval(intervalId);
          setOutput(text);
          onDone?.();
        }
      }, 35);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, duration, delay, reduceMotion]);

  return (
    <View accessible accessibilityLabel={text}>
      <Text style={[styles.text, style]}>{output}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  text: {
    color: theme.colors.textPrimary,
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
  },
});

export default ScrambleText;
