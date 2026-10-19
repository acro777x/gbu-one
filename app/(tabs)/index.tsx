import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { GBUTimetableProvider, Slot } from '../../src/features/timetable/timetableProvider';
import { MOCK_NOTICES } from '../../src/features/notices/noticeService';
import { theme } from '../../src/lib/theme';

export default function HomeScreen() {
  const { user, isGuest, classSelection } = useAuthStore();
  const { emails, getUnreadCount } = useMailStore();
  const [refreshing, setRefreshing] = useState(false);
  const [nextSlot, setNextSlot] = useState<Slot | null>(null);
  const hasTimetableChange = Boolean(nextSlot?.isChanged);

  const unreadMails = getUnreadCount();
  const topMail = emails[0];

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

  const topNotices = MOCK_NOTICES.filter((n) => n.importance >= 3).slice(0, 4);
  const heroSlides = topNotices.map((n) => ({
    id: n.id,
    category: n.category === 'datesheet' ? 'Exam Alert' : n.category.toUpperCase(),
    title: n.cleanTitle,
    meta: n.deadlineAt
      ? `Deadline: ${new Date(n.deadlineAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      : `${n.source.toUpperCase()} • Official Notice`,
    onPress: () => router.push('/notices' as never),
  }));

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
          {/* GBU Webmail Button */}
          <TouchableOpacity
            style={styles.mailButton}
            onPress={() => router.push('/mail' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="GBU Webmail"
          >
            <Mail size={19} color={theme.colors.ivory} />
            {unreadMails > 0 && (
              <View style={styles.mailBadge}>
                <Text style={styles.mailBadgeText}>{unreadMails}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Notifications Bell */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => router.push('/notices' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Notifications"
          >
            <Bell size={19} color={theme.colors.ivory} />
            <View style={styles.unreadDot} />
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
          {/* Quick Academic Hub Navigation Row */}
          <View style={styles.quickHubRow}>
            <TouchableOpacity
              style={styles.quickHubItem}
              onPress={() => router.push('/mail' as never)}
            >
              <View style={[styles.quickHubIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <Mail size={18} color={theme.colors.accent} />
                {unreadMails > 0 && <View style={styles.quickHubDot} />}
              </View>
              <Text style={styles.quickHubLabel}>GBU Mail</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickHubItem}
              onPress={() => router.push('/timetable' as never)}
            >
              <View style={[styles.quickHubIcon, { backgroundColor: theme.colors.successSoft }]}>
                <Calendar size={18} color={theme.colors.success} />
              </View>
              <Text style={styles.quickHubLabel}>Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickHubItem}
              onPress={() => router.push('/exams' as never)}
            >
              <View style={[styles.quickHubIcon, { backgroundColor: theme.colors.warningSoft }]}>
                <GraduationCap size={18} color={theme.colors.warning} />
              </View>
              <Text style={styles.quickHubLabel}>Exam Hub</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickHubItem}
              onPress={() => router.push('/calendar' as never)}
            >
              <View style={[styles.quickHubIcon, { backgroundColor: '#F3EEFD' }]}>
                <Clock size={18} color="#7C3AED" />
              </View>
              <Text style={styles.quickHubLabel}>Calendar</Text>
            </TouchableOpacity>
          </View>

          {/* Academic Attendance Battery Meter */}
          <AttendanceBatteryCard onPressDetails={() => router.push('/profile' as never)} />

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
                <ChevronRight size={16} color={theme.colors.textSecondary} />
              </View>
            </GlassCard>
          )}

          {/* GBU Webmail & Student Dispatch Spotlight */}
          {topMail && (
            <View style={styles.mailSpotlightSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>University Dispatch</Text>
                  {unreadMails > 0 && (
                    <View style={styles.miniUnreadPill}>
                      <Text style={styles.miniUnreadPillText}>{unreadMails} unread</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => router.push('/mail' as never)}>
                  <Text style={styles.seeAllText}>Open Webmail</Text>
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
                    <Text style={styles.mailSenderName}>{topMail.senderName}</Text>
                    <Text style={styles.mailSenderRole}>{topMail.senderRole}</Text>
                  </View>
                  <Text style={styles.mailDate}>{topMail.dateStr}</Text>
                </View>
                <Text style={styles.mailSubject} numberOfLines={1}>{topMail.subject}</Text>
                <Text style={styles.mailSnippet} numberOfLines={2}>{topMail.preview}</Text>
                <View style={styles.mailActionRow}>
                  <Text style={styles.mailActionLink}>Tap to view official communication</Text>
                  <ArrowRight size={14} color={theme.colors.accent} />
                </View>
              </GlassCard>
            </View>
          )}

          {/* Deadlines Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Deadlines</Text>
            <TouchableOpacity onPress={() => router.push('/calendar' as never)}>
              <Text style={styles.seeAllText}>Academic Calendar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deadlineRow}>
            <GlassCard style={styles.deadlineCard} onPress={() => router.push('/notices' as never)}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={theme.colors.warning} />
                <Text style={styles.deadlineBadgeText}>2 days left</Text>
              </View>
              <Text style={styles.deadlineCardTitle}>Monsoon Fee Submission</Text>
              <Text style={styles.deadlineCardDate}>Due 31 Oct 2026</Text>
            </GlassCard>

            <GlassCard style={styles.deadlineCard} onPress={() => router.push('/notices' as never)}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={theme.colors.warning} />
                <Text style={styles.deadlineBadgeText}>12 days left</Text>
              </View>
              <Text style={styles.deadlineCardTitle}>UP Scholarship Portal</Text>
              <Text style={styles.deadlineCardDate}>Due 10 Nov 2026</Text>
            </GlassCard>

            <GlassCard style={styles.deadlineCard} onPress={() => router.push('/notices' as never)}>
              <View style={styles.deadlineBadge}>
                <Clock size={12} color={theme.colors.success} />
                <Text style={styles.deadlineBadgeText}>18 days left</Text>
              </View>
              <Text style={styles.deadlineCardTitle}>Back Paper Exam Form</Text>
              <Text style={styles.deadlineCardDate}>Due 16 Nov 2026</Text>
            </GlassCard>
          </ScrollView>

          {/* Exam Countdown Card */}
          <GlassCard style={styles.examCard} onPress={() => router.push('/exams' as never)}>
            <View style={styles.examCardRow}>
              <View>
                <Text style={styles.examSubtitle}>AUTUMN 2026</Text>
                <Text style={styles.examTitle}>Mid Semester Examinations</Text>
                <Text style={styles.examDate}>Starts Monday, 3 Nov 2026 • Tap for Date Sheet</Text>
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
            <TouchableOpacity onPress={() => router.push('/pyq' as never)}>
              <Text style={styles.seeAllText}>Browse all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pyqGrid}>
            <GlassCard style={styles.pyqCard} onPress={() => router.push('/pyq' as never)}>
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

            <GlassCard style={styles.pyqCard} onPress={() => router.push('/pyq' as never)}>
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
            onPress={() => router.push('/dev/motion' as never)}
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
    borderBottomColor: 'rgba(17, 24, 39, 0.05)',
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
    gap: 10,
  },
  mailButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17, 24, 39, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mailBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: theme.colors.accent,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.bg,
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
    backgroundColor: 'rgba(17, 24, 39, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.10)',
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
    borderColor: 'rgba(17, 24, 39, 0.08)',
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
    backgroundColor: theme.colors.accent,
  },
  quickHubLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.ivory,
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
    backgroundColor: theme.colors.accentSoft,
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
    backgroundColor: 'rgba(232, 91, 34, 0.20)',
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
  mailSpotlightSection: {
    marginBottom: theme.spacing.lg,
  },
  miniUnreadPill: {
    backgroundColor: 'rgba(232, 91, 34, 0.20)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.chip,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  miniUnreadPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
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
    color: theme.colors.ivory,
  },
  mailSenderRole: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  mailDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  mailSubject: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: theme.colors.ivory,
    marginBottom: 4,
  },
  mailSnippet: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
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
    color: theme.colors.accent,
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
    fontSize: 11,
    marginLeft: 4,
  },
  deadlineCardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: theme.colors.ivory,
    marginBottom: 4,
  },
  deadlineCardDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
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
    color: theme.colors.accent,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  examTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
    color: theme.colors.ivory,
    marginBottom: 4,
  },
  examDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  countdownBox: {
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 43, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontFamily: 'Poppins-Bold',
    fontSize: 24,
    color: theme.colors.accent,
  },
  countdownLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    color: theme.colors.textSecondary,
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
    backgroundColor: 'rgba(17, 24, 39, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  pyqBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: theme.colors.accent,
  },
  pyqTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: theme.colors.ivory,
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
    color: theme.colors.textSecondary,
  },
  downloadCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  downloadText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.textSecondary,
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
    color: theme.colors.accent,
  },
});
