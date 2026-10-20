import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Bell, Calendar, BookOpen, ChevronRight, GraduationCap, Check } from 'lucide-react-native';
import { WordReveal } from '../src/components/motion/WordReveal';
import { PillButton } from '../src/components/ui/PillButton';
import { useAuthStore, ClassSelection } from '../src/store/useAuthStore';
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

// Department/programme data structure

interface ProgrammeInfo {
  label: string;
  code: string;
}

const PROGRAMMES: ProgrammeInfo[] = [
  { label: 'B.Tech CSE', code: 'BCS' },
  { label: 'B.Tech AI', code: 'BAI' },
  { label: 'B.Tech CSE (Cyber Security)', code: 'CSE-CS' },
  { label: 'B.Tech ECE', code: 'ECE' },
  { label: 'B.Tech IT', code: 'IT' },
  { label: 'M.Tech (Integrated)', code: 'MIT' },
];

const YEARS = [
  { label: '1st Year', code: 'I' },
  { label: '2nd Year', code: 'II' },
  { label: '3rd Year', code: 'III' },
  { label: '4th Year', code: 'IV' },
];

const SECTIONS = ['A', 'B', 'C'];

export default function OnboardingScreen() {
  const { colors } = useAppTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { completeOnboarding, setClassSelection } = useAuthStore();

  // Class setup state
  const [selectedProgramme, setSelectedProgramme] = useState<ProgrammeInfo | null>(null);
  const [selectedYear, setSelectedYear] = useState<typeof YEARS[number] | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Total steps: 3 slides + 1 class setup
  const TOTAL_STEPS = SLIDES.length + 1;
  const isOnClassSetup = currentIndex === SLIDES.length;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else if (currentIndex === SLIDES.length - 1) {
      // Move to class setup step
      setCurrentIndex(SLIDES.length);
    } else {
      finishOnboarding();
    }
  };

  const canFinish = selectedProgramme && selectedYear && selectedSection;

  /**
   * The spec asks for notification permission on the LAST slide with a plain
   * explanation - not on launch. The class-setup step is that last step, so
   * the request happens right before the student leaves onboarding.
   */
  const requestNotificationPermission = async () => {
    if (Platform.OS === 'web') return;
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return;
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    } catch {
      // Permission is a nice-to-have; onboarding continues either way.
    }
  };

  const finishOnboarding = async () => {
    // Save class selection if complete
    if (selectedProgramme && selectedYear && selectedSection) {
      const selection: ClassSelection = {
        school: 'SOICT',
        programme: selectedProgramme.label,
        programmeCode: selectedProgramme.code,
        semester: selectedYear.code,
        section: `${selectedProgramme.code}-${selectedYear.code} ${selectedSection}`,
      };
      setClassSelection(selection);
    }

    try {
      await AsyncStorage.setItem('@gbu_one_has_seen_onboarding', 'true');
    } catch {
      // ignore
    }
    completeOnboarding();
    router.replace('/(tabs)');

    // Ask after the navigation so the system dialog never blocks the screen
    // the student is looking at.
    void requestNotificationPermission();
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

  const renderChip = useCallback((
    label: string,
    isSelected: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
          borderColor: isSelected ? colors.accent : colors.borderGlass,
        },
      ]}
    >
      {isSelected && <Check size={14} color={colors.onAccent} style={{ marginRight: 4 }} />}
      <Text
        style={[
          styles.chipText,
          { color: isSelected ? colors.onAccent : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  ), [colors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header with Skip button */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={[styles.brandGBU, { color: colors.textPrimary }]}>GBU </Text>
          <Text style={[styles.brandOne, { color: colors.accent }]}>One</Text>
        </View>

        {!isOnClassSetup && currentIndex < SLIDES.length - 1 ? (
          <Pressable onPress={finishOnboarding} hitSlop={12} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Content Area */}
      {isOnClassSetup ? (
        /* Class & Department Setup Step */
        <ScrollView
          style={styles.classSetupScroll}
          contentContainerStyle={styles.classSetupContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <GraduationCap size={42} color={colors.accent} />
          </View>

          <View style={[styles.tagPill, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.tagText, { color: colors.accent }]}>YOUR CLASS</Text>
          </View>

          <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>
            Select your class & department
          </Text>
          <Text style={[styles.slideSubtitle, { color: colors.textSecondary }]}>
            We&apos;ll personalise your timetable, notices, and exam schedule based on your selection.
          </Text>

          {/* Permission explainer (docs/SCREENS_AUTH.md: ask on the last
              slide with a clear explanation, not on launch). It sits above the
              form so it is read before the action, never below the fold. */}
          <View style={[styles.permissionNote, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
            <View style={styles.permissionNoteHead}>
              <Bell size={14} color={colors.accent} />
              <Text style={[styles.permissionNoteTitle, { color: colors.textPrimary }]}>
                STAY IN THE LOOP
              </Text>
            </View>
            <Text style={[styles.permissionNoteText, { color: colors.textSecondary }]}>
              We will ask for notification permission next, so you can get alerts
              about new notices and timetable changes for your class. You can turn
              them off any time in Profile.
            </Text>
          </View>

          {/* Programme Selection */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Programme</Text>
            <View style={styles.chipGrid}>
              {PROGRAMMES.map((p) =>
                renderChip(p.label, selectedProgramme?.code === p.code, () => setSelectedProgramme(p))
              )}
            </View>
          </View>

          {/* Year Selection */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Year</Text>
            <View style={styles.chipGrid}>
              {YEARS.map((y) =>
                renderChip(y.label, selectedYear?.code === y.code, () => setSelectedYear(y))
              )}
            </View>
          </View>

          {/* Section Selection */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Section</Text>
            <View style={styles.chipGrid}>
              {SECTIONS.map((s) =>
                renderChip(`Section ${s}`, selectedSection === s, () => setSelectedSection(s))
              )}
            </View>
          </View>

          {/* Preview of selection */}
          {selectedProgramme && selectedYear && selectedSection && (
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.borderGlass }]}>
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>Your class code</Text>
              <Text style={[styles.previewCode, { color: colors.accent }]}>
                {selectedProgramme.code}-{selectedYear.code} {selectedSection}
              </Text>
              <Text style={[styles.previewSchool, { color: colors.textSecondary }]}>
                School of ICT • Gautam Buddha University
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* Feature Slides Carousel */
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
                    borderColor: colors.accent,
                  },
                ]}
              >
                {renderIcon(item.iconName)}
              </View>

              <View style={[styles.tagPill, { backgroundColor: colors.accentSoft }]}>
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
      )}

      {/* Bottom Controls */}
      <View style={styles.bottomBar}>
        {/* Pill-dot indicator */}
        <View style={styles.indicatorRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
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
        {isOnClassSetup ? (
          <PillButton
            label={canFinish ? 'Get started' : 'Skip for now'}
            onPress={finishOnboarding}
            variant="primary"
            size="md"
          />
        ) : (
          <PillButton
            label={currentIndex === SLIDES.length - 1 ? 'Set up my class' : 'Next'}
            onPress={handleNext}
            variant="primary"
            size="md"
            icon={
              currentIndex < SLIDES.length - 1 ? (
                <ChevronRight size={18} color={colors.onAccent} style={{ marginLeft: 6 }} />
              ) : undefined
            }
          />
        )}
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
    paddingHorizontal: 12,
    // 44dp so the Skip button meets the minimum touch target.
    minHeight: 44,
    justifyContent: 'center',
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
  classSetupScroll: {
    // The class step is longer than the screen; it has to scroll instead of
    // clipping its last card.
    flex: 1,
  },
  classSetupContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    alignItems: 'center',
    paddingBottom: 40,
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
    marginBottom: theme.spacing.lg,
  },
  sectionBlock: {
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    letterSpacing: 0.3,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  chipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  previewCard: {
    width: '100%',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  permissionNote: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.md,
  },
  permissionNoteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  permissionNoteTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  permissionNoteText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  previewLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginBottom: 4,
  },
  previewCode: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    marginBottom: 4,
  },
  previewSchool: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
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
