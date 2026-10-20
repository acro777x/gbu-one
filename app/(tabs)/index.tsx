import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Bell,
  Mail,
  AlertTriangle,
  Clock,
  Download,
  Sparkles,
  Calendar,
  GraduationCap,
  ChevronRight,
  ArrowRight,
} from 'lucide-react-native';
import { LogoMark } from '../../src/components/brand/LogoMark';
import {
  HeroCarousel,
  NextClassCard,
  GlassCard,
  Avatar,
  AttendanceBatteryCard,
} from '../../src/components/ui';
import { CountUp } from '../../src/components/motion/CountUp';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useMailStore } from '../../src/store/useMailStore';
import { Slot } from '../../src/features/timetable/timetableProvider';
import { getSectionTimetable } from '../../src/features/timetable/timetableStore';
import { useNoticesQuery } from '../../src/features/notices/useNoticesQuery';
import { useAppTheme } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';
import { TimetableChangeModal } from '../../src/components/timetable/TimetableChangeModal';
import { useTimetableAlert } from '../../src/features/timetable/useTimetableAlert';

export default function HomeScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, isGuest, classSelection } = useAuthStore();
  const { emails, getUnreadCount } = useMailStore();
  const [refreshing, setRefreshing] = useState(false);
  const enrolledClassKey = classSelection?.section || 'BAI-II A';
  const { modalVisible, activeDiff, dismissAlert } = useTimetableAlert(enrolledClassKey);
  const [nextSlot, setNextSlot] = useState<Slot | null>(null);
  const hasTimetableChange = Boolean(nextSlot?.isChanged);

  const unreadMails = getUnreadCount();
  const topMail = emails[0];

  useEffect(() => {
    let mounted = true;
    getSectionTimetable(enrolledClassKey, '39', false).then((tt) => {
      if (!mounted) return;
      if (tt.slots.length > 0) {
        const dayOfWeek = (new Date().getDay() || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        const todaySlots = tt.slots.filter((s) => s.day === dayOfWeek);
        const slot = todaySlots.length > 0 ? todaySlots[0] : tt.slots[0];
        setNextSlot(slot);
      }
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, [enrolledClassKey]);

  const onRefresh = () => {
    setRefreshing(true);
    void refetchNotices();
    getSectionTimetable(enrolledClassKey, '39', true).then((tt) => {
      if (tt.slots.length > 0) {
        const dayOfWeek = (new Date().getDay() || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        const todaySlots = tt.slots.filter((s) => s.day === dayOfWeek);
        setNextSlot(todaySlots.length > 0 ? todaySlots[0] : tt.slots[0]);
      }
      setRefreshing(false);
    }).catch(() => {
      setRefreshing(false);
    });
  };

  // Live notices drive the hero; the bundled seed is the offline fallback.
  const { data: notices = [], refetch: refetchNotices } = useNoticesQuery();

  const topNotices = notices.filter((n) => n.importance >= 3).slice(0, 4);
  const heroSlides = topNotices.map((n) => ({
    id: n.id,
    category: n.category === 'datesheet' ? 'Exam Alert' : n.category.toUpperCase(),
    title: n.cleanTitle,
    meta: n.deadlineAt
      ? `Deadline: ${new Date(n.deadlineAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      : `${n.source.toUpperCase()} • Official Notice`,
    onPress: () => router.push({ pathname: '/notice/[id]', params: { id: n.id } } as never),
  }));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.divider }]}>
        <View style={styles.headerLeft}>
          <LogoMark size={32} />
          <View style={styles.wordmarkRow}>
            <Text style={[styles.brandGBU, { color: colors.textPrimary }]}>GBU </Text>
            <Text style={[styles.brandOne, { color: colors.accent }]}>One</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* GBU Webmail Button */}
          <TouchableOpacity
            style={[
              styles.mailButton,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.06)',
                borderColor: colors.borderGlass,
              },
            ]}
            onPress={() => router.push('/mail' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="GBU Webmail"
          >
            <Mail size={19} color={colors.textPrimary} />
            {unreadMails > 0 && (
              <View style={[styles.mailBadge, { borderColor: colors.bg }]}>
                <Text style={styles.mailBadgeText}>{unreadMails}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Notifications Bell */}
          <TouchableOpacity
            style={[
              styles.bellButton,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.06)',
                borderColor: colors.borderGlass,
              },
            ]}
            onPress={() => router.push('/notices' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Notifications"
          >
            <Bell size={19} color={colors.textPrimary} />
            <View style={[styles.unreadDot, { borderColor: colors.bg }]} />
          </TouchableOpacity>

          {/* User Avatar */}
          <TouchableOpacity
            onPress={() => router.push('/profile' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(120, 100 + insets.bottom) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Full-bleed Hero Carousel */}
        <HeroCarousel slides={heroSlides} />

        <View style={styles.bodyContent}>
          {/* Quick Academic Hub Navigation Row */}
          <View style={styles.quickHubRow}>
            <TouchableOpacity
              style={styles.quickHubItem}
              onPress={() => router.push('/mail' as never)}
            >
              <View style={[styles.quickHubIcon, { backgroundColor: colors.accentSoft, borderColor: colors.borderGlass }]}>
                <Mail size={18} color={colors.accent} />
                {unreadMails > 0 && <View style={styles.quickHubDot} />}
              </View>
              <Text style={[styles.quickHubLabel, { color: colors.textPrimary }]}>GBU Mail</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickHubItem}
              onPress={() => router.push('/timetable' as never)}
            >
              <View style={[styles.quickHubIcon, { backgroundColor: colors.successSoft, borderColor: colors.borderGlass }]}>
                <Calendar size={18} color={colors.success} />
              </View>
              <Text style={[styles.quickHubLabel, { color: colors.textPrimary }]}>Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickHubItem}
              onPress={() => router.push('/exams' as never)}
            >
              <View style={[styles.quickHubIcon, { backgroundColor: colors.warningSoft, borderColor: colors.borderGlass }]}>
                <GraduationCap size={18} color={colors.warning} />
              </View>
              <Text style={[styles.quickHubLabel, { color: colors.textPrimary }]}>Exam Hub</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickHubItem}
              onPress={() => router.push('/calendar' as never)}
            >
              <View
                style={[
                  styles.quickHubIcon,
                  {
                    backgroundColor: isDark ? 'rgba(167, 139, 250, 0.16)' : '#F3EEFD',
                    borderColor: colors.borderGlass,
                  },
                ]}
              >
                <Clock size={18} color="#8B5CF6" />
              </View>
              <Text style={[styles.quickHubLabel, { color: colors.textPrimary }]}>Calendar</Text>
            </TouchableOpacity>
          </View>

          {/* Academic Attendance Battery Meter */}
          <AttendanceBatteryCard onPressDetails={() => router.push('/goal' as never)} />

          {/* Next Class Card */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Up Next</Text>
            <TouchableOpacity onPress={() => router.push('/timetable' as never)}>
              <Text style={[styles.seeAllText, { color: colors.accent }]}>Full Schedule</Text>
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
                <View style={[styles.changeIconCircle, { backgroundColor: `${colors.accent}20` }]}>
                  <AlertTriangle size={18} color={colors.accent} />
                </View>
                <View style={styles.changeTextCol}>
                  <Text style={[styles.changeTitle, { color: colors.textPrimary }]}>Timetable Changed</Text>
                  <Text style={[styles.changeSubtitle, { color: colors.textSecondary }]}>
                    Tomorrow: Data Structures moved 09:30 → 10:30 (Room 208)
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textSecondary} />
              </View>
            </GlassCard>
          )}

          {/* GBU Webmail & Student Dispatch Spotlight */}
          {topMail && (
            <View style={styles.mailSpotlightSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>University Dispatch</Text>
                  {unreadMails > 0 && (
                    <View style={[styles.miniUnreadPill, { borderColor: colors.accent, backgroundColor: `${colors.accent}20` }]}>
                      <Text style={[styles.miniUnreadPillText, { color: colors.accent }]}>{unreadMails} unread</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => router.push('/mail' as never)}>
                  <Text style={[styles.seeAllText, { color: colors.accent }]}>Open Webmail</Text>
                </TouchableOpacity>
              </View>

              <GlassCard
                style={styles.mailSpotlightCard}
                accentBorder={topMail.isUnread}
                glow={topMail.isUnread}
                onPress={() => router.push('/mail' as never)}
              >
                <View style={styles.mailSpotlightTop}>
                  <View style={[styles.mailAvatar, { backgroundColor: topMail.avatarColor }]}>
                    <Text style={styles.mailAvatarText}>{topMail.avatarInitial}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.mailSenderName, { color: colors.textPrimary }]}>{topMail.senderName}</Text>
                    <Text style={[styles.mailSenderRole, { color: colors.textSecondary }]}>{topMail.senderRole}</Text>
                  </View>
                  <Text style={[styles.mailDate, { color: colors.textSecondary }]}>{topMail.dateStr}</Text>
                </View>
                <Text style={[styles.mailSubject, { color: colors.textPrimary }]} numberOfLines={1}>{topMail.subject}</Text>
                <Text style={[styles.mailSnippet, { color: colors.textSecondary }]} numberOfLines={2}>{topMail.preview}</Text>
                <View style={styles.mailActionRow}>
                  <Text style={[styles.mailActionLink, { color: colors.accent }]}>Tap to view official communication</Text>
                  <ArrowRight size={14} color={colors.accent} />
                </View>
              </GlassCard>
            </View>
          )}

          {/* Deadlines Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Active Deadlines</Text>
            <TouchableOpacity onPress={() => router.push('/calendar' as never)}>
              <Text style={[styles.seeAllText, { color: colors.accent }]}>Academic Calendar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deadlineRow}>
            <GlassCard style={styles.deadlineCard} onPress={() => router.push({ pathname: '/notice/[id]', params: { id: 'not_2' } } as never)}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={colors.warning} />
                <Text style={[styles.deadlineBadgeText, { color: colors.warning }]}>2 days left</Text>
              </View>
              <Text style={[styles.deadlineCardTitle, { color: colors.textPrimary }]}>Monsoon Fee Submission</Text>
              <Text style={[styles.deadlineCardDate, { color: colors.textSecondary }]}>Due 31 Oct 2026</Text>
            </GlassCard>

            <GlassCard style={styles.deadlineCard} onPress={() => router.push({ pathname: '/notice/[id]', params: { id: 'not_3' } } as never)}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={colors.warning} />
                <Text style={[styles.deadlineBadgeText, { color: colors.warning }]}>12 days left</Text>
              </View>
              <Text style={[styles.deadlineCardTitle, { color: colors.textPrimary }]}>UP Scholarship Portal</Text>
              <Text style={[styles.deadlineCardDate, { color: colors.textSecondary }]}>Due 10 Nov 2026</Text>
            </GlassCard>

            <GlassCard style={styles.deadlineCard} onPress={() => router.push({ pathname: '/notice/[id]', params: { id: 'not_5' } } as never)}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={colors.success} />
                <Text style={[styles.deadlineBadgeText, { color: colors.success }]}>18 days left</Text>
              </View>
              <Text style={[styles.deadlineCardTitle, { color: colors.textPrimary }]}>Back Paper Exam Form</Text>
              <Text style={[styles.deadlineCardDate, { color: colors.textSecondary }]}>Due 16 Nov 2026</Text>
            </GlassCard>
          </ScrollView>

          {/* Exam Countdown Card */}
          <GlassCard style={styles.examCard} onPress={() => router.push('/exams' as never)}>
            <View style={styles.examCardRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.examSubtitle, { color: colors.accent }]}>AUTUMN 2026</Text>
                <Text style={[styles.examTitle, { color: colors.textPrimary }]}>Mid Semester Examinations</Text>
                <Text style={[styles.examDate, { color: colors.textSecondary }]}>Starts Monday, 3 Nov 2026 • Tap for Date Sheet</Text>
              </View>
              <View style={[styles.countdownBox, { backgroundColor: colors.accentSoft, borderColor: `${colors.accent}44` }]}>
                <CountUp value={14} style={{ ...styles.countdownNumber, color: colors.accent }} />
                <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>DAYS LEFT</Text>
              </View>
            </View>
          </GlassCard>

          {/* Trending PYQs */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Trending PYQs</Text>
            <TouchableOpacity onPress={() => router.push('/pyq' as never)}>
              <Text style={[styles.seeAllText, { color: colors.accent }]}>Browse all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pyqGrid}>
            <GlassCard style={styles.pyqCard} onPress={() => router.push('/pyq' as never)}>
              <View style={[styles.pyqBadge, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)' }]}>
                <Text style={[styles.pyqBadgeText, { color: colors.accent }]}>CSE205</Text>
              </View>
              <Text style={[styles.pyqTitle, { color: colors.textPrimary }]} numberOfLines={2}>Data Structures & Algorithms</Text>
              <View style={styles.pyqMeta}>
                <Text style={[styles.pyqYear, { color: colors.textSecondary }]}>2025 Mid Sem</Text>
                <View style={styles.downloadCount}>
                  <Download size={12} color={colors.textSecondary} />
                  <Text style={[styles.downloadText, { color: colors.textSecondary }]}>320</Text>
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.pyqCard} onPress={() => router.push('/pyq' as never)}>
              <View style={[styles.pyqBadge, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)' }]}>
                <Text style={[styles.pyqBadgeText, { color: colors.accent }]}>CSE209</Text>
              </View>
              <Text style={[styles.pyqTitle, { color: colors.textPrimary }]} numberOfLines={2}>Operating Systems</Text>
              <View style={styles.pyqMeta}>
                <Text style={[styles.pyqYear, { color: colors.textSecondary }]}>2025 End Sem</Text>
                <View style={styles.downloadCount}>
                  <Download size={12} color={colors.textSecondary} />
                  <Text style={[styles.downloadText, { color: colors.textSecondary }]}>294</Text>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Motion Playground Shortcut in dev */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devLink}
              onPress={() => router.push('/dev/motion' as never)}
            >
              <Sparkles size={14} color={colors.accent} />
              <Text style={[styles.devLinkText, { color: colors.accent }]}>Motion Playground (/dev/motion)</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* High-priority In-App Timetable Alert Pop-Up */}
      <TimetableChangeModal
        visible={modalVisible}
        classKey={enrolledClassKey}
        changeMessage={activeDiff?.message || 'Your class timetable has been updated by the university.'}
        changeType={activeDiff?.type}
        onDismiss={dismissAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
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
  },
  brandOne: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mailButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mailBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF6A2B',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  mailBadgeText: {
    color: '#FFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6A2B',
    position: 'absolute',
    top: 8,
    right: 8,
    borderWidth: 1.5,
  },
  scrollContent: {
    paddingBottom: 110, // Safe padding for floating bottom bar
  },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  quickHubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  quickHubItem: {
    alignItems: 'center',
    width: 72,
  },
  quickHubIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 6,
    position: 'relative',
  },
  quickHubDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6A2B',
  },
  quickHubLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
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
  },
  seeAllText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  changeBanner: {
    marginBottom: theme.spacing.lg,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  },
  changeSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  mailSpotlightSection: {
    marginBottom: theme.spacing.lg,
  },
  miniUnreadPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
  },
  miniUnreadPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  mailSpotlightCard: {
    padding: theme.spacing.md,
  },
  mailSpotlightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mailAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mailAvatarText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    color: '#FFF',
  },
  mailSenderName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  mailSenderRole: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  mailDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  mailSubject: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  mailSnippet: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  mailActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mailActionLink: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
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
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginLeft: 4,
  },
  deadlineCardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  deadlineCardDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  examCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  examCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examSubtitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  examTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
    marginBottom: 4,
  },
  examDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  countdownBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
  },
  countdownLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  pyqBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  pyqTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginBottom: 8,
    minHeight: 38,
  },
  pyqMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pyqYear: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  downloadCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  downloadText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  devLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginTop: 8,
  },
  devLinkText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
});
