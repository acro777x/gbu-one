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
} from 'lucide-react-native';
import { Avatar, GlassCard, PillButton } from '../../src/components/ui';
import { CountUp } from '../../src/components/motion/CountUp';
import { OfficialSeal } from '../../src/components/brand/OfficialSeal';
import { useAuthStore } from '../../src/store/useAuthStore';
import { theme } from '../../src/lib/theme';

export default function ProfileScreen() {
  const { user, isGuest, classSelection, logout } = useAuthStore();

  // Notification toggles
  const [notifyNotices, setNotifyNotices] = useState(true);
  const [notifyTimetable, setNotifyTimetable] = useState(true);
  const [notifyExams, setNotifyExams] = useState(true);
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);

  // Manual Attendance Tracker state (local)
  const [attendedClasses, setAttendedClasses] = useState(38);
  const [totalClasses, setTotalClasses] = useState(44);

  const attendancePercent = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

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
              <CountUp value={attendancePercent} decimals={1} suffix="%" style={styles.attendanceNum} />
              <Text style={styles.attendanceRatio}>
                {attendedClasses} / {totalClasses} classes attended
              </Text>
            </View>

            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={styles.attendBtn}
                onPress={() => {
                  setAttendedClasses((a) => a + 1);
                  setTotalClasses((t) => t + 1);
                }}
              >
                <Plus size={16} color={theme.colors.success} />
                <Text style={styles.attendBtnText}>Present</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.attendBtn, styles.absentBtn]}
                onPress={() => {
                  setTotalClasses((t) => t + 1);
                }}
              >
                <Minus size={16} color={theme.colors.danger} />
                <Text style={[styles.attendBtnText, { color: theme.colors.danger }]}>Absent</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  attendanceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  attendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(61, 214, 140, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  absentBtn: {
    backgroundColor: 'rgba(255, 92, 92, 0.12)',
  },
  attendBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.success,
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
