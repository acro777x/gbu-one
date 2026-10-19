import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { PillButton } from './PillButton';
import { LetterRise } from '../motion/LetterRise';
import { useAppTheme } from '../../lib/ThemeContext';
import { theme } from '../../lib/theme';

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
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const isInteracting = useRef(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused || slides.length <= 1) return;

    const timer = setInterval(() => {
      if (!isInteracting.current) {
        setActiveIndex((prev) => {
          const next = (prev + 1) % slides.length;
          flatListRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }
    }, autoAdvanceInterval);

    return () => clearInterval(timer);
  }, [isFocused, slides.length, autoAdvanceInterval]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(x / screenWidth);
    setActiveIndex(newIdx);
    isInteracting.current = false;
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onTouchStart={() => {
          isInteracting.current = true;
        }}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => {
          const isCurrent = index === activeIndex;

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
                <View style={styles.titleContainer}>
                  {isCurrent ? (
                    <LetterRise
                      key={`hero-title-${item.id}-${activeIndex}`}
                      text={item.title}
                      style={[styles.heroTitle, { color: colors.textPrimary }]}
                      stagger={16}
                    />
                  ) : (
                    <Text style={[styles.heroTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                      {item.title}
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
        }}
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
