import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Dimensions,
  FlatList,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { Bell, Calendar, BookOpen, ChevronRight } from 'lucide-react-native';
import { WordReveal } from '../src/components/motion/WordReveal';
import { ScrambleText } from '../src/components/motion/ScrambleText';
import { PillButton } from '../src/components/ui/PillButton';
import { useAuthStore } from '../src/store/useAuthStore';
import { theme } from '../src/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  subtitle: string;
  isFirst?: boolean;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: <Bell size={44} color={theme.colors.accent} />,
    tag: 'SMART NOTICES',
    title: 'Every GBU notice, sorted for you',
    subtitle: 'From exam schedules to fee submission extensions, never miss an urgent update for your department.',
    isFirst: true,
  },
  {
    id: '2',
    icon: <Calendar size={44} color={theme.colors.accent} />,
    tag: 'LIVE TIMETABLE',
    title: 'Your timetable, always current',
    subtitle: 'Automatic synchronization with room changes and schedule shifts, cached completely offline.',
  },
  {
    id: '3',
    icon: <BookOpen size={44} color={theme.colors.accent} />,
    tag: 'EXAMS & PYQS',
    title: 'PYQs and exam dates in one place',
    subtitle: 'Browse semester question papers, track date sheet revisions, and prepare smarter.',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { completeOnboarding } = useAuthStore();

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    completeOnboarding();
    router.replace('/login');
  };

  const onMomentumScrollEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(x / SCREEN_WIDTH);
    setCurrentIndex(newIdx);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header with Skip button */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandGBU}>GBU </Text>
          <Text style={styles.brandOne}>One</Text>
        </View>

        {currentIndex < SLIDES.length - 1 ? (
          <Pressable onPress={finishOnboarding} hitSlop={12} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <View style={styles.slide}>
            <View style={styles.iconCircle}>{item.icon}</View>

            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{item.tag}</Text>
            </View>

            <View style={styles.titleContainer}>
              {index === currentIndex ? (
                <WordReveal
                  key={`slide-${item.id}-${index}`}
                  text={item.title}
                  style={styles.slideTitle}
                  duration={280}
                />
              ) : (
                <Text style={styles.slideTitle}>{item.title}</Text>
              )}
            </View>

            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Bottom Controls */}
      <View style={styles.bottomBar}>
        {/* Pill-dot indicator */}
        <View style={styles.indicatorRow}>
          {SLIDES.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[
                styles.dot,
                i === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <PillButton
          label={currentIndex === SLIDES.length - 1 ? 'Get started' : 'Next'}
          onPress={handleNext}
          variant="primary"
          size="md"
          icon={
            currentIndex < SLIDES.length - 1 ? (
              <ChevronRight size={18} color={theme.colors.ivory} style={{ marginLeft: 6 }} />
            ) : undefined
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandGBU: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: theme.colors.ivory,
  },
  brandOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: theme.colors.accent,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 106, 43, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: theme.spacing.md,
  },
  tagText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.accent,
    letterSpacing: 0.5,
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  slideTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
    lineHeight: 34,
    color: theme.colors.ivory,
    textAlign: 'center',
  },
  slideSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  bottomBar: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dotActive: {
    width: 26,
    backgroundColor: theme.colors.accent,
  },
});
