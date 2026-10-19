import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  User,
  GraduationCap,
  LogOut,
  ChevronRight,
  Plus,
  Minus,
  Sparkles,
  Calendar,
  Award,
  Mail,
  Sun,
  Moon,
  Smartphone,
  Compass,
} from 'lucide-react-native';
import { Avatar, GlassCard, PillButton } from '../../src/components/ui';
import { CountUp } from '../../src/components/motion/CountUp';
import { OfficialSeal } from '../../src/components/brand/OfficialSeal';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
  useAttendanceStore,
  calculateAttendanceStatus,
} from '../../src/features/attendance/attendanceStore';
import { useAppTheme, ThemeMode } from '../../src/lib/ThemeContext';
import { theme } from '../../src/lib/theme';

export default function ProfileScreen() {
  const { colors, isDark, themeMode, setThemeMode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, isGuest, classSelection, logout } = useAuthStore();

  // Notification toggles
  const [notifyNotices, setNotifyNotices] = useState(true);
  const [notifyTimetable, setNotifyTimetable] = useState(true);
  const [notifyExams, setNotifyExams] = useState(true);
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);

  // Connected local attendance store
  const { subjects, markAttended, markMissed } = useAttendanceStore();
  const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
  const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
  const overallStatus = calculateAttendanceStatus(totalAttended, totalClasses, 75);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const handleThemeChange = (mode: ThemeMode) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }
    setThemeMode(mode);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(120, 100 + insets.bottom) }]} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Avatar
            url={user?.avatarUrl}
            name={user?.name}
            isGuest={isGuest}
            size={72}
          />
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{isGuest ? 'Guest Student' : user?.name}</Text>
          <Text style={[styles.userRoll, { color: colors.textSecondary }]}>
            {isGuest ? 'Guest Mode' : user?.rollNo}
          </Text>

          {/* Chips */}
          <View style={styles.chipRow}>
            <View style={[styles.badgeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17, 24, 39, 0.08)' }]}>
              <Text style={[styles.badgeChipText, { color: colors.textSecondary }]}>{classSelection?.school || 'SOICT'}</Text>
            </View>
            <View style={[styles.badgeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17, 24, 39, 0.08)' }]}>
              <Text style={[styles.badgeChipText, { color: colors.textSecondary }]}>{classSelection?.programmeCode || 'BCS'} Sem {classSelection?.semester || 'II'}</Text>
            </View>
            <View style={[styles.badgeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17, 24, 39, 0.08)' }]}>
              <Text style={[styles.badgeChipText, { color: colors.textSecondary }]}>{classSelection?.section || 'Sec B'}</Text>
            </View>
          </View>
        </View>

        {/* Theme & Appearance Switcher */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardSectionHeader, { color: colors.textPrimary }]}>Appearance & Theme</Text>
          <Text style={[styles.themeDescription, { color: colors.textSecondary }]}>
            {themeMode === 'system'
              ? `System Default (Currently ${isDark ? 'Dark' : 'Light'})`
              : themeMode === 'light'
                ? 'Always Light Theme'
                : 'Always Dark Theme'}
          </Text>

          <View style={[styles.themeSegmentContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderGlass }]}>
            {/* System Segment */}
            <TouchableOpacity
              style={[
                styles.themeSegment,
                themeMode === 'system' && [styles.themeSegmentActive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => handleThemeChange('system')}
              activeOpacity={0.8}
            >
              <Smartphone size={16} color={themeMode === 'system' ? colors.accent : colors.textSecondary} />
              <Text
                style={[
                  styles.themeSegmentText,
                  { color: themeMode === 'system' ? colors.accent : colors.textSecondary },
                ]}
              >
                System
              </Text>
            </TouchableOpacity>

            {/* Light Segment */}
            <TouchableOpacity
              style={[
                styles.themeSegment,
                themeMode === 'light' && [styles.themeSegmentActive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => handleThemeChange('light')}
              activeOpacity={0.8}
            >
              <Sun size={16} color={themeMode === 'light' ? colors.accent : colors.textSecondary} />
              <Text
                style={[
                  styles.themeSegmentText,
                  { color: themeMode === 'light' ? colors.accent : colors.textSecondary },
                ]}
              >
                Light
              </Text>
            </TouchableOpacity>

            {/* Dark Segment */}
            <TouchableOpacity
              style={[
                styles.themeSegment,
                themeMode === 'dark' && [styles.themeSegmentActive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => handleThemeChange('dark')}
              activeOpacity={0.8}
            >
              <Moon size={16} color={themeMode === 'dark' ? colors.accent : colors.textSecondary} />
              <Text
                style={[
                  styles.themeSegmentText,
                  { color: themeMode === 'dark' ? colors.accent : colors.textSecondary },
                ]}
              >
                Dark
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Guest CTA Card if applicable */}
        {isGuest && (
          <GlassCard style={styles.guestCtaCard} accentBorder>
            <Text style={[styles.guestCtaTitle, { color: colors.textPrimary }]}>Create an Account</Text>
            <Text style={[styles.guestCtaSubtitle, { color: colors.textSecondary }]}>
              Sign up with your student email to unlock PYQ uploads, cloud sync, and personalised push alerts.
            </Text>
            <PillButton
              label="Sign up / Log in"
              onPress={() => router.push('/login')}
              variant="primary"
              size="sm"
              style={{ marginTop: 12 }}
            />
          </GlassCard>
        )}

        {/* Attendance Tracker Card */}
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Attendance Tracker (Local)</Text>
            <Text style={[styles.attendanceTarget, { color: colors.accent }]}>75% Target</Text>
          </View>

          <View style={styles.attendanceRow}>
            <View style={styles.attendancePercentCol}>
              <CountUp value={overallStatus.percentage} decimals={1} suffix="%" style={{ ...styles.attendanceNum, color: colors.textPrimary }} />
              <Text style={[styles.attendanceRatio, { color: colors.textSecondary }]}>
                {totalAttended} / {totalClasses} classes attended
              </Text>
              <Text style={[styles.attendanceProjection, overallStatus.isShortage ? { color: colors.danger } : { color: colors.success }]}>
                {overallStatus.isShortage
                  ? `Shortage: Attend next ${overallStatus.classesNeededFor75} classes to hit 75%`
                  : `Safe: Can miss ${overallStatus.canBunkMargin} classes and stay >= 75%`}
              </Text>
            </View>
          </View>

          {/* Subject-wise Quick Adjusters */}
          <View style={[styles.subjectList, { borderTopColor: colors.divider }]}>
            {subjects.map((sub) => {
              const subStatus = calculateAttendanceStatus(sub.attended, sub.total, 75);
              return (
                <View key={sub.subjectCode} style={styles.subjectRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subjectName, { color: colors.textPrimary }]}>{sub.subjectCode} • {sub.subjectName}</Text>
                    <Text style={[styles.subjectSub, { color: colors.textSecondary }]}>
                      {sub.attended}/{sub.total} ({subStatus.percentage.toFixed(0)}%)
                    </Text>
                  </View>
                  <View style={styles.subjectBtns}>
                    <TouchableOpacity
                      style={[styles.subBtn, { backgroundColor: colors.successSoft }]}
                      onPress={() => markAttended(sub.subjectCode)}
                      hitSlop={6}
                    >
                      <Plus size={14} color={colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.subBtn, { backgroundColor: colors.dangerSoft }]}
                      onPress={() => markMissed(sub.subjectCode)}
                      hitSlop={6}
                    >
                      <Minus size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Academic Hubs Links */}
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/exams')}
          >
            <View style={styles.settingIconCol}>
              <Award size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Examination Hub & Results</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Date sheet, admit card alerts, on-device roll finder</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.settingDivider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/calendar')}
          >
            <View style={styles.settingIconCol}>
              <Calendar size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Academic Calendar & Holidays</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>2026-27 semester milestones, exams & vacations</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.settingDivider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/mail')}
          >
            <View style={styles.settingIconCol}>
              <Mail size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>GBU Webmail & Dispatch</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Official student mailbox, deans & placement circulars</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* My Class Settings */}
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/class-setup')}
          >
            <View style={styles.settingIconCol}>
              <GraduationCap size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>My Class & Department</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {classSelection?.section || 'BCS-II B'} ({classSelection?.school || 'SOICT'})
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* App Tour / Onboarding link */}
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/onboarding')}
          >
            <View style={styles.settingIconCol}>
              <Compass size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Welcome Tour & Onboarding</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Review introductory feature walk-through</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* Notification Preferences */}
        <GlassCard style={styles.card}>
          <Text style={[styles.cardSectionHeader, { color: colors.textPrimary }]}>Notification Preferences</Text>

          <View style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Smart Notices</Text>
            <Switch
              value={notifyNotices}
              onValueChange={setNotifyNotices}
              trackColor={{ false: colors.borderGlass, true: colors.accent }}
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Timetable & Room Changes</Text>
            <Switch
              value={notifyTimetable}
              onValueChange={setNotifyTimetable}
              trackColor={{ false: colors.borderGlass, true: colors.accent }}
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Exam Dates & Date Sheets</Text>
            <Switch
              value={notifyExams}
              onValueChange={setNotifyExams}
              trackColor={{ false: colors.borderGlass, true: colors.accent }}
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Deadlines & Fee Submission</Text>
            <Switch
              value={notifyDeadlines}
              onValueChange={setNotifyDeadlines}
              trackColor={{ false: colors.borderGlass, true: colors.accent }}
            />
          </View>
        </GlassCard>

        {/* Dev Motion Playground Link */}
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/dev/motion' as never)}
          >
            <View style={styles.settingIconCol}>
              <Sparkles size={20} color={colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Motion Playground</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>Test UI-thread animations, TypeWriter, LetterRise</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* Account / Logout */}
        <GlassCard style={styles.card}>
          {!isGuest && (
            <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
              <View style={styles.settingIconCol}>
                <LogOut size={20} color={colors.danger} />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={[styles.settingTitle, { color: colors.danger }]}>Log Out</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {isGuest && (
            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/login')}>
              <View style={styles.settingIconCol}>
                <User size={20} color={colors.accent} />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Switch to Account</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* About & Disclaimer */}
        <TouchableOpacity
          style={styles.aboutSection}
          onPress={() => router.push('/about')}
          accessibilityLabel="About GBU One, University Disclaimer & Privacy Policy"
        >
          <OfficialSeal />
          <Text style={[styles.aboutVersion, { color: colors.textSecondary }]}>GBU One v1.0.0</Text>
          <Text style={[styles.aboutDisclaimer, { color: colors.textTertiary }]}>
            Official student app of Gautam Buddha University, Greater Noida (subject to university approval before release). Tap to view full university disclaimer, privacy commitments, and contacts.
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 110,
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  userName: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    marginTop: 12,
  },
  userRoll: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  guestCtaCard: {
    marginBottom: theme.spacing.lg,
  },
  guestCtaTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
  },
  guestCtaSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  themeDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
  },
  themeSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  themeSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  themeSegmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  themeSegmentText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
  },
  attendanceTarget: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendancePercentCol: {
    flex: 1,
  },
  attendanceNum: {
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
  },
  attendanceRatio: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  attendanceProjection: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginTop: 4,
  },
  subjectList: {
    marginTop: 14,
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  subjectName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  subjectSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  subjectBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  subBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingDivider: {
    height: 1,
    marginVertical: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconCol: {
    marginRight: 12,
  },
  settingTextCol: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  settingValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  cardSectionHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toggleLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  aboutSection: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  aboutVersion: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    marginBottom: 4,
  },
  aboutDisclaimer: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
