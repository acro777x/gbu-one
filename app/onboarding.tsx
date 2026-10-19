import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Dimensions,
  FlatList,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, Calendar, BookOpen, ChevronRight } from 'lucide-react-native';
import { WordReveal } from '../src/components/motion/WordReveal';
import { PillButton } from '../src/components/ui/PillButton';
import { useAuthStore } from '../src/store/useAuthStore';
import { useAppTheme } from '../src/lib/ThemeContext';
import { theme } from '../src/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  iconName: 'bell' | 'calendar' | 'book';
  tag: string;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    iconName: 'bell',
    tag: 'SMART NOTICES',
    title: 'Every GBU notice, sorted for you',
    subtitle: 'From exam schedules to fee submission extensions, never miss an urgent update for your department.',
  },
  {
    id: '2',
    iconName: 'calendar',
    tag: 'LIVE TIMETABLE',
    title: 'Your timetable, always current',
    subtitle: 'Automatic synchronization with room changes and schedule shifts, cached completely offline.',
  },
  {
    id: '3',
    iconName: 'book',
    tag: 'EXAMS & PYQS',
    title: 'PYQs and exam dates in one place',
    subtitle: 'Browse semester question papers, track date sheet revisions, and prepare smarter.',
  },
];

export default function OnboardingScreen() {
  const { colors } = useAppTheme();
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

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@gbu_one_has_seen_onboarding', 'true');
    } catch {
      // ignore
    }
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(x / SCREEN_WIDTH);
    setCurrentIndex(newIdx);
  };

  const renderIcon = (name: string) => {
    switch (name) {
      case 'bell':
        return <Bell size={42} color={colors.accent} />;
      case 'calendar':
        return <Calendar size={42} color={colors.accent} />;
      default:
        return <BookOpen size={42} color={colors.accent} />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header with Skip button */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={[styles.brandGBU, { color: colors.textPrimary }]}>GBU </Text>
          <Text style={[styles.brandOne, { color: colors.accent }]}>One</Text>
        </View>

        {currentIndex < SLIDES.length - 1 ? (
          <Pressable onPress={finishOnboarding} hitSlop={12} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
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
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: `${colors.accent}30`,
                },
              ]}
            >
              {renderIcon(item.iconName)}
            </View>

            <View style={[styles.tagPill, { backgroundColor: `${colors.accent}15` }]}>
              <Text style={[styles.tagText, { color: colors.accent }]}>{item.tag}</Text>
            </View>

            <View style={styles.titleContainer}>
              {index === currentIndex ? (
                <WordReveal
                  key={`slide-${item.id}-${index}`}
                  text={item.title}
                  style={{ ...styles.slideTitle, color: colors.textPrimary }}
                  duration={280}
                />
              ) : (
                <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              )}
            </View>

            <Text style={[styles.slideSubtitle, { color: colors.textSecondary }]}>
              {item.subtitle}
            </Text>
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
                i === currentIndex
                  ? [styles.dotActive, { backgroundColor: colors.accent }]
                  : [styles.dotInactive, { backgroundColor: colors.borderStrong }],
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
              <ChevronRight size={18} color={theme.colors.onAccent} style={{ marginLeft: 6 }} />
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
  },
  brandOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
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
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: theme.spacing.md,
  },
  tagText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
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
    textAlign: 'center',
  },
  slideSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
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
  },
  dotActive: {
    width: 26,
  },
});
