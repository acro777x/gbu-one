import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Bell, AlertTriangle, Clock, Download, Sparkles } from 'lucide-react-native';
import { LogoMark } from '../../src/components/brand/LogoMark';
import {
  HeroCarousel,
  NextClassCard,
  GlassCard,
  Avatar,
} from '../../src/components/ui';
import { CountUp } from '../../src/components/motion/CountUp';
import { useAuthStore } from '../../src/store/useAuthStore';
import { GBUTimetableProvider, Slot } from '../../src/features/timetable/timetableProvider';
import { theme } from '../../src/lib/theme';

export default function HomeScreen() {
  const { user, isGuest, classSelection } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [hasTimetableChange] = useState(true);
  const [nextSlot, setNextSlot] = useState<Slot | null>(null);

  useEffect(() => {
    let mounted = true;
    const provider = new GBUTimetableProvider();
    const section = classSelection?.section || 'BCS-II B';
    provider.getTimetable(section, '39').then((tt) => {
      if (!mounted) return;
      if (tt.slots.length > 0) {
        const dayOfWeek = (new Date().getDay() || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        const todaySlots = tt.slots.filter((s) => s.day === dayOfWeek);
        const slot = todaySlots.length > 0 ? todaySlots[0] : tt.slots[0];
        setNextSlot(slot);
      }
    });
    return () => {
      mounted = false;
    };
  }, [classSelection?.section]);

  const onRefresh = () => {
    setRefreshing(true);
    const provider = new GBUTimetableProvider();
    const section = classSelection?.section || 'BCS-II B';
    provider.getTimetable(section, '39').then((tt) => {
      if (tt.slots.length > 0) {
        const dayOfWeek = (new Date().getDay() || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        const todaySlots = tt.slots.filter((s) => s.day === dayOfWeek);
        setNextSlot(todaySlots.length > 0 ? todaySlots[0] : tt.slots[0]);
      }
      setRefreshing(false);
    });
  };

  const heroSlides = [
    {
      id: 'h1',
      category: 'Exam Alert',
      title: 'Mid Sem Exam Datesheet Released',
      meta: 'Autumn 2026 • 6 Days Left',
      onPress: () => router.push('/notices' as never),
    },
    {
      id: 'h2',
      category: 'Fee Deadline',
      title: 'Monsoon Fee Submission Extended',
      meta: 'Extended to Oct 31 • Final Call',
      onPress: () => router.push('/notices' as never),
    },
    {
      id: 'h3',
      category: 'Scholarship',
      title: 'UP Post-Matric Scholarship Forms',
      meta: 'All Schools • Closes Nov 10',
      onPress: () => router.push('/notices' as never),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LogoMark size={32} />
          <View style={styles.wordmarkRow}>
            <Text style={styles.brandGBU}>GBU </Text>
            <Text style={styles.brandOne}>One</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => router.push('/notices' as never)}
            accessibilityLabel="Notifications"
          >
            <Bell size={20} color={theme.colors.ivory} />
            <View style={styles.unreadDot} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/profile' as never)}
            accessibilityLabel="Profile"
          >
            <Avatar
              url={user?.avatarUrl}
              name={user?.name}
              isGuest={isGuest}
              size={34}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Full-bleed Hero Carousel (Signal Bloom style) */}
        <HeroCarousel slides={heroSlides} />

        <View style={styles.bodyContent}>
          {/* Next Class Card (Continue Watching style) */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Up Next</Text>
            <TouchableOpacity onPress={() => router.push('/timetable' as never)}>
              <Text style={styles.seeAllText}>Full Schedule</Text>
            </TouchableOpacity>
          </View>

          <NextClassCard
            subject={nextSlot?.subject || 'Operating Systems'}
            room={nextSlot?.room ? `${nextSlot.room} • ${classSelection?.school || 'SOICT'}` : 'IL101 • SOICT'}
            time={nextSlot ? `${nextSlot.start} - ${nextSlot.end}` : '08:30 - 09:30 AM'}
            timeLeftBadge="Starts 08:30"
            progressPercent={nextSlot ? 65 : 0}
            faculty={nextSlot?.faculty || 'Prof. Prashant Gaurav'}
            onPress={() => router.push('/timetable' as never)}
          />

          {/* Timetable Changed Banner */}
          {hasTimetableChange && (
            <GlassCard style={styles.changeBanner} accentBorder onPress={() => router.push('/timetable' as never)}>
              <View style={styles.changeRow}>
                <View style={styles.changeIconCircle}>
                  <AlertTriangle size={18} color={theme.colors.accent} />
                </View>
                <View style={styles.changeTextCol}>
                  <Text style={styles.changeTitle}>Timetable Changed</Text>
                  <Text style={styles.changeSubtitle}>
                    Tomorrow: Data Structures moved 09:30 → 10:30 (Room 208)
                  </Text>
                </View>
              </View>
            </GlassCard>
          )}

          {/* Deadlines Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Deadlines</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deadlineRow}>
            <GlassCard style={styles.deadlineCard}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={theme.colors.warning} />
                <Text style={styles.deadlineBadgeText}>2 days left</Text>
              </View>
              <Text style={styles.deadlineCardTitle}>Monsoon Fee Submission</Text>
              <Text style={styles.deadlineCardDate}>Due 31 Oct 2026</Text>
            </GlassCard>

            <GlassCard style={styles.deadlineCard}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={theme.colors.warning} />
                <Text style={styles.deadlineBadgeText}>12 days left</Text>
              </View>
              <Text style={styles.deadlineCardTitle}>UP Scholarship Portal</Text>
              <Text style={styles.deadlineCardDate}>Due 10 Nov 2026</Text>
            </GlassCard>

            <GlassCard style={styles.deadlineCard}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={theme.colors.success} />
                <Text style={styles.deadlineBadgeText}>18 days left</Text>
              </View>
              <Text style={styles.deadlineCardTitle}>Back Paper Exam Form</Text>
              <Text style={styles.deadlineCardDate}>Due 16 Nov 2026</Text>
            </GlassCard>
          </ScrollView>

          {/* Exam Countdown Card */}
          <GlassCard style={styles.examCard}>
            <View style={styles.examCardRow}>
              <View>
                <Text style={styles.examSubtitle}>AUTUMN 2026</Text>
                <Text style={styles.examTitle}>Mid Semester Examinations</Text>
                <Text style={styles.examDate}>Starts Monday, 3 Nov 2026</Text>
              </View>
              <View style={styles.countdownBox}>
                <CountUp value={14} style={styles.countdownNumber} />
                <Text style={styles.countdownLabel}>DAYS LEFT</Text>
              </View>
            </View>
          </GlassCard>

          {/* Trending PYQs */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Trending PYQs</Text>
            <TouchableOpacity onPress={() => router.push('/pyq' as any)}>
              <Text style={styles.seeAllText}>Browse all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pyqGrid}>
            <GlassCard style={styles.pyqCard} onPress={() => router.push('/pyq' as any)}>
              <View style={styles.pyqBadge}>
                <Text style={styles.pyqBadgeText}>CSE205</Text>
              </View>
              <Text style={styles.pyqTitle} numberOfLines={2}>Data Structures & Algorithms</Text>
              <View style={styles.pyqMeta}>
                <Text style={styles.pyqYear}>2025 Mid Sem</Text>
                <View style={styles.downloadCount}>
                  <Download size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.downloadText}>320</Text>
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.pyqCard} onPress={() => router.push('/pyq' as any)}>
              <View style={styles.pyqBadge}>
                <Text style={styles.pyqBadgeText}>CSE209</Text>
              </View>
              <Text style={styles.pyqTitle} numberOfLines={2}>Operating Systems</Text>
              <View style={styles.pyqMeta}>
                <Text style={styles.pyqYear}>2025 End Sem</Text>
                <View style={styles.downloadCount}>
                  <Download size={12} color={theme.colors.textSecondary} />
                  <Text style={styles.downloadText}>294</Text>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Motion Playground Shortcut in dev */}
          <TouchableOpacity
            style={styles.devLink}
            onPress={() => router.push('/dev/motion' as any)}
          >
            <Sparkles size={14} color={theme.colors.accent} />
            <Text style={styles.devLinkText}>Motion Playground (/dev/motion)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  brandGBU: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: theme.colors.ivory,
  },
  brandOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: theme.colors.accent,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
    position: 'absolute',
    top: 8,
    right: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.bg,
  },
  scrollContent: {
    paddingBottom: 110, // Safe padding for floating bottom bar
  },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: theme.colors.ivory,
  },
  seeAllText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.accent,
  },
  changeBanner: {
    marginBottom: theme.spacing.lg,
    backgroundColor: 'rgba(255, 106, 43, 0.08)',
    borderColor: theme.colors.accent,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 106, 43, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  changeTextCol: {
    flex: 1,
  },
  changeTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: theme.colors.ivory,
  },
  changeSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  deadlineRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  deadlineCard: {
    width: 170,
    marginRight: 12,
    padding: theme.spacing.md,
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 184, 61, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  deadlineBadgeText: {
    color: theme.colors.warning,
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    marginLeft: 3,
  },
  deadlineCardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
    lineHeight: 18,
    marginBottom: 4,
  },
  deadlineCardDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  examCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: '#181518',
  },
  examCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examSubtitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: theme.colors.accent,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  examTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: theme.colors.ivory,
    marginBottom: 4,
  },
  examDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  countdownBox: {
    backgroundColor: 'rgba(255, 106, 43, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  countdownNumber: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: theme.colors.accent,
  },
  countdownLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    color: theme.colors.accent,
    letterSpacing: 0.5,
  },
  pyqGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  pyqCard: {
    flex: 1,
    padding: theme.spacing.md,
  },
  pyqBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  pyqBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  pyqTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: theme.colors.ivory,
    lineHeight: 18,
    marginBottom: 8,
    minHeight: 36,
  },
  pyqMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pyqYear: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  downloadCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  downloadText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  devLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    opacity: 0.7,
  },
  devLinkText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.accent,
  },
});
