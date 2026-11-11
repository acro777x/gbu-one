import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { PillButton } from './PillButton';
import { useAppTheme } from '../../lib/ThemeContext';
import { useReduceMotion } from '../../lib/useReduceMotion';
import { theme } from '../../lib/theme';

/**
 * The headline is clamped to this many lines. The slide is a fixed 250pt
 * tall, so an unclamped title pushes the "View details" button out of view.
 */
const HERO_TITLE_MAX_LINES = 2;

/**
 * ...and to this many characters, so the animation never has to build more
 * than a bounded number of glyphs. The clamp is applied BEFORE the title is
 * animated, so the animated text and the plain text are always the same
 * string.
 */
const HERO_TITLE_MAX_CHARS = 140;

/** Clamps a headline to the number of characters the slide can show. */
export function clampHeroTitle(title: string): string {
  const trimmed = (title ?? '').trim();
  if (trimmed.length <= HERO_TITLE_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, HERO_TITLE_MAX_CHARS - 1).trimEnd()}…`;
}

const HeroTitleRise: React.FC<{
  text: string;
  style: any;
  isCurrent: boolean;
  reduceMotion: boolean;
  numberOfLines: number;
}> = React.memo(({ text, style, isCurrent, reduceMotion, numberOfLines }) => {
  const opacity = useSharedValue(isCurrent ? 0.3 : 1);
  const translateY = useSharedValue(isCurrent ? 6 : 0);

  useEffect(() => {
    if (!isCurrent) return;
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    opacity.value = 0.3;
    translateY.value = 6;
    opacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) });
  }, [isCurrent, text, reduceMotion, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[style, animStyle]} numberOfLines={numberOfLines}>
      {text}
    </Animated.Text>
  );
});

export interface HeroSlideItem {
  id: string;
  category: string;
  title: string;
  meta: string;
  badge?: string;
  onPress: () => void;
}

export interface HeroCarouselProps {
  slides: HeroSlideItem[];
  autoAdvanceInterval?: number;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  slides,
  autoAdvanceInterval = 6000,
}) => {
  const { colors, isDark } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const flatListRef = useRef<FlatList>(null);
  const isInteracting = useRef(false);

  /**
   * `useIsFocused` lives in `@react-navigation/native`, which is not a
   * direct dependency of this app (it only arrives transitively through
   * expo-router), so importing it would break the build the day the
   * dependency tree is re-resolved. expo-router's own `useFocusEffect` is
   * the supported way to know whether the screen is on top.
   */
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // When the notices shrink, the active slide has to move back into range,
  // otherwise no dot is active and no slide shows its animated title.
  useEffect(() => {
    const last = Math.max(0, slides.length - 1);
    if (activeIndexRef.current > last) {
      activeIndexRef.current = last;
      setActiveIndex(last);
    }
  }, [slides.length]);

  useEffect(() => {
    if (!isFocused || slides.length <= 1 || reduceMotion) return;

    const timer = setInterval(() => {
      if (isInteracting.current) return;
      // The next index is computed OUTSIDE the state updater: React may
      // re-invoke an updater, and scrolling from inside one made the
      // carousel jitter.
      const next = (activeIndexRef.current + 1) % slides.length;
      activeIndexRef.current = next;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }, autoAdvanceInterval);

    return () => clearInterval(timer);
  }, [isFocused, slides.length, autoAdvanceInterval, reduceMotion]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const newIdx = Math.max(0, Math.min(slides.length - 1, Math.round(x / screenWidth)));
      activeIndexRef.current = newIdx;
      setActiveIndex(newIdx);
      isInteracting.current = false;
    },
    [screenWidth, slides.length],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: HeroSlideItem; index: number }) => {
      const isCurrent = index === activeIndex;
      // The clamp is applied once, so the animated title and the plain
      // title are always the same string.
      const title = clampHeroTitle(item.title);

      return (
        <View style={[styles.slide, { width: screenWidth }]}>
          {/* Subtle background glow & gradient */}
          <LinearGradient
            colors={
              isDark
                ? [colors.accentWarmBrown, colors.surface, colors.bg]
                : [colors.accentWarmCream, colors.surface, colors.bg]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.slideContent}>
            {/* Meta / Category pill */}
            <View style={styles.metaRow}>
              <View style={[styles.categoryPill, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.categoryText, { color: colors.accent }]}>
                  {item.category}
                </Text>
              </View>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {item.meta}
              </Text>
            </View>

            {/* Main Headline */}
            <View style={styles.titleContainer} accessible accessibilityLabel={item.title}>
              {isCurrent ? (
                <HeroTitleRise
                  text={title}
                  style={[styles.heroTitle, { color: colors.textPrimary }]}
                  isCurrent
                  reduceMotion={reduceMotion}
                  numberOfLines={HERO_TITLE_MAX_LINES}
                />
              ) : (
                <Text
                  style={[styles.heroTitle, { color: colors.textPrimary }]}
                  numberOfLines={HERO_TITLE_MAX_LINES}
                >
                  {title}
                </Text>
              )}
            </View>

            {/* Action button */}
            <View style={styles.actionRow}>
              <PillButton
                label="View details"
                variant="primary"
                size="sm"
                onPress={item.onPress}
              />
            </View>
          </View>
        </View>
      );
    },
    [activeIndex, colors, isDark, reduceMotion, screenWidth],
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialNumToRender={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          }, 100);
        }}
        removeClippedSubviews={Platform.OS === 'android'}
        onTouchStart={() => {
          isInteracting.current = true;
        }}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={renderItem}
        extraData={activeIndex}
      />

      {/* Pill-style dot indicator (elongated active dot: 8 -> 28px) */}
      {slides.length > 1 && (
        <View style={styles.indicatorContainer}>
          {slides.map((_, i) => {
            const isActive = i === activeIndex;
            return (
              <View
                key={`dot-${i}`}
                style={[
                  styles.dot,
                  isActive
                    ? [styles.dotActive, { backgroundColor: colors.accent }]
                    : [
                        styles.dotInactive,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.25)'
                            : 'rgba(17, 24, 39, 0.25)',
                        },
                      ],
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 250,
    position: 'relative',
    overflow: 'hidden',
  },
  slide: {
    height: 250,
    justifyContent: 'flex-end',
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  slideContent: {
    zIndex: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginRight: 8,
  },
  categoryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  metaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  titleContainer: {
    minHeight: 56,
    marginBottom: theme.spacing.md,
  },
  heroTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 12,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    height: 5,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  dotInactive: {
    width: 6,
  },
  dotActive: {
    width: 24,
  },
});

export default HeroCarousel;
