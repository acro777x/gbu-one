import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PillButton } from './PillButton';
import { LetterRise } from '../motion/LetterRise';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  slides,
  autoAdvanceInterval = 6000,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const isInteracting = useRef(false);

  useEffect(() => {
    if (slides.length <= 1) return;

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
  }, [slides.length, autoAdvanceInterval]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(x / SCREEN_WIDTH);
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
            <View style={styles.slide}>
              {/* Subtle background glow & gradient */}
              <LinearGradient
                colors={['#1F1714', '#161618', '#0B0B0C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.slideContent}>
                {/* Meta / Category pill */}
                <View style={styles.metaRow}>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                  <Text style={styles.metaText}>{item.meta}</Text>
                </View>

                {/* Main Headline */}
                <View style={styles.titleContainer}>
                  {isCurrent ? (
                    <LetterRise
                      text={item.title}
                      style={styles.heroTitle}
                      stagger={20}
                    />
                  ) : (
                    <Text style={styles.heroTitle}>{item.title}</Text>
                  )}
                </View>

                {/* Action button */}
                <View style={styles.actionRow}>
                  <PillButton
                    label="View details"
                    variant="white"
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
                  isActive ? styles.dotActive : styles.dotInactive,
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
    width: SCREEN_WIDTH,
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
    backgroundColor: 'rgba(255, 106, 43, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginRight: 8,
  },
  categoryText: {
    color: theme.colors.accent,
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  metaText: {
    color: theme.colors.textSecondary,
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
    color: theme.colors.ivory,
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.accent,
  },
});

export default HeroCarousel;
