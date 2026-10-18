import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
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
} from 'lucide-react-native';
import { Avatar, GlassCard, PillButton } from '../../src/components/ui';
import { CountUp } from '../../src/components/motion/CountUp';
import { OfficialSeal } from '../../src/components/brand/OfficialSeal';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
  useAttendanceStore,
  calculateAttendanceStatus,
} from '../../src/features/attendance/attendanceStore';
import { theme } from '../../src/lib/theme';

export default function ProfileScreen() {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Avatar
            url={user?.avatarUrl}
            name={user?.name}
            isGuest={isGuest}
            size={72}
          />
          <Text style={styles.userName}>{isGuest ? 'Guest Student' : user?.name}</Text>
          <Text style={styles.userRoll}>
            {isGuest ? 'Guest Mode' : user?.rollNo}
          </Text>

          {/* Chips */}
          <View style={styles.chipRow}>
            <View style={styles.badgeChip}>
              <Text style={styles.badgeChipText}>{classSelection?.school || 'SOICT'}</Text>
            </View>
            <View style={styles.badgeChip}>
              <Text style={styles.badgeChipText}>{classSelection?.programmeCode || 'BCS'} Sem {classSelection?.semester || 'II'}</Text>
            </View>
            <View style={styles.badgeChip}>
              <Text style={styles.badgeChipText}>{classSelection?.section || 'Sec B'}</Text>
            </View>
          </View>
        </View>

        {/* Guest CTA Card if applicable */}
        {isGuest && (
          <GlassCard style={styles.guestCtaCard} accentBorder>
            <Text style={styles.guestCtaTitle}>Create an Account</Text>
            <Text style={styles.guestCtaSubtitle}>
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
            <Text style={styles.cardTitle}>Attendance Tracker (Local)</Text>
            <Text style={styles.attendanceTarget}>75% Target</Text>
          </View>

          <View style={styles.attendanceRow}>
            <View style={styles.attendancePercentCol}>
              <CountUp value={overallStatus.percentage} decimals={1} suffix="%" style={styles.attendanceNum} />
              <Text style={styles.attendanceRatio}>
                {totalAttended} / {totalClasses} classes attended
              </Text>
              <Text style={[styles.attendanceProjection, overallStatus.isShortage ? styles.shortageText : styles.safeText]}>
                {overallStatus.isShortage
                  ? `Shortage: Attend next ${overallStatus.classesNeededFor75} classes to hit 75%`
                  : `Safe: Can miss ${overallStatus.canBunkMargin} classes and stay >= 75%`}
              </Text>
            </View>
          </View>

          {/* Subject-wise Quick Adjusters */}
          <View style={styles.subjectList}>
            {subjects.map((sub) => {
              const subStatus = calculateAttendanceStatus(sub.attended, sub.total, 75);
              return (
                <View key={sub.subjectCode} style={styles.subjectRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subjectName}>{sub.subjectCode} • {sub.subjectName}</Text>
                    <Text style={styles.subjectSub}>
                      {sub.attended}/{sub.total} ({subStatus.percentage.toFixed(0)}%)
                    </Text>
                  </View>
                  <View style={styles.subjectBtns}>
                    <TouchableOpacity
                      style={styles.subBtn}
                      onPress={() => markAttended(sub.subjectCode)}
                      hitSlop={6}
                    >
                      <Plus size={14} color={theme.colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.subBtn, styles.subBtnAbsent]}
                      onPress={() => markMissed(sub.subjectCode)}
                      hitSlop={6}
                    >
                      <Minus size={14} color={theme.colors.danger} />
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
              <Award size={20} color={theme.colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Examination Hub & Results</Text>
              <Text style={styles.settingValue}>Date sheet, admit card alerts, on-device roll finder</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/calendar')}
          >
            <View style={styles.settingIconCol}>
              <Calendar size={20} color={theme.colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Academic Calendar & Holidays</Text>
              <Text style={styles.settingValue}>2026-27 semester milestones, exams & vacations</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* My Class Settings */}
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/class-setup')}
          >
            <View style={styles.settingIconCol}>
              <GraduationCap size={20} color={theme.colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>My Class & Department</Text>
              <Text style={styles.settingValue}>
                {classSelection?.section || 'BCS-II B'} ({classSelection?.school || 'SOICT'})
              </Text>
            </View>
            <ChevronRight size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* Notification Preferences */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardSectionHeader}>Notification Preferences</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Smart Notices</Text>
            <Switch
              value={notifyNotices}
              onValueChange={setNotifyNotices}
              trackColor={{ false: '#333', true: theme.colors.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Timetable & Room Changes</Text>
            <Switch
              value={notifyTimetable}
              onValueChange={setNotifyTimetable}
              trackColor={{ false: '#333', true: theme.colors.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Exam Dates & Date Sheets</Text>
            <Switch
              value={notifyExams}
              onValueChange={setNotifyExams}
              trackColor={{ false: '#333', true: theme.colors.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Deadlines & Fee Submission</Text>
            <Switch
              value={notifyDeadlines}
              onValueChange={setNotifyDeadlines}
              trackColor={{ false: '#333', true: theme.colors.accent }}
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
              <Sparkles size={20} color={theme.colors.accent} />
            </View>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Motion Playground</Text>
              <Text style={styles.settingValue}>Test UI-thread animations, TypeWriter, LetterRise</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>

        {/* Account / Logout */}
        <GlassCard style={styles.card}>
          {!isGuest && (
            <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
              <View style={styles.settingIconCol}>
                <LogOut size={20} color={theme.colors.danger} />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={[styles.settingTitle, { color: theme.colors.danger }]}>Log Out</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}

          {isGuest && (
            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/login')}>
              <View style={styles.settingIconCol}>
                <User size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Switch to Account</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* About & Disclaimer */}
        <View style={styles.aboutSection}>
          <OfficialSeal />
          <Text style={styles.aboutVersion}>GBU One v1.0.0</Text>
          <Text style={styles.aboutDisclaimer}>
            Official student app of Gautam Buddha University, Greater Noida (subject to university approval before release). Notices and timetables are mirrored from university public sources.
          </Text>
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
    color: theme.colors.ivory,
    marginTop: 12,
  },
  userRoll: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  badgeChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  guestCtaCard: {
    marginBottom: theme.spacing.lg,
    backgroundColor: 'rgba(255, 106, 43, 0.08)',
    borderColor: theme.colors.accent,
  },
  guestCtaTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: theme.colors.ivory,
  },
  guestCtaSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    marginBottom: theme.spacing.md,
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
    color: theme.colors.ivory,
  },
  attendanceTarget: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.accent,
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
    color: theme.colors.ivory,
  },
  attendanceRatio: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  attendanceProjection: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginTop: 4,
  },
  shortageText: {
    color: theme.colors.danger,
  },
  safeText: {
    color: theme.colors.success,
  },
  subjectList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
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
    color: theme.colors.ivory,
  },
  subjectSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: theme.colors.textSecondary,
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
    backgroundColor: 'rgba(61, 214, 140, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subBtnAbsent: {
    backgroundColor: 'rgba(255, 92, 92, 0.15)',
  },
  settingDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
    color: theme.colors.ivory,
  },
  settingValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  cardSectionHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: theme.colors.ivory,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  toggleLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  aboutSection: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  aboutVersion: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  aboutDisclaimer: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
    lineHeight: 16,
  },
});
