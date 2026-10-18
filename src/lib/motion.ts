import { Easing } from 'react-native-reanimated';

/**
 * GBU One — Motion Tokens
 * Source of truth: docs/ANIMATION_SPEC.md
 */

export const motion = {
  duration: {
    xs: 120,
    sm: 200,
    md: 320,
    lg: 600,
    xl: 1000,
  },
  easing: {
    out: Easing.bezier(0.22, 1, 0.36, 1),
    inOut: Easing.bezier(0.65, 0, 0.35, 1),
    linear: Easing.linear,
  },
  spring: {
    soft: {
      damping: 18,
      stiffness: 180,
      mass: 1,
    },
    snappy: {
      damping: 20,
      stiffness: 320,
      mass: 1,
    },
    bouncy: {
      damping: 12,
      stiffness: 220,
      mass: 0.8,
    },
  },
  stagger: {
    letter: 28,
    word: 70,
    card: 40,
  },
} as const;

export default motion;
